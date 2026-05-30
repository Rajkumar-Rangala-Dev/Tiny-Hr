from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import User, UserRole
from app.models.employee import Employee
from app.models.leave import LeaveType, LeaveBalance, LeaveRequest, LeaveRequestStatus
from app.models.attendance import AttendanceRecord, AttendanceStatus
from app.schemas.leave import (
    LeaveTypeCreate, LeaveTypeOut,
    LeaveBalanceOut, LeaveRequestCreate, LeaveRequestOut, LeaveReviewRequest,
)
from app.services.email_service import send_email_notification
import pandas as pd

router = APIRouter(prefix="/leaves", tags=["Leave Management"])


# ── Leave Types ──

@router.post("/types", response_model=LeaveTypeOut, status_code=201)
async def create_leave_type(
    data: LeaveTypeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.hr_admin, UserRole.super_admin)),
):
    lt = LeaveType(org_id=current_user.org_id, **data.model_dump())
    db.add(lt)
    await db.commit()
    await db.refresh(lt)
    return lt


@router.get("/types", response_model=List[LeaveTypeOut])
async def list_leave_types(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(LeaveType).where(
            and_(LeaveType.org_id == current_user.org_id, LeaveType.is_active == True)
        )
    )
    return result.scalars().all()


# ── Leave Balances ──

@router.post("/balances/initialize")
async def initialize_leave_balances(
    year: int = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.hr_admin, UserRole.super_admin)),
):
    emp_result = await db.execute(
        select(Employee).where(
            and_(Employee.org_id == current_user.org_id, Employee.status == "active")
        )
    )
    employees = emp_result.scalars().all()

    lt_result = await db.execute(
        select(LeaveType).where(
            and_(LeaveType.org_id == current_user.org_id, LeaveType.is_active == True)
        )
    )
    leave_types = lt_result.scalars().all()

    # Batch-fetch all existing balances for this year/org in one query
    emp_ids = [e.id for e in employees]
    lt_ids = [lt.id for lt in leave_types]
    existing_pairs = set()
    if emp_ids and lt_ids:
        existing_result = await db.execute(
            select(LeaveBalance.employee_id, LeaveBalance.leave_type_id).where(
                and_(
                    LeaveBalance.employee_id.in_(emp_ids),
                    LeaveBalance.leave_type_id.in_(lt_ids),
                    LeaveBalance.year == year,
                )
            )
        )
        existing_pairs = {(eid, ltid) for eid, ltid in existing_result.all()}

    created = 0
    for emp in employees:
        for lt in leave_types:
            if (emp.id, lt.id) in existing_pairs:
                continue
            db.add(LeaveBalance(
                employee_id=emp.id,
                leave_type_id=lt.id,
                year=year,
                total_days=float(lt.default_days_per_year),
                used_days=0.0,
                remaining_days=float(lt.default_days_per_year),
            ))
            created += 1

    await db.commit()
    return {"initialized": created, "year": year}


@router.get("/balances/{employee_id}", response_model=List[LeaveBalanceOut])
async def get_employee_leave_balances(
    employee_id: str,
    year: int = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.employee and current_user.employee_id != employee_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You can only view your own leave balances."
        )

    result = await db.execute(
        select(LeaveBalance, LeaveType).join(
            LeaveType, LeaveBalance.leave_type_id == LeaveType.id
        ).where(
            and_(
                LeaveBalance.employee_id == employee_id,
                LeaveBalance.year == year,
            )
        )
    )
    rows = result.all()
    out = []
    for balance, lt in rows:
        out.append(LeaveBalanceOut(
            id=balance.id,
            employee_id=balance.employee_id,
            leave_type_id=balance.leave_type_id,
            leave_type_name=lt.name,
            leave_type_code=lt.code,
            year=balance.year,
            total_days=float(balance.total_days),
            used_days=float(balance.used_days),
            remaining_days=float(balance.remaining_days),
        ))
    return out


# ── Leave Requests ──

