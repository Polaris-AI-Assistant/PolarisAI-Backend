# Google Forms AI Agent - Quick Reference

## 🚀 Quick Start

### 1. Start Backend
```bash
cd FYP
npm start
```

### 2. Connect Google Forms
```
http://localhost:3001/forms
Click "Connect to Google Forms"
```

### 3. Test Agent
```bash
curl -X POST http://localhost:3000/api/forms/agent/query \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "show me all my forms"}'
```

## 📡 Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/forms/agent/query` | POST | Process natural language query |
| `/api/forms/agent/examples` | GET | Get example queries |
| `/api/forms/agent/capabilities` | GET | Get agent capabilities |

## 💬 Example Queries

### List Forms
```
"Show me all my forms"
"List my Google Forms"
"What forms do I have?"
```

### Create Form
```
"Create a feedback form"
"Make a customer satisfaction survey"
"Create an event registration form with name, email, phone"
```

### Get Responses
```
"Show me responses for form 1FAIpQLSe..."
"How many responses does my form have?"
```

### Update Form
```
"Add a question to form 1FAIpQLSe... asking for department"
"Change the title of form 1FAIpQLSe... to 'New Survey'"
```

### Publish/Unpublish
```
"Publish form 1FAIpQLSe..."
"Stop accepting responses for form 1FAIpQLSe..."
```

## 🛠️ Available Tools

1. **listForms** - List all forms (pageSize, pageNumber)
2. **createForm** - Create new form (title*, description, questions)
3. **getResponses** - Get form responses (formId*, pageSize, pageNumber)
4. **getForm** - Get form details (formId*)
5. **updateForm** - Update form (formId*, title, description, questions)
6. **publishForm** - Control form access (formId*, isPublished, isAcceptingResponses)

## 📝 Question Types

| Type | Use Case | Example |
|------|----------|---------|
| `text` | Short answers | Name, Email |
| `paragraph` | Long answers | Feedback, Comments |
| `multiple_choice` | Choose ONE | Rating: Excellent, Good, Fair, Poor |
| `checkbox` | Choose MANY | Features: UI, Speed, Support |
| `dropdown` | Select from list | Department: Sales, Marketing, Engineering |

## 🔑 Authentication

All endpoints require JWT token:

```bash
Authorization: Bearer <JWT_TOKEN>
```

Get token from `/api/auth/signin`

## ⚡ Request/Response Format

### Request
```json
{
  "query": "your natural language query here"
}
```

### Response
```json
{
  "success": true,
  "response": "AI-generated response",
  "query": "original query",
  "tools_used": [...],
  "raw_results": [...],
  "timestamp": "2025-10-27T00:00:00.000Z"
}
```

## 🐛 Common Errors

| Error | Solution |
|-------|----------|
| "User tokens not found" | Connect Google Forms account first |
| "Form not found" | Check form ID, list forms first |
| "Permission denied" | Ensure you own or have access to form |
| "Rate limit" | Wait a moment between requests |

## 📚 Documentation

- **Full Docs:** `forms/AGENT_DOCS.md`
- **Implementation:** `forms/IMPLEMENTATION_SUMMARY.md`
- **Integration:** `forms/README.md`

## 🧪 Testing

```bash
# Structure test
node forms/test-agent.js

# Get examples
curl http://localhost:3000/api/forms/agent/examples

# Get capabilities  
curl http://localhost:3000/api/forms/agent/capabilities
```

## 💡 Pro Tips

1. **Be specific** - "Create a form with name and email questions"
2. **Use form IDs** - More accurate than form names
3. **Specify types** - "Add a multiple choice question"
4. **Ask follow-ups** - Agent maintains context
5. **Check examples** - `/api/forms/agent/examples` for ideas

## 🔧 Configuration

Required `.env` variables:

```env
OPENAI_API_KEY=sk-...
GOOGLE_FORMS_CLIENT_ID=...
GOOGLE_FORMS_CLIENT_SECRET=...
GOOGLE_FORMS_REDIRECT_URI=http://localhost:3000/api/auth/forms/callback
```

## 📊 Status Check

```bash
# Check Forms connection
GET /api/forms/status

# Check agent availability
GET /api/forms/agent/capabilities
```

## 🎯 Directory Compliance

✅ All 6 functions from https://directory.bhindi.io/google-forms
✅ Natural language processing
✅ Multi-tool support
✅ Intelligent question type selection
✅ Error handling
✅ Pagination
✅ Full documentation

---

**Need Help?** Check `forms/AGENT_DOCS.md` for detailed documentation.
