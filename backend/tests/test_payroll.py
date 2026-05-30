import pytest
from app.services.payroll_service import amount_in_words, compute_salary_components
from app.models.employee import Employee, SalaryComponent


def test_amount_in_words():
    # Test typical salary values
    assert amount_in_words(15000) == "Rupees Fifteen Thousand Only"
    assert amount_in_words(150000) == "Rupees One Lakh Fifty Thousand Only"
    assert amount_in_words(5000.50) == "Rupees Five Thousand and Fifty Paise Only"
    assert amount_in_words(0) == "Zero Rupees Only"


def test_compute_salary_components_default():
    # Setup mock active employee with empty custom components
    emp = Employee(
        id="emp-1",
        employee_code="EMP001",
        full_name="John Doe",
        gross_salary=100000.0,
        salary_components=[]
    )
    
    earnings, deductions = compute_salary_components(emp, 100000.0)
    
    # Verify default earnings split (40% Basic, 20% HRA, 10% TA, 30% Special)
    assert earnings["Basic Salary"] == 40000.0
    assert earnings["HRA"] == 20000.0
    assert earnings["Travel Allowance"] == 10000.0
    assert earnings["Special Allowance"] == 30000.0
    
    # Verify default deductions split (PF employee capped at 15000 cap * 12% = 1800.0)
    assert deductions["PF (Employee)"] == 1800.0
    assert deductions["PF (Employer)"] == 1800.0
    assert deductions["Professional Tax"] == 200.0


def test_compute_salary_components_custom():
    # Setup mock custom salary components
    c1 = SalaryComponent(component_name="Basic", component_type="earning", amount=50.0, is_percentage=True)
    c2 = SalaryComponent(component_name="Internet Allowance", component_type="earning", amount=2000.0, is_percentage=False)
    c3 = SalaryComponent(component_name="PF Custom", component_type="deduction", amount=10.0, is_percentage=True, percentage_of="Basic")
    
    emp = Employee(
        id="emp-2",
        employee_code="EMP002",
        full_name="Jane Smith",
        gross_salary=60000.0,
        salary_components=[c1, c2, c3]
    )
    
    earnings, deductions = compute_salary_components(emp, 60000.0)
    
    # Verify custom earnings split
    assert earnings["Basic"] == 30000.0  # 50% of 60000
    assert earnings["Internet Allowance"] == 2000.0  # Flat
    
    # Verify custom deductions split
    assert deductions["PF Custom"] == 3000.0  # 10% of 30000 Basic
