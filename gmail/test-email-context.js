/**
 * Test script to verify Gmail agent checks conversation history for email addresses
 * 
 * This test simulates the scenario where:
 * 1. User asks "What is Bhumika's email?"
 * 2. System responds with "bhumika15696@gmail.com"
 * 3. User says "Share document with Bhumika Yadav"
 * 4. System should use bhumika15696@gmail.com (NOT make up bhumika.yadav@example.com)
 */

require('dotenv').config();
const GmailAgentMultiStep = require('./gmailAgentMultiStep');
const OpenAI = require('openai');

async function testEmailContextExtraction() {
  console.log('\n🧪 Testing Gmail Agent Email Context Extraction\n');
  console.log('=' .repeat(60));
  
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const gmailAgent = new GmailAgentMultiStep(openai);
  
  // Simulate conversation history where email was mentioned
  const conversationHistory = [
    {
      role: 'user',
      content: 'What is Bhumika Yadav\'s email?'
    },
    {
      role: 'assistant',
      content: 'Bhumika Yadav\'s email is bhumika15696@gmail.com.'
    }
  ];
  
  // Test query that mentions name but not email
  const testQuery = `Send an email to Bhumika Yadav with subject "Test Document" and body "Here is the document you requested."`;
  
  console.log('\n📋 Test Scenario:');
  console.log('  Conversation History:');
  console.log('    User: "What is Bhumika Yadav\'s email?"');
  console.log('    AI: "Bhumika Yadav\'s email is bhumika15696@gmail.com."');
  console.log('\n  Current Query:');
  console.log(`    "${testQuery}"`);
  console.log('\n  Expected Behavior:');
  console.log('    ✅ Agent should check conversation history');
  console.log('    ✅ Agent should find bhumika15696@gmail.com');
  console.log('    ✅ Agent should use bhumika15696@gmail.com (NOT bhumika.yadav@example.com)');
  console.log('\n' + '='.repeat(60));
  
  try {
    console.log('\n🚀 Executing Gmail Agent...\n');
    
    // Note: This will fail at the actual email sending step because we don't have
    // valid Gmail credentials, but we can check the logs to see if it extracted
    // the correct email address from conversation history
    
    const result = await gmailAgent.processQuery(testQuery, {
      userId: 'test-user-id',
      conversationId: 'test-conversation-id',
      conversationHistory: conversationHistory,
      maxIterations: 2 // Limit iterations to avoid long execution
    });
    
    console.log('\n📊 Result:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.log('\n⚠️ Expected error (no Gmail credentials):', error.message);
    console.log('\n💡 Check the logs above to verify:');
    console.log('   1. Did the agent check conversation history?');
    console.log('   2. Did it find bhumika15696@gmail.com?');
    console.log('   3. Did it try to send to bhumika15696@gmail.com (not a fake address)?');
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n✅ Test completed! Review the logs above.\n');
}

// Run the test
testEmailContextExtraction().catch(console.error);
