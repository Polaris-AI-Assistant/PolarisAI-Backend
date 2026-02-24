/**
 * Test Email Validation Fix
 * 
 * This test verifies that email validation happens BEFORE confirmation UI is shown,
 * not after tool execution.
 * 
 * Expected behavior:
 * 1. Invalid emails should be caught during query analysis
 * 2. Error message should be shown immediately
 * 3. No confirmation UI should be created
 * 4. No tool execution should happen
 * 5. No draft should be created
 */

const MainAgent = require('./mainAgent/mainAgent');

async function testEmailValidation() {
  console.log('\n=== Testing Email Validation Fix ===\n');
  
  const mainAgent = new MainAgent();
  const userId = 'test-user-id';
  const conversationId = 'test-conversation-id';
  
  // Test cases that should FAIL validation
  const invalidTestCases = [
    {
      query: 'Send email to invalid-email-format',
      expectedError: 'Invalid email address',
      description: 'Email without @ symbol'
    },
    {
      query: 'Email this to john@',
      expectedError: 'Invalid email address',
      description: 'Incomplete email (missing domain)'
    },
    {
      query: 'Send email to user@domain',
      expectedError: 'Invalid email address',
      description: 'Email without extension'
    },
    {
      query: 'Send email about meeting',
      expectedError: 'No valid email address found',
      description: 'No email provided'
    },
    {
      query: 'Email to test user@example.com',
      expectedError: 'Invalid email address',
      description: 'Email with space'
    },
    {
      query: 'Send email to @example.com',
      expectedError: 'Invalid email address',
      description: 'Email without username'
    }
  ];
  
  // Test cases that should PASS validation
  const validTestCases = [
    {
      query: 'Send email to john@example.com about the meeting',
      expectedEmail: 'john@example.com',
      description: 'Valid email format'
    },
    {
      query: 'Email test.user+tag@company.co.uk about project',
      expectedEmail: 'test.user+tag@company.co.uk',
      description: 'Complex valid email'
    }
  ];
  
  console.log('📧 Testing INVALID email cases (should fail BEFORE confirmation):\n');
  
  for (const testCase of invalidTestCases) {
    console.log(`\nTest: ${testCase.description}`);
    console.log(`Query: "${testCase.query}"`);
    
    try {
      // This should throw an error during query analysis, NOT during tool execution
      const result = await mainAgent.handleQuery(
        testCase.query,
        userId,
        conversationId,
        null, // userLocation
        [] // conversationHistory
      );
      
      // Check if error was returned properly
      if (result.errors && Object.keys(result.errors).length > 0) {
        const errorMessage = Object.values(result.errors)[0].error;
        if (errorMessage.includes(testCase.expectedError)) {
          console.log(`✅ PASS: Error caught correctly: "${errorMessage}"`);
        } else {
          console.log(`❌ FAIL: Wrong error message: "${errorMessage}"`);
        }
      } else if (result.confirmationRequest) {
        console.log(`❌ FAIL: Confirmation was created (should have failed validation)`);
        console.log(`   Confirmation params:`, JSON.stringify(result.confirmationRequest.params, null, 2));
      } else {
        console.log(`⚠️  UNKNOWN: Unexpected result structure`);
        console.log(`   Result:`, JSON.stringify(result, null, 2));
      }
      
    } catch (error) {
      // Error thrown is also acceptable (as long as it's the right error)
      if (error.message.includes(testCase.expectedError)) {
        console.log(`✅ PASS: Error thrown correctly: "${error.message}"`);
      } else {
        console.log(`❌ FAIL: Wrong error thrown: "${error.message}"`);
      }
    }
  }
  
  console.log('\n\n📧 Testing VALID email cases (should create confirmation):\n');
  
  for (const testCase of validTestCases) {
    console.log(`\nTest: ${testCase.description}`);
    console.log(`Query: "${testCase.query}"`);
    
    try {
      const result = await mainAgent.handleQuery(
        testCase.query,
        userId,
        conversationId,
        null,
        []
      );
      
      if (result.confirmationRequest) {
        const emailParam = result.confirmationRequest.params.to;
        if (emailParam === testCase.expectedEmail) {
          console.log(`✅ PASS: Confirmation created with correct email: "${emailParam}"`);
        } else {
          console.log(`❌ FAIL: Wrong email in confirmation: "${emailParam}" (expected "${testCase.expectedEmail}")`);
        }
      } else if (result.errors && Object.keys(result.errors).length > 0) {
        console.log(`❌ FAIL: Error returned for valid email: ${JSON.stringify(result.errors)}`);
      } else {
        console.log(`⚠️  UNKNOWN: Unexpected result structure`);
      }
      
    } catch (error) {
      console.log(`❌ FAIL: Error thrown for valid email: "${error.message}"`);
    }
  }
  
  console.log('\n\n=== Test Summary ===');
  console.log('✅ If all tests passed, email validation is working correctly!');
  console.log('❌ If any tests failed, review the error handling in mainAgent.js');
  console.log('\nKey points:');
  console.log('1. Invalid emails should be caught BEFORE confirmation is created');
  console.log('2. Error messages should be user-friendly with suggestions');
  console.log('3. No tool execution should happen for invalid emails');
  console.log('4. Valid emails should create confirmations normally');
}

// Run the test
if (require.main === module) {
  testEmailValidation()
    .then(() => {
      console.log('\n✅ Test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed with error:', error);
      process.exit(1);
    });
}

module.exports = { testEmailValidation };
