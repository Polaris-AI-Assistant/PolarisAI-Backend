/**
 * Test script for Scheduler Agent
 * 
 * Tests the scheduler agent's ability to create reminders and scheduled actions
 */

require('dotenv').config();
const SchedulesAgentMultiStep = require('./schedulesAgentMultiStep');

async function testSchedulerAgent() {
  console.log('🧪 Testing Scheduler Agent...\n');

  const agent = new SchedulesAgentMultiStep();
  
  // Test user ID (replace with actual user ID from your database)
  const testUserId = 'test-user-123';
  const testConversationId = 'test-conversation-456';

  try {
    // Test 1: Create a simple reminder
    console.log('Test 1: Creating a reminder for tomorrow at 2 PM...');
    const reminderResult = await agent.processQuery(
      'Remind me to check Bitcoin price tomorrow at 2 PM',
      {
        userId: testUserId,
        conversationId: testConversationId,
        timezone: 'America/New_York'
      }
    );
    
    console.log('✅ Reminder Result:');
    console.log(JSON.stringify(reminderResult, null, 2));
    console.log('\n---\n');

    // Test 2: List schedules
    console.log('Test 2: Listing all schedules...');
    const listResult = await agent.processQuery(
      'Show my reminders',
      {
        userId: testUserId,
        conversationId: testConversationId
      }
    );
    
    console.log('✅ List Result:');
    console.log(JSON.stringify(listResult, null, 2));
    console.log('\n---\n');

    // Test 3: Create a scheduled action
    console.log('Test 3: Creating a scheduled action...');
    const actionResult = await agent.processQuery(
      'Schedule an email to john@example.com about the meeting next Monday at 9 AM',
      {
        userId: testUserId,
        conversationId: testConversationId,
        timezone: 'America/New_York'
      }
    );
    
    console.log('✅ Scheduled Action Result:');
    console.log(JSON.stringify(actionResult, null, 2));
    console.log('\n---\n');

    console.log('✅ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error(error.stack);
  }
}

// Run tests
testSchedulerAgent();
