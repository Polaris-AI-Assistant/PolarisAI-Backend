/**
 * Tool Parameter Validator
 * 
 * Validates tool parameters BEFORE execution to prevent invalid operations.
 * This catches errors early in the LLM reasoning phase, not after tool execution.
 */

const { ErrorHandler } = require('./errors/ErrorHandler');
const { VALIDATION_ERRORS, GMAIL_ERRORS } = require('./errors/errorTypes');

/**
 * Email validation regex (strict)
 */
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Validate email address
 */
function validateEmailAddress(email, fieldName = 'email') {
  if (!email || typeof email !== 'string') {
    throw ErrorHandler.create(VALIDATION_ERRORS.INVALID_EMAIL, {
      input: email || 'empty',
      fieldName
    });
  }
  
  const trimmedEmail = email.trim();
  
  // Check for common invalid patterns
  if (trimmedEmail.includes(' ')) {
    throw ErrorHandler.create(VALIDATION_ERRORS.INVALID_EMAIL, {
      input: email,
      fieldName,
      reason: 'Email addresses cannot contain spaces'
    });
  }
  
  if (!trimmedEmail.includes('@')) {
    throw ErrorHandler.create(VALIDATION_ERRORS.INVALID_EMAIL, {
      input: email,
      fieldName,
      reason: 'Email must contain @ symbol'
    });
  }
  
  if (!trimmedEmail.includes('.')) {
    throw ErrorHandler.create(VALIDATION_ERRORS.INVALID_EMAIL, {
      input: email,
      fieldName,
      reason: 'Email must contain a domain with extension (e.g., .com)'
    });
  }
  
  // Strict regex validation
  if (!EMAIL_REGEX.test(trimmedEmail)) {
    throw ErrorHandler.create(VALIDATION_ERRORS.INVALID_EMAIL, {
      input: email,
      fieldName,
      reason: 'Invalid email format. Expected format: name@domain.com'
    });
  }
  
  return trimmedEmail;
}

/**
 * Validate email list (for multiple recipients)
 */
function validateEmailList(emails, fieldName = 'emails') {
  if (!emails) return [];
  
  // Handle string (comma-separated)
  if (typeof emails === 'string') {
    emails = emails.split(',').map(e => e.trim()).filter(e => e);
  }
  
  // Handle array
  if (Array.isArray(emails)) {
    const validatedEmails = [];
    const invalidEmails = [];
    
    for (const email of emails) {
      try {
        validatedEmails.push(validateEmailAddress(email, fieldName));
      } catch (error) {
        invalidEmails.push(email);
      }
    }
    
    if (invalidEmails.length > 0) {
      throw ErrorHandler.create(VALIDATION_ERRORS.INVALID_EMAIL, {
        input: invalidEmails.join(', '),
        fieldName,
        reason: `Invalid email addresses: ${invalidEmails.join(', ')}`
      });
    }
    
    return validatedEmails;
  }
  
  throw ErrorHandler.create(VALIDATION_ERRORS.INVALID_EMAIL, {
    input: emails,
    fieldName,
    reason: 'Emails must be a string or array'
  });
}

/**
 * Gmail tool parameter validators
 */
