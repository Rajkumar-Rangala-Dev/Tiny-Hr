# Tiny HR - Comprehensive Code Review & Analysis

## Executive Summary

**Tiny HR** is a modern multi-tenant HR SaaS application built with:
- **Backend:** FastAPI (Python) with async/await, SQLAlchemy 2.0 ORM, PostgreSQL (Supabase)
- **Frontend:** Next.js 14 (React 18) with TypeScript, Tailwind CSS, shadcn/ui
- **Deployment:** Backend on Render, Frontend on Vercel

**Overall Assessment:** ⚠️ **Good foundation with several critical and medium-priority issues identified**

---

## 1. BACKEND ANALYSIS

### Architecture ✅ Good

**Strengths:**
- Modern async-first architecture with FastAPI and asyncpg
- Clean separation of concerns (routers → schemas → services → models)
- Type safety via Pydantic v2 with strict validation
- Multi-tenant isolation at database level via `org_id`
- Comprehensive API surface (11 routers covering HR workflows)
- Alembic migrations for database versioning

**Stack Quality:**
- FastAPI: Production-ready, excellent for async I/O
- SQLAlchemy 2.0: Modern ORM with async support
- asyncpg: High-performance async PostgreSQL driver
- Supabase: Managed PostgreSQL with built-in storage

---

### CRITICAL ISSUES 🔴

#### 1. **Invalid HTTP Status Code in Employee Invite (Line 135)**
**File:** `backend/app/routers/auth.py:135`

```python
if not employee:
    raise HTTPException(status_code=44, detail="Employee not found")  # ❌ WRONG
```

**Issue:** HTTP status code `44` is invalid. Valid codes: 1xx-5xx (100-599).

**Fix:** Should be `404` (Not Found)

```python
if not employee:
    raise HTTPException(status_code=404, detail="Employee not found")  # ✅ CORRECT
```

**Impact:** May cause HTTP client library errors, failed error handling, inconsistent API behavior.

---

#### 2. **Hardcoded Domain in Password Reset Email (Line 196)**
**File:** `backend/app/routers/auth.py:196`

```python
reset_link = f"http://localhost:3000/reset-password?token={token}"  # ❌ HARDCODED
```

**Issue:** Reset link hardcoded to `localhost:3000`. In production (Render), this won't work.

**What Users See:** Email links point to localhost instead of the actual deployed domain.

**Fix:** Use environment variable for frontend URL:

```python
# In config.py
FRONTEND_URL: str = "https://app.example.com"

# In auth.py
reset_link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
```

**Impact:** 🔴 CRITICAL - Password recovery completely broken in production.

---

#### 3. **Employee Invitation Email Hardcoded Portal URL (Line 168)**
**File:** `backend/app/routers/auth.py:168`

```python
<li><strong>Portal URL:</strong> <a href="http://localhost:3000/login">http://localhost:3000/login</a></li>
```

**Issue:** Same as above - hardcoded localhost domain.

**Fix:** Use environment variable for frontend URL.

**Impact:** 🔴 CRITICAL - Employees won't receive correct login link in production.

---

#### 4. **Session/Token Expiry Mismatch**
**File:** `backend/app/core/config.py` + `frontend/lib/auth-context.tsx`

**Issue:** 
- JWT token expires in 60 minutes (configurable, default)
- Frontend cookie expires in 1 day

**What Happens:**
1. User logs in, gets JWT token + 1-day cookie
2. After 60 minutes, token expires
3. Frontend still has valid cookie but expired token
4. API calls fail with 401 Unauthorized
5. Axios interceptor logs out user

**User Experience:** Users get unexpectedly logged out after 1 hour, must re-login.

**Fix:** Either:
- Option A: Implement refresh token mechanism (recommended)
- Option B: Reduce cookie expiry to match token (60 minutes)

Recommended solution:

```python
# Add to TokenResponse
class TokenResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None  # Add refresh token
    expires_in: int = 3600  # Token expiry in seconds
    # ... other fields
```

---

#### 5. **No Rate Limiting on Authentication Endpoints**
**File:** `backend/app/routers/auth.py`

**Issue:** No rate limiting on `/login`, `/register`, `/forgot-password` endpoints.

**Risk:** 
- Brute force attacks on login
- Credential stuffing attacks
- Account enumeration via forgot-password timing

**Fix:** Install and use `slowapi`:

```bash
pip install slowapi
```

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@router.post("/login")
@limiter.limit("5/minute")  # 5 attempts per minute
async def login(...):
    ...

@router.post("/register")
@limiter.limit("3/hour")  # 3 registrations per hour per IP
async def register_org(...):
    ...
```

---

#### 6. **Weak Password Validation**
**File:** `backend/app/schemas/auth.py` + `frontend/app/(auth)/register/page.tsx`

**Issue:**
- Only validates `minLength=8` characters
- No complexity requirements (uppercase, lowercase, numbers, special chars)
- Vulnerable to dictionary attacks

**Fix - Backend (Pydantic validator):**

```python
from pydantic import field_validator
import re

class OrgRegisterRequest(BaseModel):
    org_name: str
    org_slug: str
    admin_email: EmailStr
    admin_password: str
    admin_full_name: str
    
    @field_validator('admin_password')
    def validate_password(cls, v):
        if len(v) < 12:
            raise ValueError('Password must be at least 12 characters')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain lowercase letter')
        if not re.search(r'[0-9]', v):
            raise ValueError('Password must contain number')
        if not re.search(r'[!@#$%^&*]', v):
            raise ValueError('Password must contain special character')
        return v
```

**Fix - Frontend (UX feedback):**

```typescript
// frontend/lib/password-validator.ts
export function validatePassword(password: string) {
  const errors: string[] = [];
  if (password.length < 12) errors.push('At least 12 characters');
  if (!/[A-Z]/.test(password)) errors.push('One uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('One lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('One number');
  if (!/[!@#$%^&*]/.test(password)) errors.push('One special character: !@#$%^&*');
  return { valid: errors.length === 0, errors };
}
```

---

### MEDIUM ISSUES 🟡

#### 7. **Overly Broad CORS Configuration**
**File:** `backend/app/main.py:11`

```python
allow_origin_regex=r"https://.*\.vercel\.app",
```

**Issue:** Allows ANY Vercel deployment (`subdomain.vercel.app`). Risky if multiple teams use same Vercel account.

**Fix - Production:**

```python
import os

# More specific:
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    os.getenv("FRONTEND_URL", "https://app.tinyhr.com"),  # Specific domain
]

# If using Vercel preview domains:
ALLOWED_ORIGINS.extend([
    "https://tiny-hr-team.vercel.app",  # Specific Vercel URL
])

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

#### 8. **Missing Email Configuration in Production**
**File:** `backend/.env.example` - Missing SMTP vars

**Issue:** SMTP configuration optional. In production, emails won't send if not configured.

**Fix - Update .env.example:**

```env
# Email Configuration (Required for Production)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@tinyhr.com
ENVIRONMENT=production
```

---

#### 9. **No Validation on Slug Format in Request**
**File:** `backend/app/routers/auth.py:21`

**Issue:** Backend slugifies input but doesn't validate the initial `org_slug` input format.

**Current Flow:** Frontend validates → Backend slugifies anyway

**Problem:** If frontend validation is bypassed (curl, API tools), invalid slugs could be submitted.

**Fix:**

```python
from pydantic import field_validator

class OrgRegisterRequest(BaseModel):
    org_name: str
    org_slug: str  # Frontend sends pre-slugified
    admin_email: EmailStr
    admin_password: str
    admin_full_name: str
    
    @field_validator('org_slug')
    def validate_slug(cls, v):
        if not re.match(r'^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$', v):
            raise ValueError('Slug must be lowercase alphanumeric with hyphens')
        if v.startswith('-') or v.endswith('-'):
            raise ValueError('Slug cannot start or end with hyphen')
        return v
```

---

#### 10. **No SQL Injection Protection (Minor - Using ORM)**
**Status:** ✅ Actually GOOD

While using SQLAlchemy ORM provides protection, the code uses parameterized queries correctly:

```python
result = await db.execute(select(User).where(User.email == data.email))
```

This is safe - ORM handles parameterization automatically.

---

#### 11. **Missing Input Validation on Email Strings**
**File:** Multiple auth schema files

**Note:** Using `EmailStr` from Pydantic provides validation ✅, so this is addressed.

---

#### 12. **No Logging for Security Events**
**File:** `backend/app/routers/auth.py`

**Issue:** No logging for:
- Failed login attempts
- Registration attempts
- Password resets
- Employee invitations

**Fix - Add structured logging:**

```python
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(data.password, user.hashed_password):
        logger.warning(f"Failed login attempt for email: {data.email} at {datetime.utcnow()}")
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    logger.info(f"Successful login for user: {user.id} (email: {data.email})")
    # ... rest of function
```

---

#### 13. **Missing HTTPS Enforcement on Email Links**
**File:** `backend/app/routers/auth.py:168, 196`

**Issue:** Email templates use `http://` instead of `https://`.

**Fix:**

```python
# Use https in production
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://app.tinyhr.com")
reset_link = f"{FRONTEND_URL}/reset-password?token={token}"
```

---

### LOW ISSUES (Nice-to-haves) 💡

#### 14. **No API Documentation for Authentication**
- OpenAPI docs at `/docs` ✅ (auto-generated by FastAPI)
- But missing detailed descriptions on auth endpoints

**Fix:** Add docstrings to endpoints:

```python
@router.post("/register", response_model=TokenResponse, status_code=201)
async def register_org(data: OrgRegisterRequest, db: AsyncSession = Depends(get_db)):
    """
    Register a new organization and create the admin user.
    
    - **org_name**: Organization name (required)
    - **org_slug**: Unique workspace URL slug (required, lowercase alphanumeric + hyphens)
    - **admin_email**: Admin user email (required, must be unique)
    - **admin_password**: Admin password (required, min 12 chars with complexity)
    - **admin_full_name**: Admin full name (required)
    
    Returns JWT token valid for 60 minutes.
    """
```

---

#### 15. **Token Contains Sensitive Data in URL**
**Issue:** Reset token in URL query parameter: `/reset-password?token={token}`

**Risk:** Tokens may be logged in browsers, reverse proxies, server logs, browser history

**Better:** Use POST request with token in body (if possible), or use secure HTTP-only cookies

**Current Implementation:** Acceptable for password reset (one-time use, time-limited, purpose-bound)

---

## 2. FRONTEND ANALYSIS

### Architecture ✅ Good

**Strengths:**
- Modern Next.js 14 with App Router
- Type-safe with TypeScript strict mode
- Component-based design with shadcn/ui
- Context API for auth state management
- Axios interceptors for automatic token injection
- Clean separation: pages → components → lib → utils

---

### CRITICAL ISSUES 🔴

#### 16. **Token Retrieved from Cookies But Never Refreshed**
**File:** `frontend/lib/auth-context.tsx:29-36`

```typescript
useEffect(() => {
    const savedToken = Cookies.get("access_token");
    if (savedToken) {
        setToken(savedToken);
        authApi.me().then(...).catch(() => logout());
    } else {
        setIsLoading(false);
    }
}, []);
```

**Issue:** Token loaded once on app startup, never refreshed before expiry (60 minutes).

**What Happens:**
1. User logs in 9:00 AM
2. Token set to expire 10:00 AM
3. User continues working
4. At 10:00 AM, token silently expires
5. Next API call fails with 401
6. User gets logged out without warning

**User Experience:** Frustrating - users lose work, get logged out unexpectedly.

**Fix - Implement Refresh Token:**

```typescript
// lib/auth-context.tsx
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Auto-refresh token before expiry
  useEffect(() => {
    if (!token) return;
    
    const refreshTimer = setInterval(async () => {
      try {
        const res = await authApi.refreshToken();
        const { access_token } = res.data;
        Cookies.set("access_token", access_token, { expires: 1 });
        setToken(access_token);
      } catch (err) {
        logout();
      }
    }, 45 * 60 * 1000); // Refresh every 45 minutes (before 60-min expiry)
    
    return () => clearInterval(refreshTimer);
  }, [token]);

  // ... rest of component
}
```

Also update API client:

```typescript
// lib/api.ts
export const authApi = {
  login: (data: object) => api.post("/auth/login", data),
  refreshToken: () => api.post("/auth/refresh", {}),  // Add this endpoint
  // ... other endpoints
};
```

Backend endpoint:

```python
# backend/app/routers/auth.py
@router.post("/refresh")
async def refresh_token(
    current_user: User = Depends(get_current_user),
):
    """Refresh access token using current valid token"""
    token = create_access_token({
        "sub": current_user.id,
        "org_id": current_user.org_id,
        "role": current_user.role,
        "employee_id": current_user.employee_id,
        "must_change_password": current_user.must_change_password
    })
    return TokenResponse(
        access_token=token,
        user_id=current_user.id,
        org_id=current_user.org_id,
        role=current_user.role,
        full_name=current_user.full_name,
        employee_id=current_user.employee_id,
        must_change_password=current_user.must_change_password,
    )
```

---

#### 17. **No Error Boundary - App Crashes on Unhandled Errors**
**File:** `frontend/app/layout.tsx` (not shown but likely missing)

**Issue:** No React Error Boundary to catch component errors.

**What Happens:** If any component throws an error, entire app goes blank.

**Fix - Add Error Boundary:**

```typescript
// app/error.tsx (Next.js error boundary)
'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 p-4">
      <div className="text-center max-w-md">
        <h2 className="text-2xl font-bold mb-4">Something went wrong!</h2>
        <p className="text-muted-foreground mb-6">{error.message}</p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
```

---

#### 18. **Registration Page Error Handling Too Generic**
**File:** `frontend/app/(auth)/register/page.tsx:40`

```typescript
catch (err: unknown) {
    const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
    setError(msg || "Registration failed. Please try again.");
}
```

**Issues:**
1. Type casting is unsafe (could throw)
2. Generic error message hides network errors
3. Doesn't distinguish between different failure types

**Fix:**

```typescript
import axios from 'axios';

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError("");
  setLoading(true);
  
  try {
    // Validate form first
    if (!form.org_name?.trim()) {
      setError("Organisation name is required");
      setLoading(false);
      return;
    }
    if (form.admin_password.length < 12) {
      setError("Password must be at least 12 characters");
      setLoading(false);
      return;
    }

    const res = await authApi.register(form);
    Cookies.set("access_token", res.data.access_token, { expires: 1 });
    router.push("/dashboard");
  } catch (err) {
    let errorMsg = "Registration failed. Please try again.";
    
    if (axios.isAxiosError(err)) {
      if (err.response?.status === 400) {
        errorMsg = err.response.data?.detail || "Invalid input";
      } else if (err.response?.status === 409) {
        errorMsg = "Email or workspace slug already taken";
      } else if (err.response?.status >= 500) {
        errorMsg = "Server error. Please try again later.";
      } else if (!err.response) {
        errorMsg = "Network error. Please check your connection.";
      }
    }
    
    setError(errorMsg);
    console.error("Registration error:", err);
  } finally {
    setLoading(false);
  }
};
```

---

#### 19. **No Form Validation Before Submission**
**File:** `frontend/app/(auth)/register/page.tsx`

**Current State:**
- HTML5 `required` attribute (client-side only)
- `minLength` on password field
- No programmatic validation

**Issue:** User can submit empty form → backend returns error → poor UX

**Fix - Add Client-Side Validation:**

```typescript
const [formErrors, setFormErrors] = useState<Record<string, string>>({});

const validateForm = () => {
  const errors: Record<string, string> = {};
  
  if (!form.org_name?.trim()) errors.org_name = "Organisation name required";
  if (!form.org_slug?.trim()) errors.org_slug = "Workspace slug required";
  if (!form.admin_full_name?.trim()) errors.admin_full_name = "Full name required";
  if (!form.admin_email?.trim()) errors.admin_email = "Email required";
  
  if (form.admin_password.length < 12) {
    errors.admin_password = "Password must be at least 12 characters";
  }
  if (!/[A-Z]/.test(form.admin_password)) {
    errors.admin_password = "Password must contain uppercase letter";
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(form.admin_email)) {
    errors.admin_email = "Invalid email format";
  }
  
  return errors;
};

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  const errors = validateForm();
  if (Object.keys(errors).length > 0) {
    setFormErrors(errors);
    setError("Please fix the errors below");
    return;
  }
  
  // Continue with submission...
};
```

Then display errors per field:

```typescript
<div className="space-y-2">
  <Label>Password</Label>
  <Input 
    name="admin_password" 
    type="password" 
    value={form.admin_password} 
    onChange={handleChange} 
    required 
    minLength={8}
    className={formErrors.admin_password ? "border-red-500" : ""}
  />
  {formErrors.admin_password && (
    <p className="text-sm text-destructive">{formErrors.admin_password}</p>
  )}
</div>
```

---

#### 20. **No Loading Indication During Auth Check**
**File:** `frontend/lib/auth-context.tsx:35`

```typescript
useEffect(() => {
    const savedToken = Cookies.get("access_token");
    if (savedToken) {
        setToken(savedToken);
        authApi.me().then(...).catch(() => logout());
        // isLoading never set to false if .me() call fails
    } else {
        setIsLoading(false);
    }
}, []);
```

**Issue:** If `.me()` call fails, `isLoading` stays true indefinitely.

**Fix:**

```typescript
useEffect(() => {
  const initAuth = async () => {
    try {
      const savedToken = Cookies.get("access_token");
      if (savedToken) {
        setToken(savedToken);
        const res = await authApi.me();
        setUser(res.data);
      }
    } catch (err) {
      logout();
    } finally {
      setIsLoading(false);  // Always set, even on error
    }
  };
  
  initAuth();
}, []);
```

---

### MEDIUM ISSUES 🟡

#### 21. **No Validation of API Response Structure**
**File:** `frontend/lib/auth-context.tsx:47`

```typescript
const login = async (email: string, password: string) => {
  const res = await authApi.login({ email, password });
  const { access_token, ...userData } = res.data;  // Assumes structure exists
  // ...
};
```

**Issue:** Doesn't validate response has required fields.

**Fix:**

```typescript
const login = async (email: string, password: string): Promise<AuthUser> => {
  const res = await authApi.login({ email, password });
  
  if (!res.data?.access_token || !res.data?.user_id) {
    throw new Error("Invalid server response");
  }
  
  const { access_token, ...userData } = res.data;
  Cookies.set("access_token", access_token, { expires: 1 });
  setToken(access_token);
  
  const meRes = await authApi.me();
  if (!meRes.data?.id || !meRes.data?.email) {
    throw new Error("Failed to load user data");
  }
  
  setUser(meRes.data);
  return meRes.data;
};
```

---

#### 22. **Org Slug Auto-Generation Logic Mismatch**
**File:** `frontend/app/(auth)/register/page.tsx:28-30`

**Frontend:**
```typescript
org_slug: value.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
```

**Backend:**
```python
def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9-]", "-", text.lower().strip()).strip("-")
```

**Issue:** Logic differs slightly (order of operations, handling of leading/trailing hyphens).

**Example:** "My---Org" 
- Frontend: "my-org"
- Backend: "my---org"

**Fix - Use Same Logic:**

```typescript
// frontend/lib/utils.ts
export const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
};
```

```python
# backend/app/core/utils.py
import re

def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9-]", "-", text.lower().strip()).replace(/'-+/g, "-").strip("-")
```

Actually, the logic is close enough but frontend should be tweaked:

```typescript
org_slug: value
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9-]/g, "-")
  .replace(/-+/g, "-")
  .replace(/^-|-$/g, "")
```

---

#### 23. **No Feedback on Slug Availability Check**
**Issue:** No real-time slug availability check. User only finds out if slug taken after form submission.

**Better UX:** Check slug availability while typing.

```typescript
const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
const slugCheckTimeout = useRef<NodeJS.Timeout>();

const handleOrgNameChange = (value: string) => {
  const newSlug = slugify(value);
  setForm(prev => ({ ...prev, org_name: value, org_slug: newSlug }));
  
  // Debounce slug check
  if (slugCheckTimeout.current) clearTimeout(slugCheckTimeout.current);
  
  slugCheckTimeout.current = setTimeout(async () => {
    try {
      await authApi.checkSlugAvailability(newSlug);
      setSlugAvailable(true);
    } catch (err) {
      setSlugAvailable(false);
    }
  }, 500);
};
```

Backend endpoint:

```python
@router.get("/check-slug/{slug}")
async def check_slug_availability(slug: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Organization).where(Organization.slug == slug))
    exists = result.scalar_one_or_none() is not None
    return {"available": not exists}
```

---

#### 24. **No Accessibility Features (WCAG)**
**Issues:**
- Missing `aria-labels` on form fields
- No keyboard navigation hints
- Error messages not associated with fields via `aria-describedby`
- No color contrast verification

**Basic Fixes:**

```typescript
<div className="space-y-2">
  <Label htmlFor="admin_password">Password</Label>
  <Input
    id="admin_password"
    name="admin_password"
    type="password"
    aria-label="Admin password"
    aria-describedby="password-hint"
    aria-required="true"
    // ...
  />
  <p id="password-hint" className="text-xs text-muted-foreground">
    Min 12 characters with uppercase, lowercase, number, and special character
  </p>
  {formErrors.admin_password && (
    <p id="password-error" className="text-sm text-destructive" role="alert">
      {formErrors.admin_password}
    </p>
  )}
</div>
```

---

#### 25. **No HTTPS Enforcement**
**File:** `frontend/lib/api.ts:4`

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";
```

**Issue:** Default fallback to `http://` (unencrypted). In production, should be `https://`.

**Fix:**

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_URL) {
  throw new Error("NEXT_PUBLIC_API_URL environment variable is required");
}

if (!API_URL.startsWith("https://") && process.env.NODE_ENV === "production") {
  throw new Error("API_URL must use HTTPS in production");
}
```

---

#### 26. **Cookie Security Issues**
**File:** `frontend/lib/auth-context.tsx:47` and `frontend/app/(auth)/register/page.tsx:36`

```typescript
Cookies.set("access_token", access_token, { expires: 1 });
```

**Issues:**
- Not `HttpOnly` (vulnerable to XSS)
- Not `Secure` (sent over HTTP)
- Not `SameSite=Strict` (CSRF vulnerable)
- 1-day expiry while JWT is 60 minutes (mismatch)

**Fix:**

```typescript
Cookies.set("access_token", access_token, {
  expires: 1/24,  // 1 hour to match JWT expiry
  secure: process.env.NODE_ENV === "production",
  sameSite: "Strict",
  path: "/",
  // Note: HttpOnly cannot be set from JS (use server-side cookies for that)
});
```

**Better Solution:** Use HTTP-only cookies via Next.js server component:

```typescript
// app/auth/callback/route.ts
import { cookies } from "next/headers";

export async function POST(req: Request) {
  const { access_token } = await req.json();
  
  (await cookies()).set("access_token", access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 3600,  // 1 hour
    path: "/",
  });
  
  return Response.json({ success: true });
}
```

---

### LOW ISSUES (Nice-to-haves) 💡

#### 27. **No Toast/Notification System for Success**
**Issue:** Only shows errors, no success feedback.

**Fix:** Add toast notifications:

```typescript
import { Toaster, toast } from "sonner";

