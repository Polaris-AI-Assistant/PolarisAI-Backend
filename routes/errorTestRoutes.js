/**
 * Error Testing Routes
 * 
 * Test endpoints for validating error handling across the platform.
 * Only available in development mode.
 * 
 * Usage: http://localhost:3000/api/test/errors/:errorType
 */

const express = require('express');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { authenticateToken, rateLimit } = require('../middleware/enhancedAuth');
const { ErrorHandler } = require('../utils/errors/ErrorHandler');
const {
  SYSTEM_ERRORS,
  AUTH_ERRORS,
  VALIDATION_ERRORS,
  HTTP_ERRORS,
  PARSING_ERRORS,
  TRANSFORMATION_ERRORS,
  GMAIL_ERRORS,
  CALENDAR_ERRORS,
  GITHUB_ERRORS,
  SEARCH_ERRORS,
  SCHEDULER_ERRORS,
  FILE_ERRORS,
  UX_ERRORS,
  SAFETY_CHECKS,
  WORKFLOW_ERRORS
} = require('../utils/errors/errorTypes');
const {
  validateEmail,
  validateUrl,
  validateDate,
  validateRequired,
  validateLength
} = require('../utils/errors/validationUtils');
const {
  validateJSON,
  validateTimezone,
  validateCurrency,
  validateFileSize,
  validateScheduleTime,
  validateCronExpression
} = require('../utils/errors/advancedValidation');

const router = express.Router();

