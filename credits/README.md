# Credit System for Polaris AI

A comprehensive credit-based pricing system that seamlessly integrates with the existing Polaris AI architecture.

## 🎯 Overview

The credit system provides:
- **Fair Usage Pricing**: Each agent/tool has a professional, reasonable cost based on complexity and API usage
- **Free Credits**: Every new user receives **1,000 free credits** to get started
- **Pay-per-Use**: Credits are only deducted after successful operations (never on failures)
- **Transparent Costs**: Users see estimated costs before execution
- **Complete Audit Trail**: Full transaction history for compliance and transparency

## 📊 Credit Costs

### Basic Operations (1-2 credits)
- **Conversational Agent**: 1 credit - General Q&A, coding assistance

### Standard Operations (2-4 credits)
- **Calendar Agent**: 2 credits - Google Calendar operations
- **Docs Agent**: 2 credits - Google Docs operations
- **Sheets Agent**: 2 credits - Google Sheets operations
- **Forms Agent**: 2 credits - Google Forms operations
- **Meet Agent**: 2 credits - Google Meet operations
- **Weather Agent**: 2 credits - Weather data and forecasts
- **Schedules Agent**: 2 credits - Reminders and scheduled actions

### Medium Operations (3-4 credits)
- **Gmail Agent**: 3 credits - Email operations
- **GitHub Agent**: 3 credits - Repository operations
- **Microsoft Agent**: 3 credits - Microsoft 365 operations
- **Maps Agent**: 4 credits - Google Maps operations

### Search Operations (5 credits)
- **Web Search Agent**: 5 credits - Web, news, and image search
- **Flights Agent**: 5 credits - Flight search via SerpAPI

### Premium Operations (10+ credits)
- **Research Agent**: 10 credits - Comprehensive deep research with multiple sources

### File Generation (1-3 credits)
- **TXT File**: 1 credit
- **PDF File**: 3 credits

## 🗄️ Database Schema

The system uses three main tables:

### 1. `user_credits`
Stores each user's current credit balance.

```sql
- user_id (UUID, FK to auth.users)
- balance (decimal) - Current available credits
- total_earned (decimal) - Lifetime credits earned
- total_spent (decimal) - Lifetime credits spent
- created_at, updated_at
```

### 2. `credit_costs`
Configurable costs for each agent/tool.

```sql
- agent_name (text) - Name of the agent
- tool_name (text, nullable) - Specific tool within agent
- cost (decimal) - Credit cost
- description (text) - Human-readable description
- category (text) - Cost category (basic, standard, premium, etc.)
- is_active (boolean) - Enable/disable costs
```

### 3. `credit_transactions`
Complete audit log of all credit operations.

```sql
- user_id (UUID, FK to auth.users)
- transaction_type (text) - credit, debit, refund, adjustment, initial
- amount (decimal)
- balance_before, balance_after (decimal)
- agent_name, tool_name (text)
- description (text)
- metadata (jsonb) - Additional context
- status (text) - completed, pending, failed, refunded
- created_at
```

## 🚀 Installation

### 1. Run SQL Schema

Execute the SQL schema in your Supabase SQL editor:

```bash
# In Supabase Dashboard > SQL Editor
# Copy and paste the contents of:
PolarisAI-Backend/credits/create_credits_tables.sql
```

This will:
- ✅ Create all credit tables
- ✅ Set up automatic initial credit allocation for new users
- ✅ Create helper functions for atomic credit updates
- ✅ Configure Row Level Security (RLS)
- ✅ Insert initial credit costs configuration

### 2. Verify Installation

Test the credit system health:

```bash
curl http://localhost:3000/api/credits/health
```

Expected response:
```json
{
  "success": true,
  "status": "healthy",
  "features": [
    "Credit balance tracking",
    "Transaction history",
    "Cost estimation",
    "Multi-agent pricing",
    "Automatic deduction",
    "Refund support",
    "Admin operations"
  ]
}
```

## 📡 API Endpoints

### Get Credit Balance
```http
GET /api/credits/balance
Authorization: Bearer <token>
```

Response:
```json
{
  "success": true,
  "balance": 950.5,
  "totalEarned": 1000,
  "totalSpent": 49.5,
  "isLow": false,
  "lowBalanceThreshold": 50
}
```

### Get Transaction History
```http
GET /api/credits/transactions?limit=50&offset=0&type=debit
Authorization: Bearer <token>
```

Response:
```json
{
  "success": true,
  "transactions": [
    {
      "id": 123,
      "type": "debit",
      "amount": 2.0,
      "balanceBefore": 1000,
      "balanceAfter": 998,
      "agentName": "calendar",
      "description": "calendar operation",
      "createdAt": "2025-01-15T10:30:00Z"
    }
  ],
  "total": 150,
  "hasMore": true
}
```

