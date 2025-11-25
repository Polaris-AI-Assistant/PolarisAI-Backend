# Google Forms AI Agent Documentation

An intelligent AI agent that provides natural language interaction with Google Forms API using OpenAI's GPT-4o-mini.

## Overview

The Forms Agent allows users to interact with their Google Forms using natural language queries. Instead of manually calling API endpoints, users can simply ask questions like "create a feedback form" or "show me my recent forms" and the agent will understand the intent and execute the appropriate actions.

## Core Capabilities

### 6 Available Tools

1. **listForms** - List all Google Forms accessible to the user
2. **createForm** - Create a new Google Form with questions
3. **getResponses** - Get responses for a Google Form
4. **getForm** - Get detailed information about a specific form
5. **updateForm** - Update an existing Google Form
6. **publishForm** - Publish or unpublish a form

### Question Types Supported

- `text` - Short text answers (name, email, single line)
- `paragraph` - Long text answers (feedback, comments)
- `multiple_choice` - Choose ONE option from a list
- `checkbox` - Choose MULTIPLE options
- `dropdown` - Select from a dropdown menu

## API Endpoints

### 1. Process Query (Main Endpoint)

**POST** `/api/forms/agent/query`

Send natural language queries to the agent.

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Request:**
```json
{
  "query": "create a customer satisfaction survey"
}
```

**Response:**
```json
{
  "success": true,
  "response": "I've created a customer satisfaction survey with questions about...",
  "query": "create a customer satisfaction survey",
  "tools_used": [
    {
      "name": "createForm",
      "arguments": {
        "title": "Customer Satisfaction Survey",
        "questions": [...]
      }
    }
  ],
  "raw_results": [...],
  "timestamp": "2025-10-27T00:00:00.000Z"
}
```

### 2. Get Examples

**GET** `/api/forms/agent/examples`

Returns example queries organized by category.

### 3. Get Capabilities

**GET** `/api/forms/agent/capabilities`

Returns information about available tools, question types, and features.

## Usage Examples

### Example 1: List All Forms

```json
{
  "query": "Show me all my forms"
}
```

Alternative queries:
- "List my Google Forms"
- "What forms do I have?"
- "Show my recent forms"

### Example 2: Create a Simple Form

```json
{
  "query": "Create a feedback form"
}
```

The agent will intelligently create a form with appropriate feedback questions.

### Example 3: Create a Detailed Form

```json
{
  "query": "Create an event registration form with name, email, phone, and attendance questions"
}
```

The agent will parse this and create a form with all specified fields.

### Example 4: Get Form Responses

```json
{
  "query": "Show me responses for form 1FAIpQLSe..."
}
```

Alternative:
- "How many people responded to form 1FAIpQLSe...?"
- "Get submissions for my feedback form"

### Example 5: Update a Form

```json
{
  "query": "Add a question to form 1FAIpQLSe... asking for their department"
}
```

### Example 6: Publish/Close Form

```json
{
  "query": "Publish form 1FAIpQLSe..."
}
```

To close:
```json
{
  "query": "Stop accepting responses for form 1FAIpQLSe..."
}
```

## Question Structure Examples

The agent understands natural language question descriptions:

```
"Create a form with:
1. Name (short answer)
2. Email (short answer)  
3. Feedback (long answer)
4. Rating: Excellent, Good, Fair, Poor (choose one)
5. Features you like: UI, Speed, Support, Price (choose multiple)
6. Department: Sales, Marketing, Engineering (dropdown)"
```

The agent will automatically determine:
- Questions 1-2: `type: "text"`
- Question 3: `type: "paragraph"`
- Question 4: `type: "multiple_choice"` with options
- Question 5: `type: "checkbox"` with options
- Question 6: `type: "dropdown"` with options

## Multi-Step Operations

The agent can perform multiple operations in sequence:

```json
{
  "query": "Create a feedback form, add questions about service quality, and then publish it"
}
```

The agent will:
1. Create the form
2. Add appropriate questions
3. Publish the form
4. Return the form link

## Error Handling

User-friendly error messages:

**Form Not Found:**
```json
{
  "success": false,
  "response": "The form you requested could not be found. Please check the form ID.",
  "error": "Form not found",
  "timestamp": "2025-10-27T00:00:00.000Z"
}
```

**Not Connected:**
```json
{
  "success": false,
  "response": "Please make sure you have connected your Google Forms account.",
  "error": "User tokens not found",
  "timestamp": "2025-10-27T00:00:00.000Z"
}
```

## Testing with cURL

