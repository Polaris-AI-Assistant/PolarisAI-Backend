# Error Handling Test Queries

Comprehensive test queries to validate all error handling scenarios in the PolarisAI platform.

## 🔐 Authentication & Authorization Errors

### AUTH_001: Not Authenticated
```bash
# Test without token
curl -X POST http://localhost:3000/api/gmail/agent/query \
  -H "Content-Type: application/json" \
  -d '{"query": "show my emails"}'

# Expected: 401 with "You'll need to sign in to use Gmail..."
```

### AUTH_002: Token Expired
```bash
# Test with expired token
curl -X POST http://localhost:3000/api/gmail/agent/query \
  -H "Authorization: Bearer expired_token_here" \
  -H "Content-Type: application/json" \
  -d '{"query": "show my emails"}'

# Expected: 401 with "Your Gmail connection has expired..."
```

### AUTH_004: Insufficient Permissions
```bash
# Test action requiring additional scopes
curl -X POST http://localhost:3000/api/gmail/send \
  -H "Authorization: Bearer readonly_token" \
  -H "Content-Type: application/json" \
  -d '{"to": "test@example.com", "subject": "Test", "body": "Test"}'

# Expected: 403 with "I don't have permission to send emails..."
```

## ✅ Validation Errors

### VAL_001: Invalid Email
```bash
curl -X POST http://localhost:3000/api/gmail/send \
  -H "Authorization: Bearer valid_token" \
  -H "Content-Type: application/json" \
  -d '{"to": "invalid-email", "subject": "Test", "body": "Test"}'

# Expected: 400 with "'invalid-email' doesn't look like a valid email..."
```

### VAL_002: Invalid URL
```bash
curl -X POST http://localhost:3000/api/docs/import \
  -H "Authorization: Bearer valid_token" \
  -H "Content-Type: application/json" \
  -d '{"url": "not-a-url"}'

# Expected: 400 with "'not-a-url' doesn't appear to be a valid URL..."
```

### VAL_004: Invalid Date
```bash
curl -X POST http://localhost:3000/api/calendar/create-event \
  -H "Authorization: Bearer valid_token" \
  -H "Content-Type: application/json" \
  -d '{"summary": "Meeting", "startDateTime": "2025-02-30T10:00:00Z"}'

# Expected: 400 with "'2025-02-30' isn't a valid date..."
```

### CNT_001: Empty Required Field
```bash
curl -X POST http://localhost:3000/api/gmail/send \
  -H "Authorization: Bearer valid_token" \
  -H "Content-Type: application/json" \
  -d '{"to": "test@example.com", "subject": "", "body": ""}'

# Expected: 400 with "I need subject, body to complete this..."
```

### CNT_005: Excessive Length
```bash
# Generate 2000 character string
curl -X POST http://localhost:3000/api/websearch/agent/query \
  -H "Authorization: Bearer valid_token" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"$(python3 -c 'print("a" * 2000)')\"}"

# Expected: 400 with "This content is too long..."
```

## 🌐 HTTP & Network Errors

### HTTP_429: Rate Limit
```bash
# Send 101 requests rapidly (rate limit is 100/min)
for i in {1..101}; do
  curl -X POST http://localhost:3000/api/websearch/agent/query \
    -H "Authorization: Bearer valid_token" \
    -H "Content-Type: application/json" \
    -d '{"query": "test"}' &
done
wait

# Expected: 429 with "You've made too many requests..."
```

### HTTP_404: Not Found
```bash
curl -X GET http://localhost:3000/api/nonexistent/route \
  -H "Authorization: Bearer valid_token"

# Expected: 404 with "Route GET /api/nonexistent/route not found"
```

## 📧 Gmail-Specific Errors

### GMAIL_001: Recipient Not Found
```bash
curl -X POST http://localhost:3000/api/gmail/send \
  -H "Authorization: Bearer valid_token" \
  -H "Content-Type: application/json" \
  -d '{"to": "nonexistent@invaliddomain12345.com", "subject": "Test", "body": "Test"}'

# Expected: 400 with "The email address doesn't seem to exist..."
```

