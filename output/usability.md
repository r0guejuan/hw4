# Usability Improvements (Problem 9)

Six improvements to the Campus Customs site and Handsome Dan: three on the frontend, three on the backend. Each section says what was added, how it works, and how it was tested, followed by a short note on why it helps a Campus Customs shopper or the business (section 7, in my own words).

---

## Frontend

### 1. Real filters and sorting on the Products page

**What was added**

- A filter sidebar (a collapsible "Filters" panel on phones) next to the product grid:
  - **Color**, by the garment's own color, grouped into families (Navy, Gray, Charcoal, Cream, White, Coral) with swatches and counts. A gray hoodie with navy lettering counts as gray, not navy.
  - **Size in stock** (XS–XXL): only products with at least one of the chosen sizes in stock.
  - **Price range**: min and max inputs plus "Under $40 / $60 / $75" shortcuts.
  - **In stock only** toggle.
  - **Sort**: name A–Z or Z–A, price low to high or high to low (plus "Dan's order" for chat results).
- The existing style chips (Hoodies, Crewnecks…) still work and combine with every filter.
- The same filters and sorting also work on **Handsome Dan's chat results**, so a shopper can ask Dan for "Grace Hopper gear" and then narrow it to their size and price.
- Filters are stored in the URL (e.g. `/products?category=Hoodies&color=Navy&sizes=L&max=75&sort=price-desc`), so a filtered view can be bookmarked, shared, or reached with the Back button.
- A live "11 of 102 items" count, an empty state with "Clear filters", and a "Clear filters" link.

**How it works**

- `GET /api/products` now includes each product's `color_family` and `sizes_in_stock` (from the in-memory catalogue, item 5), so all filtering is instant in the browser.
- `frontend/src/filters.ts` reads and writes the URL and applies filters and sorting. `components/ProductFilters.tsx` is the panel.

**Tested**: Hoodies + Navy + L in stock + under $75, sorted high to low → 11 items, all $68. The same query against the database also gives 11. While testing I found and fixed a bug where quick consecutive clicks undid each other, because React Router updates the URL asynchronously.

### 2. Suggested prompts and streaming replies

**What was added**

