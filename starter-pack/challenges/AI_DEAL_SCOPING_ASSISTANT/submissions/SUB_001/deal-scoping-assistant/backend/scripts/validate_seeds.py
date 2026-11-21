#!/usr/bin/env python3
"""Validate the seed data files under backend/seeds.

Checks the seed content this repository ships with: every JSON file parses, the
cloud catalogs use only the fourteen architecture areas and cover each of them,
service names are unique inside and across platforms, both rate cards price the
same roles, and every scenario has its two files with a complete context.

Run: python3 backend/scripts/validate_seeds.py
Exit code 0 when everything passes, 1 otherwise.
"""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any

SEEDS = Path(__file__).resolve().parent.parent / "seeds"

AREAS = (
    "user_facing_applications",
    "backend_services",
    "apis",
    "databases_and_storage",
    "identity_and_access_management",
    "messaging_and_event_processing",
    "integration_components",
    "ai_and_ml_services",
    "observability_and_monitoring",
    "security_controls",
    "deployment_and_runtime",
    "environments_dev_test_prod",
    "availability_and_scalability",
    "backup_and_disaster_recovery",
)
MIN_PER_AREA = 3

PLATFORMS = ("aws", "azure", "gcp")

SCENARIOS = (
    "legacy-policy-modernization",
    "retail-integration-hub",
    "support-knowledge-assistant",
    "vague-portal-rfp",
)

CONTEXT_KEYS = (
    "slug",
    "title",
    "scenario_type",
    "customer_name",
    "industry",
    "opportunity_summary",
    "requested_by",
    "preferred_cloud",
    "expected_users",
    "target_regions",
    "delivery_deadline",
    "regulatory_constraints",
    "demo_change",
)

JSON_FILES = (
    [SEEDS / "catalogs" / f"{p}.json" for p in PLATFORMS]
    + [
        SEEDS / "catalogs" / "frameworks.json",
        SEEDS / "config" / "rate_cards.json",
        SEEDS / "config" / "estimation_defaults.json",
        SEEDS / "config" / "commercial.json",
        SEEDS / "config" / "historical_projects.json",
        SEEDS / "documents" / "package_outline.json",
    ]
    + [SEEDS / "scenarios" / s / "context.json" for s in SCENARIOS]
)

errors: list[str] = []


def fail(message: str) -> None:
    errors.append(message)


def load(path: Path) -> Any:
    """Parse a JSON seed file, recording an error instead of raising. Loose JSON, so Any."""
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        fail(f"{path}: missing")
    except json.JSONDecodeError as exc:
        fail(f"{path}: invalid JSON ({exc})")
    return None


def check_catalogs() -> None:
    seen: dict[str, str] = {}
    for platform in PLATFORMS:
        path = SEEDS / "catalogs" / f"{platform}.json"
        data = load(path)
        if data is None:
            continue
        if data.get("platform") != platform:
            fail(f"{path}: platform is {data.get('platform')!r}, expected {platform!r}")
        if not data.get("display_name"):
            fail(f"{path}: display_name is missing")

        services = data.get("services") or []
        if not services:
            fail(f"{path}: no services")
            continue

        counts: Counter[str] = Counter()
        for service in services:
            name = service.get("name")
            if not name:
                fail(f"{path}: a service has no name")
                continue
            for field in ("category", "description"):
                if not service.get(field):
                    fail(f"{path}: {name}: {field} is missing")
            owner = seen.get(name)
            if owner == platform:
                fail(f"{path}: duplicate service name {name!r}")
            elif owner is not None:
                fail(f"{path}: service name {name!r} also appears in {owner}.json")
            else:
                seen[name] = platform

            areas = service.get("areas") or []
            if not areas:
                fail(f"{path}: {name}: areas is empty")
            for area in areas:
                if area not in AREAS:
                    fail(f"{path}: {name}: unknown area {area!r}")
            counts.update(set(areas))

        print(f"{platform}: {len(services)} services")
        for area in AREAS:
            if counts[area] < MIN_PER_AREA:
                fail(f"{path}: area {area} has {counts[area]} services, need {MIN_PER_AREA}")
            print(f"    {area}: {counts[area]}")


