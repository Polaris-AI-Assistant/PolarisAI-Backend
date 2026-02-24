/**
 * Test URL Validation in Streaming Mode
 * 
 * Simulates the streaming flow to verify error messages are sent correctly
 */

const MainAgent = require('./mainAgent');

async function testStreamingValidation() {
  console.log('='.repeat(60));
  console.log('URL VALIDATION STREAMING TEST');
  console.log('='.repeat(60));

  const mainAgent = new MainAgent();
  const userId = 'test-user-123';
  const query = 'Search for information at htp://example.com';
  
  console.log(`\n📝 Testing query: "${query}"`);
  console.log('Expected: Error message should be sent via streaming\n');

  const chunks = [];
  let errorReceived = false;
  let thinkingStopReceived = false;
  let doneReceived = false;

  try {
    const result = await mainAgent.processQueryWithStreaming(
      query,
      userId,
      {
        conversationHistory: [],
        conversationId: 'test-conversation-123'
      },
      (chunk) => {
        chunks.push(chunk);
        console.log('📦 Chunk received:', JSON.stringify(chunk, null, 2));
        
        if (chunk.type === 'thinking' && chunk.status === 'stop') {
          thinkingStopReceived = true;
          console.log('✅ Thinking stop signal received');
        }
        
        if (chunk.type === 'content' && chunk.text) {
          errorReceived = true;
          console.log('✅ Error content received:', chunk.text.substring(0, 100) + '...');
        }
        
        if (chunk.type === 'done') {
          doneReceived = true;
          console.log('✅ Done signal received');
        }
      }
    );

    console.log('\n' + '='.repeat(60));
    console.log('TEST RESULTS');
    console.log('='.repeat(60));
    
    console.log(`\nTotal chunks received: ${chunks.length}`);
    console.log(`Thinking stop received: ${thinkingStopReceived ? '✅' : '❌'}`);
    console.log(`Error content received: ${errorReceived ? '✅' : '❌'}`);
    console.log(`Done signal received: ${doneReceived ? '✅' : '❌'}`);
    console.log(`Validation error flag: ${result.validationError ? '✅' : '❌'}`);
    
    if (thinkingStopReceived && errorReceived && doneReceived && result.validationError) {
      console.log('\n🎉 TEST PASSED: All expected chunks received!');
    } else {
      console.log('\n❌ TEST FAILED: Missing expected chunks');
    }

  } catch (error) {
    console.error('❌ TEST ERROR:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testStreamingValidation().then(() => {
  console.log('\n✅ Test complete');
  process.exit(0);
}).catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
