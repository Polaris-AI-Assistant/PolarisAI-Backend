/**
 * Test script to verify Gmail confirmation detection
 * Run with: node mainAgent/test-gmail-confirmation-detection.js
 */

const MainAgent = require('./mainAgent');

async function testGmailConfirmationDetection() {
  console.log('='.repeat(60));
  console.log('Testing Gmail Confirmation Detection');
  console.log('='.repeat(60));
  
  const mainAgent = new MainAgent();
  
  // Test query from the logs
  const testQuery = 'send email to jyotiyadav8002@gmail.com about the project deadline and budget concerns';
  const userId = 'test-user-id';
  const conversationHistory = [];
  
  console.log(`\nTest Query: "${testQuery}"`);
  console.log(`User ID: ${userId}`);
  console.log('\n' + '-'.repeat(60));
  
  try {
    const result = await mainAgent.detectConfirmationRequiredAction('gmail', testQuery, userId, conversationHistory);
    
    console.log('\n' + '='.repeat(60));
    console.log('RESULT:');
    console.log('='.repeat(60));
    
    if (result === null) {
      console.log('❌ FAILED: detectConfirmationRequiredAction returned NULL');
      console.log('   This means the pattern did NOT match!');
      console.log('\n   Possible reasons:');
      console.log('   1. Pattern matching failed (hasAction or hasTarget is false)');
      console.log('   2. Exclusion pattern matched');
      console.log('   3. No matching pattern found');
    } else if (result.error) {
      console.log('❌ FAILED: Parameter extraction error');
      console.log(`   Error: ${result.message}`);
      console.log(`   Tool: ${result.toolName}`);
    } else {
      console.log('✅ SUCCESS: Confirmation required action detected!');
      console.log(`   Tool Name: ${result.toolName}`);
      console.log(`   Inferred Params:`, JSON.stringify(result.inferredParams, null, 2));
    }
    
  } catch (error) {
    console.log('\n' + '='.repeat(60));
    console.log('❌ EXCEPTION:');
    console.log('='.repeat(60));
    console.error(error);
  }
  
  console.log('\n' + '='.repeat(60));
}

// Run the test
testGmailConfirmationDetection().then(() => {
  console.log('\nTest complete!');
  process.exit(0);
}).catch(err => {
  console.error('\nTest failed with exception:', err);
  process.exit(1);
});
