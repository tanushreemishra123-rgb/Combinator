"""Where the seeded catalogs live (backend/seeds/catalogs)."""

from pathlib import Path

SEEDS_DIR = Path(__file__).resolve().parents[2] / "seeds"
CATALOGS_DIR = SEEDS_DIR / "catalogs"
SCENARIOS_DIR = SEEDS_DIR / "scenarios"
