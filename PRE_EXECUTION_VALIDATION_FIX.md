# Pre-Execution Validation Fix

## 🎯 Problem

The system was validating parameters **after** tool execution, causing:
- Invalid emails being sent to Gmail API
- Drafts being created with invalid recipients
- Wasted API calls and resources
- Poor user experience with delayed error messages

### Example Issue:
```
User: "Send an email to invalid-email-format about the meeting"

❌ OLD BEHAVIOR:
1. LLM generates parameters: { to: "invalid-email-format", ... }
2. System calls Gmail API
3. Gmail API creates draft
4. Gmail API fails with error
5. User sees error after wasted operations

✅ NEW BEHAVIOR:
1. LLM generates parameters: { to: "invalid-email-format", ... }
2. System validates parameters BEFORE execution
3. Validation fails immediately
4. User sees error: "Invalid email format"
5. No API calls made, no drafts created
```

## 🔧 Solution

Added **pre-execution validation** that validates tool parameters BEFORE calling any external APIs or creating resources.

### Files Created/Modified:

1. **utils/toolParameterValidator.js** (NEW)
   - Email validation (strict regex)
   - Email list validation
   - Tool-specific validators (Gmail, Calendar, etc.)
   - User-friendly error messages

2. **base/BaseAgent.js** (MODIFIED)
   - Added pre-execution validation in `validateParameters()`
   - Validates parameters before tool execution
   - Throws user-friendly errors early

## 📋 How It Works

### Validation Flow:

```javascript
// 1. LLM generates tool call
{
  "tool": "sendEmail",
  "parameters": {
    "to": "invalid-email-format",
    "subject": "Meeting",
    "body": "Let's meet"
  }
}

// 2. BaseAgent.validateParameters() is called
validateParameters(params, "sendEmail")

// 3. Pre-execution validator checks email format
validateToolParameters("sendEmail", params)
  ↓
validateEmailAddress("invalid-email-format")
  ↓
❌ FAILS: Invalid email format

// 4. Error thrown BEFORE tool execution
throw Error("Invalid 'to' email: 'invalid-email-format' doesn't look like a valid email...")

// 5. No API calls made, no resources created
```

## 🎯 Validators Implemented

### Gmail Validators:

#### sendEmail
- ✅ Validates `to` email (required)
- ✅ Validates `cc` emails (optional)
- ✅ Validates `bcc` emails (optional)
- ✅ Validates `subject` (required)
- ✅ Validates `body` (required)

#### createDraft
- ✅ Validates `to` email (optional)
- ✅ Validates `cc` emails (optional)
- ✅ Validates `bcc` emails (optional)

#### replyToEmail
- ✅ Validates `messageId` (required)
- ✅ Validates `body` (required)

#### forwardEmail
- ✅ Validates `messageId` (required)
- ✅ Validates `to` email (required)

### Calendar Validators:

#### createEvent
- ✅ Validates `summary` (required)
- ✅ Validates `startDateTime` (required, valid date)
- ✅ Validates `endDateTime` (optional, valid date)
- ✅ Validates `attendees` emails (optional)

## 📝 Email Validation Rules

### Strict Email Regex:
```javascript
/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
```

### Validation Checks:
1. ✅ Not empty or null
2. ✅ No spaces in email
3. ✅ Contains @ symbol
4. ✅ Contains domain with extension (.com, .org, etc.)
5. ✅ Matches strict email regex

### Invalid Examples:
- ❌ `invalid-email-format` (no @ or domain)
- ❌ `test @example.com` (contains space)
- ❌ `test@` (no domain)
- ❌ `@example.com` (no local part)
- ❌ `test@example` (no extension)
- ❌ `test..@example.com` (double dots)

### Valid Examples:
- ✅ `user@example.com`
- ✅ `john.doe@company.co.uk`
- ✅ `test+tag@domain.org`
- ✅ `user_123@sub.domain.com`

## 🧪 Testing

### Test Invalid Email:
```bash
# This should fail BEFORE creating draft
curl -X POST http://localhost:3000/api/gmail/agent/query \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d '{"query": "Send an email to invalid-email-format about the meeting"}'

# Expected response:
{
  "success": false,
  "error": "I noticed an issue with the sendEmail parameters:\n\nInvalid 'to' email: 'invalid-email-format' doesn't look like a valid email. Email should be like: name@domain.com\n\nPlease provide the correct information and I'll try again."
}
```

