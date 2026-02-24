# PolarisAI Error Handling System

Comprehensive error handling system for the PolarisAI platform with user-friendly messages, retry logic, and service-specific handlers.

## 📁 File Structure

```
utils/errors/
├── errorTypes.js              # Error type definitions and codes
├── ErrorHandler.js            # Core error handling class
├── validationUtils.js         # Input validation utilities
├── serviceErrorHandlers.js    # Service-specific error handlers
├── retryHandler.js            # Retry logic with exponential backoff
└── README.md                  # This file

middleware/
├── errorMiddleware.js         # Express error middleware
└── enhancedAuth.js           # Enhanced authentication middleware
```

## 🚀 Quick Start

### 1. Basic Error Handling

```javascript
const { ErrorHandler } = require('./utils/errors/ErrorHandler');
const { AUTH_ERRORS } = require('./utils/errors/errorTypes');

// Create and throw an error
throw ErrorHandler.create(AUTH_ERRORS.TOKEN_EXPIRED, {
  service: 'Gmail'
});
```

### 2. Service-Specific Error Handling

```javascript
const { GmailErrorHandler } = require('./utils/errors/serviceErrorHandlers');

// Wrap async functions
const result = await GmailErrorHandler.wrapAsync(async () => {
  return await gmailService.sendEmail(params);
});
```

### 3. Input Validation

```javascript
const { validateEmail, validateRequired } = require('./utils/errors/validationUtils');

// Validate email
const email = validateEmail(userInput); // Throws PolarisError if invalid

// Validate required fields
validateRequired(req.body, ['email', 'password', 'name']);
```

### 4. Retry Logic

```javascript
const { retry, retryWithRateLimit } = require('./utils/errors/retryHandler');

// Retry with exponential backoff
const result = await retry(async () => {
  return await externalApiCall();
}, {
  maxAttempts: 3,
  initialDelay: 1000
});

// Retry with rate limit handling
const data = await retryWithRateLimit(async () => {
  return await githubApi.getRepos();
}, 5);
```

## 📋 Error Types

### System Errors (SYS_*)
- `SYS_001`: Service temporarily unavailable
- `SYS_002`: Request timeout
- `SYS_003`: Dependency failure
- `SYS_004`: Memory limit exceeded
- `SYS_005`: Too many concurrent operations

### Platform Errors (PLT_*)
- `PLT_001`: Agent not found
- `PLT_002`: Agent limit reached
- `PLT_003`: Tool execution failed
- `PLT_004`: Context overflow
- `PLT_005`: Invalid tool parameters

### Authentication Errors (AUTH_*)
- `AUTH_001`: Not authenticated
- `AUTH_002`: Token expired
- `AUTH_003`: Token refresh failed
- `AUTH_004`: Insufficient permissions
- `AUTH_005`: Account suspended
- `AUTH_007`: Access revoked

### Validation Errors (VAL_*)
- `VAL_001`: Invalid email
- `VAL_002`: Invalid URL
- `VAL_004`: Invalid date
- `VAL_005`: Invalid time
- `CNT_001`: Empty required field
- `CNT_005`: Excessive length

### HTTP Errors (HTTP_*)
- `HTTP_400`: Bad request
- `HTTP_401`: Unauthorized
- `HTTP_403`: Forbidden
- `HTTP_404`: Not found
- `HTTP_429`: Rate limit exceeded
- `HTTP_500`: Server error
- `HTTP_503`: Service unavailable

### Network Errors (NET_*)
- `NET_001`: Connection refused
- `NET_002`: DNS resolution failed
- `NET_003`: SSL certificate error
- `NET_004`: Network timeout
- `NET_005`: Connection reset

## 🔧 Usage Examples

### Express Route with Error Handling

```javascript
const { asyncHandler } = require('./middleware/errorMiddleware');
const { validateRequired } = require('./utils/errors/validationUtils');
const { GmailErrorHandler } = require('./utils/errors/serviceErrorHandlers');

router.post('/send-email', asyncHandler(async (req, res) => {
  // Validate input
  validateRequired(req.body, ['to', 'subject', 'body']);
  
  // Send email with error handling
  const result = await GmailErrorHandler.wrapAsync(async () => {
    return await gmailService.sendEmail(req.user.id, req.body);
  });
  
  res.json({ success: true, data: result });
}));
```

