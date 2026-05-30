import calendar
from datetime import date
from typing import List, Dict, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload
from app.models.employee import Employee, SalaryComponent
from app.models.attendance import AttendanceRecord, AttendanceStatus
from app.models.leave import LeaveRequest, LeaveRequestStatus, LeaveType
from app.models.payroll import PayrollRun, PayslipRecord, PayrollStatus
from app.models.org import Organization


def amount_in_words(amount: float) -> str:
    """Convert a float amount to Indian number words."""
    ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
            "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
            "Seventeen", "Eighteen", "Nineteen"]
    tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

    def spell(n: int) -> str:
        if n < 20:
            return ones[n]
        elif n < 100:
            return tens[n // 10] + (" " + ones[n % 10] if n % 10 else "")
        elif n < 1000:
            return ones[n // 100] + " Hundred" + (" and " + spell(n % 100) if n % 100 else "")
        elif n < 100000:
            return spell(n // 1000) + " Thousand" + (" " + spell(n % 1000) if n % 1000 else "")
        elif n < 10000000:
            return spell(n // 100000) + " Lakh" + (" " + spell(n % 100000) if n % 100000 else "")
        else:
            return spell(n // 10000000) + " Crore" + (" " + spell(n % 10000000) if n % 10000000 else "")

    rupees = int(amount)
    paise = round((amount - rupees) * 100)
    result = "Rupees " + spell(rupees) if rupees else "Zero Rupees"
    if paise:
        result += f" and {spell(paise)} Paise"
    return result + " Only"


def compute_salary_components(employee: Employee, gross_salary: float) -> Tuple[Dict, Dict]:
    """Compute earnings and deductions breakdown from salary components."""
    earnings: Dict[str, float] = {}
    deductions: Dict[str, float] = {}

    custom_earnings = {c.component_name: c for c in employee.salary_components if c.component_type == "earning"}
    custom_deductions = {c.component_name: c for c in employee.salary_components if c.component_type == "deduction"}

    if custom_earnings:
        for name, comp in custom_earnings.items():
            val = (gross_salary * comp.amount / 100) if comp.is_percentage else float(comp.amount)
            earnings[name] = round(val, 2)
    else:
        basic = round(gross_salary * 0.40, 2)
        hra = round(gross_salary * 0.20, 2)
        ta = round(gross_salary * 0.10, 2)
        special = round(gross_salary - basic - hra - ta, 2)
        earnings = {"Basic Salary": basic, "HRA": hra, "Travel Allowance": ta, "Special Allowance": special}

    if custom_deductions:
        for name, comp in custom_deductions.items():
            base = earnings.get(comp.percentage_of, gross_salary) if comp.is_percentage else gross_salary
            val = (base * comp.amount / 100) if comp.is_percentage else float(comp.amount)
            deductions[name] = round(val, 2)
    else:
        basic = earnings.get("Basic Salary", gross_salary * 0.40)
        pf_employee = round(min(basic, 15000) * 0.12, 2)
        pf_employer = round(min(basic, 15000) * 0.12, 2)
        prof_tax = 200.0
        deductions = {
            "PF (Employee)": pf_employee,
            "PF (Employer)": pf_employer,
            "Professional Tax": prof_tax,
        }
        if gross_salary <= 21000:
            esi = round(gross_salary * 0.0075, 2)
            deductions["ESI (Employee)"] = esi

    return earnings, deductions


async def compute_payslip(
    employee: Employee,
    month: int,
    year: int,
    org: Organization,
    db: AsyncSession,
    payroll_run_id: str,
) -> PayslipRecord:
    working_days = org.working_days_per_month
    cal_days = calendar.monthrange(year, month)[1]

    att_result = await db.execute(
        select(AttendanceRecord).where(
            and_(
                AttendanceRecord.employee_id == employee.id,
                func.extract("month", AttendanceRecord.date) == month,
                func.extract("year", AttendanceRecord.date) == year,
            )
        )
    )
    att_records = att_result.scalars().all()

    present = sum(1 for r in att_records if r.status in (AttendanceStatus.present, AttendanceStatus.work_from_home))
    half_day = sum(1 for r in att_records if r.status == AttendanceStatus.half_day)
    on_leave = sum(1 for r in att_records if r.status == AttendanceStatus.on_leave)
    absent = sum(1 for r in att_records if r.status == AttendanceStatus.absent)

    days_present = present + (half_day * 0.5) + on_leave
    lop_days = absent + (half_day * 0.5 if False else 0)

    leave_result = await db.execute(
        select(LeaveRequest).options(selectinload(LeaveRequest.leave_type)).where(
            and_(
                LeaveRequest.employee_id == employee.id,
                LeaveRequest.status == LeaveRequestStatus.approved,
                func.extract("month", LeaveRequest.from_date) == month,
                func.extract("year", LeaveRequest.from_date) == year,
            )
        )
    )
    leave_requests = leave_result.scalars().all()
    leaves_taken = sum(float(lr.num_days) for lr in leave_requests)

    unpaid_leaves = sum(float(lr.num_days) for lr in leave_requests if not lr.leave_type.is_paid)
    lop_days_total = max(0.0, float(absent) + unpaid_leaves)

    gross = float(employee.gross_salary)
    if working_days > 0:
        payable_days = days_present
        effective_gross = round(gross * payable_days / working_days, 2)
    else:
        effective_gross = gross

    earnings, deductions = compute_salary_components(employee, effective_gross)

    lop_deduction = round(gross * lop_days_total / working_days, 2) if working_days > 0 else 0.0
    if lop_days_total > 0:
        deductions["LOP Deduction"] = lop_deduction

    gross_earnings = round(sum(earnings.values()), 2)
    total_deductions = round(sum(deductions.values()), 2)
    net_pay = round(gross_earnings - total_deductions, 2)

    ytd_result = await db.execute(
        select(
            func.sum(PayslipRecord.gross_earnings),
            func.sum(PayslipRecord.total_deductions),
        ).where(
            and_(
                PayslipRecord.employee_id == employee.id,
                PayslipRecord.year == year,
                PayslipRecord.month < month,
            )
        )
    )
    ytd_row = ytd_result.one()
    ytd_earnings = round((ytd_row[0] or 0) + gross_earnings, 2)
    ytd_deductions = round((ytd_row[1] or 0) + total_deductions, 2)

    payslip = PayslipRecord(
        payroll_run_id=payroll_run_id,
        org_id=org.id,
        employee_id=employee.id,
        month=month,
        year=year,
        working_days=working_days,
        days_present=days_present,
        days_absent=absent,
        lop_days=lop_days_total,
        leaves_taken=leaves_taken,
        gross_earnings=gross_earnings,
        total_deductions=total_deductions,
        net_pay=net_pay,
        earnings_breakdown=earnings,
        deductions_breakdown=deductions,
        ytd_earnings=ytd_earnings,
        ytd_deductions=ytd_deductions,
    )
    return payslip


async def run_payroll(
    org_id: str,
    month: int,
    year: int,
    processed_by: str,
    db: AsyncSession,
) -> PayrollRun:
    from datetime import datetime, timezone

    org_result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = org_result.scalar_one_or_none()
    if not org:
        raise ValueError("Organization not found")

    emp_result = await db.execute(
        select(Employee).where(
            and_(Employee.org_id == org_id, Employee.status == "active")
        ).options()
    )
    employees = emp_result.scalars().all()

    payroll_run = PayrollRun(
        org_id=org_id,
        month=month,
        year=year,
        status=PayrollStatus.draft,
        processed_by=processed_by,
        processed_at=datetime.now(timezone.utc),
    )
    db.add(payroll_run)
    await db.flush()

    total_gross = 0.0
    total_deductions = 0.0
    total_net = 0.0

    for emp in employees:
        emp_with_comps = await db.execute(
            select(Employee).where(Employee.id == emp.id)
        )
        emp_full = emp_with_comps.scalar_one()
        payslip = await compute_payslip(emp_full, month, year, org, db, payroll_run.id)
        db.add(payslip)
        total_gross += payslip.gross_earnings
        total_deductions += payslip.total_deductions
        total_net += payslip.net_pay

    payroll_run.total_gross = round(total_gross, 2)
    payroll_run.total_deductions = round(total_deductions, 2)
    payroll_run.total_net = round(total_net, 2)
    payroll_run.status = PayrollStatus.processed

    await db.commit()
    await db.refresh(payroll_run)
    return payroll_run
