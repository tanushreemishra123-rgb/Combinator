"""Shared Pydantic base for every domain model."""

from pydantic import BaseModel, ConfigDict


class DomainModel(BaseModel):
    """Strict models: unknown keys are rejected so AI output cannot smuggle fields in."""

    # A response always carries every field, so output schemas list defaulted fields as
    # required; the generated frontend types then need no undefined checks.
    model_config = ConfigDict(extra="forbid", json_schema_serialization_defaults_required=True)
