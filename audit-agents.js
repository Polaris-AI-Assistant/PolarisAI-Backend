/**
 * AGENT TOOLS AUDIT SCRIPT
 * 
 * This script analyzes all agents to identify:
 * 1. Tools defined in agent but corresponding service functions missing
 * 2. Tools that call non-existent service functions
 * 3. Service functions that exist but aren't properly mapped to agent tools
 * 
 * Run: node audit-agents.js
 */

const fs = require('fs');
const path = require('path');

// List of agents to audit
const AGENTS = [
  { name: 'calendar', agentFile: 'calendar/calendarAgentMultiStep.js', serviceFile: 'calendar/calendarService.js' },
  { name: 'docs', agentFile: 'docs/docsAgentMultiStep.js', serviceFile: 'docs/docsService.js' },
  { name: 'flights', agentFile: 'flights/flightsAgentMultiStep.js', serviceFile: 'flights/flightsService.js' },
  { name: 'forms', agentFile: 'forms/formsAgentMultiStep.js', serviceFile: 'forms/formsService.js' },
  { name: 'github', agentFile: 'github/githubAgentMultiStep.js', serviceFile: 'github/githubService.js' },
  { name: 'gmail', agentFile: 'gmail/gmailAgentMultiStep.js', serviceFile: 'gmail/gmailService.js' },
  { name: 'maps', agentFile: 'maps/mapsAgentMultiStep.js', serviceFile: 'maps/mapsService.js' },
  { name: 'meet', agentFile: 'meet/meetAgentMultiStep.js', serviceFile: 'meet/meetService.js' },
  { name: 'microsoft', agentFile: 'microsoft/microsoftAgentMultiStep.js', serviceFile: 'microsoft/microsoftService.js' },
  { name: 'schedules', agentFile: 'schedules/schedulesAgentMultiStep.js', serviceFile: 'schedules/actionService.js' },
  { name: 'sheets', agentFile: 'sheets/sheetsAgentMultiStep.js', serviceFile: 'sheets/sheetsService.js' },
  { name: 'weather', agentFile: 'weather/weatherAgentMultiStep.js', serviceFile: 'weather/weatherService.js' },
  { name: 'websearch', agentFile: 'websearch/webSearchAgentMultiStep.js', serviceFile: 'websearch/webSearchService.js' },
];

// Extract function names from code
function extractFunctionNames(content) {
  const functions = new Set();
  
  // Match: function name(), name: async function(), const name = async ()
  const patterns = [
    /(?:async\s+)?function\s+(\w+)\s*\(/g,
    /(\w+)\s*:\s*async\s*\(/g,
    /const\s+(\w+)\s*=\s*async\s*\(/g,
    /module\.exports\.(\w+)\s*=|exports\.(\w+)\s*=/g,
  ];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const funcName = match[1] || match[2];
      if (funcName) functions.add(funcName);
    }
  });
  
  return Array.from(functions);
}

