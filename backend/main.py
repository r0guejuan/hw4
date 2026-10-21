"""Campus Customs API — run from backend/ with: uvicorn main:app --reload --port 8000

Serves the catalogue, product images, account signup/login, and the Handsome Dan chat
agent (agent.py) at POST /api/chat.
"""

import json
import logging
import re
import threading
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()  # must run before importing tools/auth, which read settings from the environment

from fastapi import Cookie, FastAPI, HTTPException, Request, Response, status  # noqa: E402
from fastapi.exceptions import RequestValidationError  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.responses import JSONResponse, StreamingResponse  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402

import agent  # noqa: E402
import auth  # noqa: E402
import checkout  # noqa: E402
import tools  # noqa: E402
from models import (  # noqa: E402
    MAX_CHAT_HISTORY,
    MAX_PAGE_RESULTS,
    MAX_SAVED_HISTORY,
    CartQuote,
    CartQuoteRequest,
    ChatHistory,
    ChatReply,
    ChatRequest,
    ChatTurn,
    CheckoutRequest,
    LoginRequest,
    OrderConfirmation,
    PageResults,
    PageSearch,
    Product,
    ProductDetail,
    SignupRequest,
    UserPublic,
)

log = logging.getLogger("campus_customs")

app = FastAPI(title="Campus Customs API")

# The Vite dev server proxies /api and /images, but allow direct calls during development too.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
    allow_credentials=True,
)


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    # FastAPI's default 422 echoes the submitted body back, which would include passwords.
    # Return only where the problem is and what it is.
    errors = [{"loc": list(e.get("loc", [])), "msg": e.get("msg", "Invalid value.")} for e in exc.errors()]
    return JSONResponse(status_code=422, content={"detail": errors})


@app.on_event("startup")
def create_checkout_tables() -> None:
    try:
        checkout.ensure_schema()
    except FileNotFoundError:
        log.warning("Database missing; checkout tables not created.")
    if not checkout.checkout_ready():
        log.warning("CARD_ENCRYPTION_KEY is missing or invalid; checkout is disabled until it is set.")


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "database": tools.DATABASE_PATH.exists()}


@app.get("/api/products", response_model=list[Product])
def products() -> list[Product]:
    return tools.list_products()