@router.patch("/balances/{balance_id}")
async def update_leave_balance(
    balance_id: str,
    total_days: Optional[float] = Query(None),
    adjustment: Optional[float] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.hr_admin, UserRole.super_admin)),
):
    result = await db.execute(select(LeaveBalance).where(LeaveBalance.id == balance_id))
    balance = result.scalar_one_or_none()
    if not balance:
        raise HTTPException(status_code=404, detail="Leave balance not found")

    if total_days is not None:
        balance.total_days = total_days
        balance.remaining_days = total_days - float(balance.used_days)
    elif adjustment is not None:
        balance.remaining_days = float(balance.remaining_days) + adjustment
        balance.total_days = float(balance.used_days) + float(balance.remaining_days)

    await db.commit()
    await db.refresh(balance)
    return {"id": balance.id, "total_days": float(balance.total_days), "used_days": float(balance.used_days), "remaining_days": float(balance.remaining_days)}


@router.post("/requests", response_model=LeaveRequestOut, status_code=201)
async def create_leave_request(
    data: LeaveRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.hr_admin, UserRole.super_admin, UserRole.hr_staff)),
):
    emp_result = await db.execute(
        select(Employee).where(
            and_(Employee.id == data.employee_id, Employee.org_id == current_user.org_id)
        )
    )
    emp = emp_result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    lt_result = await db.execute(select(LeaveType).where(LeaveType.id == data.leave_type_id))
    lt = lt_result.scalar_one_or_none()
    if not lt:
        raise HTTPException(status_code=404, detail="Leave type not found")

    num_days = float((data.to_date - data.from_date).days + 1)

    balance_result = await db.execute(
        select(LeaveBalance).where(
            and_(
                LeaveBalance.employee_id == data.employee_id,
                LeaveBalance.leave_type_id == data.leave_type_id,
                LeaveBalance.year == data.from_date.year,
            )
        )
    )
    balance = balance_result.scalar_one_or_none()
    if balance and float(balance.remaining_days) < num_days:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient leave balance. Available: {balance.remaining_days} days",
        )

    req = LeaveRequest(
        org_id=current_user.org_id,
        employee_id=data.employee_id,
        leave_type_id=data.leave_type_id,
        from_date=data.from_date,
        to_date=data.to_date,
        num_days=num_days,
        reason=data.reason,
    )
    db.add(req)
    await db.commit()
    await db.refresh(req)

    return LeaveRequestOut(
        id=req.id,
        org_id=req.org_id,
        employee_id=req.employee_id,
        employee_name=emp.full_name,
        leave_type_id=req.leave_type_id,
        leave_type_name=lt.name,
        from_date=req.from_date,
        to_date=req.to_date,
        num_days=float(req.num_days),
        reason=req.reason,
        status=req.status,
        reviewed_by=req.reviewed_by,
        reviewed_at=req.reviewed_at,
        rejection_reason=req.rejection_reason,
        created_at=req.created_at,
    )


@router.get("/requests", response_model=List[LeaveRequestOut])
async def list_leave_requests(
    status: Optional[str] = Query(None),
    employee_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.hr_admin, UserRole.super_admin, UserRole.hr_staff)),
):
    query = select(LeaveRequest, Employee, LeaveType).join(
        Employee, LeaveRequest.employee_id == Employee.id
    ).join(
        LeaveType, LeaveRequest.leave_type_id == LeaveType.id
    ).where(LeaveRequest.org_id == current_user.org_id)

    if status and status != "all":
        query = query.where(LeaveRequest.status == status)
    if employee_id:
        query = query.where(LeaveRequest.employee_id == employee_id)

    result = await db.execute(query.order_by(LeaveRequest.created_at.desc()))
    rows = result.all()

    return [
        LeaveRequestOut(
            id=req.id, org_id=req.org_id, employee_id=req.employee_id,
            employee_name=emp.full_name, leave_type_id=req.leave_type_id,
            leave_type_name=lt.name, from_date=req.from_date, to_date=req.to_date,
            num_days=float(req.num_days), reason=req.reason, status=req.status,
            reviewed_by=req.reviewed_by, reviewed_at=req.reviewed_at,
            rejection_reason=req.rejection_reason, created_at=req.created_at,
        )
        for req, emp, lt in rows
    ]


