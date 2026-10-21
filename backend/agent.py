"""The Campus Customs shopping agent (Handsome Dan).

- Instructions: prompts/prompt.md, read once at import.
- Models: hard tier OPENAI_MODEL_HARD (default gpt-6-sol) → OPENAI_MODEL_HARD_ALT (gpt-6-astra);
  simple tier OPENAI_MODEL (gpt-5.6-luna) → OPENAI_MODEL_SIMPLE_ALT (gpt-5.6-terra), via Portkey.
- Tools: search_products, get_product_description, get_price, get_stock — thin wrappers
  over tools.py, so every product fact comes from the database.
- Output: AgentReply (message + product_ids); main.py turns the ids into product cards.
- Limits: USAGE_LIMITS caps model requests and tool calls per turn; AGENT_RUN_TIMEOUT caps time.
- Audit: every run, tool call, tool result, and stop reason is appended to output/audit_trail.json.
"""

import asyncio
import os
import re
import time

os.environ.setdefault("PYDANTIC_AI_NO_BANNER", "1")

from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from openai import AsyncOpenAI
from pydantic_ai import Agent, ModelRetry, RunContext
from pydantic_ai.exceptions import ModelHTTPError, UnexpectedModelBehavior, UsageLimitExceeded
from pydantic_ai.messages import (
    FunctionToolCallEvent,
    FunctionToolResultEvent,
    ModelMessage,
    ModelRequest,
    ModelResponse,
    TextPart,
    ToolReturnPart,
    UserPromptPart,
)
from pydantic_ai.models.fallback import FallbackModel
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider
from pydantic_ai.usage import UsageLimits

import audit
import tools
from models import (
    AgentReply,
    ChatTurn,
    PageContext,
    ProductDescription,
    ProductPrice,
    ProductSearchResult,
    SafetyCategory,
    StockReport,
)

PROMPT_PATH = Path(__file__).resolve().parent / "prompts" / "prompt.md"

# Time limits so a stalled model call can never leave the chat spinning. Each HTTP request to
# Portkey gets MODEL_REQUEST_TIMEOUT (one retry), and a whole agent run, including tool calls
# and any fallback, gets AGENT_RUN_TIMEOUT.
MODEL_REQUEST_TIMEOUT = 30.0  # seconds
AGENT_RUN_TIMEOUT = 45.0

# Loop limits per turn. A normal answer takes 2-3 model requests (call tools, then reply) and a
# handful of tool calls; number-check retries add a request or two. Anything beyond this is the
# loop going in circles, so the turn stops with LIMIT_REPLY instead of running up cost.
MAX_MODEL_REQUESTS = 6
MAX_TOOL_CALLS = 12
USAGE_LIMITS = UsageLimits(request_limit=MAX_MODEL_REQUESTS, tool_calls_limit=MAX_TOOL_CALLS)
LIMIT_REPLY = (
    "That one needs more digging than I can do in one go. Could you narrow it down for me, "
    "like a category, a color, or a size?"
)

DEFAULT_MODEL = "gpt-6-sol"
DEFAULT_FALLBACK_MODEL = "gpt-6-astra"


@dataclass
class Customer:
    """The logged-in shopper, from the session cookie. Never includes the password hash or cookie."""

    user_id: int
    first_name: str
    last_name: str
    email: str
    preferred_size: str | None = None


@dataclass
class PageInfo:
    """The page the shopper is looking at, with any product verified against the database."""

    page_type: str
    path: str
    product_id: str | None = None
    product_name: str | None = None
    category: str | None = None
    results_title: str | None = None


@dataclass
class ShopperContext:
    """The agent's dependencies for one chat request (PydanticAI `deps`).

    - customer: who is chatting (None for guests)
    - page: where they are on the site, so "this" can be resolved
    - saved_messages: how many earlier messages were loaded from their saved history
    """

    customer: Customer | None = None
    page: PageInfo | None = None
    saved_messages: int = 0


