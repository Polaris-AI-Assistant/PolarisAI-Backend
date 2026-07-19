# Credit System Architecture

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React/Next.js)                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐     ┌────────────────────┐               │
│  │ CreditBalance    │     │  Chat Interface    │               │
│  │ Component        │────▶│  (SSE Stream)      │               │
│  │ - Shows balance  │     │  - Credit info     │               │
│  │ - Low warning    │     │  - Deduction info  │               │
│  └──────────────────┘     └────────────────────┘               │
│           │                         │                             │
│           │ GET /credits/balance    │ POST /agent/query/stream   │
│           ▼                         ▼                             │
└───────────────────────────────────────────────────────────────────┘
            │                         │
            │                         │
┌───────────┴─────────────────────────┴──────────────────────────┐
│                    EXPRESS BACKEND (Node.js)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │               Credit Controller (API Routes)              │  │
│  │  /api/credits/balance                                     │  │
│  │  /api/credits/transactions                                │  │
│  │  /api/credits/pricing                                     │  │
│  │  /api/credits/estimate                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                      │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Credit Middleware                       │  │
│  │  - checkCredits()                                         │  │
│  │  - checkCreditsForAgent()                                 │  │
│  │  - deductCreditsAfterExecution()                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                      │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Credit Service                          │  │
│  │  - getUserCredits()                                       │  │
│  │  - getAgentCost()                                         │  │
│  │  - checkSufficientCredits()                               │  │
│  │  - deductCredits()                                        │  │
│  │  - refundCredits()                                        │  │
│  │  - getTransactionHistory()                                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Credit Integration Helper                    │  │
│  │  - estimateQueryCost()                                    │  │
│  │  - deductCreditsForAgents()                               │  │
│  │  - getCreditInfoForStream()                               │  │
│  │  - getCreditDeductionInfoForStream()                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                      │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │            Main Agent Controller (Modified)               │  │
│  │  /api/agent/query/stream                                  │  │
│  │  - Add checkCredits middleware                            │  │
│  │  - Send credit info before execution                      │  │
│  │  - Deduct credits after success                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                      │
└───────────────────────────┼──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  SUPABASE (PostgreSQL Database)                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌────────────────────┐   ┌────────────────────┐               │
│  │   user_credits     │   │   credit_costs     │               │
│  ├────────────────────┤   ├────────────────────┤               │
│  │ user_id (PK)       │   │ agent_name         │               │
│  │ balance            │   │ tool_name          │               │
│  │ total_earned       │   │ cost               │               │
│  │ total_spent        │   │ description        │               │
│  │ created_at         │   │ category           │               │
│  │ updated_at         │   │ is_active          │               │
│  └────────────────────┘   └────────────────────┘               │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              credit_transactions                         │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ id (PK)                                                  │   │
│  │ user_id (FK)                                             │   │
│  │ transaction_type (credit/debit/refund/adjustment/initial)│   │
│  │ amount                                                   │   │
│  │ balance_before                                           │   │
│  │ balance_after                                            │   │
│  │ agent_name                                               │   │
│  │ tool_name                                                │   │
│  │ description                                              │   │
│  │ metadata (JSONB)                                         │   │
│  │ status                                                   │   │
│  │ created_at                                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   Database Functions                     │   │
│  │  - initialize_user_credits()                             │   │
│  │  - update_user_credits()                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                      Triggers                            │   │
│  │  - trigger_initialize_user_credits (on auth.users)       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

## 🔄 Credit Flow - Successful Operation

