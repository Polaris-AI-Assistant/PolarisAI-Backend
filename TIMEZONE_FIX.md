# Timezone Fix for Scheduler Agent

## Problem

When a user requested "schedule a reminder to check it again tomorrow at 2 PM", the system:
- ✅ Correctly showed "Tomorrow at 2 PM" in the response
- ❌ But actually scheduled it for 08:30:00 (different time)

**Root Cause**: The scheduler agent was not properly handling timezone conversion. It was:
1. Parsing "2 PM" in the server's local timezone
2. Storing the cron expression without proper UTC conversion
3. Not receiving the user's timezone from the main agent

## Solution

### 1. Added Timezone Detection Utility

**File Created**: `PolarisAI-Backend/utils/timezoneDetection.js`

This utility provides:
- `getUserTimezone()` - Detects timezone from browser or location
- `detectTimezoneFromLocation()` - Estimates timezone from lat/lng coordinates
- `validateBrowserTimezone()` - Validates browser-provided timezone
- `formatTimezoneForDisplay()` - Formats timezone for user display

**Priority Order**:
1. Browser timezone (most accurate) - if provided by frontend
2. Location-based detection - from user's lat/lng
3. Default timezone - `Asia/Kolkata` (IST) for Indian users

### 2. Fixed Timezone Parsing in Scheduler Agent

**File Modified**: `PolarisAI-Backend/schedules/schedulesAgentMultiStep.js`

**Added**: `moment-timezone` library for proper timezone handling

**Changes**:
```javascript
// OLD: Parsed time without timezone awareness
const parsed = chrono.parseDate(datetimeStr);
const cronExpression = `${parsed.getMinutes()} ${parsed.getHours()} ...`;

// NEW: Proper timezone conversion
const userTimezoneMoment = moment.tz({year, month, day, hour, minute}, timezone);
const utcMoment = userTimezoneMoment.clone().utc();
const cronExpression = `${utcMoment.minute()} ${utcMoment.hour()} ...`;
```

**How it works**:
1. Parse "tomorrow at 2 PM" using chrono-node
2. Extract date/time components (year, month, day, hour, minute)
3. Create moment object in USER'S timezone (e.g., Asia/Kolkata)
4. Convert to UTC for cron storage
5. Generate cron expression using UTC time

**Example**:
```
User says: "tomorrow at 2 PM" (in Asia/Kolkata timezone)
Parsed: 2026-02-24 14:00:00 IST
Converted to UTC: 2026-02-24 08:30:00 UTC
Cron: 30 8 24 2 *
Display to user: "Tomorrow at 2:00 PM IST"
```

### 3. Updated Main Agent to Pass Timezone

**File Modified**: `PolarisAI-Backend/mainAgent/mainAgent.js`

**Added**:
- Import of `getUserTimezone` utility
- `_detectUserTimezone()` helper method
- Timezone parameter in agentOptions for schedules agent

**Changes in 3 locations**:
1. Sequential execution (confirmed actions)
2. Sequential execution (multi-agent queries)
3. Parallel execution

```javascript
const agentOptions = {
  userId,
  conversationId,
  conversationHistory,
  // Add timezone for schedules agent
  ...(agentName === 'schedules' ? { 
    timezone: this._detectUserTimezone(userLocation) 
  } : {})
};
```

### 4. Updated Scheduler Agent System Prompt

**File Modified**: `PolarisAI-Backend/schedules/schedulesAgentMultiStep.js`

Added timezone handling instructions:
```
TIMEZONE HANDLING:
- If timezone is provided in context, use it
- If user mentions a location, infer timezone from location
- Common timezones: America/New_York, Asia/Kolkata, Europe/London, etc.
- ALWAYS pass the timezone parameter to createReminder and createScheduledAction
```

## Dependencies Added

```bash
npm install moment-timezone
```

## How It Works Now

### Flow Diagram

