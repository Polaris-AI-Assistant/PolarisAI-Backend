# Error Handling Migration Checklist

Complete checklist for migrating your PolarisAI platform to use the new error handling system.

## ✅ Phase 1: Core Setup (Required)

### 1.1 Install Error Handling System
- [x] Created `utils/errors/errorTypes.js`
- [x] Created `utils/errors/ErrorHandler.js`
- [x] Created `utils/errors/validationUtils.js`
- [x] Created `utils/errors/serviceErrorHandlers.js`
- [x] Created `utils/errors/retryHandler.js`
- [x] Created `middleware/errorMiddleware.js`
- [x] Created `middleware/enhancedAuth.js`

### 1.2 Update Main Server File (index.js)
- [ ] Import error middleware
- [ ] Add `notFoundHandler` before error middleware
- [ ] Add `errorMiddleware` as last middleware
- [ ] Test that errors are caught and formatted correctly

```javascript
// Add to index.js
const { errorMiddleware, notFoundHandler } = require('./middleware/errorMiddleware');

// ... all your routes ...

// Add these BEFORE server.listen()
app.use(notFoundHandler);
app.use(errorMiddleware);
```

## ✅ Phase 2: Update Routes (High Priority)

### 2.1 Authentication Routes (auth/auth.js)
- [ ] Replace try-catch with `asyncHandler`
- [ ] Add input validation using `validateEmail`, `validateRequired`, etc.
- [ ] Use `ErrorHandler.create()` for auth errors
- [ ] Test signup, login, OTP flows

### 2.2 Agent Controllers
- [ ] Gmail Agent Controller (`gmail/gmailAgentController.js`)
- [ ] Calendar Agent Controller (`calendar/calendarAgentController.js`)
- [ ] GitHub Agent Controller (`github/githubAgentController.js`)
- [ ] Docs Agent Controller (`docs/docsAgentController.js`)
- [ ] Web Search Agent Controller (`websearch/webSearchAgentController.js`)
- [ ] Schedules Agent Controller (`schedules/schedulesAgentController.js`)
- [ ] Forms Agent Controller (`forms/formsAgentController.js`)
- [ ] Flights Agent Controller (`flights/flightsAgentController.js`)

For each controller:
- [ ] Add `asyncHandler` to all routes
- [ ] Add `authenticateToken` middleware
- [ ] Add `rateLimit` middleware
- [ ] Add input validation
- [ ] Replace generic error responses with service-specific handlers

### 2.3 Service Connection Routes
- [ ] Gmail Auth (`gmail/agentConnect.js`)
- [ ] Calendar Auth (`calendar/calendarAuth.js`)
- [ ] GitHub Auth (`github/connectGithub.js`)
- [ ] Docs Auth (`docs/docsAuth.js`)
- [ ] Forms Auth (`forms/formsAuth.js`)

For each:
- [ ] Use `asyncHandler`
- [ ] Add proper error handling for OAuth flows
- [ ] Handle token refresh failures

## ✅ Phase 3: Update Services (Medium Priority)

### 3.1 Gmail Service (`gmail/gmailService.js`)
- [ ] Wrap functions with `GmailErrorHandler.wrapAsync()`
- [ ] Add input validation
- [ ] Add retry logic for API calls
- [ ] Test email sending, reading, searching

### 3.2 Calendar Service (`calendar/calendarService.js`)
- [ ] Wrap functions with `CalendarErrorHandler.wrapAsync()`
- [ ] Add date/time validation
- [ ] Add retry logic
- [ ] Test event creation, updates, deletion

### 3.3 GitHub Service (`github/githubFunctions.js`)
- [ ] Wrap functions with `GitHubErrorHandler.wrapAsync()`
- [ ] Add retry logic with rate limit handling
- [ ] Test repository operations

### 3.4 Docs Service (`docs/docsService.js`)
- [ ] Wrap functions with `DocsErrorHandler.wrapAsync()`
- [ ] Add validation
- [ ] Test document operations

### 3.5 Web Search Service (`websearch/webSearchService.js`)
- [ ] Wrap functions with `WebSearchErrorHandler.wrapAsync()`
- [ ] Add retry logic
- [ ] Test search operations

### 3.6 Schedule Engine (`schedules/scheduleEngine.js`)
- [ ] Add error handling for schedule execution
- [ ] Add retry logic for failed schedules
- [ ] Test schedule processing

## ✅ Phase 4: Update Base Classes (Medium Priority)

### 4.1 BaseAgent (`base/BaseAgent.js`)
- [ ] Add error handling to `processQuery()`
- [ ] Add error handling to `executeToolCall()`
- [ ] Add retry logic for tool execution
- [ ] Add validation for tool parameters
- [ ] Test with multiple agents

### 4.2 Multi-Step Agents
- [ ] Gmail Multi-Step (`gmail/gmailAgentMultiStep.js`)
- [ ] Calendar Multi-Step (`calendar/calendarAgentMultiStep.js`)
- [ ] GitHub Multi-Step (`github/githubAgentMultiStep.js`)
- [ ] Docs Multi-Step (`docs/docsAgentMultiStep.js`)
- [ ] Web Search Multi-Step (`websearch/webSearchAgentMultiStep.js`)
- [ ] Schedules Multi-Step (`schedules/schedulesAgentMultiStep.js`)

## ✅ Phase 5: Database Operations (Low Priority)

