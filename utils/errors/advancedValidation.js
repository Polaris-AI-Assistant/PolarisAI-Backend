/**
 * Advanced Validation Utilities
 * 
 * Extended validation for complex scenarios including parsing, transformation,
 * file handling, and scheduling.
 */

const { ErrorHandler } = require('./ErrorHandler');
const { 
  PARSING_ERRORS, 
  TRANSFORMATION_ERRORS, 
  FILE_ERRORS,
  SCHEDULER_ERRORS,
  UX_ERRORS 
} = require('./errorTypes');

/**
 * Validate and parse JSON with error handling
 */
function validateJSON(jsonString, serviceName = 'service') {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    throw ErrorHandler.create(PARSING_ERRORS.JSON_PARSE_ERROR, {
      service: serviceName,
      error: error.message
    });
  }
}

/**
 * Parse ambiguous date with multiple interpretations
 */
function parseAmbiguousDate(dateString) {
  const interpretations = [];
  
  // Try different date formats
  const formats = [
    { pattern: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, name: 'MM/DD/YYYY or DD/MM/YYYY' },
    { pattern: /^(\d{4})-(\d{1,2})-(\d{1,2})$/, name: 'YYYY-MM-DD' }
  ];
  
  const match = dateString.match(formats[0].pattern);
  if (match) {
    const [, first, second, year] = match;
    
    // Could be MM/DD or DD/MM
    interpretations.push(
      new Date(year, first - 1, second), // MM/DD
      new Date(year, second - 1, first)  // DD/MM
    );
    
    if (interpretations[0].toString() === interpretations[1].toString()) {
      return interpretations[0]; // Unambiguous
    }
    
    throw ErrorHandler.create(PARSING_ERRORS.DATE_PARSE_ERROR, {
      input: dateString,
      interpretation1: interpretations[0].toLocaleDateString(),
      interpretation2: interpretations[1].toLocaleDateString()
    });
  }
  
  // Try standard parsing
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw ErrorHandler.create(PARSING_ERRORS.DATE_PARSE_ERROR, {
      input: dateString,
      interpretation1: 'Invalid date format',
      interpretation2: 'Try YYYY-MM-DD or MM/DD/YYYY'
    });
  }
  
  return date;
}

/**
 * Validate timezone
 */
function validateTimezone(timezone) {
  const validTimezones = Intl.supportedValuesOf('timeZone');
  
  if (validTimezones.includes(timezone)) {
    return timezone;
  }
  
  // Fuzzy match
  const suggestions = validTimezones
    .filter(tz => tz.toLowerCase().includes(timezone.toLowerCase()))
    .slice(0, 3);
  
  throw ErrorHandler.create(TRANSFORMATION_ERRORS.TIMEZONE_CONVERSION_ERROR, {
    timezone,
    suggestions: suggestions.join(', ') || 'America/New_York, Europe/London, Asia/Tokyo'
  });
}

/**
 * Validate currency code
 */
function validateCurrency(currencyCode) {
  const validCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'INR', 'CAD', 'AUD', 'CHF', 'SEK'];
  
  const code = currencyCode.toUpperCase();
  
  if (validCurrencies.includes(code)) {
    return code;
  }
  
  throw ErrorHandler.create(TRANSFORMATION_ERRORS.CURRENCY_CONVERSION_ERROR, {
    code: currencyCode
  });
}

/**
 * Validate file size
 */
function validateFileSize(size, maxSize, filename = 'file') {
  if (size > maxSize) {
    const sizeInMB = (size / (1024 * 1024)).toFixed(2);
    const limitInMB = (maxSize / (1024 * 1024)).toFixed(2);
    
    throw ErrorHandler.create(FILE_ERRORS.FILE_TOO_LARGE, {
      size: `${sizeInMB}MB`,
      limit: `${limitInMB}MB`,
      filename
    });
  }
  
  return true;
}

/**
 * Validate file type
 */
function validateFileType(filename, allowedTypes) {
  const extension = filename.split('.').pop().toLowerCase();
  
  if (!allowedTypes.includes(extension)) {
    throw ErrorHandler.create(FILE_ERRORS.UNSUPPORTED_FILE_TYPE, {
      fileType: extension,
      supportedFormats: allowedTypes.join(', ')
    });
  }
  
  return extension;
}

/**
 * Sanitize filename
 */
function sanitizeFilename(filename) {
  const invalidChars = /[<>:"/\\|?*\x00-\x1F]/g;
  const sanitized = filename.replace(invalidChars, '_');
  
  if (sanitized !== filename) {
    const removed = filename.match(invalidChars)?.join('') || '';
    throw ErrorHandler.create(FILE_ERRORS.FILENAME_INVALID, {
      invalidChars: removed,
      sanitizedName: sanitized
    });
  }
  
  return sanitized;
}

/**
 * Validate schedule time (not in past, not too far)
 */
function validateScheduleTime(dateTime, minMinutes = 4, maxDays = 30) {
  const now = new Date();
  const scheduleDate = new Date(dateTime);
  
  if (isNaN(scheduleDate.getTime())) {
    throw ErrorHandler.create(SCHEDULER_ERRORS.INVALID_CRON, {
      reason: 'Invalid date format'
    });
  }
  
  const diffMs = scheduleDate - now;
  const diffMinutes = diffMs / (1000 * 60);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  
  // Check if in past
  if (diffMs < 0) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(scheduleDate.getHours(), scheduleDate.getMinutes(), 0, 0);
    
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    nextWeek.setHours(scheduleDate.getHours(), scheduleDate.getMinutes(), 0, 0);
    
    throw ErrorHandler.create(SCHEDULER_ERRORS.PAST_SCHEDULE_TIME, {
      nextOccurrence: tomorrow.toLocaleString(),
      futureOption1: tomorrow.toLocaleString(),
      futureOption2: nextWeek.toLocaleString()
    });
  }
  
  // Check if too soon
  if (diffMinutes < minMinutes) {
    const minTime = new Date(now.getTime() + minMinutes * 60000);
    throw ErrorHandler.create(SCHEDULER_ERRORS.SCHEDULE_TOO_SOON, {
      minTime: minTime.toLocaleString()
    });
  }
  
  // Check if too far
  if (diffDays > maxDays) {
    throw ErrorHandler.create(SCHEDULER_ERRORS.SCHEDULE_TOO_FAR, {
      daysAway: Math.ceil(diffDays)
    });
  }
  
  return scheduleDate;
}

