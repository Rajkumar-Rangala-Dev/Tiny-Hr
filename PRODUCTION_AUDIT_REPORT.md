# Tiny HR — Production Readiness Audit Report

**Auditor:** Senior Testing Engineer / DevOps Engineer / Product Manager  
**Date:** May 30, 2026  
**Project:** Tiny HR — Multi-tenant HR SaaS  
**Overall Verdict:** NOT PRODUCTION-READY — Major security, stability, and completeness gaps exist.

---

## 1. Executive Summary

Tiny HR has a solid foundation with **Phases 1–4 mostly implemented** (core HR, payroll, leaves, employee portal, document generation, onboarding). However, **critical security vulnerabilities, missing backend authorization guards, incomplete features, and DevOps gaps make this unsuitable for production deployment** in its current state. A real-world HR system handles sensitive PII, salary data, and legal documents — the current codebase lacks the hardened security and operational reliability required.

**Estimated Effort to Production-Ready:** 3–4 weeks of focused engineering.

---

## 2. Feature Implementation Audit

### Phase 1: Core HR Platform
| Feature | Status | Notes |
|---------|--------|-------|
| Organization registration | ✅ Implemented | Working with slug generation |
| Employee CRUD | ✅ Implemented | Full create, read, update, archive |
| Employee CSV import | ✅ Implemented | Basic CSV parsing with pandas |
| Attendance CSV upload | ✅ Implemented | Preview + commit workflow |
| Manual attendance marking | ✅ Implemented | Admin-only UI |

### Phase 2: Payroll
| Feature | Status | Notes |
|---------|--------|-------|
| Payroll runs | ✅ Implemented | Draft → processed → locked lifecycle |
| Salary component customization | ✅ Implemented | Percentage or fixed amount |
| Payslip generation | ✅ Implemented | PDF via WeasyPrint |
| YTD calculations | ✅ Implemented | Year-to-date earnings/deductions |
| Payslip ZIP download | ✅ Implemented | Bulk download for payroll run |

### Phase 3: Leave Management
| Feature | Status | Notes |
|---------|--------|-------|
| Leave types | ✅ Implemented | Customizable per org |
| Leave balance initialization | ✅ Implemented | Batch insert with deduping |
| Leave requests | ✅ Implemented | Employee apply, admin review |
| Leave approval workflow | ✅ Implemented | Auto-updates attendance on approve |
| Email notifications on review | ✅ Implemented | Mock email logging |

### Phase 4: Employee Portal + Documents + Onboarding
| Feature | Status | Notes |
|---------|--------|-------|
| `employee` user role | ✅ Implemented | Role enum + `employee_id` FK |
| Employee invite flow | ✅ Implemented | `POST /auth/employee/invite` |
| Set password from invite | ✅ Implemented | `POST /auth/employee/set-password` |
| `/me/profile` | ✅ Implemented | View + update personal/banking info |
| `/me/attendance` | ✅ Implemented | Self-view only |
| `/me/leaves` | ✅ Implemented | Apply + view history + balances |
| `/me/payslips` | ✅ Implemented | List + download own payslips |
| `/me/dashboard` | ✅ Implemented | Leave balance, attendance, payslip summary |
| Document templates | ✅ Implemented | Jinja2 + WeasyPrint PDF generation |
| Document issuance | ✅ Implemented | Experience, relieving, salary cert letters |
| Onboarding templates | ✅ Implemented | Default checklist per org |
| Onboarding tasks | ✅ Implemented | Per-employee task tracking |
| Employee onboarding UI | ✅ Implemented | `/me/onboarding` checklist |
| Role-based sidebar | ✅ Implemented | Different nav for admin vs employee |
| Route guards | ⚠️ Partial | Layout has `ADMIN_ONLY_ROUTES` but login redirect is broken |

### Phase 4 Features — NOT IMPLEMENTED
| Feature | Status | Impact |
|---------|--------|--------|
| **Offboarding workflow** | ❌ Missing | No `offboarding_cases` or `offboarding_tasks` tables. Employee detail page has a "Mark as Separated" button but no structured workflow, clearance checklist, or auto-letter generation on completion. |
| **Forgot / reset password** | ❌ Missing | No `POST /auth/forgot-password` or `POST /auth/reset-password` endpoints. Critical for self-service. |
| **`/me/documents` request page** | ❌ Missing | Backend supports employee document requests, but no frontend page exists. |
| **Tenant-aware JWT (`org_slug`)** | ❌ Missing | JWT only has `org_id`, not `org_slug`. Subdomain middleware deferred. |
| **Admin `/admin/*` route restructure** | ❌ Missing | All admin pages still at root routes (`/employees`, `/attendance`, etc.). Plan called for `/admin/*` prefix. |
| **Email SMTP integration** | ❌ Missing | Only mock email logging to stdout. Production needs SendGrid/AWS SES/SMTP. |

