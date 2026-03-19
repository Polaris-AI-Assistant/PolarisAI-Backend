/**
 * Test GitHub Agent Repository Resolution
 * Diagnoses why tool calls aren't being made even with resolved repo
 */

const GitHubAgentMultiStep = require('./github/githubAgentMultiStep');
const OpenAI = require('openai');

const llmClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function testRepositoryResolution() {
  const agent = new GitHubAgentMultiStep(llmClient);
  
  // Simulate a user context
  const context = {
    userId: 'bhumi@test.com',
    conversationId: 'test-' + Date.now(),
    maxIterations: 5,
    forceToolExecution: true  // Force at least one tool call
  };
  
  console.log('\n' + '='.repeat(70));
  console.log('TEST: GitHub Agent Repository Resolution with Tool Execution');
  console.log('='.repeat(70) + '\n');
  
  // Test 1: Direct list repos (should work - no repo resolution needed)
  console.log('📋 TEST 1: List Repositories (no repo resolution needed)');
  console.log('---');
  try {
    const result1 = await agent.processQuery(
      'Show me my repositories',
      context
    );
    console.log('Result:', result1);
    console.log('✅ SUCCESS - Tools executed:', result1.tools_used?.length || 0);
  } catch (error) {
    console.error('❌ FAILED:', error.message);
  }
  
  console.log('\n' + '-'.repeat(70) + '\n');
  
  // Test 2: Search in specific repo (requires repo resolution)
  console.log('📋 TEST 2: Search in startup-mvp-builder repo');
  console.log('Query: "Search for market research code in my startup mvp builder repo"');
  console.log('Expected repo: startup-mvp-builder');
  console.log('---');
  
  try {
    const result2 = await agent.processQuery(
      'Search for market research code in my startup mvp builder repo',
      context
    );
    
    console.log('\n📊 RESULT:');
    console.log('  Response:', result2.response?.substring(0, 200) || 'N/A');
    console.log('  Tools used:', result2.tools_used?.map(t => t.name) || []);
    console.log('  Success:', result2.success);
    
    // Check what's in the response
    if (result2.response) {
      if (result2.response.includes('startup-mvp-builder')) {
        console.log('  ✅ Response mentions correct repo: startup-mvp-builder');
      } else if (result2.response.includes('my-app')) {
        console.log('  ❌ Response mentions WRONG repo: my-app');
      } else {
        console.log('  ⚠️ Response doesn\'t mention specific repo');
      }
    }
    
  } catch (error) {
    console.error('❌ FAILED:', error.message);
  }
  
  console.log('\n' + '-'.repeat(70) + '\n');
  
  // Test 3: Repository resolution logic (test method directly)
  console.log('📋 TEST 3: Direct resolution logic test');
  console.log('---');
  
  try {
    const query = 'Search for market research code in my startup mvp builder repo';
    const resolved = await agent.resolveRepositoryFromQuery(query, context);
    
    if (resolved) {
      console.log('✅ Resolution succeeded:');
      console.log(`   Owner: ${resolved.owner}`);
      console.log(`   Repo:  ${resolved.repo}`);
      
      if (resolved.repo === 'startup-mvp-builder') {
        console.log('   ✅ Correctly resolved to startup-mvp-builder');
      } else {
        console.log(`   ❌ Resolved to wrong repo: ${resolved.repo}`);
      }
    } else {
      console.log('❌ Resolution failed - returned null');
    }
  } catch (error) {
    console.error('❌ FAILED:', error.message);
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('DIAGNOSTIC SUMMARY');
  console.log('='.repeat(70));
  console.log(`
Issues to check:
1. Does TEST 1 show tools being executed? (should show 1+ tools)
2. Does TEST 2 show searchRepositoryCode being called?
3. In TEST 2, is the correct repo (startup-mvp-builder) mentioned?
4. Does TEST 3 correctly resolve the repo?

If TEST 3 passes but TEST 2 shows 0 tools:
  → Problem: LLM not invoking tools even with resolved repo
  → Solution: May need to modify system prompt or query formatting

If TEST 3 fails:
  → Problem: Resolution logic itself broken
  → Solution: Fix fuzzy matching algorithm

If TEST 2 executes but returns wrong repo:
  → Problem: Tools executed but with wrong owner/repo
  → Solution: Check applyResolvedRepo() not being called
  `);
}

testRepositoryResolution().catch(console.error);
