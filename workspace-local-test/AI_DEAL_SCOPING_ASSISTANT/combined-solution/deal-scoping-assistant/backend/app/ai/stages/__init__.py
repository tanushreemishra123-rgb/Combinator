"""One module per AI stage: prompt, input builder, output schema and validators.

Each name below is one live call and one recorded mock file
(`seeds/scenarios/<slug>/mock/<stage>[.<variant>].json`). The architecture stage adds the
platform as a variant, for example `architecture.azure.json`.
"""

STAGE_NAMES = (
    "extract_scope",
    "gap_analysis",
    "prd",
    "functional_scope",
    "recommend_platform",
    "architecture",  # per platform: architecture.azure, ...
    "data_strategy",
    "integration_architecture",
    "ai_strategy",
    "estimate_drivers",
    "executive_summary",
)
