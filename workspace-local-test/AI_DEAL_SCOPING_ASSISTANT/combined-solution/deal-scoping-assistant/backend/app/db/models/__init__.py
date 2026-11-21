"""ORM models. Importing this package registers every table on the metadata."""

from app.db.models.artifact import Artifact
from app.db.models.change import ChangeRecord
from app.db.models.package import Package
from app.db.models.quality import QualityReport
from app.db.models.scope import ScopeItem, ScopeSnapshot
from app.db.models.session import Session, SourceDocument

ALL_MODELS = (
    Session,
    SourceDocument,
    ScopeItem,
    ScopeSnapshot,
    Artifact,
    ChangeRecord,
    QualityReport,
    Package,
)

__all__ = [
    "ALL_MODELS",
    "Artifact",
    "ChangeRecord",
    "Package",
    "QualityReport",
    "ScopeItem",
    "ScopeSnapshot",
    "Session",
    "SourceDocument",
]
