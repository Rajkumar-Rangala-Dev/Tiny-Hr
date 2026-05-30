import io
from typing import List, Optional
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import User, UserRole
from app.models.employee import Employee, SalaryComponent, EmployeeStatus
from app.schemas.employee import EmployeeCreateRequest, EmployeeUpdateRequest, EmployeeOut
from app.services.onboarding_service import initialize_onboarding_tasks_for_employee

router = APIRouter(prefix="/employees", tags=["Employees"])


@router.post("/", response_model=EmployeeOut, status_code=201)
async def create_employee(
    data: EmployeeCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.hr_admin, UserRole.super_admin, UserRole.hr_staff)),
):
    existing = await db.execute(
        select(Employee).where(
            and_(Employee.org_id == current_user.org_id, Employee.employee_code == data.employee_code)
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Employee code '{data.employee_code}' already exists")

    emp = Employee(
        org_id=current_user.org_id,
        **data.model_dump(exclude={"salary_components"}),
    )
    db.add(emp)
    await db.flush()

    for comp in (data.salary_components or []):
        sc = SalaryComponent(employee_id=emp.id, **comp.model_dump())
        db.add(sc)

    await db.commit()
    await initialize_onboarding_tasks_for_employee(emp.id, db)
    
    result2 = await db.execute(
        select(Employee).options(selectinload(Employee.salary_components)).where(Employee.id == emp.id)
    )
    return result2.scalar_one()


@router.get("/", response_model=List[EmployeeOut])
async def list_employees(
    status: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.hr_admin, UserRole.super_admin, UserRole.hr_staff)),
):
    query = select(Employee).options(selectinload(Employee.salary_components)).where(Employee.org_id == current_user.org_id)
    if status:
        query = query.where(Employee.status == status)
    if department:
        query = query.where(Employee.department == department)
    if search:
        query = query.where(Employee.full_name.ilike(f"%{search}%"))
    result = await db.execute(query.order_by(Employee.full_name))
    return result.scalars().all()


@router.get("/{employee_id}", response_model=EmployeeOut)
async def get_employee(
    employee_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.employee and current_user.employee_id != employee_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You can only view your own profile."
        )

    result = await db.execute(
        select(Employee).options(selectinload(Employee.salary_components)).where(
            and_(Employee.id == employee_id, Employee.org_id == current_user.org_id)
        )
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    return emp


@router.patch("/{employee_id}", response_model=EmployeeOut)
async def update_employee(
    employee_id: str,
    data: EmployeeUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.hr_admin, UserRole.super_admin, UserRole.hr_staff)),
):
    result = await db.execute(
        select(Employee).where(
            and_(Employee.id == employee_id, Employee.org_id == current_user.org_id)
        )
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(emp, field, value)

    await db.commit()
    result2 = await db.execute(
        select(Employee).options(selectinload(Employee.salary_components)).where(Employee.id == employee_id)
    )
    return result2.scalar_one()


@router.delete("/{employee_id}", status_code=204)
async def archive_employee(
    employee_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.hr_admin, UserRole.super_admin)),
):
    result = await db.execute(
        select(Employee).where(
            and_(Employee.id == employee_id, Employee.org_id == current_user.org_id)
        )
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    emp.status = EmployeeStatus.archived
    await db.commit()


@router.post("/import/csv", status_code=201)
async def import_employees_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.hr_admin, UserRole.super_admin, UserRole.hr_staff)),
):
    content = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid CSV: {e}")

    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    created, skipped, errors = 0, 0, []
    for idx, row in df.iterrows():
        code = str(row.get("employee_code", row.get("emp_code", ""))).strip()
        name = str(row.get("full_name", row.get("name", ""))).strip()
        if not code or not name:
            errors.append(f"Row {idx+2}: Missing employee_code or full_name")
            continue

        existing = await db.execute(
            select(Employee).where(
                and_(Employee.org_id == current_user.org_id, Employee.employee_code == code)
            )
        )
        if existing.scalar_one_or_none():
            skipped += 1
            continue

        emp = Employee(
            org_id=current_user.org_id,
            employee_code=code,
            full_name=name,
            email=str(row.get("email", "")).strip() or None,
            designation=str(row.get("designation", "")).strip() or None,
            department=str(row.get("department", "")).strip() or None,
            gross_salary=float(row.get("gross_salary", 0) or 0),
            client_name=str(row.get("client_name", "")).strip() or None,
        )
        db.add(emp)
        created += 1

    await db.commit()
    return {"created": created, "skipped": skipped, "errors": errors}