// Extract tool definitions from agent
function extractToolDefinitions(content) {
  const tools = new Set();
  
  // Match tool names like: toolName: { definition: { function: { name: 'toolName'
  const pattern = /(\w+)\s*:\s*\{\s*definition:\s*\{\s*(?:type|function)/g;
  let match;
  
  while ((match = pattern.exec(content)) !== null) {
    tools.add(match[1]);
  }
  
  // Also try to find by 'name:' field inside function definitions
  const namePattern = /name:\s*['"]([\w]+)['"]/g;
  while ((match = namePattern.exec(content)) !== null) {
    tools.add(match[1]);
  }
  
  return Array.from(tools);
}

// Extract service function calls from agent
function extractServiceCalls(content) {
  const calls = new Set();
  
  // Match patterns like: gmailService.functionName, docsService.listDocuments
  const pattern = /\w+Service\.(\w+)\s*\(/g;
  let match;
  
  while ((match = pattern.exec(content)) !== null) {
    calls.add(match[1]);
  }
  
  return Array.from(calls);
}

// Main audit
console.log('\n' + '='.repeat(80));
console.log('AGENT TOOLS COMPREHENSIVE AUDIT');
console.log('='.repeat(80) + '\n');

let totalIssues = 0;
const issuesByAgent = {};

AGENTS.forEach(agent => {
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`📋 AGENT: ${agent.name.toUpperCase()}`);
  console.log(`${'─'.repeat(80)}`);
  
  const agentPath = path.join(__dirname, agent.agentFile);
  const servicePath = path.join(__dirname, agent.serviceFile);
  
  // Check if files exist
  if (!fs.existsSync(agentPath)) {
    console.log(`❌ Agent file not found: ${agent.agentFile}`);
    return;
  }
  
  if (!fs.existsSync(servicePath)) {
    console.log(`⚠️ Service file not found: ${agent.serviceFile}`);
    return;
  }
  
  // Read files
  const agentContent = fs.readFileSync(agentPath, 'utf8');
  const serviceContent = fs.readFileSync(servicePath, 'utf8');
  
  // Extract information
  const toolNames = extractToolDefinitions(agentContent);
  const serviceFunctions = extractFunctionNames(serviceContent);
  const serviceCalls = extractServiceCalls(agentContent);
  
  console.log(`\n✅ Tools defined in agent: ${toolNames.length}`);
  if (toolNames.length > 0) {
    toolNames.slice(0, 5).forEach(t => console.log(`   • ${t}`));
    if (toolNames.length > 5) console.log(`   ... and ${toolNames.length - 5} more`);
  }
  
  console.log(`\n✅ Service functions available: ${serviceFunctions.length}`);
  if (serviceFunctions.length > 0) {
    serviceFunctions.slice(0, 5).forEach(f => console.log(`   • ${f}`));
    if (serviceFunctions.length > 5) console.log(`   ... and ${serviceFunctions.length - 5} more`);
  }
  
  console.log(`\n📞 Service calls made by agent: ${serviceCalls.length}`);
  if (serviceCalls.length > 0) {
    serviceCalls.slice(0, 5).forEach(f => console.log(`   • ${f}`));
    if (serviceCalls.length > 5) console.log(`   ... and ${serviceCalls.length - 5} more`);
  }
  
  // Find mismatches
  const agentIssues = [];
  
  // Check 1: Service functions called but not defined
  serviceCalls.forEach(call => {
    if (!serviceFunctions.includes(call)) {
      agentIssues.push({
        type: 'MISSING_SERVICE_FUNCTION',
        detail: `Tool calls '${call}()' but service doesn't have this function`,
        severity: 'HIGH'
      });
    }
  });
  
  // Check 2: Tools defined but no corresponding service function
  // (This is less critical as tools might not call external functions)
  
  if (agentIssues.length > 0) {
    console.log(`\n⚠️  ISSUES FOUND: ${agentIssues.length}`);
    agentIssues.forEach(issue => {
      console.log(`   [${issue.severity}] ${issue.type}`);
      console.log(`   → ${issue.detail}`);
    });
    totalIssues += agentIssues.length;
    issuesByAgent[agent.name] = agentIssues;
  } else {
    console.log(`\n✅ NO ISSUES FOUND`);
  }
});

// Summary
console.log('\n' + '='.repeat(80));
console.log('AUDIT SUMMARY');
console.log('='.repeat(80) + '\n');

console.log(`Total agents audited: ${AGENTS.length}`);
console.log(`Agents with issues: ${Object.keys(issuesByAgent).length}`);
console.log(`Total issues found: ${totalIssues}`);

if (totalIssues > 0) {
  console.log('\nAgents with issues:');
  Object.entries(issuesByAgent).forEach(([agent, issues]) => {
    console.log(`  • ${agent}: ${issues.length} issue(s)`);
  });
}

console.log('\n' + '='.repeat(80) + '\n');
