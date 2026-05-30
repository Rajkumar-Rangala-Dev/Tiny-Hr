from pydantic import BaseModel
from typing import Optional


class OrgOut(BaseModel):
    id: str
    name: str
    slug: str
    registered_address: Optional[str] = None
    cin: Optional[str] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    logo_path: Optional[str] = None
    payslip_footer_text: Optional[str] = None
    watermark_opacity: float = 0.08
    working_days_per_month: int = 26

    class Config:
        from_attributes = True


class OrgUpdateRequest(BaseModel):
    name: Optional[str] = None
    registered_address: Optional[str] = None
    cin: Optional[str] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    payslip_footer_text: Optional[str] = None
    watermark_opacity: Optional[float] = None
    working_days_per_month: Optional[int] = None
