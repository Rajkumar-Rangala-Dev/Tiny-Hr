import base64
from datetime import datetime, timezone, date
from jinja2 import Template
from weasyprint import HTML
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.models.document import Document, DocumentTemplate, DocumentType, DocumentStatus
from app.models.employee import Employee
from app.models.org import Organization
from app.core.storage import upload_file_to_storage, get_signed_url
from app.core.config import get_settings

settings = get_settings()


def _load_logo_base64(logo_path: str | None) -> str | None:
    if not logo_path:
        return None
    from pathlib import Path
    p = Path(logo_path)
    if p.exists():
        data = p.read_bytes()
        ext = p.suffix.lower().lstrip(".")
        mime = "image/png" if ext == "png" else f"image/{ext}"
        return f"data:{mime};base64,{base64.b64encode(data).decode()}"
    return None


def get_default_template_html(doc_type: DocumentType) -> str:
    """Returns elegant, professionally-designed default HTML templates using Tailwind inline-CSS style for WeasyPrint."""
    # WeasyPrint works perfectly with standard CSS. We can use clean CSS with inline classes.
    header_style = """
    <style>
        @page {
            size: A4;
            margin: 20mm;
            @bottom-right {
                content: "Page " counter(page) " of " counter(pages);
                font-family: Arial, sans-serif;
                font-size: 8pt;
                color: #718096;
            }
        }
        body {
            font-family: 'Helvetica Neue', Arial, sans-serif;
            color: #2D3748;
            line-height: 1.6;
            font-size: 11pt;
        }
        .header {
            border-bottom: 2px solid #3182CE;
            padding-bottom: 15px;
            margin-bottom: 25px;
        }
        .logo {
            max-height: 50px;
            float: left;
        }
        .company-info {
            text-align: right;
            font-size: 9pt;
            color: #4A5568;
        }
        .title {
            text-align: center;
            font-size: 18pt;
            font-weight: bold;
            color: #1A365D;
            margin-top: 30px;
            margin-bottom: 35px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .date {
            margin-bottom: 25px;
            font-weight: 500;
        }
        .salutation {
            margin-bottom: 20px;
        }
        .content {
            text-align: justify;
            margin-bottom: 30px;
        }
        .signature-section {
            margin-top: 50px;
            page-break-inside: avoid;
        }
        .signature-block {
            float: left;
            width: 45%;
        }
        .signature-line {
            border-top: 1px solid #A0AEC0;
            margin-top: 50px;
            padding-top: 5px;
            font-size: 10pt;
            color: #4A5568;
        }
        .footer {
            margin-top: 80px;
            border-top: 1px solid #E2E8F0;
            padding-top: 15px;
            font-size: 8pt;
            color: #718096;
            text-align: center;
            clear: both;
        }
    </style>
    """

    if doc_type == DocumentType.experience_letter:
        return header_style + """
        <div class="header">
            {% if logo_b64 %}
                <img src="{{ logo_b64 }}" class="logo" />
            {% endif %}
            <div class="company-info">
                <strong>{{ org.name }}</strong><br />
                {{ org.address or "" }}
            </div>
            <div style="clear: both;"></div>
        </div>

        <div class="date">Date: {{ issued_date }}</div>

        <div class="title">TO WHOMSOEVER IT MAY CONCERN</div>

        <div class="salutation"><strong>Subject: Experience Certificate</strong></div>

        <div class="content">
            <p>This is to certify that <strong>{{ employee.full_name }}</strong> (Employee Code: {{ employee.employee_code }}) was employed with <strong>{{ org.name }}</strong> from <strong>{{ joining_date }}</strong> to <strong>{{ lworking_date }}</strong>.</p>
            
            <p>During their tenure with us, they served under the designation of <strong>{{ employee.designation }}</strong> in the {{ employee.department or "Engineering" }} Department. Their duties involved executing assignments with high dedication and skill.</p>
            
            <p>Throughout their employment, we found {{ employee.full_name }} to be highly professional, diligent, and honest. They possess strong leadership capabilities and a solid teamwork ethic. They left our services of their own accord to pursue other career opportunities.</p>
            
            <p>We appreciate their valuable contributions to {{ org.name }} and wish them all the best in their future endeavors.</p>
        </div>

        <div class="signature-section">
            <div class="signature-block">
                For <strong>{{ org.name }}</strong>
                <div class="signature-line">
                    Authorized Signatory<br />
                    HR Department
                </div>
            </div>
            <div style="clear: both;"></div>
        </div>

        <div class="footer">
            Confidential Document — Issued by {{ org.name }}. Verifiable on registration.
        </div>
        """

    elif doc_type == DocumentType.relieving_letter:
        return header_style + """
        <div class="header">
            {% if logo_b64 %}
                <img src="{{ logo_b64 }}" class="logo" />
            {% endif %}
            <div class="company-info">
                <strong>{{ org.name }}</strong><br />
                {{ org.address or "" }}
            </div>
            <div style="clear: both;"></div>
        </div>

        <div class="date">Date: {{ issued_date }}</div>

        <div class="salutation">
            To,<br />
            <strong>{{ employee.full_name }}</strong><br />
            Employee Code: {{ employee.employee_code }}<br />
            {{ employee.address or "" }}
        </div>

        <div class="title">Relieving Letter & Clearance Certificate</div>

        <div class="content">
            <p>Dear {{ employee.full_name }},</p>

            <p>This is with reference to your resignation letter dated <strong>{{ resignation_date }}</strong> from the services of <strong>{{ org.name }}</strong>. We wish to inform you that your resignation has been accepted and you are officially relieved from your duties as <strong>{{ employee.designation }}</strong> with effect from the close of business hours on <strong>{{ lworking_date }}</strong>.</p>
            
            <p>We further confirm that you have successfully completed your clearance process across all departments, and there are no outstanding dues, liabilities, or company assets pending on your end. Your final settlement has been calculated and disbursed to your registered bank account.</p>
            
            <p>We sincerely thank you for your contributions during your tenure. We wish you success in your future professional endeavors.</p>
        </div>

        <div class="signature-section">
            <div class="signature-block">
                For <strong>{{ org.name }}</strong>
                <div class="signature-line">
                    Authorized Signatory<br />
                    HR Department
                </div>
            </div>
            <div style="clear: both;"></div>
        </div>

        <div class="footer">
            {{ org.name }} — Private & Confidential
        </div>
        """

    elif doc_type == DocumentType.salary_certificate:
        return header_style + """
        <div class="header">
            {% if logo_b64 %}
                <img src="{{ logo_b64 }}" class="logo" />
            {% endif %}
            <div class="company-info">
                <strong>{{ org.name }}</strong><br />
                {{ org.address or "" }}
            </div>
            <div style="clear: both;"></div>
        </div>

        <div class="date">Date: {{ issued_date }}</div>

        <div class="title">Salary Certificate</div>

        <div class="content">
            <p>This is to certify that <strong>{{ employee.full_name }}</strong> (Employee Code: {{ employee.employee_code }}) is currently employed on a full-time basis with <strong>{{ org.name }}</strong> in the position of <strong>{{ employee.designation }}</strong> since <strong>{{ joining_date }}</strong>.</p>
            
            <p>As per our official payroll records, their current monthly gross salary and annualized earnings package are structured as follows:</p>

            <table style="width: 100%; border-collapse: collapse; margin-top: 20px; margin-bottom: 25px;">
                <tr style="background-color: #EDF2F7; font-weight: bold; border: 1px solid #CBD5E0;">
                    <th style="padding: 10px; border: 1px solid #CBD5E0;">Salary Parameter</th>
                    <th style="padding: 10px; border: 1px solid #CBD5E0; text-align: right;">Amount (INR)</th>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #CBD5E0;">Monthly Gross Salary</td>
                    <td style="padding: 10px; border: 1px solid #CBD5E0; text-align: right; font-weight: bold;">{{ gross_salary }}</td>
                </tr>
                <tr style="background-color: #F7FAFC;">
                    <td style="padding: 10px; border: 1px solid #CBD5E0;">Annual Cost to Company (CTC)</td>
                    <td style="padding: 10px; border: 1px solid #CBD5E0; text-align: right; font-weight: bold;">{{ annual_salary }}</td>
                </tr>
            </table>

            <p>This certificate is being issued at the specific request of the employee for banking, loan application, or residential proof purposes, without any liability or financial commitment on behalf of {{ org.name }}.</p>
        </div>

        <div class="signature-section">
            <div class="signature-block">
                For <strong>{{ org.name }}</strong>
                <div class="signature-line">
                    Authorized Signatory<br />
                    HR Department
                </div>
            </div>
            <div style="clear: both;"></div>
        </div>

        <div class="footer">
            Verifiable Salary Document issued by {{ org.name }}
        </div>
        """

    else:
        # Default fallback generic template
        return header_style + """
        <div class="header">
            <strong>{{ org.name }}</strong><br />
            {{ org.address or "" }}
        </div>
        <div class="date">Date: {{ issued_date }}</div>
        <div class="title">{{ type_name }}</div>
        <div class="content">
            <p>Dear {{ employee.full_name }},</p>
            <p>This document certifies your affiliation as {{ employee.designation }} at {{ org.name }}.</p>
        </div>
        <div class="signature-section">
            For <strong>{{ org.name }}</strong>
            <div class="signature-line">Authorized Signatory</div>
        </div>
        """


