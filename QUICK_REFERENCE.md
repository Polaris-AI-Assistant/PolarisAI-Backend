# Quick Reference - Scheduler & Timezone Fix

## What Was Fixed

| Issue | Before | After |
|-------|--------|-------|
| Bitcoin price response | "I'm sorry, but I can only respond in English" | Shows actual Bitcoin price ($66,319.15) |
| Reminder routing | Used Calendar agent | Uses Schedules agent ✅ |
| Time display | 08:30:00 (wrong) | 14:00:00 (correct) ✅ |

## Test Commands

```bash
# Run timezone tests
node schedules/test-timezone-fix.js

# Run scheduler agent tests
node schedules/test-scheduler-agent.js

# Start server
npm start
```

## Example Queries

### ✅ Works Now
```
"Check Bitcoin price and schedule a reminder to check it again tomorrow at 2 PM"
→ Shows Bitcoin price + Creates reminder for 2 PM (correct time)

"Remind me to call mom tomorrow at 5 PM"
→ Uses schedules agent + Shows 5 PM (not 11:30 AM)

"Set a reminder to submit report next Monday at 9 AM"
→ Creates reminder for 9 AM (correct time)
```

### Agent Routing

| Query Pattern | Agent Used |
|---------------|------------|
| "Remind me to..." | Schedules ✅ |
| "Set a reminder..." | Schedules ✅ |
| "Schedule a meeting..." | Calendar ✅ |
| "Create an event..." | Calendar ✅ |
| "Check Bitcoin price..." | WebSearch ✅ |
| "What's the weather..." | Weather ✅ |

## Timezone Conversion

```
User says: "tomorrow at 2 PM" (in India)
System stores: 08:30:00 UTC
User sees: 14:00:00 (2 PM) ✅
Executes at: 2 PM Indian time ✅
```

## Files to Check

### If response is wrong:
- `mainAgent/mainAgent.js` (line ~4780) - websearch extraction

### If routing is wrong:
- `mainAgent/mainAgent.js` (line ~1950) - agent list
- `mainAgent/mainAgent.js` (line ~2070) - examples

### If time is wrong:
- `schedules/schedulesAgentMultiStep.js` (line ~350) - timezone parsing
- `utils/timezoneDetection.js` - timezone detection

## Logs to Monitor

```bash
# Timezone detection
[MainAgent] 🌍 Detected user timezone: Asia/Kolkata

# Timezone parsing
[SchedulesAgent] 🕐 Parsing datetime: "tomorrow at 2 PM" (timezone: Asia/Kolkata)
[SchedulesAgent] 🌍 User timezone (Asia/Kolkata): 2026-02-24 14:00:00 +05:30
[SchedulesAgent] 🌐 UTC time: 2026-02-24 08:30:00 +00:00
[SchedulesAgent] ⚙️ Generated cron (UTC): 30 8 24 2 *

# Websearch extraction
[MainAgent] 📦 Passing structured research content to schedules
```

## Database Check

```sql
-- Check reminder time
SELECT 
  content,
  next_execution,
  timezone,
  cron_expression
FROM schedules
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC
LIMIT 1;

-- Expected for "2 PM IST":
-- next_execution: 2026-02-24T08:30:00.000Z (UTC)
-- timezone: Asia/Kolkata
-- cron_expression: 30 8 24 2 *
```

## Common Issues

### Issue: Time still wrong
**Fix**: Check if timezone is being passed
```javascript
// In mainAgent.js, look for:
...(agentName === 'schedules' ? { 
  timezone: this._detectUserTimezone(userLocation) 
} : {})
```

### Issue: Wrong agent used
**Fix**: Check analyzeQuery prompt includes schedules agent
```javascript
// Should have:
- schedules: Reminders and scheduled actions...
```

### Issue: Websearch not showing
**Fix**: Check synthesizedContent extraction
```javascript
// Should extract from executedActions:
websearchContent = researchAction.result.synthesizedContent
```

## Dependencies

```json
{
  "chrono-node": "^2.7.6",
  "moment-timezone": "^0.5.45"
}
```

## Quick Verification

1. ✅ Send: "Check Bitcoin price and remind me tomorrow at 2 PM"
2. ✅ See Bitcoin price in response
3. ✅ See reminder confirmation for 2 PM
4. ✅ Check scheduler UI shows 14:00:00 (not 08:30:00)
5. ✅ Check database shows correct UTC time

## Support

- Full documentation: `COMPLETE_FIX_SUMMARY.md`
- Timezone details: `TIMEZONE_FIX.md`
- Agent routing: `AGENT_ROUTING_GUIDE.md`
- Scheduler docs: `schedules/README.md`
