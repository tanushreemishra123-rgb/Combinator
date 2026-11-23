"""S6: the data strategy. Platform neutral: it points at ARC ids, not at services."""

from functools import partial

from app.ai.context import GenerationContext
from app.ai.findings import Finding, FindingLevel
from app.ai.runner import StageRequest
from app.ai.stages.base import as_json, config_view, elements_view, items_view, load_prompt
from app.ai.validators.grounding import check_grounding
from app.ai.validators.id_references import check_id_references
from app.domain.artifacts import ArtifactKind, DataStrategy
from app.domain.scope import ItemType

STAGE = "data_strategy"

_RELEVANT = (
    ItemType.DATA_REQUIREMENT,
    ItemType.SECURITY_COMPLIANCE,
    ItemType.NON_FUNCTIONAL_REQUIREMENT,
    ItemType.INTEGRATION,
    ItemType.EXISTING_SYSTEM,
    ItemType.BUSINESS_OBJECTIVE,
    ItemType.ASSUMPTION,
)


def build(ctx: GenerationContext) -> StageRequest[DataStrategy]:
    architecture = ctx.artifact(ArtifactKind.ARCHITECTURE)
    user = as_json(
        {
            "customer": ctx.customer_name,
            "config": config_view(ctx.config),
            "scope_items": items_view(ctx.items_of(*_RELEVANT)),
            # Components without their cloud service, so the strategy stays platform neutral.
            "architecture_components": elements_view(
                architecture.get("components", []), ("id", "name", "area")
            ),
        }
    )
    return StageRequest(
        stage=ctx.stage_key(STAGE),
        schema=DataStrategy,
        system=load_prompt(STAGE),
        user=user,
        validators=[
            partial(check_id_references, known_ids=ctx.known_ids(), level=ctx.reference_level()),
            partial(_check_grounding, level=ctx.reference_level()),
        ],
    )


_SECTIONS = (
    "ingestion",
    "transactional_storage",
    "analytical_storage",
    "quality",
    "metadata_governance",
    "retention",
    "privacy_security",
    "reporting_analytics",
    "backup_recovery",
)


def _check_grounding(content: DataStrategy, level: FindingLevel) -> list[Finding]:
    """Domains and the nine sections must each rest on at least one requirement."""
    labelled = [(domain.id, domain) for domain in content.domains]
    labelled += [(name, getattr(content, name)) for name in _SECTIONS]
    return check_grounding(labelled, level)
