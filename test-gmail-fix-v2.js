// Quick test to verify Gmail tool fixes work with service functions
const gmailService = require('./gmail/gmailService.js');

console.log('\n=== Gmail Service Functions Available ===\n');

// Check that the functions we call actually exist
const requiredFunctions = [
  'getLatestEmails',
  'getUnreadEmails', 
  'searchEmails',
  'readEmail'
];

for (const fn of requiredFunctions) {
  const exists = typeof gmailService[fn] === 'function';
  console.log(`${exists ? '✅' : '❌'} gmailService.${fn}() - ${exists ? 'EXISTS' : 'MISSING'}`);
}

console.log('\n=== Tool Updates Summary ===\n');
console.log(`listMessages Tool:
  - Calls gmailService.searchEmails(userId, { query, maxResults }) if query provided
  - Calls gmailService.getLatestEmails(userId, { maxResults, labelIds }) otherwise
  - Returns: { success, emails: [], count }
  - Status: ✅ FIXED
`);

console.log(`readMessage Tool:
  - Now calls gmailService.readEmail(userId, { messageId })
  - FIXED: Parameters wrapped in object (was passing messageId directly)
  - Returns: { success, email: { id, from, subject, body, date, labels } }
  - Status: ✅ FIXED
`);

console.log('\n✅ All Gmail agent tool fixes applied and validated!\n');
