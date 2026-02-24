/**
 * Test Schedule/Reminder Temporal Validation
 * 
 * Tests the validation of schedules/reminders to ensure past times are caught
 */

const { validateScheduleReminder, formatScheduleValidationErrors } = require('./validation');

console.log('='.repeat(60));
console.log('SCHEDULE/REMINDER TEMPORAL VALIDATION TESTS');
console.log('='.repeat(60));

// Test Case 1: Past time (2 hours ago)
console.log('\n📝 Test 1: Past time (2 hours ago)');
const test1 = validateScheduleReminder({
  content: 'Check Bitcoin price',
  datetime: '2 hours ago',
  query: 'Schedule a reminder for 2 hours ago'
});

console.log('Result:', JSON.stringify(test1, null, 2));
if (!test1.isValid && test1.errors[0].type === 'PAST_SCHEDULE_TIME') {
  console.log('✅ PASS: Past time detected');
  console.log('\nError message:');
  console.log(formatScheduleValidationErrors(test1.errors));
} else {
  console.log('❌ FAIL: Should have detected past time');
}

// Test Case 2: Future time (2 hours from now)
console.log('\n📝 Test 2: Future time (2 hours from now)');
const test2 = validateScheduleReminder({
  content: 'Check Bitcoin price',
  datetime: '2 hours from now',
  query: 'Schedule a reminder for 2 hours from now'
});

console.log('Result:', JSON.stringify(test2, null, 2));
if (test2.isValid) {
  console.log('✅ PASS: Future time accepted');
} else {
  console.log('❌ FAIL: Should have accepted future time');
}

// Test Case 3: Yesterday
console.log('\n📝 Test 3: Yesterday');
const test3 = validateScheduleReminder({
  content: 'Call mom',
  datetime: 'yesterday',
  query: 'Remind me to call mom yesterday'
});

console.log('Result:', JSON.stringify(test3, null, 2));
if (!test3.isValid && test3.errors[0].type === 'PAST_SCHEDULE_TIME') {
  console.log('✅ PASS: Past time detected');
  console.log('\nError message:');
  console.log(formatScheduleValidationErrors(test3.errors));
} else {
  console.log('❌ FAIL: Should have detected past time');
}

// Test Case 4: Last week
console.log('\n📝 Test 4: Last week');
const test4 = validateScheduleReminder({
  content: 'Submit report',
  datetime: 'last week',
  query: 'Remind me to submit report last week'
});

console.log('Result:', JSON.stringify(test4, null, 2));
if (!test4.isValid && test4.errors[0].type === 'PAST_SCHEDULE_TIME') {
  console.log('✅ PASS: Past time detected');
  console.log('\nError message:');
  console.log(formatScheduleValidationErrors(test4.errors));
} else {
  console.log('❌ FAIL: Should have detected past time');
}

// Test Case 5: Tomorrow (valid)
console.log('\n📝 Test 5: Tomorrow (valid)');
const test5 = validateScheduleReminder({
  content: 'Meeting',
  datetime: 'tomorrow at 2 PM',
  query: 'Remind me about meeting tomorrow at 2 PM'
});

console.log('Result:', JSON.stringify(test5, null, 2));
if (test5.isValid) {
  console.log('✅ PASS: Future time accepted');
} else {
  console.log('❌ FAIL: Should have accepted future time');
}

// Test Case 6: Missing content
console.log('\n📝 Test 6: Missing content');
const test6 = validateScheduleReminder({
  content: '',
  datetime: 'tomorrow',
  query: 'Remind me tomorrow'
});

console.log('Result:', JSON.stringify(test6, null, 2));
if (!test6.isValid && test6.errors[0].type === 'MISSING_REQUIRED_FIELD') {
  console.log('✅ PASS: Missing content detected');
} else {
  console.log('❌ FAIL: Should have detected missing content');
}

// Test Case 7: 5 minutes ago
console.log('\n📝 Test 7: 5 minutes ago');
const test7 = validateScheduleReminder({
  content: 'Check email',
  datetime: '5 minutes ago',
  query: 'Remind me to check email 5 minutes ago'
});

console.log('Result:', JSON.stringify(test7, null, 2));
if (!test7.isValid && test7.errors[0].type === 'PAST_SCHEDULE_TIME') {
  console.log('✅ PASS: Past time detected');
  console.log('\nError message:');
  console.log(formatScheduleValidationErrors(test7.errors));
} else {
  console.log('❌ FAIL: Should have detected past time');
}

console.log('\n' + '='.repeat(60));
console.log('TESTS COMPLETE');
console.log('='.repeat(60));
