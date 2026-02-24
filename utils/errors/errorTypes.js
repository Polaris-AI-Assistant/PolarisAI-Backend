/**
 * Centralized Error Type Definitions
 * 
 * Defines all error types, codes, and user-friendly messages for the PolarisAI platform.
 * Each error includes:
 * - code: Unique error identifier
 * - message: Technical error message
 * - userMessage: User-friendly message (supports template variables)
 * - httpStatus: HTTP status code
 * - retryable: Whether the operation can be retried
 * - action: Suggested action to take
 */

// ========== SYSTEM-LEVEL ERRORS ==========
const SYSTEM_ERRORS = {
  SERVICE_DOWN: {
    code: 'SYS_001',
    message: 'Service temporarily unavailable',
    userMessage: "I'm having trouble connecting to {service}. Let me try again in a moment...",
    httpStatus: 503,
    retryable: true,
    retryStrategy: {
      maxAttempts: 3,
      backoff: 'exponential', // 1s, 2s, 4s
    }
  },
  
  TIMEOUT: {
    code: 'SYS_002',
    message: 'Request timeout',
    userMessage: "This is taking longer than expected. Would you like me to:\n1. Keep trying\n2. Try a different approach\n3. Cancel and try later",
    httpStatus: 504,
    retryable: true,
    timeout: 30000 // 30s
  },
  
  DEPENDENCY_FAILURE: {
    code: 'SYS_003',
    message: 'Required service dependency failed',
    userMessage: "I need {dependency} to complete this task, but it's currently unavailable. I'll notify you when it's back online.",
    httpStatus: 503,
    retryable: true
  },
  
  MEMORY_LIMIT: {
    code: 'SYS_004',
    message: 'Memory limit exceeded',
    userMessage: "This operation requires too much memory. Let me break it into smaller chunks...",
    httpStatus: 507,
    retryable: false,
    action: 'chunk_processing'
  },
  
  CONCURRENT_LIMIT: {
    code: 'SYS_005',
    message: 'Too many concurrent operations',
    userMessage: "I'm handling multiple tasks right now. I'll queue this and get to it in {estimatedTime}.",
    httpStatus: 429,
    retryable: true,
    maxConcurrent: 10
  }
};

// ========== PLATFORM ERRORS ==========
const PLATFORM_ERRORS = {
  AGENT_NOT_FOUND: {
    code: 'PLT_001',
    message: 'Agent not found',
    userMessage: "I don't have access to {agentName} yet. Would you like me to add it?",
    httpStatus: 404,
    retryable: false,
    action: 'suggest_agent_addition'
  },
  
  AGENT_LIMIT_REACHED: {
    code: 'PLT_002',
    message: 'Agent limit reached',
    userMessage: "I've reached my limit of 10 active apps. I'll remove {leastUsedAgent} to add {newAgent}.",
    httpStatus: 429,
    retryable: false,
    action: 'auto_remove_lru_agent'
  },
  
  TOOL_EXECUTION_FAILED: {
    code: 'PLT_003',
    message: 'Tool execution failed',
    userMessage: "I tried to {action} but encountered an issue: {errorReason}. Let me try an alternative approach...",
    httpStatus: 500,
    retryable: true,
    fallback: 'alternative_tool_or_method'
  },
  
  CONTEXT_OVERFLOW: {
    code: 'PLT_004',
    message: 'Context overflow',
    userMessage: "Our conversation is getting quite long. I'll summarize the key points to keep things running smoothly.",
    httpStatus: 413,
    retryable: false,
    action: 'summarize_and_compress_context'
  },
  
  INVALID_TOOL_PARAMETERS: {
    code: 'PLT_005',
    message: 'Invalid tool parameters',
    userMessage: "I need a bit more information to complete this. Could you specify {missingParameter}?",
    httpStatus: 400,
    retryable: false,
    action: 'request_missing_params'
  }
};

