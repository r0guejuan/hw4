"""Accounts, password hashing, and login sessions.

Stored password format (matches the seed database):

    pbkdf2_sha256$<salt>$<hex digest>

The digest is PBKDF2-HMAC-SHA256(password, salt, HASH_ITERATIONS). Signup and login
share hash_password(), so they always use the same function, salt handling, and
iteration count. Login never "un-hashes" anything: it reads the salt out of the stored
string, re-hashes what the user typed with that salt, and compares in constant time.
"""

import base64
import hashlib
import hmac
import logging
import os
import secrets
import sqlite3
import time
from collections import defaultdict
from contextlib import closing

import tools
from models import UserPublic

log = logging.getLogger(__name__)

HASH_ALGORITHM = "pbkdf2_sha256"
# Must match the iteration count the seed users were hashed with, or their logins fail.
HASH_ITERATIONS = 120_000
SALT_BYTES = 16  # new users get a random 128-bit salt (32 hex characters)

SESSION_COOKIE = "cc_session"
SESSION_TTL_SECONDS = 7 * 24 * 3600

# Login throttling: after this many failures for one email from one address,
# refuse further attempts until the window passes.
MAX_FAILED_LOGINS = 5
FAILED_LOGIN_WINDOW_SECONDS = 15 * 60


class EmailTakenError(Exception):
    pass


class TooManyAttemptsError(Exception):
    pass


# --- Password hashing -------------------------------------------------------------


def hash_password(password: str, salt: str | None = None) -> str:
    """Hash a password. Pass the stored salt when verifying; omit it at signup."""
    if salt is None:
        salt = secrets.token_hex(SALT_BYTES)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), HASH_ITERATIONS)
    return f"{HASH_ALGORITHM}${salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, salt, expected = stored.split("$")
    except ValueError:
        return False
    if algorithm != HASH_ALGORITHM:
        return False
    candidate = hash_password(password, salt).rsplit("$", 1)[1]
    return hmac.compare_digest(candidate, expected)


# Verified against when an email doesn't exist, so a wrong email takes as long as a
# wrong password and response times don't reveal which accounts exist.
_DUMMY_HASH = hash_password(secrets.token_hex(16))


# --- Users ----------------------------------------------------------------------


def _to_public(row: sqlite3.Row) -> UserPublic:
    first, last = row["first_name"], row["last_name"]
    if not first:  # older rows may only have the combined name
        first, _, last = row["name"].partition(" ")
    return UserPublic(
        id=row["id"],
        first_name=first,
        last_name=last or "",
        email=row["email"],
        preferred_size=tools.preferred_size(row["id"]),
    )


def create_user(first_name: str, last_name: str, email: str, password: str) -> UserPublic:
    password_hash = hash_password(password)
    with closing(tools.connect_rw()) as conn:
        try:
            with conn:
                cur = conn.execute(
                    "INSERT INTO users (name, first_name, last_name, email, password_hash) VALUES (?, ?, ?, ?, ?)",
                    (f"{first_name} {last_name}", first_name, last_name, email, password_hash),
                )
        except sqlite3.IntegrityError as exc:
            raise EmailTakenError(email) from exc
        row = conn.execute("SELECT * FROM users WHERE id = ?", (cur.lastrowid,)).fetchone()
    return _to_public(row)


def get_user(user_id: int) -> UserPublic | None:
    with closing(tools.connect()) as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return _to_public(row) if row else None


_failed_logins: dict[tuple[str, str], list[float]] = defaultdict(list)


def authenticate(email: str, password: str, client: str) -> UserPublic | None:
    key = (client, email)
    now = time.monotonic()
    recent = [t for t in _failed_logins[key] if now - t < FAILED_LOGIN_WINDOW_SECONDS]
    _failed_logins[key] = recent
    if len(recent) >= MAX_FAILED_LOGINS:
        raise TooManyAttemptsError(email)

    with closing(tools.connect()) as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()

    if row is None:
        verify_password(password, _DUMMY_HASH)
        ok = False
    else:
        ok = verify_password(password, row["password_hash"])

    if not ok:
        recent.append(now)
        return None
    _failed_logins.pop(key, None)
    return _to_public(row)


# --- Sessions -------------------------------------------------------------------
# A session is a signed cookie "<user_id>.<expires>.<signature>". The signature is an
# HMAC of the first two parts with SESSION_SECRET, so it can't be forged or edited.

_secret = os.getenv("SESSION_SECRET")
if not _secret:
    log.warning("SESSION_SECRET is not set; using a temporary key, so logins reset on restart.")
    _secret = secrets.token_urlsafe(32)
_SESSION_KEY = _secret.encode("utf-8")

COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"


def _sign(payload: str) -> str:
    mac = hmac.new(_SESSION_KEY, payload.encode("utf-8"), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(mac).decode("ascii").rstrip("=")


def make_session_token(user_id: int) -> str:
    payload = f"{user_id}.{int(time.time()) + SESSION_TTL_SECONDS}"
    return f"{payload}.{_sign(payload)}"


def read_session_token(token: str | None) -> int | None:
    if not token:
        return None
    try:
        user_id, expires, signature = token.split(".")
        if not hmac.compare_digest(signature, _sign(f"{user_id}.{expires}")):
            return None
        if int(expires) < time.time():
            return None
        return int(user_id)
    except ValueError:
        return None
