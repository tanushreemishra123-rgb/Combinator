"""Scope items (one table for all 15 types) and approved-scope snapshots."""

from typing import Any

from sqlalchemy import JSON, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.db.models.session import Session, new_uuid


class ScopeItem(Base, TimestampMixin):
    """Type discriminator in `type`; type-specific fields live in `details`."""

    __tablename__ = "scope_items"

    session_id: Mapped[str] = mapped_column(
        ForeignKey("sessions.id", ondelete="CASCADE"), primary_key=True
    )
    id: Mapped[str] = mapped_column(String(20), primary_key=True)
    type: Mapped[str] = mapped_column(String(10), index=True)
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str] = mapped_column(Text, default="")
    priority: Mapped[str] = mapped_column(String(10), default="medium")
    origin: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), default="proposed")
    source_refs: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    related_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    notes: Mapped[str] = mapped_column(Text, default="")
    absence_note: Mapped[str] = mapped_column(Text, default="")
    details: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    version: Mapped[int] = mapped_column(default=1)
    updated_by: Mapped[str] = mapped_column(String(10), default="ai")

    session: Mapped[Session] = relationship(back_populates="scope_items")


class ScopeSnapshot(Base, TimestampMixin):
    """Full item list as approved at a given scope version."""

    __tablename__ = "scope_snapshots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    session_id: Mapped[str] = mapped_column(
        ForeignKey("sessions.id", ondelete="CASCADE"), index=True
    )
    scope_version: Mapped[int] = mapped_column()
    items: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    reason: Mapped[str] = mapped_column(String(200), default="")

    session: Mapped[Session] = relationship(back_populates="snapshots")
