"""Generated artifacts: generate one, list them, read one.

Unit complexity is edited through a change request, so every edit is recorded.
"""

from fastapi import APIRouter

from app.api.v1.deps import ScenariosDir
from app.artifacts import service as artifacts
from app.domain.artifacts import ArtifactEnvelope, ArtifactKind
from app.sessions.deps import AppSettings, Db, LoadedSession
from app.workflow.generation import GenerateOptions, GenerateResult, generate

router = APIRouter(prefix="/sessions/{session_id}/artifacts", tags=["artifacts"])


@router.post("/{kind}/generate", response_model=GenerateResult)
def generate_artifact(
    kind: ArtifactKind,
    options: GenerateOptions,
    session: LoadedSession,
    db: Db,
    settings: AppSettings,
    scenarios: ScenariosDir,
) -> GenerateResult:
    return generate(db, session, kind, options, settings, scenarios)


@router.get("", response_model=list[ArtifactEnvelope])
def index(session: LoadedSession, db: Db) -> list[ArtifactEnvelope]:
    return artifacts.list_artifacts(db, session.id)


@router.get("/{kind}", response_model=ArtifactEnvelope)
def read(kind: ArtifactKind, session: LoadedSession, db: Db) -> ArtifactEnvelope:
    return artifacts.get_artifact(db, session.id, kind)
