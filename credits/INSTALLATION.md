# Credit System Installation Guide

Complete step-by-step guide to install and configure the credit-based pricing system for Polaris AI.

## 📋 Prerequisites

- ✅ Polaris AI backend running
- ✅ Supabase database configured
- ✅ Admin access to Supabase SQL editor
- ✅ Node.js environment set up

## 🚀 Installation Steps

### Step 1: Database Setup

1. **Open Supabase SQL Editor**
   - Go to your Supabase project dashboard
   - Navigate to SQL Editor
   - Create a new query

2. **Execute Credit System Schema**
   ```sql
   -- Copy and paste the entire contents of:
   -- PolarisAI-Backend/credits/create_credits_tables.sql
   
   -- This will create:
   -- ✅ user_credits table
   -- ✅ credit_costs table
   -- ✅ credit_transactions table
   -- ✅ Automatic triggers for new users
   -- ✅ Helper functions for credit operations
   -- ✅ Initial credit costs configuration
   ```

3. **Verify Tables Created**
   ```sql
   -- Check that all tables exist
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('user_credits', 'credit_costs', 'credit_transactions');
   
   -- Should return 3 rows
   ```

4. **Verify Initial Costs Loaded**
   ```sql
   -- Check that credit costs were inserted
   SELECT agent_name, cost, category, description 
   FROM credit_costs 
   WHERE is_active = true
   ORDER BY category, cost;
   
   -- Should return ~15 rows with different agents
   ```

### Step 2: Grant Initial Credits to Existing Users

If you have existing users, grant them initial credits:

```sql
-- Grant 1000 initial credits to ALL existing users
-- (New users will get credits automatically via trigger)

INSERT INTO public.user_credits (user_id, balance, total_earned)
SELECT 
  id as user_id,
  1000 as balance,
  1000 as total_earned
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_credits)
ON CONFLICT (user_id) DO NOTHING;

-- Log initial credit transactions
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
  id as user_id,
  'initial' as transaction_type,
  1000 as amount,
  0 as balance_before,
  1000 as balance_after,
  'Initial credits for existing user' as description,
  'completed' as status
FROM auth.users
WHERE id NOT IN (
  SELECT user_id 
  FROM public.credit_transactions 
  WHERE transaction_type = 'initial'
)
ON CONFLICT DO NOTHING;

-- Verify - should show all users with 1000 credits
SELECT 
  u.email,
  uc.balance,
  uc.created_at
FROM auth.users u
JOIN user_credits uc ON u.id = uc.user_id
ORDER BY uc.created_at DESC;
```

### Step 3: Backend Code Integration

The credit system files are already created. Now integrate with existing code:

1. **Verify Credit Module Files Exist**
   ```bash
   ls -la PolarisAI-Backend/credits/
   
   # Should show:
   # - create_credits_tables.sql
   # - creditService.js
   # - creditController.js
   # - creditIntegration.js
   # - creditMiddleware.js (in ../middleware/)
   ```

2. **Verify Routes Added to index.js**
   
   Check that `PolarisAI-Backend/index.js` includes:
   ```javascript
   // Credit System routes
   const creditRoutes = require('./credits/creditController');
   
   // ... later in the file ...
   
   // Use Credit System routes
   app.use('/api/credits', creditRoutes);
   ```

3. **Restart Backend Server**
   ```bash
   cd PolarisAI-Backend
   npm start
   # or
   nodemon index.js
   ```

4. **Verify Credit API is Working**
   ```bash
   # Test credit system health
   curl http://localhost:3000/api/credits/health
   
   # Expected output:
   # {
   #   "success": true,
   #   "status": "healthy",
   #   "features": [...],
   #   "config": {...}
   # }
   ```

### Step 4: Test Credit System

