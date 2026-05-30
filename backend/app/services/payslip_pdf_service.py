import base64
import calendar
from pathlib import Path
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML, CSS
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.payroll import PayslipRecord
from app.models.employee import Employee
from app.models.org import Organization
from app.core.storage import upload_file_to_storage, get_signed_url
from app.core.config import get_settings
from app.services.payroll_service import amount_in_words

settings = get_settings()
TEMPLATES_DIR = Path(__file__).parent.parent / "templates"


def _load_logo_base64(logo_path: str | None) -> str | None:
    """Load logo from local path (dev) or return None for storage path."""
    if not logo_path:
        return None
    p = Path(logo_path)
    if p.exists():
        data = p.read_bytes()
        ext = p.suffix.lower().lstrip(".")
        mime = "image/png" if ext == "png" else f"image/{ext}"
        return f"data:{mime};base64,{base64.b64encode(data).decode()}"
    return None


def _month_name(month: int) -> str:
    return calendar.month_name[month]


async def generate_payslip_pdf(
    payslip_id: str,
    db: AsyncSession,
) -> str:
    ps_result = await db.execute(
        select(PayslipRecord).where(PayslipRecord.id == payslip_id)
    )
    payslip = ps_result.scalar_one_or_none()
    if not payslip:
        raise ValueError(f"Payslip {payslip_id} not found")

    emp_result = await db.execute(select(Employee).where(Employee.id == payslip.employee_id))
    employee = emp_result.scalar_one()

    org_result = await db.execute(select(Organization).where(Organization.id == payslip.org_id))
    org = org_result.scalar_one()

    logo_b64 = _load_logo_base64(org.logo_path)

    context = {
        "org": org,
        "employee": employee,
        "payslip": payslip,
        "month_name": _month_name(payslip.month),
        "logo_b64": logo_b64,
        "net_pay_in_words": amount_in_words(float(payslip.net_pay)),
        "bank_account_masked": (
            "*" * (len(employee.bank_account_number) - 4) + employee.bank_account_number[-4:]
            if employee.bank_account_number and len(employee.bank_account_number) >= 4
            else employee.bank_account_number
        ),
    }

    env = Environment(loader=FileSystemLoader(str(TEMPLATES_DIR)))
    template = env.get_template("payslip.html")
    html_content = template.render(**context)

    pdf_bytes = HTML(string=html_content, base_url=str(TEMPLATES_DIR)).write_pdf()

    storage_path = f"{org.id}/payslips/{payslip.year}/{payslip.month:02d}/{employee.employee_code}_{payslip.year}_{payslip.month:02d}.pdf"
    await upload_file_to_storage(
        bucket=settings.STORAGE_BUCKET_PAYSLIPS,
        path=storage_path,
        content=pdf_bytes,
        content_type="application/pdf",
    )

    payslip.pdf_path = storage_path
    payslip.is_pdf_generated = True
    await db.commit()

    return storage_path


async def get_payslip_download_url(payslip_id: str, db: AsyncSession) -> str:
    ps_result = await db.execute(select(PayslipRecord).where(PayslipRecord.id == payslip_id))
    payslip = ps_result.scalar_one_or_none()
    if not payslip or not payslip.pdf_path:
        raise ValueError("PDF not yet generated for this payslip")
    return await get_signed_url(settings.STORAGE_BUCKET_PAYSLIPS, payslip.pdf_path)
