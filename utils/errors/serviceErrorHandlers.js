/**
 * Service-Specific Error Handlers
 * 
 * Specialized error handling for different services (Gmail, Calendar, GitHub, etc.)
 */

const { ErrorHandler } = require('./ErrorHandler');
const { AUTH_ERRORS, HTTP_ERRORS, PERMISSION_ERRORS } = require('./errorTypes');

/**
 * Gmail Service Error Handler
 */
class GmailErrorHandler {
  static handle(error) {
    const serviceName = 'Gmail';
    
    // Token/Auth errors
    if (error.message?.includes('token not found') || 
        error.message?.includes('connect Google')) {
      return ErrorHandler.handleAuthError(error, serviceName);
    }
    
    // Insufficient permissions
    if (error.code === 403 || error.message?.includes('permission')) {
      return ErrorHandler.create(PERMISSION_ERRORS.READ_ONLY_ACCESS, {
        service: serviceName,
        resource: 'Gmail',
        action: 'send emails or modify messages'
      });
    }
    
    // Rate limiting
    if (error.code === 429 || error.message?.includes('rate limit')) {
      return ErrorHandler.create(HTTP_ERRORS.RATE_LIMIT, {
        service: serviceName,
        retryAfter: 60
      });
    }
    
    // HTTP errors
    if (error.response) {
      return ErrorHandler.handleHttpError(error, serviceName);
    }
    
    // Generic Gmail error
    return ErrorHandler.handleNetworkError(error, serviceName);
  }
  
  static async wrapAsync(fn) {
    try {
      return await fn();
    } catch (error) {
      throw GmailErrorHandler.handle(error);
    }
  }
}

/**
 * Calendar Service Error Handler
 */
class CalendarErrorHandler {
  static handle(error) {
    const serviceName = 'Google Calendar';
    
    // Token/Auth errors
    if (error.message?.includes('token not found') || 
        error.message?.includes('connect Google Calendar')) {
      return ErrorHandler.handleAuthError(error, serviceName);
    }
    
    // Event not found
    if (error.code === 404 || error.message?.includes('not found')) {
      return ErrorHandler.create(HTTP_ERRORS.NOT_FOUND, {
        service: serviceName,
        resource: 'calendar event'
      });
    }
    
    // Conflict (duplicate event)
    if (error.code === 409 || error.message?.includes('conflict')) {
      return ErrorHandler.create(HTTP_ERRORS.CONFLICT, {
        service: serviceName,
        resource: 'calendar event',
        conflictReason: 'An event with similar details already exists'
      });
    }
    
    // HTTP errors
    if (error.response) {
      return ErrorHandler.handleHttpError(error, serviceName);
    }
    
    return ErrorHandler.handleNetworkError(error, serviceName);
  }
  
  static async wrapAsync(fn) {
    try {
      return await fn();
    } catch (error) {
      throw CalendarErrorHandler.handle(error);
    }
  }
}

/**
 * GitHub Service Error Handler
 */
class GitHubErrorHandler {
  static handle(error) {
    const serviceName = 'GitHub';
    
    // Token errors
    if (error.message?.includes('GitHub token') || 
        error.message?.includes('token not found')) {
      return ErrorHandler.handleAuthError(error, serviceName);
    }
    
    // Repository not found
    if (error.response?.status === 404) {
      return ErrorHandler.create(HTTP_ERRORS.NOT_FOUND, {
        service: serviceName,
        resource: 'repository or resource'
      });
    }
    
    // Rate limiting (GitHub has strict limits)
    if (error.response?.status === 403 && 
        error.response?.headers['x-ratelimit-remaining'] === '0') {
      const resetTime = error.response?.headers['x-ratelimit-reset'];
      const retryAfter = resetTime 
        ? Math.ceil((resetTime * 1000 - Date.now()) / 1000) 
        : 3600;
      
      return ErrorHandler.create(HTTP_ERRORS.RATE_LIMIT, {
        service: serviceName,
        retryAfter
      });
    }
    
    // Permission errors
    if (error.response?.status === 403) {
      return ErrorHandler.create(PERMISSION_ERRORS.RESOURCE_ACCESS_DENIED, {
        service: serviceName,
        resource: 'repository'
      });
    }
    
    // HTTP errors
    if (error.response) {
      return ErrorHandler.handleHttpError(error, serviceName);
    }
    
    return ErrorHandler.handleNetworkError(error, serviceName);
  }
  
