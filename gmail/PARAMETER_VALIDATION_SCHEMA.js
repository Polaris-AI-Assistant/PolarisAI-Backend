/**
 * Parameter Validation Schema for Send Email with Attachments
 * 
 * This file documents the validation requirements for the sendEmailWithAttachment tool
 * Can be used to implement validation in toolParameterValidator.js if needed
 */

/**
 * Validation schema for sendEmailWithAttachment parameters
 */
const SEND_EMAIL_WITH_ATTACHMENT_SCHEMA = {
  // Required parameters
  to: {
    type: 'string',
    required: true,
    validation: {
      minLength: 5,
      maxLength: 254,
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, // Basic email validation
      message: 'Invalid email address format'
    },
    transform: (value) => value.trim().toLowerCase()
  },
  
  subject: {
    type: 'string',
    required: true,
    validation: {
      minLength: 1,
      maxLength: 100,
      pattern: /^[^\r\n]*$/, // No newlines
      message: 'Subject must be 1-100 characters without newlines'
    },
    transform: (value) => value.trim()
  },
  
  body: {
    type: 'string',
    required: true,
    validation: {
      minLength: 1,
      maxLength: 10000,
      message: 'Body must be 1-10,000 characters'
    },
    transform: (value) => value.trim()
  },
  
  fileIds: {
    type: 'array',
    required: true,
    validation: {
      minItems: 1,
      maxItems: 25,
      itemType: 'string',
      itemValidation: {
        minLength: 1,
        pattern: /^[a-zA-Z0-9\-_]+$/,
        message: 'Each file ID must be alphanumeric with hyphens/underscores only'
      },
      message: 'fileIds must be array with 1-25 valid file IDs'
    }
  },
  
  // Optional parameters
  cc: {
    type: 'string',
    required: false,
    validation: {
      maxLength: 1000,
      pattern: /^[^\r\n]*$/, // No newlines
      customValidator: (value) => {
        if (!value) return true;
        // Validate comma-separated emails
        return value.split(',').every(email => {
          const trimmed = email.trim();
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
        });
      },
      message: 'CC must be valid comma-separated email addresses'
    },
    transform: (value) => {
      if (!value) return undefined;
      return value.split(',').map(e => e.trim().toLowerCase()).join(', ');
    }
  },
  
  bcc: {
    type: 'string',
    required: false,
    validation: {
      maxLength: 1000,
      pattern: /^[^\r\n]*$/,
      customValidator: (value) => {
        if (!value) return true;
        return value.split(',').every(email => {
          const trimmed = email.trim();
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
        });
      },
      message: 'BCC must be valid comma-separated email addresses'
    },
    transform: (value) => {
      if (!value) return undefined;
      return value.split(',').map(e => e.trim().toLowerCase()).join(', ');
    }
  },
  
  isHtml: {
    type: 'boolean',
    required: false,
    validation: {
      default: false
    }
  }
};

/**
 * Validation logic that can be used in toolParameterValidator.js
 */
class SendEmailWithAttachmentValidator {
  
  /**
   * Validate all parameters
   */
  static validate(params) {
    const errors = [];
    
    // Check required parameters
    for (const [key, schema] of Object.entries(SEND_EMAIL_WITH_ATTACHMENT_SCHEMA)) {
      if (schema.required && !(key in params)) {
        errors.push(`Missing required parameter: ${key}`);
      }
    }
    
    // Validate each parameter
    for (const [key, value] of Object.entries(params)) {
      const schema = SEND_EMAIL_WITH_ATTACHMENT_SCHEMA[key];
      
      if (!schema) {
        errors.push(`Unknown parameter: ${key}`);
        continue;
      }
      
      const paramErrors = this.validateParameter(key, value, schema);
      errors.push(...paramErrors);
    }
    
    if (errors.length > 0) {
      return { valid: false, errors };
    }
    
    return { valid: true, errors: [] };
  }
  
  /**
   * Validate a single parameter
   */
  static validateParameter(key, value, schema) {
    const errors = [];
    
    if (value === null || value === undefined) {
      if (schema.required) {
        errors.push(`${key} is required`);
      }
      return errors;
    }
    
    // Type validation
    if (schema.type === 'array') {
      if (!Array.isArray(value)) {
        errors.push(`${key} must be an array`);
        return errors;
      }
      
      const { minItems, maxItems, itemType } = schema.validation;
      
      if (minItems && value.length < minItems) {
        errors.push(`${key} must have at least ${minItems} item(s)`);
      }
      
      if (maxItems && value.length > maxItems) {
        errors.push(`${key} must have at most ${maxItems} item(s)`);
      }
      
      // Validate array items
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        
        if (itemType && typeof item !== itemType) {
          errors.push(`${key}[${i}] must be of type ${itemType}`);
        }
        
        if (schema.validation.itemValidation) {
          const itemValidation = schema.validation.itemValidation;
          
          if (itemValidation.minLength && item.length < itemValidation.minLength) {
            errors.push(`${key}[${i}] must be at least ${itemValidation.minLength} characters`);
          }
          
          if (itemValidation.pattern && !itemValidation.pattern.test(item)) {
            errors.push(`${key}[${i}]: ${itemValidation.message}`);
          }
        }
      }
      
    } else if (schema.type === 'string') {
      if (typeof value !== 'string') {
        errors.push(`${key} must be a string`);
        return errors;
      }
      
      const { minLength, maxLength, pattern, customValidator, message } = schema.validation;
      
      if (minLength && value.length < minLength) {
        errors.push(`${key} must be at least ${minLength} characters`);
      }
      
      if (maxLength && value.length > maxLength) {
        errors.push(`${key} must be at most ${maxLength} characters`);
      }
      
      if (pattern && !pattern.test(value)) {
        errors.push(`${key}: ${message || 'Invalid format'}`);
      }
      
      if (customValidator && !customValidator(value)) {
        errors.push(`${key}: ${message || 'Validation failed'}`);
      }
      
    } else if (schema.type === 'boolean') {
      if (typeof value !== 'boolean') {
        errors.push(`${key} must be a boolean`);
      }
    }
    
    return errors;
  }
  
  /**
   * Transform parameters (sanitize, normalize)
   */
  static transform(params) {
    const transformed = {};
    
    for (const [key, value] of Object.entries(params)) {
      const schema = SEND_EMAIL_WITH_ATTACHMENT_SCHEMA[key];
      
      if (!schema) {
        // Unknown parameter, skip or include as-is
        continue;
      }
      
      if (schema.transform && value !== undefined) {
        transformed[key] = schema.transform(value);
      } else {
        transformed[key] = value;
      }
    }
    
    return transformed;
  }
  
  /**
   * Validate and transform in one step
   */
  static validateAndTransform(params) {
    // Validate first
    const validation = this.validate(params);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join('; ')}`);
    }
    
    // Then transform
    return this.transform(params);
  }
}

/**
 * Usage example in toolParameterValidator.js:
 * 
 * function validateSendEmailWithAttachmentParams(params) {
 *   try {
 *     const validated = SendEmailWithAttachmentValidator.validateAndTransform(params);
 *     return { valid: true, params: validated };
 *   } catch (error) {
 *     return { valid: false, error: error.message };
 *   }
 * }
 */

module.exports = {
  SEND_EMAIL_WITH_ATTACHMENT_SCHEMA,
  SendEmailWithAttachmentValidator
};