### Get Pricing
```http
GET /api/credits/pricing
```

Response:
```json
{
  "success": true,
  "costs": [...],
  "grouped": {
    "basic": [...],
    "standard": [...],
    "premium": [...]
  },
  "categories": ["basic", "standard", "search", "premium", "file"]
}
```

### Estimate Cost
```http
GET /api/credits/estimate?agents=calendar,gmail,docs
```

Response:
```json
{
  "success": true,
  "costs": {
    "calendar": 2,
    "gmail": 3,
    "docs": 2
  },
  "total": 7,
  "breakdown": [...]
}
```

### Get Usage Statistics
```http
GET /api/credits/stats
Authorization: Bearer <token>
```

Response:
```json
{
  "success": true,
  "stats": {
    "balance": 950,
    "totalSpent": 50,
    "totalTransactions": 25,
    "averageTransactionSize": 2.0,
    "mostUsedAgent": "calendar",
    "agentUsage": {
      "calendar": 10,
      "gmail": 8,
      "docs": 7
    },
    "recentActivity": [...]
  }
}
```

## 🔧 Integration with Agents

### Automatic Integration (Main Agent)

The main agent controller automatically handles credits:

1. **Before execution**: Checks if user has sufficient credits
2. **During execution**: Tracks which agents are used
3. **After success**: Deducts credits for each agent
4. **On failure**: No credits deducted (fail-safe)

### Manual Integration (Specific Agent Endpoints)

For individual agent endpoints, add credit middleware:

```javascript
const { checkCreditsForAgent } = require('../middleware/creditMiddleware');
const { deductCreditsAfterExecution } = require('../middleware/creditMiddleware');

// Add middleware to route
router.post('/agent/query', 
  authenticateToken, 
  checkCreditsForAgent('calendar'), // Check before execution
  async (req, res) => {
    try {
      // Execute agent logic
      const result = await calendarAgent.processQuery(...);
      
      // Deduct credits after success
      if (result.success) {
        await deductCreditsAfterExecution(req, 'calendar', null, {
          query: req.body.query,
          toolsUsed: result.toolsUsed
        });
      }
      
      res.json(result);
    } catch (error) {
      // No credits deducted on error
      res.status(500).json({ error: error.message });
    }
  }
);
```

## 🎨 Frontend Integration

### Display Credit Balance

The credit balance should be displayed prominently in the UI:

```typescript
// Fetch credit balance
const fetchCredits = async () => {
  const response = await fetch('/api/credits/balance', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const data = await response.json();
  return data;
};

// Usage in component
const { balance, isLow } = await fetchCredits();

// Display with warning if low
<div className={`credit-balance ${isLow ? 'low' : ''}`}>
  <span>Credits: {balance}</span>
  {isLow && <span className="warning">Low balance!</span>}
</div>
```

### Show Cost Before Execution

Before executing an agent, show the estimated cost:

```typescript
// Estimate cost
const estimateCost = async (agents: string[]) => {
  const response = await fetch(
    `/api/credits/estimate?agents=${agents.join(',')}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  return await response.json();
};

// Show to user
const { estimatedCost, breakdown } = await estimateCost(['calendar', 'gmail']);

// Display confirmation
<div className="cost-estimate">
  <p>This action will cost approximately {estimatedCost} credits</p>
  <ul>
    {breakdown.map(item => (
      <li key={item.agent}>{item.agent}: {item.cost} credits</li>
    ))}
  </ul>
  <button onClick={executeAction}>Confirm and Execute</button>
</div>
```

### Handle Insufficient Credits

Handle the 402 Payment Required error:

```typescript
try {
  const response = await fetch('/api/agent/query/stream', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, conversationHistory })
  });
  
  if (response.status === 402) {
    const error = await response.json();
    // Show error to user
    showError(`Insufficient credits: You need ${error.estimatedCost} credits but only have ${error.balance}`);
    // Redirect to billing page
    router.push('/settings/billing');
  }
} catch (error) {
  // Handle error
}
```

## 🔐 Security & Best Practices

### Row Level Security (RLS)
- ✅ Users can only view their own credits
- ✅ Users can only view their own transactions
- ✅ Credit costs table is read-only for users

### Atomic Operations
- ✅ Credit deductions are atomic (all-or-nothing)
- ✅ Balance and transaction log always in sync
- ✅ No race conditions with concurrent requests

### Fail-Safe Design
- ✅ Credits never deducted on failures
- ✅ System errors don't block operations (fail-open)
- ✅ Manual reconciliation possible via transaction log

### Audit Trail
- ✅ Complete transaction history with metadata
- ✅ Every operation logged with timestamp
- ✅ Refund tracking for compliance

## 🛠️ Administration

### Add Credits to User

```javascript
const creditService = require('./credits/creditService');

