// Email validation
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Password validation (minimum 8 characters, at least one letter and one number)
function isValidPassword(password) {
  if (password.length < 8) return false;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  return hasLetter && hasNumber;
}

// Validate required fields
function validateRequiredFields(data, requiredFields) {
  const missing = [];
  
  for (const field of requiredFields) {
    if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
      missing.push(field);
    }
  }
  
  return missing;
}

// Sanitize input (basic XSS prevention)
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove basic HTML tags
    .slice(0, 500); // Limit length
}

/**
 * Validate calendar event parameters for temporal correctness
 * @param {Object} params - Event parameters
 * @param {string} params.summary - Event title
 * @param {string} params.startDateTime - Start date/time (ISO string)
 * @param {string} params.endDateTime - End date/time (ISO string)
 * @param {string} params.query - Original user query
 * @returns {Object} - Validation result
 */
function validateCalendarEvent(params) {
  const errors = [];
  const warnings = [];
  
  // Validate start date/time
  if (params.startDateTime) {
    const startDate = new Date(params.startDateTime);
    const now = new Date();
    
    // Check if date is in the past
    if (startDate < now) {
      const diffMs = now.getTime() - startDate.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);
      
      let timeAgo = '';
      if (diffDays > 0) {
        timeAgo = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
      } else if (diffHours > 0) {
        timeAgo = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      } else {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        timeAgo = `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
      }
      
      errors.push({
        type: 'PAST_DATE',
        field: 'startDateTime',
        value: params.startDateTime,
        message: `That time has already passed (${timeAgo}).`,
        metadata: {
          requestedDate: startDate.toISOString(),
          currentDate: now.toISOString(),
          diffHours,
          diffDays,
          timeAgo
        },
        suggestions: generatePastDateSuggestions(startDate, now, params.query)
      });
    }
  }
  
  // Validate end date (must be after start)
  if (params.startDateTime && params.endDateTime) {
    const startDate = new Date(params.startDateTime);
    const endDate = new Date(params.endDateTime);
    
    if (endDate <= startDate) {
      errors.push({
        type: 'INVALID_DATE_RANGE',
        field: 'endDateTime',
        value: params.endDateTime,
        message: 'Event end time must be after start time.',
        suggestions: [
          `Set end time to ${new Date(startDate.getTime() + 60*60*1000).toLocaleString()}`,
          'Specify a different duration'
        ]
      });
    }
  }
  
  // Validate summary (not empty)
  if (!params.summary || params.summary.trim() === '') {
    errors.push({
      type: 'MISSING_REQUIRED_FIELD',
      field: 'summary',
      message: 'Event title is required.',
      suggestions: ['Provide a title for the event']
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Generate suggestions for past date errors
 */
function generatePastDateSuggestions(requestedDate, currentDate, originalQuery) {
  const suggestions = [];
  
  // Extract time from requested date
  const hours = requestedDate.getHours();
  const minutes = requestedDate.getMinutes();
  
  // Suggestion 1: Today at same time (if not already passed)
  const today = new Date(currentDate);
  today.setHours(hours, minutes, 0, 0);
  if (today > currentDate) {
    suggestions.push(`Today at ${formatTime(hours, minutes)} (${formatDate(today)})`);
  }
  
  // Suggestion 2: Tomorrow at same time
  const tomorrow = new Date(currentDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(hours, minutes, 0, 0);
  suggestions.push(`Tomorrow at ${formatTime(hours, minutes)} (${formatDate(tomorrow)})`);
  
  // Suggestion 3: Next week same day at same time
  const nextWeek = new Date(requestedDate);
  nextWeek.setDate(nextWeek.getDate() + 7);
  suggestions.push(`Next ${getDayName(nextWeek)} at ${formatTime(hours, minutes)} (${formatDate(nextWeek)})`);
  
  // Suggestion 4: Create past event for records
  suggestions.push(`Create past event for records (${formatDate(requestedDate)} at ${formatTime(hours, minutes)})`);
  
  return suggestions;
}

/**
 * Format time as 12-hour
 */
function formatTime(hours, minutes) {
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Format date
 */
function formatDate(date) {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Get day name
 */
function getDayName(date) {
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

/**
 * Format calendar validation errors into user-friendly message
 */
function formatCalendarValidationErrors(errors) {
  if (!errors || errors.length === 0) {
    return '';
  }
  
  let message = '';
  
  for (const error of errors) {
    if (error.type === 'PAST_DATE') {
      const metadata = error.metadata;
      const requestedDate = new Date(metadata.requestedDate);
      
      message += `I noticed you mentioned a time that has already passed.\n\n`;
      message += `📅 Requested: ${formatDateTime(requestedDate)}\n`;
      message += `⏰ That was ${metadata.timeAgo}\n\n`;
      message += `Did you mean:\n`;
      
      error.suggestions.forEach((suggestion, index) => {
        message += `${index + 1}. ${suggestion}\n`;
      });
      
      message += `\nWhich option would you prefer?`;
    } else if (error.type === 'INVALID_DATE_RANGE') {
      message += `The event end time must be after the start time.\n\n`;
      message += `Suggestions:\n`;
      error.suggestions.forEach((suggestion, index) => {
        message += `${index + 1}. ${suggestion}\n`;
      });
    } else if (error.type === 'MISSING_REQUIRED_FIELD') {
      message += `${error.message}\n`;
    }
  }
  
  return message.trim();
}

/**
 * Format date and time
 */
function formatDateTime(date) {
  return date.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Validate schedule/reminder parameters for temporal correctness
 * @param {Object} params - Schedule parameters
 * @param {string} params.content - Reminder content
 * @param {string} params.datetime - Schedule date/time (natural language)
 * @param {string} params.query - Original user query
 * @returns {Object} - Validation result
 */
function validateScheduleReminder(params) {
  const errors = [];
  const warnings = [];
  
  // Check for obvious past time indicators in the query
  const lowerQuery = (params.query || params.datetime || '').toLowerCase();
  
  // Detect past time patterns
  const pastPatterns = [
    /\b(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago\b/i,
    /\byesterday\b/i,
    /\blast\s+(week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    /\bprevious\s+(week|month|year)\b/i
  ];
  
  for (const pattern of pastPatterns) {
    const match = lowerQuery.match(pattern);
    if (match) {
      const timePhrase = match[0];
      
      errors.push({
        type: 'PAST_SCHEDULE_TIME',
        field: 'datetime',
        value: params.datetime,
        message: `That time has already passed.`,
        metadata: {
          detectedPhrase: timePhrase,
          originalQuery: params.query
        },
        suggestions: generatePastScheduleSuggestions(timePhrase, params.content)
      });
      
      break; // Only report first past time pattern found
    }
  }
  
  // Validate content (not empty)
  if (!params.content || params.content.trim() === '') {
    errors.push({
      type: 'MISSING_REQUIRED_FIELD',
      field: 'content',
      message: 'Reminder content is required.',
      suggestions: ['Provide what you want to be reminded about']
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Generate suggestions for past schedule time errors
 */
function generatePastScheduleSuggestions(timePhrase, content) {
  const suggestions = [];
  
  // Extract the time unit and amount
  const match = timePhrase.match(/(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/i);
  
  if (match) {
    const amount = match[1];
    const unit = match[2].toLowerCase();
    
    // Suggest "from now" instead of "ago"
    suggestions.push(`${amount} ${unit}${parseInt(amount) > 1 ? 's' : ''} from now`);
    
    // Suggest "in X"
    suggestions.push(`in ${amount} ${unit}${parseInt(amount) > 1 ? 's' : ''}`);
  } else if (timePhrase.includes('yesterday')) {
    suggestions.push('tomorrow');
    suggestions.push('today');
  } else if (timePhrase.includes('last')) {
    suggestions.push(timePhrase.replace('last', 'next'));
  }
  
  return suggestions;
}

/**
 * Format schedule validation errors into user-friendly message
 */
function formatScheduleValidationErrors(errors) {
  if (!errors || errors.length === 0) {
    return '';
  }
  
  let message = '';
  
  for (const error of errors) {
    if (error.type === 'PAST_SCHEDULE_TIME') {
      const metadata = error.metadata;
      
      message += `I noticed you mentioned "${metadata.detectedPhrase}" which has already passed.\n\n`;
      message += `⏰ You can't schedule reminders for past times.\n\n`;
      message += `Did you mean:\n`;
      
      error.suggestions.forEach((suggestion, index) => {
        message += `${index + 1}. ${suggestion}\n`;
      });
      
      message += `\nWhich time would you prefer?`;
    } else if (error.type === 'MISSING_REQUIRED_FIELD') {
      message += `${error.message}\n`;
    }
  }
  
  return message.trim();
}