1. **Test Get Balance (Requires Auth)**
   ```bash
   # Replace YOUR_JWT_TOKEN with actual token from localStorage
   export TOKEN="YOUR_JWT_TOKEN"
   
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

2. **Test Get Pricing (Public)**
   ```bash
   curl http://localhost:3000/api/credits/pricing
   
   # Should return all credit costs
   ```

3. **Test Cost Estimation (Public)**
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

4. **Test Agent Execution with Credits**
   ```bash
   # Execute a simple query
   curl -X POST \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"query":"what is 2+2"}' \
     http://localhost:3000/api/agent/query/stream
   
   # Check balance again - should be reduced
   curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:3000/api/credits/balance
   ```

5. **Test Transaction History**
   ```bash
   curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:3000/api/credits/transactions
   
   # Should show recent credit deductions
   ```

### Step 5: Integrate with Main Agent (Optional but Recommended)

For complete integration, follow the [Integration Guide](./INTEGRATION_GUIDE.md):

1. **Add imports to mainAgentController.js**
   ```javascript
   const { checkCredits } = require('../middleware/creditMiddleware');
   const { 
     deductCreditsForAgents, 
     getCreditInfoForStream, 
     getCreditDeductionInfoForStream 
   } = require('../credits/creditIntegration');
   ```

2. **Add middleware to streaming endpoint**
   ```javascript
   router.post('/query/stream', 
     authenticateToken, 
     checkCredits,  // ← Add this
     async (req, res) => { ... }
   );
   ```

3. **Add credit deduction after success**
   
   See [mainAgentIntegration.example.js](./mainAgentIntegration.example.js) for complete example.

### Step 6: Frontend Integration

1. **Add Credit Balance Component**
   
   The component is already created at:
   `PolarisAI-Frontend/src/components/credits/CreditBalance.tsx`

2. **Add to Navigation Bar**
   ```typescript
   // In your navigation component (e.g., Navbar.tsx)
   import CreditBalance from '@/components/credits/CreditBalance';
   
   export default function Navbar() {
     return (
       <nav>
         {/* ... other nav items ... */}
         <CreditBalance />
       </nav>
     );
   }
   ```

3. **Handle Credit Events in SSE Stream**
   ```typescript
   eventSource.onmessage = (event) => {
     const data = JSON.parse(event.data);
     
     switch (data.type) {
       case 'credit_info':
         // Show estimated cost
         if (data.available) {
           console.log(`Estimated cost: ${data.estimatedCost} credits`);
         } else {
           alert(`Insufficient credits: Need ${data.estimatedCost}, have ${data.currentBalance}`);
         }
         break;
         
       case 'credit_deduction':
         // Credits were charged
         if (data.success) {
           console.log(`Charged ${data.amountCharged} credits`);
           // Refresh credit balance display
           window.dispatchEvent(new Event('credits-updated'));
         }
         break;
     }
   };
   ```

## ✅ Verification Checklist

After installation, verify everything works:

- [ ] Database tables created (user_credits, credit_costs, credit_transactions)
- [ ] Initial costs loaded (~15 agents with costs)
- [ ] Trigger creates credits for new users
- [ ] Existing users have initial credits
- [ ] Backend API responds to `/api/credits/health`
- [ ] Can fetch credit balance with auth
- [ ] Can view pricing without auth
- [ ] Can estimate costs for multiple agents
- [ ] Agent execution deducts credits
- [ ] Failed operations don't deduct credits
- [ ] Transaction history records all operations
- [ ] Frontend displays credit balance
- [ ] Low balance warning shows when < 50 credits
- [ ] Insufficient credits returns 402 error

## 🐛 Troubleshooting

### Issue: Tables not created

**Solution:**
```sql
-- Check if tables exist
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- If missing, run the schema again
-- Copy contents of create_credits_tables.sql
```

### Issue: Trigger not working for new users

**Solution:**
```sql
-- Check if trigger exists
SELECT trigger_name, event_object_table, action_statement 
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_initialize_user_credits';

-- If missing, recreate:
CREATE TRIGGER trigger_initialize_user_credits
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_user_credits();
```

### Issue: Credit costs not found

**Solution:**
```sql
-- Check if costs exist
SELECT COUNT(*) FROM credit_costs WHERE is_active = true;

-- If 0, re-run the INSERT statements from create_credits_tables.sql
-- Starting from line "-- INITIAL CREDIT COSTS CONFIGURATION"
```

### Issue: RLS blocking credit operations

**Solution:**
```sql
-- Check RLS policies
SELECT tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('user_credits', 'credit_transactions');

-- If policies are too restrictive, update them:
-- See create_credits_tables.sql for correct policies
```

### Issue: Backend not loading credit routes

**Solution:**
```bash
# Check if creditController.js exists
ls -la PolarisAI-Backend/credits/creditController.js

# Check if route is added in index.js
grep "creditRoutes" PolarisAI-Backend/index.js

# Restart backend
npm start
```

### Issue: Frontend can't fetch credits

**Solution:**
```typescript
// Check if NEXT_PUBLIC_BACKEND_URL is set
console.log(process.env.NEXT_PUBLIC_BACKEND_URL);

// Check if token is being sent
const token = localStorage.getItem('token');
console.log('Token exists:', !!token);

// Check network tab for 401 errors
```

## 🎯 Next Steps

After successful installation:

1. **Monitor Usage**
   ```sql
   -- Check daily credit usage
   SELECT 
     DATE(created_at) as date,
     COUNT(*) as transactions,
     SUM(amount) as total_credits
   FROM credit_transactions
   WHERE transaction_type = 'debit'
   GROUP BY DATE(created_at)
   ORDER BY date DESC
   LIMIT 7;
   ```

2. **Adjust Costs if Needed**
   ```javascript
   // Update cost for an agent
   const creditService = require('./credits/creditService');
   
   await creditService.updateCreditCost(
     'research',  // agent name
     null,        // tool name
     15.0,        // new cost
     'Increased cost for premium research agent'
   );
   ```

3. **Set Up Monitoring**
   - Monitor low balance users
   - Track popular agents
   - Analyze credit usage patterns
   - Set up alerts for system errors

4. **Implement Billing (Future)**
   - Add Stripe integration for credit purchases
   - Create credit packages (100, 500, 1000 credits)
   - Add subscription tiers
   - Implement promo codes

## 📚 Additional Resources

- [README.md](./README.md) - Complete credit system overview
- [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) - Detailed integration instructions
- [mainAgentIntegration.example.js](./mainAgentIntegration.example.js) - Code examples

## 🎉 Success!

If all verification steps pass, your credit system is fully installed and operational!

Users will now:
- ✅ Receive 1000 free credits on signup
- ✅ See their credit balance in the UI
- ✅ Get cost estimates before actions
- ✅ Have credits deducted only after successful operations
- ✅ View complete transaction history
- ✅ Get warnings when credits are low

Happy coding! 🚀