```
User Query: "Remind me to check Bitcoin price tomorrow at 2 PM"
    ↓
Main Agent
    ↓
Detect User Timezone
  - Check userLocation (if available)
  - Default to Asia/Kolkata (IST)
    ↓
Pass timezone to Schedules Agent
  agentOptions: { timezone: "Asia/Kolkata" }
    ↓
Schedules Agent
    ↓
Parse "tomorrow at 2 PM"
  - chrono-node: 2026-02-24 14:00:00 (local)
    ↓
Create moment in user timezone
  - moment.tz({...}, "Asia/Kolkata")
  - Result: 2026-02-24 14:00:00 IST
    ↓
Convert to UTC
  - utcMoment = userMoment.clone().utc()
  - Result: 2026-02-24 08:30:00 UTC
    ↓
Generate Cron Expression (UTC)
  - Cron: 30 8 24 2 *
    ↓
Store in Database
  - next_execution: 2026-02-24T08:30:00.000Z
  - timezone: Asia/Kolkata
    ↓
Display to User
  - "Tomorrow at 2:00 PM IST"
    ↓
Scheduler Engine Executes
  - At 2026-02-24T08:30:00.000Z (UTC)
  - Which is 2:00 PM IST ✅
```

## Testing

### Test Case 1: Simple Reminder

**Input**:
```
"Remind me to check Bitcoin price tomorrow at 2 PM"
```

**Expected**:
- Response: "Tomorrow at 2:00 PM (your local time)"
- Database: `next_execution` = tomorrow at 08:30:00 UTC (if user is in IST)
- UI Display: "24/02/2026, 14:00:00" (in user's timezone)

### Test Case 2: With Location

**Input**:
```
Query: "Remind me to call mom tomorrow at 5 PM"
userLocation: {lat: 19.0760, lng: 72.8777} // Mumbai
```

**Expected**:
- Detected timezone: Asia/Kolkata
- Stored time: tomorrow at 11:30:00 UTC
- Display: "Tomorrow at 5:00 PM IST"

### Test Case 3: Different Timezone

**Input**:
```
Query: "Remind me about the meeting tomorrow at 9 AM"
userLocation: {lat: 40.7128, lng: -74.0060} // New York
```

**Expected**:
- Detected timezone: America/New_York
- Stored time: tomorrow at 14:00:00 UTC (9 AM EST = 2 PM UTC)
- Display: "Tomorrow at 9:00 AM EST"

## Verification

To verify the fix is working:

1. **Check Logs**:
```
[SchedulesAgent] 🕐 Parsing datetime: "tomorrow at 2 PM" (timezone: Asia/Kolkata)
[SchedulesAgent] 📅 Parsed date (system time): 2026-02-24T14:00:00.000Z
[SchedulesAgent] 🌍 User timezone (Asia/Kolkata): 2026-02-24 14:00:00 +05:30
[SchedulesAgent] 🌐 UTC time: 2026-02-24 08:30:00 +00:00
[SchedulesAgent] ⚙️ Generated cron (UTC): 30 8 24 2 *
[SchedulesAgent] 🕐 User will see: 2026-02-24 at 2:00 PM IST
```

2. **Check Database**:
```sql
SELECT 
  content,
  next_execution,
  timezone,
  cron_expression
FROM schedules
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC
LIMIT 1;
```

Expected:
```
content: "Check Bitcoin price"
next_execution: 2026-02-24T08:30:00.000Z
timezone: Asia/Kolkata
cron_expression: 30 8 24 2 *
```

3. **Check UI Display**:
- Should show: "24/02/2026, 14:00:00" (2 PM in user's timezone)
- NOT: "24/02/2026, 08:30:00" (UTC time)

## Frontend Integration (Optional Enhancement)

To make timezone detection even more accurate, the frontend can send the browser's timezone:

```javascript
// In frontend code
const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

// Send with request
fetch('/api/agent/query/stream', {
  method: 'POST',
  body: JSON.stringify({
    query: "Remind me to check Bitcoin price tomorrow at 2 PM",
    userTimezone: userTimezone  // e.g., "Asia/Kolkata"
  })
});
```

Then update mainAgentController.js to accept and use `userTimezone`:
```javascript
const { query, userTimezone, userLocation, ... } = req.body;

// Pass to processQuery
const result = await mainAgent.processQueryWithStreaming(query, userId, { 
  userTimezone,
  userLocation,
  ...
});
```

## Summary

The timezone issue has been fixed by:

1. ✅ Adding proper timezone detection utility
2. ✅ Using moment-timezone for accurate timezone conversion
3. ✅ Passing user timezone from main agent to scheduler agent
4. ✅ Converting user's local time to UTC for cron storage
5. ✅ Displaying time in user's timezone in the UI

Now when a user says "tomorrow at 2 PM", the reminder will actually execute at 2 PM in their timezone, not at a different time!
