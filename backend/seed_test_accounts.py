import asyncio
from app.core.database import AsyncSessionLocal
from app.models.user import User, UserRole
from app.models.employee import Employee
from app.core.security import get_password_hash
from app.services.onboarding_service import initialize_onboarding_tasks_for_employee
from sqlalchemy import select, and_


async def seed():
    async with AsyncSessionLocal() as db:
        print("🌱 Seeding test accounts...")
        
        # 1. Update/Create HR Admin
        admin_email = "admin@testco.com"
        res = await db.execute(select(User).where(User.email == admin_email))
        admin = res.scalar_one_or_none()
        
        if admin:
            print("Updating existing HR Admin password...")
            admin.hashed_password = get_password_hash("Admin123!")
            org_id = admin.org_id
        else:
            print("HR Admin not found. Please register an organization first on the UI!")
            return

        # 2. Create an Employee
        emp_code = "EMP101"
        res_emp = await db.execute(select(Employee).where(and_(Employee.org_id == org_id, Employee.employee_code == emp_code)))
        employee = res_emp.scalar_one_or_none()
        
        if not employee:
            print("Creating test Employee record...")
            employee = Employee(
                org_id=org_id,
                employee_code=emp_code,
                full_name="John Doe",
                designation="Senior Software Engineer",
                department="Engineering",
                gross_salary=95000.0,
                status="active"
            )
            db.add(employee)
            await db.flush()
            
            # Initialize onboarding checklist
            await initialize_onboarding_tasks_for_employee(employee.id, db)
        
        # 3. Create/Update Employee Portal User
        emp_email = "employee@testco.com"
        res_user = await db.execute(select(User).where(User.email == emp_email))
        emp_user = res_user.scalar_one_or_none()
        
        if emp_user:
            emp_user.hashed_password = get_password_hash("Employee123!")
            emp_user.employee_id = employee.id
        else:
            print("Creating test Employee Portal user...")
            emp_user = User(
                org_id=org_id,
                employee_id=employee.id,
                email=emp_email,
                hashed_password=get_password_hash("Employee123!"),
                full_name=employee.full_name,
                role=UserRole.employee,
                must_change_password=False
            )
            db.add(emp_user)

        await db.commit()
        print("🎉 Test accounts seeded successfully!")


if __name__ == "__main__":
    asyncio.run(seed())
