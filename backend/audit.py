"""Append-only audit trail of agent-loop activity: output/audit_trail.json.

Every chat turn gets a run_id. For each run the trail records:

    run_start   when the turn begins: tier, channel, who (user id or guest), page, message length
    tool_call   each tool the model calls: tool name and short arguments
    tool_result each tool's answer: a short summary, how long it took, and whether it failed
    run_end     how the turn stopped: stop_reason, model, request/tool counts, tokens, duration

The file is a JSON array that only ever grows. New entries are written by seeking to the
closing bracket and appending, so earlier entries are never rewritten, and the file is never
wiped between runs or server restarts. Shopper messages and Dan's replies are not copied in
(only their lengths), so the trail holds no personal details; tool arguments are product
searches, ids, and sizes.
"""

import fcntl
import json
import logging
import os
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from pydantic import BaseModel

log = logging.getLogger(__name__)

AUDIT_PATH = Path(
    os.getenv("AUDIT_TRAIL_PATH", Path(__file__).resolve().parent.parent / "output" / "audit_trail.json")
)
SHORT = 160  # max characters for an argument or result summary

_lock = threading.Lock()


def new_run_id() -> str:
    return uuid.uuid4().hex[:12]


def short(value: Any, limit: int = SHORT) -> str:
    """A one-line, length-capped rendering of tool arguments or results."""
    if isinstance(value, BaseModel):
        value = value.model_dump(exclude_none=True)
    text = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, default=str)
    text = " ".join(text.split())
    return text if len(text) <= limit else text[: limit - 1] + "…"


def summarize_result(tool: str, content: Any) -> str:
    """What a tool returned, in a few words an auditor can scan."""
    try:
        if tool == "search_products":
            ids = [p.product_id for p in content.products]
            return short(f"{content.total_matches} matches; top: {', '.join(ids[:5]) or 'none'}")
        if tool == "get_price":
            return f"{content.product_id}: {content.price_text}"
        if tool == "get_stock":
            sizes = ", ".join(f"{s.size}={s.quantity}" for s in content.sizes)
            return short(f"{content.product_id}: {sizes} (total {content.total_in_stock})")
        if tool == "get_product_description":
            return short(f"{content.product_id}: {content.name}")
    except AttributeError:
        pass
    return short(content)


def record(event: str, run_id: str, **fields: Any) -> None:
    """Append one entry. Never raises: auditing must not break a chat."""
    entry = {"time": datetime.now(timezone.utc).isoformat(timespec="milliseconds"), "event": event, "run_id": run_id}
    entry.update({k: v for k, v in fields.items() if v is not None})
    line = json.dumps(entry, ensure_ascii=False, default=str)
    try:
        with _lock:
            AUDIT_PATH.parent.mkdir(parents=True, exist_ok=True)
            with open(AUDIT_PATH, "a+b") as f:
                fcntl.flock(f, fcntl.LOCK_EX)  # also guards against a second server process
                try:
                    _append(f, line.encode("utf-8"))
                finally:
                    fcntl.flock(f, fcntl.LOCK_UN)
    except OSError:
        log.exception("Could not write the audit trail")


def _append(f, line: bytes) -> None:
    """Insert `line` as the last element of the JSON array in `f`, rewriting only its tail."""
    f.seek(0, os.SEEK_END)
    size = f.tell()
    if size == 0:
        f.write(b"[\n" + line + b"\n]\n")
        return
    f.seek(max(0, size - 4096))
    tail = f.read()
    body = tail.rstrip()
    if not body.endswith(b"]"):
        raise OSError(f"{AUDIT_PATH} is not a JSON array; refusing to modify it")
    before = body[:-1].rstrip()  # everything up to the last element (or the opening "[")
    keep = size - len(tail) + len(before)
    f.truncate(keep)  # drops only the closing bracket and whitespace after the last element
    f.write((b"\n" if before.endswith(b"[") else b",\n") + line + b"\n]\n")
