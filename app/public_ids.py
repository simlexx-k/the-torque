from __future__ import annotations

import re
import secrets

PUBLIC_LISTING_PREFIX = "lst_"
PUBLIC_LISTING_TOKEN_BYTES = 16
PUBLIC_LISTING_TOKEN_CHARS = 22
_PUBLIC_LISTING_RE = re.compile(rf"^{PUBLIC_LISTING_PREFIX}[A-Za-z0-9_-]{{{PUBLIC_LISTING_TOKEN_CHARS}}}$")
_LEGACY_NUMERIC_RE = re.compile(r"^[1-9][0-9]{0,17}$")


def generate_listing_public_id() -> str:
    """Return a non-sequential, URL-safe 128-bit public listing identifier."""
    token = secrets.token_urlsafe(PUBLIC_LISTING_TOKEN_BYTES)
    return f"{PUBLIC_LISTING_PREFIX}{token}"


def is_listing_public_id(value: str) -> bool:
    return bool(_PUBLIC_LISTING_RE.fullmatch(value.strip()))


def is_legacy_numeric_listing_ref(value: str) -> bool:
    """Accept old integer references without allowing unbounded numeric input."""
    return bool(_LEGACY_NUMERIC_RE.fullmatch(value.strip()))
