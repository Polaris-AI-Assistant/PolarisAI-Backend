/**
 * Test script to verify PDF generation with web search results
 * 
 * This tests the fix for the issue where PDFs were being generated
 * with AI response text instead of actual web search results.
 * 
 * Usage: node test-pdf-generation.js
 */

const { getLastArtifactByType } = require('../utils/artifactMemory');

// Mock conversation ID for testing
const TEST_CONVERSATION_ID = 'test-conversation-123';

async function testWebSearchArtifactRetrieval() {
  console.log('='.repeat(60));
  console.log('Testing Web Search Artifact Retrieval for PDF Generation');
  console.log('='.repeat(60));
  
  try {
    console.log(`\n1. Attempting to retrieve web search artifact from conversation: ${TEST_CONVERSATION_ID}`);
    
    const webSearchArtifact = await getLastArtifactByType(TEST_CONVERSATION_ID, 'web_search');
    
    if (webSearchArtifact) {
      console.log('\n✅ SUCCESS: Web search artifact found!');
      console.log(`   Title: ${webSearchArtifact.title}`);
      console.log(`   Query: ${webSearchArtifact.data?.query || 'N/A'}`);
      console.log(`   Content Length: ${webSearchArtifact.data?.synthesizedContent?.length || 0} chars`);
      console.log(`   Sources: ${webSearchArtifact.data?.sources?.length || 0}`);
      
      if (webSearchArtifact.data?.sources && webSearchArtifact.data.sources.length > 0) {
        console.log('\n   Sources:');
        webSearchArtifact.data.sources.forEach((source, index) => {
          console.log(`   ${index + 1}. ${source.title}`);
          console.log(`      ${source.url}`);
        });
      }
      
      // Build the content that would be used for PDF generation
      let fullContent = `# ${webSearchArtifact.data.query}\n\n`;
      fullContent += webSearchArtifact.data.synthesizedContent;
      
      if (webSearchArtifact.data.sources && webSearchArtifact.data.sources.length > 0) {
        fullContent += '\n\n---\n\n## Sources\n\n';
        webSearchArtifact.data.sources.forEach((source, index) => {
          fullContent += `${index + 1}. **${source.title}**\n`;
          fullContent += `   ${source.url}\n`;
          if (source.snippet) {
            fullContent += `   ${source.snippet}\n`;
          }
          fullContent += '\n';
        });
      }
      
      console.log(`\n2. Generated PDF content preview (first 500 chars):`);
      console.log('-'.repeat(60));
      console.log(fullContent.substring(0, 500) + '...');
      console.log('-'.repeat(60));
      
      console.log(`\n✅ Total PDF content length: ${fullContent.length} chars`);
      
    } else {
      console.log('\n⚠️  No web search artifact found in this conversation');
      console.log('   This is expected if no web search has been performed yet.');
    }
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Test Complete');
  console.log('='.repeat(60));
}

// Test the detection patterns
function testFileGenerationDetection() {
  console.log('\n' + '='.repeat(60));
  console.log('Testing File Generation Detection Patterns');
  console.log('='.repeat(60));
  
  const testQueries = [
    'create a pdf with the above search results',
    'generate pdf from the search results',
    'make a pdf with previous search',
    'export as pdf',
    'create a downloadable pdf',
    'search the web about latest conflicts and give me results in pdf',
    'create a txt file with the above results',
    'just a regular query without file generation',
  ];
  
  // Simple pattern matching (mimics the controller function)
  const pdfPatterns = [
    /generate\s+(?:a\s+)?pdf/i,
    /export\s+(?:as\s+)?pdf/i,
    /create\s+(?:a\s+)?pdf/i,
    /make\s+(?:a\s+)?pdf/i,
    /convert\s+(?:to\s+)?pdf/i,
    /save\s+(?:as\s+)?pdf/i,
    /download\s+(?:as\s+)?pdf/i,
    /in\s+(?:a\s+)?pdf/i,
    /in\s+pdf\s+(?:format|file)/i,
    /as\s+(?:a\s+)?pdf/i,
    /\bpdf\b.*(?:file|document|export|generate|create|download|format)/i,
    /(?:file|document|export|generate|create|download)\s+.*pdf/i,
    /(?:with|from|of)\s+(?:the\s+)?(?:above|previous|search|results?).*pdf/i,
    /pdf.*(?:with|from|of)\s+(?:the\s+)?(?:above|previous|search|results?)/i,
  ];
  
  console.log('\nTest Results:');
  testQueries.forEach((query, index) => {
    const isPDF = pdfPatterns.some(pattern => pattern.test(query));
    const status = isPDF ? '✅ PDF' : '❌ No PDF';
    console.log(`${index + 1}. ${status}: "${query}"`);
  });
  
  console.log('\n' + '='.repeat(60));
}

// Run tests
async function runTests() {
  testFileGenerationDetection();
  await testWebSearchArtifactRetrieval();
}

runTests().catch(console.error);
