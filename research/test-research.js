/**
 * Test script for Deep Research Agent
 * 
 * Usage: node research/test-research.js
 */

const ResearchAgent = require('./researchAgent');

// Test queries
const testQueries = [
  'What are the best AI models for startups in 2026?',
  'Compare React vs Vue.js for web development',
  'Analyze the impact of AI on job markets',
  'Latest developments in quantum computing'
];

async function testResearch() {
  console.log('🧪 Testing Deep Research Agent\n');
  console.log('=' .repeat(60));

  const agent = new ResearchAgent();

  // Test with first query
  const query = testQueries[0];
  console.log(`\n📝 Query: "${query}"\n`);

  try {
    const result = await agent.processQuery(query, (progress) => {
      console.log(`[${progress.step.toUpperCase()}] ${progress.message}`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ RESEARCH COMPLETED\n');

    if (result.success) {
      console.log('📊 METADATA:');
      console.log(`   Intent: ${result.metadata.intent}`);
      console.log(`   Sources: ${result.metadata.totalSources}`);
      console.log(`   Duration: ${result.metadata.duration}`);
      console.log();

      console.log('📝 ANSWER:');
      console.log(result.answer.substring(0, 500) + '...\n');

      console.log('📚 SOURCES:');
      result.sources.slice(0, 5).forEach(source => {
        console.log(`   [${source.id}] ${source.title}`);
        console.log(`       ${source.url}`);
      });
      console.log();

      if (result.followUpQuestions && result.followUpQuestions.length > 0) {
        console.log('💡 FOLLOW-UP QUESTIONS:');
        result.followUpQuestions.forEach((q, i) => {
          console.log(`   ${i + 1}. ${q}`);
        });
        console.log();
      }

      console.log('🎯 STEPS COMPLETED:');
      result.steps.forEach((step, i) => {
        console.log(`   ${i + 1}. ${step}`);
      });
      console.log();

    } else {
      console.log('❌ RESEARCH FAILED:');
      console.log(`   Error: ${result.error}`);
      console.log();
    }

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);
  }

  console.log('=' .repeat(60));
  console.log('\n✅ Test completed!\n');
  console.log('💡 Try other queries:');
  testQueries.slice(1).forEach((q, i) => {
    console.log(`   ${i + 2}. ${q}`);
  });
  console.log();
}

// Run test
testResearch().catch(console.error);
