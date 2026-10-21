"""Cart pricing, sales-tax estimates, and checkout with mock payment cards.

Security rules (see output/harness.md, section 9):

- Prices, names, and stock always come from the catalogue, never from the browser.
- Only published test card numbers are accepted, so a real card can't be stored by mistake.
- The full card number is encrypted (Fernet: AES-128-CBC + HMAC-SHA256) with CARD_ENCRYPTION_KEY
  before it reaches the database. Only the brand, last four digits, and expiry are kept in
  the clear, for receipts. The security code (CVC) is checked for shape and then discarded:
  it is never stored or logged.
- An order, its items, the address, the card, and the stock decrement are written in one
  transaction, so a failure leaves nothing half-saved.
"""

import hashlib
import hmac
import logging
import os
from contextlib import closing
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from cryptography.fernet import Fernet, InvalidToken

import tools
from models import (
    MAX_CART_QUANTITY,
    Address,
    CardInput,
    CartItem,
    CartLine,
    CartQuote,
    OrderConfirmation,
)

log = logging.getLogger(__name__)

# --- Sales tax ------------------------------------------------------------------
# Statewide base sales tax rates (percent). Local add-ons and clothing exemptions vary by
# city and season, so the result is labeled an estimate everywhere it is shown.
STATE_TAX_RATES: dict[str, str] = {
    "AL": "4", "AK": "0", "AZ": "5.6", "AR": "6.5", "CA": "7.25", "CO": "2.9", "CT": "6.35",
    "DE": "0", "DC": "6", "FL": "6", "GA": "4", "HI": "4", "ID": "6", "IL": "6.25", "IN": "7",
    "IA": "6", "KS": "6.5", "KY": "6", "LA": "5", "ME": "5.5", "MD": "6", "MA": "6.25",
    "MI": "6", "MN": "6.875", "MS": "7", "MO": "4.225", "MT": "0", "NE": "5.5", "NV": "6.85",
    "NH": "0", "NJ": "6.625", "NM": "4.875", "NY": "4", "NC": "4.75", "ND": "5", "OH": "5.75",
    "OK": "4.5", "OR": "0", "PA": "6", "RI": "7", "SC": "6", "SD": "4.2", "TN": "7",
    "TX": "6.25", "UT": "6.1", "VT": "6", "VA": "5.3", "WA": "6.5", "WV": "6", "WI": "5",
    "WY": "4",
}  # fmt: skip


def tax_rate(state: str | None) -> Decimal | None:
    """The state's rate as a fraction (0.0635 for CT), or None if no state is known yet."""
    if not state:
        return None
    pct = STATE_TAX_RATES.get(state.upper())
    return None if pct is None else Decimal(pct) / 100


