# Error Handling Implementation Guide

Step-by-step guide to integrate the error handling system into your PolarisAI platform.

## 🎯 Step 1: Update Express App (index.js)

Add error middleware to your Express app:

```javascript
// At the top of index.js
const { errorMiddleware, notFoundHandler } = require('./middleware/errorMiddleware');
const { authenticateToken } = require('./middleware/enhancedAuth');

// ... your existing routes ...

// Add BEFORE starting the server
// 404 handler (must be after all routes)
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorMiddleware);
```

## 🎯 Step 2: Update Existing Routes

### Before (Old Pattern):
```javascript
router.post('/gmail/send', async (req, res) => {
  try {
    const result = await gmailService.sendEmail(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

### After (New Pattern):
```javascript
const { asyncHandler } = require('./middleware/errorMiddleware');
const { authenticateToken, requireServiceConnection } = require('./middleware/enhancedAuth');
const { validateRequired } = require('./utils/errors/validationUtils');
const { GmailErrorHandler } = require('./utils/errors/serviceErrorHandlers');

router.post('/gmail/send', 
  authenticateToken,
  requireServiceConnection('Gmail', 'gmail_tokens'),
  asyncHandler(async (req, res) => {
    // Validate input
    validateRequired(req.body, ['to', 'subject', 'body']);
    
    // Execute with error handling
    const result = await GmailErrorHandler.wrapAsync(async () => {
      return await gmailService.sendEmail(req.user.id, req.body);
    });
    
    res.json({ success: true, data: result });
  })
);
```

## 🎯 Step 3: Update Service Files

### Gmail Service Example:

```javascript
// At the top of gmailService.js
const { GmailErrorHandler } = require('../utils/errors/serviceErrorHandlers');
const { validateEmail, validateRequired } = require('../utils/errors/validationUtils');
const { retry } = require('../utils/errors/retryHandler');

async function sendEmail(userId, emailData) {
  // Validate inputs
  validateRequired(emailData, ['to', 'subject', 'body']);
  validateEmail(emailData.to);
  
  // Get Gmail client with error handling
  const gmail = await GmailErrorHandler.wrapAsync(async () => {
    return await getGmailClient(userId);
  });
  
  // Send email with retry logic
  return await retry(async () => {
    return await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: createEmailRaw(emailData)
      }
    });
  }, {
    maxAttempts: 3,
    initialDelay: 1000
  });
}
```

### Calendar Service Example:

```javascript
const { CalendarErrorHandler } = require('../utils/errors/serviceErrorHandlers');
const { validateRequired, validateDate } = require('../utils/errors/validationUtils');

