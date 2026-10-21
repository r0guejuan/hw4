"""Pydantic models shared by the API and the agent."""

import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MIN_PASSWORD_LENGTH = 10
MAX_PASSWORD_LENGTH = 128
MAX_CHAT_MESSAGE_LENGTH = 2000
MAX_CHAT_HISTORY = 20
MAX_PRODUCT_CARDS = 6
MAX_PAGE_RESULTS = 48
MAX_SAVED_HISTORY = 50  # messages reloaded into the chat window


class SizeStock(BaseModel):
    size: str
    quantity: int


class Product(BaseModel):
    product_id: str
    name: str
    garment_type: str
    category: str
    description: str
    colors: list[str]
    search_tags: list[str]
    image_url: str
    price: float
    color_family: str = Field(description='Garment color grouped for filtering, e.g. "Navy", "Gray".')
    sizes_in_stock: list[str] = Field(default_factory=list)


class ProductDetail(Product):
    sizes: list[SizeStock]
    in_stock: bool


# --- Agent tool results -----------------------------------------------------------
# Each lookup tool returns a small, purpose-built shape. Every field is read from
# campus_customs.db at call time; nothing is computed by the model.

SizeName = Literal["XS", "S", "M", "L", "XL", "XXL"]


class ProductMatch(BaseModel):
    """One search result: enough to choose and compare products. No stock counts."""

    product_id: str
    name: str
    category: str
    colors: list[str]
    price: float
    sizes_in_stock: list[str]


class ProductSearchResult(BaseModel):
    total_matches: int
    products: list[ProductMatch]
    note: str | None = None


class ProductDescription(BaseModel):
    """get_product_description: what the product is and looks like."""

    product_id: str
    name: str
    category: str
    garment_type: str
    description: str
    colors: list[str]


class ProductPrice(BaseModel):
    """get_price: the exact price to quote."""

    product_id: str
    name: str
    price: float
    price_text: str = Field(description='The price formatted for quoting, e.g. "$68.00".')
    currency: Literal["USD"] = "USD"


class SizeStockLevel(BaseModel):
    size: SizeName
    quantity: int
    in_stock: bool


class StockReport(BaseModel):
    """get_stock: units on hand, per size."""

    product_id: str
    name: str
    requested_size: SizeName | None = Field(description="The size asked about, or null for all sizes.")
    sizes: list[SizeStockLevel] = Field(description="The requested size only, or every size if none was requested.")
    available_sizes: list[SizeName] = Field(description="All sizes with at least one unit, for suggesting alternatives.")
    sold_out_sizes: list[SizeName]
    total_in_stock: int


# --- Chat --------------------------------------------------------------------------


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=MAX_CHAT_MESSAGE_LENGTH)


PageType = Literal["home", "products", "product", "about", "login", "create_account", "other"]


class PageContext(BaseModel):
    """Where the shopper is on the site when they send a message (sent by the browser).

    Only ids and labels; the server looks the product up itself and never trusts a name
    from the browser.
    """

    page_type: PageType = "other"
    path: str = Field(default="/", max_length=200)
    product_id: str | None = Field(default=None, max_length=100, description="Set on a product detail page.")
    category: str | None = Field(default=None, max_length=40, description="Category filter on the Products page.")
    results_title: str | None = Field(default=None, max_length=60, description="Title of chat results shown on the page.")


class ChatRequest(BaseModel):
    """The shopper's new message (last item), plus earlier turns and the page they're on.

    Logged-in shoppers' earlier turns are loaded from the database instead of trusted from
    the browser; guests' come from `messages`.
    """

    messages: list[ChatTurn] = Field(min_length=1, max_length=MAX_CHAT_HISTORY)
    page: PageContext | None = None

    @model_validator(mode="after")
    def last_is_user(self) -> "ChatRequest":
        if self.messages[-1].role != "user":
            raise ValueError("The last message must be from the shopper.")
        return self


SafetyCategory = Literal["violence_weapons", "hacking_fraud", "self_harm", "drugs_crime", "harassment"]


