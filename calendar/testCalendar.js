/**
 * Test script for Google Calendar Agent
 * 
 * This script tests various Calendar agent functionalities
 * Run with: node calendar/testCalendar.js
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3000/api';
let authToken = null; // Set this after login
let userId = null;

// Test data
const testEmail = 'test@example.com';
const testPassword = 'password123';

/**
 * Helper function to make authenticated requests
 */
async function makeRequest(method, endpoint, data = null) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
    };
  }
}

/**
 * Test 1: Sign in user
 */
async function testSignIn() {
  console.log('\n📝 Test 1: Sign in user');
  console.log('=' .repeat(50));

  const result = await makeRequest('POST', '/auth/signin', {
    email: testEmail,
    password: testPassword,
  });

  if (result.success && result.data.access_token) {
    authToken = result.data.access_token;
    userId = result.data.user.id;
    console.log('✅ Sign in successful');
    console.log(`   User ID: ${userId}`);
    console.log(`   Email: ${result.data.user.email}`);
    return true;
  } else {
    console.log('❌ Sign in failed:', result.error);
    return false;
  }
}

/**
 * Test 2: Get Calendar OAuth URL
 */
async function testGetOAuthUrl() {
  console.log('\n📝 Test 2: Get Calendar OAuth URL');
  console.log('=' .repeat(50));

  const result = await makeRequest('GET', '/auth/calendar/url');

  if (result.success && result.data.authUrl) {
    console.log('✅ OAuth URL generated successfully');
    console.log(`   URL: ${result.data.authUrl.substring(0, 100)}...`);
    console.log('\n⚠️  Manual step required:');
    console.log('   1. Open the URL in a browser');
    console.log('   2. Authorize the application');
    console.log('   3. Complete the OAuth flow');
    return result.data.authUrl;
  } else {
    console.log('❌ Failed to get OAuth URL:', result.error);
    return null;
  }
}

/**
 * Test 3: Check Calendar connection status
 */
async function testConnectionStatus() {
  console.log('\n📝 Test 3: Check Calendar connection status');
  console.log('=' .repeat(50));

  const result = await makeRequest('GET', '/auth/calendar/status');

  if (result.success) {
    console.log('✅ Status check successful');
    console.log(`   Connected: ${result.data.connected}`);
    if (result.data.connected) {
      console.log(`   Email: ${result.data.email}`);
      console.log(`   Name: ${result.data.name}`);
      console.log(`   Connected at: ${result.data.connectedAt}`);
    }
    return result.data.connected;
  } else {
    console.log('❌ Status check failed:', result.error);
    return false;
  }
}

/**
 * Test 4: Check agent status
 */
async function testAgentStatus() {
  console.log('\n📝 Test 4: Check agent status');
  console.log('=' .repeat(50));

  const result = await makeRequest('GET', '/calendar/agent/status');

  if (result.success) {
    console.log('✅ Agent status check successful');
    console.log(`   Agent operational: ${result.data.agent_operational}`);
    console.log(`   Calendar connected: ${result.data.calendar_connected}`);
    console.log(`   Message: ${result.data.message}`);
    return result.data.calendar_connected;
  } else {
    console.log('❌ Agent status check failed:', result.error);
    return false;
  }
}

/**
 * Test 5: Get agent examples
 */
async function testGetExamples() {
  console.log('\n📝 Test 5: Get agent examples');
  console.log('=' .repeat(50));

  const result = await makeRequest('GET', '/calendar/agent/examples');

  if (result.success && result.data.examples) {
    console.log('✅ Examples retrieved successfully');
    console.log(`   Categories: ${result.data.examples.length}`);
    result.data.examples.forEach((cat) => {
      console.log(`   - ${cat.category}: ${cat.queries.length} examples`);
    });
    return true;
  } else {
    console.log('❌ Failed to get examples:', result.error);
    return false;
  }
}

/**
 * Test 6: Query agent - Get events
 */
async function testQueryGetEvents() {
  console.log('\n📝 Test 6: Query agent - Get events');
  console.log('=' .repeat(50));

  const query = "Show me my events for today";
  const result = await makeRequest('POST', '/calendar/agent/query', { query });

  if (result.success) {
    console.log('✅ Query processed successfully');
    console.log(`   Query: "${result.data.query}"`);
    console.log(`   Response: ${result.data.response}`);
    console.log(`   Tools used: ${result.data.tools_used.length}`);
    if (result.data.tools_used.length > 0) {
      result.data.tools_used.forEach((tool, i) => {
        console.log(`   ${i + 1}. ${tool.name}`);
      });
    }
    return true;
  } else {
    console.log('❌ Query failed:', result.error);
    return false;
  }
}

/**
 * Test 7: Query agent - Create event
 */
