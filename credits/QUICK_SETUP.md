# ⚡ Credit System - 5-Minute Setup

## Step 1: Run Database Schema (2 minutes)

1. Open Supabase Dashboard → SQL Editor
2. Copy **ALL** contents from `PolarisAI-Backend/credits/create_credits_tables.sql`
3. Paste and click **RUN**
4. Verify success: You should see "Success. No rows returned"

## Step 2: Test Backend API (1 minute)

```bash
# Test health endpoint (should work immediately)
curl http://localhost:3000/api/credits/health

# Expected: {"success":true,"status":"healthy"...}
```

## Step 3: Verify Frontend Display (1 minute)

1. Restart your frontend if it's running
2. Go to dashboard
3. Look at the **bottom of the left sidebar** (above profile dropdown)
4. You should see: **"1000 credits"** (with a coin icon)

## Step 4: Test Credit Deduction (1 minute)

1. In the dashboard, ask the AI anything (e.g., "what is 2+2")
2. After response, check the credit balance
3. It should reduce by 1 credit (to 999)
4. Check transaction history:

```bash
# Get your token from browser console: localStorage.getItem('token')
export TOKEN="your-token-here"

curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/credits/transactions

# Should show: initial credit (1000) and debit (-1)
```

## ✅ Done!

Your credit system is now **fully functional**!

---

## 🎯 What Should Work Now

- ✅ New users automatically get 1,000 free credits
- ✅ Credit balance displays in sidebar (bottom left)
- ✅ Credits deduct after each successful query
- ✅ Failed queries don't charge credits
- ✅ Transaction history tracks everything
- ✅ Low balance warning shows when < 50 credits

---

## 🔧 Troubleshooting

### "Cannot GET /api/credits/health"

**Solution**: Backend routes not added. Check `PolarisAI-Backend/index.js`:

```javascript
// Should have these lines:
const creditRoutes = require('./credits/creditController');
app.use('/api/credits', creditRoutes);
```

### Credit balance not showing in frontend

**Solution**: Component import may be missing. Check `PolarisAI-Frontend/app/dashboard/page.tsx`:

```typescript
// Should have this import:
import CreditBalance from '../../components/credits/CreditBalance'

// And in the sidebar (above ProfileDropdown):
<CreditBalance />
```

### Database tables don't exist

**Solution**: SQL schema wasn't run properly. In Supabase SQL Editor:

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('user_credits', 'credit_costs', 'credit_transactions');

-- Should return 3 rows
-- If not, re-run the SQL from create_credits_tables.sql
```

### "User credits not initialized"

**Solution**: Trigger not working or existing user needs manual initialization:

```sql
-- Grant credits to specific user
INSERT INTO user_credits (user_id, balance, total_earned)
VALUES ('USER-UUID-HERE', 1000, 1000)
ON CONFLICT (user_id) DO UPDATE SET balance = 1000;

-- Log transaction
INSERT INTO credit_transactions (
  user_id, transaction_type, amount,
  balance_before, balance_after, description, status
) VALUES (
  'USER-UUID-HERE', 'initial', 1000,
  0, 1000, 'Initial credits', 'completed'
);
```

---

## 📖 Next Steps

- Monitor usage with queries in [README.md](./README.md)
- Adjust costs if needed: [INSTALLATION.md](./INSTALLATION.md)
- Integrate with more agents: [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)

---

**That's it! Your credit system is ready to use! 🎉**