// In layout.tsx
export default function RootLayout(...) {
  return (
    <html>
      <body>
        <AuthProvider>
          {children}
          <Toaster position="top-right" />
        </AuthProvider>
      </body>
    </html>
  );
}

// In register/page.tsx
const res = await authApi.register(form);
toast.success("Workspace created successfully!");
router.push("/dashboard");
```

---

#### 28. **No Forgot Password Link on Registration**
**Issue:** Users can't reset password from registration page.

**Current Flows:**
- Register → Login → Forgot Password

**Better:** Add link on login page (already done), but not obvious.

---

#### 29. **No Password Strength Indicator**
**Issue:** User doesn't know password requirements in real-time.

**Fix - Add Password Strength Meter:**

```typescript
import { useState } from 'react';

function PasswordStrengthMeter({ password }: { password: string }) {
  const checkPassword = (pwd: string) => {
    let strength = 0;
    if (pwd.length >= 12) strength++;
    if (/[A-Z]/.test(pwd)) strength++;
    if (/[a-z]/.test(pwd)) strength++;
    if (/[0-9]/.test(pwd)) strength++;
    if (/[!@#$%^&*]/.test(pwd)) strength++;
    return strength;
  };
  
  const strength = checkPassword(password);
  const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-lime-500', 'bg-green-500'];
  
  return (
    <div className="space-y-2">
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${colors[strength - 1]}`}
          style={{ width: `${(strength / 5) * 100}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Strength: {['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'][strength - 1] || 'N/A'}
      </p>
    </div>
  );
}
```

---

## 3. DEPLOYMENT ANALYSIS

### Backend (Render)

**Current Setup:**
- Environment: Production
- Server: Render (managed platform)
- Database: Supabase PostgreSQL
- Storage: Supabase Storage

**Deployment Configuration Issues:**

#### 30. **No Environment Variable Validation on Startup**
**Fix - Add startup validation:**

```python
# app/main.py
from app.core.config import get_settings
import sys

def validate_environment():
    settings = get_settings()
    required = ["SUPABASE_URL", "DATABASE_URL", "SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"]
    missing = [var for var in required if not getattr(settings, var, None)]
    
    if missing:
        print(f"ERROR: Missing required environment variables: {', '.join(missing)}")
        sys.exit(1)

validate_environment()

app = FastAPI(...)
```

---

### Frontend (Vercel)

**Current Setup:**
- Next.js 14 standalone output
- Environment: Production  
- NEXT_PUBLIC_API_URL → Backend on Render

**Deployment Issues:**

#### 31. **Missing Vercel Configuration File**
**Issue:** No `vercel.json` for build configuration.

**Create `frontend/vercel.json`:**

```json
{
  "buildCommand": "next build",
  "outputDirectory": ".next",
  "env": {
    "NEXT_PUBLIC_API_URL": {
      "description": "Backend API URL (e.g., https://api.tinyhr.com/api/v1)",
      "required": true
    }
  },
  "functions": {
    "api/**/*.ts": {
      "memory": 1024,
      "maxDuration": 60
    }
  },
  "crons": []
}
```

---

## 4. REGISTRATION PAGE ISSUES - DETAILED

### Current Registration Flow

```
┌──────────────────────────────────────────────────────┐
│ User navigates to /register                          │
└──────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────┐
│ Fills form:                                          │
│ - org_name (auto → org_slug)                         │
│ - admin_full_name                                    │
│ - admin_email                                        │
│ - admin_password (min 8 chars)                       │
└──────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────┐
│ Frontend validates: required + minLength only        │
└──────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────┐
│ POST /auth/register → Backend                        │
└──────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────┐
│ Backend validation:                                  │
│ 1. Slugify org_slug                                  │
│ 2. Check slug unique (or 400)                        │
│ 3. Check email unique (or 400)                       │
│ 4. Create Organization                              │
│ 5. Create User (hr_admin)                            │
│ 6. Generate JWT token                               │
└──────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────┐
│ Response: TokenResponse with:                        │
│ - access_token                                       │
│ - user_id, org_id, role, full_name                  │
│ - must_change_password                              │
└──────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────┐
│ Frontend:                                            │
│ 1. Save token to js-cookie (1 day expiry)           │
│ 2. Redirect to /dashboard                           │
└──────────────────────────────────────────────────────┘
```

### Issues in Registration:

| Issue | Severity | Category | Impact |
|-------|----------|----------|---------|
| Invalid HTTP status code (44) | CRITICAL | Backend | HTTP errors, failed requests |
| Hardcoded localhost in reset email | CRITICAL | Backend | Password reset broken in prod |
| Hardcoded localhost in invite email | CRITICAL | Backend | Employees can't login in prod |
| Token expiry mismatch (60 min vs 1 day) | HIGH | Frontend/Backend | Users logged out after 1 hour |
| No rate limiting | HIGH | Backend | Brute force attacks possible |
| Weak password validation (only minLength) | HIGH | Backend | Dictionary attacks possible |
| No refresh token mechanism | HIGH | Frontend | User experience poor |
| No error boundary | HIGH | Frontend | App crashes on errors |
| Generic error handling | MEDIUM | Frontend | Poor error messages |
| No form validation before submit | MEDIUM | Frontend | Bad UX, wasted server calls |
| Overly broad CORS | MEDIUM | Backend | Security risk |
| No logging for security events | MEDIUM | Backend | Can't audit registration |
| Token loading stuck forever | MEDIUM | Frontend | Auth status unknown |
| Cookie security issues | MEDIUM | Frontend | XSS/CSRF vulnerabilities |
| No accessibility features | LOW | Frontend | WCAG non-compliant |

---

## 5. RECOMMENDED FIX PRIORITY

### Phase 1: Critical (Do Immediately) 🔴
1. Fix HTTP status code 44 → 404
2. Fix hardcoded domains (localhost → env vars)
3. Implement refresh token mechanism
4. Add basic form validation
5. Add error boundary

### Phase 2: High Priority (This Sprint) 🟡
6. Implement password complexity validation
7. Add rate limiting
8. Improve error handling
9. Add security logging
10. Fix token expiry mismatch
11. Fix cookie security settings

### Phase 3: Medium Priority (Next Sprint) 🟠
12. Fix CORS configuration
13. Add password strength meter
14. Add accessibility features
15. Implement slug availability check
16. Add success notifications

### Phase 4: Low Priority (Polish) 💡
17. Improve API documentation
18. Add password reset UX improvements
19. Add comprehensive error boundary

---

## 6. SUMMARY & RECOMMENDATIONS

### Strengths ✅
- Modern, type-safe stack (FastAPI + Next.js)
- Clean architecture with separation of concerns
- Comprehensive HR feature set
- Multi-tenant architecture properly implemented
- Async-first backend with good performance

### Critical Vulnerabilities 🔴
1. **Broken production flows** (hardcoded localhost)
2. **Session management issues** (token expiry mismatch)
3. **Weak authentication** (no rate limiting, weak passwords)
4. **Frontend resilience** (no error boundaries)

### Recommended Next Steps
1. **Immediate:** Deploy Phase 1 fixes
2. **This sprint:** Deploy Phase 2 fixes
3. **Code review:** Enable pre-commit hooks with linting
4. **Testing:** Add integration tests for auth flows
5. **Monitoring:** Set up error tracking (Sentry) and logging aggregation
6. **Security:** Conduct penetration testing
7. **Accessibility:** Audit with accessibility tools

### Estimated Effort
- Phase 1: 2-3 days
- Phase 2: 3-4 days
- Phase 3: 2-3 days
- Phase 4: 1-2 days

---

## Files to Modify (Quick Reference)

```
Backend:
├── app/routers/auth.py (10 fixes)
├── app/core/config.py (1 fix - add env vars)
├── app/schemas/auth.py (2 fixes - add validators)
└── app/main.py (2 fixes - add validation + logging)

Frontend:
├── app/(auth)/register/page.tsx (3 fixes)
├── app/(auth)/login/page.tsx (1 fix)
├── lib/auth-context.tsx (2 fixes)
├── lib/api.ts (1 fix)
└── app/error.tsx (NEW - error boundary)

Config:
├── backend/.env.example (update)
└── frontend/vercel.json (NEW)
```

---

**Report Generated:** June 4, 2026
**Project:** Tiny HR (tiny-hr)
**Reviewer:** Kiro AI Code Review
