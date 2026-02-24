/**
 * Express Error Handling Middleware
 * 
 * Centralized error handling for all Express routes.
 * Catches errors, formats them, and sends appropriate responses.
 */

const { PolarisError, ErrorHandler } = require('../utils/errors/ErrorHandler');

/**
 * Global error handler middleware
 * Must be registered AFTER all routes
 */
function errorMiddleware(err, req, res, next) {
  // Log the error
  ErrorHandler.log(err);
  
  // If it's already a PolarisError, use it directly
  if (err instanceof PolarisError) {
    return res.status(err.httpStatus).json(err.toJSON());
  }
  
  // Handle specific error types
  let polarisError;
  
  // Axios/HTTP errors
  if (err.response) {
    polarisError = ErrorHandler.handleHttpError(err, req.path);
  }
  // Network errors
  else if (err.code && err.code.startsWith('E')) {
    polarisError = ErrorHandler.handleNetworkError(err, req.path);
  }
  // Authentication errors
  else if (err.message?.includes('token') || err.message?.includes('auth')) {
    polarisError = ErrorHandler.handleAuthError(err, req.path);
  }
  // Generic errors
  else {
    polarisError = new PolarisError({
      code: 'INTERNAL_ERROR',
      message: err.message || 'Internal server error',
      userMessage: process.env.NODE_ENV === 'development' 
        ? err.message 
        : 'Something went wrong. Please try again.',
      httpStatus: err.status || 500,
      retryable: false
    });
  }
  
  res.status(polarisError.httpStatus).json(polarisError.toJSON());
}

/**
 * 404 Not Found handler
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`,
      availableRoutes: '/api for documentation'
    },
    timestamp: new Date().toISOString()
  });
}

/**
 * Async route wrapper
 * Wraps async route handlers to catch errors automatically
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Validation error handler
 * Formats validation errors consistently
 */
function validationErrorHandler(errors) {
  return {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: errors,
      retryable: false
    },
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  errorMiddleware,
  notFoundHandler,
  asyncHandler,
  validationErrorHandler
};
