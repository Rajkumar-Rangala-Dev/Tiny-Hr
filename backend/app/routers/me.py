from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List, Optional
from datetime import date

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, UserRole
from app.models.employee import Employee, SalaryComponent
from app.models.attendance import AttendanceRecord
from app.models.leave import LeaveBalance, LeaveRequest, LeaveType
from app.models.payroll import PayslipRecord, PayrollRun
from app.models.document import Document, DocumentTemplate, DocumentStatus, DocumentType
from app.schemas.employee import EmployeeOut, EmployeeProfileUpdateRequest
from app.schemas.attendance import AttendanceRecordOut
from app.schemas.leave import LeaveBalanceOut, LeaveRequestOut, LeaveRequestCreate
from app.schemas.payroll import PayslipOut
from app.schemas.document import DocumentOut, DocumentCreateRequest

router = APIRouter(prefix="/me", tags=["Employee Self-Service"])


def verify_employee(current_user: User):
    if not current_user.employee_id:
        raise HTTPException(status_code=400, detail="This user account is not linked to any Employee record")
    return current_user.employee_id


@router.get("/profile", response_model=EmployeeOut)
async def get_my_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    emp_id = verify_employee(current_user)
    result = await db.execute(
        select(Employee).where(
            and_(Employee.id == emp_id, Employee.org_id == current_user.org_id)
        )
    )
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee details not found")
    return employee


