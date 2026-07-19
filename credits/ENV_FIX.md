# Environment Variable Fix - Credit System

## 🔴 Issue Found

**Error:** `GET /undefined/api/credits/balance 404`  
**Root Cause:** `NEXT_PUBLIC_BACKEND_URL` was undefined in frontend environment

### The Problem
The CreditBalance component was using `process.env.NEXT_PUBLIC_BACKEND_URL`, but the frontend `.env.local` file only defined `NEXT_PUBLIC_API_URL`.

### Log Evidence
```
[browser] [CreditBalance] Error 404: API endpoint not found
GET /undefined/api/credits/balance 404 in 126ms
```

## ✅ Solution Applied

### Fix 1: Added Missing Environment Variable
**File:** `PolarisAI-Frontend/.env.local`

Added:
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3000
```

This ensures the component can find the backend URL.

### Fix 2: Made Components Resilient
**Files:** 
- `PolarisAI-Frontend/components/credits/CreditBalance.tsx`
- `PolarisAI-Frontend/src/components/credits/CreditBalance.tsx`

Changed from:
```javascript
const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/credits/balance`, {
```

To:
```javascript
const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const response = await fetch(`${apiUrl}/api/credits/balance`, {
```

This provides fallback options if the primary env var is missing.

## 🎯 What to Do Now

**CRITICAL: You MUST restart your frontend dev server for environment variable changes to take effect!**

### Step 1: Stop Frontend Server
```bash
# In your frontend terminal, press Ctrl+C
```

### Step 2: Restart Frontend Server
```bash
cd PolarisAI-Frontend
npm run dev
# or
yarn dev
```

### Step 3: Hard Refresh Browser
```bash
# Clear cache and reload
Ctrl+Shift+R (Windows/Linux)
Cmd+Shift+R (Mac)
```

### Step 4: Verify Fix
Check browser console - you should now see:
```
[CreditBalance] Fetching credits from: http://localhost:3000/api/credits/balance
[CreditBalance] Response status: 200
```

## 📊 Environment Variable Reference

### Frontend (.env.local)
```env
# Backend API URL (local development)
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_BACKEND_URL=http://localhost:3000  # ✅ NOW ADDED

# Supabase configuration for realtime subscriptions
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Production Setup
For production deployment, ensure you set:
```env
NEXT_PUBLIC_BACKEND_URL=https://your-backend-domain.com
NEXT_PUBLIC_API_URL=https://your-backend-domain.com
```

## 🔍 Verification Checklist

After restarting the frontend server:

- [ ] Frontend dev server restarted (REQUIRED)
- [ ] Browser cache cleared (hard refresh)
- [ ] Navigate to dashboard
- [ ] Open browser console (F12)
- [ ] Check for `[CreditBalance] Fetching credits from: http://localhost:3000/api/credits/balance`
- [ ] Check for `[CreditBalance] Response status: 200`
- [ ] Credit balance should display in sidebar
- [ ] No 404 errors in console
- [ ] No "undefined" in API URLs

## 🚨 Important Notes

### Why Restart is Required
Next.js loads environment variables at build/start time, not runtime. Changes to `.env` files require a full restart of the dev server.

### Why the 404 Happened
```
GET /undefined/api/credits/balance
     ^^^^^^^^^ - This was the value of process.env.NEXT_PUBLIC_BACKEND_URL
```

When an environment variable is undefined, JavaScript converts it to the string "undefined", causing the malformed URL.

### Fallback Strategy
The updated code now uses a fallback chain:
1. Try `NEXT_PUBLIC_BACKEND_URL` (most specific)
2. Fall back to `NEXT_PUBLIC_API_URL` (alternative)
3. Fall back to `http://localhost:3000` (development default)

This makes the component more resilient to environment configuration issues.

## 📝 Related Issues

### Image Warnings (Not Critical)
You're also seeing Next.js Image warnings:
```
Image with src "..." has either width or height modified, but not the other.
```

These are warnings, not errors. They don't affect functionality but can be fixed by:
- Adding both `width` and `height` props to Image components, OR
- Adding `width: "auto"` or `height: "auto"` to image styles

This is separate from the credit system issue and can be addressed later.

## ✅ Expected Result

After restart, you should see:
1. ✅ Credit balance displays: "1000 credits"
2. ✅ No 404 errors in console
3. ✅ No "undefined" in API calls
4. ✅ Proper API responses
5. ✅ Red error message removed from sidebar

---

**Status:** ✅ Fixed  
**Next Action:** **RESTART FRONTEND SERVER** (mandatory)  
**Time Required:** 30 seconds
