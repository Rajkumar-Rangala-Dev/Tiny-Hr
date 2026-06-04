# Quick Fixes Summary - Tiny HR

## 🔴 PRODUCTION BLOCKERS (Fix First!)

### 1. Invalid HTTP Status Code
**File:** `backend/app/routers/auth.py:135`
```python
# BEFORE:
raise HTTPException(status_code=44, detail="Employee not found")

# AFTER:
raise HTTPException(status_code=404, detail="Employee not found")
```

### 2. Hardcoded Localhost in Emails
**Files:** `backend/app/routers/auth.py:168, 196`

**Problem:** Employees can't click login links in production (points to localhost)

**Solution:** Use environment variable
```bash
# Add to .env files:
FRONTEND_URL=https://app.tinyhr.com
```

```python
# Update config.py:
class Settings(BaseSettings):
    FRONTEND_URL: str = "http://localhost:3000"
    # ...

# Update auth.py:
settings = get_settings()
reset_link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
portal_url = f"{settings.FRONTEND_URL}/login"
```

---

## 🟡 HIGH PRIORITY (This Sprint)

### 3. Session Expires After 1 Hour Unexpectedly
**Problem:** JWT expires in 60 min, cookie in 1 day → users logged out abruptly

**Solution:** Auto-refresh token before expiry

```python
# backend: Add /auth/refresh endpoint
@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(current_user: User = Depends(get_current_user)):
    token = create_access_token({"sub": current_user.id, ...})
    return TokenResponse(access_token=token, ...)
```

```typescript
// frontend: Auto-refresh every 45 minutes
useEffect(() => {
  if (!token) return;
  const timer = setInterval(async () => {
    try {
      const res = await authApi.refreshToken();
      Cookies.set("access_token", res.data.access_token, { expires: 1 });
      setToken(res.data.access_token);
    } catch { logout(); }
  }, 45 * 60 * 1000);
  return () => clearInterval(timer);
}, [token]);
```

### 4. No Rate Limiting (Brute Force Attacks)
**Solution:** Install and use slowapi
```bash
pip install slowapi
```

```python
# backend/app/routers/auth.py
from slowapi import Limiter

limiter = Limiter(key_func=get_remote_address)

@router.post("/register")
@limiter.limit("3/hour")
async def register_org(...):
    ...

@router.post("/login")
@limiter.limit("5/minute")
async def login(...):
    ...
```

### 5. Weak Passwords (Only Checks Length)
**Solution:** Add Pydantic validator

```python
# backend/app/schemas/auth.py
@field_validator('admin_password')
def validate_password(cls, v):
    if len(v) < 12: raise ValueError('Min 12 chars')
    if not re.search(r'[A-Z]', v): raise ValueError('Need uppercase')
    if not re.search(r'[0-9]', v): raise ValueError('Need number')
    if not re.search(r'[!@#$%^&*]', v): raise ValueError('Need special char')
    return v
```

### 6. Users See Generic Error Messages
**Solution:** Better error handling in registration page

```typescript
// frontend/app/(auth)/register/page.tsx
catch (err) {
  if (axios.isAxiosError(err)) {
    if (err.response?.status === 400) {
      if (err.response.data?.detail?.includes("slug")) {
        setError("This workspace URL is already taken");
      } else if (err.response.data?.detail?.includes("Email")) {
        setError("Email already registered");
      } else {
        setError(err.response.data?.detail);
      }
    } else if (!err.response) {
      setError("Network error. Check internet connection.");
    } else {
      setError("Server error. Try again later.");
    }
  }
}
```

---

## 🟠 MEDIUM PRIORITY (Nice-to-Have)

### 7. No Client-Side Form Validation
```typescript
// frontend/app/(auth)/register/page.tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  // Validate before sending to backend
  if (!form.org_name?.trim()) { setError("Org name required"); return; }
  if (form.admin_password.length < 12) { setError("Password too short"); return; }
  if (!/^[^\s@]+@[^\s@]+$/.test(form.admin_email)) { setError("Invalid email"); return; }
  
  // Then proceed with API call...
};
```

### 8. Auth Context Doesn't Handle Init Failure
```typescript
// frontend/lib/auth-context.tsx
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
      logout(); // Properly handle errors
    } finally {
      setIsLoading(false); // Always set, even on error
    }
  };
  initAuth();
}, []);
```

