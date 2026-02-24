/**
 * Test Smart Email Content Validation
 * Tests 3-tier validation logic with AI generation capability
 */

const { validateEmailContent, formatEmailValidationErrors } = require('./validation');

console.log('\n============================================================');
console.log('SMART EMAIL CONTENT VALIDATION TESTS');
console.log('============================================================\n');

// Test 1: TIER 1 - Completely missing (no topic, no subject, no body)
console.log('📝 Test 1: TIER 1 - Completely missing content');
const result1 = validateEmailContent({
  to: 'john@example.com',
  subject: '',
  body: '',
  query: 'Send email to john@example.com'
});
console.log('Result:', JSON.stringify(result1, null, 2));
if (!result1.isValid && !result1.canGenerateAI) {
  console.log('✅ PASS: Rejected - no topic/intent found\n');
  console.log('Error message:');
  console.log(formatEmailValidationErrors(result1.errors, result1.warnings));
  console.log();
} else {
  console.log('❌ FAIL: Should reject when no topic/intent\n');
}

// Test 2: TIER 2 - Has topic (AI can generate)
console.log('📝 Test 2: TIER 2 - Has topic "my well being"');
const result2 = validateEmailContent({
  to: 'jyotiyadav8002@gmail.com',
  subject: '',
  body: '',
  query: 'send to jyotiyadav8002@gmail.com about my well being'
});
console.log('Result:', JSON.stringify(result2, null, 2));
if (result2.isValid && result2.canGenerateAI && result2.topic === 'my well being') {
  console.log('✅ PASS: Accepted - AI can generate from topic\n');
} else {
  console.log('❌ FAIL: Should accept with AI generation\n');
}

// Test 3: TIER 2 - Has topic with suspicious domain
console.log('📝 Test 3: TIER 2 - Has topic with suspicious domain');
const result3 = validateEmailContent({
  to: 'test@fakefakedomain12345.com',
  subject: '',
  body: '',
  query: 'Send email to test@fakefakedomain12345.com about project update'
});
console.log('Result:', JSON.stringify(result3, null, 2));
if (result3.isValid && result3.canGenerateAI && result3.warnings.length > 0) {
  console.log('✅ PASS: Accepted with warning - AI can generate\n');
  console.log('Warning message:');
  console.log(formatEmailValidationErrors(result3.errors, result3.warnings));
  console.log();
} else {
  console.log('❌ FAIL: Should accept with warning\n');
}

// Test 4: TIER 3 - Complete details
console.log('📝 Test 4: TIER 3 - Complete details (subject + body)');
const result4 = validateEmailContent({
  to: 'john@gmail.com',
  subject: 'Meeting Tomorrow',
  body: 'Hi John, confirming our 2pm meeting.',
  query: 'Send email to john@gmail.com with subject Meeting Tomorrow'
});
console.log('Result:', JSON.stringify(result4, null, 2));
if (result4.isValid && !result4.canGenerateAI) {
  console.log('✅ PASS: Accepted - use provided content\n');
} else {
  console.log('❌ FAIL: Should accept without AI generation\n');
}

// Test 5: Has body but no subject (AI generates subject)
console.log('📝 Test 5: Has body but no subject');
const result5 = validateEmailContent({
  to: 'john@gmail.com',
  subject: '',
  body: 'Hi John, this is a test message about the project.',
  query: 'Send email to john@gmail.com saying Hi John'
});
console.log('Result:', JSON.stringify(result5, null, 2));
if (result5.isValid && result5.canGenerateAI) {
  console.log('✅ PASS: Accepted - AI will generate subject\n');
} else {
  console.log('❌ FAIL: Should accept with AI subject generation\n');
}

// Test 6: Multiple topics
console.log('📝 Test 6: Multiple topics in query');
const result6 = validateEmailContent({
  to: 'team@company.com',
  subject: '',
  body: '',
  query: 'Send email to team@company.com about the project deadline and budget concerns'
});
console.log('Result:', JSON.stringify(result6, null, 2));
if (result6.isValid && result6.canGenerateAI && result6.topic) {
  console.log('✅ PASS: Accepted - AI can generate from topics\n');
  console.log(`Topic extracted: "${result6.topic}"\n`);
} else {
  console.log('❌ FAIL: Should accept with AI generation\n');
}

// Test 7: "regarding" keyword
console.log('📝 Test 7: Using "regarding" keyword');
const result7 = validateEmailContent({
  to: 'hr@company.com',
  subject: '',
  body: '',
  query: 'Send email to hr@company.com regarding my leave request'
});
console.log('Result:', JSON.stringify(result7, null, 2));
if (result7.isValid && result7.canGenerateAI && result7.topic === 'my leave request') {
  console.log('✅ PASS: Accepted - topic extracted from "regarding"\n');
} else {
  console.log('❌ FAIL: Should extract topic from "regarding"\n');
}

// Test 8: "saying" keyword
console.log('📝 Test 8: Using "saying" keyword');
const result8 = validateEmailContent({
  to: 'boss@company.com',
  subject: '',
  body: '',
  query: 'Send email to boss@company.com saying I will be late today'
});
console.log('Result:', JSON.stringify(result8, null, 2));
if (result8.isValid && result8.canGenerateAI && result8.topic === 'I will be late today') {
  console.log('✅ PASS: Accepted - topic extracted from "saying"\n');
} else {
  console.log('❌ FAIL: Should extract topic from "saying"\n');
}

console.log('============================================================');
console.log('TESTS COMPLETE');
console.log('============================================================\n');
