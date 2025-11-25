# Main Coordinator Agent

## Overview

The Main Coordinator Agent is a central intelligent agent that coordinates all app-specific agents in the system. It analyzes user requests, determines which specialized agents are required, routes queries appropriately, and combines responses into coherent, user-friendly outputs.

## Architecture

```
User Query
    ↓
Main Agent (Coordinator)
    ↓
Query Analysis (OpenAI)
    ↓
Routing Decision
    ↓
┌─────────────────────────────────────────┐
│  Parallel or Sequential Execution       │
├─────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │Calendar │  │  Docs   │  │  Forms  │ │
│  │ Agent   │  │ Agent   │  │ Agent   │ │
│  └─────────┘  └─────────┘  └─────────┘ │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │ GitHub  │  │  Meet   │  │ Sheets  │ │
│  │ Agent   │  │ Agent   │  │ Agent   │ │
│  └─────────┘  └─────────┘  └─────────┘ │
└─────────────────────────────────────────┘
    ↓
Response Aggregation
    ↓
Final User Response
```

## Features

### 🎯 Intelligent Query Analysis
- Uses OpenAI to understand user intent
- Automatically determines which agents are needed
- Breaks down complex multi-step requests

### 🔀 Smart Routing
- Routes queries to appropriate specialized agents
- Supports both single and multi-agent requests
- Handles dependencies between agents

### ⚡ Execution Modes
- **Parallel Execution**: Multiple independent operations run simultaneously
- **Sequential Execution**: Operations that depend on each other run in order

### 🔄 Response Aggregation
- Combines responses from multiple agents
- Eliminates redundancy and repetition
- Creates coherent, conversational outputs

### 🛡️ Error Handling
- Gracefully handles agent failures
- Provides helpful error messages
- Continues processing even if one agent fails

## Available Specialized Agents

| Agent | Service | Key Capabilities |
|-------|---------|-----------------|
| **CalendarAgent** | Google Calendar | Create/manage events, view schedules, recurring events |
| **DocsAgent** | Google Docs | Create/edit documents, format text, share documents |
| **FormsAgent** | Google Forms | Create forms, add questions, view responses |
| **GitHubAgent** | GitHub | View repos/profile, list commits/issues, search code |
| **MeetAgent** | Google Meet | Create meetings, view history, manage recordings |
| **SheetsAgent** | Google Sheets | Create/edit spreadsheets, manage data, format cells |

## API Endpoints

### POST `/api/agent/query`
Process natural language queries that may involve multiple services.

**Authentication Required**: Yes (Bearer token)

**Request Body**:
```json
{
  "query": "schedule a meeting tomorrow and create a document for it",
  "conversationHistory": []  // optional
}
```

**Response**:
```json
{
  "success": true,
  "query": "schedule a meeting tomorrow...",
  "response": "I've scheduled your meeting for tomorrow at 2:00 PM and created a document titled 'Meeting Agenda' with the basic structure. The document link has been added to the calendar event.",
  "agentsUsed": ["calendar", "docs"],
  "toolsUsed": [
    {
      "agent": "calendar",
      "tool": "createEvent"
    },
    {
      "agent": "docs",
      "tool": "createDocument"
    }
  ],
  "analysis": {
    "reasoning": "User wants to schedule a meeting and create an associated document, requiring both Calendar and Docs agents",
    "sequential": true
  },
  "processingTime": "2341ms",
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

### GET `/api/agent/info`
Get information about available agents and their capabilities.

**Response**:
```json
{
  "success": true,
  "mainAgent": {
    "name": "Main Coordinator Agent",
    "description": "Central agent that coordinates all specialized agents",
    "capabilities": ["Multi-agent coordination", "Query analysis", ...]
  },
  "specializedAgents": {
    "calendar": {...},
    "docs": {...},
    ...
  }
}
```

### GET `/api/agent/examples`
Get example queries for single and multi-agent scenarios.

### GET `/api/agent/health`
Health check for the main agent system.

### POST `/api/agent/test` (Development Only)
Test endpoint for development without authentication.

## Usage Examples

### Single Agent Queries

```javascript
// Calendar only
{
  "query": "Schedule a team meeting tomorrow at 2pm"
}

// GitHub only
{
  "query": "Show me my recent repositories"
}

// Docs only
{
  "query": "Create a document called 'Project Plan'"
}
```

### Multi-Agent Queries

```javascript
// Calendar + Docs (Sequential)
{
  "query": "Schedule a project kickoff meeting next Monday at 10am and create a document with the agenda"
}

