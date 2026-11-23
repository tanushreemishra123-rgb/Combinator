"""Record live AI answers for one scenario into its `mock/` folder.

Usage (from backend/):
    uv run python scripts/record_mock_responses.py <slug> [--platforms aws,azure]
                                                          [--stages extract_scope,gap_analysis]
                                                          [--pause 8] [--force]

The recorded files are the raw stage outputs, so the mock provider can replay them.
Review and curate them before committing. Needs a live AI configuration in `.env`.
Every stage runs each time. A stage that already has a file is replayed from it, so an
interrupted run resumes where it stopped and later stages always see their inputs.
`--stages a,b` records those stages again; `--force` records everything again. A file is
dropped only when its stage fails validation, never when the provider is unavailable.
`--pause` is the minimum gap between live calls; every call prints its token usage.
"""

import argparse
import json
import sys
import time
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field, replace
from datetime import UTC, datetime
from pathlib import Path
from typing import TypeVar

from pydantic import BaseModel

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from app.ai.context import GenerationContext  # noqa: E402
from app.ai.errors import AiProviderUnavailable  # noqa: E402
from app.ai.provider import LiveGenerator, StructuredGenerator, build_live_generator  # noqa: E402
from app.ai.stages import STAGE_NAMES  # noqa: E402
from app.catalogs.paths import SCENARIOS_DIR  # noqa: E402
from app.core.config import AiMode, get_settings  # noqa: E402
from app.core.errors import AIStageFailed  # noqa: E402
from app.domain.artifacts import ArtifactKind  # noqa: E402
from app.domain.scope import (  # noqa: E402
    CloudPlatform,
    DocumentFormat,
    SessionConfig,
    SourceDocument,
)
from app.generation.ai_strategy import generate_ai_strategy  # noqa: E402
from app.generation.architecture import (  # noqa: E402
    generate_architecture,
    recommend_platform,
)
from app.generation.data_strategy import generate_data_strategy  # noqa: E402
from app.generation.estimate_drivers import generate_estimate_drivers  # noqa: E402
from app.generation.functional_scope import generate_functional_scope  # noqa: E402
from app.generation.integration import generate_integration_architecture  # noqa: E402
from app.generation.prd import generate_prd  # noqa: E402
from app.generation.requirements import analyze_requirements  # noqa: E402
from app.generation.summary import generate_executive_summary  # noqa: E402
from app.ingestion.extractors import extract  # noqa: E402
from app.ingestion.normalizer import normalize  # noqa: E402

ANALYSIS_STAGES = ("extract_scope", "gap_analysis")

# Classic TypeVar rather than PEP 695 syntax: the SAST scanner cannot parse the new form.
T = TypeVar("T", bound=BaseModel)


@dataclass
class RecordingGenerator:
    """Passes calls through and writes every raw answer to `<out_dir>/<stage>.json`."""

    inner: LiveGenerator
    out_dir: Path
    pause_seconds: float = 0.0
    force: frozenset[str] = frozenset()  # stages to record again even if a file exists
    label: str = "live"
    seen: set[str] = field(default_factory=set)  # stages already answered in this run

    def generate(self, stage: str, schema: type[T], system: str, user: str) -> T:
        path = self.out_dir / f"{stage}.json"
        # `architecture.azure` is forced by naming `architecture`; the variant is a suffix.
        forced = stage in self.force or stage.split(".")[0] in self.force
        # A second call for the same stage in one run is a repair. A replayed file that was
        # rejected must not be replayed again; the repair goes live and overwrites it.
        if path.is_file() and not forced and stage not in self.seen:
            self.seen.add(stage)
            print(f"  kept {path}")
            return schema.model_validate(json.loads(path.read_text(encoding="utf-8")))
        self.seen.add(stage)
        result = self.inner.generate(stage, schema, system, user)
        self.out_dir.mkdir(parents=True, exist_ok=True)
        path.write_text(result.model_dump_json(indent=2) + "\n", encoding="utf-8")
        used = self.inner.usage[-1][1] if self.inner.usage else {}
        print(
            f"  recorded {path} "
            f"(in {used.get('input_tokens', 0)}, out {used.get('output_tokens', 0)} tokens)"
        )
        if self.pause_seconds:
            # Free tiers meter requests per minute; a pause keeps a long run inside them.
            time.sleep(self.pause_seconds)
        return result


def load_scenario(slug: str) -> tuple[SourceDocument, dict[str, object]]:
    """Build the document the way the app does, so recorded quotes match at runtime."""
    folder = SCENARIOS_DIR / slug
    text = (folder / "requirements.md").read_text(encoding="utf-8")
    context = json.loads((folder / "context.json").read_text(encoding="utf-8"))
    normalized = normalize(extract(DocumentFormat.MD, text.encode("utf-8")), 1)
    document = SourceDocument(
        id="D1",
        session_id=slug,
        name="requirements.md",
        kind="pasted",
        format="md",
        normalized_text=normalized.normalized_text,
        segments=normalized.segments,
        created_at=datetime.now(UTC),
    )
    return document, context


def build_context(slug: str, generator: StructuredGenerator) -> GenerationContext:
    document, context = load_scenario(slug)
    # The context file is loose JSON; pydantic validates the three fields we take from it.
    config = SessionConfig.model_validate(
        {
            key: context[key]
            for key in ("expected_users", "target_regions", "regulatory_constraints")
            if key in context
        }
    )
    preferred = context.get("preferred_cloud")
    return GenerationContext(
        generator=generator,
        documents=[document],
        config=config,
        customer_name=str(context.get("customer_name", "")),
        opportunity_context=str(context.get("opportunity_summary", "")),
        platform=CloudPlatform(preferred) if isinstance(preferred, str) and preferred else None,
    )


