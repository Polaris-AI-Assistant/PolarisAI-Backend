# 🚨 INIT_FAILED Error - Quick Fix

## The Problem
Auto-initialization is failing due to a database error. Let's fix it manually with SQL.

## ✅ Solution: Run SQL in Supabase (2 minutes)

### Step 1: Open Supabase
1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** in the left sidebar

### Step 2: Run This SQL

Copy and paste this entire block, then click **RUN**:

```sql
-- Initialize credits for all users without them
INSERT INTO public.user_credits (user_id, balance, total_earned, total_spent)
SELECT 
  u.id,
  1000,  -- initial balance
  1000,  -- total earned
  0      -- total spent
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_credits uc WHERE uc.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;

-- Create transaction records
INSERT INTO public.credit_transactions (
  user_id, 
  transaction_type, 
  amount,
  balance_before, 
  balance_after, 
  description, 
  status
)
SELECT 
  uc.user_id,
  'initial',
  1000,
  0,
  1000,
  'Initial credit grant',
  'completed'
FROM public.user_credits uc
WHERE uc.balance = 1000 
  AND uc.total_earned = 1000
  AND NOT EXISTS (
    SELECT 1 
    FROM public.credit_transactions ct 
    WHERE ct.user_id = uc.user_id 
    AND ct.transaction_type = 'initial'
  );

-- Verify
SELECT 
  u.email,
  COALESCE(uc.balance, 0) as balance,
  CASE 
    WHEN uc.user_id IS NOT NULL THEN '✅ HAS CREDITS'
    ELSE '❌ NO CREDITS'
  END as status
FROM auth.users u
LEFT JOIN public.user_credits uc ON u.id = uc.user_id
ORDER BY u.created_at DESC;
```

### Step 3: Check Output
After running, you should see a table showing:
- Your email
- balance: **1000**
- status: **✅ HAS CREDITS**

### Step 4: Refresh Browser
Hard refresh your dashboard:
- Windows/Linux: `Ctrl + Shift + R`
- Mac: `Cmd + Shift + R`

Credits should now appear! 🎉

---

## 🔍 What's Causing the Database Error?

The auto-init might be failing due to:

1. **RLS (Row Level Security) policies** blocking the insert
2. **Permission issues** with the service role
3. **Missing foreign key** or constraint issue
4. **Table structure mismatch**

### Check Backend Logs

Look for this in your backend console after refreshing:

```
[CreditService] ❌ Database error inserting credits:
```

The error details will tell us what's wrong.

### Common Errors:

**Error: "new row violates row-level security policy"**
- **Solution:** Run the SQL manually (Step 2 above)
- This bypasses the API and uses Supabase's direct access

**Error: "permission denied for table user_credits"**
- **Solution:** Your API key might not have permission
- Check you're using the correct `SUPABASE_API_KEY` (anon or service role)

**Error: "relation user_credits does not exist"**
- **Solution:** Tables weren't created yet
- Run `create_credits_tables.sql` first

---

## 🎯 After SQL Runs Successfully

1. ✅ Refresh your browser
2. ✅ Check dashboard sidebar
3. ✅ Should show "🪙 1000 credits"
4. ✅ No more errors in console

---

## 💡 Alternative: Use Supabase Service Role Key

If the manual SQL works but auto-init still fails, update your backend to use the service role key:

**File:** `PolarisAI-Backend/.env`

Check you have:
```env
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

And in your code, use service role for admin operations:
```javascript
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // Service role bypasses RLS
);
```

---

## 📊 Quick Status Check

Run this SQL to see your current status:

```sql
SELECT 
  u.email,
  u.id,
  uc.balance,
  uc.created_at as credits_created
FROM auth.users u
LEFT JOIN public.user_credits uc ON u.id = uc.user_id
WHERE u.email = 'YOUR_EMAIL_HERE';  -- Replace with your email
```

---

## ✅ Success Looks Like

After running the SQL and refreshing:

**Dashboard:**
```
🪙 1000 credits   ℹ️
```

**Browser Console:**
```
[CreditBalance] Fetching credits from: http://localhost:3000/api/credits/balance
[CreditBalance] Response status: 200
```

**Backend Console:**
```
[CreditService] 💰 Fetching credits for user: abc123
[CreditService] ✅ User balance: 1000 credits
```

---

## 🆘 Still Not Working?

1. **Share your backend console logs** - Look for `[CreditService]` messages
2. **Check Supabase logs** - Dashboard → Logs → API
3. **Verify tables exist** - Go to Table Editor and check for:
   - `user_credits`
   - `credit_transactions`
   - `credit_costs`

4. **Check your user ID** - Run this SQL:
```sql
SELECT id, email FROM auth.users WHERE email = 'YOUR_EMAIL@example.com';
```

---

**TL;DR:** 
1. Open Supabase SQL Editor
2. Run the SQL from Step 2 above
3. Refresh browser
4. Credits should appear!

Time required: **2 minutes**