/**
 * Validate email parameters for completeness
 * @param {Object} params - Email parameters
 * @param {string} params.to - Recipient email
 * @param {string} params.subject - Email subject
 * @param {string} params.body - Email body
 * @param {string} params.query - Original user query
 * @returns {Object} - Validation result with AI generation capability
 */
function validateEmailContent(params) {
  const errors = [];
  const warnings = [];
  
  // ============================================================
  // EXTRACT TOPIC/INTENT FROM QUERY
  // ============================================================
  const topic = extractEmailTopic(params.query);
  
  // ============================================================
  // TIER 1: COMPLETELY MISSING (No topic, no subject, no body)
  // Only reject if user provided NO information at all
  // ============================================================
  if (!topic && (!params.subject || params.subject.trim() === '') && (!params.body || params.body.trim() === '')) {
    errors.push({
      type: 'MISSING_EMAIL_INTENT',
      field: 'content',
      message: 'What should the email be about?',
      suggestions: [
        'Specify a topic: "about [topic]"',
        'Add subject: "with subject [subject]"',
        'Provide message: "saying [message]"',
        'Example: "Send email about the project update"'
      ]
    });
    
    // Check for suspicious domain even when content is missing
    const domain = params.to.split('@')[1];
    if (domain) {
      const suspiciousDomains = [
        /fake/i,
        /test/i,
        /example/i,
        /nonexistent/i,
        /invalid/i,
        /\d{5,}/
      ];
      
      const isSuspicious = suspiciousDomains.some(pattern => pattern.test(domain));
      
      if (isSuspicious) {
        warnings.push({
          type: 'SUSPICIOUS_DOMAIN',
          field: 'to',
          value: params.to,
          message: `The domain "${domain}" appears to be fake or for testing.`,
          suggestions: [
            'Double-check the email address',
            'This email will likely bounce back',
            'Confirm this is the correct address'
          ]
        });
      }
    }
    
    return {
      isValid: false,
      errors,
      warnings,
      canGenerateAI: false
    };
  }
  
  // ============================================================
  // TIER 2: HAS TOPIC/INTENT (Can generate AI content)
  // User provided topic - this is VALID for AI generation
  // ============================================================
  if (topic) {
    // Check for suspicious domain
    const domain = params.to.split('@')[1];
    if (domain) {
      const suspiciousDomains = [
        /fake/i,
        /test/i,
        /example/i,
        /nonexistent/i,
        /invalid/i,
        /\d{5,}/
      ];
      
      const isSuspicious = suspiciousDomains.some(pattern => pattern.test(domain));
      
      if (isSuspicious) {
        warnings.push({
          type: 'SUSPICIOUS_DOMAIN',
          field: 'to',
          value: params.to,
          message: `The domain "${domain}" appears to be fake or for testing.`,
          suggestions: [
            'Double-check the email address',
            'This email will likely bounce back',
            'Confirm this is the correct address'
          ]
        });
      }
    }
    
    return {
      isValid: true,  // ✅ Valid for AI generation
      errors: [],
      warnings,
      canGenerateAI: true,
      topic
    };
  }
  
  // ============================================================
  // TIER 3: HAS COMPLETE DETAILS (Use as-is)
  // ============================================================
  if (params.subject && params.subject.trim() !== '' && params.body && params.body.trim() !== '') {
    // Check for suspicious domain
    const domain = params.to.split('@')[1];
    if (domain) {
      const suspiciousDomains = [
        /fake/i,
        /test/i,
        /example/i,
        /nonexistent/i,
        /invalid/i,
        /\d{5,}/
      ];
      
      const isSuspicious = suspiciousDomains.some(pattern => pattern.test(domain));
      
      if (isSuspicious) {
        warnings.push({
          type: 'SUSPICIOUS_DOMAIN',
          field: 'to',
          value: params.to,
          message: `The domain "${domain}" appears to be fake or for testing.`,
          suggestions: [
            'Double-check the email address',
            'This email will likely bounce back',
            'Confirm this is the correct address'
          ]
        });
      }
    }
    
    return {
      isValid: true,
      errors: [],
      warnings,
      canGenerateAI: false,
      topic: params.subject
    };
  }
  
  // ============================================================
  // EDGE CASE: Has body but no subject
  // ============================================================
  if (params.body && params.body.trim() !== '' && (!params.subject || params.subject.trim() === '')) {
    return {
      isValid: true,
      errors: [],
      warnings,
      canGenerateAI: true,  // Generate subject from body
      topic: extractTopicFromBody(params.body)
    };
  }
  
  // Default: Allow AI generation if we have any context
  return {
    isValid: true,
    errors: [],
    warnings,
    canGenerateAI: true,
    topic: topic || params.subject || 'general inquiry'
  };
}