### List Forms
```bash
curl -X POST http://localhost:3000/api/forms/agent/query \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "show me all my forms"}'
```

### Create Form
```bash
curl -X POST http://localhost:3000/api/forms/agent/query \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "create a customer feedback form"}'
```

### Get Examples
```bash
curl http://localhost:3000/api/forms/agent/examples
```

### Get Capabilities
```bash
curl http://localhost:3000/api/forms/agent/capabilities
```

## Architecture

### File Structure
```
forms/
├── formsAgent.js              # AI Agent class with OpenAI integration
├── formsAgentController.js    # Express routes for agent endpoints
├── formsService.js            # Google Forms API service functions
├── formsAuth.js               # OAuth 2.0 authentication
├── formsData.js               # Direct REST API endpoints
└── AGENT_DOCS.md              # This file
```

### Agent Flow

1. **User sends query** → `POST /api/forms/agent/query`
2. **Agent processes** → OpenAI analyzes intent
3. **Tool selection** → AI chooses appropriate function(s)
4. **Execution** → Calls formsService functions
5. **Response generation** → AI formats user-friendly response
6. **Return result** → JSON response with data

### OpenAI Integration

**Model:** `gpt-4o-mini`
**Temperature:** `0.2` (low for consistency, slightly higher for creative form suggestions)
**Max Tokens:** `2000`
**Tool Choice:** `auto` (AI decides when to use tools)

## Configuration

Required environment variables:

```env
# OpenAI
OPENAI_API_KEY=sk-...

# Google OAuth
GOOGLE_FORMS_CLIENT_ID=...
GOOGLE_FORMS_CLIENT_SECRET=...
GOOGLE_FORMS_REDIRECT_URI=http://localhost:3000/api/auth/forms/callback
```

## Best Practices

### 1. Be Specific
✅ **Good:** "Create a customer satisfaction survey with questions about product quality, customer service, and delivery speed"

❌ **Vague:** "Make a form"

### 2. Use Form IDs
✅ **Good:** "Add a question to form 1FAIpQLSe..."

❌ **Unclear:** "Update my form" (which form?)

### 3. Specify Question Types (Optional)
✅ **Helpful:** "Add a multiple choice question for satisfaction rating"

The agent will infer types if not specified, but being explicit helps.

### 4. Follow-Up Questions
The agent maintains context, so you can ask follow-ups:

```
Query 1: "Create a feedback form"
Response: "Form created with ID: 1FAIpQLSe..."

Query 2: "Add a rating question to it"
(Agent remembers the form ID from previous context)
```

## Response Structure

Every agent response includes:

```typescript
{
  success: boolean,           // Operation success status
  response: string,           // Natural language response
  query: string,              // Original user query
  tools_used: Array<{         // Tools that were executed
    name: string,
    arguments: object
  }>,
  raw_results?: Array,        // Raw API responses
  error?: string,             // Error message if failed
  timestamp: string           // ISO timestamp
}
```

## Comparison: Agent vs Direct API

### Using Agent (Recommended)
```json
{
  "query": "create a feedback form with rating questions"
}
```
✅ Natural language
✅ Intelligent question generation
✅ No need to know API structure
✅ Context-aware

### Using Direct API
```json
POST /api/forms/create
{
  "title": "Feedback Form",
  "questions": [
    {
      "title": "Rate our service",
      "type": "multiple_choice",
      "options": ["Excellent", "Good", "Fair", "Poor"]
    }
  ]
}
```
❌ Need to know exact API structure
❌ Manual question formatting
❌ No intelligent suggestions

## Future Enhancements

Planned features:

- [ ] Form templates library
- [ ] Multi-form batch operations
- [ ] Response analytics and insights
- [ ] Form collaboration suggestions
- [ ] Conditional logic recommendations
- [ ] Integration with Google Sheets
- [ ] Email notification setup
- [ ] Form theme customization

## Troubleshooting

### "User tokens not found"
**Solution:** Connect your Google Forms account first:
```
GET /api/auth/forms/connect
```

### "Form not found"
**Solution:** List your forms first to get correct IDs:
```json
{"query": "show me all my forms"}
```

### "Permission denied"
**Solution:** Ensure you have access to the form. Forms must be owned by or shared with your Google account.

### Rate limit errors
**Solution:** Wait a few moments between requests. The Google Forms API has rate limits.

## Support

For issues or questions:
1. Check error messages for specific guidance
2. Verify Forms connection: `GET /api/forms/status`
3. Review examples: `GET /api/forms/agent/examples`
4. Check capabilities: `GET /api/forms/agent/capabilities`

## License

Part of the FYP platform.