// Only enable in development
if (process.env.NODE_ENV !== 'production') {
  
  /**
   * GET /api/test/errors/list
   * List all available error types
   */
  router.get('/list', (req, res) => {
    res.json({
      success: true,
      categories: {
        system: Object.keys(SYSTEM_ERRORS),
        auth: Object.keys(AUTH_ERRORS),
        validation: Object.keys(VALIDATION_ERRORS),
        http: Object.keys(HTTP_ERRORS),
        parsing: Object.keys(PARSING_ERRORS),
        transformation: Object.keys(TRANSFORMATION_ERRORS),
        gmail: Object.keys(GMAIL_ERRORS),
        calendar: Object.keys(CALENDAR_ERRORS),
        github: Object.keys(GITHUB_ERRORS),
        search: Object.keys(SEARCH_ERRORS),
        scheduler: Object.keys(SCHEDULER_ERRORS),
        file: Object.keys(FILE_ERRORS),
        ux: Object.keys(UX_ERRORS),
        safety: Object.keys(SAFETY_CHECKS),
        workflow: Object.keys(WORKFLOW_ERRORS)
      },
      total: Object.keys(SYSTEM_ERRORS).length +
             Object.keys(AUTH_ERRORS).length +
             Object.keys(VALIDATION_ERRORS).length +
             Object.keys(HTTP_ERRORS).length +
             Object.keys(PARSING_ERRORS).length +
             Object.keys(TRANSFORMATION_ERRORS).length +
             Object.keys(GMAIL_ERRORS).length +
             Object.keys(CALENDAR_ERRORS).length +
             Object.keys(GITHUB_ERRORS).length +
             Object.keys(SEARCH_ERRORS).length +
             Object.keys(SCHEDULER_ERRORS).length +
             Object.keys(FILE_ERRORS).length +
             Object.keys(UX_ERRORS).length +
             Object.keys(SAFETY_CHECKS).length +
             Object.keys(WORKFLOW_ERRORS).length
    });
  });

  /**
   * GET /api/test/errors/auth/:type
   * Test authentication errors
   */
  router.get('/auth/:type', asyncHandler(async (req, res) => {
    const { type } = req.params;
    
    switch (type) {
      case 'not-authenticated':
        throw ErrorHandler.create(AUTH_ERRORS.NOT_AUTHENTICATED, {
          service: 'Gmail'
        });
      
      case 'token-expired':
        throw ErrorHandler.create(AUTH_ERRORS.TOKEN_EXPIRED, {
          service: 'Gmail'
        });
      
      case 'insufficient-permissions':
        throw ErrorHandler.create(AUTH_ERRORS.INSUFFICIENT_PERMISSIONS, {
          service: 'Gmail',
          action: 'send emails',
          requiredScopes: 'gmail.send'
        });
      
      case 'revoked-access':
        throw ErrorHandler.create(AUTH_ERRORS.REVOKED_ACCESS, {
          service: 'Gmail'
        });
      
      default:
        res.json({ error: 'Unknown auth error type' });
    }
  }));

  /**
   * POST /api/test/errors/validation
   * Test validation errors
   */
  router.post('/validation', asyncHandler(async (req, res) => {
    const { type, value } = req.body;
    
    switch (type) {
      case 'email':
        validateEmail(value);
        break;
      
      case 'url':
        validateUrl(value);
        break;
      
      case 'date':
        validateDate(value);
        break;
      
      case 'required':
        validateRequired({ field: value }, ['field']);
        break;
      
      case 'length':
        validateLength(value, 'test', 5, 10);
        break;
      
      default:
        res.json({ error: 'Unknown validation type' });
    }
    
    res.json({ success: true, message: 'Validation passed' });
  }));

  /**
   * GET /api/test/errors/http/:status
   * Test HTTP errors
   */
  router.get('/http/:status', asyncHandler(async (req, res) => {
    const { status } = req.params;
    
    const errorMap = {
      '400': HTTP_ERRORS.BAD_REQUEST,
      '401': HTTP_ERRORS.UNAUTHORIZED,
      '403': HTTP_ERRORS.FORBIDDEN,
      '404': HTTP_ERRORS.NOT_FOUND,
      '409': HTTP_ERRORS.CONFLICT,
      '429': HTTP_ERRORS.RATE_LIMIT,
      '500': HTTP_ERRORS.SERVER_ERROR,
      '503': HTTP_ERRORS.SERVICE_UNAVAILABLE
    };
    
    const errorType = errorMap[status];
    if (errorType) {
      throw ErrorHandler.create(errorType, {
        service: 'TestService',
        resource: 'test-resource'
      });
    }
    
    res.json({ error: 'Unknown HTTP status' });
  }));

  /**
   * POST /api/test/errors/parsing
   * Test parsing errors
   */
  router.post('/parsing', asyncHandler(async (req, res) => {
    const { type, value } = req.body;
    
    switch (type) {
      case 'json':
        validateJSON(value, 'TestService');
        break;
      
      case 'date-ambiguous':
        throw ErrorHandler.create(PARSING_ERRORS.DATE_PARSE_ERROR, {
          input: value,
          interpretation1: 'January 2, 2025',
          interpretation2: 'February 1, 2025'
        });
      
      case 'csv':
        throw ErrorHandler.create(PARSING_ERRORS.CSV_PARSE_ERROR, {
          lineNumber: 5,
          error: 'Missing closing quote'
        });
      
      default:
        res.json({ error: 'Unknown parsing type' });
    }
    
    res.json({ success: true, message: 'Parsing successful' });
  }));

  /**
   * POST /api/test/errors/transformation
   * Test transformation errors
   */
  router.post('/transformation', asyncHandler(async (req, res) => {
    const { type, value } = req.body;
    
    switch (type) {
      case 'timezone':
        validateTimezone(value);
        break;
      
      case 'currency':
        validateCurrency(value);
        break;
      
      case 'type-conversion':
        throw ErrorHandler.create(TRANSFORMATION_ERRORS.TYPE_CONVERSION_FAILED, {
          value,
          targetType: 'number',
          expectedFormat: 'numeric value'
        });
      
      default:
        res.json({ error: 'Unknown transformation type' });
    }
    
    res.json({ success: true, message: 'Transformation successful' });
  }));

  /**
   * GET /api/test/errors/gmail/:type
   * Test Gmail-specific errors
   */
  router.get('/gmail/:type', asyncHandler(async (req, res) => {
    const { type } = req.params;
    
    switch (type) {
      case 'recipient-not-found':
        throw ErrorHandler.create(GMAIL_ERRORS.RECIPIENT_NOT_FOUND, {
          email: 'invalid@example.com'
        });
      
      case 'attachment-too-large':
        throw ErrorHandler.create(GMAIL_ERRORS.ATTACHMENT_TOO_LARGE, {
          size: '30MB'
        });
      
      case 'draft-not-found':
        throw ErrorHandler.create(GMAIL_ERRORS.DRAFT_NOT_FOUND, {});
      
      case 'label-conflict':
        throw ErrorHandler.create(GMAIL_ERRORS.LABEL_CONFLICT, {
          labelName: 'Important'
        });
      
      default:
        res.json({ error: 'Unknown Gmail error type' });
    }
  }));

  /**
   * GET /api/test/errors/calendar/:type
   * Test Calendar-specific errors
   */
  router.get('/calendar/:type', asyncHandler(async (req, res) => {
    const { type } = req.params;
    
    switch (type) {
      case 'event-conflict':
        throw ErrorHandler.create(CALENDAR_ERRORS.EVENT_CONFLICT, {
          existingEvent: 'Team Meeting'
        });
      
      case 'past-event':
        throw ErrorHandler.create(CALENDAR_ERRORS.PAST_EVENT_CREATION, {
          futureOption1: 'Tomorrow at 10 AM',
          futureOption2: 'Next week at 10 AM'
        });
      
      case 'attendee-limit':
        throw ErrorHandler.create(CALENDAR_ERRORS.ATTENDEE_LIMIT_EXCEEDED, {
          count: 250
        });
      
      default:
        res.json({ error: 'Unknown Calendar error type' });
    }
  }));

  /**
   * GET /api/test/errors/github/:type
   * Test GitHub-specific errors
   */
  router.get('/github/:type', asyncHandler(async (req, res) => {
    const { type } = req.params;
    
    switch (type) {
      case 'repo-not-found':
        throw ErrorHandler.create(GITHUB_ERRORS.REPO_NOT_FOUND, {
          owner: 'testuser',
          repo: 'nonexistent'
        });
      
      case 'protected-branch':
        throw ErrorHandler.create(GITHUB_ERRORS.PROTECTED_BRANCH, {
          branchName: 'main'
        });
      
      case 'file-size-limit':
        throw ErrorHandler.create(GITHUB_ERRORS.FILE_SIZE_LIMIT, {
          size: '150MB'
        });
      
      default:
        res.json({ error: 'Unknown GitHub error type' });
    }
  }));

  /**
   * POST /api/test/errors/scheduler
   * Test scheduler errors
   */
  router.post('/scheduler', asyncHandler(async (req, res) => {
    const { type, value } = req.body;
    
    switch (type) {
      case 'past-time':
        throw ErrorHandler.create(SCHEDULER_ERRORS.PAST_SCHEDULE_TIME, {
          nextOccurrence: 'Tomorrow at 10 AM'
        });
      
      case 'too-far':
        throw ErrorHandler.create(SCHEDULER_ERRORS.SCHEDULE_TOO_FAR, {
          daysAway: 45
        });
      
      case 'too-soon':
        throw ErrorHandler.create(SCHEDULER_ERRORS.SCHEDULE_TOO_SOON, {
          minTime: new Date(Date.now() + 4 * 60000).toLocaleString()
        });
      
      case 'invalid-cron':
        validateCronExpression(value);
        break;
      
      default:
        res.json({ error: 'Unknown scheduler error type' });
    }
    
    res.json({ success: true, message: 'Schedule validation passed' });
  }));

  /**
   * POST /api/test/errors/file
   * Test file errors
   */
  router.post('/file', asyncHandler(async (req, res) => {
    const { type, size, filename } = req.body;
    
    switch (type) {
      case 'too-large':
        validateFileSize(size || 60000000, 50000000, filename);
        break;
      
      case 'unsupported-type':
        throw ErrorHandler.create(FILE_ERRORS.UNSUPPORTED_FILE_TYPE, {
          fileType: 'exe',
          supportedFormats: 'pdf, doc, txt, jpg, png'
        });
      
      case 'corrupted':
        throw ErrorHandler.create(FILE_ERRORS.CORRUPTED_FILE, {});
      
      case 'virus':
        throw ErrorHandler.create(FILE_ERRORS.VIRUS_DETECTED, {});
      
      default:
        res.json({ error: 'Unknown file error type' });
    }
    
    res.json({ success: true, message: 'File validation passed' });
  }));

  /**
   * GET /api/test/errors/ux/:type
   * Test UX errors
   */
  router.get('/ux/:type', asyncHandler(async (req, res) => {
    const { type } = req.params;
    
    switch (type) {
      case 'ambiguous-reference':
        throw ErrorHandler.create(UX_ERRORS.AMBIGUOUS_REFERENCE, {
          reference: 'it',
          option1: 'The email you just mentioned',
          option2: 'The document from earlier'
        });
      
      case 'missing-context':
        throw ErrorHandler.create(UX_ERRORS.MISSING_CONTEXT, {
          request: 'send it'
        });
      
      case 'contradictory':
        throw ErrorHandler.create(UX_ERRORS.CONTRADICTORY_INSTRUCTIONS, {
          action1: 'delete the file',
          action2: 'save the file'
        });
      
      default:
        res.json({ error: 'Unknown UX error type' });
    }
  }));

  /**
   * GET /api/test/errors/safety/:type
   * Test safety checks
   */
  router.get('/safety/:type', asyncHandler(async (req, res) => {
    const { type } = req.params;
    
    switch (type) {
      case 'destructive':
        throw ErrorHandler.create(SAFETY_CHECKS.DESTRUCTIVE_ACTION, {
          action: 'delete all emails'
        });
      
      case 'bulk-operation':
        throw ErrorHandler.create(SAFETY_CHECKS.BULK_OPERATION_WARNING, {
          count: 150
        });
      
      case 'sensitive-data':
        throw ErrorHandler.create(SAFETY_CHECKS.SENSITIVE_DATA_EXPOSURE, {
          dataType: 'financial data',
          recipient: 'external@example.com'
        });
      
      default:
        res.json({ error: 'Unknown safety check type' });
    }
  }));

  /**
   * GET /api/test/errors/workflow/:type
   * Test workflow errors
   */
  router.get('/workflow/:type', asyncHandler(async (req, res) => {
    const { type } = req.params;
    
    switch (type) {
      case 'dependency-failed':
        throw ErrorHandler.create(WORKFLOW_ERRORS.DEPENDENCY_FAILED, {
          step1Action: 'fetch data',
          step2Action: 'process data'
        });
      
      case 'partial-success':
        throw ErrorHandler.create(WORKFLOW_ERRORS.PARTIAL_SUCCESS, {
          successfulSteps: 'step1, step3',
          failedSteps: 'step2'
        });
      
      case 'timeout':
        throw ErrorHandler.create(WORKFLOW_ERRORS.TIMEOUT_WORKFLOW, {
          elapsed: '5 minutes'
        });
      
      default:
        res.json({ error: 'Unknown workflow error type' });
    }
  }));

  /**
   * GET /api/test/errors/rate-limit
   * Test rate limiting (requires auth)
   */
  router.get('/rate-limit',
    authenticateToken,
    rateLimit(5, 10000), // 5 requests per 10 seconds
    asyncHandler(async (req, res) => {
      res.json({
        success: true,
        message: 'Request successful',
        tip: 'Make 6 requests within 10 seconds to trigger rate limit'
      });
    })
  );

  console.log('✅ Error test routes enabled (development mode)');
}

module.exports = router;