def check_frameworks() -> None:
    path = SEEDS / "catalogs" / "frameworks.json"
    data = load(path)
    if data is None:
        return
    entries = data.get("frameworks") or []
    if len(entries) < 8:
        fail(f"{path}: only {len(entries)} frameworks")
    names = [e.get("name") for e in entries]
    for name, count in Counter(names).items():
        if count > 1:
            fail(f"{path}: duplicate framework name {name!r}")
    for entry in entries:
        for field in ("name", "language_ecosystems", "best_for", "avoid_when", "notes"):
            if not entry.get(field):
                fail(f"{path}: {entry.get('name')!r}: {field} is missing or empty")
    print(f"frameworks: {len(entries)} entries")


def check_rate_cards() -> None:
    path = SEEDS / "config" / "rate_cards.json"
    data = load(path)
    if data is None:
        return
    cards = {c.get("id"): c for c in data.get("rate_cards") or []}
    for card_id in ("usd-standard", "eur-standard"):
        if card_id not in cards:
            fail(f"{path}: rate card {card_id!r} is missing")
    if len(cards) != len(data.get("rate_cards") or []):
        fail(f"{path}: duplicate rate card ids")

    role_lists: dict[str, list[str]] = {}
    for card_id, card in cards.items():
        for field in ("name", "currency", "rates"):
            if not card.get(field):
                fail(f"{path}: {card_id}: {field} is missing")
        roles = []
        for rate in card.get("rates") or []:
            role = rate.get("role")
            value = rate.get("rate_per_person_week")
            if not role:
                fail(f"{path}: {card_id}: a rate has no role")
                continue
            if not isinstance(value, (int, float)) or value <= 0:
                fail(f"{path}: {card_id}: {role}: rate_per_person_week must be a positive number")
            roles.append(role)
        if len(set(roles)) != len(roles):
            fail(f"{path}: {card_id}: duplicate roles")
        role_lists[card_id] = sorted(roles)

    distinct = {tuple(v) for v in role_lists.values()}
    if len(distinct) > 1:
        fail(f"{path}: rate cards do not price the same roles")
    print(f"rate cards: {len(cards)} cards, {len(role_lists.get('usd-standard', []))} roles each")

    commercial_path = SEEDS / "config" / "commercial.json"
    commercial = load(commercial_path)
    if commercial is None:
        return
    for field in ("default_rate_card_id", "default_contingency_pct", "blended_rate_mode", "notes"):
        if commercial.get(field) in (None, "", []):
            fail(f"{commercial_path}: {field} is missing")
    default_id = commercial.get("default_rate_card_id")
    if default_id not in cards:
        fail(f"{commercial_path}: default_rate_card_id {default_id!r} is not a known rate card")


def check_estimation_defaults() -> None:
    """The estimation rule tables: parse, and every table present with its note."""
    path = SEEDS / "config" / "estimation_defaults.json"
    data = load(path)
    if data is None:
        return
    tables = (
        "base_effort",
        "overheads",
        "factors",
        "factor_scope",
        "spreads",
        "rounding",
        "reporting",
        "team_sizes",
        "role_mix",
        "productivity",
        "workstream_types",
        "confidence",
    )
    for table in tables:
        section = data.get(table)
        if not isinstance(section, dict):
            fail(f"{path}: table {table} is missing")
        elif not section.get("note"):
            fail(f"{path}: table {table} has no note")
    print(f"estimation defaults: {len(tables)} rule tables")


