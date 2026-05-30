from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List, Optional
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, UserRole
from app.models.employee import Employee
from app.models.onboarding import OnboardingTemplate, OnboardingTask
from app.schemas.onboarding import (
    OnboardingTemplateCreate, OnboardingTemplateOut,
    OnboardingTaskCreate, OnboardingTaskUpdate, OnboardingTaskOut
)
from app.services.onboarding_service import seed_default_onboarding_templates

router = APIRouter(prefix="/onboarding", tags=["Onboarding"])


@router.get("/templates", response_model=List[OnboardingTemplateOut])
async def list_templates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.hr_admin, UserRole.super_admin, UserRole.hr_staff)),
):
    # Auto-seed if empty
    await seed_default_onboarding_templates(current_user.org_id, db)

    result = await db.execute(
        select(OnboardingTemplate).where(OnboardingTemplate.org_id == current_user.org_id)
    )
    return result.scalars().all()


@router.post("/templates", response_model=OnboardingTemplateOut, status_code=201)
async def create_template(
    data: OnboardingTemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in (UserRole.hr_admin, UserRole.super_admin):
        raise HTTPException(status_code=403, detail="Only HR Admins can create onboarding templates")

    tmpl = OnboardingTemplate(
        org_id=current_user.org_id,
        task_name=data.task_name,
        assigned_to=data.assigned_to,
        due_days_after_joining=data.due_days_after_joining,
    )
    db.add(tmpl)
    await db.commit()
    await db.refresh(tmpl)
    return tmpl


@router.get("/tasks", response_model=List[OnboardingTaskOut])
async def list_tasks(
    employee_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(OnboardingTask, Employee).join(Employee, OnboardingTask.employee_id == Employee.id).where(
        OnboardingTask.org_id == current_user.org_id
    )

    # If employee role, restrict to self
    if current_user.role == UserRole.employee:
        if not current_user.employee_id:
            return []
        query = query.where(OnboardingTask.employee_id == current_user.employee_id)
    else:
        if employee_id:
            query = query.where(OnboardingTask.employee_id == employee_id)

    if status:
        query = query.where(OnboardingTask.status == status)

    result = await db.execute(query.order_by(OnboardingTask.due_date.asc()))
    rows = result.all()

    return [
        OnboardingTaskOut(
            id=task.id,
            org_id=task.org_id,
            employee_id=task.employee_id,
            employee_name=emp.full_name,
            task_name=task.task_name,
            assigned_to=task.assigned_to,
            status=task.status,
            due_date=task.due_date,
            completed_at=task.completed_at,
            created_at=task.created_at,
            updated_at=task.updated_at,
        )
        for task, emp in rows
    ]


@router.patch("/tasks/{id}", response_model=OnboardingTaskOut)
async def update_task(
    id: str,
    data: OnboardingTaskUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(OnboardingTask, Employee)
        .join(Employee, OnboardingTask.employee_id == Employee.id)
        .where(
            and_(OnboardingTask.id == id, OnboardingTask.org_id == current_user.org_id)
        )
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Onboarding task not found")

    task, emp = row

    # Employees can only update tasks assigned to themselves
    if current_user.role == UserRole.employee and task.employee_id != current_user.employee_id:
        raise HTTPException(status_code=403, detail="You can only update onboarding tasks assigned to yourself")

    task.status = data.status
    if data.status == "done":
        task.completed_at = datetime.now(timezone.utc)
    else:
        task.completed_at = None

    await db.commit()
    await db.refresh(task)

    return OnboardingTaskOut(
        id=task.id,
        org_id=task.org_id,
        employee_id=task.employee_id,
        employee_name=emp.full_name,
        task_name=task.task_name,
        assigned_to=task.assigned_to,
        status=task.status,
        due_date=task.due_date,
        completed_at=task.completed_at,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )
