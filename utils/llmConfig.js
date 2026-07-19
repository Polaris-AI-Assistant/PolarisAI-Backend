/**
 * LLM Configuration Utility
 * 
 * Centralizes all LLM settings to ensure consistency across agents.
 * Prevents temperature inconsistencies that cause response variability.
 * 
 * Key Principles:
 * - LOW TEMPERATURE for deterministic behavior (reasoning, tool selection)
 * - CONSISTENT across all LLM calls
 * - EXPLICIT system prompts with reasoning guidance
 * - INPUT NORMALIZATION for stable parsing
 * - SEED for reproducibility
 */

const { getPrimaryModel } = require('./modelConfig');

class LLMConfig {
  /**
   * Temperature profiles for different use cases
   */
  static TEMPERATURE = {
    // For critical decision-making (intent classification, tool selection)
    DETERMINISTIC: 0.1,
    
    // For reasoning and analysis
    ANALYTICAL: 0.15,
    
    // For general responses
    NORMAL: 0.2,
    
    // NEVER use these values anymore:
    // 0.7 causes HIGH RANDOMNESS - tool selection becomes unpredictable
    // 1.0 causes CHAOS - response completely different each time
  };

  /**
   * System prompt for chain-of-thought reasoning
   * Instructs LLM to think before acting
   */
  static THINKING_INSTRUCTION = `You MUST follow this 2-step process:

STEP 1: ANALYZE & REASON
- Understand the user's intent clearly
- Identify what information is needed
- Plan which tools to use and in what order
- Think about edge cases

STEP 2: EXECUTE
- Based on your analysis, select the appropriate tool or provide response
- Ensure all parameters are valid
- Double-check before executing

Follow this process ALWAYS before making decisions.`;

  /**
   * Normalize user input for consistent parsing
   * Removes variations that could cause query understanding issues
   */
  static normalizeInput(input) {
    if (!input || typeof input !== 'string') return '';
    
    return input
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim()
      // Remove extra punctuation variations
      .replace(/([?!.])([?!.])+/g, '$1')
      // Standardize contractions
      .replace(/\bwhat's\b/gi, 'what is')
      .replace(/\bhow's\b/gi, 'how is')
      .replace(/\bi'm\b/gi, 'i am')
      .replace(/\byou're\b/gi, 'you are')
      .replace(/\bcan't\b/gi, 'cannot')
      .replace(/\bwon't\b/gi, 'will not')
      .replace(/\bdon't\b/gi, 'do not')
      .replace(/\bdoesn't\b/gi, 'does not')
      .replace(/\bdidn't\b/gi, 'did not')
      // Remove redundant filler words (keep max 1 occurrence)
      .replace(/\b(just|only)\s+(just|only)\b/gi, '$2')
      .toLowerCase();
  }

  /**
   * Get standardized completion parameters for any LLM call
   * Ensures consistency across entire system
   */
  static getCompletionParams(options = {}) {
    const {
      temperature = this.TEMPERATURE.DETERMINISTIC,
      maxTokens = 1500,
      responseFormat = undefined,
      seed = true, // Enable reproducibility
      topP = 0.95,
      frequencyPenalty = 0,
      presencePenalty = 0,
    } = options;

    const params = {
      model: getPrimaryModel(), // Use centralized model configuration
      temperature: Math.min(temperature, this.TEMPERATURE.DETERMINISTIC), // Cap at 0.1 max
      max_tokens: maxTokens,
      top_p: topP,
      frequency_penalty: frequencyPenalty,
      presence_penalty: presencePenalty,
    };

    // Add response format if specified
    if (responseFormat) {
      params.response_format = responseFormat;
    }

    // Add seed for reproducibility (if OpenAI version supports it)
    if (seed && process.env.ENABLE_LLM_REPRODUCIBILITY !== 'false') {
      // Seed ensures same input produces same output (only with temperature=0)
      if (temperature === 0) {
        params.seed = 42; // Fixed seed for reproducibility
      }
    }

    return params;
  }

  /**
   * Create a system prompt with reasoning instruction
   */
  static createSystemPrompt(basePrompt = '') {
    return `${this.THINKING_INSTRUCTION}

${basePrompt}`;
  }

  /**
   * Standardize OpenAI completion call signature
   * Ensures all agents use consistent patterns
   */
  static async createCompletion(openaiClient, messages, options = {}) {
    const params = this.getCompletionParams(options);
    
    return await openaiClient.chat.completions.create({
      ...params,
      messages,
    });
  }

  /**
   * Wrap tool definition with reasoning instruction
   */
  static createToolMessage(content, isThinking = false) {
    if (isThinking) {
      return `🧠 THINKING PROCESS:\n${content}`;
    }
    return content;
  }

  /**
   * Validate that temperature is safe (≤ 0.2 for deterministic behavior)
   */
  static validateTemperature(temperature) {
    if (temperature > 0.2) {
      console.warn(
        `⚠️ [LLMConfig] Temperature ${temperature} is too high for deterministic behavior. ` +
        `Recommended: ≤ 0.2. Using 0.1 instead.`
      );
      return 0.1;
    }
    return temperature;
  }
}

module.exports = LLMConfig;
