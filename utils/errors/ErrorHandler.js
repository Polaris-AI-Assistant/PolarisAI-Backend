/**
 * Centralized Error Handler
 * 
 * Provides error creation, formatting, and handling utilities.
 * Converts technical errors into user-friendly messages.
 */

const errorTypes = require('./errorTypes');

class PolarisError extends Error {
  constructor(errorType, context = {}) {
    super(errorType.message);
    
    this.name = 'PolarisError';
    this.code = errorType.code;
    this.httpStatus = errorType.httpStatus || 500;
    this.retryable = errorType.retryable || false;
    this.action = errorType.action;
    this.retryStrategy = errorType.retryStrategy;
    this.context = context;
    
    // Generate user-friendly message with context substitution
    this.userMessage = this.formatUserMessage(errorType.userMessage, context);
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }
  
  /**
   * Format user message with context variables
   */
  formatUserMessage(template, context) {
    if (!template) return this.message;
    
    let formatted = template;
    
    // Replace {variable} with context values
    Object.keys(context).forEach(key => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      formatted = formatted.replace(regex, context[key]);
    });
    
    return formatted;
  }
  
  /**
   * Convert to JSON response format
   */
  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.userMessage,
        technical: process.env.NODE_ENV === 'development' ? this.message : undefined,
        retryable: this.retryable,
        action: this.action,
        context: process.env.NODE_ENV === 'development' ? this.context : undefined
      },
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Error Handler Utilities
 */
class ErrorHandler {
  /**
   * Create a PolarisError from error type
   */
  static create(errorType, context = {}) {
    return new PolarisError(errorType, context);
  }
  
  /**
   * Handle HTTP errors from external APIs
   */
  static handleHttpError(error, serviceName = 'service') {
    const status = error.response?.status;
    const context = {
      service: serviceName,
      action: error.config?.method || 'request',
      resource: error.config?.url || 'resource'
    };
    
    switch (status) {
      case 400:
        return new PolarisError(errorTypes.HTTP_ERRORS.BAD_REQUEST, context);
      case 401:
        return new PolarisError(errorTypes.HTTP_ERRORS.UNAUTHORIZED, context);
      case 403:
        return new PolarisError(errorTypes.HTTP_ERRORS.FORBIDDEN, context);
      case 404:
        return new PolarisError(errorTypes.HTTP_ERRORS.NOT_FOUND, context);
      case 409:
        return new PolarisError(errorTypes.HTTP_ERRORS.CONFLICT, context);
      case 429:
        const retryAfter = error.response?.headers['retry-after'] || 60;
        return new PolarisError(errorTypes.HTTP_ERRORS.RATE_LIMIT, { 
          ...context, 
          retryAfter 
        });
      case 500:
        return new PolarisError(errorTypes.HTTP_ERRORS.SERVER_ERROR, context);
      case 502:
        return new PolarisError(errorTypes.HTTP_ERRORS.BAD_GATEWAY, context);
      case 503:
        return new PolarisError(errorTypes.HTTP_ERRORS.SERVICE_UNAVAILABLE, context);
      case 504:
        return new PolarisError(errorTypes.HTTP_ERRORS.GATEWAY_TIMEOUT, context);
      default:
        return new PolarisError(errorTypes.SYSTEM_ERRORS.SERVICE_DOWN, context);
    }
  }
  
  /**
   * Handle authentication errors
   */
  static handleAuthError(error, serviceName = 'service') {
    const context = { service: serviceName };
    
    if (error.message?.includes('token not found') || error.message?.includes('not connected')) {
      return new PolarisError(errorTypes.AUTH_ERRORS.NOT_AUTHENTICATED, context);
    }
    
    if (error.message?.includes('expired') || error.message?.includes('invalid_grant')) {
      return new PolarisError(errorTypes.AUTH_ERRORS.TOKEN_EXPIRED, context);
    }
    
    if (error.message?.includes('refresh') || error.message?.includes('reauth')) {
      return new PolarisError(errorTypes.AUTH_ERRORS.TOKEN_REFRESH_FAILED, context);
    }
    
    if (error.message?.includes('permission') || error.message?.includes('scope')) {
      return new PolarisError(errorTypes.AUTH_ERRORS.INSUFFICIENT_PERMISSIONS, context);
    }
    
    if (error.message?.includes('revoked') || error.message?.includes('disconnected')) {
      return new PolarisError(errorTypes.AUTH_ERRORS.REVOKED_ACCESS, context);
    }
    
    return new PolarisError(errorTypes.AUTH_ERRORS.NOT_AUTHENTICATED, context);
  }
  
  /**
   * Handle network errors
   */
  static handleNetworkError(error, serviceName = 'service') {
    const context = { service: serviceName };
    
    if (error.code === 'ECONNREFUSED') {
      return new PolarisError(errorTypes.NETWORK_ERRORS.CONNECTION_REFUSED, context);
    }
    
    if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT') {
      return new PolarisError(errorTypes.NETWORK_ERRORS.NETWORK_TIMEOUT, context);
    }
    
    if (error.code === 'ENOTFOUND') {
      return new PolarisError(errorTypes.NETWORK_ERRORS.DNS_RESOLUTION_FAILED, {
        ...context,
        hostname: error.hostname
      });
    }
    
    if (error.code === 'ECONNRESET') {
      return new PolarisError(errorTypes.NETWORK_ERRORS.CONNECTION_RESET, context);
    }
    
    if (error.message?.includes('certificate') || error.message?.includes('SSL')) {
      return new PolarisError(errorTypes.NETWORK_ERRORS.SSL_CERTIFICATE_ERROR, context);
    }
    
    return new PolarisError(errorTypes.SYSTEM_ERRORS.SERVICE_DOWN, context);
  }
  
  /**
   * Handle validation errors
   */
  static handleValidationError(field, value, errorType) {
    const context = {
      fieldName: field,
      input: value
    };
    
    return new PolarisError(errorType, context);
  }
  
  /**
   * Wrap async functions with error handling
   */
  static async wrapAsync(fn, serviceName = 'service') {
    try {
      return await fn();
    } catch (error) {
      // If already a PolarisError, rethrow
      if (error instanceof PolarisError) {
        throw error;
      }
      
      // Handle different error types
      if (error.response) {
        throw ErrorHandler.handleHttpError(error, serviceName);
      }
      
      if (error.code && error.code.startsWith('E')) {
        throw ErrorHandler.handleNetworkError(error, serviceName);
      }
      
      if (error.message?.includes('token') || error.message?.includes('auth')) {
        throw ErrorHandler.handleAuthError(error, serviceName);
      }
      
      // Generic error
      throw new PolarisError(errorTypes.SYSTEM_ERRORS.SERVICE_DOWN, {
        service: serviceName,
        originalError: error.message
      });
    }
  }
  
  /**
   * Log error with appropriate level
   */
  static log(error) {
    const logData = {
      code: error.code,
      message: error.message,
      userMessage: error.userMessage,
      context: error.context,
      stack: error.stack,
      timestamp: new Date().toISOString()
    };
    
    if (error.httpStatus >= 500) {
      console.error('[ERROR]', JSON.stringify(logData, null, 2));
    } else if (error.httpStatus >= 400) {
      console.warn('[WARNING]', JSON.stringify(logData, null, 2));
    } else {
      console.log('[INFO]', JSON.stringify(logData, null, 2));
    }
  }
}

module.exports = {
  PolarisError,
  ErrorHandler
};