def resolve_page(page: PageContext | None) -> PageInfo | None:
    """Turn the browser's page context into PageInfo, looking the product up in the database.

    An unknown product id is dropped, and the product name always comes from the catalogue,
    so the browser can't make the agent believe it's on a page for something that doesn't exist.
    """
    if page is None:
        return None
    product_id = product_name = None
    if page.product_id:
        found = tools.get_price(page.product_id)
        if found is not None:
            product_id, product_name = found.product_id, found.name
    return PageInfo(
        page_type=page.page_type,
        path=page.path,
        product_id=product_id,
        product_name=product_name,
        category=page.category,
        results_title=page.results_title,
    )


# Through Portkey, the gpt-6.1-* names are served as gpt-5.6-luna, so the real model names are used.
DEFAULT_SIMPLE_MODEL = "gpt-5.6-luna"
DEFAULT_SIMPLE_FALLBACK_MODEL = "gpt-5.6-terra"


def _provider() -> OpenAIProvider:
    api_key = os.getenv("PORTKEY_API_KEY")
    if not api_key:
        raise RuntimeError("PORTKEY_API_KEY is not set. Copy .env.example to .env and add your key.")
    client = AsyncOpenAI(
        api_key=api_key,
        base_url=os.getenv("PORTKEY_BASE_URL", "https://api.portkey.ai/v1"),
        default_headers={"x-portkey-api-key": api_key},
        timeout=MODEL_REQUEST_TIMEOUT,
        max_retries=1,
    )
    return OpenAIProvider(openai_client=client)


_PROVIDER = _provider()
NO_REASONING = {"openai_reasoning_effort": "none"}

MODEL_NAMES = (
    os.getenv("OPENAI_MODEL_HARD", DEFAULT_MODEL),
    os.getenv("OPENAI_MODEL_HARD_ALT", DEFAULT_FALLBACK_MODEL),
)
SIMPLE_MODEL_NAMES = (
    os.getenv("OPENAI_MODEL", DEFAULT_SIMPLE_MODEL),
    os.getenv("OPENAI_MODEL_SIMPLE_ALT", DEFAULT_SIMPLE_FALLBACK_MODEL),
)

# Hard tier: tool-heavy questions (search, prices, stock, comparisons).
# Through Portkey's Azure route, Sol and Astra only allow function tools with reasoning off.
HARD_MODEL = FallbackModel(
    OpenAIChatModel(MODEL_NAMES[0], provider=_PROVIDER, settings=NO_REASONING),
    OpenAIChatModel(MODEL_NAMES[1], provider=_PROVIDER, settings=NO_REASONING),
)
# Simple tier: greetings, thanks, yes/no follow-ups. Cheaper and faster; reasoning off.
# Tools stay available, so a "yes, show me" can still search.
SIMPLE_MODEL = FallbackModel(
    OpenAIChatModel(SIMPLE_MODEL_NAMES[0], provider=_PROVIDER, settings=NO_REASONING),
    OpenAIChatModel(SIMPLE_MODEL_NAMES[1], provider=_PROVIDER, settings=NO_REASONING),
)


agent = Agent(
    HARD_MODEL,
    deps_type=ShopperContext,
    output_type=AgentReply,
    instructions=PROMPT_PATH.read_text(encoding="utf-8"),
    # These are reasoning models: temperature is ignored, and max_tokens includes reasoning.
    model_settings={"max_tokens": 2000},
    retries=2,
)


