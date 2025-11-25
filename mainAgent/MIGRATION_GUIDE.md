# Migration Guide: Upgrading to Main Coordinator Agent

## Overview
This guide helps you migrate from using individual agent endpoints to the new Main Coordinator Agent system.

## What's New?

### Before (Individual Agents)
```javascript
// Had to call multiple endpoints manually
const calendarResponse = await fetch('/api/calendar/agent/query', {
  method: 'POST',
  body: JSON.stringify({ query: 'show my events' })
});

const docsResponse = await fetch('/api/docs/agent/query', {
  method: 'POST', 
  body: JSON.stringify({ query: 'create a document' })
});

// Had to combine responses yourself
```

### After (Main Coordinator Agent)
```javascript
// Single endpoint handles everything
const response = await fetch('/api/agent/query', {
  method: 'POST',
  body: JSON.stringify({ 
    query: 'show my events and create a document' 
  })
});

// Automatically routes, executes, and combines responses
```

## Benefits of Upgrading

### 1. Simplified API Calls
- **Before**: Multiple endpoint calls for multi-service tasks
- **After**: Single endpoint handles everything

### 2. Intelligent Routing
- **Before**: You decide which agent to call
- **After**: System automatically determines optimal routing

### 3. Better Responses
- **Before**: Separate responses to combine manually
- **After**: Unified, coherent response

### 4. Parallel Execution
- **Before**: Sequential calls (slower)
- **After**: Parallel execution when possible (faster)

## Backward Compatibility

### ✅ Existing Endpoints Still Work
All individual agent endpoints remain functional:
- `/api/calendar/agent/query`
- `/api/docs/agent/query`
- `/api/forms/agent/query`
- `/api/github/agent/query`
- `/api/meet/agent/query`
- `/api/sheets/agent/query`

**You don't have to change existing code immediately!**

### Migration Strategy
1. **Phase 1**: Test new endpoint alongside old ones
2. **Phase 2**: Gradually migrate complex queries
3. **Phase 3**: Update all queries to use main agent
4. **Phase 4**: (Optional) Keep individual endpoints for specific use cases

## Migration Examples

### Example 1: Simple Single-Service Query

#### Before
```javascript
async function getCalendarEvents() {
  const response = await fetch('/api/calendar/agent/query', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: 'show my events today'
    })
  });
  return await response.json();
}
```

#### After (Option 1: Use Main Agent)
```javascript
async function getCalendarEvents() {
  const response = await fetch('/api/agent/query', {  // Changed endpoint
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: 'show my events today'
    })
  });
  return await response.json();
}
```

#### After (Option 2: Keep Individual Endpoint)
```javascript
// No change needed - individual endpoints still work!
async function getCalendarEvents() {
  const response = await fetch('/api/calendar/agent/query', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: 'show my events today'
    })
  });
  return await response.json();
}
```

### Example 2: Multi-Service Query

#### Before (Multiple Calls)
```javascript
async function setupProject() {
  // Call 1: Create document
  const docResponse = await fetch('/api/docs/agent/query', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: 'create a project plan document'
    })
  });
  const docData = await docResponse.json();
  
  // Call 2: Create calendar event
  const calResponse = await fetch('/api/calendar/agent/query', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: 'schedule project meeting tomorrow'
    })
  });
  const calData = await calResponse.json();
  
  // Manually combine responses
  return {
    document: docData.response,
    meeting: calData.response
  };
}
```

#### After (Single Call)
```javascript
async function setupProject() {
  const response = await fetch('/api/agent/query', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: 'create a project plan document and schedule a meeting tomorrow to discuss it'
    })
  });
  
  const data = await response.json();
  
  // Response already combined and formatted
  return {
    success: data.success,
    message: data.response,
    agentsUsed: data.agentsUsed,
    processingTime: data.processingTime
  };
}
```

### Example 3: Conditional Service Usage

