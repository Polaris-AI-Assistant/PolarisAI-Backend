/**
 * Centralized OpenAI Model Configuration
 * 
 * This file provides a single source of truth for OpenAI model configuration
 * across the entire Polaris AI platform.
 */

// Default model configuration
const DEFAULT_MODEL = 'gpt-4.1';

// Model configuration with fallback
const MODEL_CONFIG = {
  // Primary model for all agents (configurable via environment variable)
  PRIMARY_MODEL: process.env.OPENAI_MODEL || DEFAULT_MODEL,
  
  // Specific models for different use cases
  INTENT_CLASSIFICATION: process.env.OPENAI_INTENT_MODEL || process.env.OPENAI_MODEL || DEFAULT_MODEL,
  MAIN_AGENT: process.env.OPENAI_MAIN_MODEL || process.env.OPENAI_MODEL || DEFAULT_MODEL,
  CONVERSATIONAL: process.env.OPENAI_CONVERSATIONAL_MODEL || process.env.OPENAI_MODEL || DEFAULT_MODEL,
  
  // Embedding model (separate from chat models)
  EMBEDDING: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
  
  // Legacy support for specific agents that might need different models
  CALENDAR_AGENT: process.env.OPENAI_CALENDAR_MODEL || process.env.OPENAI_MODEL || DEFAULT_MODEL,
  DOCS_AGENT: process.env.OPENAI_DOCS_MODEL || process.env.OPENAI_MODEL || DEFAULT_MODEL,
  SHEETS_AGENT: process.env.OPENAI_SHEETS_MODEL || process.env.OPENAI_MODEL || DEFAULT_MODEL,
  MAPS_AGENT: process.env.OPENAI_MAPS_MODEL || process.env.OPENAI_MODEL || DEFAULT_MODEL,
  RESEARCH_AGENT: process.env.OPENAI_RESEARCH_MODEL || process.env.OPENAI_MODEL || DEFAULT_MODEL,
  
  // Cost-effective models for simple tasks
  SIMPLE_TASKS: process.env.OPENAI_SIMPLE_MODEL || process.env.OPENAI_MODEL || DEFAULT_MODEL,
};

/**
 * Get the model for a specific use case
 * @param {string} useCase - The use case (e.g., 'main', 'intent', 'calendar')
 * @returns {string} The model name to use
 */
function getModel(useCase = 'primary') {
  const key = useCase.toUpperCase().replace('-', '_');
  return MODEL_CONFIG[key] || MODEL_CONFIG.PRIMARY_MODEL;
}

/**
 * Get the primary model (most commonly used)
 * @returns {string} The primary model name
 */
function getPrimaryModel() {
  return MODEL_CONFIG.PRIMARY_MODEL;
}

/**
 * Get the embedding model
 * @returns {string} The embedding model name
 */
function getEmbeddingModel() {
  return MODEL_CONFIG.EMBEDDING;
}

/**
 * Check if a model is GPT-4 based (for capability checks)
 * @param {string} model - The model name
 * @returns {boolean} True if it's a GPT-4 model
 */
function isGPT4Model(model = MODEL_CONFIG.PRIMARY_MODEL) {
  return model.toLowerCase().includes('gpt-4');
}

/**
 * Check if a model supports vision (for image processing)
 * @param {string} model - The model name
 * @returns {boolean} True if it supports vision
 */
function supportsVision(model = MODEL_CONFIG.PRIMARY_MODEL) {
  const visionModels = ['gpt-4-vision', 'gpt-4-turbo', 'gpt-4o'];
  return visionModels.some(vm => model.toLowerCase().includes(vm));
}

/**
 * Get model configuration summary for logging
 * @returns {object} Configuration summary
 */
function getConfigSummary() {
  return {
    primary: MODEL_CONFIG.PRIMARY_MODEL,
    embedding: MODEL_CONFIG.EMBEDDING,
    isGPT4: isGPT4Model(),
    supportsVision: supportsVision(),
    configuredViaEnv: !!process.env.OPENAI_MODEL,
  };
}

module.exports = {
  MODEL_CONFIG,
  getModel,
  getPrimaryModel,
  getEmbeddingModel,
  isGPT4Model,
  supportsVision,
  getConfigSummary,
  
  // Export individual models for backward compatibility
  PRIMARY_MODEL: MODEL_CONFIG.PRIMARY_MODEL,
  INTENT_MODEL: MODEL_CONFIG.INTENT_CLASSIFICATION,
  MAIN_MODEL: MODEL_CONFIG.MAIN_AGENT,
  EMBEDDING_MODEL: MODEL_CONFIG.EMBEDDING,
};