// ========== AUTHENTICATION & AUTHORIZATION ERRORS ==========
const AUTH_ERRORS = {
  NOT_AUTHENTICATED: {
    code: 'AUTH_001',
    message: 'User not authenticated',
    userMessage: "You'll need to sign in to use {service}. Would you like me to guide you through connecting your account?",
    httpStatus: 401,
    retryable: false,
    action: 'initiate_oauth_flow'
  },
  
  TOKEN_EXPIRED: {
    code: 'AUTH_002',
    message: 'OAuth token expired',
    userMessage: "Your {service} connection has expired. I'll refresh it automatically...",
    httpStatus: 401,
    retryable: true,
    action: 'silent_token_refresh'
  },
  
  TOKEN_REFRESH_FAILED: {
    code: 'AUTH_003',
    message: 'Token refresh failed',
    userMessage: "I need you to reconnect your {service} account. Click here to authorize: {authUrl}",
    httpStatus: 401,
    retryable: false,
    action: 'full_reauth_required'
  },
  
  INSUFFICIENT_PERMISSIONS: {
    code: 'AUTH_004',
    message: 'Insufficient permissions',
    userMessage: "I don't have permission to {action} in your {service} account. You'll need to grant additional permissions: {requiredScopes}",
    httpStatus: 403,
    retryable: false,
    action: 'request_additional_scopes'
  },
  
  ACCOUNT_SUSPENDED: {
    code: 'AUTH_005',
    message: 'Account suspended',
    userMessage: "It looks like your {service} account is suspended. Please check with {service} support.",
    httpStatus: 403,
    retryable: false,
    action: 'notify_and_disable_agent'
  },
  
  REVOKED_ACCESS: {
    code: 'AUTH_007',
    message: 'Access revoked',
    userMessage: "It seems you've disconnected {service}. Would you like to reconnect it?",
    httpStatus: 401,
    retryable: false,
    action: 'offer_reconnection'
  }
};

// ========== PERMISSION ERRORS ==========
const PERMISSION_ERRORS = {
  READ_ONLY_ACCESS: {
    code: 'PERM_001',
    message: 'Read-only access',
    userMessage: "I can view your {resource} but can't modify it. You'll need to grant edit permissions.",
    httpStatus: 403,
    retryable: false,
    action: 'request_write_scope'
  },
  
  RESOURCE_ACCESS_DENIED: {
    code: 'PERM_002',
    message: 'Resource access denied',
    userMessage: "I don't have access to {resource}. Make sure it's shared with your account or you have the right permissions.",
    httpStatus: 403,
    retryable: false
  },
  
  ORGANIZATION_POLICY_BLOCK: {
    code: 'PERM_003',
    message: 'Organization policy block',
    userMessage: "Your organization's security policy prevents {action}. Contact your IT admin for access.",
    httpStatus: 403,
    retryable: false
  }
};

// ========== VALIDATION ERRORS ==========
const VALIDATION_ERRORS = {
  INVALID_EMAIL: {
    code: 'VAL_001',
    message: 'Invalid email format',
    userMessage: "'{input}' doesn't look like a valid email. Email should be like: name@domain.com",
    httpStatus: 400,
    retryable: false
  },
  
  INVALID_URL: {
    code: 'VAL_002',
    message: 'Invalid URL format',
    userMessage: "'{input}' doesn't appear to be a valid URL. URLs should start with http:// or https://",
    httpStatus: 400,
    retryable: false
  },
  
  INVALID_DATE: {
    code: 'VAL_004',
    message: 'Invalid date',
    userMessage: "'{input}' isn't a valid date. {reason}",
    httpStatus: 400,
    retryable: false
  },
  
  INVALID_TIME: {
    code: 'VAL_005',
    message: 'Invalid time format',
    userMessage: "'{input}' isn't a valid time. Use formats like: 14:30, 2:30 PM, or 02:30",
    httpStatus: 400,
    retryable: false
  },
  
  EMPTY_REQUIRED_FIELD: {
    code: 'CNT_001',
    message: 'Required field is empty',
    userMessage: "I need {fieldName} to complete this. Could you provide it?",
    httpStatus: 400,
    retryable: false
  },
  
  EXCESSIVE_LENGTH: {
    code: 'CNT_005',
    message: 'Content exceeds maximum length',
    userMessage: "This content is too long ({currentLength} chars). Maximum is {maxLength}. Would you like me to:\n1. Truncate it\n2. Split into multiple parts\n3. Summarize it",
    httpStatus: 400,
    retryable: false
  }
};

