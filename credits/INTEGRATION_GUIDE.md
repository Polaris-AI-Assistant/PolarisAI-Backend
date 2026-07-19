# Credit System Integration Guide

This guide explains how to integrate the credit system with the main agent controller and individual agent endpoints.

## 🎯 Integration Strategy

The credit system is designed to integrate **seamlessly** with existing code:
- ✅ Non-breaking: Works alongside existing functionality
- ✅ Fail-safe: Errors don't block agent execution
- ✅ Automatic: Minimal code changes required
- ✅ Transparent: Clear logging for debugging

## 🚀 Quick Start: Main Agent Integration

### Step 1: Import Credit Integration

In `mainAgent/mainAgentController.js`, add the import at the top:

```javascript
// Credit System imports
const { getCreditInfoForStream, deductCreditsForAgents, getCreditDeductionInfoForStream } = require('../credits/creditIntegration');
const { checkCredits } = require('../middleware/creditMiddleware');
```

### Step 2: Add Credit Check Middleware

Add the credit check middleware to the main streaming endpoint:

```javascript
router.post('/query/stream', 
  authenticateToken,
  checkCredits,  // ← Add this line
  async (req, res) => {
    // ... existing code ...
  }
);
```

### Step 3: Send Credit Info to Client (Before Execution)

After determining which agents will be used, send credit info to the client:

```javascript
// After MainAgent determines which agents will be used
const agentsUsed = ['calendar', 'gmail']; // Example from MainAgent analysis

// Send credit info to client
const creditInfo = await getCreditInfoForStream(agentsUsed, userId);
res.write(`data: ${JSON.stringify(creditInfo)}\n\n`);

// Check if user has sufficient credits
if (!creditInfo.available) {
  res.write(`data: ${JSON.stringify({ 
    type: 'error', 
    error: 'Insufficient credits',
    estimatedCost: creditInfo.estimatedCost,
    currentBalance: creditInfo.currentBalance,
    shortfall: creditInfo.shortfall
  })}\n\n`);
  res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
  res.end();
  return;
}
```

### Step 4: Deduct Credits After Success

After the main agent successfully completes:

```javascript
// After successful execution
if (result && result.success) {
  // Deduct credits for all agents that were used
  const deductionResult = await deductCreditsForAgents(
    agentsUsed,  // Array of agent names that were executed
    userId,
    {
      query: query,
      conversationId: conversationId,
      timestamp: new Date().toISOString()
    }
  );
  
  // Send deduction info to client
  const deductionInfo = getCreditDeductionInfoForStream(deductionResult);
  res.write(`data: ${JSON.stringify(deductionInfo)}\n\n`);
}
```

## 📝 Complete Example: Main Agent Controller

Here's a complete example showing where to add credit logic:

```javascript
router.post('/query/stream', authenticateToken, checkCredits, async (req, res) => {
  try {
    const { query, conversationHistory, conversationId } = req.body;
    const userId = req.user.id;

    // ... validation code ...

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send thinking indicator
    res.write(`data: ${JSON.stringify({ type: 'thinking', status: 'start' })}\n\n`);

    // Track agents used and complete response
    let agentsUsed = [];
    let completeResponse = '';

    try {
      // Process query with MainAgent - this determines which agents are needed
      const result = await mainAgent.processQueryWithStreaming(
        query, 
        userId, 
        { conversationHistory, conversationId },
        (chunk) => {
          // Capture agents used from metadata
          if (chunk.type === 'metadata' && chunk.agentsUsed) {
            agentsUsed = chunk.agentsUsed;
            
            // ✅ SEND CREDIT INFO AS SOON AS WE KNOW WHICH AGENTS WILL BE USED
            getCreditInfoForStream(agentsUsed, userId).then(creditInfo => {
              res.write(`data: ${JSON.stringify(creditInfo)}\n\n`);
              
              // If insufficient credits, we could stop here
              // But MainAgent already executed, so we'll charge after
            });
          }
          
          // Accumulate response
          if (chunk.type === 'content' && chunk.text) {
            completeResponse += chunk.text;
          }
          
          // Stream to client
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }
      );

      // ✅ DEDUCT CREDITS AFTER SUCCESSFUL EXECUTION
      if (result && result.success && agentsUsed.length > 0) {
        console.log(`[MainAgentController] 💳 Deducting credits for ${agentsUsed.length} agents`);
        
        const deductionResult = await deductCreditsForAgents(
          agentsUsed,
          userId,
          {
            query: query,
            conversationId: conversationId || null,
            toolsUsed: result.toolsUsed || [],
            timestamp: new Date().toISOString()
          }
        );
        
        // Send deduction info to client
        const deductionInfo = getCreditDeductionInfoForStream(deductionResult);
        res.write(`data: ${JSON.stringify(deductionInfo)}\n\n`);
        
        if (deductionResult.success) {
          console.log(`[MainAgentController] ✅ Credits deducted: ${deductionResult.totalDeducted}. New balance: ${deductionResult.newBalance}`);
        } else {
          console.error(`[MainAgentController] ⚠️ Credit deduction failed: ${deductionResult.error}`);
          // Note: Query still succeeded, just log for manual reconciliation
        }
      }

      // Send completion signal
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();

    } catch (error) {
      console.error('[MainAgentController] Streaming error:', error);
      // ❌ NO CREDITS DEDUCTED ON ERROR
      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        error: error.message || 'Failed to process query' 
      })}\n\n`);
      res.end();
    }

  } catch (error) {
    console.error('[MainAgentController] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process query',
      message: error.message
    });
  }
});
```

## 🔧 Individual Agent Integration

For individual agent endpoints (e.g., `/api/calendar/agent/query`), use the middleware approach:

```javascript
const { checkCreditsForAgent, deductCreditsAfterExecution } = require('../middleware/creditMiddleware');

router.post('/agent/query', 
  authenticateToken,
  checkCreditsForAgent('calendar'),  // ← Checks before execution
  async (req, res) => {
    try {
      const { query, conversationHistory } = req.body;
      const userId = req.user.id;

      // Execute agent
      const agent = new CalendarAgentMultiStep();
      const result = await agent.processQuery(query, { 
        userId, 
        conversationHistory 
      });

      // ✅ DEDUCT CREDITS AFTER SUCCESS
      if (result.success) {
        await deductCreditsAfterExecution(req, 'calendar', null, {
          query: query,
          toolsUsed: result.toolsUsed || [],
          timestamp: new Date().toISOString()
        });
      }

      res.json(result);

    } catch (error) {
      console.error('[CalendarAgentController] Error:', error);
      // ❌ NO CREDITS DEDUCTED ON ERROR
      res.status(500).json({
        success: false,
        error: 'Failed to process query',
        message: error.message
      });
    }
  }
);
```

## 🎨 Frontend Integration

### 1. Add Credit Balance to Navigation

In your main navigation component (e.g., `Navbar.tsx`):

```typescript
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

### 2. Handle Credit Info in SSE Stream

Update your streaming handler to process credit events:

```typescript
const eventSource = new EventSource('/api/agent/query/stream', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch (data.type) {
    case 'credit_info':
      // Show estimated cost to user
      if (!data.available) {
        showError(`Insufficient credits: Need ${data.estimatedCost}, have ${data.currentBalance}`);
        eventSource.close();
      } else {
        showInfo(`This action will cost approximately ${data.estimatedCost} credits`);
      }
      break;
      
    case 'credit_deduction':
      // Update UI after credits deducted
      if (data.success) {
        showSuccess(`Charged ${data.amountCharged} credits. New balance: ${data.newBalance}`);
        // Trigger credit balance refresh
        window.dispatchEvent(new Event('credits-updated'));
      }
      break;
      
    case 'content':
      // ... handle content ...
      break;
      
    case 'done':
      eventSource.close();
      break;
  }
};
```