@agent.instructions
def shopper_context(ctx: RunContext[ShopperContext]) -> str:
    """Per-request context built from the deps: who is chatting and which page they're on."""
    deps = ctx.deps
    lines = ["## Current context"]

    if deps.customer:
        c = deps.customer
        lines.append(f"- Customer: logged in as {c.first_name} {c.last_name} ({c.email}).")
        if c.preferred_size:
            lines.append(
                f"- Usual size: {c.preferred_size} (they've asked about it repeatedly). When they say \"my size\" "
                "or don't give a size, use it, and mention you're assuming it."
            )
        if deps.saved_messages:
            lines.append(
                f"- Memory: the earlier messages in this conversation ({deps.saved_messages}) are their saved "
                "chat history from previous visits. You may refer back to them."
            )
        else:
            lines.append("- Memory: this is their first conversation; it will be saved for next time.")
    else:
        lines.append("- Customer: a guest (not logged in). Nothing is saved after they leave the page.")

    page = deps.page
    if page is None:
        lines.append("- Page: unknown.")
    elif page.product_id:
        lines.append(
            f'- Page: the product page for "{page.product_name}" (product_id `{page.product_id}`). '
            '"This", "it", or "this one" means this product unless they say otherwise.'
        )
    elif page.page_type == "products" and page.results_title:
        lines.append(f'- Page: the Products page, showing your earlier results "{page.results_title}".')
    elif page.page_type == "products" and page.category:
        lines.append(f"- Page: the Products page, filtered to {page.category}.")
    else:
        lines.append(f"- Page: {page.page_type.replace('_', ' ')} ({page.path}).")

    lines.append(f"- Today: {date.today():%B %d, %Y}.")
    lines.append(f"- Product categories: {', '.join(tools.CATEGORIES)}. Sizes: XS, S, M, L, XL, XXL.")
    return "\n".join(lines)


@agent.tool_plain
def search_products(
    query: str = "",
    category: str | None = None,
    color: str | None = None,
    size: str | None = None,
    max_price: float | None = None,
    min_price: float | None = None,
    in_stock_only: bool = False,
    limit: int = 8,
) -> ProductSearchResult:
    """Search the Campus Customs catalogue. Results are ranked best first.

    Args:
        query: Free-text words, e.g. "navy hoodie", "Grace Hopper", "bulldog", "The Game".
            Leave empty to browse by filters only.
        category: One of Hoodies, Crewnecks, T-Shirts, Quarter-Zips, Jackets, Long Sleeves.
        color: The garment's main color, e.g. "navy", "gray", "white". Matches the garment
            itself, not its lettering. Use this (not `query`) when the shopper names a color.
        size: Only include products with this size in stock (XS, S, M, L, XL, XXL).
        max_price: Highest price in dollars.
        min_price: Lowest price in dollars.
        in_stock_only: Only include products with at least one size in stock.
        limit: How many results to return (1-20).
    """
    limit = max(1, min(limit, 20))
    return tools.search_products(query, category, color, size, max_price, min_price, in_stock_only, limit)


def _unknown_product(product_id: str) -> ModelRetry:
    return ModelRetry(f"No product with id {product_id!r}. Call search_products first and use an id it returns.")


@agent.tool_plain
def get_product_description(product_id: str) -> ProductDescription:
    """What a product is and looks like: name, category, garment type, full description, colors.

    Use this to describe a product or answer questions about its design, fit, or colors.

    Args:
        product_id: A product_id returned by search_products.
    """
    result = tools.get_description(product_id)
    if result is None:
        raise _unknown_product(product_id)
    return result


@agent.tool_plain
def get_price(product_id: str) -> ProductPrice:
    """The exact current price of one product. Quote `price_text` as written.

    Call this whenever the shopper asks what something costs.

    Args:
        product_id: A product_id returned by search_products.
    """
    result = tools.get_price(product_id)
    if result is None:
        raise _unknown_product(product_id)
    return result


@agent.tool_plain
def get_stock(product_id: str, size: str | None = None) -> StockReport:
    """How many units of one product are in stock, by size.

    Call this whenever the shopper asks about availability, sizes, or how many are left.
    Pass `size` when they ask about one size; omit it to get every size.

    Args:
        product_id: A product_id returned by search_products.
        size: XS, S, M, L, XL, or XXL. Leave empty for all sizes.
    """
    if size is not None and size.upper().strip() not in tools.SIZE_ORDER:
        raise ModelRetry(f"Size must be one of {', '.join(tools.SIZE_ORDER)}, or left empty for all sizes.")
    result = tools.get_stock(product_id, size)
    if result is None:
        raise _unknown_product(product_id)
    return result


# --- Number check (output validator) --------------------------------------------
# Before a reply is sent, every dollar amount and every "N left / in stock" quantity in it must
# match a value returned by a tool during this turn (or a number the shopper typed, like a
# budget). Otherwise the model is told exactly what didn't match and asked to fix the reply.

