import io
import zipfile
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import User, UserRole
from app.models.payroll import PayslipRecord, PayrollRun
from app.models.employee import Employee
from app.services.payslip_pdf_service import generate_payslip_pdf, get_payslip_download_url

router = APIRouter(prefix="/payslips", tags=["Payslips"])


@router.post("/{payslip_id}/generate")
async def generate_pdf(
    payslip_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.hr_admin, UserRole.super_admin, UserRole.hr_staff)),
):
    ps_result = await db.execute(
        select(PayslipRecord).where(
            and_(PayslipRecord.id == payslip_id, PayslipRecord.org_id == current_user.org_id)
        )
    )
    ps = ps_result.scalar_one_or_none()
    if not ps:
        raise HTTPException(status_code=404, detail="Payslip not found")

    path = await generate_payslip_pdf(payslip_id, db)
    return {"message": "PDF generated successfully", "pdf_path": path}


@router.get("/{payslip_id}/download-url")
async def get_download_url(
    payslip_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ps_result = await db.execute(
        select(PayslipRecord).where(
            and_(PayslipRecord.id == payslip_id, PayslipRecord.org_id == current_user.org_id)
        )
    )
    ps = ps_result.scalar_one_or_none()
    if not ps:
        raise HTTPException(status_code=404, detail="Payslip not found")

    # If employee, verify ownership
    if current_user.role == UserRole.employee and ps.employee_id != current_user.employee_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You can only download your own payslips."
        )

    url = await get_payslip_download_url(payslip_id, db)
    return {"download_url": url}


@router.post("/run/{run_id}/generate-all")
async def generate_all_payslips(
    run_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.hr_admin, UserRole.super_admin)),
):
    run_result = await db.execute(
        select(PayrollRun).where(
            and_(PayrollRun.id == run_id, PayrollRun.org_id == current_user.org_id)
        )
    )
    if not run_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Payroll run not found")

    slips_result = await db.execute(
        select(PayslipRecord).where(PayslipRecord.payroll_run_id == run_id)
    )
    payslips = slips_result.scalars().all()

    generated, failed = 0, []
    for ps in payslips:
        try:
            await generate_payslip_pdf(ps.id, db)
            generated += 1
        except Exception as e:
            failed.append({"payslip_id": ps.id, "error": str(e)})

    return {
        "total": len(payslips),
        "generated": generated,
        "failed": failed,
    }


@router.get("/run/{run_id}/download-zip")
async def download_all_payslips_zip(
    run_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.hr_admin, UserRole.super_admin, UserRole.hr_staff)),
):
    run_result = await db.execute(
        select(PayrollRun).where(
            and_(PayrollRun.id == run_id, PayrollRun.org_id == current_user.org_id)
        )
    )
    run = run_result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Payroll run not found")

    slips_result = await db.execute(
        select(PayslipRecord, Employee)
        .join(Employee, PayslipRecord.employee_id == Employee.id)
        .where(PayslipRecord.payroll_run_id == run_id)
    )
    rows = slips_result.all()

    import calendar as cal
    from app.core.storage import get_signed_url
    from app.core.config import get_settings
    import httpx

    settings = get_settings()

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for ps, emp in rows:
            if not ps.is_pdf_generated or not ps.pdf_path:
                try:
                    await generate_payslip_pdf(ps.id, db)
                    await db.refresh(ps)
                except Exception:
                    continue

            signed_url = await get_signed_url(settings.STORAGE_BUCKET_PAYSLIPS, ps.pdf_path)
            async with httpx.AsyncClient() as client:
                resp = await client.get(signed_url)
                if resp.status_code == 200:
                    filename = f"{emp.employee_code}_{emp.full_name}_{cal.month_name[run.month]}_{run.year}.pdf"
                    zf.writestr(filename, resp.content)

    zip_buffer.seek(0)
    month_name = cal.month_name[run.month]
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename=payslips_{month_name}_{run.year}.zip"
        },
    )