```
User Query
    │
    ▼
┌─────────────────────────────────────┐
│ 1. Frontend sends query              │
│    POST /api/agent/query/stream      │
│    with auth token                   │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 2. Credit Middleware                 │
│    - checkCredits()                  │
│    - Verify balance > 0              │
│    - Attach to request               │
└─────────────────────────────────────┘
    │
    │ Balance OK ✅
    ▼
┌─────────────────────────────────────┐
│ 3. Main Agent Analyzes Query         │
│    - Determines agents needed        │
│    - e.g., ['calendar', 'gmail']     │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 4. Get Cost Estimate                 │
│    - getCreditInfoForStream()        │
│    - calendar: 2 credits             │
│    - gmail: 3 credits                │
│    - total: 5 credits                │
└─────────────────────────────────────┘
    │
    │ Send to frontend via SSE
    ▼
┌─────────────────────────────────────┐
│ 5. Frontend Shows Cost               │
│    "This will cost ~5 credits"       │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 6. Execute Agents                    │
│    - CalendarAgent executes          │
│    - GmailAgent executes             │
│    - Both succeed ✅                 │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 7. Deduct Credits                    │
│    - deductCreditsForAgents()        │
│    - Calendar: -2 credits            │
│    - Gmail: -3 credits               │
│    - Total: -5 credits               │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 8. Database Update (Atomic)          │
│    - Update user_credits             │
│    - Insert 2 transactions           │
│    - Balance: 1000 → 995             │
└─────────────────────────────────────┘
    │
    │ Send deduction info via SSE
    ▼
┌─────────────────────────────────────┐
│ 9. Frontend Updates UI               │
│    - Shows new balance: 995          │
│    - Triggers credit refresh         │
└─────────────────────────────────────┘
    │
    ▼
✅ Operation Complete
```

## ❌ Credit Flow - Failed Operation

```
User Query
    │
    ▼
┌─────────────────────────────────────┐
│ 1. Frontend sends query              │
│    POST /api/agent/query/stream      │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 2. Credit Middleware                 │
│    - checkCredits()                  │
│    - Balance OK ✅                   │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 3. Main Agent Analyzes Query         │
│    - Determines agents needed        │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 4. Get Cost Estimate                 │
│    - total: 5 credits                │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 5. Execute Agents                    │
│    - Agent execution fails ❌        │
│    - Error thrown                    │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 6. Error Handler                     │
│    - Catches error                   │
│    - NO deduction called             │
│    - Credits NOT charged ✅          │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 7. Frontend Shows Error              │
│    - Error message displayed         │
│    - Balance unchanged               │
└─────────────────────────────────────┘
    │
    ▼
❌ Operation Failed
💰 Credits NOT Deducted (Fair!)
```

## ⚠️ Credit Flow - Insufficient Credits

```
User Query
    │
    ▼
┌─────────────────────────────────────┐
│ 1. Frontend sends query              │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 2. Credit Middleware                 │
│    - checkCredits()                  │
│    - Balance: 0.5 credits            │
│    - Minimum required: 1 credit      │
│    - Insufficient! ❌                │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 3. Return 402 Error                  │
│    {                                 │
│      "error": "Insufficient credits",│
│      "balance": 0.5,                 │
│      "required": 1,                  │
│      "shortfall": 0.5                │
│    }                                 │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 4. Frontend Shows Error              │
│    "You need 1 credit but only       │
│     have 0.5 credits"                │
│    [Purchase More Credits]           │
└─────────────────────────────────────┘
    │
    ▼
❌ Operation Blocked
🛡️ User Protected from Negative Balance
```

## 🆕 New User Flow

```
User Signs Up
    │
    ▼
┌─────────────────────────────────────┐
│ 1. Supabase Auth Creates User        │
│    - INSERT into auth.users          │
│    - Trigger fires automatically     │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 2. Trigger: initialize_user_credits()│
│    - Creates user_credits record     │
│    - Sets balance = 1000             │
│    - Sets total_earned = 1000        │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 3. Logs Initial Transaction          │
│    - transaction_type = 'initial'    │
│    - amount = 1000                   │
│    - balance_before = 0              │
│    - balance_after = 1000            │
│    - description = 'Welcome bonus'   │
└─────────────────────────────────────┘
    │
    ▼
✅ User has 1,000 free credits!
```

## 🔧 Database Transaction Flow

