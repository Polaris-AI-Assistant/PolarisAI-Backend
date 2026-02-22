/**
 * Test script to verify web search intent classification
 * 
 * Run with: node test-websearch-intent.js
 */

require('dotenv').config();
const IntentClassifier = require('./intentClassifier');

async function testWebSearchIntents() {
  const classifier = new IntentClassifier();
  
  const testQueries = [
    "do u know about latest ai summit happening in delhi, India?",
    "what's the latest news about Tesla?",
    "tell me about recent AI developments",
    "is there a tech conference happening this week?",
    "what's the weather in Mumbai today?",
    "how do I create a google form?", // Should be advisory
    "create a google form", // Should be actionable
    "what is my name?", // Should be conversational
  ];

  console.log('🧪 Testing Web Search Intent Classification\n');
  console.log('='.repeat(80));
  
  for (const query of testQueries) {
    console.log(`\n📝 Query: "${query}"`);
    try {
      const result = await classifier.classify(query, []);
      console.log(`✅ Type: ${result.type}`);
      console.log(`   Confidence: ${result.confidence}`);
      console.log(`   Requires Web Search: ${result.requiresWebSearch || false}`);
      console.log(`   Reasoning: ${result.reasoning}`);
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
    }
    console.log('-'.repeat(80));
  }
}

// Run the tests
testWebSearchIntents().catch(console.error);
