"""Scoping session and its source documents."""

from typing import TYPE_CHECKING, Any
from uuid import uuid4

from sqlalchemy import JSON, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:  # pragma: no cover - typing only
    from app.db.models.artifact import Artifact
    from app.db.models.change import ChangeRecord
    from app.db.models.package import Package
    from app.db.models.quality import QualityReport
    from app.db.models.scope import ScopeItem, ScopeSnapshot


def new_uuid() -> str:
    return str(uuid4())


class Session(Base, TimestampMixin):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(200))
    customer_name: Mapped[str] = mapped_column(String(200), default="")
    opportunity_context: Mapped[str] = mapped_column(Text, default="")
    cloud_platform: Mapped[str | None] = mapped_column(String(20), default=None)
    platform_mode: Mapped[str] = mapped_column(String(20), default="selected")
    config: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    scope_version: Mapped[int] = mapped_column(default=0)
    scope_status: Mapped[str] = mapped_column(String(20), default="empty")
    ai_mode: Mapped[str] = mapped_column(String(10), default="mock")
    scenario_slug: Mapped[str] = mapped_column(String(80), default="")

    documents: Mapped[list["SourceDocument"]] = relationship(
        back_populates="session", cascade="all, delete-orphan", passive_deletes=True
    )
    scope_items: Mapped[list["ScopeItem"]] = relationship(
        back_populates="session", cascade="all, delete-orphan", passive_deletes=True
    )
    snapshots: Mapped[list["ScopeSnapshot"]] = relationship(
        back_populates="session", cascade="all, delete-orphan", passive_deletes=True
    )
    artifacts: Mapped[list["Artifact"]] = relationship(
        back_populates="session", cascade="all, delete-orphan", passive_deletes=True
    )
    changes: Mapped[list["ChangeRecord"]] = relationship(
        back_populates="session", cascade="all, delete-orphan", passive_deletes=True
    )
    quality_reports: Mapped[list["QualityReport"]] = relationship(
        back_populates="session", cascade="all, delete-orphan", passive_deletes=True
    )
    packages: Mapped[list["Package"]] = relationship(
        back_populates="session", cascade="all, delete-orphan", passive_deletes=True
    )


class SourceDocument(Base, TimestampMixin):
    """`public_id` (D1, D2, ...) is what source references point at; the uuid stays internal."""

    __tablename__ = "source_documents"
    __table_args__ = (
        UniqueConstraint("session_id", "public_id", name="uq_document_session_public_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    session_id: Mapped[str] = mapped_column(
        ForeignKey("sessions.id", ondelete="CASCADE"), index=True
    )
    public_id: Mapped[str] = mapped_column(String(10), default="")
    name: Mapped[str] = mapped_column(String(255))
    kind: Mapped[str] = mapped_column(String(20))
    format: Mapped[str] = mapped_column(String(10))
    normalized_text: Mapped[str] = mapped_column(Text, default="")
    segments: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)

    session: Mapped[Session] = relationship(back_populates="documents")
