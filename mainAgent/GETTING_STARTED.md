# Getting Started with Main Coordinator Agent

## 🚀 Quick Start (5 Minutes)

### 1. Start the Server
```bash
cd "c:\Users\bhumi\Downloads\FYP 2\FYP\FYP"
npm start
```

Server should start on `http://localhost:3000`

### 2. Test the System
```bash
# Check if main agent is running
curl http://localhost:3000/api/agent/health

# Expected response:
# {
#   "success": true,
#   "status": "healthy",
#   "mainAgent": "operational",
#   ...
# }
```

### 3. Try Your First Query

#### Using curl (in terminal)
```bash
curl -X POST http://localhost:3000/api/agent/query \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"show me my calendar events today\"}"
```

#### Using the test script
```bash
# Run all tests
node mainAgent/testMainAgent.js

# Or interactive mode
node mainAgent/testMainAgent.js --interactive
```

#### Using JavaScript/Fetch
```javascript
const response = await fetch('http://localhost:3000/api/agent/query', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    query: 'schedule a meeting tomorrow at 2pm'
  })
});

const data = await response.json();
console.log(data.response);
```

---

## 📋 What You Need

### Required
- ✅ Node.js installed
- ✅ Server running (`npm start`)
- ✅ `OPENAI_API_KEY` in your `.env` file
- ✅ User authentication token

### Optional
- Google Calendar, Docs, Forms, Meet, Sheets connected (for those features)
- GitHub connected (for GitHub features)

---

## 💬 Example Queries to Try

### Simple Queries (Single Agent)
```javascript
// Calendar
"Show me my events for today"
"Schedule a team meeting tomorrow at 2pm"

// GitHub
"Show me my repositories"
"List my recent commits"

// Docs
"Create a document called 'Meeting Notes'"
"Add a heading 'Introduction' to my document"

// Forms
"Create a feedback form"
"Show me my forms"

// Meet
"Create a new meeting space"
"Show my recent meetings"

// Sheets
"Create a spreadsheet called 'Budget 2025'"
"Add data to my spreadsheet"
```

### Complex Queries (Multi-Agent)
```javascript
// Calendar + Docs
"Schedule a project meeting tomorrow and create a document for the agenda"

// Forms + Sheets
"Create a customer feedback form and a spreadsheet to track responses"

// GitHub + Calendar
"Show my GitHub activity this week and my upcoming calendar events"

// Multiple services
"Create a meeting space, add it to my calendar for Friday, and create notes document"
```

---

## 🔍 Understanding the Response

### Single Agent Response
```json
{
  "success": true,
  "query": "show my events",
  "response": "You have 3 events today: Team standup at 9am...",
  "agentUsed": "calendar",
  "toolsUsed": ["listEvents"],
  "singleAgent": true,
  "processingTime": "1234ms",
  "timestamp": "2025-10-30T..."
}
```

### Multi-Agent Response
```json
{
  "success": true,
  "query": "create doc and meeting",
  "response": "I've created a document titled 'Project Plan' and scheduled a meeting for tomorrow at 2pm. The document link is included in the meeting invite.",
  "agentsUsed": ["docs", "calendar"],
  "toolsUsed": [
    {"agent": "docs", "tool": "createDocument"},
    {"agent": "calendar", "tool": "createEvent"}
  ],
  "multiAgent": true,
  "analysis": {
    "reasoning": "User wants to create documentation and schedule discussion",
    "sequential": true
  },
  "processingTime": "2341ms",
  "timestamp": "2025-10-30T..."
}
```

---

## 🎯 Common Use Cases

### 1. Project Setup
```javascript
{
  "query": "Set up a new project: create a GitHub repository called 'awesome-app', a project plan document, and schedule a kickoff meeting for Monday"
}

// System will:
// 1. Create GitHub repo
// 2. Create Google Doc
// 3. Create calendar event
// 4. Link everything together
```

### 2. Meeting Management
```javascript
{
  "query": "Schedule a weekly team standup every Monday at 9am, create a meeting space, and create a recurring notes document"
}

// System will:
// 1. Create recurring calendar event
// 2. Create Google Meet space
// 3. Create Google Doc for notes
```

### 3. Survey Creation
```javascript
{
  "query": "Create a customer satisfaction survey with 5 questions and a spreadsheet to analyze the responses"
}

// System will:
// 1. Create Google Form with questions
// 2. Create Google Sheet for tracking
// 3. Link form to sheet
```

---

## 🛠️ Troubleshooting

### Server won't start
```bash
# Check if another process is using port 3000
netstat -ano | findstr :3000

# Or use a different port
PORT=3001 npm start
```

### "Unauthorized" error
```bash
# Make sure you have a valid Bearer token
# Get token by signing in: POST /api/auth/signin
```

### "Agent not found" error
```bash
# Check if all agents are properly initialized
# Verify the mainAgent.js file has all agents in constructor
```

### No response from agents
```bash
# Ensure you're connected to the required services
# For Google services: Complete OAuth flow
# For GitHub: Connect your GitHub account
```

### Slow responses
```bash
# This is normal for first request (cold start)
# Subsequent requests should be faster
# Complex multi-agent queries take 3-6 seconds
```

---

## 📚 Learn More

### Documentation
1. **README.md** - Complete system documentation
2. **QUICK_REFERENCE.md** - Common patterns and examples
3. **ARCHITECTURE_DIAGRAMS.md** - Visual system architecture
4. **IMPLEMENTATION_SUMMARY.md** - Technical details

### API Endpoints
- `GET /api/agent/info` - Learn about available agents
- `GET /api/agent/examples` - See more query examples
- `GET /api/agent/health` - Check system status

### Testing
- Run automated tests: `node mainAgent/testMainAgent.js`
- Interactive mode: `node mainAgent/testMainAgent.js --interactive`
- Test endpoint (dev): `POST /api/agent/test`

---

## 🎓 Tips for Best Results

### 1. Be Specific
❌ "meeting"
✅ "schedule a team meeting tomorrow at 2pm for 1 hour"

### 2. Natural Language
You can write naturally:
- "Can you show me my calendar for next week?"
- "I need to create a feedback form"
- "Schedule a meeting and make a document"

### 3. Multiple Tasks
Combine related tasks in one query:
- "Create a project document and schedule a review meeting"
- "Show my GitHub repos and calendar events"

### 4. Context
Reference previous items:
- "Create a document about the Q4 review"
- "Schedule a meeting to discuss the budget"

---

## 🚀 Next Steps

### For Frontend Developers
1. Integrate the `/api/agent/query` endpoint
2. Create a chat-like interface
3. Display agent indicators
4. Handle loading states

### For Backend Developers
1. Review the main agent code
2. Understand the routing logic
3. Explore extending with new agents
4. Implement monitoring

### For Users
1. Experiment with different queries
2. Try combining multiple services
3. Provide feedback on responses
4. Report any issues

---

## 💡 Pro Tips

### Batch Operations
Instead of multiple queries, combine them:
```javascript
// Instead of 3 separate queries:
"show my calendar"
"list my GitHub repos"  
"create a document"

// Do one query:
"show my calendar and GitHub repos, then create a summary document"
```

### Sequential Operations
When order matters, be explicit:
```javascript
"First create a document called 'Plan', then schedule a meeting to discuss it tomorrow"
```

### Parallel Operations
For independent tasks:
```javascript
"show my GitHub activity and calendar events"
// Both agents run simultaneously - faster!
```

---

## 🎉 You're Ready!

Start with simple queries and gradually try more complex ones. The system will handle the routing and coordination automatically.

**Happy querying!** 🚀

For help: Check `/api/agent/examples` or review the documentation files.
