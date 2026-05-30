from pydantic import BaseModel
from typing import Optional, Dict
from datetime import datetime


class DocumentTemplateCreate(BaseModel):
    type: str
    name: str
    template_html: str
    is_default: bool = False


class DocumentTemplateOut(BaseModel):
    id: str
    org_id: str
    type: str
    name: str
    template_html: str
    is_default: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DocumentCreateRequest(BaseModel):
    employee_id: str
    template_id: Optional[str] = None
    type: str
    metadata_json: Optional[Dict] = {}


class DocumentIssueRequest(BaseModel):
    metadata_json: Optional[Dict] = {}


class DocumentOut(BaseModel):
    id: str
    org_id: str
    employee_id: str
    employee_name: str
    template_id: Optional[str] = None
    type: str
    status: str
    requested_by: Optional[str] = None
    pdf_path: Optional[str] = None
    issued_at: Optional[datetime] = None
    metadata_json: Dict
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
