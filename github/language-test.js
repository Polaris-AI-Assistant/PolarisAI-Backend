/**
 * Test language-based repository search fix
 */

const GitHubAgent = require('./githubAgent');

// Test user ID and username
const TEST_USER_ID = '263c2f1d-a063-4e68-b7ff-b72447c1c0d0';
const TEST_USERNAME = 'Bhumi1729';

async function testLanguageSearch() {
  console.log('=== Testing Language-Based Repository Search ===');
  
  try {
    const agent = new GitHubAgent();
    
    // Test 1: Language-based search
    console.log('\n--- Test 1: "Show all repositories where Python is used" ---');
    const result1 = await agent.processQuery(
      "Show all repositories where Python is used", 
      TEST_USER_ID, 
      { 
        repoCount: 50, // Get more repos to increase chance of finding Python ones
        githubUsername: TEST_USERNAME 
      }
    );
    
    console.log('Success:', result1.success);
    console.log('Response preview:', result1.response?.substring(0, 300) + '...');
    
    // Check if the response mentions filtering by language
    const mentionsLanguageFilter = result1.response?.toLowerCase().includes('python');
    console.log('✅ Mentions Python filtering:', mentionsLanguageFilter ? 'YES' : 'NO');
    
    // Test 2: JavaScript language search
    console.log('\n--- Test 2: "List repositories written in JavaScript" ---');
    const result2 = await agent.processQuery(
      "List repositories written in JavaScript", 
      TEST_USER_ID, 
      { 
        repoCount: 50,
        githubUsername: TEST_USERNAME 
      }
    );
    
    console.log('Success:', result2.success);
    console.log('Response preview:', result2.response?.substring(0, 300) + '...');
    
    const mentionsJavaScript = result2.response?.toLowerCase().includes('javascript');
    console.log('✅ Mentions JavaScript filtering:', mentionsJavaScript ? 'YES' : 'NO');
    
    // Test 3: Name-based search for comparison
    console.log('\n--- Test 3: "Show repositories with react in the name" ---');
    const result3 = await agent.processQuery(
      "Show repositories with react in the name", 
      TEST_USER_ID, 
      { 
        repoCount: 50,
        githubUsername: TEST_USERNAME 
      }
    );
    
    console.log('Success:', result3.success);
    console.log('Response preview:', result3.response?.substring(0, 200) + '...');
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Run the test
testLanguageSearch();