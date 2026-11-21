"""S11: the executive summary. The commercial paragraph is filled in by the application."""

from functools import partial

from pydantic import Field

from app.ai.context import GenerationContext
from app.ai.runner import StageRequest
from app.ai.stages.base import as_json, config_view, elements_view, items_view, load_prompt
from app.ai.validators.id_references import check_id_references
from app.domain.artifacts import ArtifactKind, ExecutiveSummary, Statement
from app.domain.base import DomainModel
from app.domain.scope import ItemType

STAGE = "executive_summary"


class ExecutiveSummaryDraft(DomainModel):
    """The summary without `commercial_summary`: the model must not write numbers."""

    overview: str = Field(description="One-paragraph summary of the proposed solution.")
    customer_objectives: list[Statement] = Field(
        default_factory=list, description="What the customer wants to achieve."
    )
    solution_highlights: list[Statement] = Field(
        default_factory=list, description="Key points of the proposed solution."
    )
    key_risks: list[Statement] = Field(default_factory=list, description="Key risks to flag.")
    next_steps: list[Statement] = Field(default_factory=list, description="Recommended next steps.")


def build(ctx: GenerationContext) -> StageRequest[ExecutiveSummaryDraft]:
    prd = ctx.artifact(ArtifactKind.PRD)
    functional_scope = ctx.artifact(ArtifactKind.FUNCTIONAL_SCOPE)
    architecture = ctx.artifact(ArtifactKind.ARCHITECTURE)
    ai_strategy = ctx.artifact(ArtifactKind.AI_STRATEGY)
    user = as_json(
        {
            "customer": ctx.customer_name,
            "opportunity_context": ctx.opportunity_context,
            "config": config_view(ctx.config),
            "platform": ctx.platform.value if ctx.platform else "",
            "objectives_and_risks": items_view(
                ctx.items_of(
                    ItemType.BUSINESS_OBJECTIVE,
                    ItemType.RISK,
                    ItemType.CLARIFICATION_QUESTION,
                    ItemType.ASSUMPTION,
                )
            ),
            "prd_overview": prd.get("overview", ""),
            "business_problem": prd.get("business_problem", ""),
            "capabilities": elements_view(
                functional_scope.get("capabilities", []), ("id", "name", "included_req_ids")
            ),
            "architecture_components": elements_view(
                architecture.get("components", []), ("id", "name", "area", "cloud_service")
            ),
            "ai_use_cases": elements_view(
                ai_strategy.get("use_cases", []), ("id", "name", "processing_class")
            ),
        }
    )
    return StageRequest(
        stage=ctx.stage_key(STAGE),
        schema=ExecutiveSummaryDraft,
        system=load_prompt(STAGE),
        user=user,
        validators=[
            partial(check_id_references, known_ids=ctx.known_ids(), level=ctx.reference_level())
        ],
    )


def to_executive_summary(draft: ExecutiveSummaryDraft, commercial_summary: str) -> ExecutiveSummary:
    """The commercial paragraph comes from the deterministic estimate, not from the model."""
    return ExecutiveSummary(**draft.model_dump(), commercial_summary=commercial_summary)
