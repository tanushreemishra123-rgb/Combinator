"""Logging setup driven by LOG_LEVEL."""

import logging

_FORMAT = "%(asctime)s %(levelname)-8s %(name)s: %(message)s"


def setup_logging(level: str) -> None:
    logging.basicConfig(
        level=logging.getLevelNamesMapping().get(level.upper(), logging.INFO),
        format=_FORMAT,
        force=True,
    )
