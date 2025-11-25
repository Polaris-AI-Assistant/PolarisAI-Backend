# Google Calendar AI Agent

An intelligent Google Calendar agent that allows users to manage their calendar events and schedules through natural language queries powered by OpenAI.

## Features

### Event Management
- ✅ **Create Events**: Schedule meetings, appointments, and events with dates, times, locations, and attendees
- ✅ **Get Events**: Retrieve and search calendar events based on time ranges or keywords
- ✅ **Update Events**: Modify existing events (time, location, attendees, description, etc.)
- ✅ **Delete Events**: Remove events from the calendar
- ✅ **Respond to Events**: Accept, decline, or tentatively respond to event invitations

### Calendar Management
- ✅ **List Calendars**: View all accessible calendars
- ✅ **Get Calendar Details**: Get information about specific calendars
- ✅ **Create Calendars**: Create new secondary calendars
- ✅ **Update Calendars**: Modify calendar properties
- ✅ **Delete Calendars**: Remove secondary calendars

### AI-Powered Features
- 🤖 Natural language query processing
- 🤖 Dynamic tool selection based on user intent
- 🤖 Multi-step query support
- 🤖 Conversational interface with context awareness
- 🤖 Intelligent date/time parsing

## Architecture

The Calendar agent follows the same architecture as the Forms agent:

```
calendar/
├── calendarAuth.js           # OAuth authentication & connection management
├── calendarService.js        # Google Calendar API service layer
├── calendarAgent.js          # AI agent with OpenAI integration
├── calendarAgentController.js # HTTP endpoints for agent queries
├── calendarData.js           # Direct API endpoints (non-AI)
├── create_calendar_tokens_table.sql # Database setup
└── README.md                 # This file
```

## Setup

### 1. Environment Variables

Add the following to your `.env` file:

```env
# Google Calendar OAuth
GOOGLE_CALENDAR_CLIENT_ID=your_client_id
GOOGLE_CALENDAR_CLIENT_SECRET=your_client_secret
GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:3000/api/auth/calendar/callback

# OpenAI API Key (for AI agent)
OPENAI_API_KEY=your_openai_api_key

# Frontend URL (for OAuth redirects)
FRONTEND_URL=http://localhost:3001
```

### 2. Database Setup

Run the SQL script to create the `calendar_tokens` table:

```bash
# Execute the SQL in your Supabase dashboard
cat calendar/create_calendar_tokens_table.sql
```

### 3. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable the **Google Calendar API**
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:3000/api/auth/calendar/callback`
5. Copy the Client ID and Client Secret to your `.env` file

### 4. OAuth Scopes

The agent requests the following scopes:
- `https://www.googleapis.com/auth/userinfo.email`
- `https://www.googleapis.com/auth/userinfo.profile`
- `https://www.googleapis.com/auth/calendar`
- `https://www.googleapis.com/auth/calendar.events`
- `openid`

## API Endpoints

### Authentication Endpoints

#### Connect Google Calendar
```http
GET /api/auth/calendar/connect
Authorization: Bearer <token>
```
Redirects to Google OAuth consent screen.

#### Get OAuth URL
```http
GET /api/auth/calendar/url
Authorization: Bearer <token>
```
Returns the OAuth URL without redirecting.

#### OAuth Callback
```http
GET /api/auth/calendar/callback?code=<code>&state=<state>
```
Handles OAuth callback from Google.

#### Connection Status
```http
GET /api/auth/calendar/status
Authorization: Bearer <token>
```
Check if Calendar is connected for the authenticated user.

#### Disconnect Calendar
```http
POST /api/auth/calendar/disconnect
Authorization: Bearer <token>
```
Disconnect Google Calendar and revoke tokens.

### AI Agent Endpoints

#### Process Natural Language Query
```http
POST /api/calendar/agent/query
Authorization: Bearer <token>
Content-Type: application/json

{
  "query": "schedule a team meeting tomorrow at 2pm for 1 hour",
  "conversationHistory": []  // optional
}
```

**Response:**
```json
{
  "success": true,
  "response": "I've scheduled a team meeting for tomorrow at 2:00 PM for 1 hour...",
  "query": "schedule a team meeting tomorrow at 2pm for 1 hour",
  "tools_used": [
    {
      "name": "createEvent",
      "arguments": { ... }
    }
  ],
  "function_results": [ ... ],
  "timestamp": "2025-10-28T12:00:00.000Z",
  "iterations": 1
}
```

#### Get Example Queries
```http
GET /api/calendar/agent/examples
```
Returns example queries users can try.

#### Get Agent Capabilities
```http
GET /api/calendar/agent/capabilities
```
Returns detailed information about agent features.

#### Check Agent Status
```http
GET /api/calendar/agent/status
Authorization: Bearer <token>
```
Check if the agent is operational and Calendar is connected.

### Direct API Endpoints (Non-AI)