def to_cents(dollars: float | Decimal) -> int:
    return int((Decimal(str(dollars)) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


# --- Cart -----------------------------------------------------------------------


class CartError(Exception):
    """A problem the shopper can fix (sold out, unknown product, bad card)."""


def merge_items(items: list[CartItem]) -> list[CartItem]:
    """Combine duplicate product/size lines, keeping first-seen order."""
    merged: dict[tuple[str, str], int] = {}
    for item in items:
        key = (item.product_id, item.size)
        merged[key] = merged.get(key, 0) + item.quantity
    return [CartItem(product_id=p, size=s, quantity=min(q, MAX_CART_QUANTITY)) for (p, s), q in merged.items()]


def quote(items: list[CartItem], state: str | None = None) -> CartQuote:
    """Price a cart from the catalogue: lines, subtotal, estimated tax, and total."""
    cat = tools.catalogue()
    lines: list[CartLine] = []
    subtotal = 0
    for item in merge_items(items):
        product = cat.products.get(item.product_id)
        if product is None:
            continue  # removed from the catalogue: drop it silently
        available = next((s.quantity for s in cat.stock[item.product_id] if s.size == item.size), 0)
        unit = to_cents(product.price)
        line_total = unit * item.quantity
        subtotal += line_total
        lines.append(
            CartLine(
                product_id=product.product_id,
                name=product.name,
                image_url=product.image_url,
                size=item.size,
                quantity=item.quantity,
                unit_price=unit / 100,
                line_total=line_total / 100,
                available=available,
                problem=None
                if item.quantity <= available
                else ("Sold out in this size" if available == 0 else f"Only {available} left in this size"),
            )
        )
    rate = tax_rate(state)
    tax = int((Decimal(subtotal) * rate).quantize(Decimal("1"), rounding=ROUND_HALF_UP)) if rate is not None else 0
    return CartQuote(
        lines=lines,
        item_count=sum(line.quantity for line in lines),
        subtotal=subtotal / 100,
        tax_state=state.upper() if rate is not None and state else None,
        tax_rate=float(rate) if rate is not None else None,
        tax=tax / 100,
        total=(subtotal + tax) / 100,
    )


# --- Mock payment cards ---------------------------------------------------------
# Published test numbers from the major payment processors. They pass the Luhn check but can
# never be charged. Anything else is refused, which keeps real card data out of this demo.
TEST_CARDS: dict[str, str] = {
    "4242424242424242": "Visa",
    "4000056655665556": "Visa",
    "5555555555554444": "Mastercard",
    "2223003122003222": "Mastercard",
    "378282246310005": "American Express",
    "6011111111111117": "Discover",
}


def luhn_ok(number: str) -> bool:
    total = 0
    for i, ch in enumerate(reversed(number)):
        d = int(ch)
        if i % 2:
            d = d * 2 - 9 if d > 4 else d * 2
        total += d
    return total % 10 == 0


def check_card(card: CardInput) -> str:
    """Validate a mock card and return its brand. Raises CartError with a fixable message."""
    number = card.number
    if not luhn_ok(number):
        raise CartError("That card number isn't valid. Check the digits and try again.")
    brand = TEST_CARDS.get(number)
    if brand is None:
        raise CartError("This demo store only accepts test cards, such as 4242 4242 4242 4242. Real cards are refused.")
    today = date.today()
    if (card.exp_year, card.exp_month) < (today.year, today.month):
        raise CartError("That card has expired. Check the expiration date.")
    expected_cvc = 4 if brand == "American Express" else 3
    if len(card.cvc) != expected_cvc:
        raise CartError(f"The security code for {brand} cards is {expected_cvc} digits.")
    return brand


def _fernet() -> Fernet:
    key = os.getenv("CARD_ENCRYPTION_KEY")
    if not key:
        raise RuntimeError("CARD_ENCRYPTION_KEY is not set")
    return Fernet(key.encode())


def encrypt_card_number(number: str) -> str:
    return _fernet().encrypt(number.encode()).decode()


def decrypt_card_number(token: str) -> str:
    """For an authorized back-office process only; the API never returns card numbers."""
    try:
        return _fernet().decrypt(token.encode()).decode()
    except InvalidToken as exc:
        raise RuntimeError("Card data could not be decrypted with the current key") from exc


def card_fingerprint(number: str) -> str:
    """Keyed hash of the number, so a repeat card can be recognized without decrypting it."""
    # derive a separate key from the encryption key, so one secret isn't used for two jobs
    key = hashlib.sha256(b"card-fingerprint:" + os.getenv("CARD_ENCRYPTION_KEY", "").encode()).digest()
    return hmac.new(key, number.encode(), hashlib.sha256).hexdigest()


def checkout_ready() -> bool:
    try:
        _fernet()
        return True
    except (RuntimeError, ValueError):
        return False


# --- Database -------------------------------------------------------------------

SCHEMA = """
CREATE TABLE IF NOT EXISTS addresses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    full_name TEXT NOT NULL,
    line1 TEXT NOT NULL,
    line2 TEXT,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    postal_code TEXT NOT NULL,
    country TEXT NOT NULL DEFAULT 'US',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS payment_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    cardholder_name TEXT NOT NULL,
    brand TEXT NOT NULL,
    last4 TEXT NOT NULL,
    exp_month INTEGER NOT NULL,
    exp_year INTEGER NOT NULL,
    number_encrypted TEXT NOT NULL,   -- Fernet token; the CVC is never stored
    fingerprint TEXT NOT NULL,        -- HMAC-SHA256 of the number, for spotting repeats
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_id, fingerprint, exp_month, exp_year)
);
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    address_id INTEGER NOT NULL REFERENCES addresses(id),
    card_id INTEGER NOT NULL REFERENCES payment_cards(id),
    subtotal_cents INTEGER NOT NULL,
    tax_rate TEXT NOT NULL,
    tax_cents INTEGER NOT NULL,
    total_cents INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'paid (test)',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    product_id TEXT NOT NULL REFERENCES catalogue(product_id),
    name TEXT NOT NULL,
    size TEXT NOT NULL,
    unit_price_cents INTEGER NOT NULL,
    quantity INTEGER NOT NULL
);
"""


def ensure_schema() -> None:
    """Create the checkout tables if they don't exist yet (safe to run on every start)."""
    with closing(tools.connect_rw()) as conn:
        conn.executescript(SCHEMA)


def place_order(user_id: int, items: list[CartItem], address: Address, card: CardInput) -> OrderConfirmation:
    """Check the cart and card, then save the order and take the stock, all or nothing."""
    if not items:
        raise CartError("Your cart is empty.")
    brand = check_card(card)
    priced = quote(items, address.state)
    if not priced.lines:
        raise CartError("None of the items in your cart are available any more.")
    problems = [f"{line.name} ({line.size}): {line.problem}" for line in priced.lines if line.problem]
    if problems:
        raise CartError("Some items changed: " + "; ".join(problems) + ". Update your cart and try again.")

    rate = tax_rate(address.state)
    assert rate is not None  # Address.state is validated against STATE_TAX_RATES
    number_encrypted = encrypt_card_number(card.number)
    fingerprint = card_fingerprint(card.number)

    with closing(tools.connect_rw()) as conn:
        with conn:  # one transaction: commits on success, rolls back on any error
            for line in priced.lines:
                cur = conn.execute(
                    "UPDATE inventory SET quantity = quantity - ? WHERE product_id = ? AND size = ? AND quantity >= ?",
                    (line.quantity, line.product_id, line.size, line.quantity),
                )
                if cur.rowcount != 1:
                    raise CartError(f"{line.name} ({line.size}) just sold out. Update your cart and try again.")
            address_id = conn.execute(
                "INSERT INTO addresses (user_id, full_name, line1, line2, city, state, postal_code) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (user_id, address.full_name, address.line1, address.line2 or None, address.city, address.state, address.postal_code),
            ).lastrowid
            conn.execute(
                """INSERT INTO payment_cards
                       (user_id, cardholder_name, brand, last4, exp_month, exp_year, number_encrypted, fingerprint)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT (user_id, fingerprint, exp_month, exp_year)
                   DO UPDATE SET cardholder_name = excluded.cardholder_name""",
                (user_id, card.cardholder_name, brand, card.number[-4:], card.exp_month, card.exp_year, number_encrypted, fingerprint),
            )
            card_id = conn.execute(
                "SELECT id FROM payment_cards WHERE user_id = ? AND fingerprint = ? AND exp_month = ? AND exp_year = ?",
                (user_id, fingerprint, card.exp_month, card.exp_year),
            ).fetchone()["id"]
            order_id = conn.execute(
                """INSERT INTO orders (user_id, address_id, card_id, subtotal_cents, tax_rate, tax_cents, total_cents)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (user_id, address_id, card_id, to_cents(priced.subtotal), str(rate), to_cents(priced.tax), to_cents(priced.total)),
            ).lastrowid
            conn.executemany(
                "INSERT INTO order_items (order_id, product_id, name, size, unit_price_cents, quantity) VALUES (?, ?, ?, ?, ?, ?)",
                [(order_id, l.product_id, l.name, l.size, to_cents(l.unit_price), l.quantity) for l in priced.lines],
            )

    tools.reload_catalogue()  # stock changed: refresh what the site and Dan see
    log.info("Order %s placed by user %s (%s items, test card)", order_id, user_id, priced.item_count)
    return OrderConfirmation(
        order_id=order_id,
        lines=priced.lines,
        subtotal=priced.subtotal,
        tax_state=priced.tax_state,
        tax_rate=priced.tax_rate,
        tax=priced.tax,
        total=priced.total,
        card_brand=brand,
        card_last4=card.number[-4:],
        ship_to=f"{address.full_name}, {address.city}, {address.state} {address.postal_code}",
    )
