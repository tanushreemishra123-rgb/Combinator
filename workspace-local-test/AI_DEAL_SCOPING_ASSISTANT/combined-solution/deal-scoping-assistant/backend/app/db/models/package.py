"""The last built scoping package, stored as its renderer-neutral document model."""

from typing import Any

from sqlalchemy import JSON, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.db.models.session import Session, new_uuid


class Package(Base, TimestampMixin):
    __tablename__ = "packages"
    __table_args__ = (UniqueConstraint("session_id", name="uq_package_session"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    session_id: Mapped[str] = mapped_column(
        ForeignKey("sessions.id", ondelete="CASCADE"), index=True
    )
    scope_version: Mapped[int] = mapped_column(default=0)
    # See artifacts.service.state_fingerprint: identifies the state this was built from.
    fingerprint: Mapped[str] = mapped_column(String(512), default="")
    document: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    session: Mapped[Session] = relationship(back_populates="packages")
