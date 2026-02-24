/**
 * Test URL Validation
 * 
 * Tests the URL validation functionality to ensure typos and incomplete URLs
 * are caught before executing web searches.
 */

const URLValidator = require('../utils/urlValidation');

console.log('='.repeat(60));
console.log('URL VALIDATION TESTS');
console.log('='.repeat(60));

// Test Case 1: Protocol typo "htp://"
console.log('\n📝 Test 1: Protocol typo "htp://"');
console.log('Query: "Search for information at htp://example.com"');
const test1 = URLValidator.validateURLsInQuery('Search for information at htp://example.com');
console.log('Result:', JSON.stringify(test1, null, 2));
if (!test1.isValid) {
  console.log('✅ PASS: Invalid URL detected');
  console.log('Error message:', URLValidator.formatValidationErrors(test1.invalidURLs));
} else {
  console.log('❌ FAIL: Should have detected invalid URL');
}

// Test Case 2: Incomplete domain "www.example"
console.log('\n📝 Test 2: Incomplete domain "www.example"');
console.log('Query: "Open www.example"');
const test2 = URLValidator.validateURLsInQuery('Open www.example');
console.log('Result:', JSON.stringify(test2, null, 2));
if (!test2.isValid) {
  console.log('✅ PASS: Invalid URL detected');
  console.log('Error message:', URLValidator.formatValidationErrors(test2.invalidURLs));
} else {
  console.log('❌ FAIL: Should have detected invalid URL');
}

// Test Case 3: Valid URL "https://example.com"
console.log('\n📝 Test 3: Valid URL "https://example.com"');
console.log('Query: "Search for information at https://example.com"');
const test3 = URLValidator.validateURLsInQuery('Search for information at https://example.com');
console.log('Result:', JSON.stringify(test3, null, 2));
if (test3.isValid) {
  console.log('✅ PASS: Valid URL accepted');
} else {
  console.log('❌ FAIL: Should have accepted valid URL');
}

// Test Case 4: Valid URL without protocol "example.com"
console.log('\n📝 Test 4: Valid URL without protocol "example.com"');
console.log('Query: "Search for information at example.com"');
const test4 = URLValidator.validateURLsInQuery('Search for information at example.com');
console.log('Result:', JSON.stringify(test4, null, 2));
if (test4.isValid) {
  console.log('✅ PASS: Valid URL accepted');
} else {
  console.log('❌ FAIL: Should have accepted valid URL');
}

// Test Case 5: Protocol typo "htps://"
console.log('\n📝 Test 5: Protocol typo "htps://"');
console.log('Query: "Visit htps://google.com"');
const test5 = URLValidator.validateURLsInQuery('Visit htps://google.com');
console.log('Result:', JSON.stringify(test5, null, 2));
if (!test5.isValid) {
  console.log('✅ PASS: Invalid URL detected');
  console.log('Error message:', URLValidator.formatValidationErrors(test5.invalidURLs));
} else {
  console.log('❌ FAIL: Should have detected invalid URL');
}

// Test Case 6: No URL in query
console.log('\n📝 Test 6: No URL in query');
console.log('Query: "What is the weather today?"');
const test6 = URLValidator.validateURLsInQuery('What is the weather today?');
console.log('Result:', JSON.stringify(test6, null, 2));
if (!test6.hasURLs) {
  console.log('✅ PASS: No URLs detected (as expected)');
} else {
  console.log('❌ FAIL: Should not have detected any URLs');
}

// Test Case 7: Domain extension typo "example.con"
console.log('\n📝 Test 7: Domain extension typo "example.con"');
console.log('Query: "Go to example.con"');
const test7 = URLValidator.validateURLsInQuery('Go to example.con');
console.log('Result:', JSON.stringify(test7, null, 2));
if (!test7.isValid) {
  console.log('✅ PASS: Invalid URL detected');
  console.log('Error message:', URLValidator.formatValidationErrors(test7.invalidURLs));
} else {
  console.log('❌ FAIL: Should have detected invalid URL');
}

// Test Case 8: Multiple URLs (one valid, one invalid)
console.log('\n📝 Test 8: Multiple URLs (one valid, one invalid)');
console.log('Query: "Check htp://example.com and https://google.com"');
const test8 = URLValidator.validateURLsInQuery('Check htp://example.com and https://google.com');
console.log('Result:', JSON.stringify(test8, null, 2));
if (!test8.isValid && test8.invalidURLs.length === 1) {
  console.log('✅ PASS: One invalid URL detected out of two');
  console.log('Error message:', URLValidator.formatValidationErrors(test8.invalidURLs));
} else {
  console.log('❌ FAIL: Should have detected one invalid URL');
}

console.log('\n' + '='.repeat(60));
console.log('TESTS COMPLETE');
console.log('='.repeat(60));
