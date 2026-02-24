require('dotenv').config();
const MainAgent = require('./mainAgent');

async function testScheduleValidationStreaming() {
  console.log('\n============================================================');
  console.log('SCHEDULE VALIDATION STREAMING TEST');
  console.log('============================================================\n');

  const mainAgent = new MainAgent();
  const userId = 'test-user-123';
  const conversationId = 'test-conv-123';

  // Test: Schedule reminder for past time
  console.log('📝 Test: Schedule reminder for 2 hours ago (streaming)');
  
  const chunks = [];
  let hasError = false;
  let errorMessage = '';

  try {
    const result = await mainAgent.processQueryWithStreaming(
      'Schedule a reminder for 2 hours ago',
      userId,
      {
        conversationId,
        conversationHistory: []
      },
      (chunk) => {
        chunks.push(chunk);
        console.log('[Chunk]', JSON.stringify(chunk));
        
        if (chunk.type === 'content' && chunk.text) {
          errorMessage += chunk.text;
        }
      }
    );

    console.log('\n📊 Result:', JSON.stringify(result, null, 2));
    console.log('\n📦 Total chunks:', chunks.length);
    console.log('\n📝 Error message:', errorMessage);

    // Check if validation error was detected
    if (result.validationError) {
      console.log('✅ PASS: Validation error detected');
      console.log('✅ PASS: Error message sent to user');
    } else {
      console.log('❌ FAIL: Validation error not detected');
      hasError = true;
    }

    // Check if error message contains expected content
    if (errorMessage.includes('past') || errorMessage.includes('already passed')) {
      console.log('✅ PASS: Error message contains expected content');
    } else {
      console.log('❌ FAIL: Error message missing expected content');
      hasError = true;
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    hasError = true;
  }

  console.log('\n============================================================');
  console.log(hasError ? '❌ TEST FAILED' : '✅ TEST PASSED');
  console.log('============================================================\n');

  process.exit(hasError ? 1 : 0);
}

testScheduleValidationStreaming();