### GMAIL_002: Attachment Too Large
```bash
# Create 30MB file
dd if=/dev/zero of=/tmp/large_file.bin bs=1M count=30

curl -X POST http://localhost:3000/api/gmail/send \
  -H "Authorization: Bearer valid_token" \
  -F "to=test@example.com" \
  -F "subject=Large Attachment" \
  -F "body=Test" \
  -F "attachment=@/tmp/large_file.bin"

# Expected: 413 with "Attachment is 30MB (limit: 25MB)..."
```

### GMAIL_005: Draft Not Found
```bash
curl -X GET http://localhost:3000/api/gmail/draft/invalid_draft_id \
  -H "Authorization: Bearer valid_token"

# Expected: 404 with "I couldn't find that draft..."
```

## 📅 Calendar-Specific Errors

### CAL_001: Event Conflict
```bash
# Create event at 2PM
curl -X POST http://localhost:3000/api/calendar/create-event \
  -H "Authorization: Bearer valid_token" \
  -H "Content-Type: application/json" \
  -d '{"summary": "Meeting 1", "startDateTime": "2025-03-01T14:00:00Z", "endDateTime": "2025-03-01T15:00:00Z"}'

# Try to create another at same time
curl -X POST http://localhost:3000/api/calendar/create-event \
  -H "Authorization: Bearer valid_token" \
  -H "Content-Type: application/json" \
  -d '{"summary": "Meeting 2", "startDateTime": "2025-03-01T14:00:00Z", "endDateTime": "2025-03-01T15:00:00Z"}'

# Expected: 409 with "You already have 'Meeting 1' at this time..."
```

### CAL_002: Past Event Creation
```bash
curl -X POST http://localhost:3000/api/calendar/create-event \
  -H "Authorization: Bearer valid_token" \
  -H "Content-Type: application/json" \
  -d '{"summary": "Past Meeting", "startDateTime": "2024-01-01T10:00:00Z"}'

# Expected: 400 with "This time has already passed..."
```

### CAL_003: Attendee Limit Exceeded
```bash
# Generate 201 attendees
ATTENDEES=$(python3 -c "import json; print(json.dumps([f'user{i}@example.com' for i in range(201)]))")

curl -X POST http://localhost:3000/api/calendar/create-event \
  -H "Authorization: Bearer valid_token" \
  -H "Content-Type: application/json" \
  -d "{\"summary\": \"Large Meeting\", \"startDateTime\": \"2025-03-01T10:00:00Z\", \"attendees\": $ATTENDEES}"

# Expected: 400 with "Google Calendar limits events to 200 attendees..."
```

## 🔍 Search Errors

### SRCH_001: No Results
```bash
curl -X POST http://localhost:3000/api/websearch/agent/query \
  -H "Authorization: Bearer valid_token" \
  -H "Content-Type: application/json" \
  -d '{"query": "asdfghjklqwertyuiop12345"}'

# Expected: 404 with "I couldn't find anything for..."
```

### SRCH_003: Ambiguous Query
```bash
curl -X POST http://localhost:3000/api/websearch/agent/query \
  -H "Authorization: Bearer valid_token" \
  -H "Content-Type: application/json" \
  -d '{"query": "it"}'

# Expected: 400 with "'it' is quite broad..."
```

## 📁 File Errors

### FILE_001: File Too Large
```bash
# Create 60MB file
dd if=/dev/zero of=/tmp/huge_file.bin bs=1M count=60

curl -X POST http://localhost:3000/api/files/upload \
  -H "Authorization: Bearer valid_token" \
  -F "file=@/tmp/huge_file.bin"

# Expected: 413 with "File is 60MB (limit: 50MB)..."
```

### FILE_002: Unsupported File Type
```bash
curl -X POST http://localhost:3000/api/files/upload \
  -H "Authorization: Bearer valid_token" \
  -F "file=@malware.exe"

# Expected: 415 with "I can't process exe files..."
```