// Forms + Sheets (Parallel)
{
  "query": "Create a customer feedback form and a spreadsheet to track the responses"
}

// GitHub + Calendar (Parallel)
{
  "query": "Show me my GitHub activity from last week and my calendar events for this week"
}

// Meet + Docs + Calendar (Sequential)
{
  "query": "Create a meeting space, document the meeting notes, and add it to my calendar"
}
```

## How It Works

### 1. Query Analysis Phase
The Main Agent uses OpenAI to analyze the user's query and determine:
- Which specialized agents are needed
- What specific queries to send to each agent
- Whether operations should run in parallel or sequentially
- Any dependencies between agents

### 2. Execution Phase
Based on the analysis:
- **Parallel Execution**: All independent agent queries run simultaneously for better performance
- **Sequential Execution**: Dependent operations run in order (e.g., create document, then link it in calendar)

### 3. Response Aggregation Phase
The Main Agent:
- Collects responses from all agents
- Uses OpenAI to combine them into a coherent message
- Eliminates redundancy
- Formats the response in a user-friendly way
- Includes error information if any agent failed

## Error Handling

The system is designed to be resilient:
- If one agent fails, others continue processing
- Partial results are still returned
- Errors are clearly communicated to users
- Helpful suggestions for resolution are provided

Example error response:
```json
{
  "success": true,
  "response": "I've created the document, but encountered an issue scheduling the meeting. Please ensure you're connected to Google Calendar.",
  "agentsUsed": ["docs"],
  "errors": {
    "calendar": {
      "error": "Calendar not connected",
      "query": "schedule a meeting tomorrow"
    }
  }
}
```

## Configuration

### Environment Variables
```env
OPENAI_API_KEY=your_openai_api_key
NODE_ENV=development  # or production
```

### Model Configuration
The Main Agent uses GPT-4 for:
- Query analysis (temperature: 0.3 for consistency)
- Response combination (temperature: 0.7 for natural responses)

## Integration with Frontend

### Basic Integration
```javascript
async function askAgent(query) {
  const response = await fetch('http://localhost:3000/api/agent/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`
    },
    body: JSON.stringify({ query })
  });
  
  return await response.json();
}

// Usage
const result = await askAgent("schedule a meeting and create a document");
console.log(result.response);
```

### With Conversation History
```javascript
const conversationHistory = [
  { role: 'user', content: 'Create a project plan document' },
  { role: 'assistant', content: 'I\'ve created the document...' }
];

const result = await askAgent({
  query: "Now schedule a meeting to discuss it",
  conversationHistory
});
```

## Best Practices

### For Query Writing
1. **Be specific**: Include dates, times, titles, and other relevant details
2. **Natural language**: Write as you would speak
3. **Multiple requests**: Feel free to ask for multiple things in one query
4. **Context**: Reference previous items when appropriate

### For Development
1. **Testing**: Use the `/api/agent/test` endpoint in development
2. **Monitoring**: Check the console logs for detailed execution flow
3. **Error handling**: Always handle both success and error cases
4. **Rate limiting**: Consider implementing rate limiting for production

## Performance Considerations

- **Parallel execution** is used by default for independent operations
- Average response time: 1-3 seconds for single agent, 2-5 seconds for multi-agent
- OpenAI API calls: 1 for analysis + 1 for response combination (if multi-agent)
- Each specialized agent may make additional API calls to their respective services

## Future Enhancements

Potential improvements:
- [ ] Conversation memory across sessions
- [ ] User preferences learning
- [ ] Batch operations optimization
- [ ] Webhook support for long-running tasks
- [ ] Agent capability caching
- [ ] Custom agent priority settings
- [ ] Advanced analytics and logging

## Troubleshooting

### Common Issues

**Problem**: "Agent not found" error
- **Solution**: Ensure all specialized agents are properly initialized in the MainAgent constructor

**Problem**: Slow response times
- **Solution**: Check OpenAI API latency and specialized agent performance

**Problem**: Inconsistent routing
- **Solution**: Review and refine the query analysis prompt for better agent selection

**Problem**: Authentication errors
- **Solution**: Verify that users are connected to the required services (Google Calendar, GitHub, etc.)

## Support

For issues or questions:
1. Check the examples endpoint: `/api/agent/examples`
2. Review the agent info: `/api/agent/info`
3. Check health status: `/api/agent/health`
4. Review console logs for detailed execution traces

## License

Part of the FYP project - internal use only.