PRICE_PATTERN = re.compile(r"\$\s?(\d{1,4}(?:,\d{3})*(?:\.\d{1,2})?)")
SIZE_WORD = r"(?:XXL|XL|XS|S|M|L|smalls?|mediums?|larges?|extra[- ]larges?)"
QUANTITY_PATTERNS = [
    re.compile(r"\b(\d{1,4})\s+(?:[A-Za-z-]+\s+){0,3}?(?:left|in stock|available|remaining)\b", re.I),
    re.compile(r"\bonly\s+(\d{1,4})\b", re.I),
    re.compile(rf"\b{SIZE_WORD}\s*[(:]\s*(\d{{1,4}})\b"),
    re.compile(rf"\b(\d{{1,4}})\s+in\s+(?:size\s+)?{SIZE_WORD}\b"),
]


@dataclass
class TurnFacts:
    prices: set[float]
    quantities: set[int]


def _collect_facts(messages: list[ModelMessage]) -> TurnFacts:
    """Prices and quantities from the tool results of the current run.

    Only this run's messages contain tool results; saved history is replayed as plain text,
    so numbers from earlier visits never count as verified.
    """
    facts = TurnFacts(prices=set(), quantities=set())

    def walk(value: object) -> None:
        if hasattr(value, "model_dump"):
            value = value.model_dump()
        if isinstance(value, dict):
            for key, item in value.items():
                if key == "price" and isinstance(item, (int, float)):
                    facts.prices.add(round(float(item), 2))
                elif key in ("quantity", "total_in_stock", "total_matches") and isinstance(item, int):
                    facts.quantities.add(item)
                else:
                    walk(item)
        elif isinstance(value, (list, tuple)):
            facts.quantities.add(len(value))
            for item in value:
                walk(item)

    for message in messages:
        for part in getattr(message, "parts", []):
            if isinstance(part, ToolReturnPart):
                walk(part.content)
    return facts


def find_unverified_numbers(text: str, facts: TurnFacts, shopper_text: str) -> list[str]:
    """Dollar amounts and stock quantities in `text` that no tool result (or the shopper) supplied."""
    typed_prices = {round(float(m.replace(",", "")), 2) for m in PRICE_PATTERN.findall(shopper_text)}
    typed_prices |= {float(n) for n in re.findall(r"\b(\d{1,4})\b", shopper_text)}
    problems = []
    for raw in PRICE_PATTERN.findall(text):
        value = round(float(raw.replace(",", "")), 2)
        if value not in facts.prices and value not in typed_prices:
            problems.append(f"${raw}")
    for pattern in QUANTITY_PATTERNS:
        for raw in pattern.findall(text):
            if int(raw) not in facts.quantities:
                problems.append(f"quantity {raw}")
    return list(dict.fromkeys(problems))


@agent.output_validator
def check_numbers(ctx: RunContext[ShopperContext], output: AgentReply) -> AgentReply:
    if ctx.partial_output or output.end_conversation:
        return output
    facts = _collect_facts(ctx.messages)
    shopper_text = ctx.prompt if isinstance(ctx.prompt, str) else ""
    problems = find_unverified_numbers(output.message, facts, shopper_text)
    if problems:
        raise ModelRetry(
            f"Your reply mentions {', '.join(problems)}, but no tool result in this turn shows that value. "
            "Prices must match get_price or search_products exactly, and stock counts must match get_stock. "
            "Call the right tool if you haven't, then rewrite the reply using only those values "
            "(or leave the number out)."
        )
    return output


# Safety rule 2: no web addresses, emails, or phone numbers in replies (988 and 911 are fine,
# and are too short to match). Checked in code as well as in the prompt.
CONTACT_PATTERNS = [
    re.compile(r"\bhttps?://\S+|\bwww\.\S+|\b[\w-]+\.(?:com|org|net|edu|io|co|gov)\b(?:/\S*)?", re.I),
    re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+"),
    re.compile(r"(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}\b"),
]


