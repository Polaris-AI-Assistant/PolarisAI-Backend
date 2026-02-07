/**
 * Configuration file for PolarisAI Backend
 * Centralizes all configurable settings for easy management
 */

// LLM Model Configuration
// Change these values to test with different models
const LLM_MODELS = {
  // Primary model for complex tasks (calendar, maps, sheets)
  PRIMARY: process.env.LLM_MODEL_PRIMARY || 'gpt-4o',
  
  // Secondary model for simpler/cost-effective tasks
  SECONDARY: process.env.LLM_MODEL_SECONDARY || 'gpt-4o-mini',
  
  // Default model (used when no specific model is needed)
  DEFAULT: process.env.LLM_MODEL_DEFAULT || 'gpt-4o-mini',
};

// Available models for reference
const AVAILABLE_MODELS = {
  OPENAI: [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo',
  ],
  // Add other providers as needed
  // ANTHROPIC: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
  // GOOGLE: ['gemini-pro', 'gemini-ultra'],
};

// Export configuration
module.exports = {
  LLM_MODELS,
  AVAILABLE_MODELS,
};
