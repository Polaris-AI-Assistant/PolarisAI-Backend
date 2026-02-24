/**
 * Retry Handler
 * 
 * Implements retry logic with exponential backoff for failed operations.
 */

const { PolarisError } = require('./ErrorHandler');

/**
 * Retry configuration
 */
const DEFAULT_RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
  retryableErrors: [
    'SYS_001', // SERVICE_DOWN
    'SYS_002', // TIMEOUT
    'SYS_003', // DEPENDENCY_FAILURE
    'HTTP_429', // RATE_LIMIT
    'HTTP_500', // SERVER_ERROR
    'HTTP_502', // BAD_GATEWAY
    'HTTP_503', // SERVICE_UNAVAILABLE
    'HTTP_504', // GATEWAY_TIMEOUT
    'NET_001', // CONNECTION_REFUSED
    'NET_002', // DNS_RESOLUTION_FAILED
    'NET_004', // NETWORK_TIMEOUT
    'NET_005'  // CONNECTION_RESET
  ]
};

/**
 * Check if error is retryable
 */
function isRetryable(error, config = DEFAULT_RETRY_CONFIG) {
  if (error instanceof PolarisError) {
    return error.retryable && config.retryableErrors.includes(error.code);
  }
  
  // Check for common retryable error patterns
  if (error.code === 'ECONNREFUSED' || 
      error.code === 'ETIMEDOUT' || 
      error.code === 'ECONNRESET') {
    return true;
  }
  
  if (error.response?.status === 429 || 
      error.response?.status === 503 || 
      error.response?.status === 504) {
    return true;
  }
  
  return false;
}

/**
 * Calculate delay for next retry with exponential backoff
 */
function calculateDelay(attempt, config = DEFAULT_RETRY_CONFIG) {
  const delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);
  return Math.min(delay, config.maxDelay);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
async function retry(fn, config = {}) {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError;
  
  for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
    try {
      console.log(`[Retry] Attempt ${attempt}/${retryConfig.maxAttempts}`);
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Check if error is retryable
      if (!isRetryable(error, retryConfig)) {
        console.log(`[Retry] Error not retryable: ${error.code || error.message}`);
        throw error;
      }
      
      // If this was the last attempt, throw the error
      if (attempt === retryConfig.maxAttempts) {
        console.log(`[Retry] Max attempts reached (${retryConfig.maxAttempts})`);
        throw error;
      }
      
      // Calculate delay and wait
      const delay = calculateDelay(attempt, retryConfig);
      console.log(`[Retry] Waiting ${delay}ms before retry...`);
      await sleep(delay);
    }
  }
  
  throw lastError;
}

/**
 * Retry with custom backoff strategy
 */
async function retryWithBackoff(fn, backoffDelays = [1000, 2000, 5000]) {
  let lastError;
  
  for (let attempt = 0; attempt < backoffDelays.length; attempt++) {
    try {
      console.log(`[RetryBackoff] Attempt ${attempt + 1}/${backoffDelays.length}`);
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (!isRetryable(error)) {
        throw error;
      }
      
      if (attempt < backoffDelays.length - 1) {
        const delay = backoffDelays[attempt];
        console.log(`[RetryBackoff] Waiting ${delay}ms before retry...`);
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
}

/**
 * Retry with rate limit handling
 */
async function retryWithRateLimit(fn, maxRetries = 5) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Check if it's a rate limit error
      if (error.code === 'HTTP_429' || error.response?.status === 429) {
        // Get retry-after header or use exponential backoff
        const retryAfter = error.response?.headers['retry-after'] || 
                          error.context?.retryAfter ||
                          calculateDelay(attempt) / 1000;
        
        if (attempt < maxRetries) {
          const delayMs = retryAfter * 1000;
          console.log(`[RateLimitRetry] Rate limited. Waiting ${retryAfter}s before retry...`);
          await sleep(delayMs);
          continue;
        }
      }
      
      // For other errors, check if retryable
      if (!isRetryable(error)) {
        throw error;
      }
      
      if (attempt < maxRetries) {
        const delay = calculateDelay(attempt);
        console.log(`[RateLimitRetry] Waiting ${delay}ms before retry...`);
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
}

/**
 * Circuit breaker pattern
 */
class CircuitBreaker {
  constructor(config = {}) {
    this.failureThreshold = config.failureThreshold || 5;
    this.resetTimeout = config.resetTimeout || 60000; // 1 minute
    this.failures = 0;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = Date.now();
  }
  
  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN. Service temporarily unavailable.');
      }
      this.state = 'HALF_OPEN';
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }
  
  onFailure() {
    this.failures++;
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
      console.log(`[CircuitBreaker] Circuit opened. Will retry after ${this.resetTimeout}ms`);
    }
  }
  
  getState() {
    return {
      state: this.state,
      failures: this.failures,
      nextAttempt: this.nextAttempt
    };
  }
}

module.exports = {
  retry,
  retryWithBackoff,
  retryWithRateLimit,
  isRetryable,
  calculateDelay,
  sleep,
  CircuitBreaker,
  DEFAULT_RETRY_CONFIG
};
