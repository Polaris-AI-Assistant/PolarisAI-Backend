/**
 * Test script for the new multi-strategy scraping system
 * 
 * Tests all 4 strategies:
 * 1. Firecrawl API
 * 2. Jina AI Reader
 * 3. Direct fetch
 * 4. Snippet fallback
 */

require('dotenv').config();
const ResearchService = require('./researchService');

const testUrls = [
  {
    url: 'https://en.wikipedia.org/wiki/Data_science',
    name: 'Wikipedia (should work with direct)',
    expectedStrategy: 'direct or jina'
  },
  {
    url: 'https://towardsdatascience.com/what-is-data-science-8c8fbadf84e7',
    name: 'Medium/TDS (needs Jina or Firecrawl)',
    expectedStrategy: 'jina or firecrawl'
  },
  {
    url: 'https://www.ibm.com/topics/data-science',
    name: 'IBM (should work with any)',
    expectedStrategy: 'any'
  },
  {
    url: 'https://aws.amazon.com/what-is/data-science/',
    name: 'AWS (should work with direct or jina)',
    expectedStrategy: 'direct or jina'
  }
];

async function testScraping() {
  console.log('🧪 Testing Multi-Strategy Scraping System\n');
  console.log('=' .repeat(60));
  
  const service = new ResearchService();
  const results = [];

  for (const test of testUrls) {
    console.log(`\n📄 Testing: ${test.name}`);
    console.log(`   URL: ${test.url}`);
    console.log(`   Expected: ${test.expectedStrategy}`);
    
    const startTime = Date.now();
    const content = await service.fetchContent(test.url, 'Fallback snippet for testing');
    const duration = Date.now() - startTime;
    
    if (content) {
      const preview = content.substring(0, 150).replace(/\n/g, ' ');
      console.log(`   ✅ Success in ${duration}ms`);
      console.log(`   📝 Preview: ${preview}...`);
      console.log(`   📊 Length: ${content.length} chars`);
      results.push({ test: test.name, success: true, duration, length: content.length });
    } else {
      console.log(`   ❌ Failed after ${duration}ms`);
      results.push({ test: test.name, success: false, duration });
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Final Statistics:');
  console.log('   Fetch Strategy Breakdown:');
  console.log(`   - Firecrawl: ${service.fetchStats.firecrawl}`);
  console.log(`   - Jina AI: ${service.fetchStats.jina}`);
  console.log(`   - Direct: ${service.fetchStats.direct}`);
  console.log(`   - Snippet: ${service.fetchStats.snippet}`);
  console.log(`   - Failed: ${service.fetchStats.failed}`);
  
  const successCount = results.filter(r => r.success).length;
  const successRate = (successCount / results.length * 100).toFixed(1);
  const avgDuration = (results.reduce((sum, r) => sum + r.duration, 0) / results.length).toFixed(0);
  
  console.log(`\n   Overall Success Rate: ${successRate}% (${successCount}/${results.length})`);
  console.log(`   Average Fetch Time: ${avgDuration}ms`);
  
  console.log('\n' + '='.repeat(60));
  
  if (!process.env.FIRECRAWL_API_KEY) {
    console.log('\n⚠️  Note: FIRECRAWL_API_KEY not set');
    console.log('   Get one from: https://firecrawl.dev');
    console.log('   This will improve success rate for sites like Medium, Forbes');
  }
  
  if (service.fetchStats.firecrawl > 0) {
    console.log('\n✅ Firecrawl is working! You have the API key configured.');
  }
  
  if (service.fetchStats.jina > 0) {
    console.log('✅ Jina AI is working! (Free, no API key needed)');
  }
  
  if (service.fetchStats.direct > 0) {
    console.log('✅ Direct fetch is working!');
  }
  
  console.log('\n🎉 Test complete!\n');
}

// Run the test
testScraping().catch(console.error);
