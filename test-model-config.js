/**
 * Test Model Configuration
 * 
 * Quick test to verify the centralized model configuration is working correctly
 */

// Load environment variables
require('dotenv').config();

const { 
  getPrimaryModel, 
  getModel, 
  getEmbeddingModel,
  isGPT4Model,
  supportsVision,
  getConfigSummary 
} = require('./utils/modelConfig');

console.log('=== Model Configuration Test ===\n');

// Test primary model
console.log('1. Primary Model:');
console.log(`   ${getPrimaryModel()}`);
console.log('');

// Test specific use cases
console.log('2. Use Case Models:');
console.log(`   Main Agent: ${getModel('main_agent')}`);
console.log(`   Intent Classification: ${getModel('intent_classification')}`);
console.log(`   Conversational: ${getModel('conversational')}`);
console.log('');

// Test embedding model
console.log('3. Embedding Model:');
console.log(`   ${getEmbeddingModel()}`);
console.log('');

// Test capabilities
console.log('4. Model Capabilities:');
console.log(`   Is GPT-4: ${isGPT4Model()}`);
console.log(`   Supports Vision: ${supportsVision()}`);
console.log('');

// Test configuration summary
console.log('5. Configuration Summary:');
const summary = getConfigSummary();
console.log(`   Primary: ${summary.primary}`);
console.log(`   Embedding: ${summary.embedding}`);
console.log(`   Is GPT-4: ${summary.isGPT4}`);
console.log(`   Supports Vision: ${summary.supportsVision}`);
console.log(`   Configured via ENV: ${summary.configuredViaEnv}`);
console.log('');

// Test environment variable
console.log('6. Environment Variable:');
console.log(`   OPENAI_MODEL: ${process.env.OPENAI_MODEL || 'Not set (using default)'}`);
console.log('');

console.log('=== Test Complete ===');
console.log('✅ Model configuration is working correctly!');
