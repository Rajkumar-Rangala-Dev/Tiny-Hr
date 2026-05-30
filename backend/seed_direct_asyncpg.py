import asyncio
import asyncpg
import bcrypt
import uuid
from datetime import datetime, date, timezone


# Helper to hash password exactly like bcrypt
def get_password_hash(password: str) -> str:
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode('utf-8')


async def seed():
    # Convert sqlalchemy dsn to standard asyncpg dsn
    dsn = "postgresql://postgres.vgoczlzvkzllbsffdbax:bM6MmMR42fwv5H1D@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres"
    
    print("🌱 Connecting directly via asyncpg with statement cache disabled...")
    conn = await asyncpg.connect(dsn, statement_cache_size=0)
    try:
        # 1. Ensure Organisation exists
        org_slug = "testco"
        org_row = await conn.fetchrow("SELECT id FROM organizations WHERE slug = $1", org_slug)
        if org_row:
            org_id = org_row["id"]
            print(f"Using existing organization: {org_slug} ({org_id})")
        else:
            org_id = str(uuid.uuid4())
            print(f"Creating organization: {org_slug} ({org_id})")
            await conn.execute(
                "INSERT INTO organizations (id, name, slug, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())",
                org_id, "Test Company", org_slug
            )

        # 2. Ensure Admin User exists and has correct password
        admin_email = "admin@testco.com"
        admin_pwd_hash = get_password_hash("Admin123!")
        admin_row = await conn.fetchrow("SELECT id FROM users WHERE email = $1", admin_email)
        
        if admin_row:
            print(f"Updating Admin password for {admin_email}...")
            await conn.execute(
                "UPDATE users SET hashed_password = $1, role = 'hr_admin' WHERE email = $2",
                admin_pwd_hash, admin_email
            )
        else:
            admin_id = str(uuid.uuid4())
            print(f"Creating Admin user {admin_email}...")
            await conn.execute(
                "INSERT INTO users (id, org_id, email, hashed_password, full_name, role, is_active, must_change_password, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, 'hr_admin', TRUE, FALSE, NOW(), NOW())",
                admin_id, org_id, admin_email, admin_pwd_hash, "Admin User"
            )

        # 3. Ensure Employee John Doe exists
        emp_code = "EMP101"
        emp_row = await conn.fetchrow("SELECT id FROM employees WHERE org_id = $1 AND employee_code = $2", org_id, emp_code)
        
        if emp_row:
            emp_id = emp_row["id"]
            print(f"Using existing Employee John Doe: {emp_code} ({emp_id})")
        else:
            emp_id = str(uuid.uuid4())
            print(f"Creating Employee John Doe: {emp_code} ({emp_id})")
            await conn.execute(
                "INSERT INTO employees (id, org_id, employee_code, full_name, designation, department, gross_salary, status, date_of_joining, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, NOW(), NOW())",
                emp_id, org_id, emp_code, "John Doe", "Senior Software Engineer", "Engineering", 95000.0, date(2025, 1, 1)
            )

        # 4. Ensure Employee Portal User exists
        emp_email = "employee@testco.com"
        emp_pwd_hash = get_password_hash("Employee123!")
        emp_user_row = await conn.fetchrow("SELECT id FROM users WHERE email = $1", emp_email)
        
        if emp_user_row:
            print(f"Updating Employee Portal password for {emp_email}...")
            await conn.execute(
                "UPDATE users SET hashed_password = $1, employee_id = $2, role = 'employee' WHERE email = $3",
                emp_pwd_hash, emp_id, emp_email
            )
        else:
            emp_user_id = str(uuid.uuid4())
            print(f"Creating Employee Portal user {emp_email}...")
            await conn.execute(
                "INSERT INTO users (id, org_id, employee_id, email, hashed_password, full_name, role, is_active, must_change_password, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, 'employee', TRUE, FALSE, NOW(), NOW())",
                emp_user_id, org_id, emp_id, emp_email, emp_pwd_hash, "John Doe"
            )

        print("🎉 Both test accounts successfully seeded directly into PostgreSQL!")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(seed())
