from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token, get_current_user, decode_token
from app.models.org import Organization
from app.models.user import User, UserRole
from app.models.employee import Employee
from app.schemas.auth import (
    OrgRegisterRequest, LoginRequest, TokenResponse, UserOut, InviteUserRequest,
    EmployeeInviteRequest, EmployeeSetPasswordRequest, ForgotPasswordRequest,
    ResetPasswordRequest
)
from app.services.email_service import send_email_notification
from slowapi import Limiter
from slowapi.util import get_remote_address
import re
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Auth"])
limiter = Limiter(key_func=get_remote_address)


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9-]", "-", text.lower().strip()).strip("-")


@router.post("/register", response_model=TokenResponse, status_code=201)
@limiter.limit("3/hour")
async def register_org(request: Request, data: OrgRegisterRequest, db: AsyncSession = Depends(get_db)):
    slug = slugify(data.org_slug)
    existing_slug = await db.execute(select(Organization).where(Organization.slug == slug))
    if existing_slug.scalar_one_or_none():
        logger.warning(f"Registration attempt with duplicate slug: {slug}")
        raise HTTPException(status_code=400, detail="Organisation slug already taken")

    existing_email = await db.execute(select(User).where(User.email == data.admin_email))
    if existing_email.scalar_one_or_none():
        logger.warning(f"Registration attempt with duplicate email: {data.admin_email}")
        raise HTTPException(status_code=400, detail="Email already registered")

    org = Organization(name=data.org_name, slug=slug)
    db.add(org)
    await db.flush()

    user = User(
        org_id=org.id,
        email=data.admin_email,
        hashed_password=get_password_hash(data.admin_password),
        full_name=data.admin_full_name,
        role=UserRole.hr_admin,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token({
        "sub": user.id,
        "org_id": org.id,
        "role": user.role,
        "employee_id": user.employee_id,
        "must_change_password": user.must_change_password
    })
    
    logger.info(f"New organization registered: {org.id} (slug: {slug}, admin: {user.id})")
    
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        org_id=org.id,
        role=user.role,
        full_name=user.full_name,
        employee_id=user.employee_id,
        must_change_password=user.must_change_password,
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(request: Request, data: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.hashed_password):
        logger.warning(f"Failed login attempt for email: {data.email}")
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        logger.warning(f"Inactive user login attempt: {user.id} ({data.email})")
        raise HTTPException(status_code=403, detail="Account is inactive")

    token = create_access_token({
        "sub": user.id,
        "org_id": user.org_id,
        "role": user.role,
        "employee_id": user.employee_id,
        "must_change_password": user.must_change_password
    })
    
    logger.info(f"Successful login for user: {user.id} (email: {data.email}, org: {user.org_id})")
    
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        org_id=user.org_id,
        role=user.role,
        full_name=user.full_name,
        employee_id=user.employee_id,
        must_change_password=user.must_change_password,
    )


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(current_user: User = Depends(get_current_user)):
    """Refresh access token using current valid token"""
    token = create_access_token({
        "sub": current_user.id,
        "org_id": current_user.org_id,
        "role": current_user.role,
        "employee_id": current_user.employee_id,
        "must_change_password": current_user.must_change_password
    })
    return TokenResponse(
        access_token=token,
        user_id=current_user.id,
        org_id=current_user.org_id,
        role=current_user.role,
        full_name=current_user.full_name,
        employee_id=current_user.employee_id,
        must_change_password=current_user.must_change_password,
    )