// ========== HTTP/API ERRORS ==========
const HTTP_ERRORS = {
  BAD_REQUEST: {
    code: 'HTTP_400',
    message: 'Bad request',
    userMessage: "I sent an invalid request to {service}. Let me try a different approach...",
    httpStatus: 400,
    retryable: true
  },
  
  UNAUTHORIZED: {
    code: 'HTTP_401',
    message: 'Unauthorized',
    userMessage: "Authentication failed with {service}. Let me refresh your credentials...",
    httpStatus: 401,
    retryable: true,
    action: 'attempt_token_refresh'
  },
  
  FORBIDDEN: {
    code: 'HTTP_403',
    message: 'Forbidden',
    userMessage: "I don't have permission to {action} in {service}. You may need to grant additional access.",
    httpStatus: 403,
    retryable: false
  },
  
  NOT_FOUND: {
    code: 'HTTP_404',
    message: 'Resource not found',
    userMessage: "I couldn't find {resource} in {service}. It may have been deleted or moved.",
    httpStatus: 404,
    retryable: false
  },
  
  CONFLICT: {
    code: 'HTTP_409',
    message: 'Conflict',
    userMessage: "There's a conflict with {resource}. {conflictReason}",
    httpStatus: 409,
    retryable: false
  },
  
  RATE_LIMIT: {
    code: 'HTTP_429',
    message: 'Rate limit exceeded',
    userMessage: "I'm hitting {service}'s rate limit. I'll wait {retryAfter} seconds and try again...",
    httpStatus: 429,
    retryable: true,
    retryStrategy: {
      maxRetries: 5,
      backoff: [1, 2, 5, 10, 30] // seconds
    }
  },
  
  SERVER_ERROR: {
    code: 'HTTP_500',
    message: 'Internal server error',
    userMessage: "{service} is experiencing issues. I'll retry in a moment...",
    httpStatus: 500,
    retryable: true,
    maxRetries: 3
  },
  
  BAD_GATEWAY: {
    code: 'HTTP_502',
    message: 'Bad gateway',
    userMessage: "{service} gateway error. This is usually temporary. Retrying...",
    httpStatus: 502,
    retryable: true
  },
  
  SERVICE_UNAVAILABLE: {
    code: 'HTTP_503',
    message: 'Service unavailable',
    userMessage: "{service} is temporarily unavailable. I'll queue this and try again later.",
    httpStatus: 503,
    retryable: true,
    retryAfter: 300 // 5 minutes
  },
  
  GATEWAY_TIMEOUT: {
    code: 'HTTP_504',
    message: 'Gateway timeout',
    userMessage: "{service} took too long to respond. Let me try again with a longer timeout...",
    httpStatus: 504,
    retryable: true
  }
};

// ========== NETWORK ERRORS ==========
const NETWORK_ERRORS = {
  CONNECTION_REFUSED: {
    code: 'NET_001',
    message: 'Connection refused',
    userMessage: "Can't connect to {service}. Checking if it's online...",
    httpStatus: 503,
    retryable: true
  },
  
  DNS_RESOLUTION_FAILED: {
    code: 'NET_002',
    message: 'DNS resolution failed',
    userMessage: "Can't resolve {hostname}. There might be a network issue.",
    httpStatus: 503,
    retryable: true
  },
  
  SSL_CERTIFICATE_ERROR: {
    code: 'NET_003',
    message: 'SSL certificate error',
    userMessage: "Security certificate issue with {service}. This might be a security risk.",
    httpStatus: 495,
    retryable: false
  },
  
  NETWORK_TIMEOUT: {
    code: 'NET_004',
    message: 'Network timeout',
    userMessage: "Network request timed out. Retrying with longer timeout...",
    httpStatus: 504,
    retryable: true,
    timeouts: {
      initial: 10000,
      retry1: 20000,
      retry2: 30000
    }
  },
  
  CONNECTION_RESET: {
    code: 'NET_005',
    message: 'Connection reset',
    userMessage: "Connection was interrupted. Retrying...",
    httpStatus: 503,
    retryable: true,
    maxRetries: 3
  }
};