---

## 3. Security Audit — CRITICAL FINDINGS

### 🔴 CRITICAL: No Role Authorization on Multiple Endpoints
**Risk:** Any authenticated employee can access/modify admin data.

| Endpoint File | Endpoint | Missing Guard |
|--------------|----------|---------------|
| `employees.py` | `GET /employees/` | No role check — employee sees ALL employees |
| `employees.py` | `GET /employees/{id}` | No role check — employee sees any employee's full profile + salary |
| `employees.py` | `PATCH /employees/{id}` | No role check — employee can modify ANY employee's data |
| `employees.py` | `DELETE /employees/{id}` | No role check — employee can archive anyone |
| `employees.py` | `POST /employees/import/csv` | No role check — employee can bulk import |
| `attendance.py` | `GET /attendance/employee/{id}` | No role check — employee views anyone's attendance |
| `attendance.py` | `GET /attendance/summary` | No role check — employee sees org-wide summary |
| `leaves.py` | `GET /leaves/requests` | No role check — employee sees ALL leave requests |
| `leaves.py` | `GET /leaves/balances/{id}` | No role check — employee sees anyone's balances |
| `leaves.py` | `POST /leaves/requests` | No self-check — employee can apply leave for ANY employee_id |
| `payslip.py` | `GET /payslips/{id}/download-url` | No role check — employee downloads any payslip |
| `payslip.py` | `POST /payslips/{id}/generate` | No role check — employee can trigger PDF gen for anyone |
| `documents.py` | `GET /documents/` | No role check — employee sees all org documents |
| `documents.py` | `POST /documents/` | No self-check — employee can create docs for anyone |
| `payroll.py` | `GET /payroll/runs` | No role check — employee sees all payroll data |
| `payroll.py` | `GET /payroll/runs/{id}` | No role check — employee sees detailed payroll runs |

**Fix:** Add `require_roles` dependency to ALL admin endpoints. For employee-scoped endpoints, verify `current_user.employee_id == requested_employee_id`.

### 🔴 CRITICAL: Hardcoded Secrets in `.env`
**Risk:** Database password, Supabase service role key, JWT secret all in plaintext file.

```
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...REDACTED
DATABASE_URL=postgresql+asyncpg://postgres...:REDACTED@...
SECRET_KEY=sb_secret_REDACTED_FOR_SECURITY
```