#### Create Event
```http
POST /api/calendar/events
Authorization: Bearer <token>
Content-Type: application/json

{
  "summary": "Team Meeting",
  "description": "Weekly team sync",
  "startDateTime": "2025-10-29T14:00:00",
  "endDateTime": "2025-10-29T15:00:00",
  "timeZone": "UTC",
  "attendees": ["john@example.com", "jane@example.com"],
  "addGoogleMeet": true
}
```

#### Get Events
```http
GET /api/calendar/events?timeMin=2025-10-28T00:00:00Z&timeMax=2025-11-04T23:59:59Z
Authorization: Bearer <token>
```

#### Update Event
```http
PUT /api/calendar/events/:eventId
Authorization: Bearer <token>
Content-Type: application/json

{
  "summary": "Updated Meeting Title",
  "startDateTime": "2025-10-29T15:00:00",
  "endDateTime": "2025-10-29T16:00:00"
}
```

#### Delete Event
```http
DELETE /api/calendar/events/:eventId?calendarId=primary&sendUpdates=none
Authorization: Bearer <token>
```

#### Get Calendars
```http
GET /api/calendar/calendars
Authorization: Bearer <token>
```

#### Create Calendar
```http
POST /api/calendar/calendars
Authorization: Bearer <token>
Content-Type: application/json

{
  "summary": "Work Calendar",
  "description": "Calendar for work events",
  "timeZone": "America/Los_Angeles"
}
```

## Example Usage

### Natural Language Queries

```javascript
// Schedule a meeting
"schedule a team meeting tomorrow at 2pm for 1 hour"

// Get events
"show me my events for today"
"what's on my calendar this week?"
"find events with 'project' in the title"

// Update event
"reschedule the team meeting to 3pm"
"add john@example.com to the project review meeting"

// Delete event
"cancel the team meeting tomorrow"

// Respond to event
"accept the meeting invitation"
"decline the event"

// Manage calendars
"show me all my calendars"
"create a new calendar called 'Personal'"
```

### Conversation History

The agent supports conversation history for context-aware interactions:

```javascript
const conversationHistory = [
  { role: "user", content: "Show me my events for today" },
  { role: "assistant", content: "Here are your events..." },
  { role: "user", content: "Cancel the first one" }
];

// Send with conversation history
{
  "query": "Cancel the first one",
  "conversationHistory": conversationHistory
}
```

## Tool Definitions

The agent has access to 10 tools:

1. **createEvent** - Create new calendar events
2. **getEvents** - Retrieve events with filtering
3. **updateEvent** - Modify existing events
4. **deleteEvent** - Remove events
5. **getCalendars** - List all calendars
6. **getCalendar** - Get calendar details
7. **createCalendar** - Create secondary calendars
8. **updateCalendar** - Update calendar properties
9. **deleteCalendar** - Delete secondary calendars
10. **respondToEvent** - Respond to event invitations

## Date/Time Formats

### ISO 8601 Format
```
"2025-10-29T14:00:00"           # Without timezone (uses UTC)
"2025-10-29T14:00:00-07:00"     # With timezone offset
"2025-10-29T14:00:00Z"          # UTC (Z suffix)
```

### Recurrence Rules (RRULE)
```
"RRULE:FREQ=DAILY;COUNT=10"           # Daily for 10 days
"RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"    # Weekly on Mon, Wed, Fri
"RRULE:FREQ=MONTHLY;BYMONTHDAY=1"     # Monthly on 1st
"RRULE:FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=1" # Yearly on Jan 1
```

### Timezone Names
```
"UTC"
"America/Los_Angeles"
"America/New_York"
"Europe/London"
"Asia/Tokyo"
```

## Error Handling

The agent provides detailed error messages:

```json
{
  "success": false,
  "error": "User tokens not found. Please connect Google Calendar first.",
  "query": "show me my events",
  "timestamp": "2025-10-28T12:00:00.000Z"
}
```

## Testing

### Test OAuth Connection
1. Navigate to frontend Calendar page
2. Click "Connect Google Calendar"
3. Authorize the application
4. Check connection status

### Test AI Agent
```bash
curl -X POST http://localhost:3000/api/calendar/agent/query \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "show me my events for today"
  }'
```

## Troubleshooting

### "User tokens not found"
- Ensure user has connected Google Calendar via OAuth
- Check `calendar_tokens` table in Supabase

### "Invalid credentials"
- Verify `GOOGLE_CALENDAR_CLIENT_ID` and `GOOGLE_CALENDAR_CLIENT_SECRET` in `.env`
- Check OAuth redirect URI matches Google Cloud Console

### "Failed to create event"
- Verify date/time format (ISO 8601)
- Check that startDateTime is before endDateTime
- Ensure user has calendar write permissions

### "Calendar not connected"
- User needs to complete OAuth flow first
- Check if tokens are expired (refresh automatically)

## Future Enhancements

- [ ] Bulk event operations
- [ ] Event templates
- [ ] Calendar sharing management
- [ ] Advanced recurrence patterns
- [ ] Event conflict detection
- [ ] Time zone conversion assistance
- [ ] Calendar analytics and insights
- [ ] Integration with other services (Gmail, Forms)

## License

MIT