def find_contact_details(text: str) -> list[str]:
    return [m.group(0) for pattern in CONTACT_PATTERNS for m in pattern.finditer(text)]


@agent.output_validator
def check_contact_details(ctx: RunContext[ShopperContext], output: AgentReply) -> AgentReply:
    if ctx.partial_output:
        return output
    found = find_contact_details(output.message)
    if found:
        raise ModelRetry(
            f"Your reply includes {', '.join(found)}. Never write web addresses, email addresses, or phone numbers "
            "(988 and 911 are the only exceptions). Refer to Campus Customs pages by name instead and rewrite the reply."
        )
    return output


# Sent if the model still can't produce verified numbers after its retries.
UNVERIFIED_REPLY = (
    "Sorry, I couldn't double-check those numbers just now. Please ask again, or check the product page "
    "for the current price and stock."
)


# --- Model routing ----------------------------------------------------------------
# Short social turns don't need the big model. These patterns match the whole message.
SIMPLE_TURN = re.compile(
    r"^(?:(?:hi|hello|hey|yo|howdy|good (?:morning|afternoon|evening)|thanks?(?: you)?(?: so much)?|thx|ty|"
    r"thank u|appreciate it|ok(?:ay)?|cool|great|nice|awesome|perfect|got it|sounds good|"
    r"yes(?: please)?|yeah|yep|sure|no(?: thanks?(?: you)?)?|nope|nah|bye|goodbye|see you|later)"
    r"[\s,.!?]*(?:dan|handsome dan)?[\s,.!?]*)+$",
    re.I,
)


def is_simple_turn(message: str) -> bool:
    text = message.strip()
    return len(text.split()) <= 6 and bool(SIMPLE_TURN.match(text))


def to_message_history(turns: list[ChatTurn]) -> list[ModelMessage]:
    """Convert the earlier chat turns from the browser into PydanticAI message history.

    Only plain text is replayed. Earlier assistant turns become model text, so the agent
    can't be tricked into treating them as tool results or instructions.
    """
    history: list[ModelMessage] = []
    for turn in turns:
        if turn.role == "user":
            history.append(ModelRequest(parts=[UserPromptPart(content=turn.content)]))
        else:
            history.append(ModelResponse(parts=[TextPart(content=turn.content)]))
    return history


# --- Safety screen ----------------------------------------------------------------
# A deterministic check that runs before the model. The model provider's own content filter
# sometimes rejects these messages outright (so the agent never sees them), and a crisis
# message must always get the same safe answer, so clear-cut cases are handled here.
# The prompt still tells the agent to end the chat for subtler cases.

SAFETY_PATTERNS: dict[SafetyCategory, re.Pattern[str]] = {
    "self_harm": re.compile(
        r"\b(kill(ing)? myself|suicid\w*|end (it all|my life)|take my (own )?life|hurt(ing)? myself|"
        r"self[- ]?harm|cut(ting)? myself|overdose|(want|wish) (to|i was|i were) dead|want to die)\b",
        re.I,
    ),
    "violence_weapons": re.compile(
        r"\b((make|build|buy|get)\w* (a |an )?(pipe )?(bomb|explosive|gun|firearm|weapon)s?|pipe bomb|"
        r"ghost gun|molotov|shoot(ing)? up|(kill|stab|shoot|hurt|attack)(ing)? (him|her|them|someone|somebody|"
        r"people|my (roommate|professor|ex|teacher|classmate)\w*))\b",
        re.I,
    ),
    "hacking_fraud": re.compile(
        r"\b(hack(ing)? (into|someone|my (roommate|ex|friend))|(get|break|log) into (someone|my (roommate|ex|friend))\w*|"
        r"(steal|phish)\w* (password|account|credit card|card number|data|login)s?|"
        r"(without|bypass\w*|skip\w*) (paying|payment|the payment)|stolen (credit )?card|carding|"
        r"someone(\'s| else\'s) (password|account|email))\b",
        re.I,
    ),
    "drugs_crime": re.compile(
        r"\b(cocaine|heroin|fentanyl|meth(amphetamine)?|mdma|ecstasy|lsd|ketamine|"
        r"(buy|sell|get|make|cook)\w* (drugs|pills)|launder\w* money|shoplift\w*|steal (from|a|the) )\b",
        re.I,
    ),
}

