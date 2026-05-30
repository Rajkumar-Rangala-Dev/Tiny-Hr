from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime


class LeaveTypeCreate(BaseModel):
    name: str
    code: str
    is_paid: bool = True
    default_days_per_year: float = 0.0
    is_carry_forward: bool = False


class LeaveTypeOut(LeaveTypeCreate):
    id: str
    org_id: str
    is_active: bool

    class Config:
        from_attributes = True


class LeaveBalanceOut(BaseModel):
    id: str
    employee_id: str
    leave_type_id: str
    leave_type_name: str
    leave_type_code: str
    year: int
    total_days: float
    used_days: float
    remaining_days: float

    class Config:
        from_attributes = True


class LeaveRequestCreate(BaseModel):
    employee_id: str
    leave_type_id: str
    from_date: date
    to_date: date
    reason: Optional[str] = None


class LeaveRequestOut(BaseModel):
    id: str
    org_id: str
    employee_id: str
    employee_name: str
    leave_type_id: str
    leave_type_name: str
    from_date: date
    to_date: date
    num_days: float
    reason: Optional[str] = None
    status: str
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class LeaveReviewRequest(BaseModel):
    status: str
    rejection_reason: Optional[str] = None