// ========== DATA PROCESSING ERRORS ==========
const PARSING_ERRORS = {
  JSON_PARSE_ERROR: {
    code: 'PRS_001',
    message: 'Invalid JSON response',
    userMessage: "I received malformed data from {service}. Trying again...",
    httpStatus: 500,
    retryable: true,
    action: 'retry_or_use_fallback_parser'
  },
  
  DATE_PARSE_ERROR: {
    code: 'PRS_002',
    message: 'Ambiguous date format',
    userMessage: "I'm not sure about the date '{input}'. Did you mean:\n1. {interpretation1}\n2. {interpretation2}",
    httpStatus: 400,
    retryable: false,
    action: 'request_clarification'
  },
  
  ENCODING_ERROR: {
    code: 'PRS_003',
    message: 'Character encoding issues',
    userMessage: "Some characters couldn't be processed. I'll use the closest alternatives.",
    httpStatus: 400,
    retryable: false,
    action: 'normalize_to_utf8'
  },
  
  CSV_PARSE_ERROR: {
    code: 'PRS_004',
    message: 'Malformed CSV data',
    userMessage: "The CSV file has formatting issues on line {lineNumber}. Should I:\n1. Skip invalid rows\n2. Attempt to fix them\n3. Cancel import",
    httpStatus: 400,
    retryable: false,
    action: 'offer_repair_options'
  },
  
  HTML_SANITIZATION: {
    code: 'PRS_005',
    message: 'Unsafe HTML content',
    userMessage: "I removed some potentially unsafe HTML elements for security.",
    httpStatus: 200,
    retryable: false,
    action: 'sanitize_and_notify'
  }
};

const TRANSFORMATION_ERRORS = {
  TYPE_CONVERSION_FAILED: {
    code: 'TRF_001',
    message: 'Type conversion failed',
    userMessage: "I can't convert '{value}' to {targetType}. Expected format: {expectedFormat}",
    httpStatus: 400,
    retryable: false
  },
  
  TIMEZONE_CONVERSION_ERROR: {
    code: 'TRF_002',
    message: 'Invalid timezone',
    userMessage: "'{timezone}' isn't a recognized timezone. Did you mean: {suggestions}?",
    httpStatus: 400,
    retryable: false,
    action: 'fuzzy_match_timezone'
  },
  
  CURRENCY_CONVERSION_ERROR: {
    code: 'TRF_003',
    message: 'Unknown currency code',
    userMessage: "I don't recognize currency '{code}'. Use standard codes like USD, EUR, GBP.",
    httpStatus: 400,
    retryable: false,
    action: 'suggest_valid_currencies'
  },
  
  UNIT_CONVERSION_ERROR: {
    code: 'TRF_004',
    message: 'Incompatible units',
    userMessage: "I can't convert {fromUnit} to {toUnit} (different measurement types).",
    httpStatus: 400,
    retryable: false
  }
};

// ========== APP-SPECIFIC ERRORS ==========
const GMAIL_ERRORS = {
  RECIPIENT_NOT_FOUND: {
    code: 'GMAIL_001',
    message: 'Email address does not exist',
    userMessage: "The email address '{email}' doesn't seem to exist. Double-check the spelling?",
    httpStatus: 400,
    retryable: false,
    action: 'suggest_contacts_or_correction'
  },
  
  ATTACHMENT_TOO_LARGE: {
    code: 'GMAIL_002',
    message: 'Attachment exceeds 25MB limit',
    userMessage: "Attachment is {size} (limit: 25MB). I'll upload to Google Drive and share a link instead.",
    httpStatus: 413,
    retryable: false,
    action: 'auto_convert_to_drive_link'
  },
  
  SPAM_DETECTED: {
    code: 'GMAIL_003',
    message: 'Email flagged as spam',
    userMessage: "This email might be flagged as spam because: {reason}. Send anyway?",
    httpStatus: 400,
    retryable: false,
    action: 'require_confirmation'
  },
  
  DRAFT_NOT_FOUND: {
    code: 'GMAIL_005',
    message: 'Draft not found',
    userMessage: "I couldn't find that draft. It may have been deleted or sent already.",
    httpStatus: 404,
    retryable: false,
    action: 'list_available_drafts'
  },
  
  LABEL_CONFLICT: {
    code: 'GMAIL_006',
    message: 'Label already exists',
    userMessage: "Label '{labelName}' already exists. Use the existing one or choose a different name?",
    httpStatus: 409,
    retryable: false,
    action: 'offer_use_existing_or_rename'
  }
};