### FILE_005: Invalid Filename
```bash
curl -X POST http://localhost:3000/api/files/upload \
  -H "Authorization: Bearer valid_token" \
  -F "file=@test<>file.txt"

# Expected: 400 with "Filename contains invalid characters..."
```

## ⏰ Scheduler Errors

### SCH_001: Past Schedule Time
```bash
curl -X POST http://localhost:3000/api/schedules/create \
  -H "Authorization: Bearer valid_token" \
  -H "Content-Type: application/json" \
  -d '{"action": "send_email", "scheduledTime": "2024-01-01T10:00:00Z"}'

# Expected: 400 with "That time has already passed..."
```

### SCH_003: Schedule Too Far
```bash
# Schedule 2 months ahead
FUTURE_DATE=$(date -d "+60 days" +%Y-%m-%dT10:00:00Z)

curl -X POST http://localhost:3000/api/schedules/create \
  -H "Authorization: Bearer valid_token" \
  -H "Content-Type: application/json" \
  -d "{\"action\": \"send_email\", \"scheduledTime\": \"$FUTURE_DATE\"}"

# Expected: 400 with "I can only schedule up to 1 month ahead..."
```

### SCH_004: Schedule Too Soon
```bash
# Schedule 1 minute from now
SOON_DATE=$(date -d "+1 minute" +%Y-%m-%dT%H:%M:%SZ)

curl -X POST http://localhost:3000/api/schedules/create \
  -H "Authorization: Bearer valid_token" \
  -H "Content-Type: application/json" \
  -d "{\"action\": \"send_email\", \"scheduledTime\": \"$SOON_DATE\"}"

# Expected: 400 with "Schedules must be at least 4 minutes in the future..."
```

### SCH_002: Invalid Cron
```bash
curl -X POST http://localhost:3000/api/schedules/create \
  -H "Authorization: Bearer valid_token" \
  -H "Content-Type: application/json" \
  -d '{"action": "send_email", "cron": "60 * * * *"}'

# Expected: 400 with "Schedule format error: Minute must be between 0 and 59..."
```

## 🔄 Parsing & Transformation Errors

### PRS_001: JSON Parse Error
```bash
curl -X POST http://localhost:3000/api/test/parse-json \
  -H "Authorization: Bearer valid_token" \
  -H "Content-Type: application/json" \
  -d '{"invalid": json}'

# Expected: 500 with "I received malformed data..."
```

### PRS_002: Date Parse Error (Ambiguous)
```bash
curl -X POST http://localhost:3000/api/calendar/create-event \
  -H "Authorization: Bearer valid_token" \
  -H "Content-Type: application/json" \
  -d '{"summary": "Meeting", "startDateTime": "01/02/2025"}'

# Expected: 400 with "I'm not sure about the date '01/02/2025'..."
```

### TRF_002: Timezone Conversion Error
```bash
curl -X POST http://localhost:3000/api/calendar/create-event \
  -H "Authorization: Bearer valid_token" \
  -H "Content-Type: application/json" \
  -d '{"summary": "Meeting", "startDateTime": "2025-03-01T10:00:00", "timeZone": "Invalid/Timezone"}'

# Expected: 400 with "'Invalid/Timezone' isn't a recognized timezone..."
```

### TRF_003: Currency Conversion Error
```bash
curl -X POST http://localhost:3000/api/convert/currency \
  -H "Authorization: Bearer valid_token" \
  -H "Content-Type: application/json" \
  -d '{"amount": 100, "from": "XXX", "to": "USD"}'

# Expected: 400 with "I don't recognize currency 'XXX'..."
```

## 🎯 UX & Context Errors

### UX_001: Ambiguous Reference
```bash
curl -X POST http://localhost:3000/api/gmail/agent/query \
  -H "Authorization: Bearer valid_token" \
  -H "Content-Type: application/json" \
  -d '{"query": "send it"}'

# Expected: 400 with "When you say 'it', do you mean..."
```