async function testQueryCreateEvent() {
  console.log('\n📝 Test 7: Query agent - Create event');
  console.log('=' .repeat(50));

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0];

  const query = `Create a test meeting tomorrow at 2pm for 1 hour`;
  const result = await makeRequest('POST', '/calendar/agent/query', { query });

  if (result.success) {
    console.log('✅ Query processed successfully');
    console.log(`   Query: "${result.data.query}"`);
    console.log(`   Response: ${result.data.response}`);
    console.log(`   Tools used: ${result.data.tools_used.length}`);
    
    // Extract event details from function results
    if (result.data.function_results && result.data.function_results.length > 0) {
      const createResult = result.data.function_results.find(r => r.function === 'createEvent');
      if (createResult && createResult.result.success) {
        console.log(`   Event ID: ${createResult.result.eventId}`);
        console.log(`   Event Link: ${createResult.result.htmlLink}`);
      }
    }
    return true;
  } else {
    console.log('❌ Query failed:', result.error);
    return false;
  }
}

/**
 * Test 8: Query agent - List calendars
 */
async function testQueryListCalendars() {
  console.log('\n📝 Test 8: Query agent - List calendars');
  console.log('=' .repeat(50));

  const query = "Show me all my calendars";
  const result = await makeRequest('POST', '/calendar/agent/query', { query });

  if (result.success) {
    console.log('✅ Query processed successfully');
    console.log(`   Response: ${result.data.response}`);
    return true;
  } else {
    console.log('❌ Query failed:', result.error);
    return false;
  }
}

/**
 * Test 9: Direct API - Get calendars
 */
async function testDirectGetCalendars() {
  console.log('\n📝 Test 9: Direct API - Get calendars');
  console.log('=' .repeat(50));

  const result = await makeRequest('GET', '/calendar/calendars');

  if (result.success && result.data.calendars) {
    console.log('✅ Calendars retrieved successfully');
    console.log(`   Count: ${result.data.count}`);
    result.data.calendars.forEach((cal, i) => {
      console.log(`   ${i + 1}. ${cal.summary} (${cal.id})`);
      console.log(`      Primary: ${cal.primary}, Access: ${cal.accessRole}`);
    });
    return true;
  } else {
    console.log('❌ Failed to get calendars:', result.error);
    return false;
  }
}

/**
 * Test 10: Direct API - Get events
 */
async function testDirectGetEvents() {
  console.log('\n📝 Test 10: Direct API - Get events');
  console.log('=' .repeat(50));

  const now = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 7);

  const params = new URLSearchParams({
    timeMin: now.toISOString(),
    timeMax: tomorrow.toISOString(),
    maxResults: '10'
  });

  const result = await makeRequest('GET', `/calendar/events?${params}`);

  if (result.success) {
    console.log('✅ Events retrieved successfully');
    console.log(`   Count: ${result.data.count}`);
    if (result.data.events && result.data.events.length > 0) {
      result.data.events.forEach((event, i) => {
        console.log(`   ${i + 1}. ${event.summary}`);
        console.log(`      Start: ${event.start?.dateTime || event.start?.date}`);
        console.log(`      Status: ${event.status}`);
      });
    }
    return true;
  } else {
    console.log('❌ Failed to get events:', result.error);
    return false;
  }
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('\n🧪 Starting Google Calendar Agent Tests');
  console.log('='.repeat(50));

  const results = {
    passed: 0,
    failed: 0,
    skipped: 0
  };

  // Test 1: Sign in
  const signedIn = await testSignIn();
  if (!signedIn) {
    console.log('\n⚠️  Cannot proceed without authentication');
    console.log('   Please ensure test user exists or update credentials');
    return;
  }
  results.passed++;

  // Test 2: Get OAuth URL
  await testGetOAuthUrl();
  results.passed++;

  // Test 3: Check connection status
  const isConnected = await testConnectionStatus();
  if (!isConnected) {
    console.log('\n⚠️  Calendar not connected. Some tests will be skipped.');
    console.log('   Please complete OAuth flow first.');
  }
  results.passed++;

  // Test 4: Agent status
  await testAgentStatus();
  results.passed++;

  // Test 5: Get examples
  await testGetExamples();
  results.passed++;

  // Only run Calendar operation tests if connected
  if (isConnected) {
    // Test 6: Query get events
    await testQueryGetEvents();
    results.passed++;

    // Test 7: Query create event
    await testQueryCreateEvent();
    results.passed++;

    // Test 8: Query list calendars
    await testQueryListCalendars();
    results.passed++;

    // Test 9: Direct get calendars
    await testDirectGetCalendars();
    results.passed++;

    // Test 10: Direct get events
    await testDirectGetEvents();
    results.passed++;
  } else {
    results.skipped = 5;
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Summary');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`⏭️  Skipped: ${results.skipped}`);
  console.log('');
}

// Run tests
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  makeRequest,
  testSignIn,
  testGetOAuthUrl,
  testConnectionStatus,
  testAgentStatus,
  testQueryGetEvents,
  testQueryCreateEvent
};