```
Deduct Credits Request
    │
    ▼
┌─────────────────────────────────────┐
│ 1. Call update_user_credits()        │
│    Parameters:                       │
│    - user_id                         │
│    - transaction_type = 'debit'      │
│    - amount = 5                      │
│    - agent_name = 'calendar'         │
│    - metadata = {...}                │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 2. Lock User Row (FOR UPDATE)        │
│    - Prevents race conditions        │
│    - Ensures atomicity                │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 3. Check Balance                     │
│    - current_balance = 1000          │
│    - required = 5                    │
│    - sufficient? YES ✅              │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 4. Calculate New Balance             │
│    - new_balance = 1000 - 5 = 995    │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 5. Update user_credits               │
│    - SET balance = 995               │
│    - SET total_spent = total + 5     │
│    - SET updated_at = NOW()          │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 6. Insert Transaction Record         │
│    - INSERT into credit_transactions │
│    - All details logged              │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 7. Commit Transaction                │
│    - Both updates succeed            │
│    - Return success + details        │
└─────────────────────────────────────┘
    │
    ▼
✅ Credits Deducted Atomically
```

## 📱 Frontend Component Lifecycle

```
CreditBalance Component
    │
    ▼
┌─────────────────────────────────────┐
│ 1. Component Mounts                  │
│    - useEffect triggers              │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 2. Fetch Initial Balance             │
│    - GET /api/credits/balance        │
│    - Sets loading state              │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 3. Display Balance                   │
│    - Shows credit amount             │
│    - Shows warning if low            │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 4. Auto-Refresh (every 60s)          │
│    - setInterval fetches balance     │
│    - Updates UI if changed           │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 5. Listen for Events                 │
│    - window.addEventListener         │
│    - 'credits-updated' event         │
└─────────────────────────────────────┘
    │
    │ Event fired by SSE handler
    ▼
┌─────────────────────────────────────┐
│ 6. Refresh Balance Immediately       │
│    - Fetch latest balance            │
│    - Update display                  │
└─────────────────────────────────────┘
    │
    ▼
🔄 Continuous Update Cycle
```

## 🔐 Security Layers

```
┌─────────────────────────────────────┐
│         Client Request               │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 1. JWT Authentication                │
│    - Bearer token validation         │
│    - User identity verified          │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 2. Rate Limiting (Optional)          │
│    - Prevent abuse                   │
│    - Per-user limits                 │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 3. Input Validation                  │
│    - Sanitize query parameters       │
│    - Validate amounts                │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 4. Row Level Security (RLS)          │
│    - Users see only their data       │
│    - Enforced at database level      │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 5. Atomic Transactions               │
│    - All-or-nothing updates          │
│    - Prevent partial states          │
└─────────────────────────────────────┘
    │
    ▼
✅ Secure Operation
```

## 📊 Data Relationships

```
        auth.users (Supabase)
              │
              │ user_id (FK)
              │
    ┌─────────┴─────────┐
    │                   │
    ▼                   ▼
user_credits    credit_transactions
    │                   │
    │                   │
    │                   └─ Links to: agent_name
    │                      (for reporting)
    │
    └─ Updated by: credit_transactions
       (balance tracking)


credit_costs (Configuration)
    │
    │ Referenced by: deductCredits()
    │
    └─ Determines cost for each agent
```

## 🎯 Key Design Decisions

### 1. **Deduct After Success**
- ✅ Fair to users
- ✅ No refund complexity
- ✅ Simple error handling

### 2. **Configurable Costs**
- ✅ No code changes needed
- ✅ A/B testing possible
- ✅ Easy price updates

### 3. **Atomic Operations**
- ✅ Database function handles updates
- ✅ Balance + transaction always in sync
- ✅ No race conditions

### 4. **Fail-Open Design**
- ✅ Credit errors don't block operations
- ✅ Better user experience
- ✅ Manual reconciliation possible

### 5. **Complete Audit Trail**
- ✅ JSONB metadata for flexibility
- ✅ Every operation logged
- ✅ Compliance ready

---

This architecture ensures:
- 🔒 **Secure** - RLS, validation, authentication
- ⚡ **Fast** - Optimized queries, indexes
- 🛡️ **Reliable** - Atomic operations, fail-safe
- 📈 **Scalable** - Handles high transaction volume
- 🔧 **Maintainable** - Clear separation of concerns