@router.post("/invite", response_model=UserOut, status_code=201)
async def invite_user(
    data: InviteUserRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in (UserRole.hr_admin, UserRole.super_admin):
        raise HTTPException(status_code=403, detail="Only admins can invite users")

    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        org_id=current_user.org_id,
        email=data.email,
        hashed_password=get_password_hash(data.password),
        full_name=data.full_name,
        role=UserRole(data.role),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/employee/invite", response_model=UserOut, status_code=201)
async def invite_employee(
    data: EmployeeInviteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in (UserRole.hr_admin, UserRole.super_admin):
        raise HTTPException(status_code=403, detail="Only admins can invite employees")

    # Verify employee exists and belongs to the same org
    emp_result = await db.execute(
        select(Employee).where(Employee.id == data.employee_id, Employee.org_id == current_user.org_id)
    )
    employee = emp_result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Verify email is not already registered as a User
    existing_user = await db.execute(select(User).where(User.email == data.email))
    if existing_user.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered as a portal user")

    # Create employee user
    user = User(
        org_id=current_user.org_id,
        employee_id=data.employee_id,
        email=data.email,
        hashed_password=get_password_hash(data.password),
        full_name=employee.full_name,
        role=UserRole.employee,
        must_change_password=True,
    )
    db.add(user)
    
    # Update employee's email if not set
    if not employee.email:
        employee.email = data.email

    await db.commit()
    await db.refresh(user)

    # Send Portal Invitation Email
    from app.core.config import get_settings
    settings = get_settings()
    
    email_body = f"""
    <h2>Welcome to Tiny HR Portal, {employee.full_name}!</h2>
    <p>Your HR Administrator has created your employee self-service portal account.</p>
    <p>Please use the following credentials to log in and set up your account:</p>
    <ul>
        <li><strong>Portal URL:</strong> <a href="{settings.FRONTEND_URL}/login">{settings.FRONTEND_URL}/login</a></li>
        <li><strong>Username (Email):</strong> {data.email}</li>
        <li><strong>Temporary Password:</strong> {data.password}</li>
    </ul>
    <p>Upon your first login, you will be prompted to set up a secure personal password.</p>
    <br/>
    <p>Best regards,<br/>HR Operations Team</p>
    """
    send_email_notification(
        to_email=data.email,
        subject="Your Tiny HR Portal Account Invitation",
        html_body=email_body
    )

    return user


@router.post("/employee/set-password")
async def employee_set_password(
    data: EmployeeSetPasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.employee:
        raise HTTPException(status_code=403, detail="Only employees can use this endpoint")

    if not verify_password(data.temp_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid temporary password")

    current_user.hashed_password = get_password_hash(data.new_password)
    current_user.must_change_password = False
    await db.commit()
    return {"message": "Password updated successfully"}


@router.post("/forgot-password")
@limiter.limit("3/hour")
async def forgot_password(request: Request, data: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    from datetime import timedelta
    from app.core.config import get_settings
    
    settings = get_settings()
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    
    # Secure: do not leak whether email exists. Always return same response.
    if user:
        token = create_access_token(
            {"sub": user.id, "purpose": "password_reset"},
            expires_delta=timedelta(minutes=15)
        )
        reset_link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
        email_body = f"""
        <h2>Password Reset Request</h2>
        <p>Hello {user.full_name},</p>
        <p>You requested a password reset for your Tiny HR account.</p>
        <p>Please click the link below to reset your password. This link is valid for 15 minutes:</p>
        <p><a href="{reset_link}">{reset_link}</a></p>
        <br/>
        <p>If you did not request this reset, please ignore this email.</p>
        <br/>
        <p>Best regards,<br/>HR Support Team</p>
        """
        send_email_notification(
            to_email=user.email,
            subject="Tiny HR — Password Reset Request",
            html_body=email_body
        )
        
    return {"message": "If this email is registered, a password reset link has been sent."}


@router.post("/reset-password")
async def reset_password(data: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    try:
        payload = decode_token(data.token)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
        
    purpose = payload.get("purpose")
    if purpose != "password_reset":
        raise HTTPException(status_code=400, detail="Invalid token purpose")
        
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid token payload")
        
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.hashed_password = get_password_hash(data.new_password)
    user.must_change_password = False
    await db.commit()
    return {"message": "Password has been successfully updated."}
