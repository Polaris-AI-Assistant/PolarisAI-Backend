/**
 * Test repository owner detection fix
 */

const GitHubAgent = require('./githubAgent');

// Test user ID and username
const TEST_USER_ID = '263c2f1d-a063-4e68-b7ff-b72447c1c0d0';
const TEST_USERNAME = 'Bhumi1729';

async function testRepositoryOwnerDetection() {
  console.log('=== Testing Repository Owner Detection Fix ===');
  
  try {
    const agent = new GitHubAgent();
    
    // Test 1: Query about user's own repository
    console.log('\n--- Test 1: "Give me info about the AutoDB repository" ---');
    const result1 = await agent.processQuery(
      "Give me info about the AutoDB repository", 
      TEST_USER_ID, 
      { 
        repoCount: 10,
        githubUsername: TEST_USERNAME 
      }
    );
    
    console.log('Success:', result1.success);
    console.log('Tools used:', result1.tools_used?.map(t => `${t.name}(${JSON.stringify(t.arguments)})`).join(', '));
    
    if (result1.tools_used && result1.tools_used.length > 0) {
      const repoTool = result1.tools_used.find(t => t.name === 'getGithubRepository');
      if (repoTool) {
        console.log('Repository owner used:', repoTool.arguments.owner);
        console.log('Expected owner:', TEST_USERNAME);
        console.log('✅ Owner detection:', repoTool.arguments.owner === TEST_USERNAME ? 'CORRECT' : 'INCORRECT');
      }
    }
    
    // Test 2: Query about external repository
    console.log('\n--- Test 2: "Tell me about octocat\'s Hello-World repository" ---');
    const result2 = await agent.processQuery(
      "Tell me about octocat's Hello-World repository", 
      TEST_USER_ID, 
      { 
        repoCount: 10,
        githubUsername: TEST_USERNAME 
      }
    );
    
    if (result2.tools_used && result2.tools_used.length > 0) {
      const repoTool = result2.tools_used.find(t => t.name === 'getGithubRepository');
      if (repoTool) {
        console.log('Repository owner used:', repoTool.arguments.owner);
        console.log('Expected owner: octocat');
        console.log('✅ External owner detection:', repoTool.arguments.owner === 'octocat' ? 'CORRECT' : 'INCORRECT');
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Run the test
testRepositoryOwnerDetection();