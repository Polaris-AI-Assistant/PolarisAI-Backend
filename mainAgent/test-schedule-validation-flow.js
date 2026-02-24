/**
 * Test Schedule Validation Flow
 * Tests the complete flow from query to error message display
 */

require('dotenv').config();

// Mock the validation module
const validation = require('../utils/validation');

// Test the _validateAgentsBeforeExecution method logic
async function testValidationFlow() {
  console.log('\n============================================================');
  console.log('SCHEDULE VALIDATION FLOW TEST');
  console.log('============================================================\n');

  // Test Case 1: Past time should be caught
  console.log('📝 Test 1: Schedule reminder for 2 hours ago');
  const analysis1 = {
    agents: ['schedules'],
    queries: {
      schedules: 'Schedule a reminder for 2 hours ago'
    }
  };
  
  const result1 = await validateAgentsBeforeExecution(analysis1, 'Schedule a reminder for 2 hours ago');
  
  if (result1.hasErrors) {
    console.log('✅ PASS: Validation error detected');
    console.log('Error message:');
    console.log(result1.errorMessage);
  } else {
    console.log('❌ FAIL: Should have detected validation error');
  }

  // Test Case 2: Future time should pass
  console.log('\n📝 Test 2: Schedule reminder for 2 hours from now');
  const analysis2 = {
    agents: ['schedules'],
    queries: {
      schedules: 'Schedule a reminder for 2 hours from now'
    }
  };
  
  const result2 = await validateAgentsBeforeExecution(analysis2, 'Schedule a reminder for 2 hours from now');
  
  if (!result2.hasErrors) {
    console.log('✅ PASS: No validation error (future time accepted)');
  } else {
    console.log('❌ FAIL: Should not have detected validation error');
    console.log('Error:', result2.errorMessage);
  }

  // Test Case 3: Yesterday should be caught
  console.log('\n📝 Test 3: Remind me yesterday');
  const analysis3 = {
    agents: ['schedules'],
    queries: {
      schedules: 'Remind me to call mom yesterday'
    }
  };
  
  const result3 = await validateAgentsBeforeExecution(analysis3, 'Remind me to call mom yesterday');
  
  if (result3.hasErrors) {
    console.log('✅ PASS: Validation error detected');
    console.log('Error message:');
    console.log(result3.errorMessage);
  } else {
    console.log('❌ FAIL: Should have detected validation error');
  }

  // Test Case 4: Non-schedule agent should pass
  console.log('\n📝 Test 4: Calendar event (non-schedule agent)');
  const analysis4 = {
    agents: ['calendar'],
    queries: {
      calendar: 'Create a meeting tomorrow'
    }
  };
  
  const result4 = await validateAgentsBeforeExecution(analysis4, 'Create a meeting tomorrow');
  
  if (!result4.hasErrors) {
    console.log('✅ PASS: No validation error (calendar agent not validated here)');
  } else {
    console.log('❌ FAIL: Should not have detected validation error for calendar agent');
    console.log('Error:', result4.errorMessage);
  }

  console.log('\n============================================================');
  console.log('TESTS COMPLETE');
  console.log('============================================================\n');
}

// Replicate the _validateAgentsBeforeExecution logic
async function validateAgentsBeforeExecution(analysis, query) {
  const { validateScheduleReminder, formatScheduleValidationErrors } = validation;
  
  // Check each agent for validation requirements
  for (const agentName of analysis.agents) {
    const agentQuery = analysis.queries[agentName];
    
    // ============================================================
    // ✅ VALIDATE SCHEDULES/REMINDERS
    // ============================================================
    if (agentName === 'schedules') {
      console.log('[Test] 🔍 Pre-validating schedule/reminder parameters...');
      
      // Extract content from query (simple heuristic)
      const reminderMatch = agentQuery.match(/remind(?:\s+me)?\s+(?:to\s+)?(.+?)(?:\s+(?:at|on|in|for|tomorrow|today|yesterday))/i);
      const content = reminderMatch ? reminderMatch[1].trim() : agentQuery;
      
      const validationResult = validateScheduleReminder({
        content: content,
        datetime: agentQuery,
        query: agentQuery
      });
      
      console.log('[Test] 📊 Schedule validation result:', JSON.stringify(validationResult, null, 2));
      
      if (!validationResult.isValid) {
        console.log('[Test] ❌ Schedule validation failed:', validationResult.errors);
        
        const errorMessage = formatScheduleValidationErrors(validationResult.errors);
        
        return {
          hasErrors: true,
          errorMessage: errorMessage,
          agentName: agentName
        };
      }
      
      console.log('[Test] ✅ Schedule validation passed');
    }
  }
  
  // No validation errors found
  return {
    hasErrors: false,
    errorMessage: null
  };
}

// Run tests
testValidationFlow().catch(console.error);
