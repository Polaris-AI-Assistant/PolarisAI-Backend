/**
 * Test with correct repository name
 */

const GitHubAgent = require('./githubAgent');

// Test user ID and username
const TEST_USER_ID = '263c2f1d-a063-4e68-b7ff-b72447c1c0d0';
const TEST_USERNAME = 'Bhumi1729';

async function testCorrectRepoName() {
  console.log('=== Testing With Correct Repository Name ===');
  
  try {
    const agent = new GitHubAgent();
    
    // Test with correct repository name from debug output
    console.log('\n--- Test: "Give me info about the Autodb.AI repository" ---');
    const result = await agent.processQuery(
      "Give me info about the Autodb.AI repository", 
      TEST_USER_ID, 
      { 
        repoCount: 10,
        githubUsername: TEST_USERNAME 
      }
    );
    
    console.log('Success:', result.success);
    console.log('Response preview:', result.response?.substring(0, 200) + '...');
    
    if (result.tools_used && result.tools_used.length > 0) {
      const repoTool = result.tools_used.find(t => t.name === 'getGithubRepository');
      if (repoTool) {
        console.log('✅ Owner used:', repoTool.arguments.owner);
        console.log('✅ Repo name used:', repoTool.arguments.repo);
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Run the test
testCorrectRepoName();