### UX_002: Missing Context
```bash
curl -X POST http://localhost:3000/api/gmail/agent/query \
  -H "Authorization: Bearer valid_token" \
  -H "Content-Type: application/json" \
  -d '{"query": "reply to that"}'

# Expected: 400 with "I don't have enough context..."
```

## ⚠️ Safety Checks

### SAFE_001: Destructive Action
```bash
curl -X DELETE http://localhost:3000/api/gmail/delete-all \
  -H "Authorization: Bearer valid_token"

# Expected: 400 with "⚠️ This will permanently delete all emails..."
```

### SAFE_002: Bulk Operation Warning
```bash
curl -X POST http://localhost:3000/api/gmail/mark-read \
  -H "Authorization: Bearer valid_token" \
  -H "Content-Type: application/json" \
  -d '{"messageIds": ["id1", "id2", ..., "id51"]}'  # 51 items

# Expected: 400 with "This will affect 51 items. Proceed?"
```

## 🔧 GitHub-Specific Errors

### GH_001: Repo Not Found
```bash
curl -X GET http://localhost:3000/api/github/repo/nonexistent/repo \
  -H "Authorization: Bearer valid_token"

# Expected: 404 with "Repository 'nonexistent/repo' not found..."
```

### GH_004: Protected Branch
```bash
curl -X POST http://localhost:3000/api/github/push \
  -H "Authorization: Bearer valid_token" \
  -H "Content-Type: application/json" \
  -d '{"repo": "owner/repo", "branch": "main", "files": [...]}'

# Expected: 403 with "'main' is protected. You need to create a PR..."
```

## 🔄 Workflow Errors

### WF_001: Dependency Failed
```bash
curl -X POST http://localhost:3000/api/workflows/execute \
  -H "Authorization: Bearer valid_token" \
  -H "Content-Type: application/json" \
  -d '{"steps": [{"action": "fetch_data", "source": "invalid"}, {"action": "process_data"}]}'

# Expected: 500 with "I couldn't fetch_data, so I can't continue with process_data..."
```

### WF_002: Partial Success
```bash
curl -X POST http://localhost:3000/api/workflows/execute \
  -H "Authorization: Bearer valid_token" \
  -H "Content-Type: application/json" \
  -d '{"steps": [{"action": "step1"}, {"action": "step2_fails"}, {"action": "step3"}]}'

# Expected: 207 with "✅ Completed: step1, step3 ❌ Failed: step2_fails..."
```

## 📊 Test Script

Save this as `test_errors.sh`:

```bash
#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:3000"
TOKEN="your_test_token_here"

echo "🧪 Testing PolarisAI Error Handling"
echo "=================================="

# Test 1: Authentication Error
echo -e "\n${YELLOW}Test 1: AUTH_001 - Not Authenticated${NC}"
response=$(curl -s -X POST "$BASE_URL/api/gmail/agent/query" \
  -H "Content-Type: application/json" \
  -d '{"query": "test"}')
echo "$response" | jq '.error.code'

# Test 2: Invalid Email
echo -e "\n${YELLOW}Test 2: VAL_001 - Invalid Email${NC}"
response=$(curl -s -X POST "$BASE_URL/api/test/validate-email" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "invalid-email"}')
echo "$response" | jq '.error.code'

# Test 3: Rate Limit
echo -e "\n${YELLOW}Test 3: HTTP_429 - Rate Limit${NC}"
for i in {1..101}; do
  curl -s -X POST "$BASE_URL/api/websearch/agent/query" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"query": "test"}' > /dev/null &
done
wait
response=$(curl -s -X POST "$BASE_URL/api/websearch/agent/query" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "test"}')
echo "$response" | jq '.error.code'

echo -e "\n${GREEN}✅ Error handling tests complete${NC}"
```

Run with:
```bash
chmod +x test_errors.sh
./test_errors.sh
```
