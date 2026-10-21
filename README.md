# HW4 — Campus Customs Agent

A React (Vite + TypeScript) frontend talking to a Python FastAPI backend whose brain is a PydanticAI agent.

## Project layout

```
hw4/
├── AI_prompts.md
├── requirements.txt
├── .env.example
├── .gitignore
├── README.md
├── frontend/                # Vite React TypeScript app
│   └── src/store/           # the 3D virtual store (/store), built with three.js
├── backend/
│   ├── main.py              # FastAPI app — run from backend/: uvicorn main:app --reload --port 8000
│   ├── agent.py             # PydanticAI agent (Handsome Dan): model, prompt, tools, loop limits
│   ├── audit.py             # append-only audit trail of agent runs → output/audit_trail.json
│   ├── auth.py              # password hashing, accounts, login sessions
│   ├── checkout.py          # cart pricing, tax estimates, test-card checkout, card encryption
│   ├── models.py            # Pydantic models: products, auth, chat, product cards
│   ├── tools.py             # read-only catalogue/inventory queries used by the API and agent
│   └── prompts/
│       └── prompt.md        # Handsome Dan's voice, honesty rules, safety basics
└── output/
    ├── harness.md
    ├── design.md
    ├── usability.md
    ├── app_check.html
    ├── app_check_images/    # screenshots linked from app_check.html
    └── audit_trail.json     # append-only log of every agent run, tool call, and stop reason
```

## Where the agent lives

The agent itself is four files in `backend/`:

| File | Role |
|---|---|
| `prompts/prompt.md` | Handsome Dan's instructions: voice, tool rules, honesty rules, scope, and safety rules |
| `agent.py` | The PydanticAI agent: models and fallbacks, the four tools, output checks, loop limits, safety screen, audit hooks |
| `tools.py` | Read-only catalogue and inventory queries that the tools wrap (and the in-memory catalogue cache) |
| `models.py` | Pydantic models for tool results, the agent's structured reply, and every API request and response |

`main.py` serves the API around it; `auth.py`, `checkout.py`, and `audit.py` handle accounts, checkout, and the audit trail. The full write-up is in `output/harness.md`.

## Quick start

You need Python 3.12+ and Node 20+.

1. `git clone https://github.com/r0guejuan/hw4.git` (this creates the `hw4/` folder), then put the data pack in `hw4/data/` (step 1).
2. Copy `.env.example` to `.env` and fill in the keys (step 2).
3. Start the backend on port 8000 (step 3).
4. Start the frontend on port 5173 (step 4), then open http://localhost:5173.

## 1. Place the data pack

The data pack is **not** in git. Put `data.zip` in the `hw4/` folder and run `unzip data.zip` so it looks like:

```
data/
├── campus_customs.db
└── products/                # images referenced by the catalogue
```

## 2. Configure environment variables

```bash
cp .env.example .env
```

Then edit `.env` and fill in your real `PORTKEY_API_KEY` (and `OPENAI_API_KEY` only if calling OpenAI directly). Never commit `.env`.

Checkout also needs `CARD_ENCRYPTION_KEY`, which encrypts stored card numbers. Generate one and paste it into `.env`:

```bash
.venv/bin/python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Keep it secret and don't change it once orders exist, or their saved cards can no longer be decrypted. Without it the shop works but checkout is turned off.

The agent uses two kinds of model, both set in `.env`:

| Tier | Variables | Default models | Used for |
|---|---|---|---|
| Hard | `OPENAI_MODEL_HARD`, `OPENAI_MODEL_HARD_ALT` | GPT-6 Sol, GPT-6 Astra | multi-step agent reasoning, tool orchestration |
| Simple | `OPENAI_MODEL`, `OPENAI_MODEL_SIMPLE_ALT` | GPT-5.6 Luna, GPT-5.6 Terra | short replies, classification, formatting |

## 3. Run the backend

From the `hw4/` folder:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd backend
uvicorn main:app --reload --port 8000
```

The API runs at http://localhost:8000:

| Endpoint | Returns |
|---|---|
| `GET /api/health` | `{"status": "ok", "database": true}` once the data pack is in place |
| `GET /api/products` | All catalogue products, each with a grouped `category` and an `image_url` |
| `GET /api/products/{product_id}` | One product plus stock per size (`sizes`, `in_stock`) |
| `GET /images/{file}.jpg` | Product images, served from `data/products/` only |
| `POST /api/auth/signup` | Create an account (first/last name, email, password + confirmation) and log in |
| `POST /api/auth/login` | Log in with email and password |
| `POST /api/auth/logout` | Log out |
| `GET /api/auth/me` | The logged-in user, or `401` |
| `POST /api/chat` | Send `{"messages": [...], "page": {...}}`; returns Handsome Dan's `reply`, chat `products`, and `page` results. Logged-in chats are saved. |
| `POST /api/chat/stream` | Same, but streams status updates and the reply as newline-delimited JSON (what the chat widget uses) |
| `POST /api/cart/quote` | Prices a cart from the catalogue, with a sales-tax estimate once a state is given |
| `POST /api/checkout` | Places an order with a **test** card (logged in only); see "Cart and checkout" below |
| `GET /api/chat/history` | The logged-in shopper's saved chat (`401` for guests) |
| `DELETE /api/chat/history` | Delete the logged-in shopper's saved chat |