#### Before
```javascript
async function handleUserRequest(request) {
  let response;
  
  if (request.includes('calendar') || request.includes('meeting')) {
    response = await fetch('/api/calendar/agent/query', {
      method: 'POST',
      body: JSON.stringify({ query: request })
    });
  } else if (request.includes('document') || request.includes('doc')) {
    response = await fetch('/api/docs/agent/query', {
      method: 'POST',
      body: JSON.stringify({ query: request })
    });
  } else if (request.includes('form')) {
    response = await fetch('/api/forms/agent/query', {
      method: 'POST',
      body: JSON.stringify({ query: request })
    });
  } else {
    throw new Error('Unknown request type');
  }
  
  return await response.json();
}
```

#### After (Automatic Routing)
```javascript
async function handleUserRequest(request) {
  // Main agent automatically determines which service(s) to use
  const response = await fetch('/api/agent/query', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: request })
  });
  
  return await response.json();
  // No need for conditional logic!
}
```

## Response Format Changes

### Individual Agent Response
```json
{
  "success": true,
  "response": "I've scheduled your meeting...",
  "query": "schedule a meeting",
  "tools_used": ["createEvent"],
  "timestamp": "..."
}
```

### Main Agent Response (Single Agent)
```json
{
  "success": true,
  "response": "I've scheduled your meeting...",
  "query": "schedule a meeting",
  "agentUsed": "calendar",  // NEW: Which agent was used
  "toolsUsed": ["createEvent"],
  "singleAgent": true,  // NEW: Indicates single agent
  "processingTime": "1234ms",  // NEW: Processing time
  "timestamp": "..."
}
```

### Main Agent Response (Multi-Agent)
```json
{
  "success": true,
  "response": "I've created your document and scheduled the meeting...",
  "query": "create doc and schedule meeting",
  "agentsUsed": ["docs", "calendar"],  // NEW: Multiple agents
  "toolsUsed": [  // NEW: Tools per agent
    {"agent": "docs", "tool": "createDocument"},
    {"agent": "calendar", "tool": "createEvent"}
  ],
  "multiAgent": true,  // NEW: Indicates multi-agent
  "analysis": {  // NEW: Routing analysis
    "reasoning": "...",
    "sequential": true
  },
  "processingTime": "2341ms",
  "timestamp": "..."
}
```

## Updating Your Frontend

### React Component Example

#### Before
```jsx
function AgentInterface() {
  const [response, setResponse] = useState('');
  
  const handleCalendarQuery = async (query) => {
    const res = await fetch('/api/calendar/agent/query', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });
    const data = await res.json();
    setResponse(data.response);
  };
  
  const handleDocsQuery = async (query) => {
    const res = await fetch('/api/docs/agent/query', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });
    const data = await res.json();
    setResponse(data.response);
  };
  
  // ... more handlers
  
  return (
    <div>
      <button onClick={() => handleCalendarQuery('show events')}>
        Calendar
      </button>
      <button onClick={() => handleDocsQuery('create doc')}>
        Docs
      </button>
      {/* More buttons... */}
      <div>{response}</div>
    </div>
  );
}
```

#### After
```jsx
function AgentInterface() {
  const [response, setResponse] = useState('');
  const [agentsUsed, setAgentsUsed] = useState([]);
  
  const handleQuery = async (query) => {
    const res = await fetch('/api/agent/query', {  // Single endpoint
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });
    const data = await res.json();
    setResponse(data.response);
    setAgentsUsed(data.agentsUsed || [data.agentUsed]);
  };
  
  return (
    <div>
      <input 
        placeholder="Ask anything..." 
        onSubmit={(e) => handleQuery(e.target.value)}
      />
      <div>{response}</div>
      {agentsUsed.length > 0 && (
        <div>Used: {agentsUsed.join(', ')}</div>
      )}
    </div>
  );
}
```

## Testing Your Migration