def record(
    slug: str,
    platforms: list[CloudPlatform],
    again: frozenset[str] = frozenset(),
    out: Path | None = None,
    pause_seconds: float = 0.0,
) -> None:
    """Run every stage; existing files are reused unless the stage is listed in `again`."""
    settings = get_settings()
    if settings.ai_mode is not AiMode.LIVE:
        raise SystemExit("set AI_MODE=live and a provider key in backend/.env first")
    out_dir = out or SCENARIOS_DIR / slug / "mock"
    live = build_live_generator(settings)
    generator = RecordingGenerator(
        inner=live, out_dir=out_dir, pause_seconds=pause_seconds, force=again
    )
    ctx = build_context(slug, generator)
    print(f"recording {slug} with {generator.inner.label}")

    try:
        items, findings = analyze_requirements(ctx.documents, ctx)
    except AiProviderUnavailable:
        raise  # the answer was never given, so there is nothing wrong to drop
    except AIStageFailed:
        (out_dir / "gap_analysis.json").unlink(missing_ok=True)
        raise
    ctx = replace(ctx, items=items)
    print(f"  {len(items)} scope items, {len(findings)} findings")

    artifacts: dict[ArtifactKind, dict[str, object]] = {}

    def step(
        stage: str, kind: ArtifactKind, run: Callable[[], tuple[BaseModel, Sequence[object]]]
    ) -> None:
        nonlocal ctx
        try:
            content, warnings = run()
        except AiProviderUnavailable:
            raise  # the answer was never given, so there is nothing wrong to drop
        except AIStageFailed:
            # A rejected answer must not be replayed on the next attempt.
            (out_dir / f"{stage}.json").unlink(missing_ok=True)
            raise
        artifacts[kind] = content.model_dump(mode="json")
        ctx = replace(ctx, artifacts=dict(artifacts))
        print(f"  {stage}: {len(warnings)} warnings")

    step("prd", ArtifactKind.PRD, lambda: generate_prd(ctx))
    step("functional_scope", ArtifactKind.FUNCTIONAL_SCOPE, lambda: generate_functional_scope(ctx))

    step(
        "recommend_platform",
        ArtifactKind.PLATFORM_RECOMMENDATION,
        lambda: recommend_platform(ctx),
    )

    architectures: dict[CloudPlatform, dict[str, object]] = {}
    for platform in platforms:
        platform_ctx = replace(ctx, platform=platform, variant=platform.value)
        try:
            architecture, warnings = generate_architecture(platform_ctx, platform)
        except AiProviderUnavailable:
            raise
        except AIStageFailed:
            (out_dir / f"architecture.{platform.value}.json").unlink(missing_ok=True)
            raise
        architectures[platform] = architecture.model_dump(mode="json")
        print(f"  architecture.{platform.value}: {len(warnings)} warnings")

    # The later stages are recorded against the scenario's own platform (its preferred
    # cloud, else the first one recorded), never against whichever variant came last.
    home = ctx.platform if ctx.platform in architectures else platforms[0]
    artifacts[ArtifactKind.ARCHITECTURE] = architectures[home]
    ctx = replace(ctx, artifacts=dict(artifacts), platform=home)
    print(f"  later stages use the {home.value} architecture")

    step("data_strategy", ArtifactKind.DATA_STRATEGY, lambda: generate_data_strategy(ctx))
    step(
        "integration_architecture",
        ArtifactKind.INTEGRATION_ARCHITECTURE,
        lambda: generate_integration_architecture(ctx),
    )
    step("ai_strategy", ArtifactKind.AI_STRATEGY, lambda: generate_ai_strategy(ctx))
    step("estimate_drivers", ArtifactKind.ESTIMATE_DRIVERS, lambda: generate_estimate_drivers(ctx))
    step(
        "executive_summary",
        ArtifactKind.EXECUTIVE_SUMMARY,
        lambda: generate_executive_summary(ctx),
    )
    for stage, used in live.usage:
        inputs, outputs = used.get("input_tokens", 0), used.get("output_tokens", 0)
        print(f"  tokens {stage}: in {inputs}, out {outputs}")
    print(f"done: {out_dir}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("slug", help="scenario folder under backend/seeds/scenarios")
    parser.add_argument(
        "--platforms", default="aws,azure,gcp", help="comma separated: aws,azure,gcp"
    )
    parser.add_argument(
        "--stages", default="", help="comma separated stage names to record again (others are kept)"
    )
    parser.add_argument("--out", default="", help="write elsewhere than the scenario mock folder")
    parser.add_argument(
        "--pause", type=float, default=0.0, help="seconds to sleep between live calls"
    )
    parser.add_argument(
        "--force", action="store_true", help="record again even when the file already exists"
    )
    args = parser.parse_args()
    platforms = [CloudPlatform(name) for name in args.platforms.split(",") if name]
    again = (
        frozenset(STAGE_NAMES)
        if args.force
        else frozenset(name.strip() for name in args.stages.split(",") if name.strip())
    )
    try:
        record(
            args.slug,
            platforms,
            again,
            Path(args.out) if args.out else None,
            pause_seconds=args.pause,
        )
    except AIStageFailed as exc:
        # The validator messages say what the model got wrong; they are the useful part.
        print(f"failed: {exc.detail}")
        for message in exc.errors:
            print(f"  - {message}")
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