SAFETY_REPLIES: dict[SafetyCategory, str] = {
    "self_harm": (
        "I'm really glad you told me, and you matter. Please call or text 988 (Suicide & Crisis Lifeline) "
        "now, or call 911 if you're in danger. Yale students can also reach Yale Mental Health & Counseling. "
        "I can't help with this here, so I'm going to end this chat."
    ),
    "violence_weapons": (
        "I can't help with anything that could hurt people, so I'm ending this chat. "
        "If someone is in danger, call 911."
    ),
    "hacking_fraud": "I can't help with getting into accounts, systems, or payments that aren't yours, so I'm ending this chat.",
    "drugs_crime": "I can't help with that, so I'm ending this chat.",
}


def screen_message(text: str) -> SafetyCategory | None:
    """Return the dangerous category a message clearly falls into, or None."""
    for category, pattern in SAFETY_PATTERNS.items():
        if pattern.search(text):
            return category
    return None


# Said when the model provider's content filter blocks a message the screen didn't catch
# (often a jailbreak attempt, but it could be someone in trouble, so 988 is mentioned gently).
FILTERED_REPLY = (
    "That's not something I can help with. I'm here for Campus Customs merch: hoodies, crewnecks, "
    "tees, sizes, colors, and prices. If you're going through something hard, you can call or text 988 any time."
)


class AgentTimeout(Exception):
    """The agent didn't finish within AGENT_RUN_TIMEOUT seconds."""


class ContentFiltered(Exception):
    """The model provider refused the conversation (e.g. a jailbreak attempt or harmful content)."""


def _blocked_by_content_filter(exc: BaseException) -> bool:
    """True if every model refused because the provider's content filter flagged the prompt."""
    if isinstance(exc, BaseExceptionGroup):
        return any(_blocked_by_content_filter(e) for e in exc.exceptions)
    return isinstance(exc, ModelHTTPError) and "content_filter" in str(exc.body)


@dataclass
class ReplyResult:
    output: AgentReply
    tier: str  # "screen", "simple", "hard", "fallback" (number check failed), or "limit"
    model: str | None = None
    usage: dict | None = None  # requests, tool_calls, input_tokens, output_tokens


def _usage(result) -> dict:
    u = result.usage() if callable(result.usage) else result.usage  # a property on run results, a method on streams
    return {"requests": u.requests, "tool_calls": u.tool_calls, "input_tokens": u.input_tokens, "output_tokens": u.output_tokens}


# --- Audit trail ----------------------------------------------------------------


def _audit_start(run_id: str, channel: str, tier: str, shopper: ShopperContext, message: str) -> None:
    page = shopper.page
    audit.record(
        "run_start",
        run_id,
        channel=channel,
        tier=tier,
        user=f"user {shopper.customer.user_id}" if shopper.customer else "guest",
        page=(page.product_id or page.page_type) if page else None,
        history_messages=shopper.saved_messages or None,
        message_chars=len(message),
    )


def _stop_reason(result: ReplyResult) -> str:
    if result.output.end_conversation:
        return "ended_for_safety" if result.tier != "screen" else "screened"
    return {"fallback": "number_check_failed", "limit": "usage_limit"}.get(result.tier, "final_reply")


def _audit_end(run_id: str, started: float, stop_reason: str, result: ReplyResult | None = None, error: str | None = None) -> None:
    out = result.output if result else None
    audit.record(
        "run_end",
        run_id,
        stop_reason=stop_reason,
        tier=result.tier if result else None,
        model=result.model if result else None,
        **(result.usage or {} if result else {}),
        safety_category=out.safety_category if out else None,
        product_ids=out.product_ids or None if out else None,
        page_search=out.page_search.title if out and out.page_search else None,
        reply_chars=len(out.message) if out else None,
        error=error,
        duration_ms=round((time.monotonic() - started) * 1000),
    )