const CALENDAR_ERRORS = {
  EVENT_CONFLICT: {
    code: 'CAL_001',
    message: 'Overlapping events',
    userMessage: "You already have '{existingEvent}' at this time. Should I:\n1. Create anyway\n2. Find next available slot\n3. Cancel",
    httpStatus: 409,
    retryable: false,
    action: 'offer_conflict_resolution'
  },
  
  PAST_EVENT_CREATION: {
    code: 'CAL_002',
    message: 'Creating event in the past',
    userMessage: "This time has already passed. Did you mean:\n1. {futureOption1}\n2. {futureOption2}\n3. Create past event for records",
    httpStatus: 400,
    retryable: false,
    action: 'suggest_future_alternatives'
  },
  
  ATTENDEE_LIMIT_EXCEEDED: {
    code: 'CAL_003',
    message: 'Attendee limit exceeded',
    userMessage: "Google Calendar limits events to 200 attendees. You have {count}. Consider:\n1. Split into multiple events\n2. Use Google Meet for larger groups",
    httpStatus: 400,
    retryable: false,
    action: 'suggest_alternatives'
  },
  
  RECURRING_EVENT_ERROR: {
    code: 'CAL_005',
    message: 'Invalid recurrence rule',
    userMessage: "The recurrence pattern isn't valid: {reason}",
    httpStatus: 400,
    retryable: false
  },
  
  TIMEZONE_MISMATCH: {
    code: 'CAL_006',
    message: 'Timezone mismatch',
    userMessage: "Attendees are in different timezones. I'll send invites with timezone info:\n• {attendee1}: {time1}\n• {attendee2}: {time2}",
    httpStatus: 200,
    retryable: false,
    action: 'show_multi_timezone_times'
  }
};

const GITHUB_ERRORS = {
  REPO_NOT_FOUND: {
    code: 'GH_001',
    message: 'Repository not found',
    userMessage: "Repository '{owner}/{repo}' not found. Check the name or your access permissions.",
    httpStatus: 404,
    retryable: false,
    action: 'search_similar_repos'
  },
  
  BRANCH_NOT_FOUND: {
    code: 'GH_002',
    message: 'Branch not found',
    userMessage: "Branch '{branchName}' doesn't exist. Available branches: {branchList}",
    httpStatus: 404,
    retryable: false,
    action: 'list_branches'
  },
  
  MERGE_CONFLICT: {
    code: 'GH_003',
    message: 'Merge conflict',
    userMessage: "This PR has merge conflicts in:\n{conflictFiles}\n\nResolve conflicts manually before merging.",
    httpStatus: 409,
    retryable: false,
    action: 'provide_conflict_resolution_guide'
  },
  
  PROTECTED_BRANCH: {
    code: 'GH_004',
    message: 'Protected branch',
    userMessage: "'{branchName}' is protected. You need to:\n1. Create a PR\n2. Get required approvals\n3. Pass status checks",
    httpStatus: 403,
    retryable: false,
    action: 'suggest_pr_workflow'
  },
  
  FILE_SIZE_LIMIT: {
    code: 'GH_005',
    message: 'File size limit exceeded',
    userMessage: "GitHub blocks files over 100MB. Your file is {size}. Use Git LFS instead?",
    httpStatus: 413,
    retryable: false,
    action: 'suggest_git_lfs'
  }
};

const SEARCH_ERRORS = {
  NO_RESULTS: {
    code: 'SRCH_001',
    message: 'No search results',
    userMessage: "I couldn't find anything for '{query}'. Try:\n• Different keywords\n• Broader terms\n• Checking spelling",
    httpStatus: 404,
    retryable: false,
    action: 'suggest_query_refinement'
  },
  
  SEARCH_TIMEOUT: {
    code: 'SRCH_002',
    message: 'Search timeout',
    userMessage: "Search is taking longer than expected. I'll try a simpler query...",
    httpStatus: 504,
    retryable: true,
    action: 'simplify_and_retry'
  },
  
  AMBIGUOUS_QUERY: {
    code: 'SRCH_003',
    message: 'Ambiguous query',
    userMessage: "'{query}' is quite broad. Could you be more specific? For example:\n• {suggestion1}\n• {suggestion2}",
    httpStatus: 400,
    retryable: false,
    action: 'request_clarification'
  }
};

