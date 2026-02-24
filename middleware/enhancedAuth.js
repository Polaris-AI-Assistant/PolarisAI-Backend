/**
 * Enhanced Authentication Middleware
 * 
 * Improved authentication with better error handling and token refresh.
 */

const supabase = require('../supabase/supabaseConnect');
const { ErrorHandler } = require('../utils/errors/ErrorHandler');
const { AUTH_ERRORS } = require('../utils/errors/errorTypes');
const { asyncHandler } = require('./errorMiddleware');

/**
 * Enhanced JWT authentication middleware
 */
const authenticateToken = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw ErrorHandler.create(AUTH_ERRORS.NOT_AUTHENTICATED, {
      service: 'PolarisAI',
      action: 'Please provide a valid authentication token'
    });
  }

  const token = authHeader.split(' ')[1];
  
  try {
    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error) {
      // Token expired or invalid
      if (error.message?.includes('expired') || error.message?.includes('invalid')) {
        throw ErrorHandler.create(AUTH_ERRORS.TOKEN_EXPIRED, {
          service: 'PolarisAI'
        });
      }
      
      throw ErrorHandler.create(AUTH_ERRORS.NOT_AUTHENTICATED, {
        service: 'PolarisAI',
        action: error.message
      });
    }

    if (!user) {
      throw ErrorHandler.create(AUTH_ERRORS.NOT_AUTHENTICATED, {
        service: 'PolarisAI',
        action: 'User not found'
      });
    }

    // Add user info to request
    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    // If it's already a PolarisError, rethrow
    if (error.name === 'PolarisError') {
      throw error;
    }
    
    // Handle unexpected errors
    throw ErrorHandler.handleAuthError(error, 'PolarisAI');
  }
});

/**
 * Optional authentication - if token provided, verify it
 */
const optionalAuth = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (!error && user) {
        req.user = user;
        req.token = token;
      }
    } catch (error) {
      // Log but don't block request
      console.warn('[OptionalAuth] Token verification failed:', error.message);
    }
  }
  
  next();
});

/**
 * Verify service connection (Gmail, Calendar, GitHub, etc.)
 */
function requireServiceConnection(serviceName, tableName) {
  return asyncHandler(async (req, res, next) => {
    if (!req.user || !req.user.id) {
      throw ErrorHandler.create(AUTH_ERRORS.NOT_AUTHENTICATED, {
        service: serviceName
      });
    }

    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('user_id', req.user.id)
        .single();

      if (error || !data) {
        throw ErrorHandler.create(AUTH_ERRORS.NOT_AUTHENTICATED, {
          service: serviceName,
          action: `Please connect your ${serviceName} account first`
        });
      }

      // Add service connection data to request
      req.serviceConnection = data;
      next();
    } catch (error) {
      if (error.name === 'PolarisError') {
        throw error;
      }
      
      throw ErrorHandler.create(AUTH_ERRORS.NOT_AUTHENTICATED, {
        service: serviceName,
        action: `Failed to verify ${serviceName} connection`
      });
    }
  });
}

/**
 * Check if user has required permissions/scopes
 */
function requireScopes(requiredScopes = []) {
  return asyncHandler(async (req, res, next) => {
    if (!req.serviceConnection) {
      throw ErrorHandler.create(AUTH_ERRORS.INSUFFICIENT_PERMISSIONS, {
        service: 'Service',
        action: 'connect service',
        requiredScopes: requiredScopes.join(', ')
      });
    }

    const userScopes = req.serviceConnection.scopes || [];
    const missingScopes = requiredScopes.filter(scope => !userScopes.includes(scope));

    if (missingScopes.length > 0) {
      throw ErrorHandler.create(AUTH_ERRORS.INSUFFICIENT_PERMISSIONS, {
        service: req.serviceConnection.service || 'Service',
        action: 'perform this action',
        requiredScopes: missingScopes.join(', ')
      });
    }

    next();
  });
}

/**
 * Rate limiting middleware
 */
function rateLimit(maxRequests = 100, windowMs = 60000) {
  const requests = new Map();
  
  return asyncHandler(async (req, res, next) => {
    const userId = req.user?.id || req.ip;
    const now = Date.now();
    
    if (!requests.has(userId)) {
      requests.set(userId, []);
    }
    
    const userRequests = requests.get(userId);
    
    // Remove old requests outside the window
    const validRequests = userRequests.filter(time => now - time < windowMs);
    
    if (validRequests.length >= maxRequests) {
      const oldestRequest = Math.min(...validRequests);
      const retryAfter = Math.ceil((oldestRequest + windowMs - now) / 1000);
      
      throw ErrorHandler.create({
        code: 'RATE_LIMIT',
        message: 'Too many requests',
        userMessage: `You've made too many requests. Please wait ${retryAfter} seconds before trying again.`,
        httpStatus: 429,
        retryable: true
      }, {
        retryAfter,
        maxRequests,
        windowMs
      });
    }
    
    validRequests.push(now);
    requests.set(userId, validRequests);
    
    next();
  });
}

module.exports = {
  authenticateToken,
  optionalAuth,
  requireServiceConnection,
  requireScopes,
  rateLimit
};
