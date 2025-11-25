/**
 * Test GitHub Agent with full query processing
 */

const GitHubAgent = require('./githubAgent');

// Test user ID
const TEST_USER_ID = '263c2f1d-a063-4e68-b7ff-b72447c1c0d0';

async function testGitHubAgent() {
  console.log('=== Testing GitHub Agent Full Query Processing ===');
  
  try {
    const agent = new GitHubAgent();
    
    // Test the actual agent with repository count request
    console.log('\n--- Testing "show 10 repos" query ---');
    const result = await agent.processQuery("show me 10 repositories", TEST_USER_ID, { repoCount: 10 });
    
    console.log('Success:', result.success);
    console.log('Response length:', result.response.length);
    console.log('Tools used:', result.tools_used?.map(t => t.name).join(', '));
    
    // Count how many repositories are mentioned in the response
    const repoMatches = result.response.match(/\d+\.\s*\[?\*?\*?[\w-]+\*?\*?\]?/g);
    const repoCount = repoMatches ? repoMatches.length : 0;
    console.log('Repositories mentioned in response:', repoCount);
    
    // Show first part of response
    console.log('\n--- Response Preview ---');
    console.log(result.response.substring(0, 500) + '...');
    
    if (result.data && result.data[0] && result.data[0].result && result.data[0].result.data) {
      console.log('\n--- Raw Data Count ---');
      console.log('Raw data repositories count:', result.data[0].result.data.length);
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Run the test
testGitHubAgent();