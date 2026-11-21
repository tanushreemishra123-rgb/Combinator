"""Review-state checks: QG_06, QG_08, QG_11 and QG_12."""

from app.domain.artifacts import ArtifactKind, ArtifactStatus, ProcessingClass
from app.domain.quality import CheckId, CheckStatus, QualityCheckResult, Severity
from app.domain.scope import AnswerStatus, ConfirmationStatus, ItemStatus, ItemType, Priority
from app.quality.checks.common import (
    QualityContext,
    check_result,
    has_artifact,
    not_applicable,
)
from app.traceability.index import REGISTRY, iter_elements

AI_REQUIRED_FIELDS = ("evaluation", "data_privacy", "responsible_ai_safety", "human_review")


_HIGH_PRIORITIES = (Priority.MUST, Priority.HIGH)


def qg_06_ai_use_case_completeness(ctx: QualityContext) -> QualityCheckResult:
    name = "AI use cases missing evaluation, privacy, safety or human review"
    if not has_artifact(ctx, ArtifactKind.AI_STRATEGY):
        return not_applicable(
            CheckId.QG_06, name, Severity.WARNING, "No AI strategy has been generated."
        )
    findings: list[str] = []
    ids: list[str] = []
    for element_id, element in iter_elements(ctx.contents, ArtifactKind.AI_STRATEGY, "use_cases"):
        if element.get("processing_class") != ProcessingClass.AI.value:
            continue
        missing = [field for field in AI_REQUIRED_FIELDS if not str(element.get(field, "")).strip()]
        if missing:
            findings.append(f"{element_id} is missing {', '.join(missing)}.")
            ids.append(element_id)
    return check_result(
        CheckId.QG_06,
        name,
        Severity.WARNING,
        findings,
        ids,
        "Every AI use case documents evaluation, privacy, safety and human review.",
        "Responsible-AI information is incomplete:",
        "Fill the missing evaluation, privacy, safety and human-review fields.",
        CheckStatus.WARNING,
    )


def qg_08_unresolved_questions(ctx: QualityContext) -> QualityCheckResult:
    name = "Unresolved clarification questions"
    open_questions = [
        item
        for item in ctx.items
        if item.type is ItemType.CLARIFICATION_QUESTION
        and item.status is not ItemStatus.REJECTED
        and item.details.question is not None
        and item.details.question.answer_status is AnswerStatus.OPEN
    ]
    high_priority_ids = {item.id for item in ctx.items if item.priority in _HIGH_PRIORITIES}
    blocking: list[str] = []
    for question in open_questions:
        details = question.details.question
        linked = set(question.related_ids) | set(details.affected_ids if details else [])
        if linked & high_priority_ids:
            blocking.append(question.id)
    severity = Severity.ERROR if blocking else Severity.WARNING
    status = CheckStatus.FAILED if blocking else CheckStatus.WARNING
    findings: list[str] = []
    if open_questions:
        findings.append(", ".join(question.id for question in open_questions) + ".")
    if blocking:
        findings.append(f"{', '.join(blocking)} block must or high requirements.")
    return check_result(
        CheckId.QG_08,
        name,
        severity,
        findings,
        [question.id for question in open_questions],
        "All clarification questions are answered or dismissed.",
        "These clarification questions are still open:",
        "Record the customer's answer, or dismiss the question with a reason.",
        status,
    )


def validation_required_elements(ctx: QualityContext) -> list[tuple[ArtifactKind, str, str]]:
    """Generated elements that carry `validation_required`, with their reason."""
    found: list[tuple[ArtifactKind, str, str]] = []
    for kind in ctx.contents:
        for spec in REGISTRY.get(kind, ()):
            for element_id, element in iter_elements(ctx.contents, kind, spec.path):
                if element.get("validation_required"):
                    found.append((kind, element_id, str(element.get("validation_reason", ""))))
    return found


def pending_assumption_ids(ctx: QualityContext) -> list[str]:
    """Pending assumptions that generated content already relies on."""
    pending = []
    for item in ctx.items:
        assumption = item.details.assumption
        if (
            item.type is ItemType.ASSUMPTION
            and assumption is not None
            and assumption.confirmation_status is ConfirmationStatus.PENDING
            and ctx.index.references(item.id)
        ):
            pending.append(item.id)
    return pending


def qg_11_assumptions_requiring_validation(ctx: QualityContext) -> QualityCheckResult:
    name = "Assumptions requiring human validation"
    pending = pending_assumption_ids(ctx)
    elements = validation_required_elements(ctx)
    findings: list[str] = []
    if pending:
        findings.append(f"unconfirmed assumptions in use: {', '.join(pending)}.")
    if elements:
        findings.append(
            "elements flagged for validation: "
            + ", ".join(f"{element_id}" for _kind, element_id, _reason in elements)
            + "."
        )
    return check_result(
        CheckId.QG_11,
        name,
        Severity.WARNING,
        findings,
        pending + [element_id for _kind, element_id, _reason in elements],
        "No unconfirmed assumption is used by the generated outputs.",
        "The package relies on items a human must confirm:",
        "Confirm or reject each assumption with the customer before the package is used.",
        CheckStatus.WARNING,
    )


def qg_12_stale_or_missing_artifacts(ctx: QualityContext) -> QualityCheckResult:
    name = "Stale or missing artifacts"
    missing = [kind.value for kind in ctx.required_kinds if kind not in ctx.contents]
    stale = [
        kind.value
        for kind, status in ctx.statuses.items()
        if status is ArtifactStatus.STALE and kind in ctx.contents
    ]
    findings: list[str] = []
    if missing:
        findings.append(f"not generated yet: {', '.join(missing)}.")
    if stale:
        findings.append(f"out of date after a change: {', '.join(sorted(stale))}.")
    status = CheckStatus.FAILED if missing else CheckStatus.WARNING
    return check_result(
        CheckId.QG_12,
        name,
        Severity.ERROR,
        findings,
        missing + sorted(stale),
        "Every required artifact exists and is up to date.",
        "Some artifacts are missing or out of date:",
        "Generate the missing artifacts and regenerate the stale ones.",
        status,
    )
