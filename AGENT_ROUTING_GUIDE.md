# Agent Routing Guide

## Quick Reference: Which Agent to Use?

### 📧 Email Operations
- **Gmail**: `"send email"`, `"check my gmail"`, `"read my emails"`
- **Microsoft Outlook**: `"send email through outlook"`, `"check my outlook inbox"`

### 📅 Calendar & Time Management
- **Calendar**: `"schedule a meeting"`, `"create an event"`, `"add to calendar"`
- **Schedules**: `"remind me to..."`, `"set a reminder"`, `"check it again later"`

### 📄 Documents
- **Google Docs**: `"create a document"`, `"edit my doc"`
- **Microsoft Word**: `"create a word document"`, `"list my word files"`

### 📊 Spreadsheets
- **Google Sheets**: `"create a spreadsheet"`, `"add data to sheet"`
- **Microsoft Excel**: `"create an excel file"`, `"list my excel workbooks"`

### 📝 Forms & Surveys
- **Google Forms**: `"create a form"`, `"make a survey"`, `"add questions"`

### 💻 Development
- **GitHub**: `"create a repo"`, `"list my repositories"`, `"create an issue"`

### 🌐 Information Gathering
- **Web Search**: `"what's the latest news"`, `"find information about"`, `"current Bitcoin prices"`
- **Weather**: `"what's the weather"`, `"will it rain"`, `"temperature in..."`
- **Maps**: `"find restaurants near me"`, `"directions to..."`, `"distance from..."`
- **Flights**: `"find flights to..."`, `"compare flight prices"`

### 💬 Communication
- **Google Meet**: `"create a meeting room"` (standalone, no time)
- **Microsoft Teams**: `"list my teams"`, `"send a teams message"`

---

## Decision Tree

```
User Query: "Remind me to check Bitcoin price tomorrow at 2 PM"
    ↓
Contains "remind me" or "set a reminder"?
    ↓ YES
Is it a notification/reminder (not a calendar event)?
    ↓ YES
Use SCHEDULES Agent ✅
```

```
User Query: "Schedule a meeting with John tomorrow at 2 PM"
    ↓
Contains "schedule" or "meeting"?
    ↓ YES
Is it a calendar event with attendees/location?
    ↓ YES
Use CALENDAR Agent ✅
```

```
User Query: "What's the current Bitcoin price?"
    ↓
Asking for current/latest/recent information?
    ↓ YES
Use WEBSEARCH Agent ✅
```

```
User Query: "What's the weather in Mumbai?"
    ↓
Asking about weather/temperature/rain/air quality?
    ↓ YES
Use WEATHER Agent ✅
```

---

## Common Confusion Points

### 1. Reminders vs Calendar Events

| Feature | Schedules Agent | Calendar Agent |
|---------|----------------|----------------|
| Purpose | Notifications | Calendar entries |
| Visibility | Email/Push notification | Google Calendar |
| Attendees | No | Yes |
| Location | No | Yes |
| Google Meet | No | Yes |
| Recurring | Yes | Yes |
| Example | "Remind me to call mom" | "Schedule a meeting with team" |

### 2. Web Search vs Weather

| Query Type | Agent | Example |
|------------|-------|---------|
| Weather data | Weather | "What's the weather in London?" |
| Current news | Web Search | "Latest news about Tesla" |
| Current prices | Web Search | "Current Bitcoin prices" |
| Events | Web Search | "AI summit happening in Delhi" |
| Temperature | Weather | "Temperature in Dubai" |
| Forecast | Weather | "Will it rain tomorrow?" |

### 3. Gmail vs Microsoft Outlook

| Query | Agent | Reason |
|-------|-------|--------|
| "send email" | Gmail | Default email service |
| "send email through outlook" | Microsoft | Explicitly mentions Outlook |
| "check my outlook inbox" | Microsoft | Explicitly mentions Outlook |
| "show my gmail" | Gmail | Explicitly mentions Gmail |
| "send email to user@outlook.com" | Gmail | Email address doesn't determine service |

---

## Multi-Agent Queries

Some queries require multiple agents working together:

### Sequential Execution (One depends on another)

```
"Check Bitcoin price and remind me to check it again tomorrow at 2 PM"
    ↓
1. WebSearch Agent → Fetch Bitcoin price
2. Schedules Agent → Create reminder
    ↓
Response includes BOTH results
```

```
"Create a feedback form and send the link to john@example.com"
    ↓
1. Forms Agent → Create form
2. Gmail Agent → Send email with form link
    ↓
Response includes form link AND email confirmation
```

### Parallel Execution (Independent actions)

```
"Show me my GitHub repos and upcoming calendar events"
    ↓
1. GitHub Agent → List repositories
2. Calendar Agent → List events
    ↓
Both execute simultaneously
```

---

## Agent Capabilities Matrix