async function createEvent(userId, eventData) {
  // Validate inputs
  validateRequired(eventData, ['summary', 'startDateTime']);
  validateDate(eventData.startDateTime);
  
  // Get calendar client with error handling
  const { calendar } = await CalendarErrorHandler.wrapAsync(async () => {
    return await getCalendarClient(userId);
  });
  
  // Create event
  return await CalendarErrorHandler.wrapAsync(async () => {
    return await calendar.events.insert({
      calendarId: 'primary',
      requestBody: eventData
    });
  });
}
```

## 🎯 Step 4: Update Agent Controllers

### Before:
```javascript
router.post('/agent/query', authenticateToken, async (req, res) => {
  try {
    const { query } = req.body;
    const result = await agent.processQuery(query, req.user.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### After:
```javascript
const { asyncHandler } = require('../middleware/errorMiddleware');
const { validateLength } = require('../utils/errors/validationUtils');
const { rateLimit } = require('../middleware/enhancedAuth');

router.post('/agent/query', 
  authenticateToken,
  rateLimit(100, 60000), // 100 requests per minute
  asyncHandler(async (req, res) => {
    const { query } = req.body;
    
    // Validate query
    validateLength(query, 'query', 1, 1000);
    
    // Process query
    const result = await agent.processQuery(query, req.user.id);
    
    res.json(result);
  })
);
```

## 🎯 Step 5: Update BaseAgent Class

Add error handling to the BaseAgent:

```javascript
// At the top of BaseAgent.js
const { ErrorHandler } = require('../utils/errors/ErrorHandler');
const { PLATFORM_ERRORS } = require('../utils/errors/errorTypes');
const { retry } = require('../utils/errors/retryHandler');

class BaseAgent {
  async processQuery(query, context = {}) {
    try {
      // Validate query
      if (!query || query.trim().length === 0) {
        throw ErrorHandler.create(PLATFORM_ERRORS.INVALID_TOOL_PARAMETERS, {
          missingParameter: 'query'
        });
      }
      
      // Process with retry
      return await retry(async () => {
        return await this.executeQuery(query, context);
      }, {
        maxAttempts: 3
      });
    } catch (error) {
      ErrorHandler.log(error);
      
      // If it's already a PolarisError, rethrow
      if (error.name === 'PolarisError') {
        throw error;
      }
      
      // Wrap unknown errors
      throw ErrorHandler.create(PLATFORM_ERRORS.TOOL_EXECUTION_FAILED, {
        action: 'process query',
        errorReason: error.message
      });
    }
  }
  
  async executeToolCall(toolCall, context) {
    try {
      // Execute tool with error handling
      return await this.tools[toolCall.function.name].execute(
        JSON.parse(toolCall.function.arguments),
        context
      );
    } catch (error) {
      ErrorHandler.log(error);
      throw error;
    }
  }
}
```

## 🎯 Step 6: Update Authentication Routes

```javascript
// auth/auth.js
const { asyncHandler } = require('../middleware/errorMiddleware');
const { validateEmail, validateLength, validateRequired } = require('../utils/errors/validationUtils');
const { ErrorHandler } = require('../utils/errors/ErrorHandler');
const { AUTH_ERRORS } = require('../utils/errors/errorTypes');

router.post('/signup/send-otp', asyncHandler(async (req, res) => {
  // Validate inputs
  validateRequired(req.body, ['email', 'password', 'fullName']);
  const email = validateEmail(req.body.email);
  validateLength(req.body.password, 'password', 8, 100);
  
  // Create user
  const { data, error } = await supabase.auth.signUp({
    email,
    password: req.body.password,
    options: {
      data: { full_name: req.body.fullName }
    }
  });
  
  if (error) {
    throw ErrorHandler.create(AUTH_ERRORS.NOT_AUTHENTICATED, {
      service: 'PolarisAI',
      action: error.message
    });
  }
  
  res.status(201).json({
    success: true,
    message: 'OTP sent to your email',
    email
  });
}));
```

## 🎯 Step 7: Add Circuit Breaker for External APIs

For frequently called external APIs:

```javascript
const { CircuitBreaker } = require('../utils/errors/retryHandler');

class ExternalAPIService {
  constructor() {
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 60000 // 1 minute
    });
  }
  
  async makeRequest(endpoint, data) {
    return await this.circuitBreaker.execute(async () => {
      return await axios.post(endpoint, data);
    });
  }
}
```

## 🎯 Step 8: Update Database Operations

```javascript
const { DatabaseErrorHandler } = require('../utils/errors/serviceErrorHandlers');

async function getUserData(userId) {
  return await DatabaseErrorHandler.wrapAsync(async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    return data;
  });
}
```

## 🎯 Step 9: Testing Error Handling

Create a test endpoint to verify error handling:

```javascript
// Add to index.js for testing
if (process.env.NODE_ENV === 'development') {
  router.get('/test/errors/:type', asyncHandler(async (req, res) => {
    const { type } = req.params;
    const { ErrorHandler } = require('./utils/errors/ErrorHandler');
    const errorTypes = require('./utils/errors/errorTypes');
    
    switch (type) {
      case 'auth':
        throw ErrorHandler.create(errorTypes.AUTH_ERRORS.TOKEN_EXPIRED, {
          service: 'Gmail'
        });
      case 'validation':
        throw ErrorHandler.create(errorTypes.VALIDATION_ERRORS.INVALID_EMAIL, {
          input: 'invalid-email'
        });
      case 'rate-limit':
        throw ErrorHandler.create(errorTypes.HTTP_ERRORS.RATE_LIMIT, {
          service: 'GitHub',
          retryAfter: 60
        });
      default:
        throw new Error('Unknown error type');
    }
  }));
}
```

Test with:
```bash
curl http://localhost:3000/test/errors/auth
curl http://localhost:3000/test/errors/validation
curl http://localhost:3000/test/errors/rate-limit
```

## 🎯 Step 10: Monitoring and Logging

Add error monitoring:

```javascript
// utils/errors/errorMonitoring.js
const { ErrorHandler } = require('./ErrorHandler');

class ErrorMonitor {
  constructor() {
    this.errors = [];
    this.errorCounts = new Map();
  }
  
  track(error) {
    this.errors.push({
      code: error.code,
      message: error.message,
      timestamp: new Date(),
      context: error.context
    });
    
    const count = this.errorCounts.get(error.code) || 0;
    this.errorCounts.set(error.code, count + 1);
    
    // Alert if error occurs too frequently
    if (count > 10) {
      console.error(`[ErrorMonitor] High frequency error: ${error.code} (${count} occurrences)`);
    }
  }
  
  getStats() {
    return {
      totalErrors: this.errors.length,
      errorsByCode: Object.fromEntries(this.errorCounts),
      recentErrors: this.errors.slice(-10)
    };
  }
}

const monitor = new ErrorMonitor();

// Override ErrorHandler.log to include monitoring
const originalLog = ErrorHandler.log;
ErrorHandler.log = function(error) {
  originalLog.call(this, error);
  monitor.track(error);
};

module.exports = monitor;
```

## ✅ Checklist

- [ ] Add error middleware to Express app
- [ ] Update all routes to use `asyncHandler`
- [ ] Add authentication middleware to protected routes
- [ ] Update service files with error handlers
- [ ] Add input validation to all endpoints
- [ ] Implement retry logic for external APIs
- [ ] Add circuit breakers for frequently failing services
- [ ] Update BaseAgent with error handling
- [ ] Test error responses
- [ ] Set up error monitoring

## 🚀 Quick Migration Script

Run this to find files that need updating:

```bash
# Find routes without asyncHandler
grep -r "router\.(get|post|put|delete)" --include="*.js" | grep -v "asyncHandler"

# Find try-catch blocks that need updating
grep -r "catch.*error" --include="*.js" -A 2 | grep "res.status(500)"

# Find service calls without error handling
grep -r "await.*Service\." --include="*.js" | grep -v "wrapAsync"
```

## 📚 Additional Resources

- See `README.md` for detailed API documentation
- Check `errorTypes.js` for all available error codes
- Review `serviceErrorHandlers.js` for service-specific examples
- Test with the examples in the test endpoint
