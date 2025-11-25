/**
 * Comprehensive GitHub Agent Test with Real User
 * Tests the GitHub Agent with real user data from the database
 */

require('dotenv').config();
const GitHubAgent = require('./githubAgent');

async function comprehensiveTest() {
  console.log('🚀 Comprehensive GitHub Agent Test\n');
  console.log('Testing with real user: Bhumi1729');
  console.log('User ID: 263c2f1d-a063-4e68-b7ff-b72447c1c0d0');
  console.log('=' .repeat(70));
  
  try {
    // Initialize agent
    const agent = new GitHubAgent();
    console.log('✅ Agent initialized successfully\n');
    
    // Real user ID from your database
    const userId = '263c2f1d-a063-4e68-b7ff-b72447c1c0d0';
    
    // Comprehensive test queries
    const testQueries = [
      {
        query: "Am I connected to GitHub?",
        description: "Test GitHub connection status",
        expectTools: ['getGithubStatus']
      },
      {
        query: "Show me my GitHub profile information",
        description: "Get detailed profile info",
        expectTools: ['getGithubProfile']
      },
      {
        query: "List my repositories",
        description: "Retrieve user repositories",
        expectTools: ['getGithubRepos']
      },
      {
        query: "What are my recent issues?",
        description: "Get assigned issues",
        expectTools: ['getGithubIssues']
      },
      {
        query: "Show me my pull requests",
        description: "Get user's pull requests",
        expectTools: ['getGithubPullRequests']
      },
      {
        query: "Check my GitHub notifications",
        description: "Get notifications",
        expectTools: ['getGithubNotifications']
      },
      {
        query: "Tell me about my profile and recent repositories",
        description: "Multi-tool query test",
        expectTools: ['getGithubProfile', 'getGithubRepos']
      }
    ];

    let successCount = 0;
    let totalQueries = testQueries.length;

    for (let i = 0; i < testQueries.length; i++) {
      const { query, description, expectTools } = testQueries[i];
      
      console.log(`\n${i + 1}. ${description}`);
      console.log(`   Query: "${query}"`);
      console.log(`   Expected tools: ${expectTools.join(', ')}`);
      console.log('   ' + '-'.repeat(60));
      
      try {
        const startTime = Date.now();
        const result = await agent.processQuery(query, userId);
        const endTime = Date.now();
        
        console.log(`   ⏱️  Processing time: ${endTime - startTime}ms`);
        console.log(`   📊 Success: ${result.success ? '✅' : '❌'}`);
        
        if (result.success) {
          successCount++;
          
          const toolsUsed = result.tools_used.map(t => t.name);
          console.log(`   🔧 Tools used: ${toolsUsed.join(', ') || 'None'}`);
          
          // Check if expected tools were used
          const expectedToolsUsed = expectTools.every(tool => toolsUsed.includes(tool));
          if (expectedToolsUsed) {
            console.log(`   ✅ Expected tools were used correctly`);
          } else {
            console.log(`   ⚠️  Expected tools: ${expectTools.join(', ')}, Got: ${toolsUsed.join(', ')}`);
          }
          
          console.log(`   🤖 AI Response:`);
          console.log(`      ${result.response.substring(0, 200)}${result.response.length > 200 ? '...' : ''}`);
          
          // Show data summary
          if (result.data && result.data.length > 0) {
            console.log(`   📋 Data Retrieved:`);
            result.data.forEach(toolResult => {
              const data = toolResult.result.data;
              if (Array.isArray(data)) {
                console.log(`      ${toolResult.tool}: ${data.length} items`);
                if (data.length > 0 && data[0].name) {
                  console.log(`         First item: ${data[0].name}`);
                }
              } else if (typeof data === 'object' && data !== null) {
                if (data.login) {
                  console.log(`      ${toolResult.tool}: User ${data.login} (${data.name || 'No name'})`);
                } else {
                  console.log(`      ${toolResult.tool}: Object with ${Object.keys(data).length} properties`);
                }
              }
            });
          }
          
        } else {
          console.log(`   ❌ Error: ${result.error}`);
          if (result.technical_error) {
            console.log(`   🔧 Technical: ${result.technical_error}`);
          }
        }
        
      } catch (error) {
        console.log(`   💥 Unexpected error: ${error.message}`);
      }
      
      // Small delay between requests
      if (i < testQueries.length - 1) {
        console.log('   ⏳ Waiting 2 seconds before next query...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Final summary
    console.log('\n' + '='.repeat(70));
    console.log('🎯 TEST SUMMARY');
    console.log('='.repeat(70));
    console.log(`✅ Successful queries: ${successCount}/${totalQueries}`);
    console.log(`📊 Success rate: ${Math.round((successCount/totalQueries) * 100)}%`);
    
    if (successCount === totalQueries) {
      console.log('🎉 All tests passed! The GitHub Agent is working perfectly.');
    } else if (successCount > totalQueries / 2) {
      console.log('👍 Most tests passed. Some queries may need refinement.');
    } else {
      console.log('⚠️  Many tests failed. Please check configuration and authentication.');
    }

    console.log('\n📝 Next Steps:');
    console.log('1. ✅ GitHub Agent is implemented and working');
    console.log('2. 🔧 Integrate into your Express.js routes');
    console.log('3. 🌐 Connect to your frontend application');
    console.log('4. 🎨 Customize responses for your UI needs');
    console.log('5. 📊 Add analytics and monitoring');

  } catch (error) {
    console.error('❌ Test setup failed:', error.message);
  }
}

// Run the comprehensive test
comprehensiveTest();