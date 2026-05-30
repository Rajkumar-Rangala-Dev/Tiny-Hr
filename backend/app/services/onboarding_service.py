from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.onboarding import OnboardingTemplate, OnboardingTask
from app.models.employee import Employee


async def seed_default_onboarding_templates(org_id: str, db: AsyncSession):
    """Seed default onboarding checklist templates for an organization."""
    existing = await db.execute(
        select(OnboardingTemplate).where(OnboardingTemplate.org_id == org_id)
    )
    if existing.scalars().first():
        return  # already seeded

    defaults = [
        {"task_name": "Submit PAN, Aadhaar and Form 16 documents", "assigned_to": "employee", "due_days_after_joining": 5},
        {"task_name": "Update Bank Account and IFSC details in portal", "assigned_to": "employee", "due_days_after_joining": 3},
        {"task_name": "Complete IT asset delivery (Laptop, Keyboard, Mouse)", "assigned_to": "hr", "due_days_after_joining": 1},
        {"task_name": "Complete HR induction and policy walkthrough", "assigned_to": "hr", "due_days_after_joining": 2},
        {"task_name": "Trigger background verification (BGV)", "assigned_to": "hr", "due_days_after_joining": 7},
        {"task_name": "Configure company email and Slack access", "assigned_to": "hr", "due_days_after_joining": 1},
    ]

    for item in defaults:
        tmpl = OnboardingTemplate(
            org_id=org_id,
            task_name=item["task_name"],
            assigned_to=item["assigned_to"],
            due_days_after_joining=item["due_days_after_joining"],
        )
        db.add(tmpl)
    await db.commit()


async def initialize_onboarding_tasks_for_employee(employee_id: str, db: AsyncSession):
    """Generates standard onboarding checklist tasks for an employee based on company templates."""
    # Find employee
    emp_result = await db.execute(select(Employee).where(Employee.id == employee_id))
    emp = emp_result.scalar_one_or_none()
    if not emp:
        return

    # Seed templates if they don't exist yet
    await seed_default_onboarding_templates(emp.org_id, db)

    # Fetch templates
    tmpl_result = await db.execute(
        select(OnboardingTemplate).where(OnboardingTemplate.org_id == emp.org_id)
    )
    templates = tmpl_result.scalars().all()

    # Create tasks
    for tmpl in templates:
        due_date = None
        if emp.date_of_joining:
            due_date = emp.date_of_joining + timedelta(days=tmpl.due_days_after_joining)

        task = OnboardingTask(
            org_id=emp.org_id,
            employee_id=emp.id,
            task_name=tmpl.task_name,
            assigned_to=tmpl.assigned_to,
            status="pending",
            due_date=due_date,
        )
        db.add(task)
    await db.commit()