// ========== WORKFLOW ERRORS ==========
const WORKFLOW_ERRORS = {
  DEPENDENCY_FAILED: {
    code: 'WF_001',
    message: 'Workflow dependency failed',
    userMessage: "I couldn't {step1Action}, so I can't continue with {step2Action}. Should I:\n1. Retry {step1Action}\n2. Skip and continue\n3. Cancel workflow",
    httpStatus: 500,
    retryable: true,
    action: 'offer_recovery_options'
  },
  
  PARTIAL_SUCCESS: {
    code: 'WF_002',
    message: 'Partial workflow success',
    userMessage: "✅ Completed: {successfulSteps}\n❌ Failed: {failedSteps}\n\nRetry failed steps?",
    httpStatus: 207,
    retryable: true,
    action: 'show_detailed_status_and_offer_retry'
  },
  
  TIMEOUT_WORKFLOW: {
    code: 'WF_004',
    message: 'Workflow timeout',
    userMessage: "This workflow is taking longer than expected ({elapsed}). Continue waiting or cancel?",
    httpStatus: 504,
    retryable: true,
    action: 'offer_continue_or_cancel'
  },
  
  ROLLBACK_REQUIRED: {
    code: 'WF_005',
    message: 'Rollback required',
    userMessage: "An error occurred. Rolling back changes:\n{rollbackSteps}",
    httpStatus: 500,
    retryable: false,
    action: 'execute_compensating_transactions'
  }
};

// ========== SCHEDULER ERRORS ==========
const SCHEDULER_ERRORS = {
  PAST_SCHEDULE_TIME: {
    code: 'SCH_001',
    message: 'Schedule time in the past',
    userMessage: "That time has already passed. Did you mean:\n1. {nextOccurrence}\n2. Tomorrow at same time\n3. Different time",
    httpStatus: 400,
    retryable: false,
    action: 'suggest_future_alternatives'
  },
  
  INVALID_CRON: {
    code: 'SCH_002',
    message: 'Invalid cron expression',
    userMessage: "Schedule format error: {reason}\n\nExample: '0 9 * * 1' = Every Monday at 9 AM",
    httpStatus: 400,
    retryable: false,
    action: 'provide_cron_examples'
  },
  
  SCHEDULE_TOO_FAR: {
    code: 'SCH_003',
    message: 'Schedule too far in future',
    userMessage: "I can only schedule up to 1 month ahead. Your date is {daysAway} days away.",
    httpStatus: 400,
    retryable: false,
    action: 'suggest_max_date'
  },
  
  SCHEDULE_TOO_SOON: {
    code: 'SCH_004',
    message: 'Schedule too soon',
    userMessage: "Schedules must be at least 4 minutes in the future. Earliest time: {minTime}",
    httpStatus: 400,
    retryable: false,
    action: 'suggest_minimum_time'
  },
  
  TIMEZONE_AMBIGUITY: {
    code: 'SCH_007',
    message: 'Timezone ambiguity',
    userMessage: "'3 PM' in which timezone?\n1. {userTimezone}\n2. {detectedTimezone}\n3. Specify manually",
    httpStatus: 400,
    retryable: false,
    action: 'request_timezone_clarification'
  }
};

// ========== FILE ERRORS ==========
const FILE_ERRORS = {
  FILE_TOO_LARGE: {
    code: 'FILE_001',
    message: 'File too large',
    userMessage: "File is {size} (limit: {limit}). Options:\n1. Compress file\n2. Split into parts\n3. Use cloud link",
    httpStatus: 413,
    retryable: false,
    action: 'offer_alternatives'
  },
  
  UNSUPPORTED_FILE_TYPE: {
    code: 'FILE_002',
    message: 'Unsupported file type',
    userMessage: "I can't process {fileType} files. Supported formats: {supportedFormats}",
    httpStatus: 415,
    retryable: false,
    action: 'list_supported_formats'
  },
  
  CORRUPTED_FILE: {
    code: 'FILE_003',
    message: 'Corrupted file',
    userMessage: "This file appears to be corrupted or incomplete. Try re-uploading?",
    httpStatus: 400,
    retryable: false,
    action: 'request_reupload'
  },
  
  VIRUS_DETECTED: {
    code: 'FILE_004',
    message: 'Virus detected',
    userMessage: "⚠️ Security scan detected potential malware. File blocked for safety.",
    httpStatus: 403,
    retryable: false,
    action: 'block_and_log'
  },
  
  FILENAME_INVALID: {
    code: 'FILE_005',
    message: 'Invalid filename',
    userMessage: "Filename contains invalid characters: {invalidChars}. I'll rename it to '{sanitizedName}'.",
    httpStatus: 400,
    retryable: false,
    action: 'auto_sanitize_filename'
  }
};

