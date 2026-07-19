# 🚀 Credit System - Quick Start Guide

## ⏱️ 15-Minute Setup

Follow these steps to have the credit system up and running in 15 minutes.

## ✅ Step 1: Database Setup (5 minutes)

### 1.1 Open Supabase SQL Editor
1. Go to your Supabase project: https://supabase.com/dashboard/project/YOUR_PROJECT
2. Click "SQL Editor" in the left sidebar
3. Click "New Query"

### 1.2 Run Credit System Schema
1. Open `PolarisAI-Backend/credits/create_credits_tables.sql`
2. Copy **all** contents (550 lines)
3. Paste into Supabase SQL Editor
4. Click "Run" (or Ctrl/Cmd + Enter)

### 1.3 Verify Installation
Run this verification query:

```sql
-- Check tables created
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('user_credits', 'credit_costs', 'credit_transactions')
ORDER BY table_name;

-- Check credit costs loaded
SELECT COUNT(*) as cost_count FROM credit_costs WHERE is_active = true;

-- Check trigger exists
SELECT trigger_name 
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_initialize_user_credits';
```

**Expected Results:**
- 3 tables shown with column counts
- cost_count: 17 (15 agents + 2 file types)
- 1 trigger shown

### 1.4 Grant Credits to Existing Users

```sql
-- Only if you have existing users
-- New users get credits automatically

INSERT INTO public.user_credits (user_id, balance, total_earned)
SELECT 
  id, 1000, 1000
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_credits);

-- Log transactions
INSERT INTO public.credit_transactions (
  user_id, transaction_type, amount,
  balance_before, balance_after, description, status
)
SELECT 
  id, 'initial', 1000, 0, 1000,
  'Initial credits for existing user', 'completed'
FROM auth.users
WHERE id NOT IN (
  SELECT user_id FROM credit_transactions WHERE transaction_type = 'initial'
);
```

✅ **Step 1 Complete!** Database is ready.

---

## ✅ Step 2: Backend Verification (3 minutes)

### 2.1 Verify Files Exist
```bash
cd PolarisAI-Backend

# Check credit module files
ls -la credits/
# Should show: creditService.js, creditController.js, creditIntegration.js, etc.

# Check middleware
ls -la middleware/creditMiddleware.js
# Should exist
```

### 2.2 Verify Routes Added
```bash
# Check if credit routes are in index.js
grep "creditRoutes" index.js

# Should show:
# const creditRoutes = require('./credits/creditController');
# app.use('/api/credits', creditRoutes);
```

If not found, add these lines to `index.js`:

```javascript
// Around line 78 (with other route imports)
const creditRoutes = require('./credits/creditController');

// Around line 212 (with other app.use statements)
app.use('/api/credits', creditRoutes);
```

### 2.3 Restart Backend
```bash
# Stop current server (Ctrl+C)
# Start server
npm start
# or
nodemon index.js
```

### 2.4 Test Credit API
```bash
# Test health endpoint (no auth needed)
curl http://localhost:3000/api/credits/health

# Should return:
# {
#   "success": true,
#   "status": "healthy",
#   ...
# }
```

✅ **Step 2 Complete!** Backend is working.

---

## ✅ Step 3: Test Credit System (4 minutes)

### 3.1 Get Your Auth Token
1. Open your Polaris AI frontend in browser
2. Open Developer Tools (F12)
3. Go to Console tab
4. Type: `localStorage.getItem('token')` or `sessionStorage.getItem('token')`
5. Copy the token (long string starting with 'eyJ...')

### 3.2 Set Token Variable
```bash
# Replace with your actual token
export TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 3.3 Test Balance
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/credits/balance

# Expected output:
# {
#   "success": true,
#   "balance": 1000,
#   "totalEarned": 1000,
#   "totalSpent": 0,
#   "isLow": false,
#   "lowBalanceThreshold": 50
# }
```

### 3.4 Test Pricing
```bash
curl http://localhost:3000/api/credits/pricing

# Should return all agent costs (17 items)
```

### 3.5 Test Cost Estimation
```bash
curl "http://localhost:3000/api/credits/estimate?agents=calendar,gmail,docs"

# Expected output:
# {
#   "success": true,
#   "costs": {
#     "calendar": 2,
#     "gmail": 3,
#     "docs": 2
#   },
#   "total": 7,
#   "breakdown": [...]
# }
```

### 3.6 Test Actual Agent Execution
```bash
# Execute a simple conversational query (1 credit)
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"what is 2+2"}' \
  http://localhost:3000/api/agent/query

# Check balance again
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/credits/balance

# Balance should now be 999 (1000 - 1)
```

### 3.7 View Transaction History
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/credits/transactions

# Should show:
# - Initial credit transaction (1000 credits)
# - Debit transaction (1 credit for conversational agent)
```

✅ **Step 3 Complete!** Credit system is working!

---

## ✅ Step 4: Frontend Integration (3 minutes)

### 4.1 Add Credit Balance Component

In your navigation component (e.g., `Navbar.tsx` or `Header.tsx`):

```typescript
// Add import
import CreditBalance from '@/components/credits/CreditBalance';