### 5.1 Data Access Files
- [ ] Chat Data (`chat/chatData.js`)
- [ ] Gmail Data (`gmail/gmailData.js`)
- [ ] Calendar Data (`calendar/calendarData.js`)
- [ ] Docs Data (`docs/docsData.js`)
- [ ] Forms Data (`forms/formsData.js`)
- [ ] Files Data (`files/filesData.js`)

For each:
- [ ] Wrap Supabase calls with `DatabaseErrorHandler.wrapAsync()`
- [ ] Handle not found errors
- [ ] Handle duplicate key errors
- [ ] Handle foreign key violations

## ✅ Phase 6: Utility Files (Low Priority)

### 6.1 Redis Client (`utils/redisClient.js`)
- [ ] Add error handling for connection failures
- [ ] Add retry logic for operations
- [ ] Add circuit breaker

### 6.2 File Processing (`files/fileProcessing.js`)
- [ ] Add validation for file types
- [ ] Add error handling for file operations
- [ ] Add size limit validation

### 6.3 Email Service (`schedules/emailService.js`)
- [ ] Add retry logic for email sending
- [ ] Add validation for email addresses
- [ ] Handle SMTP errors

## ✅ Phase 7: Testing

### 7.1 Unit Tests
- [ ] Test error creation and formatting
- [ ] Test validation functions
- [ ] Test retry logic
- [ ] Test circuit breaker

### 7.2 Integration Tests
- [ ] Test authentication flows with errors
- [ ] Test agent queries with errors
- [ ] Test service operations with errors
- [ ] Test rate limiting

### 7.3 Error Scenarios
- [ ] Test expired tokens
- [ ] Test missing tokens
- [ ] Test invalid input
- [ ] Test service unavailability
- [ ] Test rate limiting
- [ ] Test network errors
- [ ] Test database errors

## ✅ Phase 8: Monitoring & Logging

### 8.1 Error Monitoring
- [ ] Set up error tracking (Sentry, LogRocket, etc.)
- [ ] Create error dashboard
- [ ] Set up alerts for high-frequency errors
- [ ] Monitor error rates by service

### 8.2 Logging
- [ ] Ensure all errors are logged with context
- [ ] Add structured logging
- [ ] Set up log aggregation
- [ ] Create log analysis queries

## ✅ Phase 9: Documentation

### 9.1 Developer Documentation
- [ ] Document error codes
- [ ] Document error handling patterns
- [ ] Create migration guide for new developers
- [ ] Add examples to README

### 9.2 API Documentation
- [ ] Update API docs with error responses
- [ ] Document rate limits
- [ ] Document retry behavior
- [ ] Add error handling examples

## ✅ Phase 10: Deployment

### 10.1 Pre-Deployment
- [ ] Run all tests
- [ ] Test in staging environment
- [ ] Review error logs
- [ ] Verify monitoring is working

### 10.2 Deployment
- [ ] Deploy to production
- [ ] Monitor error rates
- [ ] Check for new error patterns
- [ ] Verify user experience

### 10.3 Post-Deployment
- [ ] Monitor for 24 hours
- [ ] Review error logs
- [ ] Gather user feedback
- [ ] Fix any issues

## 📊 Progress Tracking

### Overall Progress
- Core Setup: 100% ✅
- Routes: 0%
- Services: 0%
- Base Classes: 0%
- Database: 0%
- Utilities: 0%
- Testing: 0%
- Monitoring: 0%
- Documentation: 50%
- Deployment: 0%

### Priority Order
1. **Phase 1** (Core Setup) - COMPLETED ✅
2. **Phase 2.1** (Authentication Routes) - HIGH PRIORITY
3. **Phase 2.2** (Agent Controllers) - HIGH PRIORITY
4. **Phase 3** (Services) - MEDIUM PRIORITY
5. **Phase 4** (Base Classes) - MEDIUM PRIORITY
6. **Phase 7** (Testing) - HIGH PRIORITY
7. **Phase 5** (Database) - LOW PRIORITY
8. **Phase 6** (Utilities) - LOW PRIORITY
9. **Phase 8** (Monitoring) - MEDIUM PRIORITY
10. **Phase 9** (Documentation) - LOW PRIORITY
11. **Phase 10** (Deployment) - FINAL STEP

## 🚀 Quick Start Commands

### Find files that need updating:
```bash
# Find routes without asyncHandler
grep -r "router\.(get|post|put|delete)" --include="*.js" PolarisAI-Backend/ | grep -v "asyncHandler" | grep -v "node_modules"

# Find try-catch blocks
grep -r "catch.*error" --include="*.js" PolarisAI-Backend/ | grep -v "node_modules"

# Find service calls without error handling
grep -r "await.*Service\." --include="*.js" PolarisAI-Backend/ | grep -v "wrapAsync" | grep -v "node_modules"
```

### Test error handling:
```bash
# Test authentication error
curl -X POST http://localhost:3000/api/gmail/agent/query \
  -H "Content-Type: application/json" \
  -d '{"query": "test"}'

# Test validation error
curl -X POST http://localhost:3000/api/gmail/agent/query \
  -H "Authorization: Bearer valid-token" \
  -H "Content-Type: application/json" \
  -d '{"query": ""}'
```

## 📝 Notes

- Start with high-priority items (authentication and agent controllers)
- Test each phase before moving to the next
- Keep the old error handling code until migration is complete
- Monitor error rates during migration
- Roll back if error rates increase significantly
- Document any issues or edge cases discovered during migration