/**
 * Extract email topic/intent from query
 */
function extractEmailTopic(query) {
  // Pattern 1: "about [topic]"
  const aboutMatch = query.match(/about\s+(.+?)(?:\s+to\s+|\s+and\s+|\s*$)/i);
  if (aboutMatch) {
    return aboutMatch[1].trim();
  }
  
  // Pattern 2: "regarding [topic]"
  const regardingMatch = query.match(/regarding\s+(.+?)(?:\s+to\s+|\s+and\s+|\s*$)/i);
  if (regardingMatch) {
    return regardingMatch[1].trim();
  }
  
  // Pattern 3: "with subject [subject]"
  const subjectMatch = query.match(/(?:with\s+)?subject\s+['""]?(.+?)['""]?(?:\s+and|\s+to|\s*$)/i);
  if (subjectMatch) {
    return subjectMatch[1].trim();
  }
  
  // Pattern 4: "saying [message]"
  const sayingMatch = query.match(/saying\s+(.+?)(?:\s+to\s+|\s+and\s+|\s*$)/i);
  if (sayingMatch) {
    return sayingMatch[1].trim();
  }
  
  // Pattern 5: "to tell them [message]"
  const tellMatch = query.match(/to\s+tell\s+(?:them|him|her)\s+(.+?)(?:\s+to\s+|\s+and\s+|\s*$)/i);
  if (tellMatch) {
    return tellMatch[1].trim();
  }
  
  // Pattern 6: "asking about [topic]"
  const askingMatch = query.match(/asking\s+about\s+(.+?)(?:\s+to\s+|\s+and\s+|\s*$)/i);
  if (askingMatch) {
    return askingMatch[1].trim();
  }
  
  return null;
}

