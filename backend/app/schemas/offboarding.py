from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime


class OffboardingCaseCreate(BaseModel):
    employee_id: str
    resignation_date: date
    last_working_day: date
    reason: Optional[str] = None
    final_settlement_amount: Optional[float] = 0.0


class OffboardingTaskUpdate(BaseModel):
    status: str  # "pending", "done"


class OffboardingTaskOut(BaseModel):
    id: str
    offboarding_case_id: str
    task_name: str
    status: str
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OffboardingCaseOut(BaseModel):
    id: str
    org_id: str
    employee_id: str
    employee_name: str
    employee_code: str
    resignation_date: date
    last_working_day: date
    reason: Optional[str] = None
    status: str
    final_settlement_amount: float
    created_at: datetime
    updated_at: datetime
    tasks: List[OffboardingTaskOut] = []

    class Config:
        from_attributes = True
