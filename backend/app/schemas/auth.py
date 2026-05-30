from pydantic import BaseModel, EmailStr
from typing import Optional


class OrgRegisterRequest(BaseModel):
    org_name: str
    org_slug: str
    admin_email: EmailStr
    admin_password: str
    admin_full_name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    org_id: str
    role: str
    full_name: str
    employee_id: Optional[str] = None
    must_change_password: bool = False


class UserOut(BaseModel):
    id: str
    org_id: str
    email: str
    full_name: str
    role: str
    is_active: bool
    employee_id: Optional[str] = None
    must_change_password: bool = False

    class Config:
        from_attributes = True


class InviteUserRequest(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role: str = "hr_staff"


class EmployeeInviteRequest(BaseModel):
    employee_id: str
    email: EmailStr
    password: str  # temporary password


class EmployeeSetPasswordRequest(BaseModel):
    temp_password: str
    new_password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

