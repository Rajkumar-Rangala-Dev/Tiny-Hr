from pydantic import BaseModel
from typing import Optional, List
from datetime import date


class AttendanceRecordIn(BaseModel):
    employee_id: str
    date: date
    status: str
    check_in: Optional[str] = None
    check_out: Optional[str] = None
    remarks: Optional[str] = None


class AttendanceRecordOut(BaseModel):
    id: str
    org_id: str
    employee_id: str
    date: date
    status: str
    check_in: Optional[str] = None
    check_out: Optional[str] = None
    remarks: Optional[str] = None
    source: str

    class Config:
        from_attributes = True


class AttendanceBulkUpsertRequest(BaseModel):
    records: List[AttendanceRecordIn]


class CSVUploadPreviewRow(BaseModel):
    employee_id: str
    employee_code: str
    employee_name: str
    date: date
    status: str
    action: str
    warning: Optional[str] = None


class CSVUploadPreviewResponse(BaseModel):
    total_rows: int
    valid_rows: int
    warnings: int
    errors: int
    preview: List[CSVUploadPreviewRow]
    error_details: List[str] = []


class AttendanceSummary(BaseModel):
    employee_id: str
    employee_code: str
    full_name: str
    month: int
    year: int
    working_days: int
    present: int
    absent: int
    half_day: int
    work_from_home: int
    on_leave: int
    holiday: int
    week_off: int
