import asyncio
from app.core.database import engine
import sqlalchemy


async def main():
    async with engine.begin() as conn:
        try:
            print("Altering userrole enum in PostgreSQL...")
            await conn.execute(sqlalchemy.text("ALTER TYPE userrole ADD VALUE 'employee'"))
            print("Successfully added 'employee' value to userrole enum!")
        except Exception as e:
            print(f"Enum update note (it might already exist): {str(e)}")


if __name__ == "__main__":
    asyncio.run(main())