def _audit_event(run_id: str, event, started: dict[str, float]) -> None:
    """Record a tool call or tool result from the agent's event stream."""
    if isinstance(event, FunctionToolCallEvent):
        started[event.part.tool_call_id] = time.monotonic()
        audit.record("tool_call", run_id, tool=event.part.tool_name, args=audit.short(event.part.args or {}))
    elif isinstance(event, FunctionToolResultEvent):
        part = event.part
        t0 = started.pop(part.tool_call_id, None)
        ok = isinstance(part, ToolReturnPart)
        audit.record(
            "tool_result",
            run_id,
            tool=part.tool_name,
            ok=ok,
            result=audit.summarize_result(part.tool_name, part.content) if ok else audit.short(part.content),
            duration_ms=round((time.monotonic() - t0) * 1000) if t0 else None,
        )


def audit_handler(run_id: str):
    started: dict[str, float] = {}

    async def handle(ctx: RunContext[ShopperContext], events) -> None:
        async for event in events:
            _audit_event(run_id, event, started)

    return handle


async def reply(message: str, history: list[ChatTurn], shopper: ShopperContext) -> ReplyResult:
    """Run the agent on the shopper's new message, with earlier turns as message history.

    `history` is the saved conversation for logged-in shoppers, or the browser's copy for guests.
    Simple social turns run on the cheaper model tier; everything else on the hard tier.
    """
    run_id, started = audit.new_run_id(), time.monotonic()
    category = screen_message(message)
    if category is not None:
        result = ReplyResult(
            AgentReply(message=SAFETY_REPLIES[category], end_conversation=True, safety_category=category), "screen"
        )
        _audit_start(run_id, "chat", "screen", shopper, message)
        _audit_end(run_id, started, "screened", result)
        return result
    tier = "simple" if is_simple_turn(message) else "hard"
    _audit_start(run_id, "chat", tier, shopper, message)
    try:
        result = await asyncio.wait_for(_run_once(message, history, shopper, tier, run_id), timeout=AGENT_RUN_TIMEOUT)
    except TimeoutError as exc:
        _audit_end(run_id, started, "timeout")
        raise AgentTimeout() from exc
    except Exception as exc:
        if _blocked_by_content_filter(exc):
            _audit_end(run_id, started, "content_filter")
            raise ContentFiltered() from exc
        _audit_end(run_id, started, "error", error=type(exc).__name__)
        raise
    _audit_end(run_id, started, _stop_reason(result), result)
    return result


def _tidy(output: AgentReply) -> AgentReply:
    if output.end_conversation:
        output.product_ids, output.page_search = [], None
    elif output.safety_category is not None:
        output.safety_category = None  # a category without ending the chat is meaningless
    return output


async def _run_once(
    message: str, history: list[ChatTurn], shopper: ShopperContext, tier: str, run_id: str
) -> ReplyResult:
    """One non-streaming agent run on the chosen tier, with number-check retries."""
    try:
        result = await agent.run(
            message,
            message_history=to_message_history(history),
            deps=shopper,
            model=SIMPLE_MODEL if tier == "simple" else HARD_MODEL,
            usage_limits=USAGE_LIMITS,
            event_stream_handler=audit_handler(run_id),
        )
    except UsageLimitExceeded as exc:
        audit.record("limit_reached", run_id, detail=audit.short(str(exc)))
        return ReplyResult(AgentReply(message=LIMIT_REPLY), "limit")
    except UnexpectedModelBehavior:
        # Typically: the number check still failed after all retries. Never send unverified numbers.
        return ReplyResult(AgentReply(message=UNVERIFIED_REPLY), "fallback")
    return ReplyResult(_tidy(result.output), tier, result.response.model_name, _usage(result))


# --- Streaming ------------------------------------------------------------------
# Same pipeline as reply(), but yields events as the agent works, so the chat can show
# progress ("Checking stock…") and then the reply text before the cards arrive.
#   ("status", "Searching the catalogue…")   when Dan calls a tool
#   ("delta", "The Basic Hoodie is…")        the reply text so far (not yet number-checked)
#   ("done", ReplyResult)                    the final, validated result