Catalogue reads (including everything the agent's tools do) use a read-only database connection. The only writes are new accounts (`users`), logged-in shoppers' saved chats (`chat_messages`), and checkout (new `orders`, `order_items`, `addresses`, and `payment_cards` tables, plus the stock decrease in `inventory`). The checkout tables are created automatically the first time the backend starts. Passwords are stored as salted PBKDF2-SHA256 hashes (see `output/harness.md`, section 2). Set `SESSION_SECRET` in `.env` to a long random value so logins survive restarts.

Every chat turn is appended to `output/audit_trail.json`: tool calls, short arguments and results, the stop reason, tokens, and timing. The file is never wiped (see `output/harness.md`, section 10).

## 4. Run the frontend

In a second terminal, from the `hw4/` folder:

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173). The Vite dev server forwards `/api` and `/images` requests to the backend on port 8000, so start the backend first.

Pages: Home, Products (with category filters), a page for each product, About Us, Login, Create Account, Cart, Checkout, and the Virtual Store. A floating chat panel sits in the bottom-right corner. Login, Create Account, and the Handsome Dan chat all work. The chat calls a PydanticAI agent (`gpt-6-sol` through Portkey, falling back to `gpt-6-astra`) that answers from the database and shows matching product cards.

## Cart and checkout

Pick a size on any product page and press **Add to cart**. The cart icon in the header shows how many items you have. The cart lives in your browser, so it survives a reload and works before you log in. Prices and stock always come from the server, never from the browser.

- **Cart** (`/cart`): change quantities (capped at what's in stock, up to 10), remove items, and see the subtotal. If a size sells out after you added it, the line is flagged and checkout waits until you fix it.
- **Checkout** (`/checkout`): you need to be logged in. Enter a U.S. delivery address and the summary estimates sales tax from the state's base rate (for example, CT 6.35%). Then pay with a **test card**: the buttons fill in Visa `4242 4242 4242 4242`, Mastercard `5555 5555 5555 4444`, or Amex `3782 822463 10005`. Any other number is refused, so real card data can't be entered by mistake, and nothing is ever charged.
- **What's saved:** the order, its items, the address, and the card go to the database in one transaction, and stock is reduced at the same time. The card number is encrypted with `CARD_ENCRYPTION_KEY`. Only the brand, last four digits, and expiry are kept readable, and the security code is never stored. See `output/harness.md`, section 9.

## Virtual store

`/store` is a first-person walk through Campus Customs, modeled on the real shop at 59 Broadway (in the style of the Lecture 7 Evans Hall walkthrough). Open it from **Virtual Store** in the nav, the button on the home page, or the store bubble next to the chat icon.

- **Outside:** the three-story brick storefront on Broadway and its neighbors (a glass-front store, a Gothic Yale hall, the D.W. Flint building with its dry cleaner, and a café), with lampposts and street trees. Walk up to the doors to step inside.
- **Inside:** the folded-tee wall with college designs, the cap pegboard, the hoodie, crewneck, quarter-zip and jacket racks, the Boola Boola nook, display tables holding real catalogue items, a leather-couch lounge, Yale campus murals on every blue wall, and a life-size Handsome Dan behind the counter.
- **Controls:** on a computer, W A S D or the arrow keys to walk, the mouse to look, and E (or a click) to use what you're looking at; Esc frees the mouse. On a phone, the left thumbstick walks, dragging anywhere looks around, and a button appears for whatever you're facing. Portrait screens get a wider field of view.
- **Shopping:** a rack or display opens that category or product page. Talking to Dan opens the chat. Product pages you reach from the store show **Back to the virtual store**, which puts you back in the exact spot and direction you left from (kept in `sessionStorage`).

Everything in the store is drawn in code: models from three.js primitives, and textures (brick, wood, garments, murals, signs) painted on canvases. It loads no image files and no 3D models, and three.js is only downloaded when someone opens `/store`.

## Credits

The Handsome Dan illustrations (`frontend/src/assets/handsome-dan.webp` and the chat icon `handsome-dan-headset.webp`) were created for this project with Google Gemini.

The virtual store's 3D scene uses [three.js](https://threejs.org) and [@react-three/fiber](https://r3f.docs.pmnd.rs) (both MIT). Its layout follows photos of the real Campus Customs store and Street View images of Broadway; no photos are used in the scene itself. The building and business names on Broadway appear only to place the store in its real block.
