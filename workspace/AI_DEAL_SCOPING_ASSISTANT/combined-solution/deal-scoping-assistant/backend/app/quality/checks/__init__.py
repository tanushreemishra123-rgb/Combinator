"""The 16 quality-gate checks (PLAN section 8, catalogue in docs/QUALITY_GATE.md).

Every check is a small pure function over `QualityContext` and returns one
`QualityCheckResult`. Messages are written for a reviewer, not for a developer.
`ALL_CHECKS` is the order the gate runs them in.
"""

from collections.abc import Callable

from app.domain.quality import QualityCheckResult
from app.quality.checks.architecture import (
    qg_04_components_without_justification,
    qg_09_conflicting_technology,
)
from app.quality.checks.common import QualityContext
from app.quality.checks.consistency import (
    PAIR_CHECKS,
    PairFinding,
    pairwise_findings,
    qg_13_cross_document_consistency,
)
from app.quality.checks.coverage import (
    qg_01_high_priority_coverage,
    qg_02_uncovered_requirements,
    qg_03_unsupported_additions,
    qg_14_ai_requirement_coverage,
    qg_15_requirement_to_estimate,
    qg_16_requirement_to_architecture,
)
from app.quality.checks.delivery import (
    qg_05_integrations_in_delivery_plan,
    qg_07_missing_estimation_inputs,
    qg_10_estimate_consistency,
)
from app.quality.checks.review import (
    AI_REQUIRED_FIELDS,
    pending_assumption_ids,
    qg_06_ai_use_case_completeness,
    qg_08_unresolved_questions,
    qg_11_assumptions_requiring_validation,
    qg_12_stale_or_missing_artifacts,
    validation_required_elements,
)

ALL_CHECKS: tuple[Callable[[QualityContext], QualityCheckResult], ...] = (
    qg_01_high_priority_coverage,
    qg_02_uncovered_requirements,
    qg_03_unsupported_additions,
    qg_04_components_without_justification,
    qg_05_integrations_in_delivery_plan,
    qg_06_ai_use_case_completeness,
    qg_07_missing_estimation_inputs,
    qg_08_unresolved_questions,
    qg_09_conflicting_technology,
    qg_10_estimate_consistency,
    qg_11_assumptions_requiring_validation,
    qg_12_stale_or_missing_artifacts,
    qg_13_cross_document_consistency,
    qg_14_ai_requirement_coverage,
    qg_15_requirement_to_estimate,
    qg_16_requirement_to_architecture,
)

__all__ = [
    "AI_REQUIRED_FIELDS",
    "ALL_CHECKS",
    "PAIR_CHECKS",
    "PairFinding",
    "QualityContext",
    "pairwise_findings",
    "pending_assumption_ids",
    "qg_01_high_priority_coverage",
    "qg_02_uncovered_requirements",
    "qg_03_unsupported_additions",
    "qg_04_components_without_justification",
    "qg_05_integrations_in_delivery_plan",
    "qg_06_ai_use_case_completeness",
    "qg_07_missing_estimation_inputs",
    "qg_08_unresolved_questions",
    "qg_09_conflicting_technology",
    "qg_10_estimate_consistency",
    "qg_11_assumptions_requiring_validation",
    "qg_12_stale_or_missing_artifacts",
    "qg_13_cross_document_consistency",
    "qg_14_ai_requirement_coverage",
    "qg_15_requirement_to_estimate",
    "qg_16_requirement_to_architecture",
    "validation_required_elements",
]
