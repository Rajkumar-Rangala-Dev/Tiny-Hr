import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Numeric, Boolean, Text, Integer, Enum as SAEnum, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum
from app.core.database import Base


class PayrollStatus(str, enum.Enum):
    draft = "draft"
    processed = "processed"
    locked = "locked"


class PayrollRun(Base):
    __tablename__ = "payroll_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[PayrollStatus] = mapped_column(SAEnum(PayrollStatus), default=PayrollStatus.draft)
    total_gross: Mapped[float] = mapped_column(Numeric(14, 2), default=0.0)
    total_deductions: Mapped[float] = mapped_column(Numeric(14, 2), default=0.0)
    total_net: Mapped[float] = mapped_column(Numeric(14, 2), default=0.0)
    processed_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"))
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    org: Mapped["Organization"] = relationship("Organization", back_populates="payroll_runs")
    payslips: Mapped[list["PayslipRecord"]] = relationship("PayslipRecord", back_populates="payroll_run", cascade="all, delete-orphan")


class PayslipRecord(Base):
    __tablename__ = "payslip_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    payroll_run_id: Mapped[str] = mapped_column(String(36), ForeignKey("payroll_runs.id"), nullable=False)
    org_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), nullable=False)
    employee_id: Mapped[str] = mapped_column(String(36), ForeignKey("employees.id"), nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    working_days: Mapped[int] = mapped_column(Integer, default=26)
    days_present: Mapped[float] = mapped_column(Numeric(5, 1), default=0.0)
    days_absent: Mapped[float] = mapped_column(Numeric(5, 1), default=0.0)
    lop_days: Mapped[float] = mapped_column(Numeric(5, 1), default=0.0)
    leaves_taken: Mapped[float] = mapped_column(Numeric(5, 1), default=0.0)
    gross_earnings: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    total_deductions: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    net_pay: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    earnings_breakdown: Mapped[dict] = mapped_column(JSON, default=dict)
    deductions_breakdown: Mapped[dict] = mapped_column(JSON, default=dict)
    ytd_earnings: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    ytd_deductions: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    pdf_path: Mapped[str | None] = mapped_column(Text)
    is_pdf_generated: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    payroll_run: Mapped["PayrollRun"] = relationship("PayrollRun", back_populates="payslips")
    employee: Mapped["Employee"] = relationship("Employee", back_populates="payslips")
