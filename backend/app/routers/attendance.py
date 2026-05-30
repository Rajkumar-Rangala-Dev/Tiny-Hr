from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import User, UserRole
from app.models.attendance import AttendanceRecord, AttendanceStatus
from app.models.employee import Employee
from app.schemas.attendance import (
    AttendanceRecordIn, AttendanceRecordOut,
    CSVUploadPreviewResponse, AttendanceSummary,
)
from app.services.attendance_service import parse_csv_preview, commit_csv_attendance

router = APIRouter(prefix="/attendance", tags=["Attendance"])


@router.post("/upload/preview", response_model=CSVUploadPreviewResponse)
async def preview_csv_upload(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.hr_admin, UserRole.super_admin, UserRole.hr_staff)),
):
    content = await file.read()
    return await parse_csv_preview(content, current_user.org_id, db)


@router.post("/upload/commit")
async def commit_csv_upload(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.hr_admin, UserRole.super_admin, UserRole.hr_staff)),
):
    content = await file.read()
    preview = await parse_csv_preview(content, current_user.org_id, db)
    if preview.errors > 0:
        raise HTTPException(
            status_code=422,
            detail=f"{preview.errors} error(s) in CSV. Fix them and try again.",
        )
    count = await commit_csv_attendance(preview.preview, current_user.org_id, db)
    return {"committed": count, "message": f"Successfully committed {count} attendance records"}


@router.post("/manual", response_model=AttendanceRecordOut, status_code=201)
async def mark_attendance_manual(
    data: AttendanceRecordIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.hr_admin, UserRole.super_admin, UserRole.hr_staff)),
):
    emp_result = await db.execute(
        select(Employee).where(
            and_(Employee.id == data.employee_id, Employee.org_id == current_user.org_id)
        )
    )
    if not emp_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Employee not found in your org")

    existing = await db.execute(
        select(AttendanceRecord).where(
            and_(
                AttendanceRecord.employee_id == data.employee_id,
                AttendanceRecord.date == data.date,
            )
        )
    )
    record = existing.scalar_one_or_none()
    if record:
        record.status = AttendanceStatus(data.status)
        record.check_in = data.check_in
        record.check_out = data.check_out
        record.remarks = data.remarks
        record.source = "manual"
    else:
        record = AttendanceRecord(
            org_id=current_user.org_id,
            employee_id=data.employee_id,
            date=data.date,
            status=AttendanceStatus(data.status),
            check_in=data.check_in,
            check_out=data.check_out,
            remarks=data.remarks,
            source="manual",
        )
        db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


@router.get("/employee/{employee_id}", response_model=List[AttendanceRecordOut])
async def get_employee_attendance(
    employee_id: str,
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.employee and current_user.employee_id != employee_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You can only view your own attendance records."
        )

    query = select(AttendanceRecord).where(
        and_(
            AttendanceRecord.employee_id == employee_id,
            AttendanceRecord.org_id == current_user.org_id,
        )
    )
    if month:
        query = query.where(func.extract("month", AttendanceRecord.date) == month)
    if year:
        query = query.where(func.extract("year", AttendanceRecord.date) == year)
    result = await db.execute(query.order_by(AttendanceRecord.date))
    return result.scalars().all()


@router.get("/summary", response_model=List[AttendanceSummary])
async def attendance_summary(
    month: int = Query(...),
    year: int = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.hr_admin, UserRole.super_admin, UserRole.hr_staff)),
):
    emp_result = await db.execute(
        select(Employee).where(
            and_(Employee.org_id == current_user.org_id, Employee.status == "active")
        )
    )
    employees = emp_result.scalars().all()

    summaries = []
    for emp in employees:
        att_result = await db.execute(
            select(AttendanceRecord).where(
                and_(
                    AttendanceRecord.employee_id == emp.id,
                    func.extract("month", AttendanceRecord.date) == month,
                    func.extract("year", AttendanceRecord.date) == year,
                )
            )
        )
        records = att_result.scalars().all()
        counts = {s.value: 0 for s in AttendanceStatus}
        for r in records:
            counts[r.status.value] += 1

        summaries.append(
            AttendanceSummary(
                employee_id=emp.id,
                employee_code=emp.employee_code,
                full_name=emp.full_name,
                month=month,
                year=year,
                working_days=len(records),
                present=counts["present"],
                absent=counts["absent"],
                half_day=counts["half_day"],
                work_from_home=counts["work_from_home"],
                on_leave=counts["on_leave"],
                holiday=counts["holiday"],
                week_off=counts["week_off"],
            )
        )
    return summaries
