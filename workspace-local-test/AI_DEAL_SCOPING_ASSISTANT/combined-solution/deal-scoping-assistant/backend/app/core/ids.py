"""Stable per-session identifiers such as FR_01, CAP_07, ARC_12."""

import re
from collections.abc import Iterable

_PAD = 2


def _suffix(prefix: str, value: str) -> int | None:
    match = re.fullmatch(rf"{re.escape(prefix)}_(\d+)", value)
    return int(match.group(1)) if match else None


def next_id(prefix: str, existing_ids: Iterable[str]) -> str:
    """Next free id for `prefix`; zero-padded to two digits and growing past 99."""
    numbers = [n for n in (_suffix(prefix, value) for value in existing_ids) if n is not None]
    return f"{prefix}_{max(numbers, default=0) + 1:0{_PAD}d}"
