import uuid
from datetime import datetime, date, timezone
from sqlalchemy import String, DateTime, ForeignKey, Date, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class OffboardingCase(Base):
    __tablename__ = "offboarding_cases"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), nullable=False)
    employee_id: Mapped[str] = mapped_column(String(36), ForeignKey("employees.id"), nullable=False)
    resignation_date: Mapped[date] = mapped_column(Date, nullable=False)
    last_working_day: Mapped[date] = mapped_column(Date, nullable=False)
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="initiated")  # "initiated", "clearance_pending", "completed"
    final_settlement_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    org: Mapped["Organization"] = relationship("Organization")
    employee: Mapped["Employee"] = relationship("Employee")
    tasks: Mapped[list["OffboardingTask"]] = relationship("OffboardingTask", back_populates="case", cascade="all, delete-orphan")


class OffboardingTask(Base):
    __tablename__ = "offboarding_tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), nullable=False)
    offboarding_case_id: Mapped[str] = mapped_column(String(36), ForeignKey("offboarding_cases.id"), nullable=False)
    task_name: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # "pending", "done"
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    case: Mapped["OffboardingCase"] = relationship("OffboardingCase", back_populates="tasks")
