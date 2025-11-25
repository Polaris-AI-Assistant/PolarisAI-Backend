/**
 * Debug test to check repository count issue
 */

const githubFunctions = require('./githubFunctions');

// Test user ID (replace with actual user ID from your system)
const TEST_USER_ID = '263c2f1d-a063-4e68-b7ff-b72447c1c0d0';

async function testRepoCount() {
  console.log('=== Testing Repository Count Issue ===');
  
  try {
    // Test 1: Default call
    console.log('\n--- Test 1: Default call ---');
    const result1 = await githubFunctions.getGithubRepos(TEST_USER_ID);
    console.log(`Default call returned: ${result1.data?.length || 0} repositories`);
    
    // Test 2: Explicit per_page = 10
    console.log('\n--- Test 2: Explicit per_page = 10 ---');
    const result2 = await githubFunctions.getGithubRepos(TEST_USER_ID, { per_page: 10 });
    console.log(`per_page=10 call returned: ${result2.data?.length || 0} repositories`);
    
    // Test 3: Higher per_page = 50
    console.log('\n--- Test 3: per_page = 50 ---');
    const result3 = await githubFunctions.getGithubRepos(TEST_USER_ID, { per_page: 50 });
    console.log(`per_page=50 call returned: ${result3.data?.length || 0} repositories`);
    
    // Test 4: Different type parameter
    console.log('\n--- Test 4: type = "owner" ---');
    const result4 = await githubFunctions.getGithubRepos(TEST_USER_ID, { per_page: 50, type: 'owner' });
    console.log(`type=owner call returned: ${result4.data?.length || 0} repositories`);
    
    // Show first few repo names for debugging
    if (result3.data && result3.data.length > 0) {
      console.log('\n--- Repository Names (first 10) ---');
      result3.data.slice(0, 10).forEach((repo, index) => {
        console.log(`${index + 1}. ${repo.name} (${repo.private ? 'Private' : 'Public'})`);
      });
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Run the test
testRepoCount();