| Agent | Create | Read | Update | Delete | Search |
|-------|--------|------|--------|--------|--------|
| Calendar | ✅ Events | ✅ Events | ✅ Events | ✅ Events | ✅ Events |
| Schedules | ✅ Reminders | ✅ Schedules | ❌ | ✅ Schedules | ❌ |
| Gmail | ✅ Emails | ✅ Emails | ❌ | ✅ Emails | ✅ Emails |
| Docs | ✅ Documents | ✅ Documents | ✅ Documents | ❌ | ❌ |
| Forms | ✅ Forms | ✅ Forms | ✅ Forms | ❌ | ❌ |
| Sheets | ✅ Sheets | ✅ Sheets | ✅ Sheets | ❌ | ❌ |
| GitHub | ✅ Repos/Issues | ✅ Repos/Issues | ✅ Issues | ✅ Repos | ✅ Repos |
| WebSearch | ❌ | ✅ Web | ❌ | ❌ | ✅ Web |
| Weather | ❌ | ✅ Weather | ❌ | ❌ | ❌ |
| Maps | ❌ | ✅ Places | ❌ | ❌ | ✅ Places |
| Flights | ❌ | ✅ Flights | ❌ | ❌ | ✅ Flights |
| Meet | ✅ Rooms | ✅ Meetings | ❌ | ❌ | ❌ |
| Microsoft | ✅ Docs/Emails | ✅ Docs/Emails | ✅ Docs | ✅ Emails | ✅ Emails |

---

## Example Queries by Agent

### Schedules Agent
```
✅ "Remind me to check Bitcoin price tomorrow at 2 PM"
✅ "Set a reminder to call mom on Friday"
✅ "Schedule a reminder to submit report next Monday"
✅ "Check it again tomorrow at 2 PM"
✅ "Show my reminders"
✅ "Cancel my reminder about Bitcoin"
❌ "Schedule a meeting with John" → Use Calendar
❌ "Create an event for tomorrow" → Use Calendar
```

### Calendar Agent
```
✅ "Schedule a meeting with John tomorrow at 2 PM"
✅ "Create an event for the team meeting"
✅ "Add a calendar entry for the presentation"
✅ "Schedule a Google Meet for Monday at 10 AM"
✅ "Show my calendar events"
❌ "Remind me to call John" → Use Schedules
❌ "Set a reminder for tomorrow" → Use Schedules
```

### Web Search Agent
```
✅ "What's the latest news about Tesla?"
✅ "Current Bitcoin prices"
✅ "Do you know about the AI summit in Delhi?"
✅ "Find information about upcoming tech conferences"
✅ "Tell me about recent AI developments"
❌ "What's the weather in London?" → Use Weather
❌ "Temperature in Dubai" → Use Weather
```

### Weather Agent
```
✅ "What's the weather in Mumbai?"
✅ "Will it rain tomorrow?"
✅ "Temperature in Dubai"
✅ "Air quality in Delhi"
✅ "Weather forecast for next 3 days"
❌ "Latest news about weather patterns" → Use Web Search
❌ "Climate change information" → Use Web Search
```

---

## Routing Logic Flow

```
User Query
    ↓
Intent Classification (LLM)
    ↓
┌─────────────────────────────────────┐
│ Is it actionable?                   │
│ (create, send, schedule, search)    │
└─────────────────────────────────────┘
    ↓ YES
┌─────────────────────────────────────┐
│ Query Analysis (LLM)                │
│ - Determine required agents         │
│ - Check for multi-intent            │
│ - Identify dependencies             │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ Agent Selection                     │
│ - Match keywords to agents          │
│ - Consider conversation context     │
│ - Apply routing rules               │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ Execution                           │
│ - Sequential (if dependent)         │
│ - Parallel (if independent)         │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ Response Generation                 │
│ - Combine all agent results         │
│ - Format naturally                  │
│ - Include links/details             │
└─────────────────────────────────────┘
```

---

## Debugging Agent Routing

### Check which agent was selected

Look for this in logs:
```
[MainAgent] 🤖 Query Analysis Result:
{
  "agents": ["schedules"],
  "reasoning": "User wants to create a reminder",
  "queries": {
    "schedules": "remind me to check Bitcoin price tomorrow at 2 PM"
  }
}
```

### Common routing issues

1. **Wrong agent selected**
   - Check if query contains explicit keywords
   - Review conversation context
   - Verify agent is registered in mainAgent.js

2. **No agent selected**
   - Query might be conversational (asking about past)
   - Check intent classification result
   - Verify query is actionable

3. **Multiple agents when only one needed**
   - Check for multi-intent patterns
   - Review sequential execution logic
   - Verify dependencies are correct

---

## Best Practices

### For Users
1. Be specific about which service you want to use
   - ✅ "send email through outlook"
   - ❌ "send email" (defaults to Gmail)

2. Use clear action verbs
   - ✅ "remind me to..."
   - ✅ "schedule a meeting..."
   - ✅ "create a document..."

3. Specify time clearly
   - ✅ "tomorrow at 2 PM"
   - ✅ "next Monday at 9 AM"
   - ❌ "later" (too vague)

### For Developers
1. Add new agents to `mainAgent.js` agents object
2. Update `analyzeQuery` prompt with agent description
3. Add routing examples for the new agent
4. Test with various query phrasings
5. Monitor logs for routing decisions

---

## Summary

The agent routing system uses LLM-based analysis to intelligently route queries to the appropriate specialized agents. Key factors:

- **Keywords**: "remind me" → Schedules, "schedule a meeting" → Calendar
- **Context**: Previous conversation affects routing
- **Multi-intent**: Detects when multiple agents are needed
- **Dependencies**: Executes agents sequentially when needed
- **Fallbacks**: Defaults to sensible choices (Gmail for email, etc.)
