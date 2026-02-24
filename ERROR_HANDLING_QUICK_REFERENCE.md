# Error Handling Quick Reference Card

## 🚀 5-Minute Setup

```javascript
// 1. Add to index.js (BEFORE server.listen())
const { errorMiddleware, notFoundHandler } = require('./middleware/errorMiddleware');
app.use(notFoundHandler);
app.use(errorMiddleware);

// 2. Enable test routes (development only)
if (process.env.NODE_ENV === 'development') {
  app.use('/api/test/errors', require('./routes/errorTestRoutes'));
}

// 3. Test it works
// curl http://localhost:3000/api/test/errors/list
```

## 📝 Common Patterns

### Route with Error Handling
```javascript
const { asyncHandler } = require('./middleware/errorMiddleware');
const { authenticateToken } = require('./middleware/enhancedAuth');
const { validateRequired } = require('./utils/errors/validationUtils');

router.post('/endpoint', 
  authenticateToken,
  asyncHandler(async (req, res) => {
    validateRequired(req.body, ['field1', 'field2']);
    const result = await service.doSomething(req.body);
    res.json({ success: true, data: result });
  })
);
```

### Service with Error Handling
```javascript
const { GmailErrorHandler } = require('./utils/errors/serviceErrorHandlers');
const { retry } = require('./utils/errors/retryHandler');

async function sendEmail(userId, data) {
  return await GmailErrorHandler.wrapAsync(async () => {
    return await retry(async () => {
      const gmail = await getGmailClient(userId);
      return await gmail.users.messages.send({...});
    });
  });
}
```

### Custom Error
```javascript
const { ErrorHandler } = require('./utils/errors/ErrorHandler');
const { GMAIL_ERRORS } = require('./utils/errors/errorTypes');

throw ErrorHandler.create(GMAIL_ERRORS.RECIPIENT_NOT_FOUND, {
  email: 'invalid@example.com'
});
```

## 🧪 Quick Tests

```bash
# List all errors
curl http://localhost:3000/api/test/errors/list

# Test auth error
curl http://localhost:3000/api/test/errors/auth/not-authenticated

# Test validation
curl -X POST http://localhost:3000/api/test/errors/validation \
  -H "Content-Type: application/json" \
  -d '{"type": "email", "value": "bad-email"}'

# Test rate limit (make 6 requests quickly)
for i in {1..6}; do curl http://localhost:3000/api/test/errors/rate-limit \
  -H "Authorization: Bearer token"; done
```

## 📊 Error Categories

| Code Prefix | Category | Examples |
|-------------|----------|----------|
| SYS_* | System | Service down, timeout, memory limit |
| PLT_* | Platform | Agent not found, tool failed |
| AUTH_* | Authentication | Token expired, not authenticated |
| PERM_* | Permissions | Read-only access, access denied |
| VAL_* | Validation | Invalid email, date, URL |
| HTTP_* | HTTP | 400, 401, 403, 404, 429, 500, 503 |
| NET_* | Network | Connection refused, timeout |
| PRS_* | Parsing | JSON, CSV, date parsing |
| TRF_* | Transformation | Timezone, currency, type conversion |
| GMAIL_* | Gmail | Recipient not found, attachment too large |
| CAL_* | Calendar | Event conflict, past event |
| GH_* | GitHub | Repo not found, protected branch |
| SRCH_* | Search | No results, timeout |
| SCH_* | Scheduler | Past time, invalid cron |
| FILE_* | Files | Too large, unsupported type |
| UX_* | UX | Ambiguous reference, missing context |
| SAFE_* | Safety | Destructive action, bulk operation |
| WF_* | Workflow | Dependency failed, partial success |

## 🔧 Validation Functions

```javascript
const {
  validateEmail,      // Email format
  validateUrl,        // URL format
  validateDate,       // Date validity
  validateTime,       // Time format
  validateRequired,   // Required fields
  validateLength,     // String length
  validateRange,      // Number range
  sanitizeInput       // XSS prevention
} = require('./utils/errors/validationUtils');

const {
  validateJSON,           // JSON parsing
  validateTimezone,       // Timezone codes
  validateCurrency,       // Currency codes
  validateFileSize,       // File size limits
  validateFileType,       // File extensions
  validateScheduleTime,   // Schedule validation
  validateCronExpression  // Cron syntax
} = require('./utils/errors/advancedValidation');
```

## 🔄 Retry Patterns

```javascript
const { retry, retryWithRateLimit, CircuitBreaker } = require('./utils/errors/retryHandler');

// Basic retry
await retry(async () => apiCall(), {
  maxAttempts: 3,
  initialDelay: 1000
});

// Rate limit aware
await retryWithRateLimit(async () => githubApi.call(), 5);

// Circuit breaker
const breaker = new CircuitBreaker({ failureThreshold: 5 });
await breaker.execute(async () => unreliableService.call());
```

## 🛡️ Service Handlers

```javascript
const {
  GmailErrorHandler,
  CalendarErrorHandler,
  GitHubErrorHandler,
  DocsErrorHandler,
  WebSearchErrorHandler,
  DatabaseErrorHandler
} = require('./utils/errors/serviceErrorHandlers');

// Wrap any service call
await GmailErrorHandler.wrapAsync(async () => {
  return await gmailService.sendEmail(params);
});
```

## 🔐 Auth Middleware

```javascript
const {
  authenticateToken,           // Require valid JWT
  optionalAuth,                // Optional JWT
  requireServiceConnection,    // Require service connected
  requireScopes,               // Require OAuth scopes
  rateLimit                    // Rate limiting
} = require('./middleware/enhancedAuth');

router.post('/endpoint',
  authenticateToken,
  requireServiceConnection('Gmail', 'gmail_tokens'),
  rateLimit(100, 60000),  // 100 req/min
  asyncHandler(async (req, res) => {
    // Handle request
  })
);
```

## 📈 Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "AUTH_001",
    "message": "User-friendly message here",
    "technical": "Technical details (dev only)",
    "retryable": true,
    "action": "suggested_action",
    "context": {
      "service": "Gmail",
      "additionalInfo": "..."
    }
  },
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

## 🎯 Migration Priority

1. ✅ Add error middleware to index.js
2. ✅ Enable test routes
3. ✅ Test error responses
4. 🔄 Migrate auth routes
5. 🔄 Migrate agent controllers
6. 🔄 Update service files
7. ⏳ Update BaseAgent
8. ⏳ Add monitoring

## 📚 Documentation

- **README.md** - Full API docs
- **IMPLEMENTATION_GUIDE.md** - Step-by-step
- **TEST_QUERIES.md** - Test scenarios
- **ERROR_HANDLING_COMPLETE.md** - Overview

## 💡 Remember

✅ Always use `asyncHandler` for routes
✅ Validate input early
✅ Use service-specific handlers
✅ Add retry for network calls
✅ Log errors automatically
✅ Trust the middleware

## 🆘 Common Issues

**Error not caught?**
- Check asyncHandler is used
- Verify error middleware is last

**Validation not working?**
- Import correct validation function
- Check parameter order

**Retry not working?**
- Verify error is retryable
- Check retry configuration

**Rate limit not triggering?**
- Ensure authenticateToken is before rateLimit
- Check rate limit parameters

## 🎉 You're Ready!

Start with the 5-minute setup above, then gradually migrate your routes using the patterns shown here.