const GMAIL_VALIDATORS = {
  sendEmail: (params) => {
    const errors = [];
    
    // Validate 'to' field
    if (!params.to) {
      errors.push("Missing required field 'to' (recipient email address)");
    } else {
      try {
        validateEmailAddress(params.to, 'to');
      } catch (error) {
        errors.push(`Invalid 'to' email: ${error.userMessage || error.message}`);
      }
    }
    
    // Validate 'cc' if provided
    if (params.cc) {
      try {
        validateEmailList(params.cc, 'cc');
      } catch (error) {
        errors.push(`Invalid 'cc' emails: ${error.userMessage || error.message}`);
      }
    }
    
    // Validate 'bcc' if provided
    if (params.bcc) {
      try {
        validateEmailList(params.bcc, 'bcc');
      } catch (error) {
        errors.push(`Invalid 'bcc' emails: ${error.userMessage || error.message}`);
      }
    }
    
    // Validate subject
    if (!params.subject || params.subject.trim() === '') {
      errors.push("Missing required field 'subject'");
    }
    
    // Validate body
    if (!params.body || params.body.trim() === '') {
      errors.push("Missing required field 'body' (email content)");
    }
    
    if (errors.length > 0) {
      throw ErrorHandler.create(GMAIL_ERRORS.RECIPIENT_NOT_FOUND, {
        email: params.to || 'not provided',
        errors: errors.join('; ')
      });
    }
    
    return true;
  },
  
  createDraft: (params) => {
    const errors = [];
    
    // Validate 'to' field
    if (params.to) {
      try {
        validateEmailAddress(params.to, 'to');
      } catch (error) {
        errors.push(`Invalid 'to' email: ${error.userMessage || error.message}`);
      }
    }
    
    // Validate 'cc' if provided
    if (params.cc) {
      try {
        validateEmailList(params.cc, 'cc');
      } catch (error) {
        errors.push(`Invalid 'cc' emails: ${error.userMessage || error.message}`);
      }
    }
    
    // Validate 'bcc' if provided
    if (params.bcc) {
      try {
        validateEmailList(params.bcc, 'bcc');
      } catch (error) {
        errors.push(`Invalid 'bcc' emails: ${error.userMessage || error.message}`);
      }
    }
    
    if (errors.length > 0) {
      throw ErrorHandler.create(GMAIL_ERRORS.RECIPIENT_NOT_FOUND, {
        email: params.to || 'not provided',
        errors: errors.join('; ')
      });
    }
    
    return true;
  },
  
  replyToEmail: (params) => {
    const errors = [];
    
    if (!params.messageId) {
      errors.push("Missing required field 'messageId'");
    }
    
    if (!params.body || params.body.trim() === '') {
      errors.push("Missing required field 'body' (reply content)");
    }
    
    if (errors.length > 0) {
      throw new Error(errors.join('; '));
    }
    
    return true;
  },
  
  forwardEmail: (params) => {
    const errors = [];
    
    if (!params.messageId) {
      errors.push("Missing required field 'messageId'");
    }
    
    if (!params.to) {
      errors.push("Missing required field 'to' (forward recipient)");
    } else {
      try {
        validateEmailAddress(params.to, 'to');
      } catch (error) {
        errors.push(`Invalid 'to' email: ${error.userMessage || error.message}`);
      }
    }
    
    if (errors.length > 0) {
      throw ErrorHandler.create(GMAIL_ERRORS.RECIPIENT_NOT_FOUND, {
        email: params.to || 'not provided',
        errors: errors.join('; ')
      });
    }
    
    return true;
  }
};

/**
 * Calendar tool parameter validators
 */
const CALENDAR_VALIDATORS = {
  createEvent: (params) => {
    const errors = [];
    
    if (!params.summary || params.summary.trim() === '') {
      errors.push("Missing required field 'summary' (event title)");
    }
    
    if (!params.startDateTime) {
      errors.push("Missing required field 'startDateTime'");
    } else {
      const startDate = new Date(params.startDateTime);
      if (isNaN(startDate.getTime())) {
        errors.push(`Invalid 'startDateTime': ${params.startDateTime}`);
      }
    }
    
    if (params.endDateTime) {
      const endDate = new Date(params.endDateTime);
      if (isNaN(endDate.getTime())) {
        errors.push(`Invalid 'endDateTime': ${params.endDateTime}`);
      }
    }
    
    // Validate attendees if provided
    if (params.attendees) {
      try {
        validateEmailList(params.attendees, 'attendees');
      } catch (error) {
        errors.push(`Invalid attendee emails: ${error.userMessage || error.message}`);
      }
    }
    
    if (errors.length > 0) {
      throw new Error(errors.join('; '));
    }
    
    return true;
  }
};

/**
 * Main validator registry
 */
const TOOL_VALIDATORS = {
  // Gmail validators
  sendEmail: GMAIL_VALIDATORS.sendEmail,
  createDraft: GMAIL_VALIDATORS.createDraft,
  replyToEmail: GMAIL_VALIDATORS.replyToEmail,
  forwardEmail: GMAIL_VALIDATORS.forwardEmail,
  
  // Calendar validators
  createEvent: CALENDAR_VALIDATORS.createEvent,
  updateEvent: CALENDAR_VALIDATORS.createEvent, // Same validation
  
  // Add more tool validators as needed
};

/**
 * Validate tool parameters before execution
 * 
 * @param {string} toolName - Name of the tool
 * @param {Object} params - Tool parameters
 * @returns {boolean} - True if valid
 * @throws {Error} - If validation fails
 */
function validateToolParameters(toolName, params) {
  const validator = TOOL_VALIDATORS[toolName];
  
  if (!validator) {
    // No validator defined for this tool, skip validation
    return true;
  }
  
  try {
    return validator(params);
  } catch (error) {
    // Re-throw with tool context
    console.error(`[ToolValidator] ${toolName} validation failed:`, error.message);
    throw error;
  }
}

/**
 * Get user-friendly error message for validation failure
 */
function getValidationErrorMessage(toolName, error) {
  const baseMessage = `I noticed an issue with the ${toolName} parameters:\n\n`;
  
  if (error.userMessage) {
    return baseMessage + error.userMessage;
  }
  
  return baseMessage + error.message + '\n\nPlease provide the correct information and I\'ll try again.';
}

module.exports = {
  validateToolParameters,
  validateEmailAddress,
  validateEmailList,
  getValidationErrorMessage,
  TOOL_VALIDATORS
};
