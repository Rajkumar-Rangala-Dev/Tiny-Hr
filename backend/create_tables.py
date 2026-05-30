import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.database import Base
from app.models import *  # Import all models to register them on Base

async def init_db():
    print("🚀 Initializing database tables...")
    # Use standard pooler URL with statement cache disabled
    direct_url = "postgresql+asyncpg://postgres.vgoczlzvkzllbsffdbax:bM6MmMR42fwv5H1D@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres"
    direct_engine = create_async_engine(
        direct_url,
        connect_args={
            "prepared_statement_cache_size": 0,
            "statement_cache_size": 0,
        }
    )
    
    async with direct_engine.begin() as conn:
        # This will safely run CREATE TABLE IF NOT EXISTS for all defined models
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Database tables created successfully!")

if __name__ == "__main__":
    asyncio.run(init_db())