**Fix:**
- `.env` must be in `.gitignore` (verify it's not committed)
- Use Docker secrets, AWS Secrets Manager, or HashiCorp Vault in production
- Rotate ALL exposed credentials immediately

### 🔴 CRITICAL: CORS Too Permissive
```python
allow_origins=["http://localhost:3000", "https://*.vercel.app"]
allow_methods=["*"]
allow_headers=["*"]
```

`https://*.vercel.app` allows ANY Vercel deployment to make authenticated requests. In production, restrict to exact domains.

### 🟡 HIGH: No Rate Limiting
Auth endpoints (`/auth/login`, `/auth/register`) have no rate limiting. Vulnerable to brute-force and credential stuffing attacks.

**Fix:** Add `slowapi` or nginx rate limiting (e.g., 5 login attempts per IP per minute).

### 🟡 HIGH: No HTTPS Enforcement
No `Secure` flag on cookies, no HSTS headers, no HTTPS redirect middleware.

### 🟡 HIGH: JWT Token Missing Key Claims
No `iat` (issued at), `jti` (JWT ID for revocation), or `aud` (audience) claims. No token revocation mechanism.

### 🟡 MEDIUM: SQL Injection Risk in Search
`employees.py` line 66:
```python
query = query.where(Employee.full_name.ilike(f"%{search}%"))
```
While SQLAlchemy parametrizes this, the `%` wildcard injection could cause performance issues (full table scans). Add max length validation.

---

## 4. Backend Stability & Reliability

### 🔴 CRITICAL: Silent Error Swallowing
Multiple empty catch blocks make debugging impossible:
- `frontend/app/(app)/employees/[id]/page.tsx` line 98: `catch { /* no attendance data */ }`
- `frontend/app/(app)/attendance/page.tsx` line 86: `catch { setError("Failed to parse CSV") }` — loses actual error

**Fix:** Log all errors with context. Use a structured logger (e.g., `structlog`).

### 🟡 HIGH: `NullPool` Disables Connection Pooling
```python
poolclass=NullPool
```
Every request creates a new DB connection. Under load, this will exhaust Supabase connection limits and cause cascading failures.

**Fix:** Use `AsyncAdaptedQueuePool` with `pool_size=5`, `max_overflow=10`, `pool_recycle=300`.

### 🟡 HIGH: Health Check Doesn't Verify DB
`/health` only returns `{"status": "ok"}`. In production, health checks must verify database connectivity, storage accessibility, and critical dependencies.

### 🟡 HIGH: No Request Timeout on External Calls
`storage.py` uses `httpx.AsyncClient()` with no timeout. If Supabase Storage is slow, requests hang indefinitely.

**Fix:** `httpx.AsyncClient(timeout=10.0)`

### 🟡 MEDIUM: No Database Transaction Retries
Supabase pgbouncer can drop connections. No retry logic for `asyncpg` disconnections.

### 🟡 MEDIUM: Bug in Payroll Logic
`payroll_service.py` line 126:
```python
unpaid_leaves = sum(float(lr.num_days) for lr in leave_requests if True)
```
`if True` is a bug — it counts ALL approved leaves as unpaid. Should filter by leave type or unpaid flag.

---

## 5. Frontend Issues

### 🔴 CRITICAL: Login Always Redirects to `/dashboard`
`frontend/app/(auth)/login/page.tsx` line 25:
```typescript
router.push("/dashboard");
```
Employees should be redirected to `/me/dashboard`. This causes the reported issue where employees see admin dashboards.

### 🔴 CRITICAL: Wrong Import in `me/profile/page.tsx`
Line 5:
```typescript
import { Button } from "@/components/ui/card"; // WRONG PATH
```
Should be `@/components/ui/button`. This will cause a build/runtime error.

### 🟡 HIGH: No Input Validation on Frontend Forms
No client-side validation for:
- Phone number format
- Bank account number length
- IFSC code format (11 chars)
- Date of birth (must be in past, 18+ years old)
- PAN format (ABCDE1234F)

### 🟡 MEDIUM: No Loading State for Sidebar Navigation
Sidebar shows nav items immediately without checking auth state. Flickers admin nav briefly before redirect.

### 🟡 MEDIUM: No Error Boundary
Any unhandled React error crashes the entire app. No `error.tsx` or `global-error.tsx` files found.

---

## 6. DevOps & Infrastructure

### 🔴 CRITICAL: Docker Compose is Development-Only
```yaml
volumes:
  - ./backend:/app
command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
- Volume mount leaks host filesystem into container
- `--reload` is for development only
- No restart policy
- No resource limits
- No health checks

### 🔴 CRITICAL: No Production Docker Compose
No `docker-compose.prod.yml` or Kubernetes manifests. No reverse proxy (nginx/traefik) configuration.

### 🟡 HIGH: Frontend Dockerfile Assumes Standalone Output
```dockerfile
COPY --from=builder /app/.next/standalone ./
```
But `next.config.js` does NOT have `output: 'standalone'`. Build will fail.

### 🟡 HIGH: No CI/CD Pipeline
No GitHub Actions, GitLab CI, or any automated build/test/deploy pipeline.

### 🟡 MEDIUM: No Log Aggregation
Logs go to stdout only. No ELK stack, Datadog, or CloudWatch integration.

### 🟡 MEDIUM: No Monitoring / Alerting
No Prometheus metrics, no application performance monitoring (APM), no error tracking (Sentry).

---

## 7. Database & Migrations

### ✅ GOOD: Alembic Migrations Exist
- `aa88e7137263_initial.py` — Base schema
- `25801f3082fa_add_employee_role_and_user_employee_link.py` — Employee role
- `13f0a3c7c1ae_create_document_tables.py` — Document tables
- `3c852f5146f4_create_onboarding_tables.py` — Onboarding tables

### 🟡 MEDIUM: No Database Backup Documentation
No mention of backup strategy, PITR configuration, or disaster recovery procedures.

### 🟡 MEDIUM: Missing Indexes
No indexes on frequently queried columns:
- `users.email` — has unique constraint (index implied)
- `employees.org_id + status` — composite index needed
- `attendance_records.employee_id + date` — composite index needed
- `leave_requests.employee_id + status` — composite index needed
- `payslip_records.employee_id + month + year` — composite index needed

---

## 8. Testing

### 🔴 CRITICAL: No Unit Tests
Zero pytest unit tests for business logic (payroll calculations, leave balance updates, document generation).

### 🔴 CRITICAL: No Integration Tests
No tests for API endpoints, auth flows, or database transactions.

### 🟡 MEDIUM: Minimal E2E Test
`test_e2e_portal.py` only checks `/health` endpoint and prints static success messages. It does NOT actually test any business logic.

### 🟡 MEDIUM: No Frontend Tests
No Jest, React Testing Library, or Playwright/Cypress tests.

---

## 9. Compliance & Data Privacy

### 🔴 CRITICAL: No GDPR/Data Privacy Compliance
- No data retention policies
- No user data export (right to data portability)
- No account deletion flow (right to erasure)
- No consent management
- No audit logging of who accessed what data

### 🟡 HIGH: PII Stored Without Encryption
Employee PAN, UAN, bank account numbers, and addresses stored in plaintext in PostgreSQL. While database-level encryption is acceptable, field-level encryption for financial data is recommended.

### 🟡 MEDIUM: No Audit Trail
No `created_by`, `updated_by`, `deleted_by`, `deleted_at` tracking on critical tables. Cannot answer "who changed this employee's salary?"

---

## 10. Recommended Production Roadmap

### Week 1: Security Hardening (BLOCKER)
1. **Add role guards to ALL admin endpoints** — `require_roles(UserRole.hr_admin, UserRole.super_admin)`
2. **Add self-scope checks to employee endpoints** — verify `current_user.employee_id == target_id`
3. **Rotate all secrets** — Database password, Supabase keys, JWT secret
4. **Add `.env` to `.gitignore`** and use environment injection
5. **Fix CORS** — Restrict to exact production domains
6. **Add rate limiting** — `slowapi` on auth endpoints
7. **Fix login redirect** — Route employees to `/me/dashboard`

### Week 2: Stability & Reliability
1. **Replace `NullPool`** with proper async connection pooling
2. **Add DB health check** to `/health` endpoint
3. **Add timeouts** to all external HTTP calls
4. **Fix payroll bug** — `unpaid_leaves` logic
5. **Fix frontend import bug** — `me/profile/page.tsx`
6. **Add structured logging** — `structlog` or Python `logging` with JSON format
7. **Add request ID middleware** for traceability

### Week 3: Missing Features
1. **Implement offboarding workflow** — `offboarding_cases` + `offboarding_tasks` tables
2. **Forgot/reset password** — Email token + reset flow
3. **`/me/documents` frontend page**
4. **SMTP email integration** — Replace mock email service
5. **Input validation** — PAN, IFSC, phone, bank account formats
6. **Add database indexes** for performance

### Week 4: DevOps & Testing
1. **Create `docker-compose.prod.yml`** with:
   - nginx reverse proxy
   - SSL/TLS termination
   - Proper restart policies
   - Resource limits
   - No volume mounts
2. **Fix Next.js standalone output** in `next.config.js`
3. **Write unit tests** — Payroll calculations, auth, leave balances
4. **Write integration tests** — All API endpoints with role checks
5. **Set up CI/CD** — GitHub Actions for build, test, deploy
6. **Add Sentry** or similar for error tracking
7. **Add Prometheus metrics** for API monitoring

### Week 5: Compliance & Polish
1. **Add audit logging** — Who changed what and when
2. **Field-level encryption** for PAN, bank accounts
3. **Data export endpoint** — GDPR right to portability
4. **Soft delete** with `deleted_at` columns
5. **Performance testing** — Load test with 100+ concurrent users
6. **Security audit** — OWASP Top 10 review, dependency vulnerability scan

---

## 11. Quick Wins (Can Deploy Immediately)

These are safe to deploy now without major refactoring:

1. ✅ Fix `router.push("/dashboard")` → role-aware redirect
2. ✅ Fix `Button` import in `me/profile/page.tsx`
3. ✅ Add `output: 'standalone'` to `next.config.js`
4. ✅ Add `ADMIN_ONLY_ROUTES` to `/dashboard` so employees can't access it
5. ✅ Add basic role checks to `employees.py`, `attendance.py`, `leaves.py`, `payslip.py`

---

## 12. Final Verdict

| Category | Score | Status |
|----------|-------|--------|
| Feature Completeness | 70% | Most Phase 4 features exist, offboarding missing |
| Security | 30% | Critical auth gaps, secrets exposed, no rate limiting |
| Backend Stability | 50% | Silent errors, no pooling, health check insufficient |
| Frontend Quality | 60% | Import bugs, missing validation, no error boundaries |
| DevOps Readiness | 20% | Dev-only Docker, no CI/CD, no monitoring |
| Testing Coverage | 5% | Almost no tests |
| Compliance | 10% | No GDPR, no audit trail, PII in plaintext |

**Overall Production Readiness: 35%**

**Recommendation:** Do NOT deploy to production. Complete Week 1 (Security) and Week 2 (Stability) minimums before any production deployment. Full production readiness requires all 5 weeks.

---

*Report generated by comprehensive static code audit of backend (FastAPI/SQLAlchemy), frontend (Next.js/React), infrastructure (Docker), and security configurations.*
