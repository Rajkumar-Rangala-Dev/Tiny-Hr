from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime, timezone, date

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import User, UserRole
from app.models.employee import Employee, EmployeeStatus
from app.models.offboarding import OffboardingCase, OffboardingTask
from app.models.document import Document, DocumentStatus, DocumentType
from app.schemas.offboarding import OffboardingCaseCreate, OffboardingCaseOut, OffboardingTaskUpdate, OffboardingTaskOut
from app.services.document_service import generate_document_pdf

router = APIRouter(prefix="/offboarding", tags=["Offboarding"])


@router.post("/", response_model=OffboardingCaseOut, status_code=201)
async def initiate_offboarding(
    data: OffboardingCaseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.hr_admin, UserRole.super_admin, UserRole.hr_staff)),
):
    # Verify employee exists and belongs to same org
    emp_result = await db.execute(
        select(Employee).where(Employee.id == data.employee_id, Employee.org_id == current_user.org_id)
    )
    employee = emp_result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Check if offboarding already initiated
    existing_case = await db.execute(
        select(OffboardingCase).where(
            and_(OffboardingCase.employee_id == data.employee_id, OffboardingCase.status != "completed")
        )
    )
    if existing_case.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="An active offboarding case already exists for this employee")

    # Create case
    case = OffboardingCase(
        org_id=current_user.org_id,
        employee_id=data.employee_id,
        resignation_date=data.resignation_date,
        last_working_day=data.last_working_day,
        reason=data.reason,
        final_settlement_amount=data.final_settlement_amount or 0.0,
        status="initiated",
    )
    db.add(case)
    await db.flush()

    # Generate default checklist tasks
    default_tasks = [
        "Retrieve Company Laptop & Accessories",
        "Revoke Email, Slack & Cloud Access",
        "Complete Knowledge Transfer (KT) session",
        "Conduct Formal Exit Interview",
        "Finance Clearance & Gratuity Calculation",
        "Generate Relieving & Experience Letters"
    ]
    for task_name in default_tasks:
        task = OffboardingTask(
            org_id=current_user.org_id,
            offboarding_case_id=case.id,
            task_name=task_name,
            status="pending",
        )
        db.add(task)

    await db.commit()
    
    # Reload case with loaded tasks and employee details
    result = await db.execute(
        select(OffboardingCase)
        .options(selectinload(OffboardingCase.tasks))
        .where(OffboardingCase.id == case.id)
    )
    case_ref = result.scalar_one()

    return OffboardingCaseOut(
        id=case_ref.id,
        org_id=case_ref.org_id,
        employee_id=case_ref.employee_id,
        employee_name=employee.full_name,
        employee_code=employee.employee_code,
        resignation_date=case_ref.resignation_date,
        last_working_day=case_ref.last_working_day,
        reason=case_ref.reason,
        status=case_ref.status,
        final_settlement_amount=float(case_ref.final_settlement_amount),
        created_at=case_ref.created_at,
        updated_at=case_ref.updated_at,
        tasks=[
            OffboardingTaskOut(
                id=t.id,
                offboarding_case_id=t.offboarding_case_id,
                task_name=t.task_name,
                status=t.status,
                completed_at=t.completed_at,
                created_at=t.created_at,
                updated_at=t.updated_at,
            ) for t in case_ref.tasks
        ]
    )


@router.get("/", response_model=List[OffboardingCaseOut])
async def list_offboarding_cases(
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.hr_admin, UserRole.super_admin, UserRole.hr_staff)),
):
    query = (
        select(OffboardingCase, Employee)
        .join(Employee, OffboardingCase.employee_id == Employee.id)
        .options(selectinload(OffboardingCase.tasks))
        .where(OffboardingCase.org_id == current_user.org_id)
    )
    if status:
        query = query.where(OffboardingCase.status == status)

    result = await db.execute(query.order_by(OffboardingCase.created_at.desc()))
    rows = result.all()

    out = []
    for case, emp in rows:
        out.append(
            OffboardingCaseOut(
                id=case.id,
                org_id=case.org_id,
                employee_id=case.employee_id,
                employee_name=emp.full_name,
                employee_code=emp.employee_code,
                resignation_date=case.resignation_date,
                last_working_day=case.last_working_day,
                reason=case.reason,
                status=case.status,
                final_settlement_amount=float(case.final_settlement_amount),
                created_at=case.created_at,
                updated_at=case.updated_at,
                tasks=[
                    OffboardingTaskOut(
                        id=t.id,
                        offboarding_case_id=t.offboarding_case_id,
                        task_name=t.task_name,
                        status=t.status,
                        completed_at=t.completed_at,
                        created_at=t.created_at,
                        updated_at=t.updated_at,
                    ) for t in case.tasks
                ]
            )
        )
    return out


@router.patch("/tasks/{task_id}", response_model=OffboardingTaskOut)
async def update_offboarding_task(
    task_id: str,
    data: OffboardingTaskUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.hr_admin, UserRole.super_admin, UserRole.hr_staff)),
):
    result = await db.execute(
        select(OffboardingTask).where(and_(OffboardingTask.id == task_id, OffboardingTask.org_id == current_user.org_id))
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Offboarding task not found")

    task.status = data.status
    if data.status == "done":
        task.completed_at = datetime.now(timezone.utc)
    else:
        task.completed_at = None

    await db.commit()
    await db.refresh(task)
    return task


@router.post("/{case_id}/complete")
async def complete_offboarding(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.hr_admin, UserRole.super_admin)),
):
    result = await db.execute(
        select(OffboardingCase)
        .options(selectinload(OffboardingCase.tasks))
        .where(and_(OffboardingCase.id == case_id, OffboardingCase.org_id == current_user.org_id))
    )
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Offboarding case not found")
    if case.status == "completed":
        raise HTTPException(status_code=400, detail="Offboarding already completed")

    # Check if all checklist tasks are complete
    pending = [t.task_name for t in case.tasks if t.status != "done"]
    if pending:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot complete offboarding. The following clearance tasks are pending: {', '.join(pending)}"
        )

    # Transition employee status to separated
    emp_result = await db.execute(select(Employee).where(Employee.id == case.employee_id))
    employee = emp_result.scalar_one()
    employee.status = EmployeeStatus.separated

    case.status = "completed"
    await db.commit()

    # Trigger automatic letter generation (Experience and Relieving Letters)
    # 1. Experience Letter
    exp_doc = Document(
        org_id=case.org_id,
        employee_id=case.employee_id,
        type=DocumentType.experience_letter,
        status=DocumentStatus.requested,
        metadata_json={
            "resignation_date": case.resignation_date.strftime("%d %B, %Y"),
            "last_working_day": case.last_working_day.strftime("%d %B, %Y"),
        }
    )
    db.add(exp_doc)
    
    # 2. Relieving Letter
    rel_doc = Document(
        org_id=case.org_id,
        employee_id=case.employee_id,
        type=DocumentType.relieving_letter,
        status=DocumentStatus.requested,
        metadata_json={
            "resignation_date": case.resignation_date.strftime("%d %B, %Y"),
            "last_working_day": case.last_working_day.strftime("%d %B, %Y"),
        }
    )
    db.add(rel_doc)
    await db.flush()

    # Issue both documents to generate PDFs
    try:
        await generate_document_pdf(exp_doc.id, db)
        await generate_document_pdf(rel_doc.id, db)
    except Exception as e:
        # Don't fail the transaction if PDF generation fails, but log it
        print(f"⚠️ Failed to auto-generate offboarding letters: {str(e)}")

    await db.commit()
    return {"message": "Offboarding completed successfully. Experience and Relieving letters have been auto-generated."}