- **Starter bubbles** under the greeting: "Hoodies under $70", "What's in my size?", "Gift for a parent". One click sends the question. They appear at the start of every visit (also under a returning shopper's saved chat) until the shopper sends their first message.
- **Streaming replies**: instead of three dots for several seconds, the chat shows what Dan is doing ("Searching the catalogue…", "Checking the price…", "Checking stock by size…"), then his reply text as it arrives, then the product cards.

**How it works**

- New endpoint `POST /api/chat/stream` returns newline-delimited JSON events: `status` (a tool was called), `delta` (reply text so far), `reset` (clear the draft), `final` (the checked reply with cards and page results), `error`.
- `agent.stream_reply()` uses PydanticAI's `run_stream` with an event handler that turns each tool call into a status line.
- The final reply always replaces the streamed draft, so what stays on screen has passed the number check (item 4). If a streamed answer fails the check, the draft is cleared, "Double-checking those numbers…" appears, and that turn is rerun without streaming, which lets the model retry.
- The non-streaming `POST /api/chat` still exists, with identical behavior.

**Tested**: "Hoodies under $70" from the starter → "Searching the catalogue…" at 2.7 s, final reply at 4.8 s, page switched to "Hoodies under $70" (25 items).

**Finding**: with these models, most of the wait is the model thinking before it writes. The text itself arrives in a burst at the end (measured in every output mode). So the status lines, not word-by-word text, are what make the wait feel shorter.

### 3. Remembering the shopper's size

**What was added**

- For a logged-in shopper, the site learns their **usual size**: the size they've asked Dan about most, once it has come up in at least two separate messages ("M", "medium", "mediums", "size small", "XL"…).
- Once known:
  - **Products page**: the size filter defaults to that size ("Showing items in stock in your usual size, M. Show all sizes"), with a ★ on that size chip.
  - **Every product card** shows a badge: "M in stock" (green) or "M sold out" (red).
  - **Product page**: that size's tile is outlined and labeled "Your size".
  - **Handsome Dan** gets it in his context ("Usual size: M"). For "What's in my size?" or a question without a size, he uses it and says so ("Assuming your usual M…").
- The shopper stays in control: "Show all sizes" or any size click overrides the default.

**How it works**

- `tools.preferred_size(user_id)` counts sizes in the shopper's own saved messages (`chat_messages`). Nothing new is stored, and guests are never profiled.
- It's returned in `GET /api/auth/me` (`preferred_size`), added to the agent's `Customer` deps, and sent back in every chat reply so the page updates as soon as Dan learns it.

**Tested**: a new account asked about M twice → `preferred_size: "M"`. The Products page defaulted to M (80 of 102 items) with "M in stock" badges. "Show all sizes" → 102 items with 22 "M sold out" badges. "What's in my size?" → Dan: "Assuming you mean… your usual M".

---

## Backend

### 4. Every price and stock number is checked before it's sent

**What was added**

A PydanticAI **output validator** (`check_numbers` in `backend/agent.py`) that runs on every reply before it leaves the server:

1. It collects every price and quantity from the **tool results of this turn** (`get_price`, `get_stock`, `search_products`). Numbers from saved history don't count; they may be out of date.
2. It finds every dollar amount and every stock count in Dan's reply ("$68", "5 left", "only 3", "12 in L", "XS (12)").
3. Any number that doesn't match a tool result, and isn't a number the shopper typed (like a budget, "under $70"), triggers `ModelRetry`. The model is told exactly which values didn't match and to call the right tool and rewrite.
4. If it still can't produce verified numbers after its retries, the shopper gets a safe message instead: "Sorry, I couldn't double-check those numbers just now…", never an unverified price.

**Tested** (with a scripted model so the mistake is guaranteed): the first answer "It's $54 and there are 40 left in M" was rejected with "Your reply mentions $54, quantity 40, but no tool result in this turn shows that value…". The retry answered "It's $68.00 and there are 5 left in M." A model that never fixes its numbers gets the safe fallback message.

### 5. The catalogue and stock are loaded into memory once

**What was added**

- The 102 products and 612 inventory rows are read from SQLite **once** and kept in memory (`tools.catalogue()`). Search, the description, price, and stock tools, product cards, page results, and `GET /api/products` all read from memory.
- The snapshot refreshes every 5 minutes, so inventory changes made outside the app still appear. `tools.reload_catalogue()` forces a refresh.
- Chat history and accounts still go straight to the database.

**Measured**: first load 5 ms; then 100 searches in 17 ms total (about 0.17 ms each, with no database reads). Previously, every search and every card list re-read both tables.

### 6. Simple turns go to cheaper models

**What was added**

- Two model tiers:
  - **Hard** (tool-heavy questions: search, price, stock, comparisons): **gpt-6-sol**, falling back to **gpt-6-astra**.
  - **Simple** (greetings, thanks, yes/no, "ok", "bye"): **gpt-5.6-luna**, falling back to **gpt-5.6-terra**, with reasoning off.
- `is_simple_turn()` decides with a free pattern check (no extra model call): the whole message must be a short social phrase ("thanks Dan", "yes please", "no thanks", "hi!"). Anything mentioning a product, size, or price stays on the hard tier. Tools remain available on the simple tier, so a "yes" that needs a search still works.
- Every reply logs which tier and model answered.

**Finding**: through Portkey, the `gpt-6.1-sol` and `gpt-6.1-luna` names were both served as `gpt-5.6-luna`, so until now Dan wasn't actually using Sol, and the two tiers were the same model. `.env` now uses `gpt-6-sol` (the real Sol) for hard turns and `gpt-5.6-luna` / `gpt-5.6-terra` for simple ones.

**Tested**: "hi!" and "thanks Dan" → simple tier (gpt-5.6-luna). Product questions → hard tier (gpt-6-sol-2026-09-22). Dangerous requests → handled by the safety screen with no model call at all.

---

## 7. Why it helps a Campus Customs shopper or the business

_In my own words._

| Improvement | Why it helps |
|---|---|
| 1. Filters and sorting | Improves the ability for shoppers that do not want to use the chat agent to narrow down the items by color, size, and budget instead of having to scroll past things they don't want to buy. This was my frustration about the real yalebulldogblue.com site. |
| 2. Suggested prompts and streaming | Saves on token spend by having efficient queries built into the main page and gets shoppers who do not know what to ask the chatbot a one-tap starter with Dan. |
| 3. Remembering the shopper's size | It's a nice touch to have a site know your size so you can save time having to filter or ask for your size. Also, it should save on token spend if the user doesn't have to input additional text into the model. Ultimately, it makes the site feel more personal. |
| 4. Price and stock check | This comes down to trust. Users won't want to continue to use the Handsome Dan chatbot if it does not come back with accurate responses. |
| 5. Catalogue in memory | Instead of having to re-read the database every time, answering from memory improves response speeds and the site should be able to handle more shoppers at once without additional latency from multiple shoppers querying the database at the same time. |
| 6. Cheaper models for simple turns | Tokenomics. More expensive models are not needed for all types of tasks and this should reduce the token spend. |
