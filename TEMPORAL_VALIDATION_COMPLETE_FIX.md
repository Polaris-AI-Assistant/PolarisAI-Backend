# Temporal Validation - Complete Fix for Calendar & Schedules

## Problems Fixed

### Problem 1: Calendar Events for Past Dates
- Users could create calendar events for "yesterday" without warning
- Date parsing error: "yesterday" was parsed as today
- No validation before showing confirmation dialog

### Problem 2: Schedules/Reminders for Past Times
- Users could try to schedule reminders for "2 hours ago"
- Agent silently failed without clear error message
- No validation before agent execution

## Solutions Implemented

### 1. Fixed Date Parsing for "Yesterday"

**File:** `mainAgent/mainAgent.js` → `extractCalendarEventParams()`

**Before:**
```javascript
// Check for "tomorrow"
if (lowerQuery.includes('tomorrow')) {
  startDate.setDate(startDate.getDate() + 1);
}
// Check for "today"
else if (lowerQuery.includes('today')) {
  // Keep current date
}
// ❌ No check for "yesterday"!
```

**After:**
```javascript
// ✅ Check for "yesterday" FIRST
if (lowerQuery.includes('yesterday')) {
  startDate.setDate(startDate.getDate() - 1);
}
// Check for "tomorrow"
else if (lowerQuery.includes('tomorrow')) {
  startDate.setDate(startDate.getDate() + 1);
}
// Check for "today"
else if (lowerQuery.includes('today')) {
  // Keep current date
}
```

### 2. Calendar Event Temporal Validation

**File:** `utils/validation.js`

Added `validateCalendarEvent()` function that:
- Detects past dates (any time before now)
- Validates date ranges (end must be after start)
- Checks required fields (event title)
- Generates smart suggestions

**Integration:** `mainAgent/mainAgent.js` → `checkForConfirmationRequired()`

Validation happens BEFORE confirmation is shown:
```javascript
if (agentName === 'calendar' && (toolName === 'createEvent' || toolName === 'updateEvent')) {
  const validation = validateCalendarEvent({
    summary: params.summary,
    startDateTime: params.startDateTime,
    endDateTime: params.endDateTime,
    query: query
  });
  
  if (!validation.isValid) {
    return {
      type: 'validation_error',
      message: formatCalendarValidationErrors(validation.errors)
    };
  }
}
```

### 3. Schedule/Reminder Temporal Validation

**File:** `utils/validation.js`

Added `validateScheduleReminder()` function that:
- Detects past time patterns ("X ago", "yesterday", "last week")
- Validates reminder content (not empty)
- Generates helpful suggestions ("2 hours ago" → "2 hours from now")

**Integration:** `mainAgent/mainAgent.js` → `_validateAgentsBeforeExecution()`

Validation happens BEFORE agent is executed (pre-execution validation):
```javascript
async _validateAgentsBeforeExecution(analysis, query) {
  for (const agentName of analysis.agents) {
    if (agentName === 'schedules') {
      const validation = validateScheduleReminder({
        content: content,
        datetime: agentQuery,
        query: agentQuery
      });
      
      if (!validation.isValid) {
        return {
          hasErrors: true,
          errorMessage: formatScheduleValidationErrors(validation.errors)
        };
      }
    }
  }
  return { hasErrors: false };
}
```

**Called from:** `processQueryWithStreaming()` BEFORE parallel execution:
```javascript
// Pre-execution validation for all agents
const preExecutionValidation = await this._validateAgentsBeforeExecution(analysis, query);

if (preExecutionValidation.hasErrors) {
  // Send error directly to user via streaming
  onChunk({ type: 'content', text: preExecutionValidation.errorMessage });
  onChunk({ type: 'done' });
  return { validationError: true };
}
```

### 4. Error Message Preservation

**File:** `mainAgent/mainAgent.js` → `_sanitizeErrorForUser()`

Modified to preserve validation error messages:
```javascript
// ✅ CRITICAL: Preserve validation error messages (they are user-friendly)
if (msg.includes('I noticed you mentioned') || 
    msg.includes('That time has already passed') ||
    msg.includes('Did you mean:')) {
  return msg; // Don't sanitize validation errors
}
```

### 5. Error Handling in Streaming Mode

**File:** `mainAgent/mainAgent.js` → `processQueryWithStreaming()`

Added handling for validation errors:
```javascript
if (confirmationRequest.type === 'validation_error') {
  onChunk({ type: 'thinking', status: 'stop' });
  onChunk({ type: 'content', text: confirmationRequest.message });
  onChunk({ type: 'done' });
  return { validationError: true };
}
```

## User Experience

### Calendar Events - Before Fix:
```
User: "Create a calendar event for yesterday at 3 PM"
↓
System: [Shows confirmation with WRONG date - today]
User: [Confirms]
System: "Event created for yesterday" ❌
```

### Calendar Events - After Fix:
```
User: "Create a calendar event for yesterday at 3 PM"
↓
System: "I noticed you mentioned a time that has already passed.

📅 Requested: Monday, February 23, 2026 at 3:00 PM
⏰ That was 23 hours ago

Did you mean:
1. Today at 3:00 PM (February 24, 2026)
2. Tomorrow at 3:00 PM (February 25, 2026)
3. Next Monday at 3:00 PM (March 2, 2026)
4. Create past event for records

Which option would you prefer?" ✅
```

