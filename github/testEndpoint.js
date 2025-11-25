/**
 * Test script for GitHub AI Agent Endpoint
 * 
 * This script tests the GitHub AI Agent endpoint with various queries
 * using the provided user credentials.
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:3000/api/github';
const TEST_USER_ID = '263c2f1d-a063-4e68-b7ff-b72447c1c0d0';
const TEST_USER_EMAIL = 'bhumika15696@gmail.com';

/**
 * Test queries to demonstrate different capabilities
 */
const TEST_QUERIES = [
  {
    query: "What's my GitHub connection status?",
    description: "Test basic connection status check"
  },
  {
    query: "Show me my GitHub profile information",
    description: "Test profile information retrieval"
  },
  {
    query: "List my repositories sorted by recent activity",
    description: "Test repository listing with sorting"
  },
  {
    query: "What issues are assigned to me?",
    description: "Test issue retrieval"
  },
  {
    query: "Show me my recent pull requests",
    description: "Test pull request retrieval"
  },
  {
    query: "Check my GitHub notifications",
    description: "Test notification retrieval"
  }
];

/**
 * Make API request to the GitHub Agent endpoint
 */
async function testAgentEndpoint(query, useEmail = false) {
  try {
    const requestBody = {
      query: query,
      ...(useEmail ? { userEmail: TEST_USER_EMAIL } : { userId: TEST_USER_ID })
    };

    console.log(`🔍 Testing query: "${query}"`);
    console.log(`📧 Using ${useEmail ? 'email' : 'userId'}: ${useEmail ? TEST_USER_EMAIL : TEST_USER_ID}`);

    const startTime = Date.now();
    
    const response = await axios.post(`${API_BASE_URL}/agent`, requestBody, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 second timeout
    });

    const endTime = Date.now();
    const requestTime = endTime - startTime;

    console.log(`✅ Success (${requestTime}ms)`);
    console.log(`🤖 Agent Response: ${response.data.response}`);
    console.log(`🔧 Tools Used: ${response.data.tools_used?.map(t => t.name).join(', ') || 'None'}`);
    console.log(`📊 Processing Time: ${response.data.processing_time}ms`);
    
    if (response.data.data && response.data.data.length > 0) {
      console.log(`📋 Data Retrieved: ${response.data.data.length} tool result(s)`);
    }

    return { success: true, data: response.data, requestTime };

  } catch (error) {
    console.log(`❌ Error: ${error.response?.data?.error || error.message}`);
    
    if (error.response?.data) {
      console.log(`🔧 Error Code: ${error.response.data.code || 'UNKNOWN'}`);
      if (error.response.data.technical_error) {
        console.log(`⚙️  Technical Details: ${error.response.data.technical_error}`);
      }
    }

    return { success: false, error: error.response?.data || error.message };
  }
}

/**
 * Test health endpoint
 */
async function testHealthEndpoint() {
  try {
    console.log('\n🏥 Testing Health Endpoint...');
    const response = await axios.get(`${API_BASE_URL}/agent/health`);
    
    console.log(`✅ Health Status: ${response.data.status}`);
    console.log(`🤖 Agent Status: ${response.data.agent_status}`);
    console.log(`🔑 OpenAI Configured: ${response.data.openai_configured}`);
    
    return { success: true, data: response.data };
    
  } catch (error) {
    console.log(`❌ Health check failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Test capabilities endpoint
 */
async function testCapabilitiesEndpoint() {
  try {
    console.log('\n📋 Testing Capabilities Endpoint...');
    const response = await axios.get(`${API_BASE_URL}/agent/capabilities`);
    
    console.log(`✅ Available Tools: ${response.data.capabilities.available_tools.length}`);
    console.log(`💡 Example Queries: ${response.data.capabilities.example_queries.length}`);
    console.log(`🎯 Features: ${response.data.capabilities.features.length}`);
    
    return { success: true, data: response.data };
    
  } catch (error) {
    console.log(`❌ Capabilities check failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Test the simple test endpoint
 */
async function testSimpleTestEndpoint() {
  try {
    console.log('\n🧪 Testing Simple Test Endpoint...');
    const response = await axios.post(`${API_BASE_URL}/agent/test`, {
      query: "Show me my GitHub status"
    });
    
    console.log(`✅ Test Mode Result: ${response.data.success}`);
    console.log(`🤖 Response: ${response.data.result.response}`);
    
    return { success: true, data: response.data };
    
  } catch (error) {
    console.log(`❌ Test endpoint failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Main test function
 */
async function runAllTests() {
  console.log('🚀 Starting GitHub AI Agent Endpoint Tests...\n');
  console.log('=' .repeat(80));

  const results = {
    health: null,
    capabilities: null,
    simpleTest: null,
    queries: []
  };

  try {
    // Test health endpoint
    results.health = await testHealthEndpoint();
    console.log('-'.repeat(80));

    // Test capabilities endpoint  
    results.capabilities = await testCapabilitiesEndpoint();
    console.log('-'.repeat(80));

    // Test simple test endpoint
    results.simpleTest = await testSimpleTestEndpoint();
    console.log('-'.repeat(80));

    // Test main agent endpoint with different queries
    console.log('\n🎯 Testing Main Agent Endpoint with Various Queries...\n');

    for (let i = 0; i < TEST_QUERIES.length; i++) {
      const { query, description } = TEST_QUERIES[i];
      
      console.log(`\n${i + 1}. ${description}`);
      console.log('-'.repeat(50));
      
      // Test with userId
      console.log('📍 Testing with userId...');
      const result = await testAgentEndpoint(query, false);
      results.queries.push({ query, description, result, method: 'userId' });
      
      console.log('\n' + '─'.repeat(50));
      
      // Add delay between requests
      if (i < TEST_QUERIES.length - 1) {
        console.log('⏳ Waiting 2 seconds before next test...\n');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Test with email authentication
    console.log('\n📧 Testing Email Authentication...');
    console.log('-'.repeat(50));
    const emailResult = await testAgentEndpoint("What's my GitHub profile?", true);
    results.queries.push({ 
      query: "What's my GitHub profile?", 
      description: "Test email authentication", 
      result: emailResult, 
      method: 'email' 
    });

  } catch (error) {
    console.error('Unexpected error during testing:', error);
  }

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));
  
  console.log(`🏥 Health Check: ${results.health?.success ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`📋 Capabilities: ${results.capabilities?.success ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`🧪 Simple Test: ${results.simpleTest?.success ? '✅ PASS' : '❌ FAIL'}`);
  
  const successfulQueries = results.queries.filter(q => q.result.success).length;
  const totalQueries = results.queries.length;
  console.log(`🎯 Query Tests: ${successfulQueries}/${totalQueries} passed`);

  if (successfulQueries > 0) {
    const avgTime = results.queries
      .filter(q => q.result.success && q.result.requestTime)
      .reduce((sum, q) => sum + q.result.requestTime, 0) / successfulQueries;
    console.log(`⏱️  Average Response Time: ${Math.round(avgTime)}ms`);
  }

  console.log('\n🎉 Testing completed!');
  console.log('\nNext steps:');
  console.log('1. Use POST /api/github/agent with your queries');
  console.log('2. Include either "userId" or "userEmail" in the request body');
  console.log('3. Add your natural language "query" to the request body');
  console.log('4. Check GET /api/github/agent/health for system status');
  console.log('5. Check GET /api/github/agent/capabilities for available features');
}

// Error handling for the script
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Test script failed:', error);
      process.exit(1);
    });
}

module.exports = {
  testAgentEndpoint,
  testHealthEndpoint,
  testCapabilitiesEndpoint,
  runAllTests
};