// ========== UX ERRORS ==========
const UX_ERRORS = {
  AMBIGUOUS_REFERENCE: {
    code: 'UX_001',
    message: 'Ambiguous reference',
    userMessage: "When you say '{reference}', do you mean:\n1. {option1}\n2. {option2}\n3. Something else",
    httpStatus: 400,
    retryable: false,
    action: 'request_clarification'
  },
  
  MISSING_CONTEXT: {
    code: 'UX_002',
    message: 'Missing context',
    userMessage: "I don't have enough context for '{request}'. Could you provide more details?",
    httpStatus: 400,
    retryable: false,
    action: 'request_context'
  },
  
  CONTRADICTORY_INSTRUCTIONS: {
    code: 'UX_003',
    message: 'Contradictory instructions',
    userMessage: "You asked me to both {action1} and {action2}, which conflict. Which should I do?",
    httpStatus: 400,
    retryable: false,
    action: 'request_clarification'
  },
  
  UNCLEAR_INTENT: {
    code: 'UX_004',
    message: 'Unclear intent',
    userMessage: "I'm not sure what you'd like me to do. Are you asking me to:\n1. {interpretation1}\n2. {interpretation2}\n3. Something else",
    httpStatus: 400,
    retryable: false,
    action: 'request_clarification'
  }
};

const SAFETY_CHECKS = {
  DESTRUCTIVE_ACTION: {
    code: 'SAFE_001',
    message: 'Destructive action requires confirmation',
    userMessage: "⚠️ This will permanently {action}. Are you sure?\n\nType 'CONFIRM' to proceed.",
    httpStatus: 400,
    retryable: false,
    requireExplicitConfirmation: true
  },
  
  BULK_OPERATION_WARNING: {
    code: 'SAFE_002',
    message: 'Bulk operation warning',
    userMessage: "This will affect {count} items. Proceed?\n\n✅ Yes, continue\n❌ No, cancel",
    httpStatus: 400,
    retryable: false,
    threshold: 50
  },
  
  SENSITIVE_DATA_EXPOSURE: {
    code: 'SAFE_003',
    message: 'Sensitive data exposure',
    userMessage: "⚠️ You're about to share {dataType} with {recipient}. This may contain sensitive information. Continue?",
    httpStatus: 400,
    retryable: false,
    action: 'require_confirmation'
  }
};

module.exports = {
  SYSTEM_ERRORS,
  PLATFORM_ERRORS,
  AUTH_ERRORS,
  PERMISSION_ERRORS,
  VALIDATION_ERRORS,
  HTTP_ERRORS,
  NETWORK_ERRORS,
  PARSING_ERRORS,
  TRANSFORMATION_ERRORS,
  GMAIL_ERRORS,
  CALENDAR_ERRORS,
  GITHUB_ERRORS,
  SEARCH_ERRORS,
  WORKFLOW_ERRORS,
  SCHEDULER_ERRORS,
  FILE_ERRORS,
  UX_ERRORS,
  SAFETY_CHECKS,
  
  // Helper to get all error types
  getAllErrorTypes: () => ({
    ...SYSTEM_ERRORS,
    ...PLATFORM_ERRORS,
    ...AUTH_ERRORS,
    ...PERMISSION_ERRORS,
    ...VALIDATION_ERRORS,
    ...HTTP_ERRORS,
    ...NETWORK_ERRORS,
    ...PARSING_ERRORS,
    ...TRANSFORMATION_ERRORS,
    ...GMAIL_ERRORS,
    ...CALENDAR_ERRORS,
    ...GITHUB_ERRORS,
    ...SEARCH_ERRORS,
    ...WORKFLOW_ERRORS,
    ...SCHEDULER_ERRORS,
    ...FILE_ERRORS,
    ...UX_ERRORS,
    ...SAFETY_CHECKS
  })
};
