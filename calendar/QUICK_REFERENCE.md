# Google Calendar Agent - Quick Reference

## Setup Checklist

- [ ] Add environment variables to `.env`
- [ ] Run SQL script to create `calendar_tokens` table
- [ ] Configure Google Cloud Console OAuth credentials
- [ ] Add Calendar routes to `index.js` ✅
- [ ] Start the server
- [ ] Test OAuth connection
- [ ] Test AI agent queries

## Environment Variables

```env
GOOGLE_CALENDAR_CLIENT_ID=your_client_id
GOOGLE_CALENDAR_CLIENT_SECRET=your_client_secret
GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:3000/api/auth/calendar/callback
OPENAI_API_KEY=your_openai_api_key
FRONTEND_URL=http://localhost:3001
```

## Quick Start

### 1. Connect Google Calendar
```bash
# Get OAuth URL
curl http://localhost:3000/api/auth/calendar/url \
  -H "Authorization: Bearer YOUR_TOKEN"

# Visit the URL, authorize, and complete OAuth flow
```

### 2. Test AI Agent
```bash
# Query the agent
curl -X POST http://localhost:3000/api/calendar/agent/query \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "show me my events for today"}'
```

## Common Queries

### Creating Events
```
"Schedule a team meeting tomorrow at 2pm for 1 hour"
"Create an appointment next Monday at 10am"
"Set up a weekly standup every Monday at 9am"
"Add a meeting with john@example.com on Friday at 3pm"
```

### Viewing Events
```
"Show me my events for today"
"What's on my calendar this week?"
"List all meetings tomorrow"
"Find events about 'project'"
```

### Updating Events
```
"Reschedule the team meeting to 3pm"
"Add jane@example.com to the project meeting"
"Change the location to Building A"
```

### Deleting Events
```
"Cancel tomorrow's team meeting"
"Delete the appointment"
```

## API Endpoints Quick Reference

### Authentication
- `GET /api/auth/calendar/connect` - Start OAuth
- `GET /api/auth/calendar/url` - Get OAuth URL
- `GET /api/auth/calendar/callback` - OAuth callback
- `GET /api/auth/calendar/status` - Check connection
- `POST /api/auth/calendar/disconnect` - Disconnect

### AI Agent
- `POST /api/calendar/agent/query` - Process NL query
- `GET /api/calendar/agent/examples` - Get examples
- `GET /api/calendar/agent/capabilities` - Get capabilities
- `GET /api/calendar/agent/status` - Check agent status

### Direct API
- `POST /api/calendar/events` - Create event
- `GET /api/calendar/events` - Get events
- `PUT /api/calendar/events/:id` - Update event
- `DELETE /api/calendar/events/:id` - Delete event
- `GET /api/calendar/calendars` - Get calendars
- `POST /api/calendar/calendars` - Create calendar

## Tool Names (for debugging)

1. `createEvent` - Create new events
2. `getEvents` - Retrieve events
3. `updateEvent` - Modify events
4. `deleteEvent` - Remove events
5. `getCalendars` - List calendars
6. `getCalendar` - Get calendar details
7. `createCalendar` - Create calendar
8. `updateCalendar` - Update calendar
9. `deleteCalendar` - Delete calendar
10. `respondToEvent` - Respond to invitations

## Date/Time Formats

```javascript
// ISO 8601
"2025-10-29T14:00:00"           // Without timezone
"2025-10-29T14:00:00-07:00"     // With timezone
"2025-10-29T14:00:00Z"          // UTC

// Recurrence
"RRULE:FREQ=DAILY;COUNT=10"     // Daily for 10 days
"RRULE:FREQ=WEEKLY;BYDAY=MO"    // Weekly on Monday
"RRULE:FREQ=MONTHLY;BYMONTHDAY=1" // Monthly on 1st
```

## Response Status Values

- `accepted` - Accept invitation
- `declined` - Decline invitation
- `tentative` - Maybe/tentative
- `needsAction` - No response yet

## Common Issues

### "User tokens not found"
**Solution:** User needs to connect Calendar via OAuth first

### "Invalid credentials"
**Solution:** Check `GOOGLE_CALENDAR_CLIENT_ID` and `GOOGLE_CALENDAR_CLIENT_SECRET`

### "Event not found"
**Solution:** Verify event ID is correct, check if event exists

### "Cannot delete primary calendar"
**Solution:** Only secondary calendars can be deleted

## Testing

```bash
# Run test script
cd FYP
node calendar/testCalendar.js

# Or test manually
# 1. Sign in to get token
# 2. Connect Calendar
# 3. Try AI queries
```

## Files Structure

```
calendar/
├── calendarAuth.js           # OAuth & authentication
├── calendarService.js        # Calendar API service
├── calendarAgent.js          # AI agent logic
├── calendarAgentController.js # Agent HTTP endpoints
├── calendarData.js           # Direct API endpoints
├── create_calendar_tokens_table.sql # DB setup
├── testCalendar.js          # Test script
├── README.md                # Full documentation
└── QUICK_REFERENCE.md       # This file
```

## Next Steps

1. ✅ Complete OAuth setup
2. ✅ Test connection
3. ✅ Try AI queries
4. 🔲 Integrate with frontend
5. 🔲 Add frontend Calendar page
6. 🔲 Add chat interface for agent

## Support

For detailed documentation, see `calendar/README.md`
