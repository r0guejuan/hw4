"""Database helpers for the catalogue, inventory, and chat history.

The API uses these for the Products pages, and agent.py wraps the search, detail, and
stock functions as the agent's tools. Every value the agent quotes comes from here.
"""

import json
import os
import re
import sqlite3
import threading
import time
from contextlib import closing
from dataclasses import dataclass
from pathlib import Path

from models import (
    MAX_PAGE_RESULTS,
    ChatHistoryMessage,
    Product,
    ProductCard,
    ProductDescription,
    ProductDetail,
    ProductMatch,
    ProductPrice,
    ProductSearchResult,
    SizeStock,
    SizeStockLevel,
    StockReport,
)

BACKEND_DIR = Path(__file__).resolve().parent


def _resolve(env_var: str, default: str) -> Path:
    """Resolve a path from .env relative to backend/, so uvicorn can start from anywhere."""
    path = Path(os.getenv(env_var, default))
    return path if path.is_absolute() else (BACKEND_DIR / path).resolve()


DATABASE_PATH = _resolve("DATABASE_PATH", "../data/campus_customs.db")
PRODUCTS_DIR = _resolve("PRODUCTS_DIR", "../data/products")

SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL"]

# garment_type has ~22 inconsistent labels; group them into shopper-friendly categories.
# Order matters: "full-zip hooded sweatshirt" is a hoodie, not a jacket.
CATEGORY_RULES = [
    ("hood", "Hoodies"),
    ("quarter-zip", "Quarter-Zips"),
    ("jacket", "Jackets"),
    ("long-sleeve", "Long Sleeves"),
    ("t-shirt", "T-Shirts"),
    ("crewneck", "Crewnecks"),
    ("mockneck", "Crewnecks"),
    ("sweatshirt", "Crewnecks"),
]


def categorize(garment_type: str) -> str:
    label = garment_type.lower()
    for keyword, category in CATEGORY_RULES:
        if keyword in label:
            return category
    return "Other"


