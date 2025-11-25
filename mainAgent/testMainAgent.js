/**
 * Main Agent Test Script
 * 
 * This script tests the Main Coordinator Agent with various queries
 * to demonstrate single and multi-agent capabilities.
 * 
 * Usage:
 * 1. Ensure server is running (npm start)
 * 2. Update the TEST_USER_ID and TOKEN if needed
 * 3. Run: node mainAgent/testMainAgent.js
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3000';
const TEST_USER_ID = 'test-user-123'; // Replace with actual user ID
const TOKEN = 'your-bearer-token-here'; // Replace with actual token

// Test queries
const TEST_QUERIES = {
  info: {
    name: 'Get Agent Info',
    endpoint: '/api/agent/info',
    method: 'GET',
    requiresAuth: false
  },
  examples: {
    name: 'Get Examples',
    endpoint: '/api/agent/examples',
    method: 'GET',
    requiresAuth: false
  },
  health: {
    name: 'Health Check',
    endpoint: '/api/agent/health',
    method: 'GET',
    requiresAuth: false
  },
  singleCalendar: {
    name: 'Single Agent - Calendar',
    endpoint: '/api/agent/query',
    method: 'POST',
    requiresAuth: true,
    data: {
      query: 'Show me my calendar events for today'
    }
  },
  singleGitHub: {
    name: 'Single Agent - GitHub',
    endpoint: '/api/agent/query',
    method: 'POST',
    requiresAuth: true,
    data: {
      query: 'Show me my GitHub profile and repositories'
    }
  },
  multiCalendarDocs: {
    name: 'Multi-Agent - Calendar + Docs',
    endpoint: '/api/agent/query',
    method: 'POST',
    requiresAuth: true,
    data: {
      query: 'Schedule a project meeting tomorrow at 2pm and create a document for the agenda'
    }
  },
  multiFormsSheets: {
    name: 'Multi-Agent - Forms + Sheets',
    endpoint: '/api/agent/query',
    method: 'POST',
    requiresAuth: true,
    data: {
      query: 'Create a customer feedback form and a spreadsheet to track the responses'
    }
  },
  multiThreeAgents: {
    name: 'Multi-Agent - Calendar + Meet + Docs',
    endpoint: '/api/agent/query',
    method: 'POST',
    requiresAuth: true,
    data: {
      query: 'Create a meeting space, schedule it in my calendar for Friday at 3pm, and create a document with meeting notes template'
    }
  },
  testDevelopment: {
    name: 'Test Endpoint (Development)',
    endpoint: '/api/agent/test',
    method: 'POST',
    requiresAuth: false,
    data: {
      query: 'List my calendar events',
      userId: TEST_USER_ID
    }
  }
};

// Helper function to make requests
async function makeRequest(test) {
  const config = {
    method: test.method,
    url: `${BASE_URL}${test.endpoint}`,
    headers: {}
  };

  if (test.requiresAuth) {
    config.headers['Authorization'] = `Bearer ${TOKEN}`;
  }

  if (test.data) {
    config.headers['Content-Type'] = 'application/json';
    config.data = test.data;
  }

  return axios(config);
}

// Helper function to format output
function formatResponse(response) {
  if (response.data.response) {
    return {
      success: response.data.success,
      query: response.data.query,
      response: response.data.response,
      agentsUsed: response.data.agentsUsed || response.data.agentUsed,
      toolsUsed: response.data.toolsUsed?.length || 0,
      processingTime: response.data.processingTime,
      multiAgent: response.data.multiAgent || false
    };
  }
  return response.data;
}

// Main test function
async function runTests() {
  console.log('🤖 Main Coordinator Agent Test Suite\n');
  console.log('=' .repeat(60));
  console.log('\n');

  const tests = Object.entries(TEST_QUERIES);
  const results = {
    passed: 0,
    failed: 0,
    skipped: 0
  };

  for (const [key, test] of tests) {
    console.log(`📋 Test: ${test.name}`);
    console.log(`   Endpoint: ${test.method} ${test.endpoint}`);
    
    try {
      const startTime = Date.now();
      const response = await makeRequest(test);
      const duration = Date.now() - startTime;

      console.log(`   ✅ Status: ${response.status} ${response.statusText}`);
      console.log(`   ⏱️  Duration: ${duration}ms`);
      
      const formattedResponse = formatResponse(response);
      console.log(`   📤 Response:`);
      console.log(JSON.stringify(formattedResponse, null, 4).split('\n').map(line => `      ${line}`).join('\n'));
      
      results.passed++;

    } catch (error) {
      if (error.response) {
        console.log(`   ❌ Error: ${error.response.status} ${error.response.statusText}`);
        console.log(`   📤 Response:`, error.response.data);
        
        // Skip auth-required tests if unauthorized
        if (error.response.status === 401 && test.requiresAuth) {
          console.log(`   ⚠️  Skipped: Authentication required`);
          results.skipped++;
        } else {
          results.failed++;
        }
      } else {
        console.log(`   ❌ Error:`, error.message);
        results.failed++;
      }
    }
    
    console.log('\n' + '-'.repeat(60) + '\n');
  }

  // Summary
  console.log('📊 Test Results Summary');
  console.log('=' .repeat(60));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`⚠️  Skipped: ${results.skipped}`);
  console.log(`📝 Total: ${tests.length}`);
  console.log('=' .repeat(60));
}

// Interactive test function
async function interactiveTest() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('🤖 Main Coordinator Agent - Interactive Test Mode\n');
  console.log('Type your query and press Enter. Type "exit" to quit.\n');

  const prompt = () => {
    rl.question('Query: ', async (query) => {
      if (query.toLowerCase() === 'exit') {
        console.log('Goodbye! 👋');
        rl.close();
        return;
      }

      if (!query.trim()) {
        prompt();
        return;
      }

      try {
        console.log('\n🔄 Processing...\n');
        
        const response = await makeRequest({
          endpoint: '/api/agent/test',
          method: 'POST',
          requiresAuth: false,
          data: {
            query: query,
            userId: TEST_USER_ID
          }
        });

        const result = response.data;
        
        console.log('✅ Success!\n');
        console.log(`📝 Query: ${result.query}`);
        console.log(`🤖 Response: ${result.response}`);
        
        if (result.agentsUsed) {
          console.log(`🔧 Agents Used: ${result.agentsUsed.join(', ')}`);
        }
        
        if (result.analysis) {
          console.log(`💡 Reasoning: ${result.analysis.reasoning}`);
        }
        
        console.log(`⏱️  Processing Time: ${result.processingTime}`);
        console.log('\n' + '-'.repeat(60) + '\n');

      } catch (error) {
        console.log('\n❌ Error:', error.response?.data || error.message);
        console.log('\n' + '-'.repeat(60) + '\n');
      }

      prompt();
    });
  };

  prompt();
}

// Check command line arguments
const args = process.argv.slice(2);

if (args.includes('--interactive') || args.includes('-i')) {
  // Run interactive mode
  interactiveTest();
} else if (args.includes('--help') || args.includes('-h')) {
  // Show help
  console.log(`
Main Agent Test Script

Usage:
  node mainAgent/testMainAgent.js [options]

Options:
  --interactive, -i    Run in interactive mode
  --help, -h          Show this help message

Without options, runs all predefined tests.

Configuration:
  Edit the TEST_USER_ID and TOKEN constants at the top of this file.
  For development mode, the test endpoint doesn't require authentication.
  `);
} else {
  // Run all tests
  runTests().catch(console.error);
}
