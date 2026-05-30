import uuid
from datetime import datetime, date, timezone
from sqlalchemy import String, Text, DateTime, Boolean, ForeignKey, Date, Numeric, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum
from app.core.database import Base


class EmployeeStatus(str, enum.Enum):
    active = "active"
    on_notice = "on_notice"
    archived = "archived"


class Employee(Base):
    __tablename__ = "employees"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), nullable=False)
    employee_code: Mapped[str] = mapped_column(String(50), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(20))
    designation: Mapped[str | None] = mapped_column(String(100))
    department: Mapped[str | None] = mapped_column(String(100))
    date_of_joining: Mapped[date | None] = mapped_column(Date)
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    pan: Mapped[str | None] = mapped_column(String(10))
    uan: Mapped[str | None] = mapped_column(String(20))
    bank_account_number: Mapped[str | None] = mapped_column(String(50))
    bank_name: Mapped[str | None] = mapped_column(String(100))
    bank_ifsc: Mapped[str | None] = mapped_column(String(20))
    gross_salary: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    status: Mapped[EmployeeStatus] = mapped_column(SAEnum(EmployeeStatus), default=EmployeeStatus.active)
    address: Mapped[str | None] = mapped_column(Text)
    client_name: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    org: Mapped["Organization"] = relationship("Organization", back_populates="employees")
    salary_components: Mapped[list["SalaryComponent"]] = relationship("SalaryComponent", back_populates="employee", cascade="all, delete-orphan")
    attendance_records: Mapped[list["AttendanceRecord"]] = relationship("AttendanceRecord", back_populates="employee", cascade="all, delete-orphan")
    leave_requests: Mapped[list["LeaveRequest"]] = relationship("LeaveRequest", back_populates="employee", cascade="all, delete-orphan")
    payslips: Mapped[list["PayslipRecord"]] = relationship("PayslipRecord", back_populates="employee", cascade="all, delete-orphan")


class SalaryComponent(Base):
    __tablename__ = "salary_components"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    employee_id: Mapped[str] = mapped_column(String(36), ForeignKey("employees.id"), nullable=False)
    component_name: Mapped[str] = mapped_column(String(100), nullable=False)
    component_type: Mapped[str] = mapped_column(String(20), default="earning")
    amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    is_percentage: Mapped[bool] = mapped_column(Boolean, default=False)
    percentage_of: Mapped[str | None] = mapped_column(String(50))

    employee: Mapped["Employee"] = relationship("Employee", back_populates="salary_components")
