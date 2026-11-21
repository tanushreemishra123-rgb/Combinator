"""The generation functions: analysis pipeline, artifact wiring and the catalog hard rule."""

from datetime import UTC, datetime

import pytest

from app.ai.context import GenerationContext
from app.ai.mock_provider import MockGenerator
from app.core.errors import AIStageFailed
from app.domain.artifacts import ArtifactKind, Basis, ScopeClass
from app.domain.scope import CloudPlatform, ItemStatus, ItemType, Origin, ScopeItem, SourceRef
from app.generation.architecture import generate_architecture
from app.generation.prd import generate_prd
from app.generation.requirements import analyze_requirements
from app.generation.summary import generate_executive_summary
from tests.unit.ai.conftest import SCENARIOS, ScriptedGenerator, make_document

NOW = datetime(2026, 9, 18, tzinfo=UTC)


def mock_context(**kwargs: object) -> GenerationContext:
    generator = MockGenerator(scenario_slug="demo", scenarios_dir=SCENARIOS)
    return GenerationContext(generator=generator, mock_mode=True, **kwargs)  # type: ignore[arg-type]


def test_analyze_requirements_runs_both_stages_and_assigns_ids() -> None:
    document = make_document()
    items, findings = analyze_requirements([document], mock_context())
    assert [item.id for item in items] == ["FR_01", "NFR_01", "INT_01", "GAP_01", "Q_01"]
    assert [item.type for item in items] == [
        ItemType.FUNCTIONAL_REQUIREMENT,
        ItemType.NON_FUNCTIONAL_REQUIREMENT,
        ItemType.INTEGRATION,
        ItemType.MISSING_INFORMATION,
        ItemType.CLARIFICATION_QUESTION,
    ]
    # Cross references from the second stage point at the ids assigned in the first.
    gap = items[3]
    assert gap.details.gap is not None
    assert gap.details.gap.question_id == "Q_01"
    assert gap.related_ids == ["Q_01", "FR_01"]
    assert items[4].details.question is not None
    assert items[4].details.question.affected_ids == ["NFR_01"]
    assert findings == []


def test_analyze_requirements_verifies_quotes() -> None:
    document = make_document()
    items, _ = analyze_requirements([document], mock_context())
    refs = [ref for item in items for ref in item.source_refs]
    assert all(ref.verified for ref in refs)
    assert document.normalized_text[refs[0].start : refs[0].end] == refs[0].quote
    # The gap points at FR_01, so it inherits that item's customer quote and keeps its note.
    gap = items[3]
    assert gap.source_refs[0].quote == items[0].source_refs[0].quote
    assert gap.absence_note


def test_generate_prd_returns_content_and_warnings() -> None:
    items, _ = analyze_requirements([make_document()], mock_context())
    prd, findings = generate_prd(mock_context(items=items))
    assert prd.functional_requirements[0].req_id == "FR_01"
    assert findings == []


def test_mock_id_problems_are_warnings_not_errors() -> None:
    """A rejected requirement must not break generation in mock mode."""
    items, _ = analyze_requirements([make_document()], mock_context())
    items[0].status = ItemStatus.REJECTED
    prd, findings = generate_prd(mock_context(items=items))
    assert prd.functional_requirements[0].req_ids == []
    assert findings


def test_executive_summary_commercial_paragraph_comes_from_the_caller() -> None:
    draft = {
        "overview": "A portal.",
        "customer_objectives": [],
        "solution_highlights": [],
        "key_risks": [],
        "next_steps": [],
    }
    ctx = GenerationContext(generator=ScriptedGenerator({"executive_summary": [draft]}))
    summary, _ = generate_executive_summary(ctx, "Effort 30 to 40 person-weeks, ROM 300k USD.")
    assert summary.overview == "A portal."
    assert summary.commercial_summary == "Effort 30 to 40 person-weeks, ROM 300k USD."


SECTION = {"text": "x", "arc_ids": ["ARC_01"], "req_ids": [], "basis": Basis.INFERRED.value}


