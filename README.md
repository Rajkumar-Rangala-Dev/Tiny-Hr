# Tiny HR

A lightweight HR SaaS for agencies and consultancies — attendance via CSV, leave management, payroll, and payslip PDFs.

## Stack

| Layer | Choice |
|---|---|
| Backend | Python + FastAPI (async) |
| Database | PostgreSQL via Supabase |
| ORM | SQLAlchemy 2.0 (async) |
| Auth | JWT tokens (Supabase Auth compatible) |
| PDF | WeasyPrint + Jinja2 |
| Frontend | Next.js 14 App Router + shadcn/ui + Tailwind |
| Storage | Supabase Storage |

## Project Structure

```
tiny-hr/
├── backend/
│   ├── app/
│   │   ├── core/          # config, db, security, storage
│   │   ├── models/        # SQLAlchemy models
│   │   ├── schemas/       # Pydantic schemas
│   │   ├── services/      # business logic
│   │   ├── routers/       # FastAPI routes
│   │   ├── templates/     # Jinja2 payslip HTML
│   │   └── main.py
│   ├── alembic/           # DB migrations
│   ├── requirements.txt
│   └── Dockerfile
└── frontend/
    ├── app/
    │   ├── (auth)/        # login, register pages
    │   └── (app)/         # dashboard, employees, attendance, leaves, payroll, settings
    ├── components/
    │   ├── ui/            # shadcn/ui base components
    │   └── layout/        # sidebar
    ├── lib/               # api client, auth context, utils
    └── Dockerfile
```

## Getting Started

### 1. Backend setup

```bash
cd backend
cp .env.example .env
# Fill in your Supabase credentials in .env
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

API docs: http://localhost:8000/docs

### 2. Frontend setup

```bash
cd frontend
cp .env.local.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
npm install
npm run dev
```

App: http://localhost:3000

### 3. Docker Compose (full stack)

```bash
# From project root — requires a real DATABASE_URL in backend/.env
docker compose up --build
```

## Environment Variables (backend)

| Variable | Description |
|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://...` connection string |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for storage access |
| `SUPABASE_JWT_SECRET` | JWT secret for token verification |
| `SECRET_KEY` | Long random string for JWT signing |
| `STORAGE_BUCKET_DOCS` | Supabase bucket for employee docs |
| `STORAGE_BUCKET_PAYSLIPS` | Supabase bucket for payslip PDFs |
| `STORAGE_BUCKET_LOGOS` | Supabase bucket for org logos |

## Core Features (Phase 1)

- **Attendance** — CSV upload with preview/diff + manual marking
- **Leave Management** — leave types, balances, request/approval workflow
- **Payroll** — monthly payroll run with LOP calculation, lock/unlock
- **Payslips** — PDF via WeasyPrint, company logo watermark, header/footer, earnings/deductions breakdown, YTD totals
- **Employee CRUD** — with CSV bulk import
- **Org Settings** — company details, logo upload, payslip branding

## Payslip PDF

Generated server-side using WeasyPrint from a Jinja2 HTML template:
- Company logo (header + diagonal watermark)
- Earnings table: Basic, HRA, TA, Special Allowance
- Deductions table: PF (employee + employer), ESI, PT, TDS, LOP
- Net pay (amount in words)
- YTD earnings/deductions columns
- Attendance summary
- Configurable footer text and watermark opacity

## Deployment

- **Frontend** → Vercel (`vercel deploy`)
- **Backend** → Railway or Render (Docker)
- **Database/Auth/Storage** → Supabase
