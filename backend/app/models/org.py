import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, Boolean, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    registered_address: Mapped[str | None] = mapped_column(Text)
    cin: Mapped[str | None] = mapped_column(String(50))
    gstin: Mapped[str | None] = mapped_column(String(20))
    pan: Mapped[str | None] = mapped_column(String(10))
    logo_path: Mapped[str | None] = mapped_column(Text)
    payslip_footer_text: Mapped[str | None] = mapped_column(Text, default="This is a system-generated payslip and does not require a signature.")
    watermark_opacity: Mapped[float] = mapped_column(Float, default=0.08)
    working_days_per_month: Mapped[int] = mapped_column(default=26)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    users: Mapped[list["User"]] = relationship("User", back_populates="org")
    employees: Mapped[list["Employee"]] = relationship("Employee", back_populates="org")
    leave_types: Mapped[list["LeaveType"]] = relationship("LeaveType", back_populates="org")
    payroll_runs: Mapped[list["PayrollRun"]] = relationship("PayrollRun", back_populates="org")
