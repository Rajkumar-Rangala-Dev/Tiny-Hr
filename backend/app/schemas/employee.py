from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import date


class SalaryComponentIn(BaseModel):
    component_name: str
    component_type: str = "earning"
    amount: float = 0.0
    is_percentage: bool = False
    percentage_of: Optional[str] = None


class SalaryComponentOut(SalaryComponentIn):
    id: str

    class Config:
        from_attributes = True


class EmployeeCreateRequest(BaseModel):
    employee_code: str
    full_name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    designation: Optional[str] = None
    department: Optional[str] = None
    date_of_joining: Optional[date] = None
    date_of_birth: Optional[date] = None
    pan: Optional[str] = None
    uan: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_name: Optional[str] = None
    bank_ifsc: Optional[str] = None
    gross_salary: float = 0.0
    address: Optional[str] = None
    client_name: Optional[str] = None
    salary_components: Optional[List[SalaryComponentIn]] = []


class EmployeeUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    designation: Optional[str] = None
    department: Optional[str] = None
    date_of_joining: Optional[date] = None
    date_of_birth: Optional[date] = None
    pan: Optional[str] = None
    uan: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_name: Optional[str] = None
    bank_ifsc: Optional[str] = None
    gross_salary: Optional[float] = None
    address: Optional[str] = None
    client_name: Optional[str] = None
    status: Optional[str] = None


class EmployeeProfileUpdateRequest(BaseModel):
    phone: Optional[str] = None
    address: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_name: Optional[str] = None
    bank_ifsc: Optional[str] = None
    date_of_birth: Optional[date] = None


class EmployeeOut(BaseModel):
    id: str
    org_id: str
    employee_code: str
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    designation: Optional[str] = None
    department: Optional[str] = None
    date_of_joining: Optional[date] = None
    date_of_birth: Optional[date] = None
    pan: Optional[str] = None
    uan: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_name: Optional[str] = None
    bank_ifsc: Optional[str] = None
    gross_salary: float
    status: str
    address: Optional[str] = None
    client_name: Optional[str] = None
    salary_components: List[SalaryComponentOut] = []

    class Config:
        from_attributes = True