def connect_rw() -> sqlite3.Connection:
    """Read-write connection, used only for inserting users and saving chat history."""
    if not DATABASE_PATH.exists():
        raise FileNotFoundError(f"Database not found at {DATABASE_PATH}. Unzip data.zip into hw4/ (see README).")
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def connect() -> sqlite3.Connection:
    """Open the database read-only so the shop can never modify it by accident."""
    if not DATABASE_PATH.exists():
        raise FileNotFoundError(
            f"Database not found at {DATABASE_PATH}. Unzip data.zip into hw4/ (see README)."
        )
    conn = sqlite3.connect(f"file:{DATABASE_PATH}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


# Three seed rows have placeholder text instead of a real description; never show it.
PLACEHOLDER_MARKER = "filename-based stub"
PLACEHOLDER_DESCRIPTION = "Detailed description coming soon."


def clean_description(text: str) -> str:
    return PLACEHOLDER_DESCRIPTION if PLACEHOLDER_MARKER in text else text


# Garment colors grouped into a few families for the Products page color filter.
COLOR_FAMILIES = [
    ("charcoal", "Charcoal"),
    ("navy", "Navy"),
    ("gray", "Gray"),
    ("grey", "Gray"),
    ("cream", "Cream"),
    ("ivory", "Cream"),
    ("white", "White"),
    ("coral", "Coral"),
    ("blue", "Blue"),
    ("black", "Black"),
]


def color_family(colors: list[str]) -> str:
    """Family of the garment's own color (the first entry in `colors`)."""
    garment = colors[0].lower() if colors else ""
    for keyword, family in COLOR_FAMILIES:
        if keyword in garment:
            return family
    return "Other" if garment else "Unknown"


def _to_product(row: sqlite3.Row, sizes_in_stock: list[str]) -> Product:
    # image_file_path is "products/<file>.jpg"; the API serves data/products at /images.
    filename = Path(row["image_file_path"]).name
    colors = json.loads(row["colors"])
    return Product(
        product_id=row["product_id"],
        name=row["name"],
        garment_type=row["garment_type"],
        category=categorize(row["garment_type"]),
        description=clean_description(row["description"]),
        colors=colors,
        search_tags=json.loads(row["search_tags"]),
        image_url=f"/images/{filename}",
        price=row["price"],
        color_family=color_family(colors),
        sizes_in_stock=sizes_in_stock,
    )


# --- In-memory catalogue -------------------------------------------------------
# The catalogue (102 products) and inventory (612 rows) are read from SQLite once and kept
# in memory, so search, lookup tools, cards, and the Products API don't re-read the database
# on every call. The snapshot refreshes after CATALOGUE_TTL_SECONDS so inventory changes made
# outside the app still show up; reload_catalogue() forces a refresh.

CATALOGUE_TTL_SECONDS = 300


@dataclass(frozen=True)
class Catalogue:
    products: dict[str, Product]  # by product_id, in name order
    stock: dict[str, list[SizeStock]]  # by product_id, sizes in XS..XXL order
    loaded_at: float


_catalogue: Catalogue | None = None
_catalogue_lock = threading.Lock()


def _load_catalogue() -> Catalogue:
    with closing(connect()) as conn:
        rows = conn.execute("SELECT * FROM catalogue ORDER BY name").fetchall()
        stock_rows = conn.execute("SELECT product_id, size, quantity FROM inventory").fetchall()
    quantities: dict[str, dict[str, int]] = {}
    for r in stock_rows:
        quantities.setdefault(r["product_id"], {})[r["size"]] = r["quantity"]
    stock: dict[str, list[SizeStock]] = {}
    products: dict[str, Product] = {}
    for r in rows:
        pid = r["product_id"]
        # Every standard size is listed; a size with no inventory row counts as 0, never unknown.
        sizes = [SizeStock(size=sz, quantity=quantities.get(pid, {}).get(sz, 0)) for sz in SIZE_ORDER]
        stock[pid] = sizes
        products[pid] = _to_product(r, [s.size for s in sizes if s.quantity > 0])
    return Catalogue(products=products, stock=stock, loaded_at=time.monotonic())


def catalogue() -> Catalogue:
    global _catalogue
    current = _catalogue
    if current is None or time.monotonic() - current.loaded_at > CATALOGUE_TTL_SECONDS:
        with _catalogue_lock:
            if _catalogue is None or time.monotonic() - _catalogue.loaded_at > CATALOGUE_TTL_SECONDS:
                _catalogue = _load_catalogue()
            current = _catalogue
    return current


def reload_catalogue() -> Catalogue:
    global _catalogue
    with _catalogue_lock:
        _catalogue = _load_catalogue()
        return _catalogue


def list_products() -> list[Product]:
    return list(catalogue().products.values())


def get_product(product_id: str) -> ProductDetail | None:
    cat = catalogue()
    product = cat.products.get(product_id)
    if product is None:
        return None
    sizes = cat.stock[product_id]
    return ProductDetail(**product.model_dump(), sizes=sizes, in_stock=any(s.quantity > 0 for s in sizes))


# --- Agent search and stock -----------------------------------------------------

CATEGORIES = list(dict.fromkeys(category for _, category in CATEGORY_RULES))

# Shopper words -> words that appear in the catalogue.
SYNONYMS = {
    "hoodie": "hood",
    "hoodies": "hood",
    "hooded": "hood",
    "tee": "t-shirt",
    "tees": "t-shirt",
    "tshirt": "t-shirt",
    "shirt": "t-shirt",
    "shirts": "t-shirt",
    "crew": "crewneck",
    "crewnecks": "crewneck",
    "sweatshirts": "sweatshirt",
    "quarterzip": "quarter-zip",
    "zip": "zip",
    "jackets": "jacket",
    "grey": "gray",
    "blue": "blue",
    "dog": "bulldog",
    "puppy": "bulldog",
    "college": "college",
    "rc": "college",
}
STOPWORDS = {
    "a", "an", "and", "any", "anything", "do", "for", "have", "i", "in", "is", "it", "me",
    "my", "of", "on", "or", "please", "show", "some", "something", "that", "the", "to",
    "want", "with", "you", "yale", "size", "sizes", "got", "need", "looking", "like",
}


def _all_products_with_stock() -> list[tuple[Product, list[SizeStock]]]:
    cat = catalogue()
    return [(p, cat.stock[pid]) for pid, p in cat.products.items()]


def _in_stock_sizes(sizes: list[SizeStock]) -> list[str]:
    return [s.size for s in sizes if s.quantity > 0]


def _terms(query: str) -> list[str]:
    words = re.findall(r"[a-z0-9]+(?:-[a-z0-9]+)?", query.lower().replace("1/4", "quarter-zip"))
    terms = []
    for word in words:
        if word in STOPWORDS or len(word) < 2:
            continue
        terms.append(SYNONYMS.get(word, word.rstrip("s") if len(word) > 3 else word))
    return terms


def garment_color(p: Product) -> str:
    """The garment's own color: the first entry in `colors` (the rest are print/trim colors).

    Three catalogue rows have no colors (placeholder rows); they match no color filter
    rather than a guessed one.
    """
    return p.colors[0].lower() if p.colors else ""


def _haystack(p: Product) -> str:
    return " ".join([p.name, p.garment_type, p.category, p.description, *p.colors, *p.search_tags]).lower()


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
    """Filter and rank catalogue products. Matches on name, type, description, colors, and tags."""
    limit = max(1, min(limit, MAX_PAGE_RESULTS))
    terms = _terms(query)
    size = size.upper().strip() if size else None
    color_term = SYNONYMS.get(color.lower().strip(), color.lower().strip()) if color else None
    category_key = category.lower().strip().rstrip("s") if category else None

    scored: list[tuple[int, ProductMatch]] = []
    for product, sizes in _all_products_with_stock():
        if category_key and not product.category.lower().rstrip("s").startswith(category_key):
            continue
        if color_term and color_term not in garment_color(product):
            continue
        if max_price is not None and product.price > max_price:
            continue
        if min_price is not None and product.price < min_price:
            continue
        available = _in_stock_sizes(sizes)
        if size and size not in available:
            continue
        if in_stock_only and not available:
            continue
        score = 0
        if terms:
            text = _haystack(product)
            name = product.name.lower()
            score = sum(2 if t in name else 1 for t in terms if t in text)
            if score == 0:
                continue
        scored.append(
            (
                score,
                ProductMatch(
                    product_id=product.product_id,
                    name=product.name,
                    category=product.category,
                    colors=product.colors,
                    price=product.price,
                    sizes_in_stock=available,
                ),
            )
        )

    scored.sort(key=lambda item: -item[0])
    matches = [m for _, m in scored]
    note = None
    if not matches:
        note = "No products match. Try fewer filters or different words."
    elif len(matches) > limit:
        note = f"Showing the top {limit} of {len(matches)} matches. Narrow the search to see others."
    return ProductSearchResult(total_matches=len(matches), products=matches[:limit], note=note)


# --- Lookup tools: description, price, stock ------------------------------------
# Each reads one product straight from the database. They return None for an unknown id;
# agent.py turns that into a retry so the model searches for a real id.


def get_description(product_id: str) -> ProductDescription | None:
    p = catalogue().products.get(product_id)
    if p is None:
        return None
    return ProductDescription(
        product_id=p.product_id,
        name=p.name,
        category=p.category,
        garment_type=p.garment_type,
        description=p.description,
        colors=p.colors,
    )


def get_price(product_id: str) -> ProductPrice | None:
    p = catalogue().products.get(product_id)
    if p is None:
        return None
    return ProductPrice(product_id=p.product_id, name=p.name, price=p.price, price_text=f"${p.price:,.2f}")


def get_stock(product_id: str, size: str | None = None) -> StockReport | None:
    """Units in stock for one product: one size if given, otherwise every size."""
    cat = catalogue()
    p = cat.products.get(product_id)
    if p is None:
        return None
    levels = [SizeStockLevel(size=s.size, quantity=s.quantity, in_stock=s.quantity > 0) for s in cat.stock[product_id]]
    requested = size.upper().strip() if size else None
    return StockReport(
        product_id=p.product_id,
        name=p.name,
        requested_size=requested,
        sizes=[lvl for lvl in levels if lvl.size == requested] if requested else levels,
        available_sizes=[lvl.size for lvl in levels if lvl.in_stock],
        sold_out_sizes=[lvl.size for lvl in levels if not lvl.in_stock],
        total_in_stock=sum(lvl.quantity for lvl in levels),
    )


def short_description(text: str, limit: int = 110) -> str:
    """First sentence of a description, trimmed for a card."""
    first = re.split(r"(?<=[.!?])\s", text.strip(), maxsplit=1)[0]
    return first if len(first) <= limit else first[: limit - 1].rsplit(" ", 1)[0] + "…"


def product_cards(product_ids: list[str], limit: int = 6) -> list[ProductCard]:
    """Build cards for the given ids, in order, skipping unknown ids and duplicates."""
    products = catalogue().products
    cards: list[ProductCard] = []
    for pid in dict.fromkeys(product_ids):
        product = products.get(pid)
        if product is None:
            continue
        cards.append(
            ProductCard(
                product_id=product.product_id,
                name=product.name,
                category=product.category,
                price=product.price,
                image_url=product.image_url,
                short_description=short_description(product.description),
                colors=product.colors,
                color_family=product.color_family,
                sizes_in_stock=product.sizes_in_stock,
            )
        )
        if len(cards) == limit:
            break
    return cards


# --- Customer memory (chat_messages) ----------------------------------------------
# Logged-in shoppers' chats are saved here, one row per message. products_json holds the
# products shown with an assistant reply as a list of {"product_id", "name"} objects (older
# seed rows hold full product snapshots; only product_id is read back). Cards are rebuilt
# from the catalogue on load, so prices and stock shown in old chats are current.


def _product_ids_from_json(raw: str | None) -> list[str]:
    try:
        items = json.loads(raw) if raw else []
    except ValueError:
        return []
    return [item["product_id"] for item in items if isinstance(item, dict) and item.get("product_id")]


def load_chat_history(user_id: int, limit: int) -> list[ChatHistoryMessage]:
    """The user's most recent `limit` messages, oldest first, with product cards rebuilt."""
    with closing(connect()) as conn:
        rows = conn.execute(
            "SELECT role, content, products_json, created_at FROM chat_messages "
            "WHERE user_id = ? ORDER BY id DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()
    messages = []
    for row in reversed(rows):
        if row["role"] not in ("user", "assistant") or not row["content"]:
            continue
        ids = _product_ids_from_json(row["products_json"]) if row["role"] == "assistant" else []
        messages.append(
            ChatHistoryMessage(
                role=row["role"],
                content=row["content"],
                products=product_cards(ids) if ids else [],
                created_at=row["created_at"],
            )
        )
    return messages


def save_chat_exchange(user_id: int, user_text: str, assistant_text: str, product_ids: list[str]) -> None:
    """Save one shopper message and Dan's reply together (one transaction)."""
    shown = [{"product_id": c.product_id, "name": c.name} for c in product_cards(product_ids)]
    with closing(connect_rw()) as conn, conn:
        conn.execute(
            "INSERT INTO chat_messages (user_id, role, content, products_json) VALUES (?, 'user', ?, NULL)",
            (user_id, user_text),
        )
        conn.execute(
            "INSERT INTO chat_messages (user_id, role, content, products_json) VALUES (?, 'assistant', ?, ?)",
            (user_id, assistant_text, json.dumps(shown)),
        )


def clear_chat_history(user_id: int) -> int:
    with closing(connect_rw()) as conn, conn:
        return conn.execute("DELETE FROM chat_messages WHERE user_id = ?", (user_id,)).rowcount


# --- Shopper's usual size -------------------------------------------------------
# Worked out from what a logged-in shopper has asked about in their saved chat: the size
# they mention most often, if they've mentioned it in at least PREFERRED_SIZE_MIN_MENTIONS
# separate messages. Nothing extra is stored; it's recomputed from chat_messages.

PREFERRED_SIZE_MIN_MENTIONS = 2
_SIZE_WORDS = {
    "extra small": "XS", "x-small": "XS", "xsmall": "XS",
    "small": "S", "medium": "M", "large": "L",
    "extra large": "XL", "x-large": "XL", "xlarge": "XL",
    "xx-large": "XXL", "xxlarge": "XXL", "2xl": "XXL", "2x": "XXL",
}
# Uppercase letters only, so "I'm" or "a" never count as sizes.
_SIZE_CODE = re.compile(r"(?<![A-Za-z0-9'])(XXL|XL|XS|S|M|L)(?![A-Za-z'])")
_SIZE_WORD = re.compile(r"\b(extra[ -]?small|x-?small|extra[ -]?large|xx-?large|x-?large|2xl|2x|small|medium|large)s?\b", re.I)


def sizes_mentioned(text: str) -> set[str]:
    found = set(_SIZE_CODE.findall(text))
    for word in _SIZE_WORD.findall(text):
        key = word.lower().replace("-", " ").replace("  ", " ")
        key = {"extra small": "extra small", "x small": "x-small", "xsmall": "xsmall", "extra large": "extra large",
               "x large": "x-large", "xx large": "xx-large"}.get(key, key)
        found.add(_SIZE_WORDS.get(key, _SIZE_WORDS.get(word.lower(), "")))
    found.discard("")
    return found


def preferred_size(user_id: int, recent: int = 50) -> str | None:
    with closing(connect()) as conn:
        rows = conn.execute(
            "SELECT content FROM chat_messages WHERE user_id = ? AND role = 'user' ORDER BY id DESC LIMIT ?",
            (user_id, recent),
        ).fetchall()
    counts: dict[str, int] = {}
    for row in rows:
        for size in sizes_mentioned(row["content"]):
            counts[size] = counts.get(size, 0) + 1
    if not counts:
        return None
    size, count = max(counts.items(), key=lambda kv: kv[1])
    return size if count >= PREFERRED_SIZE_MIN_MENTIONS else None
