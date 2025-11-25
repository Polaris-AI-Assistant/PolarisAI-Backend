/**
 * Google Sheets Integration Test Script
 * 
 * This script tests the Google Sheets agent functionality.
 * Make sure you have a valid user_id and connected Google Sheets account.
 * 
 * Usage:
 * 1. Update the USER_ID constant with your user ID
 * 2. Ensure the user has connected Google Sheets
 * 3. Run: node sheets/testSheets.js
 */

const SheetsAgent = require('./sheetsAgent');
const sheetsService = require('./sheetsService');

// CONFIGURE THIS: Replace with your actual user ID from the database
const USER_ID = 'your-user-id-here';

// Test colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60) + '\n');
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ ${message}`, 'blue');
}

async function testSheetsService() {
  logSection('Testing Sheets Service Functions');

  try {
    // Test 1: List Spreadsheets
    logInfo('Test 1: List Spreadsheets');
    const listResult = await sheetsService.listSpreadsheets(USER_ID, 5, 1);
    if (listResult.success) {
      logSuccess(`Found ${listResult.count} spreadsheets`);
      if (listResult.spreadsheets && listResult.spreadsheets.length > 0) {
        console.log('Sample spreadsheet:', listResult.spreadsheets[0].name);
      }
    } else {
      logError(`Failed: ${listResult.error}`);
    }

    // Test 2: Create Spreadsheet (optional - creates a new spreadsheet)
    // Uncomment to test
    /*
    logInfo('Test 2: Create Spreadsheet');
    const createResult = await sheetsService.createSpreadsheet(
      USER_ID,
      'Test Spreadsheet ' + Date.now(),
      ['Sheet1', 'Data', 'Summary']
    );
    if (createResult.success) {
      logSuccess('Spreadsheet created successfully');
      console.log('Spreadsheet ID:', createResult.spreadsheet.spreadsheetId);
      console.log('URL:', createResult.spreadsheet.spreadsheetUrl);
      
      // Save this ID for further tests
      const testSpreadsheetId = createResult.spreadsheet.spreadsheetId;
      
      // Test 3: Get Spreadsheet Details
      logInfo('Test 3: Get Spreadsheet Details');
      const getResult = await sheetsService.getSpreadsheet(USER_ID, testSpreadsheetId);
      if (getResult.success) {
        logSuccess('Retrieved spreadsheet details');
        console.log('Title:', getResult.spreadsheet.properties.title);
        console.log('Sheets:', getResult.spreadsheet.sheets.length);
      } else {
        logError(`Failed: ${getResult.error}`);
      }
      
      // Test 4: Update Values
      logInfo('Test 4: Update Values');
      const updateResult = await sheetsService.updateValues(
        USER_ID,
        testSpreadsheetId,
        'Sheet1!A1:C3',
        [
          ['Name', 'Age', 'City'],
          ['John Doe', '30', 'New York'],
          ['Jane Smith', '25', 'Los Angeles']
        ]
      );
      if (updateResult.success) {
        logSuccess('Values updated successfully');
        console.log('Updated cells:', updateResult.updatedCells);
      } else {
        logError(`Failed: ${updateResult.error}`);
      }
      
      // Test 5: Get Values
      logInfo('Test 5: Get Values');
      const getValuesResult = await sheetsService.getValues(
        USER_ID,
        testSpreadsheetId,
        'Sheet1!A1:C3'
      );
      if (getValuesResult.success) {
        logSuccess('Retrieved values successfully');
        console.log('Values:', JSON.stringify(getValuesResult.values, null, 2));
      } else {
        logError(`Failed: ${getValuesResult.error}`);
      }
      
      // Test 6: Add Sheet
      logInfo('Test 6: Add New Sheet');
      const addSheetResult = await sheetsService.addSheet(
        USER_ID,
        testSpreadsheetId,
        'Test Sheet'
      );
      if (addSheetResult.success) {
        logSuccess('Sheet added successfully');
      } else {
        logError(`Failed: ${addSheetResult.error}`);
      }
      
      // Test 7: Rename Sheet
      logInfo('Test 7: Rename Sheet');
      const renameResult = await sheetsService.renameSheet(
        USER_ID,
        testSpreadsheetId,
        'Test Sheet',
        'Renamed Sheet'
      );
      if (renameResult.success) {
        logSuccess('Sheet renamed successfully');
      } else {
        logError(`Failed: ${renameResult.error}`);
      }
      
      // Test 8: Read Headings
      logInfo('Test 8: Read Headings');
      const headingsResult = await sheetsService.readHeadings(
        USER_ID,
        testSpreadsheetId,
        'Sheet1'
      );
      if (headingsResult.success) {
        logSuccess('Read headings successfully');
        console.log('Headings:', headingsResult.headings);
      } else {
        logError(`Failed: ${headingsResult.error}`);
      }
    } else {
      logError(`Failed to create spreadsheet: ${createResult.error}`);
    }
    */

    logSuccess('Service function tests completed');

  } catch (error) {
    logError(`Service test error: ${error.message}`);
    console.error(error);
  }
}

async function testSheetsAgent() {
  logSection('Testing Sheets AI Agent');

  const agent = new SheetsAgent();

  try {
    // Test queries
    const queries = [
      "List my spreadsheets",
      "What spreadsheets do I have?",
      // Uncomment these to test more (they will create/modify data)
      // "Create a test spreadsheet called 'Agent Test'",
      // "Show me the details of my first spreadsheet"
    ];

    for (let i = 0; i < queries.length; i++) {
      logInfo(`Agent Test ${i + 1}: "${queries[i]}"`);
      
      const result = await agent.processQuery(queries[i], USER_ID);
      
      if (result.success) {
        logSuccess('Query processed successfully');
        console.log('Response:', result.response);
        console.log('Tools used:', result.tools_used.length);
        
        if (result.tools_used.length > 0) {
          result.tools_used.forEach(tool => {
            console.log(`  - ${tool.function}`);
          });
        }
      } else {
        logError(`Query failed: ${result.error}`);
      }
      
      console.log(''); // Empty line for readability
    }

    logSuccess('Agent tests completed');

  } catch (error) {
    logError(`Agent test error: ${error.message}`);
    console.error(error);
  }
}

async function runTests() {
  log('\n🧪 Google Sheets Integration Test Suite\n', 'yellow');
  
  if (USER_ID === 'your-user-id-here') {
    logError('Please update the USER_ID constant with your actual user ID!');
    logInfo('You can find your user ID in the users table in Supabase');
    process.exit(1);
  }

  logInfo(`Testing with User ID: ${USER_ID}`);
  
  try {
    // Run service tests
    await testSheetsService();
    
    // Run agent tests
    await testSheetsAgent();
    
    logSection('Test Summary');
    logSuccess('All tests completed! Check the output above for results.');
    log('\nNote: Some tests are commented out to avoid creating test data.', 'yellow');
    log('Uncomment them in the code if you want to test create/update operations.\n', 'yellow');
    
  } catch (error) {
    logError(`Fatal test error: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().then(() => {
    process.exit(0);
  }).catch(error => {
    logError(`Unexpected error: ${error.message}`);
    console.error(error);
    process.exit(1);
  });
}

module.exports = { testSheetsService, testSheetsAgent };