// Add promotional credits
await creditService.addCredits(
  userId,
  500, // amount
  'Promotional credit - Holiday special',
  { promotion: 'HOLIDAY2025', addedBy: 'admin' }
);
```

### Update Credit Costs

```javascript
// Update cost for an agent
await creditService.updateCreditCost(
  'calendar', // agent name
  null, // tool name (null for agent-level cost)
  3.0, // new cost
  'Updated pricing for Calendar agent'
);
```

### Refund Credits

```javascript
// Refund credits to user
await creditService.refundCredits(
  userId,
  5.0, // amount to refund
  'Refund due to system error on 2025-01-15',
  { originalTransactionId: 123, reason: 'system_error' }
);
```

## 📈 Monitoring & Analytics

### Track Popular Agents

```sql
SELECT 
  agent_name,
  COUNT(*) as usage_count,
  SUM(amount) as total_credits_spent,
  AVG(amount) as avg_cost
FROM credit_transactions
WHERE transaction_type = 'debit'
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY agent_name
ORDER BY usage_count DESC;
```

### Monitor Low Balance Users

```sql
SELECT 
  user_id,
  balance,
  total_spent,
  updated_at
FROM user_credits
WHERE balance < 50
ORDER BY balance ASC;
```

### Transaction Volume

```sql
SELECT 
  DATE(created_at) as date,
  transaction_type,
  COUNT(*) as transaction_count,
  SUM(amount) as total_amount
FROM credit_transactions
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at), transaction_type
ORDER BY date DESC;
```

## 🐛 Troubleshooting

### Credits not initialized for new user

**Symptom**: User gets "Credits not initialized" error

**Solution**: The trigger should automatically create credits. If not:

```sql
-- Manually initialize credits
INSERT INTO user_credits (user_id, balance, total_earned)
VALUES ('user-uuid-here', 1000, 1000);

-- Log initial transaction
INSERT INTO credit_transactions (
  user_id, transaction_type, amount, 
  balance_before, balance_after, description, status
) VALUES (
  'user-uuid-here', 'initial', 1000,
  0, 1000, 'Manual initialization', 'completed'
);
```

### Credits deducted but operation failed

**Symptom**: User charged but didn't get result

**Solution**: The system should auto-refund, but if not:

```javascript
await creditService.refundCredits(
  userId,
  amount,
  'Refund for failed operation',
  { originalTransactionId: txId }
);
```

### Cost not found for agent

**Symptom**: Agent cost returns default value

**Solution**: Add missing cost to database:

```sql
INSERT INTO credit_costs (agent_name, cost, description, category, is_active)
VALUES ('new_agent', 2.0, 'New agent operations', 'standard', true);
```

## 🚦 Testing

### Test Credit Flow

```bash
# 1. Get initial balance
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/credits/balance

# 2. Execute an agent (should deduct credits)
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"create a calendar event"}' \
  http://localhost:3000/api/agent/query/stream

# 3. Check balance again (should be reduced)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/credits/balance

# 4. View transaction history
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/credits/transactions
```

## 📝 Migration Notes

### For Existing Users

If you're adding the credit system to an existing Polaris AI installation:

1. **Run the SQL schema** - This creates all tables and triggers
2. **Existing users** - The trigger only fires for NEW users
3. **Grant credits to existing users**:

```sql
-- Grant initial credits to all existing users
INSERT INTO user_credits (user_id, balance, total_earned)
SELECT 
  id as user_id,
  1000 as balance,
  1000 as total_earned
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM user_credits);

-- Log initial transactions
INSERT INTO credit_transactions (
  user_id, transaction_type, amount,
  balance_before, balance_after, description, status
)
SELECT 
  id as user_id,
  'initial' as transaction_type,
  1000 as amount,
  0 as balance_before,
  1000 as balance_after,
  'Retroactive initial credits for existing user' as description,
  'completed' as status
FROM auth.users
WHERE id NOT IN (
  SELECT user_id FROM credit_transactions WHERE transaction_type = 'initial'
);
```

## 🎯 Future Enhancements

Potential features for future versions:

- [ ] **Credit Packages**: Allow users to purchase credit bundles
- [ ] **Subscription Tiers**: Monthly credits with subscription plans
- [ ] **Credit Expiration**: Optional expiration dates for promotional credits
- [ ] **Usage Alerts**: Email notifications at 50%, 25%, 10% balance
- [ ] **Analytics Dashboard**: Detailed usage analytics and trends
- [ ] **Team Credits**: Shared credit pools for organizations
- [ ] **API Rate Limiting**: Integrate with existing rate limiters
- [ ] **Webhooks**: Notify external systems on credit events

## 📞 Support

For issues or questions:
- Check the troubleshooting section above
- Review transaction logs in `credit_transactions` table
- Check application logs for `[CreditService]` or `[CreditMiddleware]` entries

---

**Built with ❤️ for Polaris AI**
