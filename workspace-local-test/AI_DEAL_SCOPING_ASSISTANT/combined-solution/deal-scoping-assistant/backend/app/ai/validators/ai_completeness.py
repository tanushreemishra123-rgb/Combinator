"""Every AI use case must carry its responsible-AI fields and a requirement id."""

from typing import Any

from app.ai.findings import Finding, FindingLevel, error

_REQUIRED_FIELDS = ("evaluation", "responsible_ai_safety", "data_privacy", "human_review")


def check_ai_completeness(strategy: Any, level: FindingLevel = FindingLevel.ERROR) -> list[Finding]:
    """`level` follows the grounding rule: recorded answers report, live answers repair."""
    findings: list[Finding] = []
    for use_case in strategy.use_cases:
        empty = [name for name in _REQUIRED_FIELDS if not str(getattr(use_case, name)).strip()]
        if empty:
            findings.append(
                error(
                    f"{use_case.id} is missing: {', '.join(empty)}. Every AI use case needs "
                    "evaluation, responsible-AI and safety, data privacy and human review.",
                    [use_case.id],
                )
            )
        if not use_case.req_ids:
            findings.append(
                Finding(
                    level=level,
                    message=f"{use_case.id} must reference at least one requirement id",
                    ids=[use_case.id],
                )
            )
    return findings
