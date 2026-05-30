from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import User, UserRole
from app.models.payroll import PayrollRun, PayslipRecord, PayrollStatus
from app.models.employee import Employee
from app.schemas.payroll import PayrollRunCreate, PayrollRunOut, PayslipOut
from app.services.payroll_service import run_payroll

router = APIRouter(prefix="/payroll", tags=["Payroll"])


@router.post("/runs", response_model=PayrollRunOut, status_code=201)
async def create_payroll_run(
    data: PayrollRunCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.hr_admin, UserRole.super_admin)),
):
    existing = await db.execute(
        select(PayrollRun).where(
            and_(
                PayrollRun.org_id == current_user.org_id,
                PayrollRun.month == data.month,
                PayrollRun.year == data.year,
                PayrollRun.status != PayrollStatus.draft,
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail=f"Payroll for {data.month}/{data.year} already processed. Delete or unlock it first.",
        )

    payroll_run = await run_payroll(
        org_id=current_user.org_id,
        month=data.month,
        year=data.year,
        processed_by=current_user.id,
        db=db,
    )
    return await _enrich_payroll_run(payroll_run, db)


@router.get("/runs", response_model=List[PayrollRunOut])
async def list_payroll_runs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.hr_admin, UserRole.super_admin, UserRole.hr_staff)),
):
    result = await db.execute(
        select(PayrollRun)
        .where(PayrollRun.org_id == current_user.org_id)
        .order_by(PayrollRun.year.desc(), PayrollRun.month.desc())
    )
    runs = result.scalars().all()
    return [await _enrich_payroll_run(r, db) for r in runs]


@router.get("/runs/{run_id}", response_model=PayrollRunOut)
async def get_payroll_run(
    run_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.hr_admin, UserRole.super_admin, UserRole.hr_staff)),
):
    result = await db.execute(
        select(PayrollRun).where(
            and_(PayrollRun.id == run_id, PayrollRun.org_id == current_user.org_id)
        )
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Payroll run not found")
    return await _enrich_payroll_run(run, db)


@router.post("/runs/{run_id}/lock")
async def lock_payroll_run(
    run_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.hr_admin, UserRole.super_admin)),
):
    result = await db.execute(
        select(PayrollRun).where(
            and_(PayrollRun.id == run_id, PayrollRun.org_id == current_user.org_id)
        )
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Payroll run not found")
    if run.status == PayrollStatus.locked:
        raise HTTPException(status_code=400, detail="Already locked")

    run.status = PayrollStatus.locked
    await db.commit()
    return {"message": "Payroll run locked successfully", "run_id": run_id}


async def _enrich_payroll_run(run: PayrollRun, db: AsyncSession) -> PayrollRunOut:
    slips_result = await db.execute(
        select(PayslipRecord, Employee)
        .join(Employee, PayslipRecord.employee_id == Employee.id)
        .where(PayslipRecord.payroll_run_id == run.id)
    )
    rows = slips_result.all()
    payslips = [
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
    return PayrollRunOut(
        id=run.id,
        org_id=run.org_id,
        month=run.month,
        year=run.year,
        status=run.status,
        total_gross=float(run.total_gross),
        total_deductions=float(run.total_deductions),
        total_net=float(run.total_net),
        processed_at=run.processed_at,
        payslips=payslips,
    )
