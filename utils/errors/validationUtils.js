/**
 * Validation Utilities
 * 
 * Provides validation functions for common input types with error handling.
 */

const { ErrorHandler } = require('./ErrorHandler');
const { VALIDATION_ERRORS } = require('./errorTypes');

/**
 * Email validation patterns
 */
const EMAIL_PATTERNS = {
  basic: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  strict: /^[\w\.-]+@[\w\.-]+\.\w{2,}$/
};

/**
 * URL validation patterns
 */
const URL_PATTERNS = {
  basic: /^https?:\/\/.+/,
  strict: /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/
};

/**
 * Phone validation patterns
 */
const PHONE_PATTERNS = {
  US: /^(\+1)?[\s.-]?\(?([0-9]{3})\)?[\s.-]?([0-9]{3})[\s.-]?([0-9]{4})$/,
  INTERNATIONAL: /^\+[1-9]\d{1,14}$/
};

/**
 * Time validation patterns
 */
const TIME_PATTERNS = {
  '24h': /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
  '12h': /^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)$/i
};

/**
 * Validate email address
 */
function validateEmail(email, strict = false) {
  if (!email || typeof email !== 'string') {
    throw ErrorHandler.handleValidationError('email', email, VALIDATION_ERRORS.INVALID_EMAIL);
  }
  
  const pattern = strict ? EMAIL_PATTERNS.strict : EMAIL_PATTERNS.basic;
  
  if (!pattern.test(email)) {
    throw ErrorHandler.handleValidationError('email', email, VALIDATION_ERRORS.INVALID_EMAIL);
  }
  
  return email.toLowerCase().trim();
}

/**
 * Validate URL
 */
