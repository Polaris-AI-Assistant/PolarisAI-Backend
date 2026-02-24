# Schedules Agent - Reminders & Scheduled Actions

## Overview

The Schedules Agent allows users to create reminders and schedule future actions using natural language. It integrates with the scheduler engine that automatically executes scheduled tasks.

## Features

- ⏰ **Create Reminders**: Set notifications for future times
- 📅 **Schedule Actions**: Automatically execute actions (emails, documents, etc.) at scheduled times
- 📋 **List Schedules**: View all active reminders and scheduled actions
- 🗑️ **Delete Schedules**: Cancel reminders or scheduled actions

## Usage Examples

### Creating Reminders

```javascript
// Simple reminder
"Remind me to check Bitcoin price tomorrow at 2 PM"

// Reminder with relative time
"Set a reminder to call mom in 2 hours"

// Reminder with specific date
"Remind me about the presentation on December 25 at 10 AM"
```

### Scheduling Actions

```javascript
// Schedule an email
"Schedule an email to john@example.com about the meeting next Monday at 9 AM"

// Schedule a document creation
"Automatically create a report document every Friday at 5 PM"
```

### Managing Schedules

```javascript
// List all reminders
"Show my reminders"
"List my scheduled tasks"

// Delete a reminder
"Cancel my reminder about Bitcoin"
"Delete the reminder to call mom"
```

## Agent Tools

### 1. createReminder

Creates a reminder that will send a notification to the user.

**Parameters**:
- `content` (string, required): The reminder message
- `datetime` (string, required): When to send the reminder (natural language)
- `recurring` (boolean, optional): Whether the reminder should repeat
- `timezone` (string, optional): User timezone (default: UTC)

**Example**:
```javascript
{
  content: "Check Bitcoin price",
  datetime: "tomorrow at 2 PM",
  recurring: false,
  timezone: "America/New_York"
}
```

### 2. createScheduledAction

Schedules an action to be automatically executed by the AI agent.

**Parameters**:
- `content` (string, required): The action to execute
- `datetime` (string, required): When to execute the action
- `recurring` (boolean, optional): Whether the action should repeat
- `timezone` (string, optional): User timezone

**Example**:
```javascript
{
  content: "Send email to john@example.com about the meeting",
  datetime: "next Monday at 9 AM",
  recurring: false,
  timezone: "America/New_York"
}
```

### 3. listSchedules

Lists user's scheduled reminders and actions.

**Parameters**:
- `status` (string, optional): Filter by status (all, active, paused, completed)
- `limit` (number, optional): Maximum number to return (default: 20)

**Example**:
```javascript
{
  status: "active",
  limit: 20
}
```

### 4. deleteSchedule

Deletes a scheduled reminder or action.

**Parameters**:
- `scheduleId` (string, optional): The ID of the schedule to delete
- `content` (string, optional): The content/description to search for

**Example**:
```javascript
{
  content: "Bitcoin"  // Finds and deletes schedule matching "Bitcoin"
}
```

## Natural Language Parsing

The agent uses `chrono-node` to parse natural language datetime expressions:

**Supported Formats**:
- "tomorrow at 2 PM"
- "next Monday at 9 AM"
- "in 2 hours"
- "December 25 at 10:00"
- "Friday at 6 PM"
- "in 30 minutes"

**Timezone Handling**:
- Schedules are stored in UTC
- Displayed times are converted to user's timezone
- User timezone can be specified in the request

## Integration with Scheduler Engine

The Schedules Agent creates entries in the `schedules` table, which are then processed by the Scheduler Engine (`scheduleEngine.js`).

**Scheduler Engine**:
- Polls the database every 30 seconds for due schedules
- Executes reminders by sending email/push notifications
- Executes actions by calling the main agent with the scheduled content
- Updates schedule status and next execution time

**Schedule Types**:
1. **reminder**: Sends a notification to the user
2. **action**: Executes an AI agent action (email, document, etc.)

## Reminders vs Calendar Events

### Use Schedules Agent (Reminders) For:
- ✅ Simple notifications
- ✅ "Remind me to..."
- ✅ Personal reminders without calendar entries
- ✅ Quick notifications

### Use Calendar Agent (Events) For:
- ✅ Meetings with attendees
- ✅ Events with location
- ✅ Google Meet video calls
- ✅ Calendar entries visible in Google Calendar

## Database Schema

```sql
CREATE TABLE schedules (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  type VARCHAR(20) NOT NULL,  -- 'reminder' or 'action'
  content TEXT NOT NULL,
  cron_expression VARCHAR(100) NOT NULL,
  recurring BOOLEAN DEFAULT false,
  next_execution TIMESTAMP NOT NULL,
  last_execution TIMESTAMP,
  timezone VARCHAR(50) DEFAULT 'UTC',
  status VARCHAR(20) DEFAULT 'active',  -- 'active', 'paused', 'completed'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## API Endpoints

The Schedules Agent is accessed through the Main Agent, but you can also use the direct API:

- `POST /api/schedules` - Create a schedule
- `GET /api/schedules` - List schedules
- `GET /api/schedules/:id` - Get a specific schedule
- `PATCH /api/schedules/:id` - Update a schedule
- `DELETE /api/schedules/:id` - Delete a schedule
- `POST /api/schedules/:id/pause` - Pause a schedule
- `POST /api/schedules/:id/resume` - Resume a schedule

## Testing

Run the test script:

```bash
cd PolarisAI-Backend
node schedules/test-scheduler-agent.js
```

Or test through the Main Agent:

```bash
curl -X POST http://localhost:3000/api/agent/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "query": "Remind me to check Bitcoin price tomorrow at 2 PM"
  }'
```

## Troubleshooting

### Reminders not executing

1. Check if scheduler engine is running:
```bash
curl http://localhost:3000/api/schedules/engine-status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

2. Check logs for `[Scheduler]` messages

3. Verify schedule was created:
```bash
curl http://localhost:3000/api/schedules \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Wrong agent being used

If reminders are going to Calendar instead of Schedules:
- Check the query contains "remind me" or "set a reminder"
- Verify the Main Agent's `analyzeQuery` includes schedules agent
- Check logs for `[MainAgent] 🤖 Query Analysis Result`

### Datetime parsing issues

If natural language times aren't being parsed:
- Ensure `chrono-node` is installed: `npm install chrono-node`
- Check logs for `[SchedulesAgent] 🕐 Parsing datetime`
- Try more explicit time formats: "tomorrow at 2:00 PM" instead of "tomorrow 2pm"

## Architecture

```
User Query
    ↓
Main Agent (analyzeQuery)
    ↓
Routes to Schedules Agent
    ↓
SchedulesAgentMultiStep
    ↓
Parses datetime with chrono-node
    ↓
Converts to cron expression
    ↓
Creates schedule in database
    ↓
Scheduler Engine polls database
    ↓
Executes at scheduled time
    ↓
Sends notification or executes action
```

## Files

- `schedulesAgentMultiStep.js` - Main agent implementation
- `scheduleController.js` - REST API endpoints
- `scheduleData.js` - Database operations
- `scheduleEngine.js` - Background scheduler engine
- `scheduleUtils.js` - Utility functions (cron, timezone)
- `emailService.js` - Email notifications
- `notificationService.js` - Push notifications
- `actionService.js` - Action execution

## Dependencies

- `chrono-node` - Natural language datetime parsing
- `node-cron` - Cron expression handling
- `@supabase/supabase-js` - Database operations
- `nodemailer` - Email notifications
- `onesignal-node` - Push notifications