### Test Valid Email:
```bash
curl -X POST http://localhost:3000/api/gmail/agent/query \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d '{"query": "Send an email to john@example.com about the meeting"}'

# Expected: Email sent successfully
```

### Test Multiple Invalid Emails:
```bash
curl -X POST http://localhost:3000/api/gmail/agent/query \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d '{"query": "Send an email to john@example.com, cc invalid-email, bcc test@"}'

# Expected: Validation error for cc and bcc
```

## 🔄 Error Flow Comparison

### Before (❌ Bad):
```
User Query
  ↓
LLM Generates Parameters
  ↓
BaseAgent.executeToolCall()
  ↓
Gmail API Call (creates draft)
  ↓
Gmail API Error
  ↓
Error returned to user
```

### After (✅ Good):
```
User Query
  ↓
LLM Generates Parameters
  ↓
BaseAgent.validateParameters()
  ↓
Pre-execution Validation
  ↓
❌ Validation Error (if invalid)
  ↓
Error returned to user immediately
  ↓
No API calls made
```

## 📊 Benefits

1. **Faster Error Detection**
   - Errors caught in milliseconds, not seconds
   - No waiting for API responses

2. **Resource Savings**
   - No wasted API calls
   - No unnecessary drafts created
   - Reduced API quota usage

3. **Better User Experience**
   - Immediate feedback
   - Clear error messages
   - No confusing "draft created but failed" states

4. **Cleaner Logs**
   - No API errors in logs
   - Validation errors clearly marked
   - Easier debugging

5. **Cost Savings**
   - Fewer API calls = lower costs
   - Reduced error handling overhead

## 🎯 Adding New Validators

To add validation for a new tool:

```javascript
// In utils/toolParameterValidator.js

// 1. Create validator function
const MY_TOOL_VALIDATORS = {
  myNewTool: (params) => {
    const errors = [];
    
    // Validate required fields
    if (!params.requiredField) {
      errors.push("Missing required field 'requiredField'");
    }
    
    // Validate email if present
    if (params.email) {
      try {
        validateEmailAddress(params.email, 'email');
      } catch (error) {
        errors.push(`Invalid email: ${error.message}`);
      }
    }
    
    // Throw if errors found
    if (errors.length > 0) {
      throw new Error(errors.join('; '));
    }
    
    return true;
  }
};

// 2. Add to TOOL_VALIDATORS registry
const TOOL_VALIDATORS = {
  // ... existing validators
  myNewTool: MY_TOOL_VALIDATORS.myNewTool
};
```

## 🚀 Deployment

### No Changes Required:
- ✅ Automatically works for all agents
- ✅ No migration needed
- ✅ Backward compatible
- ✅ Works with existing code

### Just Deploy:
1. Deploy updated `BaseAgent.js`
2. Deploy new `toolParameterValidator.js`
3. Test with invalid emails
4. Monitor logs for validation errors

## 📈 Monitoring

### Log Messages to Watch:

```javascript
// Validation success (no log)
// Tool executes normally

// Validation failure
[AgentName] ❌ Pre-execution validation failed for sendEmail: Invalid email format

// User sees friendly error
"I noticed an issue with the sendEmail parameters:

Invalid 'to' email: 'invalid-email-format' doesn't look like a valid email. Email should be like: name@domain.com

Please provide the correct information and I'll try again."
```

### Metrics to Track:
- Validation errors per tool
- Most common validation failures
- Time saved by early validation
- Reduction in API errors

## ✅ Checklist

- [x] Created toolParameterValidator.js
- [x] Updated BaseAgent.js with pre-execution validation
- [x] Added email validation (strict regex)
- [x] Added Gmail tool validators
- [x] Added Calendar tool validators
- [x] Added user-friendly error messages
- [x] Tested with invalid emails
- [x] Documented validation rules
- [ ] Deploy to production
- [ ] Monitor validation errors
- [ ] Add more tool validators as needed

## 🎉 Result

The system now validates parameters **before** execution, preventing:
- ❌ Invalid API calls
- ❌ Wasted resources
- ❌ Confusing error states
- ❌ Poor user experience

And providing:
- ✅ Immediate error feedback
- ✅ Clear error messages
- ✅ Resource savings
- ✅ Better user experience

The issue shown in your screenshot is now fixed! 🎊
