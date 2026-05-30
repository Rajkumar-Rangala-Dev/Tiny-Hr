from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List, Optional
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import User, UserRole
from app.models.employee import Employee
from app.models.document import DocumentTemplate, Document, DocumentStatus, DocumentType
from app.schemas.document import (
    DocumentTemplateCreate, DocumentTemplateOut,
    DocumentCreateRequest, DocumentOut, DocumentIssueRequest
)
from app.services.document_service import seed_default_templates_for_org, generate_document_pdf
from app.core.storage import get_signed_url
from app.core.config import get_settings

settings = get_settings()
router = APIRouter(prefix="/documents", tags=["Documents & Letters"])


@router.post("/templates/seed", status_code=200)
async def seed_templates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in (UserRole.hr_admin, UserRole.super_admin):
        raise HTTPException(status_code=403, detail="Only admins can seed templates")
    await seed_default_templates_for_org(current_user.org_id, db)
    return {"message": "Default templates seeded successfully"}


@router.get("/templates", response_model=List[DocumentTemplateOut])
async def list_templates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.hr_admin, UserRole.super_admin, UserRole.hr_staff)),
):
    # Auto-seed on list if empty, for seamless UX
    await seed_default_templates_for_org(current_user.org_id, db)

    result = await db.execute(
        select(DocumentTemplate).where(DocumentTemplate.org_id == current_user.org_id)
    )
    return result.scalars().all()


@router.post("/templates", response_model=DocumentTemplateOut, status_code=201)
async def create_template(
    data: DocumentTemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in (UserRole.hr_admin, UserRole.super_admin):
        raise HTTPException(status_code=403, detail="Only admins can create templates")

    template = DocumentTemplate(
        org_id=current_user.org_id,
        type=DocumentType(data.type),
        name=data.name,
        template_html=data.template_html,
        is_default=data.is_default,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return template


@router.patch("/templates/{id}", response_model=DocumentTemplateOut)
async def update_template(
    id: str,
    data: DocumentTemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in (UserRole.hr_admin, UserRole.super_admin):
        raise HTTPException(status_code=403, detail="Only admins can edit templates")

    result = await db.execute(
        select(DocumentTemplate).where(
            and_(DocumentTemplate.id == id, DocumentTemplate.org_id == current_user.org_id)
        )
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    template.name = data.name
    template.template_html = data.template_html
    template.type = DocumentType(data.type)
    template.is_default = data.is_default

    await db.commit()
    await db.refresh(template)
    return template


# ── Document Requests & Issuance ──

@router.get("/", response_model=List[DocumentOut])
async def list_documents(
    employee_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.hr_admin, UserRole.super_admin, UserRole.hr_staff)),
):
    query = select(Document, Employee).join(Employee, Document.employee_id == Employee.id).where(
        Document.org_id == current_user.org_id
    )

    if employee_id:
        query = query.where(Document.employee_id == employee_id)
    if status:
        query = query.where(Document.status == status)

    result = await db.execute(query.order_by(Document.created_at.desc()))
    rows = result.all()

    out = []
    for doc, emp in rows:
        out.append(DocumentOut(
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
        ))
    return out


@router.post("/", response_model=DocumentOut, status_code=201)
async def generate_or_request_document(
    data: DocumentCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.hr_admin, UserRole.super_admin, UserRole.hr_staff)),
):
    # Verify employee
    emp_result = await db.execute(
        select(Employee).where(Employee.id == data.employee_id, Employee.org_id == current_user.org_id)
    )
    employee = emp_result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    is_employee = current_user.role == UserRole.employee

    doc = Document(
        org_id=current_user.org_id,
        employee_id=data.employee_id,
        template_id=data.template_id,
        type=DocumentType(data.type),
        status=DocumentStatus.requested if is_employee else DocumentStatus.generated,
        requested_by=current_user.id if is_employee else None,
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


@router.post("/{id}/issue", response_model=DocumentOut)
async def issue_document(
    id: str,
    data: DocumentIssueRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in (UserRole.hr_admin, UserRole.super_admin):
        raise HTTPException(status_code=403, detail="Only admins can issue documents")

    doc_result = await db.execute(
        select(Document).where(and_(Document.id == id, Document.org_id == current_user.org_id))
    )
    doc = doc_result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Update metadata if passed during issuance
    if data.metadata_json:
        merged = {**doc.metadata_json, **data.metadata_json}
        doc.metadata_json = merged

    doc.issued_at = datetime.now(timezone.utc)
    doc.status = DocumentStatus.generated
    await db.commit()

    # Call PDF rendering service to write_pdf and save pdf_path
    try:
        await generate_document_pdf(doc.id, db)
        await db.refresh(doc)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF document: {str(e)}")

    emp_result = await db.execute(select(Employee).where(Employee.id == doc.employee_id))
    employee = emp_result.scalar()

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


@router.get("/{id}/download")
async def get_document_download_url(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Both employees (if it belongs to them) and HR can download
    doc_result = await db.execute(
        select(Document).where(and_(Document.id == id, Document.org_id == current_user.org_id))
    )
    doc = doc_result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if current_user.role == UserRole.employee and doc.employee_id != current_user.employee_id:
        raise HTTPException(status_code=403, detail="You do not have permission to download this document")

    if not doc.pdf_path:
        raise HTTPException(status_code=400, detail="Document PDF has not been generated or issued yet")

    url = await get_signed_url(settings.STORAGE_BUCKET_DOCS, doc.pdf_path)
    return {"download_url": url}
