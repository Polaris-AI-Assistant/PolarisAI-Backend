# Main Agent Quick Reference

## Quick Start

### 1. Basic Query
```bash
curl -X POST http://localhost:3000/api/agent/query \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "schedule a meeting tomorrow at 2pm"}'
```

### 2. Multi-Service Query
```bash
curl -X POST http://localhost:3000/api/agent/query \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "create a project document and schedule a review meeting"}'
```

## Common Query Patterns

### Single Service Queries

| Query | Agent Used | Example |
|-------|-----------|---------|
| Calendar events | Calendar | "Show my meetings today" |
| Create document | Docs | "Create a project plan document" |
| Form management | Forms | "Create a feedback form" |
| GitHub info | GitHub | "Show my repositories" |
| Meeting spaces | Meet | "Create a new meeting" |
| Spreadsheets | Sheets | "Create a budget spreadsheet" |

### Multi-Service Queries

| Pattern | Agents | Example |
|---------|--------|---------|
| Meeting + Doc | Calendar + Docs | "Schedule meeting and create agenda" |
| Form + Sheet | Forms + Sheets | "Create form and tracking spreadsheet" |
| Meet + Calendar | Meet + Calendar | "Create meeting space and add to calendar" |
| Doc + Share | Docs + Calendar | "Create doc and schedule review" |

## Response Structure

### Single Agent Response
```json
{
  "success": true,
  "query": "show my calendar events",
  "response": "You have 3 events today...",
  "agentUsed": "calendar",
  "toolsUsed": ["listEvents"],
  "singleAgent": true,
  "processingTime": "1234ms",
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

### Multi-Agent Response
```json
{
  "success": true,
  "query": "schedule meeting and create document",
  "response": "I've scheduled your meeting...",
  "agentsUsed": ["calendar", "docs"],
  "toolsUsed": [
    {"agent": "calendar", "tool": "createEvent"},
    {"agent": "docs", "tool": "createDocument"}
  ],
  "multiAgent": true,
  "analysis": {
    "reasoning": "User wants both scheduling and documentation",
    "sequential": true
  },
  "processingTime": "2341ms",
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

## Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/agent/query` | POST | Yes | Main query endpoint |
| `/api/agent/info` | GET | No | Agent information |
| `/api/agent/examples` | GET | No | Example queries |
| `/api/agent/health` | GET | No | System health |
| `/api/agent/test` | POST | No | Dev testing (dev only) |

## Testing

### Run Test Suite
```bash
node mainAgent/testMainAgent.js
```

### Interactive Mode
```bash
node mainAgent/testMainAgent.js --interactive
```

### Direct Test (Dev Mode)
```bash
curl -X POST http://localhost:3000/api/agent/test \
  -H "Content-Type: application/json" \
  -d '{
    "query": "show my calendar events",
    "userId": "test-user-123"
  }'
```

## Error Handling

### Partial Success
If one agent fails, others continue:
```json
{
  "success": true,
  "response": "Created document, but couldn't schedule meeting",
  "agentsUsed": ["docs"],
  "errors": {
    "calendar": {
      "error": "Not connected to Google Calendar",
      "query": "schedule meeting"
    }
  }
}
```

### Complete Failure
```json
{
  "success": false,
  "query": "...",
  "error": "Failed to process query",
  "message": "Detailed error message",
  "timestamp": "..."
}
```

## Best Practices

### Query Writing
✅ **Good**: "Schedule a team meeting tomorrow at 2pm for 1 hour"
❌ **Bad**: "meeting"

✅ **Good**: "Create a document called 'Q1 Report' and add a heading"
❌ **Bad**: "make doc"

✅ **Good**: "Show my GitHub repos from last month and my calendar for this week"
❌ **Bad**: "github and calendar stuff"

### Performance Tips
- Use specific dates/times to reduce processing
- Keep queries focused but complete
- Reference specific items when possible
- Combine related requests in one query

### Authentication
- Ensure user is connected to required services
- Check service status before complex queries
- Handle auth errors gracefully in your app

## Integration Example

### JavaScript/TypeScript
```typescript
class MainAgentClient {
  constructor(private baseUrl: string, private token: string) {}

  async query(query: string, conversationHistory?: any[]) {
    const response = await fetch(`${this.baseUrl}/api/agent/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query, conversationHistory })
    });
    
    if (!response.ok) {
      throw new Error(`Query failed: ${response.statusText}`);
    }
    
    return await response.json();
  }

  async getInfo() {
    const response = await fetch(`${this.baseUrl}/api/agent/info`);
    return await response.json();
  }
}

// Usage
const client = new MainAgentClient('http://localhost:3000', 'your-token');
const result = await client.query('schedule a meeting tomorrow');
console.log(result.response);
```

### React Hook
```typescript
import { useState } from 'react';

export function useMainAgent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = async (queryText: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/agent/query', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: queryText })
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message);
      }
      
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { query, loading, error };
}
```

## Debugging

### Enable Verbose Logging
Check server console for detailed logs:
```
[MainAgent] Processing query for user XXX: "..."
[MainAgent] Query analysis: {...}
[MainAgent] Executing calendar sequentially with query: "..."
[MainAgent] Error executing calendar: ...
```

### Check Agent Health
```bash
curl http://localhost:3000/api/agent/health
```

### Verify Agent Availability
```bash
curl http://localhost:3000/api/agent/info
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Agent not found" | Check agent initialization in MainAgent |
| Slow responses | Check OpenAI API latency |
| Auth errors | Verify service connections |
| Routing issues | Review query analysis logs |
| Partial results | Check individual agent logs |

## Environment Setup

Required environment variables:
```env
OPENAI_API_KEY=sk-...
NODE_ENV=development  # or production
PORT=3000
```

## Monitoring

Key metrics to track:
- Average processing time
- Agent success rates
- Most used agents
- Error frequencies
- Query patterns

## Support

1. Check `/api/agent/examples` for query ideas
2. Review `/api/agent/info` for capabilities
3. Use `/api/agent/health` for system status
4. Check server logs for detailed traces