### Agent with Error Handling

```javascript
const { ErrorHandler } = require('./utils/errors/ErrorHandler');
const { PLATFORM_ERRORS } = require('./utils/errors/errorTypes');
const { retry } = require('./utils/errors/retryHandler');

class MyAgent {
  async processQuery(query, userId) {
    try {
      // Validate query
      if (!query || query.trim().length === 0) {
        throw ErrorHandler.create(PLATFORM_ERRORS.INVALID_TOOL_PARAMETERS, {
          missingParameter: 'query'
        });
      }
      
      // Execute with retry
      const result = await retry(async () => {
        return await this.executeTools(query, userId);
      });
      
      return result;
    } catch (error) {
      ErrorHandler.log(error);
      throw error;
    }
  }
}
```

### Service with Circuit Breaker

```javascript
const { CircuitBreaker } = require('./utils/errors/retryHandler');

class ExternalService {
  constructor() {
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 60000
    });
  }
  
  async makeRequest(params) {
    return await this.circuitBreaker.execute(async () => {
      return await axios.post(this.apiUrl, params);
    });
  }
}
```

## 🎯 Best Practices

1. **Always use service-specific handlers** for external APIs (Gmail, GitHub, etc.)
2. **Validate input early** using validation utilities
3. **Wrap async operations** with retry logic for network calls
4. **Use asyncHandler** for all Express routes
5. **Log errors** using ErrorHandler.log() for monitoring
6. **Provide context** when creating errors for better debugging
7. **Use circuit breakers** for frequently failing services

## 🔄 Retry Strategies

### Exponential Backoff
```javascript
const result = await retry(fn, {
  maxAttempts: 3,
  initialDelay: 1000,
  backoffMultiplier: 2
});
// Delays: 1s, 2s, 4s
```

### Custom Backoff
```javascript
const result = await retryWithBackoff(fn, [1000, 5000, 10000]);
// Delays: 1s, 5s, 10s
```

### Rate Limit Handling
```javascript
const result = await retryWithRateLimit(fn, 5);
// Automatically handles 429 responses
```

## 🛡️ Authentication Middleware

### Basic Authentication
```javascript
router.get('/protected', authenticateToken, async (req, res) => {
  // req.user is available
});
```

### Service Connection Required
```javascript
const { requireServiceConnection } = require('./middleware/enhancedAuth');

router.post('/gmail/send', 
  authenticateToken,
  requireServiceConnection('Gmail', 'gmail_tokens'),
  async (req, res) => {
    // req.serviceConnection is available
  }
);
```

### Rate Limiting
```javascript
const { rateLimit } = require('./middleware/enhancedAuth');

router.post('/api/query',
  authenticateToken,
  rateLimit(100, 60000), // 100 requests per minute
  async (req, res) => {
    // Handle request
  }
);
```

## 📊 Error Response Format

All errors return a consistent JSON format:

```json
{
  "success": false,
  "error": {
    "code": "AUTH_002",
    "message": "Your Gmail connection has expired. I'll refresh it automatically...",
    "technical": "Token expired", // Only in development
    "retryable": true,
    "action": "silent_token_refresh",
    "context": { // Only in development
      "service": "Gmail"
    }
  },
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

## 🔍 Debugging

Enable detailed error logging in development:

```bash
NODE_ENV=development
```

This will include:
- Technical error messages
- Stack traces
- Error context
- Original error details

## 📝 Adding New Error Types

1. Add error definition to `errorTypes.js`:
```javascript
NEW_ERROR: {
  code: 'CAT_001',
  message: 'Technical message',
  userMessage: 'User-friendly message with {variable}',
  httpStatus: 400,
  retryable: false
}
```

2. Use in your code:
```javascript
throw ErrorHandler.create(NEW_ERROR, { variable: 'value' });
```

## 🤝 Contributing

When adding new services or features:
1. Create service-specific error handler in `serviceErrorHandlers.js`
2. Add relevant error types to `errorTypes.js`
3. Use `asyncHandler` for all Express routes
4. Add validation for user inputs
5. Implement retry logic for external API calls