def check_historical_projects() -> None:
    path = SEEDS / "config" / "historical_projects.json"
    data = load(path)
    if data is None:
        return
    if not data.get("disclaimer"):
        fail(f"{path}: disclaimer is missing")
    projects = data.get("projects") or []
    if len(projects) != 6:
        fail(f"{path}: {len(projects)} projects, expected 6")
    allowed_types = {"modernization", "integration", "ai", "portal"}
    ids = []
    for project in projects:
        for field in (
            "id",
            "title",
            "type",
            "duration_weeks",
            "effort_person_weeks",
            "team_size",
            "cloud",
            "summary",
        ):
            if project.get(field) in (None, ""):
                fail(f"{path}: {project.get('id')!r}: {field} is missing")
        if project.get("type") not in allowed_types:
            fail(f"{path}: {project.get('id')!r}: unknown type {project.get('type')!r}")
        if project.get("cloud") not in PLATFORMS:
            fail(f"{path}: {project.get('id')!r}: unknown cloud {project.get('cloud')!r}")
        ids.append(project.get("id"))
    if len(set(ids)) != len(ids):
        fail(f"{path}: duplicate project ids")
    print(f"historical projects: {len(projects)}")


def check_package_outline() -> None:
    path = SEEDS / "documents" / "package_outline.json"
    data = load(path)
    if data is None:
        return
    sections = data.get("sections") or []
    if len(sections) != 21:
        fail(f"{path}: {len(sections)} sections, expected 21")
    if sections and sections[-1].get("title") != "Quality gate results":
        fail(f"{path}: last section must be 'Quality gate results'")
    ids = []
    for section in sections:
        for field in ("id", "title", "source"):
            if not section.get(field):
                fail(f"{path}: {section.get('id')!r}: {field} is missing")
        ids.append(section.get("id"))
    if len(set(ids)) != len(ids):
        fail(f"{path}: duplicate section ids")
    print(f"package outline: {len(sections)} sections")


def check_scenarios() -> None:
    for slug in SCENARIOS:
        folder = SEEDS / "scenarios" / slug
        requirements = folder / "requirements.md"
        if not requirements.is_file():
            fail(f"{requirements}: missing")
        elif not requirements.read_text(encoding="utf-8").strip():
            fail(f"{requirements}: empty")

        context_path = folder / "context.json"
        context = load(context_path)
        if context is None:
            continue
        for key in CONTEXT_KEYS:
            if key not in context:
                fail(f"{context_path}: key {key!r} is missing")
        if context.get("slug") != slug:
            fail(f"{context_path}: slug is {context.get('slug')!r}, expected {slug!r}")
        if context.get("preferred_cloud") not in (*PLATFORMS, None):
            cloud = context.get("preferred_cloud")
            fail(f"{context_path}: preferred_cloud {cloud!r} is not aws, azure, gcp or null")
        for key in ("target_regions", "regulatory_constraints"):
            if not isinstance(context.get(key), list):
                fail(f"{context_path}: {key} must be a list")

        change = context.get("demo_change") or {}
        if not isinstance(change, dict):
            fail(f"{context_path}: demo_change must be an object")
            continue
        if not change.get("description"):
            fail(f"{context_path}: demo_change.description is missing")
        if not (change.get("config_key") or change.get("item_hint")):
            fail(f"{context_path}: demo_change needs config_key or item_hint")
        for key in ("from", "to"):
            if key not in change:
                fail(f"{context_path}: demo_change.{key} is missing")
        if change.get("from") == change.get("to"):
            fail(f"{context_path}: demo_change from and to are identical")
    print(f"scenarios: {len(SCENARIOS)} folders")


def main() -> int:
    for path in JSON_FILES:
        load(path)
    print(f"json files parsed: {len(JSON_FILES)}")
    check_catalogs()
    check_frameworks()
    check_rate_cards()
    check_estimation_defaults()
    check_historical_projects()
    check_package_outline()
    check_scenarios()

    if errors:
        print(f"\nFAILED with {len(errors)} problem(s):")
        for message in errors:
            print(f"  - {message}")
        return 1
    print("\nAll seed checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