@router.patch("/profile", response_model=EmployeeOut)
async def update_my_profile(
    data: EmployeeProfileUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    emp_id = verify_employee(current_user)
    result = await db.execute(
        select(Employee).where(
            and_(Employee.id == emp_id, Employee.org_id == current_user.org_id)
        )
    )
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    update_dict = data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(employee, field, value)

    await db.commit()
    await db.refresh(employee)
    return employee


@router.get("/attendance", response_model=List[AttendanceRecordOut])
async def get_my_attendance(
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    emp_id = verify_employee(current_user)
    query = select(AttendanceRecord).where(
        and_(
            AttendanceRecord.employee_id == emp_id,
            AttendanceRecord.org_id == current_user.org_id,
        )
    )

    if month and year:
        # Cast functionally to avoid float vs int comparison issues in postgres
        from sqlalchemy import extract, Integer
        query = query.where(
            and_(
                extract("month", AttendanceRecord.date).cast(Integer) == month,
                extract("year", AttendanceRecord.date).cast(Integer) == year,
            )
        )

    result = await db.execute(query.order_by(AttendanceRecord.date.desc()))
    return result.scalars().all()


@router.get("/leaves/balances", response_model=List[LeaveBalanceOut])
async def get_my_leave_balances(
    year: int = Query(..., description="The calendar year to get balances for"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    emp_id = verify_employee(current_user)
    result = await db.execute(
        select(LeaveBalance, LeaveType).join(
            LeaveType, LeaveBalance.leave_type_id == LeaveType.id
        ).where(
            and_(
                LeaveBalance.employee_id == emp_id,
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


@router.get("/leaves/requests", response_model=List[LeaveRequestOut])
async def get_my_leave_requests(
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    emp_id = verify_employee(current_user)
    query = select(LeaveRequest, Employee, LeaveType).join(
        Employee, LeaveRequest.employee_id == Employee.id
    ).join(
        LeaveType, LeaveRequest.leave_type_id == LeaveType.id
    ).where(
        and_(
            LeaveRequest.employee_id == emp_id,
            LeaveRequest.org_id == current_user.org_id,
        )
    )

    if status and status != "all":
        query = query.where(LeaveRequest.status == status)

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


@router.post("/leaves/requests", response_model=LeaveRequestOut, status_code=201)
async def apply_leave(
    data: LeaveRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    emp_id = verify_employee(current_user)
    if data.employee_id != emp_id:
        raise HTTPException(status_code=403, detail="You can only apply for leave on your own behalf")

    # Reuse the logic of creating leave requests but scoped to self
    # Verify leave type exists
    lt_result = await db.execute(select(LeaveType).where(LeaveType.id == data.leave_type_id))
    lt = lt_result.scalar_one_or_none()
    if not lt:
        raise HTTPException(status_code=404, detail="Leave type not found")

    num_days = float((data.to_date - data.from_date).days + 1)

    # Check leave balance
    balance_result = await db.execute(
        select(LeaveBalance).where(
            and_(
                LeaveBalance.employee_id == emp_id,
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
        employee_id=emp_id,
        leave_type_id=data.leave_type_id,
        from_date=data.from_date,
        to_date=data.to_date,
        num_days=num_days,
        reason=data.reason,
    )
    db.add(req)
    await db.commit()
    await db.refresh(req)

    # Fetch employee to get full_name
    emp_result = await db.execute(select(Employee).where(Employee.id == emp_id))
    emp = emp_result.scalar()

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


@router.get("/payslips", response_model=List[PayslipOut])
async def get_my_payslips(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    emp_id = verify_employee(current_user)
    result = await db.execute(
        select(PayslipRecord, Employee)
        .join(Employee, PayslipRecord.employee_id == Employee.id)
        .where(
            and_(
                PayslipRecord.employee_id == emp_id,
                PayslipRecord.org_id == current_user.org_id,
            )
        )
        .order_by(PayslipRecord.year.desc(), PayslipRecord.month.desc())
    )
    rows = result.all()
    return [
        PayslipOut(
            id=ps.id,
            payroll_run_id=ps.payroll_run_id,
            org_id=ps.org_id,
            employee_id=ps.employee_id,
            employee_name=emp.full_name,
            employee_code=emp.employee_code,
            designation=emp.designation,
            department=emp.department,
            month=ps.month,
            year=ps.year,
            working_days=ps.working_days,
            days_present=float(ps.days_present),
            days_absent=float(ps.days_absent),
            lop_days=float(ps.lop_days),
            leaves_taken=float(ps.leaves_taken),
            gross_earnings=float(ps.gross_earnings),
            total_deductions=float(ps.total_deductions),
            net_pay=float(ps.net_pay),
            earnings_breakdown=ps.earnings_breakdown,
            deductions_breakdown=ps.deductions_breakdown,
            ytd_earnings=float(ps.ytd_earnings),
            ytd_deductions=float(ps.ytd_deductions),
            pdf_path=ps.pdf_path,
            is_pdf_generated=ps.is_pdf_generated,
        )
        for ps, emp in rows
    ]


@router.get("/documents", response_model=List[DocumentOut])
async def get_my_documents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    emp_id = verify_employee(current_user)
    result = await db.execute(
        select(Document, Employee)
        .join(Employee, Document.employee_id == Employee.id)
        .where(
            and_(
                Document.employee_id == emp_id,
                Document.org_id == current_user.org_id,
            )
        )
        .order_by(Document.created_at.desc())
    )
    rows = result.all()
    return [
        DocumentOut(
            id=doc.id,
            org_id=doc.org_id,
            employee_id=doc.employee_id,
            employee_name=emp.full_name,
            template_id=doc.template_id,
            type=doc.type,
            status=doc.status,
            requested_by=doc.requested_by,
            pdf_path=doc.pdf_path,
            issued_at=doc.issued_at,
            metadata_json=doc.metadata_json,
            created_at=doc.created_at,
            updated_at=doc.updated_at,
        )
        for doc, emp in rows
    ]


@router.post("/documents", response_model=DocumentOut, status_code=201)
async def request_my_document(
    data: DocumentCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    emp_id = verify_employee(current_user)
    if data.employee_id != emp_id:
        raise HTTPException(status_code=403, detail="You can only request documents on your own behalf")

    emp_result = await db.execute(select(Employee).where(Employee.id == emp_id))
    employee = emp_result.scalar()

    doc = Document(
        org_id=current_user.org_id,
        employee_id=emp_id,
        template_id=data.template_id,
        type=DocumentType(data.type),
        status=DocumentStatus.requested,
        requested_by=current_user.id,
        metadata_json=data.metadata_json or {},
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    return DocumentOut(
        id=doc.id,
        org_id=doc.org_id,
        employee_id=doc.employee_id,
        employee_name=employee.full_name,
        template_id=doc.template_id,
        type=doc.type,
        status=doc.status,
        requested_by=doc.requested_by,
        pdf_path=doc.pdf_path,
        issued_at=doc.issued_at,
        metadata_json=doc.metadata_json,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
    )