### Schedules - Before Fix:
```
User: "Schedule a reminder for 2 hours ago"
↓
System: "No actions were executed" ❌
(Confusing, no explanation)
```

### Schedules - After Fix:
```
User: "Schedule a reminder for 2 hours ago"
↓
System: "I noticed you mentioned '2 hours ago' which has already passed.

⏰ You can't schedule reminders for past times.

Did you mean:
1. 2 hours from now
2. in 2 hours

Which time would you prefer?" ✅
```

## Files Modified

1. **`utils/validation.js`**
   - Added `validateCalendarEvent()`
   - Added `validateScheduleReminder()`
   - Added `formatCalendarValidationErrors()`
   - Added `formatScheduleValidationErrors()`
   - Added helper functions for date formatting and suggestions

2. **`mainAgent/mainAgent.js`**
   - Fixed `extractCalendarEventParams()` to handle "yesterday"
   - Added validation in `checkForConfirmationRequired()` for calendar
   - Added `_validateAgentsBeforeExecution()` method for pre-execution validation
   - Integrated pre-execution validation in `processQueryWithStreaming()` BEFORE parallel execution
   - Added validation error handling in `processQueryWithStreaming()`
   - Modified `_sanitizeErrorForUser()` to preserve validation messages

3. **Test Files Created:**
   - `utils/test-calendar-validation.js` - Calendar validation tests (6 tests)
   - `utils/test-schedule-validation.js` - Schedule validation tests (7 tests)
   - `mainAgent/test-calendar-date-parsing.js` - Date parsing tests
   - `mainAgent/test-schedule-validation-flow.js` - Complete flow tests (4 tests)

## Test Results

### Calendar Validation Tests:
✅ Test 1: Past date (yesterday) → DETECTED  
✅ Test 2: Future date (tomorrow) → ACCEPTED  
✅ Test 3: Past date (2 hours ago) → DETECTED  
✅ Test 4: Invalid date range → DETECTED  
✅ Test 5: Missing summary → DETECTED  
✅ Test 6: Valid event (1 hour from now) → ACCEPTED  

### Schedule Validation Tests:
✅ Test 1: Past time (2 hours ago) → DETECTED  
✅ Test 2: Future time (2 hours from now) → ACCEPTED  
✅ Test 3: Yesterday → DETECTED  
✅ Test 4: Last week → DETECTED  
✅ Test 5: Tomorrow (valid) → ACCEPTED  
✅ Test 6: Missing content → DETECTED  
✅ Test 7: 5 minutes ago → DETECTED  

### Schedule Validation Flow Tests:
✅ Test 1: Schedule reminder for 2 hours ago → ERROR DETECTED  
✅ Test 2: Schedule reminder for 2 hours from now → ACCEPTED  
✅ Test 3: Remind me yesterday → ERROR DETECTED  
✅ Test 4: Calendar event (non-schedule agent) → ACCEPTED  

**All 17 tests pass!** ✅

## Validation Rules

### Calendar Events:
- Start date/time must be in the future
- End time must be after start time
- Event must have a title/summary

### Schedules/Reminders:
- Schedule time must be in the future
- Detects patterns: "X ago", "yesterday", "last week", "previous month"
- Reminder must have content

## Error Messages

### Calendar Past Date:
```
I noticed you mentioned a time that has already passed.

📅 Requested: [formatted date and time]
⏰ That was [time ago]

Did you mean:
1. [Today at same time] (if applicable)
2. [Tomorrow at same time]
3. [Next week same day at same time]
4. Create past event for records

Which option would you prefer?
```

### Schedule Past Time:
```
I noticed you mentioned "[detected phrase]" which has already passed.

⏰ You can't schedule reminders for past times.

Did you mean:
1. [suggestion 1]
2. [suggestion 2]

Which time would you prefer?
```

## Benefits

1. **Prevents Past Events/Reminders**: Users can't accidentally create them
2. **Clear Feedback**: Users understand what went wrong
3. **Smart Suggestions**: Context-aware alternatives provided
4. **Better UX**: No confusion about dates/times
5. **Early Validation**: Errors caught before execution
6. **Consistent Experience**: Same validation approach for both calendar and schedules

## Testing

Run the test suites:
```bash
cd PolarisAI-Backend

# Calendar validation tests
node utils/test-calendar-validation.js

# Schedule validation tests
node utils/test-schedule-validation.js

# Date parsing tests
node mainAgent/test-calendar-date-parsing.js

# Schedule validation flow tests
node mainAgent/test-schedule-validation-flow.js
```

Expected output: All tests pass ✅

## Edge Cases Handled

- Events/reminders for minutes ago
- Events/reminders for hours ago
- Events/reminders for days ago
- "Yesterday" correctly parsed as previous day
- "Last week", "last month", "previous year"
- Events with end time before start time
- Events/reminders without titles/content
- Valid future events/reminders (accepted)

## Related Issues Resolved

- 🔴 Calendar: Past event creation without warning
- 🔴 Calendar: Date parsing errors for "yesterday"
- 🔴 Calendar: Silent creation of invalid events
- 🔴 Schedules: Past reminder scheduling without error
- 🔴 Schedules: Confusing "No actions executed" message
- 🔴 Both: Poor user experience with temporal errors
