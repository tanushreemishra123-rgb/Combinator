"""Live checks that one call per stage works with the configured provider.

Needs RUN_LIVE_TESTS=1 and a live configuration; the settings are read through
`get_settings()`, never from the `.env` file directly. The shared test environment forces
mock mode, so these skip during a normal run; `scripts/record_mock_responses.py` is the
way to exercise a provider live.
"""

import pytest

from app.ai.context import GenerationContext
from app.ai.provider import build_live_generator, resolve_ai_runtime
from app.ai.runner import run_stage
from app.ai.stages import ai_strategy as ai_strategy_stage
from app.ai.stages import architecture as architecture_stage
from app.ai.stages import extract_scope as extract_stage
from app.catalogs.cloud_services import load_cloud_catalog
from app.core.config import AiMode, get_settings
from app.domain.scope import CloudPlatform, ItemType
from tests.unit.ai.conftest import make_document, make_item


@pytest.fixture(scope="module")
def live_context() -> GenerationContext:
    settings = get_settings()
    if resolve_ai_runtime(settings).mode is not AiMode.LIVE:
        pytest.skip("no live AI configuration in .env")
    return GenerationContext(
        generator=build_live_generator(settings),
        customer_name="Ridgeline Freight",
        max_repair_attempts=1,
    )


@pytest.mark.live
def test_extract_scope_schema(live_context: GenerationContext) -> None:
    ctx = GenerationContext(**{**live_context.__dict__, "documents": [make_document()]})
    result = run_stage(ctx.generator, extract_stage.build(ctx), ctx.max_repair_attempts)
    assert result.result.items
    assert any(item.quotes for item in result.result.items)


@pytest.mark.live
def test_architecture_fits_in_one_call(live_context: GenerationContext) -> None:
    items = [make_item("FR_01", title="Customers track shipments in the portal.")]
    ctx = GenerationContext(**{**live_context.__dict__, "items": items})
    request = architecture_stage.build(ctx, CloudPlatform.AZURE)
    draft = run_stage(ctx.generator, request, ctx.max_repair_attempts).result
    catalog = load_cloud_catalog(CloudPlatform.AZURE)
    assert draft.components
    assert all(c.cloud_service in catalog.service_names() for c in draft.components)
    assert draft.observability.text  # the cross-cutting sections come in the same answer


@pytest.mark.live
def test_ai_strategy_schema(live_context: GenerationContext) -> None:
    items = [
        make_item("FR_01", title="Answer customer questions from the knowledge base.", tags=["ai"]),
        make_item("SEC_01", ItemType.SECURITY_COMPLIANCE, title="No personal data leaves the EU."),
    ]
    ctx = GenerationContext(**{**live_context.__dict__, "items": items})
    result = run_stage(ctx.generator, ai_strategy_stage.build(ctx), ctx.max_repair_attempts)
    assert result.result.use_cases
    assert all(use_case.human_review for use_case in result.result.use_cases)
