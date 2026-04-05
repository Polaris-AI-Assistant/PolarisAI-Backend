/**
 * Test script for language detection improvements
 * 
 * Tests the fix for incorrect language detection when queries contain
 * foreign proper nouns (like Indian city names in English sentences)
 * 
 * Usage: node test-language-detection.js
 */

const { detectLanguage, getLanguageName } = require('./languageDetection');

const testCases = [
  // English queries with Indian city names (should be detected as English)
  {
    query: 'compare it with ujjain weather, and show comparison in table form',
    expected: 'en',
    description: 'English query with Indian city name'
  },
  {
    query: 'show me mumbai weather',
    expected: 'en',
    description: 'English query with Mumbai'
  },
  {
    query: 'what is the temperature in delhi today',
    expected: 'en',
    description: 'English query with Delhi'
  },
  {
    query: 'compare bangalore and pune weather',
    expected: 'en',
    description: 'English query with multiple Indian cities'
  },
  
  // Pure Hindi queries (should be detected as Hindi)
  {
    query: 'ujjain ka mausam batao',
    expected: 'hi',
    description: 'Hindi query with city name'
  },
  {
    query: 'मुंबई का मौसम कैसा है',
    expected: 'hi',
    description: 'Hindi query in Devanagari script'
  },
  {
    query: 'आज दिल्ली में तापमान क्या है',
    expected: 'hi',
    description: 'Hindi query about Delhi weather'
  },
  
  // Pure English queries
  {
    query: 'what is the weather like today',
    expected: 'en',
    description: 'Pure English query'
  },
  {
    query: 'create a document and share it with my team',
    expected: 'en',
    description: 'English task query'
  },
  {
    query: 'schedule a meeting for tomorrow at 2pm',
    expected: 'en',
    description: 'English scheduling query'
  },
  
  // Marathi queries
  {
    query: 'पुण्याचे हवामान कसे आहे',
    expected: 'mr',
    description: 'Marathi query in Devanagari'
  },
  
  // Other languages
  {
    query: '¿Cómo está el clima en Madrid?',
    expected: 'es',
    description: 'Spanish query'
  },
  {
    query: 'Quel temps fait-il à Paris?',
    expected: 'fr',
    description: 'French query'
  }
];

async function runTests() {
  console.log('='.repeat(80));
  console.log('Language Detection Test Suite');
  console.log('='.repeat(80));
  console.log();
  
  let passed = 0;
  let failed = 0;
  const failures = [];
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`Test ${i + 1}/${testCases.length}: ${testCase.description}`);
    console.log(`Query: "${testCase.query}"`);
    console.log(`Expected: ${getLanguageName(testCase.expected)} (${testCase.expected})`);
    
    try {
      const detected = await detectLanguage(testCase.query);
      const detectedName = getLanguageName(detected);
      
      if (detected === testCase.expected) {
        console.log(`✅ PASS: Detected ${detectedName} (${detected})`);
        passed++;
      } else {
        console.log(`❌ FAIL: Detected ${detectedName} (${detected}), expected ${getLanguageName(testCase.expected)} (${testCase.expected})`);
        failed++;
        failures.push({
          test: i + 1,
          description: testCase.description,
          query: testCase.query,
          expected: testCase.expected,
          detected: detected
        });
      }
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
      failed++;
      failures.push({
        test: i + 1,
        description: testCase.description,
        query: testCase.query,
        expected: testCase.expected,
        error: error.message
      });
    }
    
    console.log();
  }
  
  console.log('='.repeat(80));
  console.log('Test Results');
  console.log('='.repeat(80));
  console.log(`Total Tests: ${testCases.length}`);
  console.log(`Passed: ${passed} (${Math.round(passed / testCases.length * 100)}%)`);
  console.log(`Failed: ${failed} (${Math.round(failed / testCases.length * 100)}%)`);
  
  if (failures.length > 0) {
    console.log();
    console.log('Failed Tests:');
    failures.forEach(failure => {
      console.log(`  ${failure.test}. ${failure.description}`);
      console.log(`     Query: "${failure.query}"`);
      console.log(`     Expected: ${failure.expected}, Got: ${failure.detected || 'ERROR'}`);
      if (failure.error) {
        console.log(`     Error: ${failure.error}`);
      }
    });
  }
  
  console.log();
  console.log('='.repeat(80));
}

// Run tests
runTests().catch(error => {
  console.error('Test suite error:', error);
  process.exit(1);
});