@app.get("/api/products/{product_id}", response_model=ProductDetail)
def product(product_id: str) -> ProductDetail:
    detail = tools.get_product(product_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return detail


# --- Accounts -------------------------------------------------------------------


def _start_session(response: Response, user: UserPublic) -> None:
    response.set_cookie(
        auth.SESSION_COOKIE,
        auth.make_session_token(user.id),
        max_age=auth.SESSION_TTL_SECONDS,
        httponly=True,  # page scripts can't read it
        samesite="lax",  # not sent on cross-site form posts
        secure=auth.COOKIE_SECURE,  # set COOKIE_SECURE=true when served over HTTPS
        path="/",
    )


@app.post("/api/auth/signup", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
def signup(body: SignupRequest, response: Response) -> UserPublic:
    try:
        user = auth.create_user(body.first_name, body.last_name, body.email, body.password)
    except auth.EmailTakenError:
        raise HTTPException(status_code=409, detail="An account with that email already exists. Try logging in.")
    _start_session(response, user)
    return user


@app.post("/api/auth/login", response_model=UserPublic)
def login(body: LoginRequest, request: Request, response: Response) -> UserPublic:
    client = request.client.host if request.client else "unknown"
    try:
        user = auth.authenticate(body.email, body.password, client)
    except auth.TooManyAttemptsError:
        raise HTTPException(status_code=429, detail="Too many failed attempts. Please wait 15 minutes and try again.")
    if user is None:
        # Same message whether the email or the password was wrong.
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    _start_session(response, user)
    return user


@app.post("/api/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    response.delete_cookie(auth.SESSION_COOKIE, path="/")


@app.get("/api/auth/me", response_model=UserPublic)
def me(cc_session: str | None = Cookie(default=None)) -> UserPublic:
    user_id = auth.read_session_token(cc_session)
    user = auth.get_user(user_id) if user_id is not None else None
    if user is None:
        raise HTTPException(status_code=401, detail="Not logged in.")
    return user


# --- Cart and checkout ---------------------------------------------------------


@app.post("/api/cart/quote", response_model=CartQuote)
def cart_quote(body: CartQuoteRequest) -> CartQuote:
    """Price the cart from the catalogue, with a tax estimate once a state is chosen."""
    return checkout.quote(body.items, body.state)


@app.post("/api/checkout", response_model=OrderConfirmation, status_code=status.HTTP_201_CREATED)
def place_order(body: CheckoutRequest, cc_session: str | None = Cookie(default=None)) -> OrderConfirmation:
    """Place an order with a test card. Requires a login; card numbers are stored encrypted."""
    user = current_user(cc_session)
    if user is None:
        raise HTTPException(status_code=401, detail="Log in to check out.")
    if not checkout.checkout_ready():
        raise HTTPException(status_code=503, detail="Checkout isn't set up on this server yet.")
    try:
        return checkout.place_order(user.id, body.items, body.address, body.card)
    except checkout.CartError as exc:
        raise HTTPException(status_code=409, detail=str(exc))


# --- Chat -----------------------------------------------------------------------


# Ended and filtered chats are appended here, one JSON object per line. The folder is
# gitignored; personal details are masked before writing.
SAFETY_LOG = Path(__file__).resolve().parent / "logs" / "safety_log.jsonl"
_safety_log_lock = threading.Lock()

_MASKS = [
    (re.compile(r"[\w.+-]+@[\w-]+(\.[\w-]+)+"), "[email]"),
    (re.compile(r"\b(?:\d[ -]?){13,19}\b"), "[card number]"),
    (re.compile(r"\b\d{3}-\d{2}-\d{4}\b"), "[ssn]"),
    (re.compile(r"(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}\b"), "[phone]"),
]


def _mask(text: str) -> str:
    for pattern, label in _MASKS:
        text = pattern.sub(label, text)
    return text


def log_safety_event(event: str, category: str | None, user: UserPublic | None, body: ChatRequest, reply: str) -> None:
    entry = {
        "time": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "event": event,
        "category": category,
        "user_id": user.id if user else None,
        "messages": [{"role": t.role, "content": _mask(t.content)} for t in body.messages],
        "reply": reply,
    }
    try:
        with _safety_log_lock:
            SAFETY_LOG.parent.mkdir(exist_ok=True)
            with SAFETY_LOG.open("a", encoding="utf-8") as f:
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except OSError:
        log.exception("Could not write the safety log")
    log.warning("Safety event: %s (%s), user_id=%s", event, category, entry["user_id"])


def build_page_results(search: PageSearch) -> PageResults | None:
    """Turn the agent's PageSearch into real products from the database.

    Filters are re-run with the same search_products function the agent used, so the page
    shows every match (not just the few the agent mentioned). Hand-picked ids are looked up
    one by one. Unknown ids are dropped. Returns None when nothing matches, so the page is
    left as it was rather than emptied.
    """
    if search.product_ids:
        cards = tools.product_cards(search.product_ids, limit=MAX_PAGE_RESULTS)
        total = len(cards)
    else:
        result = tools.search_products(
            search.query,
            search.category,
            search.color,
            search.size,
            search.max_price,
            search.min_price,
            search.in_stock_only,
            limit=MAX_PAGE_RESULTS,
        )
        cards = tools.product_cards([m.product_id for m in result.products], limit=MAX_PAGE_RESULTS)
        total = result.total_matches
    if not cards:
        return None
    return PageResults(title=search.title, total_matches=total, products=cards)


def current_user(cc_session: str | None) -> UserPublic | None:
    user_id = auth.read_session_token(cc_session)
    return auth.get_user(user_id) if user_id is not None else None


def shopper_context(user: UserPublic | None, body: ChatRequest, saved: int) -> agent.ShopperContext:
    customer = (
        agent.Customer(
            user_id=user.id,
            first_name=user.first_name,
            last_name=user.last_name,
            email=user.email,
            preferred_size=user.preferred_size,
        )
        if user
        else None
    )
    return agent.ShopperContext(customer=customer, page=agent.resolve_page(body.page), saved_messages=saved)


TIMEOUT_DETAIL = "Handsome Dan is taking too long to answer right now. Please send your message again."
FAILURE_DETAIL = "Handsome Dan couldn't fetch an answer just now. Please try again in a moment."


def prepare_chat(body: ChatRequest, cc_session: str | None):
    """Who is chatting, their new message, the history to replay, and the agent's deps.

    Logged in: earlier turns come from their saved history in chat_messages. Guest: earlier
    turns come from the browser.
    """
    user = current_user(cc_session)
    message = body.messages[-1].content
    if user:
        saved = tools.load_chat_history(user.id, MAX_CHAT_HISTORY - 1)
        # Saved rows were validated when written; skip re-validation of their length.
        history = [ChatTurn.model_construct(role=m.role, content=m.content) for m in saved]
    else:
        history = body.messages[:-1]
    shopper = shopper_context(user, body, saved=len(history) if user else 0)
    return user, message, history, shopper


def finish_chat(user: UserPublic | None, body: ChatRequest, message: str, outcome: "agent.ReplyResult") -> ChatReply:
    """Turn the agent's validated output into the API reply: safety log, cards, page, saving."""
    result = outcome.output
    log.info("Chat reply via %s tier (%s)", outcome.tier, outcome.model)
    if result.end_conversation:
        # Ended chats go to the safety log, not the shopper's saved history.
        log_safety_event("conversation_ended", result.safety_category, user, body, result.message)
        return ChatReply(reply=result.message, ended=True)

    # Cards are rebuilt from the database, so names, prices, and stock shown under the reply
    # are always real. Ids the model made up are dropped.
    cards = tools.product_cards(result.product_ids)
    page = build_page_results(result.page_search) if result.page_search else None
    preferred = None
    if user:
        try:
            tools.save_chat_exchange(user.id, message, result.message, [c.product_id for c in cards])
        except Exception:
            log.exception("Could not save chat history for user %s", user.id)
        preferred = tools.preferred_size(user.id)
    return ChatReply(reply=result.message, products=cards, page=page, preferred_size=preferred)


def filtered_reply(user: UserPublic | None, body: ChatRequest) -> ChatReply:
    # The provider refused the prompt. Decline politely and log it for review, but don't
    # lock the chat: this also catches harmless prompt-injection attempts.
    log_safety_event("provider_content_filter", None, user, body, agent.FILTERED_REPLY)
    return ChatReply(reply=agent.FILTERED_REPLY)


@app.post("/api/chat", response_model=ChatReply)
async def chat(body: ChatRequest, cc_session: str | None = Cookie(default=None)) -> ChatReply:
    """Send the shopper's message to the agent and return its reply plus product cards."""
    user, message, history, shopper = prepare_chat(body, cc_session)
    try:
        outcome = await agent.reply(message, history, shopper)
    except agent.AgentTimeout:
        log.warning("Agent run timed out after %ss", agent.AGENT_RUN_TIMEOUT)
        raise HTTPException(status_code=504, detail=TIMEOUT_DETAIL)
    except agent.ContentFiltered:
        return filtered_reply(user, body)
    except Exception:
        log.exception("Agent run failed")
        raise HTTPException(status_code=503, detail=FAILURE_DETAIL)
    return finish_chat(user, body, message, outcome)


@app.post("/api/chat/stream")
async def chat_stream(body: ChatRequest, cc_session: str | None = Cookie(default=None)) -> StreamingResponse:
    """Like /api/chat, but streams newline-delimited JSON events as Dan works:

        {"type": "status", "text": "Checking stock by size…"}
        {"type": "delta", "text": "The Basic Hoodie Big Yale is…"}   (reply so far, not yet checked)
        {"type": "final", "reply": {...ChatReply...}}                  (checked; replaces the deltas)
        {"type": "error", "detail": "..."}
    """
    user, message, history, shopper = prepare_chat(body, cc_session)

    def line(event: dict) -> str:
        return json.dumps(event, ensure_ascii=False) + "\n"

    async def events():
        try:
            async for kind, payload in agent.stream_reply(message, history, shopper):
                if kind == "done":
                    reply = finish_chat(user, body, message, payload)
                    yield line({"type": "final", "reply": reply.model_dump()})
                else:
                    yield line({"type": kind, "text": payload})
        except agent.AgentTimeout:
            log.warning("Streamed agent run timed out after %ss", agent.AGENT_RUN_TIMEOUT)
            yield line({"type": "error", "detail": TIMEOUT_DETAIL})
        except agent.ContentFiltered:
            yield line({"type": "final", "reply": filtered_reply(user, body).model_dump()})
        except Exception:
            log.exception("Streamed agent run failed")
            yield line({"type": "error", "detail": FAILURE_DETAIL})

    return StreamingResponse(events(), media_type="application/x-ndjson", headers={"Cache-Control": "no-cache"})


@app.get("/api/chat/history", response_model=ChatHistory)
def chat_history(cc_session: str | None = Cookie(default=None)) -> ChatHistory:
    """The logged-in shopper's saved chat (most recent messages). Guests have none."""
    user = current_user(cc_session)
    if user is None:
        raise HTTPException(status_code=401, detail="Log in to see your saved chat.")
    return ChatHistory(messages=tools.load_chat_history(user.id, MAX_SAVED_HISTORY))


@app.delete("/api/chat/history", status_code=status.HTTP_204_NO_CONTENT)
def clear_chat_history(cc_session: str | None = Cookie(default=None)) -> None:
    """Delete the logged-in shopper's saved chat."""
    user = current_user(cc_session)
    if user is None:
        raise HTTPException(status_code=401, detail="Log in to manage your saved chat.")
    tools.clear_chat_history(user.id)


# Serve only the product images folder, never the database file next to it.
app.mount("/images", StaticFiles(directory=tools.PRODUCTS_DIR), name="images")