async def seed_default_templates_for_org(org_id: str, db: AsyncSession):
    """Seed the default document templates for a newly created or existing organization."""
    # Check if templates already exist
    existing = await db.execute(
        select(DocumentTemplate).where(DocumentTemplate.org_id == org_id)
    )
    if existing.scalars().first():
        return  # already seeded

    for dtype in [DocumentType.experience_letter, DocumentType.relieving_letter, DocumentType.salary_certificate]:
        name = dtype.value.replace("_", " ").title()
        template = DocumentTemplate(
            org_id=org_id,
            type=dtype,
            name=name,
            template_html=get_default_template_html(dtype),
            is_default=True,
        )
        db.add(template)
    await db.commit()


async def generate_document_pdf(doc_id: str, db: AsyncSession) -> str:
    """Render the Jinja2 HTML template, generate a beautiful PDF, and save it to Supabase storage."""
    doc_result = await db.execute(
        select(Document).where(Document.id == doc_id)
    )
    doc = doc_result.scalar_one_or_none()
    if not doc:
        raise ValueError("Document not found")

    emp_result = await db.execute(select(Employee).where(Employee.id == doc.employee_id))
    employee = emp_result.scalar_one()

    org_result = await db.execute(select(Organization).where(Organization.id == doc.org_id))
    org = org_result.scalar_one()

    # Get template
    template_html = ""
    if doc.template_id:
        tmpl_res = await db.execute(select(DocumentTemplate).where(DocumentTemplate.id == doc.template_id))
        tmpl = tmpl_res.scalar_one_or_none()
        if tmpl:
            template_html = tmpl.template_html

    if not template_html:
        template_html = get_default_template_html(doc.type)

    logo_b64 = _load_logo_base64(org.logo_path)

    # Format values for rendering
    issued_date_obj = doc.issued_at or datetime.now(timezone.utc)
    issued_date_str = issued_date_obj.strftime("%d %B, %Y")
    joining_date_str = employee.date_of_joining.strftime("%d %B, %Y") if employee.date_of_joining else "N/A"
    
    # Custom dates from metadata_json if provided
    resignation_date_str = doc.metadata_json.get("resignation_date") or date.today().strftime("%d %B, %Y")
    lworking_date_str = doc.metadata_json.get("last_working_day") or date.today().strftime("%d %B, %Y")

    gross_salary_val = float(employee.gross_salary)
    gross_salary_str = f"INR {gross_salary_val:,.2f}"
    annual_salary_str = f"INR {(gross_salary_val * 12):,.2f}"

    context = {
        "org": org,
        "employee": employee,
        "document": doc,
        "logo_b64": logo_b64,
        "issued_date": issued_date_str,
        "joining_date": joining_date_str,
        "resignation_date": resignation_date_str,
        "lworking_date": lworking_date_str,
        "gross_salary": gross_salary_str,
        "annual_salary": annual_salary_str,
        "type_name": doc.type.value.replace("_", " ").title(),
        **doc.metadata_json
    }

    # Render Jinja2 Template dynamically
    t = Template(template_html)
    rendered_html = t.render(**context)

    # Convert to PDF using WeasyPrint
    pdf_bytes = HTML(string=rendered_html).write_pdf()

    # Upload to Supabase Storage
    storage_path = f"{org.id}/documents/{doc.type.value}/{employee.employee_code}_{doc.id}.pdf"
    await upload_file_to_storage(
        bucket=settings.STORAGE_BUCKET_DOCS,
        path=storage_path,
        content=pdf_bytes,
        content_type="application/pdf",
    )

    doc.pdf_path = storage_path
    doc.status = DocumentStatus.issued
    doc.issued_at = datetime.now(timezone.utc)
    await db.commit()

    return storage_path
