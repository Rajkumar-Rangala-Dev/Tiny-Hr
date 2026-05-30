from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date


class OnboardingTemplateCreate(BaseModel):
    task_name: str
    assigned_to: str  # "employee" or "hr"
    due_days_after_joining: int = 7


class OnboardingTemplateOut(BaseModel):
    id: str
    org_id: str
    task_name: str
    assigned_to: str
    due_days_after_joining: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OnboardingTaskCreate(BaseModel):
    employee_id: str
    task_name: str
    assigned_to: str = "employee"
    due_date: Optional[date] = None


class OnboardingTaskUpdate(BaseModel):
    status: str  # "pending", "done", "skipped"


class OnboardingTaskOut(BaseModel):
    id: str
    org_id: str
    employee_id: str
    employee_name: str
    task_name: str
    assigned_to: str
    status: str
    due_date: Optional[date] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