/**
 * Extract topic from email body
 */
function extractTopicFromBody(body) {
  // Take first sentence or first 50 chars
  const firstSentence = body.split(/[.!?]/)[0];
  return firstSentence.substring(0, 50).trim();
}

/**
 * Format email validation errors into user-friendly message
 */
function formatEmailValidationErrors(errors, warnings) {
  let message = '';
  
  // Handle warnings first (suspicious domain)
  if (warnings && warnings.length > 0) {
    for (const warning of warnings) {
      if (warning.type === 'SUSPICIOUS_DOMAIN') {
        message += `⚠️ Domain Warning: ${warning.message}\n\n`;
        message += `This email will likely bounce back. Did you mean a different address?\n\n`;
      }
    }
  }
  
  // Handle errors (missing content)
  if (errors && errors.length > 0) {
    message += `📝 Missing Information:\n\n`;
    
    for (const error of errors) {
      if (error.type === 'MISSING_EMAIL_INTENT') {
        message += `${error.message}\n\n`;
        message += `Please specify:\n`;
        error.suggestions.forEach((suggestion, index) => {
          message += `• ${suggestion}\n`;
        });
      }
    }
  }
  
  return message.trim();
}

module.exports = {
  isValidEmail,
  isValidPassword,
  validateRequiredFields,
  sanitizeInput,
  validateCalendarEvent,
  formatCalendarValidationErrors,
  validateScheduleReminder,
  formatScheduleValidationErrors,
  validateEmailContent,
  formatEmailValidationErrors
};