  static async wrapAsync(fn) {
    try {
      return await fn();
    } catch (error) {
      throw GitHubErrorHandler.handle(error);
    }
  }
}

/**
 * Docs Service Error Handler
 */
class DocsErrorHandler {
  static handle(error) {
    const serviceName = 'Google Docs';
    
    // Token/Auth errors
    if (error.message?.includes('token not found') || 
        error.message?.includes('connect Google')) {
      return ErrorHandler.handleAuthError(error, serviceName);
    }
    
    // Document not found or no access
    if (error.code === 404 || error.message?.includes('not found')) {
      return ErrorHandler.create(HTTP_ERRORS.NOT_FOUND, {
        service: serviceName,
        resource: 'document'
      });
    }
    
    // Permission errors
    if (error.code === 403) {
      return ErrorHandler.create(PERMISSION_ERRORS.RESOURCE_ACCESS_DENIED, {
        service: serviceName,
        resource: 'document'
      });
    }
    
    // HTTP errors
    if (error.response) {
      return ErrorHandler.handleHttpError(error, serviceName);
    }
    
    return ErrorHandler.handleNetworkError(error, serviceName);
  }
  
  static async wrapAsync(fn) {
    try {
      return await fn();
    } catch (error) {
      throw DocsErrorHandler.handle(error);
    }
  }
}

/**
 * Web Search Service Error Handler
 */
class WebSearchErrorHandler {
  static handle(error) {
    const serviceName = 'Web Search';
    
    // API key errors
    if (error.response?.status === 401 || error.message?.includes('API key')) {
      return ErrorHandler.create(AUTH_ERRORS.NOT_AUTHENTICATED, {
        service: serviceName,
        action: 'Check SERPER_API_KEY configuration'
      });
    }
    
    // Rate limiting
    if (error.response?.status === 429) {
      return ErrorHandler.create(HTTP_ERRORS.RATE_LIMIT, {
        service: serviceName,
        retryAfter: 60
      });
    }
    
    // HTTP errors
    if (error.response) {
      return ErrorHandler.handleHttpError(error, serviceName);
    }
    
    return ErrorHandler.handleNetworkError(error, serviceName);
  }
  
  static async wrapAsync(fn) {
    try {
      return await fn();
    } catch (error) {
      throw WebSearchErrorHandler.handle(error);
    }
  }
}

/**
 * Supabase/Database Error Handler
 */
class DatabaseErrorHandler {
  static handle(error) {
    const serviceName = 'Database';
    
    // Connection errors
    if (error.message?.includes('connection') || error.code === 'ECONNREFUSED') {
      return ErrorHandler.create(HTTP_ERRORS.SERVICE_UNAVAILABLE, {
        service: serviceName,
        action: 'Check database connection'
      });
    }
    
    // Not found
    if (error.message?.includes('not found') || error.code === 'PGRST116') {
      return ErrorHandler.create(HTTP_ERRORS.NOT_FOUND, {
        service: serviceName,
        resource: 'record'
      });
    }
    
    // Duplicate key
    if (error.code === '23505' || error.message?.includes('duplicate')) {
      return ErrorHandler.create(HTTP_ERRORS.CONFLICT, {
        service: serviceName,
        resource: 'record',
        conflictReason: 'A record with this identifier already exists'
      });
    }
    
    // Foreign key violation
    if (error.code === '23503') {
      return ErrorHandler.create(HTTP_ERRORS.BAD_REQUEST, {
        service: serviceName,
        action: 'Referenced record does not exist'
      });
    }
    
    // Generic database error
    return ErrorHandler.create(HTTP_ERRORS.SERVER_ERROR, {
      service: serviceName
    });
  }
  
  static async wrapAsync(fn) {
    try {
      return await fn();
    } catch (error) {
      throw DatabaseErrorHandler.handle(error);
    }
  }
}

module.exports = {
  GmailErrorHandler,
  CalendarErrorHandler,
  GitHubErrorHandler,
  DocsErrorHandler,
  WebSearchErrorHandler,
  DatabaseErrorHandler
};
