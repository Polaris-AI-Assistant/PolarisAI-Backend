// TypeScript definitions for AI email composition

/**
 * Request interface for AI email composition
 */
export interface EmailPromptRequest {
  /** Natural language description of the email to compose */
  userPrompt: string;
  
  /** Recipient email address */
  recipientEmail: string;
  
  /** Additional context for email generation */
  context?: string;
  
  /** OpenAI model to use (default: gpt-4o-mini) */
  model?: 'gpt-4o-mini' | 'gpt-4o' | 'gpt-3.5-turbo';
  
  /** Temperature for AI generation (0-1, default: 0.7) */
  temperature?: number;
  
  /** Whether to generate HTML email content */
  isHtml?: boolean;
}

/**
 * Generated email content structure
 */
export interface GeneratedEmailContent {
  /** Generated email subject */
  subject: string;
  
  /** Generated email body */
  body: string;
}

/**
 * Successful response from AI email composition
 */
export interface EmailPromptSuccess {
  success: true;
  
  /** Gmail API message ID */
  messageId: string;
  
  /** Gmail API thread ID */
  threadId: string;
  
  /** The generated email content */
  generatedContent: GeneratedEmailContent;
  
  /** Email recipient */
  recipient: string;
  
  /** Original user prompt */
  prompt: string;
  
  /** Success message */
  message: string;
}

/**
 * Failed response from AI email composition
 */
export interface EmailPromptError {
  success: false;
  
  /** Error message */
  error: string;
  
  /** Stage where error occurred */
  stage: 'validation' | 'generation' | 'sending';
  
  /** Email recipient (if provided) */
  recipient?: string;
  
  /** Original user prompt (if provided) */
  prompt?: string;
}

/**
 * Union type for AI email composition response
 */
export type EmailPromptResponse = EmailPromptSuccess | EmailPromptError;

/**
 * Options for handleEmailPrompt function
 */
export interface HandleEmailPromptOptions {
  /** Additional context for email generation */
  context?: string;
  
  /** OpenAI model to use */
  model?: string;
  
  /** Temperature for AI generation */
  temperature?: number;
  
  /** Maximum tokens for OpenAI response */
  maxTokens?: number;
  
  /** Whether to generate HTML email content */
  isHtml?: boolean;
}

/**
 * Authentication parameter for handleEmailPrompt
 * Can be either an OAuth2 client object or a user identifier string
 */
export type EmailPromptAuth = any | string;

/**
 * Main function signature for AI email composition
 */
export declare function handleEmailPrompt(
  auth: EmailPromptAuth,
  userPrompt: string,
  recipientEmail: string,
  options?: HandleEmailPromptOptions
): Promise<EmailPromptResponse>;

/**
 * Frontend utility function for making authenticated API calls
 */
export interface AuthenticatedFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
}

/**
 * Utility function to compose and send email via API
 */
export async function composeAndSendEmail(
  userPrompt: string,
  recipientEmail: string,
  options: {
    context?: string;
    model?: string;
    temperature?: number;
    isHtml?: boolean;
  } = {}
): Promise<EmailPromptResponse> {
  // This would be implemented in the frontend
  throw new Error('This function should be implemented in the frontend');
}

/**
 * Example usage patterns
 */
export const examples = {
  // Basic usage
  basic: {
    userPrompt: "Send a quick thank you note for the meeting",
    recipientEmail: "colleague@example.com"
  },
  
  // With context
  withContext: {
    userPrompt: "Tell them the project is delayed",
    recipientEmail: "manager@example.com",
    context: "We're working on the Gmail integration feature"
  },
  
  // Professional tone
  professional: {
    userPrompt: "Request a meeting to discuss quarterly results",
    recipientEmail: "executive@example.com",
    model: "gpt-4o",
    temperature: 0.3
  },
  
  // Friendly tone
  friendly: {
    userPrompt: "Ask how they're doing and if they need help",
    recipientEmail: "teammate@example.com",
    temperature: 0.8
  }
};

/**
 * Validation utilities
 */
export const validation = {
  /**
   * Validate email address format
   */
  isValidEmail: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },
  
  /**
   * Validate prompt length
   */
  isValidPrompt: (prompt: string): boolean => {
    return !!(prompt && prompt.trim().length > 0 && prompt.length <= 500);
  },
  
  /**
   * Validate request object
   */
  validateRequest: (request: EmailPromptRequest): string | null => {
    if (!request.userPrompt || !validation.isValidPrompt(request.userPrompt)) {
      return 'Invalid or missing userPrompt';
    }
    
    if (!request.recipientEmail || !validation.isValidEmail(request.recipientEmail)) {
      return 'Invalid or missing recipientEmail';
    }
    
    if (request.temperature !== undefined && (request.temperature < 0 || request.temperature > 1)) {
      return 'Temperature must be between 0 and 1';
    }
    
    return null;
  }
};
