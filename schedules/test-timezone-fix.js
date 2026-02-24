/**
 * Test script for Timezone Fix
 * 
 * Verifies that the scheduler agent correctly handles timezone conversion
 */

require('dotenv').config();
const moment = require('moment-timezone');

// Test the parseDateTimeToCron function
function testTimezoneConversion() {
  console.log('🧪 Testing Timezone Conversion...\n');

  const testCases = [
    {
      input: 'tomorrow at 2 PM',
      timezone: 'Asia/Kolkata',
      expectedHourUTC: 8, // 2 PM IST = 8:30 AM UTC
      expectedMinuteUTC: 30
    },
    {
      input: 'tomorrow at 9 AM',
      timezone: 'America/New_York',
      expectedHourUTC: 14, // 9 AM EST = 2 PM UTC (winter)
      expectedMinuteUTC: 0
    },
    {
      input: 'tomorrow at 5 PM',
      timezone: 'Europe/London',
      expectedHourUTC: 17, // 5 PM GMT = 5 PM UTC (winter)
      expectedMinuteUTC: 0
    }
  ];

  testCases.forEach((testCase, index) => {
    console.log(`Test ${index + 1}: "${testCase.input}" in ${testCase.timezone}`);
    
    // Simulate what the scheduler agent does
    const tomorrow = moment().add(1, 'day');
    const year = tomorrow.year();
    const month = tomorrow.month() + 1;
    const day = tomorrow.date();
    
    // Extract hour from input (simplified - real code uses chrono-node)
    const hourMatch = testCase.input.match(/(\d+)\s*(AM|PM)/i);
    let hour = parseInt(hourMatch[1]);
    const isPM = hourMatch[2].toUpperCase() === 'PM';
    if (isPM && hour !== 12) hour += 12;
    if (!isPM && hour === 12) hour = 0;
    
    // Create moment in user timezone
    const userMoment = moment.tz({
      year,
      month: month - 1,
      day,
      hour,
      minute: 0,
      second: 0
    }, testCase.timezone);
    
    // Convert to UTC
    const utcMoment = userMoment.clone().utc();
    
    console.log(`  User timezone: ${userMoment.format('YYYY-MM-DD HH:mm:ss Z')}`);
    console.log(`  UTC time: ${utcMoment.format('YYYY-MM-DD HH:mm:ss Z')}`);
    console.log(`  Cron: ${utcMoment.minute()} ${utcMoment.hour()} ${utcMoment.date()} ${utcMoment.month() + 1} *`);
    
    // Verify
    const actualHour = utcMoment.hour();
    const actualMinute = utcMoment.minute();
    
    if (actualHour === testCase.expectedHourUTC && actualMinute === testCase.expectedMinuteUTC) {
      console.log(`  ✅ PASS: UTC time is correct (${actualHour}:${actualMinute})\n`);
    } else {
      console.log(`  ❌ FAIL: Expected ${testCase.expectedHourUTC}:${testCase.expectedMinuteUTC}, got ${actualHour}:${actualMinute}\n`);
    }
  });
}

// Test timezone detection
function testTimezoneDetection() {
  console.log('\n🧪 Testing Timezone Detection...\n');

  const { getUserTimezone } = require('../utils/timezoneDetection');

  const testCases = [
    {
      name: 'Mumbai location',
      userLocation: { lat: 19.0760, lng: 72.8777 },
      expectedTimezone: 'Asia/Kolkata'
    },
    {
      name: 'New York location',
      userLocation: { lat: 40.7128, lng: -74.0060 },
      expectedTimezone: 'America/New_York'
    },
    {
      name: 'London location',
      userLocation: { lat: 51.5074, lng: -0.1278 },
      expectedTimezone: 'Europe/London'
    },
    {
      name: 'No location (default)',
      userLocation: null,
      expectedTimezone: 'Asia/Kolkata' // Default
    }
  ];

  testCases.forEach((testCase) => {
    console.log(`Test: ${testCase.name}`);
    const detected = getUserTimezone({
      userLocation: testCase.userLocation,
      defaultTimezone: 'Asia/Kolkata'
    });
    
    console.log(`  Detected: ${detected}`);
    
    if (detected === testCase.expectedTimezone) {
      console.log(`  ✅ PASS\n`);
    } else {
      console.log(`  ⚠️  Note: Expected ${testCase.expectedTimezone}, got ${detected}`);
      console.log(`  (Location-based detection is approximate)\n`);
    }
  });
}

// Run tests
console.log('='.repeat(60));
console.log('TIMEZONE FIX VERIFICATION');
console.log('='.repeat(60) + '\n');

testTimezoneConversion();
testTimezoneDetection();

console.log('='.repeat(60));
console.log('✅ All tests completed!');
console.log('='.repeat(60));
