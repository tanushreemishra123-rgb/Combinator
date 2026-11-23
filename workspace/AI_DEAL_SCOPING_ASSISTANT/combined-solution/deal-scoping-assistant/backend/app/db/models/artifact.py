"""Generated artifacts; only the latest version per kind per session is stored."""

from typing import Any

from sqlalchemy import JSON, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.db.models.session import Session, new_uuid


class Artifact(Base, TimestampMixin):
    __tablename__ = "artifacts"
    __table_args__ = (UniqueConstraint("session_id", "kind", name="uq_artifact_session_kind"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    session_id: Mapped[str] = mapped_column(
        ForeignKey("sessions.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column(String(40))
    version: Mapped[int] = mapped_column(default=1)
    scope_version_used: Mapped[int] = mapped_column(default=0)
    config_hash_used: Mapped[str] = mapped_column(String(64), default="")
    content: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(10), default="fresh")
    stale_reasons: Mapped[list[str]] = mapped_column(JSON, default=list)
    generated_by: Mapped[str] = mapped_column(Text, default="")

    session: Mapped[Session] = relationship(back_populates="artifacts")