function validateUrl(url, strict = false) {
  if (!url || typeof url !== 'string') {
    throw ErrorHandler.handleValidationError('url', url, VALIDATION_ERRORS.INVALID_URL);
  }
  
  const pattern = strict ? URL_PATTERNS.strict : URL_PATTERNS.basic;
  
  if (!pattern.test(url)) {
    throw ErrorHandler.handleValidationError('url', url, VALIDATION_ERRORS.INVALID_URL);
  }
  
  // Auto-fix: prepend https:// if missing
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`;
  }
  
  return url;
}

/**
 * Validate phone number
 */
function validatePhone(phone, region = 'US') {
  if (!phone || typeof phone !== 'string') {
    throw ErrorHandler.handleValidationError('phone', phone, {
      ...VALIDATION_ERRORS.INVALID_EMAIL,
      code: 'VAL_003',
      message: 'Invalid phone format',
      userMessage: "'{input}' doesn't match a valid phone format. Try: +1-555-123-4567 or (555) 123-4567"
    });
  }
  
  const pattern = PHONE_PATTERNS[region] || PHONE_PATTERNS.INTERNATIONAL;
  
  if (!pattern.test(phone)) {
    throw ErrorHandler.handleValidationError('phone', phone, {
      ...VALIDATION_ERRORS.INVALID_EMAIL,
      code: 'VAL_003',
      message: 'Invalid phone format'
    });
  }
  
  return phone;
}

/**
 * Validate date
 */
function validateDate(dateString) {
  if (!dateString) {
    throw ErrorHandler.handleValidationError('date', dateString, VALIDATION_ERRORS.INVALID_DATE);
  }
  
  const date = new Date(dateString);
  
  if (isNaN(date.getTime())) {
    throw ErrorHandler.handleValidationError('date', dateString, {
      ...VALIDATION_ERRORS.INVALID_DATE,
      context: { reason: 'Invalid date format' }
    });
  }
  
  // Check for reasonable date range (1900 - 2100)
  const year = date.getFullYear();
  if (year < 1900 || year > 2100) {
    throw ErrorHandler.handleValidationError('date', dateString, {
      ...VALIDATION_ERRORS.INVALID_DATE,
      context: { reason: 'Year must be between 1900 and 2100' }
    });
  }
  
  return date;
}

/**
 * Validate time
 */
function validateTime(timeString) {
  if (!timeString || typeof timeString !== 'string') {
    throw ErrorHandler.handleValidationError('time', timeString, VALIDATION_ERRORS.INVALID_TIME);
  }
  
  const is24h = TIME_PATTERNS['24h'].test(timeString);
  const is12h = TIME_PATTERNS['12h'].test(timeString);
  
  if (!is24h && !is12h) {
    throw ErrorHandler.handleValidationError('time', timeString, VALIDATION_ERRORS.INVALID_TIME);
  }
  
  return timeString;
}

/**
 * Validate required fields
 */
function validateRequired(data, requiredFields) {
  const missing = [];
  
  for (const field of requiredFields) {
    if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
      missing.push(field);
    }
  }
  
  if (missing.length > 0) {
    throw ErrorHandler.handleValidationError(missing.join(', '), null, {
      ...VALIDATION_ERRORS.EMPTY_REQUIRED_FIELD,
      userMessage: `I need ${missing.join(', ')} to complete this. Could you provide ${missing.length > 1 ? 'them' : 'it'}?`
    });
  }
  
  return true;
}

/**
 * Validate string length
 */
function validateLength(value, fieldName, min = 0, max = Infinity) {
  if (typeof value !== 'string') {
    throw ErrorHandler.handleValidationError(fieldName, value, {
      ...VALIDATION_ERRORS.EMPTY_REQUIRED_FIELD,
      userMessage: `${fieldName} must be a string`
    });
  }
  
  const length = value.length;
  
  if (length < min) {
    throw ErrorHandler.handleValidationError(fieldName, value, {
      ...VALIDATION_ERRORS.EMPTY_REQUIRED_FIELD,
      userMessage: `${fieldName} must be at least ${min} characters long`
    });
  }
  
  if (length > max) {
    throw ErrorHandler.handleValidationError(fieldName, value, {
      ...VALIDATION_ERRORS.EXCESSIVE_LENGTH,
      context: {
        fieldName,
        currentLength: length,
        maxLength: max
      }
    });
  }
  
  return value;
}

/**
 * Validate number range
 */
function validateRange(value, fieldName, min = -Infinity, max = Infinity) {
  const num = Number(value);
  
  if (isNaN(num)) {
    throw ErrorHandler.handleValidationError(fieldName, value, {
      ...VALIDATION_ERRORS.EMPTY_REQUIRED_FIELD,
      userMessage: `${fieldName} must be a valid number`
    });
  }
  
  if (num < min) {
    throw ErrorHandler.handleValidationError(fieldName, value, {
      ...VALIDATION_ERRORS.EMPTY_REQUIRED_FIELD,
      userMessage: `${fieldName} must be at least ${min}. You entered ${value}.`
    });
  }
  
  if (num > max) {
    throw ErrorHandler.handleValidationError(fieldName, value, {
      ...VALIDATION_ERRORS.EMPTY_REQUIRED_FIELD,
      userMessage: `${fieldName} can't exceed ${max}. You entered ${value}.`
    });
  }
  
  return num;
}

/**
 * Sanitize input (prevent XSS)
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, ''); // Remove event handlers
}

/**
 * Validate array size
 */
function validateArraySize(array, fieldName, max) {
  if (!Array.isArray(array)) {
    throw ErrorHandler.handleValidationError(fieldName, array, {
      ...VALIDATION_ERRORS.EMPTY_REQUIRED_FIELD,
      userMessage: `${fieldName} must be an array`
    });
  }
  
  if (array.length > max) {
    throw ErrorHandler.handleValidationError(fieldName, array, {
      ...VALIDATION_ERRORS.EXCESSIVE_LENGTH,
      userMessage: `You can provide up to ${max} items in ${fieldName}. You provided ${array.length}.`
    });
  }
  
  return array;
}

module.exports = {
  validateEmail,
  validateUrl,
  validatePhone,
  validateDate,
  validateTime,
  validateRequired,
  validateLength,
  validateRange,
  sanitizeInput,
  validateArraySize,
  
  // Export patterns for custom validation
  EMAIL_PATTERNS,
  URL_PATTERNS,
  PHONE_PATTERNS,
  TIME_PATTERNS
};
