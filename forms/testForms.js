/**
 * Test script for Google Forms integration
 * 
 * This script tests the basic functionality of the Forms service
 * Run with: node forms/testForms.js
 */

const { getUserForms, getFormById, storeForms } = require('./formsService');

// Test configuration
const TEST_USER_ID = process.env.TEST_USER_ID || 'test-user-id';
const TEST_FORM_ID = process.env.TEST_FORM_ID || null;

async function testFormsIntegration() {
  console.log('🧪 Testing Google Forms Integration\n');
  console.log('=' .repeat(50));

  // Test 1: Get user forms
  console.log('\n📋 Test 1: Getting user forms...');
  try {
    const result = await getUserForms(TEST_USER_ID);
    if (result.success) {
      console.log('✅ Success! Found', result.count, 'forms');
      if (result.forms && result.forms.length > 0) {
        console.log('\nFirst form:');
        console.log('  - Name:', result.forms[0].name);
        console.log('  - ID:', result.forms[0].id);
        console.log('  - Created:', result.forms[0].createdTime);
      }
    } else {
      console.log('❌ Failed:', result.error);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  // Test 2: Get specific form (if form ID provided)
  if (TEST_FORM_ID) {
    console.log('\n📄 Test 2: Getting specific form...');
    try {
      const result = await getFormById(TEST_USER_ID, TEST_FORM_ID);
      if (result.success) {
        console.log('✅ Success! Form details:');
        console.log('  - Title:', result.form.info?.title);
        console.log('  - Description:', result.form.info?.description);
        console.log('  - Questions:', result.form.items?.length || 0);
      } else {
        console.log('❌ Failed:', result.error);
      }
    } catch (error) {
      console.log('❌ Error:', error.message);
    }
  } else {
    console.log('\n⏭️  Test 2: Skipped (no TEST_FORM_ID provided)');
  }

  // Test 3: Store forms
  console.log('\n💾 Test 3: Storing forms in database...');
  try {
    const result = await storeForms(TEST_USER_ID);
    if (result.success) {
      console.log('✅ Success!', result.message);
      console.log('  - Stored:', result.stored, 'forms');
    } else {
      console.log('❌ Failed:', result.error);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  console.log('\n' + '='.repeat(50));
  console.log('✨ Tests completed!\n');
}

// Run tests
testFormsIntegration().catch(console.error);
