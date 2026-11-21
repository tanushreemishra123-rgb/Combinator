"""Persist and load generated artifacts.

One row per session and kind holds the latest version. Storing a kind again bumps
its version and marks it fresh; `mark_stale` records why a change invalidated it.
"""

import json
from hashlib import sha256
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from app.core.errors import NotFound
from app.db.models import Artifact as ArtifactRow
from app.db.models import Session as SessionRow
from app.domain.artifacts import (
    CONTENT_MODEL_BY_KIND,
    ArtifactEnvelope,
    ArtifactKind,
    ArtifactStatus,
)
from app.domain.base import DomainModel
from app.domain.estimation import Estimate
from app.domain.scope import CloudPlatform, SessionConfig


def config_hash(session: SessionRow) -> str:
    """Stable hash of the session config plus the platform, so staleness is provable."""
    payload = {
        "config": SessionConfig.model_validate(session.config).model_dump(mode="json"),
        "cloud_platform": session.cloud_platform or "",
    }
    text = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return sha256(text.encode("utf-8")).hexdigest()[:12]


def to_envelope(row: ArtifactRow) -> ArtifactEnvelope:
    return ArtifactEnvelope(
        kind=ArtifactKind(row.kind),
        version=row.version,
        scope_version_used=row.scope_version_used,
        config_hash_used=row.config_hash_used,
        status=ArtifactStatus(row.status),
        stale_reasons=list(row.stale_reasons),
        generated_by=row.generated_by,
        created_at=row.updated_at,
        content=dict(row.content),
    )


def get_row(db: DbSession, session_id: str, kind: ArtifactKind) -> ArtifactRow | None:
    statement = select(ArtifactRow).where(
        ArtifactRow.session_id == session_id, ArtifactRow.kind == kind.value
    )
    return db.scalars(statement).first()


def list_rows(db: DbSession, session_id: str) -> list[ArtifactRow]:
    statement = (
        select(ArtifactRow).where(ArtifactRow.session_id == session_id).order_by(ArtifactRow.kind)
    )
    return list(db.scalars(statement))


def list_artifacts(db: DbSession, session_id: str) -> list[ArtifactEnvelope]:
    return [to_envelope(row) for row in list_rows(db, session_id)]


def get_artifact(db: DbSession, session_id: str, kind: ArtifactKind) -> ArtifactEnvelope:
    row = get_row(db, session_id, kind)
    if row is None:
        raise NotFound(f"The {kind.value} artifact has not been generated for this session.")
    return to_envelope(row)


def has(db: DbSession, session_id: str, kind: ArtifactKind) -> bool:
    return get_row(db, session_id, kind) is not None


def store(
    db: DbSession,
    session: SessionRow,
    kind: ArtifactKind,
    content: dict[str, Any],
    generated_by: str,
) -> ArtifactEnvelope:
    """Write the latest content for one kind; the version counts the regenerations."""
    row = get_row(db, session.id, kind)
    if row is None:
        row = ArtifactRow(session_id=session.id, kind=kind.value, version=0)
        db.add(row)
    row.version += 1
    row.content = content
    row.scope_version_used = session.scope_version
    row.config_hash_used = config_hash(session)
    row.status = ArtifactStatus.FRESH.value
    row.stale_reasons = []
    row.generated_by = generated_by
    db.commit()
    db.refresh(row)
    return to_envelope(row)


def mark_stale(db: DbSession, session_id: str, kinds: list[ArtifactKind], reason: str) -> None:
    """Flag the artifacts a change invalidated; the content stays until it is regenerated."""
    for kind in kinds:
        row = get_row(db, session_id, kind)
        if row is None:
            continue
        reasons = list(row.stale_reasons)
        if reason not in reasons:
            reasons.append(reason)
        row.stale_reasons = reasons
        row.status = ArtifactStatus.STALE.value
    db.commit()


def raw_contents(db: DbSession, session_id: str) -> dict[ArtifactKind, dict[str, Any]]:
    """Stored content per kind, as JSON; what the deterministic services read."""
    return {ArtifactKind(row.kind): dict(row.content) for row in list_rows(db, session_id)}


def statuses(db: DbSession, session_id: str) -> dict[ArtifactKind, ArtifactStatus]:
    return {ArtifactKind(row.kind): ArtifactStatus(row.status) for row in list_rows(db, session_id)}


def load_contents(db: DbSession, session_id: str) -> dict[ArtifactKind, DomainModel]:
    """Stored content parsed into its typed model; the estimate is loaded separately."""
    parsed: dict[ArtifactKind, DomainModel] = {}
    for kind, content in raw_contents(db, session_id).items():
        model = CONTENT_MODEL_BY_KIND.get(kind)
        if model is not None:
            parsed[kind] = model.model_validate(content)
    return parsed


def load_estimate(db: DbSession, session_id: str) -> Estimate | None:
    row = get_row(db, session_id, ArtifactKind.ESTIMATE)
    return Estimate.model_validate(row.content) if row is not None else None


def platform_of(session: SessionRow) -> CloudPlatform | None:
    return CloudPlatform(session.cloud_platform) if session.cloud_platform else None


def state_fingerprint(db: DbSession, session: SessionRow) -> str:
    """What a package or quality report was built from: scope version + every artifact version.

    Any change, regeneration or recalculation alters it, so a stored report or package
    that carries a different fingerprint is out of date and must not be reused.
    """
    parts = [f"scope:{session.scope_version}"]
    parts += [f"{row.kind}:{row.version}" for row in list_rows(db, session.id)]
    return "|".join(sorted(parts))
