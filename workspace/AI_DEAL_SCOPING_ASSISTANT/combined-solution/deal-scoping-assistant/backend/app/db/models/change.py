"""Change records produced after the first scope approval."""

from typing import Any

from sqlalchemy import JSON, Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.db.models.session import Session, new_uuid


class ChangeRecord(Base, TimestampMixin):
    __tablename__ = "change_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    session_id: Mapped[str] = mapped_column(
        ForeignKey("sessions.id", ondelete="CASCADE"), index=True
    )
    scope_version: Mapped[int] = mapped_column(default=0)
    request: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    affected: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    affected_item_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    stale_kinds: Mapped[list[str]] = mapped_column(JSON, default=list)
    coverage_affected: Mapped[bool] = mapped_column(Boolean, default=False)
    quality_gate_affected: Mapped[bool] = mapped_column(Boolean, default=True)
    unaffected_summary: Mapped[list[str]] = mapped_column(JSON, default=list)
    suggested_actions: Mapped[list[str]] = mapped_column(JSON, default=list)
    narrative: Mapped[str] = mapped_column(Text, default="")

    session: Mapped[Session] = relationship(back_populates="changes")
