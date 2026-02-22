/**
 * Test script for Web Search Agent
 * 
 * This script tests the web search service directly without requiring
 * the full server to be running. Useful for quick verification.
 * 
 * Usage: node websearch/test-websearch.js
 */

require('dotenv').config();
const webSearchService = require('./webSearchService');

async function testWebSearch() {
  console.log('🧪 Testing Web Search Agent\n');
  console.log('=' .repeat(60));
  
  // Check API key
  if (!process.env.SERPER_API_KEY) {
    console.error('❌ SERPER_API_KEY not found in environment variables');
    process.exit(1);
  }
  console.log('✅ SERPER_API_KEY found');
  
  // Test 1: General Web Search
  console.log('\n📝 Test 1: General Web Search');
  console.log('-'.repeat(60));
  try {
    const webResults = await webSearchService.searchWeb({
      query: 'artificial intelligence latest developments',
      num: 5
    });
    console.log('✅ Web search successful');
    console.log(`   Found ${webResults.organic?.length || 0} results`);
    if (webResults.organic && webResults.organic.length > 0) {
      console.log(`   First result: ${webResults.organic[0].title}`);
    }
    if (webResults.answerBox) {
      console.log(`   Answer box found: ${webResults.answerBox.title || 'Yes'}`);
    }
  } catch (error) {
    console.error('❌ Web search failed:', error.message);
  }
  
  // Test 2: News Search
  console.log('\n📰 Test 2: News Search');
  console.log('-'.repeat(60));
  try {
    const newsResults = await webSearchService.searchNews({
      query: 'technology news',
      num: 5
    });
    console.log('✅ News search successful');
    console.log(`   Found ${newsResults.news?.length || 0} news articles`);
    if (newsResults.news && newsResults.news.length > 0) {
      console.log(`   First article: ${newsResults.news[0].title}`);
    }
  } catch (error) {
    console.error('❌ News search failed:', error.message);
  }
  
  // Test 3: Image Search
  console.log('\n🖼️  Test 3: Image Search');
  console.log('-'.repeat(60));
  try {
    const imageResults = await webSearchService.searchImages({
      query: 'sunset',
      num: 5
    });
    console.log('✅ Image search successful');
    console.log(`   Found ${imageResults.images?.length || 0} images`);
    if (imageResults.images && imageResults.images.length > 0) {
      console.log(`   First image: ${imageResults.images[0].title || 'Image found'}`);
    }
  } catch (error) {
    console.error('❌ Image search failed:', error.message);
  }
  
  // Test 4: Error Handling
  console.log('\n⚠️  Test 4: Error Handling');
  console.log('-'.repeat(60));
  try {
    await webSearchService.searchWeb({
      query: '' // Empty query should fail
    });
    console.error('❌ Should have thrown an error for empty query');
  } catch (error) {
    console.log('✅ Error handling works correctly');
    console.log(`   Error message: ${error.message}`);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🎉 All tests completed!\n');
}

// Run tests
testWebSearch().catch(error => {
  console.error('\n💥 Test suite failed:', error);
  process.exit(1);
});
