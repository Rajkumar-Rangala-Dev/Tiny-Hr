from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, org, employees, attendance, leaves, payroll, payslip, me, documents, onboarding, offboarding
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
import os

app = FastAPI(
    title="Tiny HR API",
    description="Multi-tenant HR SaaS for agencies and consultancies",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Rate limiting setup
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request, exc):
    return JSONResponse(
        status_code=429,
        content={"detail": "Rate limit exceeded. Please try again later."},
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
        "https://tinyhr.online",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(org.router, prefix="/api/v1")
app.include_router(employees.router, prefix="/api/v1")
app.include_router(attendance.router, prefix="/api/v1")
app.include_router(leaves.router, prefix="/api/v1")
app.include_router(payroll.router, prefix="/api/v1")
app.include_router(payslip.router, prefix="/api/v1")
app.include_router(me.router, prefix="/api/v1")
app.include_router(documents.router, prefix="/api/v1")
app.include_router(onboarding.router, prefix="/api/v1")
app.include_router(offboarding.router, prefix="/api/v1")


from sqlalchemy import text
from app.core.database import get_db

@app.get("/health", tags=["Health"])
async def health_check(db=Depends(get_db)):
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "ok", "service": "tiny-hr-api", "database": "connected"}
    except Exception as e:
        return {"status": "error", "service": "tiny-hr-api", "database": f"disconnected: {str(e)}"}