TOOL_STATUS = {
    "search_products": "Searching the catalogue…",
    "get_product_description": "Reading the product details…",
    "get_price": "Checking the price…",
    "get_stock": "Checking stock by size…",
}


async def stream_reply(message: str, history: list[ChatTurn], shopper: ShopperContext) -> AsyncIterator[tuple]:
    run_id, started = audit.new_run_id(), time.monotonic()
    category = screen_message(message)
    if category is not None:
        out = AgentReply(message=SAFETY_REPLIES[category], end_conversation=True, safety_category=category)
        _audit_start(run_id, "chat_stream", "screen", shopper, message)
        _audit_end(run_id, started, "screened", ReplyResult(out, "screen"))
        yield ("done", ReplyResult(out, "screen"))
        return

    tier = "simple" if is_simple_turn(message) else "hard"
    _audit_start(run_id, "chat_stream", tier, shopper, message)
    queue: asyncio.Queue[tuple] = asyncio.Queue()
    tool_started: dict[str, float] = {}

    async def on_events(ctx: RunContext[ShopperContext], events) -> None:
        async for event in events:
            _audit_event(run_id, event, tool_started)
            if isinstance(event, FunctionToolCallEvent) and event.part.tool_name in TOOL_STATUS:
                queue.put_nowait(("status", TOOL_STATUS[event.part.tool_name]))

    async def run() -> None:
        try:
            async with agent.run_stream(
                message,
                message_history=to_message_history(history),
                deps=shopper,
                model=SIMPLE_MODEL if tier == "simple" else HARD_MODEL,
                usage_limits=USAGE_LIMITS,
                event_stream_handler=on_events,
            ) as result:
                last = ""
                async for partial in result.stream_output(debounce_by=0.05):
                    if partial.message and partial.message != last and not partial.end_conversation:
                        last = partial.message
                        queue.put_nowait(("delta", last))
                output = await result.get_output()
                model_name = result.response.model_name
                usage = _usage(result)
            queue.put_nowait(("done", ReplyResult(_tidy(output), tier, model_name, usage)))
        except UsageLimitExceeded as exc:
            audit.record("limit_reached", run_id, detail=audit.short(str(exc)))
            queue.put_nowait(("reset", ""))
            queue.put_nowait(("done", ReplyResult(AgentReply(message=LIMIT_REPLY), "limit")))
        except (UnexpectedModelBehavior, ModelRetry):
            # Streaming can't retry a reply that fails the number check, so clear the draft and
            # rerun this turn without streaming, where the check can send the model back to fix it.
            queue.put_nowait(("status", "Double-checking those numbers…"))
            queue.put_nowait(("reset", ""))
            try:
                audit.record("retry_without_streaming", run_id, reason="number check")
                queue.put_nowait(("done", await _run_once(message, history, shopper, tier, run_id)))
            except Exception as exc:
                queue.put_nowait(("error", exc))
        except Exception as exc:  # handed to the consumer below
            queue.put_nowait(("error", exc))

    task = asyncio.create_task(run())
    loop = asyncio.get_running_loop()
    deadline = loop.time() + AGENT_RUN_TIMEOUT
    finished = False
    try:
        while True:
            remaining = deadline - loop.time()
            if remaining <= 0:
                raise AgentTimeout()
            try:
                kind, payload = await asyncio.wait_for(queue.get(), timeout=remaining)
            except TimeoutError as exc:
                raise AgentTimeout() from exc
            if kind == "error":
                if _blocked_by_content_filter(payload):
                    finished = True
                    _audit_end(run_id, started, "content_filter")
                    raise ContentFiltered() from payload
                finished = True
                _audit_end(run_id, started, "error", error=type(payload).__name__)
                raise payload
            if kind == "done":
                finished = True
                _audit_end(run_id, started, _stop_reason(payload), payload)
            yield (kind, payload)
            if kind == "done":
                return
    except AgentTimeout:
        finished = True
        _audit_end(run_id, started, "timeout")
        raise
    finally:
        if not finished:
            _audit_end(run_id, started, "cancelled")  # the shopper closed the page mid-answer
        if not task.done():
            task.cancel()
