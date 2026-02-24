/**
 * Test Calendar Event Temporal Validation
 * 
 * Tests the validation of calendar events to ensure past dates are caught
 */

const { validateCalendarEvent, formatCalendarValidationErrors } = require('./validation');

console.log('='.repeat(60));
console.log('CALENDAR EVENT TEMPORAL VALIDATION TESTS');
console.log('='.repeat(60));

// Test Case 1: Past date (yesterday)
console.log('\n📝 Test 1: Past date (yesterday at 3 PM)');
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
yesterday.setHours(15, 0, 0, 0);

const test1 = validateCalendarEvent({
  summary: 'Yesterday meeting',
  startDateTime: yesterday.toISOString(),
  endDateTime: new Date(yesterday.getTime() + 60*60*1000).toISOString(),
  query: 'Create a calendar event for yesterday at 3 PM'
});

console.log('Result:', JSON.stringify(test1, null, 2));
if (!test1.isValid && test1.errors[0].type === 'PAST_DATE') {
  console.log('✅ PASS: Past date detected');
  console.log('\nError message:');
  console.log(formatCalendarValidationErrors(test1.errors));
} else {
  console.log('❌ FAIL: Should have detected past date');
}

// Test Case 2: Future date (tomorrow)
console.log('\n📝 Test 2: Future date (tomorrow at 3 PM)');
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
tomorrow.setHours(15, 0, 0, 0);

const test2 = validateCalendarEvent({
  summary: 'Tomorrow meeting',
  startDateTime: tomorrow.toISOString(),
  endDateTime: new Date(tomorrow.getTime() + 60*60*1000).toISOString(),
  query: 'Create a calendar event for tomorrow at 3 PM'
});

console.log('Result:', JSON.stringify(test2, null, 2));
if (test2.isValid) {
  console.log('✅ PASS: Future date accepted');
} else {
  console.log('❌ FAIL: Should have accepted future date');
}

// Test Case 3: Past date (2 hours ago)
console.log('\n📝 Test 3: Past date (2 hours ago)');
const twoHoursAgo = new Date();
twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);

const test3 = validateCalendarEvent({
  summary: '2 hours ago meeting',
  startDateTime: twoHoursAgo.toISOString(),
  endDateTime: new Date(twoHoursAgo.getTime() + 60*60*1000).toISOString(),
  query: 'Schedule a reminder for 2 hours ago'
});

console.log('Result:', JSON.stringify(test3, null, 2));
if (!test3.isValid && test3.errors[0].type === 'PAST_DATE') {
  console.log('✅ PASS: Past date detected');
  console.log('\nError message:');
  console.log(formatCalendarValidationErrors(test3.errors));
} else {
  console.log('❌ FAIL: Should have detected past date');
}

// Test Case 4: Invalid date range (end before start)
console.log('\n📝 Test 4: Invalid date range (end before start)');
const futureStart = new Date();
futureStart.setDate(futureStart.getDate() + 1);
futureStart.setHours(15, 0, 0, 0);

const futureEnd = new Date(futureStart.getTime() - 60*60*1000); // 1 hour before start

const test4 = validateCalendarEvent({
  summary: 'Invalid range meeting',
  startDateTime: futureStart.toISOString(),
  endDateTime: futureEnd.toISOString(),
  query: 'Create event with invalid range'
});

console.log('Result:', JSON.stringify(test4, null, 2));
if (!test4.isValid && test4.errors[0].type === 'INVALID_DATE_RANGE') {
  console.log('✅ PASS: Invalid date range detected');
  console.log('\nError message:');
  console.log(formatCalendarValidationErrors(test4.errors));
} else {
  console.log('❌ FAIL: Should have detected invalid date range');
}

// Test Case 5: Missing summary
console.log('\n📝 Test 5: Missing summary');
const test5 = validateCalendarEvent({
  summary: '',
  startDateTime: tomorrow.toISOString(),
  endDateTime: new Date(tomorrow.getTime() + 60*60*1000).toISOString(),
  query: 'Create event without title'
});

console.log('Result:', JSON.stringify(test5, null, 2));
if (!test5.isValid && test5.errors[0].type === 'MISSING_REQUIRED_FIELD') {
  console.log('✅ PASS: Missing summary detected');
} else {
  console.log('❌ FAIL: Should have detected missing summary');
}

// Test Case 6: Valid event (1 hour from now)
console.log('\n📝 Test 6: Valid event (1 hour from now)');
const oneHourFromNow = new Date();
oneHourFromNow.setHours(oneHourFromNow.getHours() + 1);

const test6 = validateCalendarEvent({
  summary: 'Valid meeting',
  startDateTime: oneHourFromNow.toISOString(),
  endDateTime: new Date(oneHourFromNow.getTime() + 60*60*1000).toISOString(),
  query: 'Create event in 1 hour'
});

console.log('Result:', JSON.stringify(test6, null, 2));
if (test6.isValid) {
  console.log('✅ PASS: Valid event accepted');
} else {
  console.log('❌ FAIL: Should have accepted valid event');
}

console.log('\n' + '='.repeat(60));
console.log('TESTS COMPLETE');
console.log('='.repeat(60));