/**
 * Validate cron expression
 */
function validateCronExpression(cronExpression) {
  // Basic cron validation (minute hour day month weekday)
  const parts = cronExpression.trim().split(/\s+/);
  
  if (parts.length !== 5) {
    throw ErrorHandler.create(SCHEDULER_ERRORS.INVALID_CRON, {
      reason: 'Cron expression must have 5 parts: minute hour day month weekday'
    });
  }
  
  const [minute, hour, day, month, weekday] = parts;
  
  // Validate ranges
  const validateRange = (value, min, max, name) => {
    if (value === '*') return true;
    const num = parseInt(value);
    if (isNaN(num) || num < min || num > max) {
      throw ErrorHandler.create(SCHEDULER_ERRORS.INVALID_CRON, {
        reason: `${name} must be between ${min} and ${max}, got ${value}`
      });
    }
  };
  
  validateRange(minute, 0, 59, 'Minute');
  validateRange(hour, 0, 23, 'Hour');
  validateRange(day, 1, 31, 'Day');
  validateRange(month, 1, 12, 'Month');
  validateRange(weekday, 0, 6, 'Weekday');
  
  return cronExpression;
}

/**
 * Detect ambiguous references in user input
 */
function detectAmbiguousReference(text, context = {}) {
  const ambiguousPronouns = ['it', 'that', 'this', 'them', 'they', 'those'];
  const words = text.toLowerCase().split(/\s+/);
  
  for (const pronoun of ambiguousPronouns) {
    if (words.includes(pronoun) && !context[pronoun]) {
      throw ErrorHandler.create(UX_ERRORS.AMBIGUOUS_REFERENCE, {
        reference: pronoun,
        option1: 'Previous item mentioned',
        option2: 'Something else'
      });
    }
  }
  
  return true;
}

/**
 * Parse CSV with error handling
 */
function parseCSV(csvString) {
  const lines = csvString.split('\n');
  const result = [];
  const errors = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    try {
      // Simple CSV parsing (doesn't handle quoted commas)
      const values = line.split(',').map(v => v.trim());
      result.push(values);
    } catch (error) {
      errors.push({ line: i + 1, error: error.message });
    }
  }
  
  if (errors.length > 0) {
    throw ErrorHandler.create(PARSING_ERRORS.CSV_PARSE_ERROR, {
      lineNumber: errors[0].line,
      error: errors[0].error
    });
  }
  
  return result;
}

/**
 * Sanitize HTML content
 */
function sanitizeHTML(html) {
  // Remove potentially dangerous tags
  const dangerousTags = /<script|<iframe|<object|<embed|<link|<style/gi;
  
  if (dangerousTags.test(html)) {
    const sanitized = html.replace(dangerousTags, '');
    
    // Log warning
    console.warn('[Security] Removed potentially unsafe HTML elements');
    
    return {
      sanitized,
      warning: ErrorHandler.create(PARSING_ERRORS.HTML_SANITIZATION, {})
    };
  }
  
  return { sanitized: html, warning: null };
}

/**
 * Validate type conversion
 */
function validateTypeConversion(value, targetType) {
  switch (targetType) {
    case 'number':
      const num = Number(value);
      if (isNaN(num)) {
        throw ErrorHandler.create(TRANSFORMATION_ERRORS.TYPE_CONVERSION_FAILED, {
          value,
          targetType: 'number',
          expectedFormat: 'numeric value (e.g., 123, 45.67)'
        });
      }
      return num;
      
    case 'boolean':
      if (typeof value === 'boolean') return value;
      const lower = String(value).toLowerCase();
      if (['true', '1', 'yes'].includes(lower)) return true;
      if (['false', '0', 'no'].includes(lower)) return false;
      throw ErrorHandler.create(TRANSFORMATION_ERRORS.TYPE_CONVERSION_FAILED, {
        value,
        targetType: 'boolean',
        expectedFormat: 'true/false, yes/no, 1/0'
      });
      
    case 'date':
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw ErrorHandler.create(TRANSFORMATION_ERRORS.TYPE_CONVERSION_FAILED, {
          value,
          targetType: 'date',
          expectedFormat: 'YYYY-MM-DD or ISO 8601 format'
        });
      }
      return date;
      
    default:
      return String(value);
  }
}

module.exports = {
  validateJSON,
  parseAmbiguousDate,
  validateTimezone,
  validateCurrency,
  validateFileSize,
  validateFileType,
  sanitizeFilename,
  validateScheduleTime,
  validateCronExpression,
  detectAmbiguousReference,
  parseCSV,
  sanitizeHTML,
  validateTypeConversion
};