class PageSearch(BaseModel):
    """Which products to show on the website's Products page, decided by the agent.

    Either give search filters (the same ones used with search_products) to show every match,
    or give product_ids for a hand-picked set. The server runs the search or looks up the ids
    in the database; the model never supplies product details itself.
    """

    title: str = Field(max_length=60, description='Short heading for the page, e.g. "Hoodies" or "Navy crewnecks in M".')
    query: str = ""
    category: str | None = None
    color: str | None = None
    size: str | None = None
    max_price: float | None = None
    min_price: float | None = None
    in_stock_only: bool = False
    product_ids: list[str] = Field(
        default_factory=list,
        description="For a hand-picked set (e.g. gift ideas), the product_ids to show instead of running the filters.",
    )


class AgentReply(BaseModel):
    """What the agent must return: its message, the products to show, and a safety verdict."""

    message: str = Field(description="The reply to the shopper, in Handsome Dan's voice.")
    product_ids: list[str] = Field(
        default_factory=list,
        description="product_id values from tool results for the products being recommended, most relevant first.",
    )
    end_conversation: bool = Field(
        default=False,
        description="True only when the shopper asked for help with a dangerous request (see the safety table).",
    )
    safety_category: SafetyCategory | None = Field(
        default=None,
        description="Which dangerous category triggered end_conversation; null otherwise.",
    )
    page_search: PageSearch | None = Field(
        default=None,
        description="Set when the shopper is browsing or searching, so the matches appear on the website.",
    )


class ProductCard(BaseModel):
    """A product card (in the chat or on the page). Built from the database, not the model."""

    product_id: str
    name: str
    category: str
    price: float
    image_url: str
    short_description: str
    colors: list[str]
    color_family: str
    sizes_in_stock: list[str]


class PageResults(BaseModel):
    """Products the website should show because of the chat (rendered on the Products page)."""

    title: str
    total_matches: int
    products: list[ProductCard] = Field(max_length=MAX_PAGE_RESULTS)


class ChatHistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    products: list[ProductCard] = Field(default_factory=list)
    created_at: str


class ChatHistory(BaseModel):
    """A logged-in shopper's saved conversation, oldest first."""

    messages: list[ChatHistoryMessage]


class ChatReply(BaseModel):
    reply: str
    products: list[ProductCard] = Field(default_factory=list, max_length=MAX_PRODUCT_CARDS)
    page: PageResults | None = Field(default=None, description="When set, the site shows these products on the page.")
    preferred_size: str | None = Field(default=None, description="The logged-in shopper's usual size, after this message.")
    ended: bool = Field(default=False, description="True when Dan ended the chat for safety; the widget locks.")


def _normalize_email(value: str) -> str:
    value = value.strip().lower()
    if len(value) > 254 or not EMAIL_PATTERN.match(value):
        raise ValueError("Enter a valid email address.")
    return value


class SignupRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=50)
    last_name: str = Field(min_length=1, max_length=50)
    email: str
    password: str = Field(max_length=MAX_PASSWORD_LENGTH)
    confirm_password: str = Field(max_length=MAX_PASSWORD_LENGTH)

    @field_validator("first_name", "last_name", mode="before")
    @classmethod
    def strip_names(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value

    @field_validator("email")
    @classmethod
    def check_email(cls, value: str) -> str:
        return _normalize_email(value)

    @field_validator("password")
    @classmethod
    def check_password(cls, value: str) -> str:
        if len(value) < MIN_PASSWORD_LENGTH:
            raise ValueError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters.")
        if value.strip() != value or not value.strip():
            raise ValueError("Password can't start or end with spaces.")
        return value

    @model_validator(mode="after")
    def passwords_match(self) -> "SignupRequest":
        if self.password != self.confirm_password:
            raise ValueError("Passwords don't match.")
        if self.password.lower() == self.email:
            raise ValueError("Password can't be the same as your email.")
        return self


class LoginRequest(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=MAX_PASSWORD_LENGTH)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class UserPublic(BaseModel):
    """What the API may show about a user. Never includes the password hash."""

    id: int
    first_name: str
    last_name: str
    email: str
    preferred_size: str | None = Field(default=None, description="Their usual size, learned from their chats.")


# --- Cart and checkout ---------------------------------------------------------------

MAX_CART_QUANTITY = 10  # per product and size
MAX_CART_LINES = 30

US_STATE_CODES = frozenset(
    "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ "
    "NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split()
)
POSTAL_CODE = re.compile(r"^\d{5}(-\d{4})?$")


class CartItem(BaseModel):
    """What the browser sends: which product, size, and how many. Never a price."""

    product_id: str = Field(min_length=1, max_length=120)
    size: SizeName
    quantity: int = Field(ge=1, le=MAX_CART_QUANTITY)


class CartQuoteRequest(BaseModel):
    items: list[CartItem] = Field(max_length=MAX_CART_LINES)
    state: str | None = Field(default=None, description="Delivery state, for the tax estimate.")

    @field_validator("state")
    @classmethod
    def check_state(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        value = value.strip().upper()
        if value not in US_STATE_CODES:
            raise ValueError("Choose a U.S. state for the tax estimate.")
        return value


class CartLine(BaseModel):
    product_id: str
    name: str
    image_url: str
    size: SizeName
    quantity: int
    unit_price: float
    line_total: float
    available: int = Field(description="Units in stock for this size right now.")
    problem: str | None = Field(default=None, description='e.g. "Only 2 left in this size"')


class CartQuote(BaseModel):
    """A cart priced from the catalogue. Tax is an estimate from the state's base rate."""

    lines: list[CartLine]
    item_count: int
    subtotal: float
    tax_state: str | None
    tax_rate: float | None
    tax: float
    total: float


class Address(BaseModel):
    full_name: str = Field(min_length=1, max_length=100)
    line1: str = Field(min_length=1, max_length=120)
    line2: str | None = Field(default=None, max_length=120)
    city: str = Field(min_length=1, max_length=80)
    state: str
    postal_code: str

    @field_validator("full_name", "line1", "line2", "city", mode="before")
    @classmethod
    def strip_text(cls, value: str | None) -> str | None:
        return value.strip() if isinstance(value, str) else value

    @field_validator("state")
    @classmethod
    def check_state(cls, value: str) -> str:
        value = value.strip().upper()
        if value not in US_STATE_CODES:
            raise ValueError("We ship to U.S. addresses only. Choose a state.")
        return value

    @field_validator("postal_code")
    @classmethod
    def check_postal_code(cls, value: str) -> str:
        value = value.strip()
        if not POSTAL_CODE.match(value):
            raise ValueError("Enter a 5-digit ZIP code.")
        return value


class CardInput(BaseModel):
    """Payment details as typed. Validated, then the number is encrypted and the CVC dropped."""

    cardholder_name: str = Field(min_length=1, max_length=100)
    number: str
    exp_month: int = Field(ge=1, le=12)
    exp_year: int
    cvc: str

    @field_validator("cardholder_name", mode="before")
    @classmethod
    def strip_name(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value

    @field_validator("number", mode="before")
    @classmethod
    def clean_number(cls, value: str) -> str:
        digits = re.sub(r"[\s-]", "", value) if isinstance(value, str) else ""
        if not digits.isdigit() or not 13 <= len(digits) <= 19:
            raise ValueError("Enter the card number using digits only.")
        return digits

    @field_validator("exp_year")
    @classmethod
    def full_year(cls, value: int) -> int:
        value = value + 2000 if value < 100 else value
        if not 2000 <= value <= 2100:
            raise ValueError("Enter a valid expiration year.")
        return value

    @field_validator("cvc")
    @classmethod
    def check_cvc(cls, value: str) -> str:
        value = value.strip()
        if not value.isdigit() or not 3 <= len(value) <= 4:
            raise ValueError("Enter the 3- or 4-digit security code.")
        return value


class CheckoutRequest(BaseModel):
    items: list[CartItem] = Field(min_length=1, max_length=MAX_CART_LINES)
    address: Address
    card: CardInput


class OrderConfirmation(BaseModel):
    order_id: int
    lines: list[CartLine]
    subtotal: float
    tax_state: str | None
    tax_rate: float | None
    tax: float
    total: float
    card_brand: str
    card_last4: str
    ship_to: str
