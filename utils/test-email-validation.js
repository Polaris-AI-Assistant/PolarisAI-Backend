/**
 * Test Email Content Validation
 * Tests validation of email parameters for completeness
 */

const { validateEmailContent, formatEmailValidationErrors } = require('./validation');

console.log('\n============================================================');
console.log('EMAIL CONTENT VALIDATION TESTS');
console.log('============================================================\n');

// Test 1: Missing subject and body
console.log('📝 Test 1: Missing subject and body');
const result1 = validateEmailContent({
  to: 'john@example.com',
  subject: '',
  body: '',
  query: 'Send email to john@example.com'
});
console.log('Result:', JSON.stringify(result1, null, 2));
if (!result1.isValid && result1.errors.length === 2) {
  console.log('✅ PASS: Both subject and body missing detected\n');
  console.log('Error message:');
  console.log(formatEmailValidationErrors(result1.errors, result1.warnings));
  console.log();
} else {
  console.log('❌ FAIL: Should detect missing subject and body\n');
}

// Test 2: Suspicious domain
console.log('📝 Test 2: Suspicious/fake domain');
const result2 = validateEmailContent({
  to: 'test@fakefakedomain12345.com',
  subject: 'Test',
  body: 'Test message',
  query: 'Send email to test@fakefakedomain12345.com'
});
console.log('Result:', JSON.stringify(result2, null, 2));
if (result2.warnings.length > 0) {
  console.log('✅ PASS: Suspicious domain detected\n');
  console.log('Warning message:');
  console.log(formatEmailValidationErrors(result2.errors, result2.warnings));
  console.log();
} else {
  console.log('❌ FAIL: Should detect suspicious domain\n');
}

// Test 3: Valid email with all content
console.log('📝 Test 3: Valid email with all content');
const result3 = validateEmailContent({
  to: 'john@gmail.com',
  subject: 'Meeting Tomorrow',
  body: 'Hi John, confirming our 2pm meeting.',
  query: 'Send email to john@gmail.com with subject Meeting Tomorrow'
});
console.log('Result:', JSON.stringify(result3, null, 2));
if (result3.isValid && result3.errors.length === 0) {
  console.log('✅ PASS: Valid email accepted\n');
} else {
  console.log('❌ FAIL: Should accept valid email\n');
}

// Test 4: Missing only subject
console.log('📝 Test 4: Missing only subject');
const result4 = validateEmailContent({
  to: 'john@gmail.com',
  subject: '',
  body: 'Hi John, this is a test message.',
  query: 'Send email to john@gmail.com saying Hi John'
});
console.log('Result:', JSON.stringify(result4, null, 2));
if (!result4.isValid && result4.errors.length === 1 && result4.errors[0].type === 'MISSING_EMAIL_SUBJECT') {
  console.log('✅ PASS: Missing subject detected\n');
  console.log('Error message:');
  console.log(formatEmailValidationErrors(result4.errors, result4.warnings));
  console.log();
} else {
  console.log('❌ FAIL: Should detect missing subject\n');
}

// Test 5: Missing only body
console.log('📝 Test 5: Missing only body');
const result5 = validateEmailContent({
  to: 'john@gmail.com',
  subject: 'Test Subject',
  body: '',
  query: 'Send email to john@gmail.com about test'
});
console.log('Result:', JSON.stringify(result5, null, 2));
if (!result5.isValid && result5.errors.length === 1 && result5.errors[0].type === 'MISSING_EMAIL_BODY') {
  console.log('✅ PASS: Missing body detected\n');
  console.log('Error message:');
  console.log(formatEmailValidationErrors(result5.errors, result5.warnings));
  console.log();
} else {
  console.log('❌ FAIL: Should detect missing body\n');
}

// Test 6: Suspicious domain with missing content
console.log('📝 Test 6: Suspicious domain + missing content');
const result6 = validateEmailContent({
  to: 'test@nonexistent12345.com',
  subject: '',
  body: '',
  query: 'Send email to test@nonexistent12345.com'
});
console.log('Result:', JSON.stringify(result6, null, 2));
if (!result6.isValid && result6.warnings.length > 0) {
  console.log('✅ PASS: Both issues detected\n');
  console.log('Error message:');
  console.log(formatEmailValidationErrors(result6.errors, result6.warnings));
  console.log();
} else {
  console.log('❌ FAIL: Should detect both issues\n');
}

console.log('============================================================');
console.log('TESTS COMPLETE');
console.log('============================================================\n');
