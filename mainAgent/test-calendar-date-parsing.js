/**
 * Test Calendar Date Parsing
 * 
 * Tests that "yesterday" is correctly parsed as the previous day
 */

const MainAgent = require('./mainAgent');

console.log('='.repeat(60));
console.log('CALENDAR DATE PARSING TEST');
console.log('='.repeat(60));

const mainAgent = new MainAgent();

// Test extractCalendarEventParams
console.log('\n📝 Testing extractCalendarEventParams...\n');

// Test 1: Yesterday
console.log('Test 1: "Create a calendar event for yesterday at 3 PM"');
const params1 = mainAgent.extractCalendarEventParams('Create a calendar event for yesterday at 3 PM');
console.log('Result:', JSON.stringify(params1, null, 2));

const startDate1 = new Date(params1.startDateTime);
const now = new Date();
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);

console.log('Current date:', now.toDateString());
console.log('Parsed date:', startDate1.toDateString());
console.log('Expected (yesterday):', yesterday.toDateString());

if (startDate1.toDateString() === yesterday.toDateString()) {
  console.log('✅ PASS: Yesterday parsed correctly');
} else {
  console.log('❌ FAIL: Yesterday NOT parsed correctly');
  console.log('  Expected:', yesterday.toISOString());
  console.log('  Got:', startDate1.toISOString());
}

// Test 2: Today
console.log('\n\nTest 2: "Create a calendar event for today at 3 PM"');
const params2 = mainAgent.extractCalendarEventParams('Create a calendar event for today at 3 PM');
const startDate2 = new Date(params2.startDateTime);
const today = new Date();

console.log('Current date:', now.toDateString());
console.log('Parsed date:', startDate2.toDateString());
console.log('Expected (today):', today.toDateString());

if (startDate2.toDateString() === today.toDateString()) {
  console.log('✅ PASS: Today parsed correctly');
} else {
  console.log('❌ FAIL: Today NOT parsed correctly');
}

// Test 3: Tomorrow
console.log('\n\nTest 3: "Create a calendar event for tomorrow at 3 PM"');
const params3 = mainAgent.extractCalendarEventParams('Create a calendar event for tomorrow at 3 PM');
const startDate3 = new Date(params3.startDateTime);
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);

console.log('Current date:', now.toDateString());
console.log('Parsed date:', startDate3.toDateString());
console.log('Expected (tomorrow):', tomorrow.toDateString());

if (startDate3.toDateString() === tomorrow.toDateString()) {
  console.log('✅ PASS: Tomorrow parsed correctly');
} else {
  console.log('❌ FAIL: Tomorrow NOT parsed correctly');
}

console.log('\n' + '='.repeat(60));
console.log('TEST COMPLETE');
console.log('='.repeat(60));
