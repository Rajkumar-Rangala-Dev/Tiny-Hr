from pydantic import BaseModel
from typing import Optional, Dict, List
from datetime import datetime


class PayrollRunCreate(BaseModel):
    month: int
    year: int


class PayslipOut(BaseModel):
    id: str
    payroll_run_id: str
    org_id: str
    employee_id: str
    employee_name: str
    employee_code: str
    designation: Optional[str] = None
    department: Optional[str] = None
    month: int
    year: int
    working_days: int
    days_present: float
    days_absent: float
    lop_days: float
    leaves_taken: float
    gross_earnings: float
    total_deductions: float
    net_pay: float
    earnings_breakdown: Dict
    deductions_breakdown: Dict
    ytd_earnings: float
    ytd_deductions: float
    pdf_path: Optional[str] = None
    is_pdf_generated: bool

    class Config:
        from_attributes = True


class PayrollRunOut(BaseModel):
    id: str
    org_id: str
    month: int
    year: int
    status: str
    total_gross: float
    total_deductions: float
    total_net: float
    processed_at: Optional[datetime] = None
    payslips: List[PayslipOut] = []

    class Config:
        from_attributes = True
