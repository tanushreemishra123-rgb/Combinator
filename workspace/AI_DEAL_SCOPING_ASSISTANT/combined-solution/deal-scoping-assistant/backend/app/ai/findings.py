"""Validator findings. Errors trigger a repair attempt; warnings travel back to the caller."""

from enum import StrEnum

from pydantic import Field

from app.domain.base import DomainModel


class FindingLevel(StrEnum):
    ERROR = "error"
    WARNING = "warning"


class Finding(DomainModel):
    level: FindingLevel = Field(description="error blocks the stage, warning is informational.")
    message: str = Field(description="What is wrong, in plain words.")
    ids: list[str] = Field(default_factory=list, description="Ids the finding is about.")


def error(message: str, ids: list[str] | None = None) -> Finding:
    return Finding(level=FindingLevel.ERROR, message=message, ids=ids or [])


def warning(message: str, ids: list[str] | None = None) -> Finding:
    return Finding(level=FindingLevel.WARNING, message=message, ids=ids or [])


def errors_only(findings: list[Finding]) -> list[Finding]:
    return [f for f in findings if f.level is FindingLevel.ERROR]


def warnings_only(findings: list[Finding]) -> list[Finding]:
    return [f for f in findings if f.level is FindingLevel.WARNING]
