"""Reading a provider's error answers without depending on its SDK types."""

import re
from typing import Any

RETRY_AFTER_CAP_SECONDS = 90.0
MAX_WAITS = 3
DEFAULT_WAIT_SECONDS = 20.0

BUDGET_TOO_SMALL_MESSAGE = (
    "The configured AI provider's token limit is too small for this request. "
    "Use the Google Gemini free tier or a key with a higher limit, or run in mock mode."
)

# Providers word the same conditions differently, and some SDKs only put the status in
# the message, so the text is checked as well as the response.
_BUSY_MARKERS = (
    "overloaded",
    "high demand",
    "unavailable",
    "try again later",
    "resource_exhausted",
    "quota exceeded",
    "rate limit",
    "too many requests",
)
_TOKEN_LIMIT_MARKERS = (
    "request too large",
    "request_too_large",
    "context_length_exceeded",
    "tokens per request",
    "token limit",
)
# Groq answers a schema it could not fill inside the budget with an empty generation.
_EMPTY_GENERATION = re.compile(r"'failed_generation':\s*''")
_LIMIT_AND_REQUESTED = re.compile(r"Limit (\d+),\s*Requested (\d+)", re.IGNORECASE)
_WAIT_IN_MESSAGE = re.compile(
    r"(?:try again|retry)(?: again)? in ([0-9.]+)\s*(ms|s)", re.IGNORECASE
)
_RETRY_DELAY = re.compile(r"'retryDelay':\s*'([0-9.]+)s'", re.IGNORECASE)
_STATUS_IN_MESSAGE = re.compile(r"\b(4\d\d|5\d\d)\b")
_DURATION = re.compile(r"^([0-9.]+)\s*(ms|s|m)?$", re.IGNORECASE)


def _status_code(exc: BaseException) -> int | None:
    for candidate in (getattr(exc, "status_code", None), getattr(exc, "code", None)):
        if isinstance(candidate, int):
            return candidate
    response = getattr(exc, "response", None)
    code = getattr(response, "status_code", None)
    if isinstance(code, int):
        return code
    # Some SDKs only carry the status in the message, for example "429 RESOURCE_EXHAUSTED".
    match = _STATUS_IN_MESSAGE.search(str(exc))
    return int(match.group(1)) if match else None


def _headers(exc: BaseException) -> dict[str, Any]:
    response = getattr(exc, "response", None)
    headers = getattr(response, "headers", None)
    return dict(headers) if headers else {}


def _seconds(value: str) -> float | None:
    match = _DURATION.match(value.strip())
    if not match:
        return None
    amount = float(match.group(1))
    unit = (match.group(2) or "s").lower()
    return amount / 1000 if unit == "ms" else amount * 60 if unit == "m" else amount


def is_token_limit(exc: BaseException) -> bool:
    """The provider cannot fit this stage; waiting or repairing would not help."""
    message = str(exc)
    lowered = message.lower()
    numbers = _LIMIT_AND_REQUESTED.search(message)
    if numbers and int(numbers.group(2)) > int(numbers.group(1)):
        return True
    if "json_validate_failed" in lowered and _EMPTY_GENERATION.search(message):
        return True
    if any(marker in lowered for marker in _TOKEN_LIMIT_MARKERS):
        return True
    return _status_code(exc) == 413


def is_retryable(exc: BaseException) -> bool:
    """Rate limited (429) or the model is busy (503): the same request can succeed later."""
    if is_token_limit(exc):
        return False
    if _status_code(exc) in (429, 503):
        return True
    return any(marker in str(exc).lower() for marker in _BUSY_MARKERS)


def wait_seconds(exc: BaseException) -> float:
    """How long the provider asks us to wait, capped so a stage cannot hang."""
    headers = _headers(exc)
    for name in ("retry-after", "x-ratelimit-reset-tokens", "x-ratelimit-reset-requests"):
        raw = headers.get(name) or headers.get(name.title())
        if isinstance(raw, str) and (found := _seconds(raw)) is not None:
            return min(max(found, 1.0), RETRY_AFTER_CAP_SECONDS)
    message = str(exc)
    match = _WAIT_IN_MESSAGE.search(message)
    if match:
        found = float(match.group(1)) / (1000 if match.group(2).lower() == "ms" else 1)
        return min(max(found, 1.0), RETRY_AFTER_CAP_SECONDS)
    delay = _RETRY_DELAY.search(message)
    if delay:
        return min(max(float(delay.group(1)), 1.0), RETRY_AFTER_CAP_SECONDS)
    return DEFAULT_WAIT_SECONDS


_NOT_FOUND_MARKERS = (
    "not_found",
    "not found",
    "no longer available",
    "does not exist",
    "unknown model",
)


def is_model_not_found(exc: BaseException) -> bool:
    """The configured model id is wrong for this key: repairing or waiting cannot help."""
    lowered = str(exc).lower()
    return _status_code(exc) == 404 or any(marker in lowered for marker in _NOT_FOUND_MARKERS)