def architecture_answer(service: str) -> dict[str, object]:
    return {
        "components": [
            {
                "id": "ARC_01",
                "name": "Managed relational database",
                "area": "databases_and_storage",
                "cloud_service": service,
                "purpose": "Stores policy data.",
                "supported_ids": ["FR_01"],
                "rationale": "Managed PostgreSQL.",
                "basis": Basis.CUSTOMER.value,
                "req_ids": ["FR_01"],
            }
        ],
        "flows": [],
        "environments": {"dev": "d", "test": "t", "prod": "p"},
        "deployment_runtime": SECTION,
        "availability_scalability": SECTION,
        "backup_dr": SECTION,
        "observability": SECTION,
        "security_controls": SECTION,
    }


def test_architecture_rejects_services_outside_the_catalog() -> None:
    items, _ = analyze_requirements([make_document()], mock_context())
    generator = ScriptedGenerator({"architecture": [architecture_answer("Fantasy SQL")]})
    ctx = GenerationContext(generator=generator, items=items, platform=CloudPlatform.AZURE)
    with pytest.raises(AIStageFailed) as raised:
        generate_architecture(ctx)
    assert "not a Microsoft Azure service" in raised.value.errors[0]
    assert len(generator.calls) == 3  # the hard rule drives the repair loop


def test_architecture_accepts_a_catalog_service_and_sets_the_platform() -> None:
    items, _ = analyze_requirements([make_document()], mock_context())
    answer = architecture_answer("Azure Database for PostgreSQL")
    ctx = GenerationContext(
        generator=ScriptedGenerator({"architecture": [answer]}),
        items=items,
        platform=CloudPlatform.AZURE,
    )
    architecture, findings = generate_architecture(ctx)
    assert architecture.platform is CloudPlatform.AZURE
    assert architecture.components[0].cloud_service == "Azure Database for PostgreSQL"
    # Uncovered architecture areas are reported as warnings, not errors.
    assert any("no architecture component covers" in finding.message for finding in findings)


def test_prior_artifacts_are_known_ids() -> None:
    items, _ = analyze_requirements([make_document()], mock_context())
    ctx = mock_context(
        items=items,
        artifacts={ArtifactKind.FUNCTIONAL_SCOPE: {"capabilities": [{"id": "CAP_01"}]}},
    )
    assert "CAP_01" in ctx.known_ids()
    assert ctx.items_of(ItemType.CLARIFICATION_QUESTION)[0].origin is Origin.ASSUMED
    assert ScopeClass.CUSTOMER_REQUESTED.value == "customer_requested"


def test_capability_class_follows_the_origin_of_its_requirements() -> None:
    from app.domain.artifacts import Capability, FunctionalScope, ScopeClass
    from app.domain.scope import Priority
    from app.generation.functional_scope import classify_capabilities

    def item(item_id: str, origin: Origin) -> ScopeItem:
        return ScopeItem(
            id=item_id,
            type=ItemType.FUNCTIONAL_REQUIREMENT,
            title=item_id,
            origin=origin,
            source_refs=[SourceRef(document_id="D1", segment_id="D1.S1", quote="q")],
            created_at=NOW,
            updated_at=NOW,
        )

    def capability(cap_id: str, req_ids: list[str]) -> Capability:
        return Capability(
            id=cap_id,
            name=cap_id,
            description="x",
            included_req_ids=req_ids,
            priority=Priority.MEDIUM,
            module="",
            workstream_id="WS_01",
            delivery_package_id="DP_01",
            scope_class=ScopeClass.ASSUMPTION_PENDING,
            basis=Basis.CUSTOMER,
        )

    scope = FunctionalScope(
        capabilities=[
            capability("CAP_01", ["FR_01", "ASM_01"]),
            capability("CAP_02", ["FR_02"]),
            capability("CAP_03", ["ASM_01"]),
        ]
    )
    classify_capabilities(
        scope, [item("FR_01", Origin.CUSTOMER_STATED), item("FR_02", Origin.AI_INFERRED)]
    )
    assert [c.scope_class for c in scope.capabilities] == [
        ScopeClass.CUSTOMER_REQUESTED,
        ScopeClass.AI_INTERPRETED,
        ScopeClass.ASSUMPTION_PENDING,
    ]