### Step 1: Test Individual Queries
```bash
# Test that individual endpoints still work
curl -X POST http://localhost:3000/api/calendar/agent/query \
  -H "Authorization: Bearer TOKEN" \
  -d '{"query": "show events"}'

# Test new main agent endpoint with same query
curl -X POST http://localhost:3000/api/agent/query \
  -H "Authorization: Bearer TOKEN" \
  -d '{"query": "show events"}'

# Compare responses
```

### Step 2: Test Multi-Agent Queries
```bash
# Test complex query with new endpoint
curl -X POST http://localhost:3000/api/agent/query \
  -H "Authorization: Bearer TOKEN" \
  -d '{"query": "create a document and schedule a meeting"}'
```

### Step 3: Run Test Suite
```bash
node mainAgent/testMainAgent.js
```

## Common Issues & Solutions

### Issue 1: Different Response Structure
**Problem**: Code expects specific response fields from individual agents

**Solution**: Update response parsing to handle new structure
```javascript
// Before
const events = response.tools_used;

// After
const events = response.toolsUsed || response.tools_used;
```

### Issue 2: Expecting Specific Agent
**Problem**: Code assumes only one agent will respond

**Solution**: Check if multi-agent response
```javascript
if (response.singleAgent) {
  // Handle single agent response
  handleSingleAgent(response);
} else if (response.multiAgent) {
  // Handle multi-agent response
  handleMultiAgent(response);
}
```

### Issue 3: Response Timing
**Problem**: Main agent may take longer due to analysis step

**Solution**: Add loading states and timeouts
```javascript
const [loading, setLoading] = useState(false);

const handleQuery = async (query) => {
  setLoading(true);
  try {
    const response = await fetch('/api/agent/query', {
      method: 'POST',
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(30000) // 30s timeout
    });
    // ... handle response
  } finally {
    setLoading(false);
  }
};
```

## Rollback Plan

If you encounter issues, you can easily rollback:

### 1. Continue Using Individual Endpoints
Individual agent endpoints are unchanged and fully functional.

### 2. Remove Main Agent Routes (if needed)
In `index.js`, comment out:
```javascript
// const mainAgentRoutes = require('./mainAgent/mainAgentController');
// app.use('/api/agent', mainAgentRoutes);
```

## Best Practices for Migration

### 1. Start Small
- Begin with simple, non-critical queries
- Test thoroughly before expanding

### 2. Gradual Rollout
- Migrate feature by feature
- Keep individual endpoints as fallback

### 3. Monitor Performance
- Track response times
- Monitor error rates
- Collect user feedback

### 4. Update Documentation
- Document your migration progress
- Update API documentation
- Train team members

## Getting Help

### Resources
- **README**: `mainAgent/README.md`
- **Quick Reference**: `mainAgent/QUICK_REFERENCE.md`
- **Examples**: `GET /api/agent/examples`
- **Health Check**: `GET /api/agent/health`

### Testing
- Test script: `node mainAgent/testMainAgent.js`
- Interactive mode: `node mainAgent/testMainAgent.js --interactive`

### Support
- Check logs for detailed error messages
- Review `IMPLEMENTATION_SUMMARY.md` for architecture details
- Use test endpoint in development: `POST /api/agent/test`

## Timeline Recommendation

### Week 1: Evaluation
- Read documentation
- Test main agent with sample queries
- Compare with current implementation

### Week 2: Preparation
- Update response handling in your code
- Add error handling for new response format
- Create test cases

### Week 3: Gradual Migration
- Migrate 25% of queries
- Monitor performance
- Fix any issues

### Week 4: Full Migration
- Migrate remaining queries
- Update all documentation
- Train team

## Conclusion

The Main Coordinator Agent provides a more powerful and flexible way to interact with your services. While migration requires some updates to your code, the benefits of simplified API calls, intelligent routing, and unified responses make it worthwhile.

**Remember**: You can take your time with the migration since all existing endpoints continue to work!