### 9. No Error Boundary
```typescript
// frontend/app/error.tsx (create new file)
'use client';
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">Something went wrong!</h2>
        <button onClick={reset} className="px-4 py-2 bg-primary text-white rounded">
          Try again
        </button>
      </div>
    </div>
  );
}
```

### 10. Overly Broad CORS
```python
# backend/app/main.py
# BEFORE:
allow_origin_regex=r"https://.*\.vercel\.app",  # Too broad!

# AFTER:
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://app.tinyhr.com",  # Specific production domain
]
```

---

## 💡 NICE-TO-HAVE (Polish)

### 11. Add Success Notifications
```bash
npm install sonner
```

```typescript
import { toast } from "sonner";

const handleSubmit = async (e: React.FormEvent) => {
  try {
    const res = await authApi.register(form);
    toast.success("Workspace created! Redirecting...");
    router.push("/dashboard");
  } catch (err) {
    toast.error(errorMsg);
  }
};
```

### 12. Password Strength Meter
```typescript
const [strength, setStrength] = useState(0);

const updateStrength = (pwd: string) => {
  let score = 0;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[a-z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[!@#$%^&*]/.test(pwd)) score++;
  setStrength((score / 5) * 100);
};

// In JSX:
{form.admin_password && (
  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
    <div
      className={`h-full ${strength < 60 ? 'bg-red-500' : 'bg-green-500'}`}
      style={{ width: `${strength}%` }}
    />
  </div>
)}
```

### 13. Real-Time Slug Availability Check
```typescript
const checkSlugAvailability = async (slug: string) => {
  try {
    const res = await api.get(`/auth/check-slug/${slug}`);
    setSlugAvailable(res.data.available);
  } catch {
    setSlugAvailable(false);
  }
};

// Debounce on change:
const timer = setTimeout(() => checkSlugAvailability(newSlug), 500);
```

---

## 📋 Implementation Priority

| Task | Severity | Time | Impact |
|------|----------|------|--------|
| Fix status code 44 | 🔴 | 5 min | Critical bug |
| Fix hardcoded localhost | 🔴 | 15 min | Production broken |
| Implement token refresh | 🟡 | 1 hour | User experience |
| Add rate limiting | 🟡 | 30 min | Security |
| Add password validation | 🟡 | 1 hour | Security |
| Better error handling | 🟡 | 45 min | UX |
| Client-side validation | 🟠 | 1 hour | UX |
| Fix auth context init | 🟠 | 30 min | Reliability |
| Error boundary | 🟠 | 15 min | Reliability |
| CORS fix | 🟠 | 10 min | Security |
| Password strength meter | 💡 | 45 min | Polish |
| Success toasts | 💡 | 15 min | Polish |

**Total Estimated Time: 6-7 hours**

---

## Testing Commands

```bash
# Test 1: Invalid password
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"org_name":"Test","org_slug":"test","admin_email":"a@b.com","admin_password":"weak","admin_full_name":"Test"}'
# Should get 422 validation error

# Test 2: Check rate limit
for i in {1..5}; do curl -X POST http://localhost:8000/api/v1/auth/register ...; done
# Should block after 3 requests

# Test 3: Valid registration
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"org_name":"Acme","org_slug":"acme","admin_email":"john@acme.com","admin_password":"MyP@ssw0rd123","admin_full_name":"John Doe"}'
# Should return 201 with access_token

# Test 4: Frontend - check refresh token every 45 min
# Open browser console, wait 45 minutes
# Should see POST /auth/refresh in Network tab
```

---

## Deployment Checklist

Before pushing to production:

- [ ] Fix status code 44
- [ ] Add FRONTEND_URL env var
- [ ] Update email templates with FRONTEND_URL
- [ ] Deploy token refresh mechanism
- [ ] Test rate limiting on all auth endpoints
- [ ] Verify password complexity validation
- [ ] Test error messages are user-friendly
- [ ] Test client-side validation works
- [ ] Auth context handles all error cases
- [ ] Error boundary catches crashes
- [ ] CORS allow-list is specific (not broad regex)
- [ ] Load test with 100+ concurrent users
- [ ] Security audit password reset flow
- [ ] Verify all environment variables are set
- [ ] Monitor error rates post-deploy

---

**Report Generated:** June 4, 2026  
**Priority:** 🔴 CRITICAL - Fix before next deployment
