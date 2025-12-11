# Quick Start: Security Configuration

## 🚀 Immediate Action Required

### 1. Generate JWT Secret

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Copy the output and add to `.env` file:**

```env
JWT_SECRET=<your-generated-secret-here>
```

### 2. Run Database Migration

**Option A: Using TypeORM CLI**
```bash
npm run typeorm:migration:run
```

**Option B: Manual SQL**
```bash
psql $DATABASE_URL -f migrations/platform/1733616000000-add-account-lockout.ts
```

**Or directly:**
```sql
ALTER TABLE user_accounts
  ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_failed_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_user_accounts_locked_until
  ON user_accounts(locked_until)
  WHERE locked_until IS NOT NULL;
```

### 3. Update Environment Variables

**Update `.env` file:**

```env
# JWT Configuration (REQUIRED)
JWT_SECRET=<64-character-hex-string>

# Account Lockout (Optional - uses defaults if not set)
# Default: 5 attempts = 30 minute lockout
MAX_FAILED_LOGIN_ATTEMPTS=5
ACCOUNT_LOCKOUT_DURATION_MINUTES=30

# CORS (Update for your domain)
CORS_ORIGINS=http://localhost:4200,https://yourdomain.com

# Refresh Token Settings
USE_REFRESH_TOKEN_COOKIE=true
REFRESH_COOKIE_SAMESITE=lax
REFRESH_COOKIE_SECURE=true  # Set to true in production
```

### 4. Restart All Services

```bash
# Stop all services
Ctrl+C (in terminal running services)

# Start services
npm run dev:all

# Or start individually
npm run dev:identity
npm run dev:metadata
npm run dev:data
npm run dev:web
```

---

## ✅ Verification Steps

### Test 1: JWT Secret Required

**Expected:** Application should fail to start if JWT_SECRET not set

```bash
unset JWT_SECRET
npm run dev:identity
# Should see error: "JWT_SECRET environment variable must be set"
```

### Test 2: Account Lockout Works

1. Go to login page: `http://localhost:4200/login`
2. Enter valid username, wrong password 5 times
3. **Expected:** "Account is locked due to too many failed login attempts. Please try again in 30 minute(s)."
4. Wait 30 minutes OR manually reset in database:

```sql
UPDATE user_accounts
SET failed_login_attempts = 0, locked_until = NULL
WHERE primary_email = 'test@example.com';
```

### Test 3: ABAC Security

1. Create a table without ACL policies
2. Try to access as non-admin user
3. **Expected:** 403 Forbidden (deny by default)

---

## 📊 What Was Fixed

| Issue | Status | Impact |
|-------|--------|--------|
| Hardcoded JWT secrets | ✅ Fixed | **CRITICAL** - No more forged tokens |
| ABAC default-allow | ✅ Fixed | **HIGH** - No accidental data exposure |
| Account lockout | ✅ Fixed | **HIGH** - Brute force prevention |
| Database migration | ⚠️ Manual | Run migration script above |

---

## 🔒 Security Features Now Enabled

### 1. Account Lockout
- **5 failed attempts** = 30-minute lockout (configurable)
- Auto-unlock after timeout
- Counter resets on successful login
- Admin can manually unlock accounts

### 2. JWT Validation
- **Strict secret validation** on startup
- No fallback secrets
- Fails fast if misconfigured

### 3. Authorization
- **Deny by default** for table access
- Explicit ACL/ABAC policies required
- Field-level permissions enforced

---

## 🚨 Troubleshooting

### Error: "JWT_SECRET environment variable must be set"

**Solution:**
```bash
# Generate secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Add to .env
echo "JWT_SECRET=<generated-secret>" >> .env

# Restart services
npm run dev:all
```

### Error: "Column 'failed_login_attempts' does not exist"

**Solution:**
```bash
# Run migration
npm run typeorm:migration:run

# Or manually
psql $DATABASE_URL < migrations/platform/1733616000000-add-account-lockout.ts
```

### Account Locked - Can't Login

**Admin Override:**
```sql
-- Reset specific user
UPDATE user_accounts
SET failed_login_attempts = 0,
    locked_until = NULL,
    last_failed_login_at = NULL
WHERE primary_email = 'user@example.com';

-- Reset all locked accounts
UPDATE user_accounts
SET failed_login_attempts = 0,
    locked_until = NULL,
    last_failed_login_at = NULL
WHERE locked_until IS NOT NULL;
```

---

## 📝 Implementation Status

### High Priority - COMPLETED ✅
1. ✅ Set JWT_SECRET
2. ✅ Run migrations
3. ✅ Implement MFA secret encryption
4. ✅ Add input validation DTOs
5. ✅ Fix frontend token storage (HttpOnly cookies)

### Medium Priority - COMPLETED ✅
6. ✅ Implement pagination
7. ✅ Standardize error handling
8. ✅ Add token refresh interceptor
9. ✅ Replace console.log with Logger
10. ✅ Add constants for magic values

### Low Priority (Remaining)
11. ⚠️ Replace TypeScript `any` types (partially done)
12. ❌ Write E2E tests

**See:** [TODO-REMAINING-FIXES.md](TODO-REMAINING-FIXES.md) for complete status.

---

## 🆘 Need Help?

**Common Issues:**
- JWT secret not working → Restart all services after setting
- Migration errors → Check database connection string
- Account permanently locked → Use SQL override above

**Documentation:**
- Full security review: `SECURITY-FIXES-APPLIED.md`
- Architecture: (Update your existing architecture document)
- README: Update with security requirements

---

**Last Updated:** 2025-12-07
**Platform Version:** 0.1.0 (Post-Security Audit)