### 3. Show Cost Estimate Before Execution

For better UX, show estimated cost before user confirms:

```typescript
const estimateCost = async (agents: string[]) => {
  const response = await fetch(
    `/api/credits/estimate?agents=${agents.join(',')}`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );
  return await response.json();
};

// Before executing query
const { total, breakdown } = await estimateCost(['calendar', 'gmail']);

const confirmed = await showConfirmDialog({
  title: 'Confirm Action',
  message: `This action will cost approximately ${total} credits`,
  details: breakdown,
  confirmText: 'Execute',
  cancelText: 'Cancel'
});

if (confirmed) {
  // Execute query
}
```

## 🔍 Testing

### 1. Test Credit Flow

```bash
# Get initial balance
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/credits/balance

# Execute an agent (should deduct credits)
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"create a calendar event for tomorrow"}' \
  http://localhost:3000/api/agent/query/stream

# Check balance again (should be reduced)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/credits/balance
```

### 2. Test Insufficient Credits

```sql
-- Temporarily reduce user credits for testing
UPDATE user_credits 
SET balance = 0.5 
WHERE user_id = 'test-user-id';
```

Then try executing an expensive agent (e.g., research) - should get 402 error.

### 3. Test Failure (No Charge)

Create a query that will fail (e.g., invalid parameters) and verify no credits were deducted:

```bash
# Execute with invalid data
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":""}' \
  http://localhost:3000/api/agent/query/stream

# Check balance (should be unchanged)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/credits/balance
```

## 📊 Monitoring

### Log Analysis

Credit-related logs are prefixed for easy filtering:

```bash
# View all credit operations
grep "\[CreditService\]" logs/app.log

# View credit checks
grep "\[CreditMiddleware\]" logs/app.log

# View credit integrations
grep "\[CreditIntegration\]" logs/app.log
```

### Database Queries

```sql
-- Recent transactions
SELECT * FROM credit_transactions 
ORDER BY created_at DESC 
LIMIT 10;

-- Users with low balance
SELECT user_id, balance 
FROM user_credits 
WHERE balance < 50 
ORDER BY balance ASC;

-- Popular agents (by cost)
SELECT 
  agent_name,
  COUNT(*) as usage_count,
  SUM(amount) as total_cost
FROM credit_transactions 
WHERE transaction_type = 'debit'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY agent_name
ORDER BY total_cost DESC;
```

## 🐛 Troubleshooting

### Credits Not Deducted

**Check:**
1. Is the middleware added to the route?
2. Did the operation succeed? (Credits only deducted on success)
3. Check logs for `[CreditService]` errors
4. Verify user_id is correct

### Credits Deducted Twice

**Possible causes:**
1. Endpoint called twice (check frontend)
2. Retry logic triggering (check error handling)
3. Manual deduction + automatic deduction (remove one)

### Insufficient Credits Error

**Check:**
1. User's actual balance: `SELECT balance FROM user_credits WHERE user_id = '...'`
2. Required cost: `SELECT cost FROM credit_costs WHERE agent_name = '...'`
3. Credit check logs

## 🎯 Best Practices

1. **Always check credits before execution** - Use middleware
2. **Only deduct on success** - Wrap in success check
3. **Log everything** - Helps with debugging and reconciliation
4. **Fail gracefully** - Don't block operations if credit system has issues
5. **Update UI immediately** - Trigger credit balance refresh after deduction
6. **Test edge cases** - Zero balance, exact balance, negative balance attempts

## 📝 Summary

The credit system integrates in 3 simple steps:

1. **Add middleware** - `checkCredits` or `checkCreditsForAgent('agentName')`
2. **Deduct after success** - `deductCreditsAfterExecution()` or `deductCreditsForAgents()`
3. **Update frontend** - Handle credit events in SSE stream

That's it! The system handles the rest automatically.
