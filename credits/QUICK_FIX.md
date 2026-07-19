# 🚨 QUICK FIX: Initialize Credits for Your Account

## Problem
You're seeing "Not authenticated" because your user account doesn't have credits initialized in the database yet.

## Solution (2 minutes)

### Option 1: Run SQL Script (Recommended)

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your project: `onztclcwwbquobbbrnkl`

2. **Open SQL Editor**
   - Click "SQL Editor" in left sidebar
   - Click "New Query"

3. **Run This SQL**
   ```sql
   -- Initialize credits for your user
   DO $
   DECLARE
     v_user RECORD;
     v_result jsonb;
   BEGIN
     -- Loop through all users and initialize credits
     FOR v_user IN 
       SELECT u.id, u.email
       FROM auth.users u
       LEFT JOIN public.user_credits uc ON u.id = uc.user_id
       WHERE uc.user_id IS NULL
     LOOP
       -- Call the initialization function
       SELECT public.initialize_user_credits(v_user.id) INTO v_result;
       RAISE NOTICE 'Initialized credits for: % - %', v_user.email, v_result;
     END LOOP;
   END $;
   ```

4. **Click "RUN"**
   - You should see: "Success" message
   - Check output for your email

5. **Verify**
   ```sql
   -- Check your credits
   SELECT 
     u.email,
     uc.balance,
     uc.total_earned,
     uc.created_at
   FROM auth.users u
   JOIN public.user_credits uc ON u.id = uc.user_id
   ORDER BY uc.created_at DESC;
   ```
   - You should see your email with 1000 credits

---

### Option 2: Manual SQL for Your Specific User

If you know your user ID or email, run this:

```sql
-- Find your user ID
SELECT id, email FROM auth.users WHERE email = 'YOUR_EMAIL_HERE';

-- Initialize credits (replace USER_ID with your actual ID)
SELECT public.initialize_user_credits('YOUR_USER_ID_HERE');

-- Verify
SELECT * FROM user_credits WHERE user_id = 'YOUR_USER_ID_HERE';
```

---

### Option 3: Use the Full Script

Run the complete initialization script:

1. Open: `PolarisAI-Backend/credits/initialize_existing_users.sql`
2. Copy ALL contents
3. Paste in Supabase SQL Editor
4. Click RUN

---

## After Running SQL

1. **Refresh your browser** (hard refresh: Cmd+Shift+R or Ctrl+Shift+R)
2. **Check browser console** (F12 → Console)
   - Should see: `[CreditBalance] Response data: { success: true, balance: 1000, ... }`
3. **Look at sidebar**
   - Should see: "💰 1,000 credits"

---

## Still Not Working?

### Debug Steps

1. **Open Browser Console** (F12)
2. **Check for errors**:
   ```javascript
   // Check if token exists
   localStorage.getItem('token')
   
   // Check API response
   fetch('http://localhost:3000/api/credits/balance', {
     headers: {
       'Authorization': 'Bearer ' + localStorage.getItem('token')
     }
   }).then(r => r.json()).then(console.log)
   ```

3. **Check Backend Logs**
   - Look at your backend terminal
   - Should see credit-related logs

4. **Restart Everything**
   ```bash
   # Backend
   cd PolarisAI-Backend
   npm start
   
   # Frontend (in another terminal)
   cd PolarisAI-Frontend  
   npm run dev
   ```

---

## Expected Result

After fixing, you should see in your dashboard sidebar:

```
┌─────────────────────────────┐
│ 💰 1,000 credits            │
│    ℹ️                        │
└─────────────────────────────┘
```

Hover over it to see:
- Balance: 1,000
- Total Earned: 1,000  
- Total Spent: 0

---

## Need More Help?

Run the diagnostic again:
```bash
cd PolarisAI-Backend
node credits/test-credits-setup.js
```

All checks should pass ✅