@router.post("/requests/{request_id}/review", response_model=LeaveRequestOut)
async def review_leave_request(
    request_id: str,
    data: LeaveReviewRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.hr_admin, UserRole.super_admin, UserRole.hr_staff)),
):
    req_result = await db.execute(
        select(LeaveRequest).where(
            and_(LeaveRequest.id == request_id, LeaveRequest.org_id == current_user.org_id)
        )
    )
    req = req_result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Leave request not found")
    if req.status != LeaveRequestStatus.pending:
        raise HTTPException(status_code=400, detail="Only pending requests can be reviewed")

    new_status = LeaveRequestStatus(data.status)
    req.status = new_status
    req.reviewed_by = current_user.id
    req.reviewed_at = datetime.now(timezone.utc)
    req.rejection_reason = data.rejection_reason

    if new_status == LeaveRequestStatus.approved:
        # Update leave balance
        balance_result = await db.execute(
            select(LeaveBalance).where(
                and_(
                    LeaveBalance.employee_id == req.employee_id,
                    LeaveBalance.leave_type_id == req.leave_type_id,
                    LeaveBalance.year == req.from_date.year,
                )
            )
        )
        balance = balance_result.scalar_one_or_none()
        if balance:
            balance.used_days = float(balance.used_days) + float(req.num_days)
            balance.remaining_days = float(balance.total_days) - float(balance.used_days)

        # Mark attendance as on_leave for each day in range
        current_date = req.from_date
        while current_date <= req.to_date:
            existing_att = await db.execute(
                select(AttendanceRecord).where(
                    and_(
                        AttendanceRecord.employee_id == req.employee_id,
                        AttendanceRecord.date == current_date,
                    )
                )
            )
            att = existing_att.scalar_one_or_none()
            if att:
                att.status = AttendanceStatus.on_leave
                att.remarks = f"Leave: {req.id}"
            else:
                db.add(AttendanceRecord(
                    org_id=req.org_id,
                    employee_id=req.employee_id,
                    date=current_date,
                    status=AttendanceStatus.on_leave,
                    source="leave",
                    remarks=f"Leave: {req.id}",
                ))
            from datetime import timedelta
            current_date = current_date + timedelta(days=1)

    await db.commit()
    await db.refresh(req)

    emp_result = await db.execute(select(Employee).where(Employee.id == req.employee_id))
    emp = emp_result.scalar_one()
    lt_result = await db.execute(select(LeaveType).where(LeaveType.id == req.leave_type_id))
    lt = lt_result.scalar_one()

    # Trigger Leave Request Status Email Notification
    if emp.email:
        status_label = req.status.value.upper()
        decision_details = ""
        if req.status == LeaveRequestStatus.rejected and req.rejection_reason:
            decision_details = f"<p><strong>Reason for Rejection:</strong> {req.rejection_reason}</p>"

        email_body = f"""
        <h2>Leave Application Status Update</h2>
        <p>Dear {emp.full_name},</p>
        <p>Your leave application has been reviewed and marked as <strong>{status_label}</strong>.</p>
        <ul>
            <li><strong>Leave Type:</strong> {lt.name}</li>
            <li><strong>Duration:</strong> {format(req.from_date, "%d %B, %Y")} to {format(req.to_date, "%d %B, %Y")} ({req.num_days} days)</li>
            <li><strong>Reason for Application:</strong> {req.reason}</li>
        </ul>
        {decision_details}
        <p>You can check your updated balances and history on your self-service dashboard.</p>
        <br/>
        <p>Best regards,<br/>HR Operations Team</p>
        """
        send_email_notification(
            to_email=emp.email,
            subject=f"Update: Leave Application {status_label}",
            html_body=email_body
        )

    return LeaveRequestOut(
        id=req.id, org_id=req.org_id, employee_id=req.employee_id,
        employee_name=emp.full_name, leave_type_id=req.leave_type_id,
        leave_type_name=lt.name, from_date=req.from_date, to_date=req.to_date,
        num_days=float(req.num_days), reason=req.reason, status=req.status,
        reviewed_by=req.reviewed_by, reviewed_at=req.reviewed_at,
        rejection_reason=req.rejection_reason, created_at=req.created_at,
    )