// Add component in your JSX
export default function Navbar() {
  return (
    <nav className="navbar">
      {/* ... other nav items ... */}
      
      {/* Add credit balance display */}
      <CreditBalance />
    </nav>
  );
}
```

### 4.2 Verify Frontend Display

1. Reload your frontend
2. You should see credit balance in navbar
3. It should show: "1000 credits" (or 999 if you tested execution)
4. Hover over it to see details

### 4.3 Add CSS (Optional)

If styling looks off, import the CSS:

```typescript
import CreditBalance from '@/components/credits/CreditBalance';
import '@/components/credits/CreditBalance.css';
```

✅ **Step 4 Complete!** Frontend is integrated!

---

## 🎉 Setup Complete!

Your credit system is now **fully operational**!

### What You Have Now:

✅ Database tables with RLS policies
✅ 1,000 initial credits for all users
✅ 17 configured agent costs
✅ Automatic credit allocation for new users
✅ Complete REST API for credits
✅ Frontend credit balance display
✅ Transaction history tracking
✅ Cost estimation before execution
✅ Automatic deduction after success

---

## 🔍 Quick Verification Checklist

Run through this checklist to ensure everything works:

- [ ] Database tables exist (user_credits, credit_costs, credit_transactions)
- [ ] Trigger creates credits for new users
- [ ] Existing users have 1,000 initial credits
- [ ] Backend API responds: `curl http://localhost:3000/api/credits/health`
- [ ] Can get balance with auth token
- [ ] Can view pricing without auth
- [ ] Can estimate costs for agents
- [ ] Agent execution deducts credits
- [ ] Transaction history shows all operations
- [ ] Frontend displays credit balance
- [ ] Low balance warning works (set balance < 50 to test)
- [ ] Insufficient credits returns 402 error (set balance to 0 to test)

---

## 📚 Next Steps

### For Development:

1. **Test Credit Deduction**
   - Execute various agents
   - Verify correct costs deducted
   - Check transaction history

2. **Test Insufficient Credits**
   ```sql
   -- Temporarily set low balance
   UPDATE user_credits SET balance = 0.5 WHERE user_id = 'YOUR_USER_ID';
   ```
   - Try to execute expensive agent (e.g., research)
   - Should get 402 error

3. **Test Multi-Agent Query**
   ```bash
   curl -X POST \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"query":"schedule a meeting and send an email about it"}' \
     http://localhost:3000/api/agent/query
   ```
   - Should deduct credits for both calendar (2) and gmail (3) = 5 total

4. **Test Failure (No Charge)**
   ```bash
   # Send invalid query that will fail
   curl -X POST \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"query":""}' \
     http://localhost:3000/api/agent/query
   ```
   - Should fail but NOT deduct credits

### For Production:

1. **Monitor Usage**
   ```sql
   -- Daily credit usage
   SELECT 
     DATE(created_at) as date,
     COUNT(*) as transactions,
     SUM(amount) as total_credits
   FROM credit_transactions
   WHERE transaction_type = 'debit'
   GROUP BY DATE(created_at)
   ORDER BY date DESC;
   ```

2. **Track Popular Agents**
   ```sql
   -- Most used agents
   SELECT 
     agent_name,
     COUNT(*) as usage_count,
     SUM(amount) as total_cost
   FROM credit_transactions
   WHERE transaction_type = 'debit'
     AND created_at > NOW() - INTERVAL '7 days'
   GROUP BY agent_name
   ORDER BY usage_count DESC;
   ```

3. **Monitor Low Balance Users**
   ```sql
   -- Users with low credits
   SELECT 
     user_id,
     balance,
     total_spent,
     updated_at
   FROM user_credits
   WHERE balance < 50
   ORDER BY balance ASC;
   ```

---

## 🆘 Troubleshooting

### "Credits not initialized" Error

**Cause**: Trigger didn't fire or user created before trigger existed

**Fix**:
```sql
-- Manually initialize for specific user
INSERT INTO user_credits (user_id, balance, total_earned)
VALUES ('USER_UUID_HERE', 1000, 1000)
ON CONFLICT (user_id) DO UPDATE SET balance = 1000, total_earned = 1000;
```

### "Cannot find module './credits/creditController'"

**Cause**: Files not in correct location

**Fix**:
```bash
# Verify file structure
ls -la PolarisAI-Backend/credits/
# Should show creditController.js and other files

# If missing, files might be in wrong location
```

### Backend Won't Start After Adding Routes

**Cause**: Syntax error in index.js

**Fix**:
```bash
# Check for errors
node index.js

# Common issues:
# - Missing comma after previous route
# - Incorrect path to creditController
# - Missing require statement
```

### Frontend Shows "Network Error"

**Cause**: Backend URL not configured or CORS issue

**Fix**:
```typescript
// Check .env.local
NEXT_PUBLIC_BACKEND_URL=http://localhost:3000

// Verify CORS in backend index.js
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  // ...
}));
```

---

## 📖 Additional Documentation

- **[README.md](./README.md)** - Complete system overview
- **[INSTALLATION.md](./INSTALLATION.md)** - Detailed installation guide
- **[INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)** - Code integration examples
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture diagrams
- **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** - Complete feature list

---

## 🎯 Success Criteria

Your credit system is working if:

1. ✅ New users automatically get 1,000 credits
2. ✅ Credit balance displays in frontend
3. ✅ Costs are estimated before execution
4. ✅ Credits deducted only after success
5. ✅ Failed operations don't charge credits
6. ✅ Transaction history records everything
7. ✅ Insufficient credits prevents execution
8. ✅ Low balance warning shows

**If all checkboxes are ticked, you're ready for production! 🚀**

---

## 💬 Need Help?

If you encounter issues:

1. Check the troubleshooting section above
2. Review application logs for error messages
3. Verify database records match expected state
4. Check API responses for error details
5. Review the documentation files for specific topics

---

**Congratulations! Your credit system is ready! 🎉**
