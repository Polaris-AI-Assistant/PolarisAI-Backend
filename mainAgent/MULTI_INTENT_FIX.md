# Multi-Intent Query Fix

## Problem Statement

Queries with multiple intents were only executing the first intent and ignoring the rest.

### Example Issue

**Query:** "Search for the latest AI news and email the top 3 articles to bhumika15696@gmail.com"

**Expected Behavior:**
1. Use websearch agent to find latest AI news
2. Use gmail agent to email the top 3 articles

**Actual Behavior (Before Fix):**
1. ✅ Used websearch agent to find latest AI news
2. ❌ Stopped there - email action was completely ignored

### Root Cause

The intent classifier's `quickCheckWebSearch()` function detected "latest AI news" and immediately returned `web_search` intent, preventing the system from analyzing the full query for additional intents like "email the top 3 articles".

The `analyzeQuery()` method then saw `web_search` intent and returned immediately with only the websearch agent, never analyzing the email part.

## Solution

### 1. Multi-Intent Detection in Intent Classifier

Added `hasMultipleIntents()` method to detect queries with multiple actions:

```javascript
hasMultipleIntents(query) {
  const multiIntentPatterns = [
    /\b(and|then)\s+(send|email|share|create|schedule|add|make)/i,
    /\b(search|find|get|look up)\b.*\b(and|then)\b.*\b(send|email|share)/i,
    /\b(create|make|generate)\b.*\b(and|then)\b.*\b(send|email|share)/i,
  ];

  return multiIntentPatterns.some(pattern => pattern.test(query));
}
```

**Key Patterns:**
- "X and [action]" - e.g., "search for X and email it"
- "X then [action]" - e.g., "find X then share it"
- "[search/find] X and [send/email/share]"

### 2. Skip Quick Checks for Multi-Intent Queries

Modified `classify()` to use LLM for multi-intent queries instead of quick checks:

```javascript
async classify(query, conversationHistory = []) {
  // Check if query has multiple intents - if so, skip quick checks and use LLM
  if (this.hasMultipleIntents(query)) {
    console.log(`[IntentClassifier] 🔗 Multi-intent query detected - using LLM for full analysis`);
    return await this.classifyIntent(query, conversationHistory);
  }

  // Quick checks for single-intent queries...
}
```

**Why:** Quick checks return immediately, preventing full query analysis. For multi-intent queries, we need the LLM to analyze the entire query and identify all required agents.

### 3. Conditional Early Return in analyzeQuery

Modified `analyzeQuery()` to check for additional actions before returning early:

```javascript
if (intentClassification.type === 'web_search' || intentClassification.requiresWebSearch) {
  // Check if query also contains other actions
  const hasAdditionalActions = /\b(and|then)\s+(send|email|share|create|schedule|add|make|put)/i.test(query);
  
  if (hasAdditionalActions) {
    console.log('[MainAgent] 🔗 Web search query with additional actions - using full LLM analysis');
    // Don't return early - let LLM analyze the full multi-step query below
  } else {
    console.log('[MainAgent] 🌐 Detected standalone web search query - routing to websearch agent');
    return {
      agents: ['websearch'],
      // ...
    };
  }
}
```

**Logic:**
- If web_search intent detected AND query has additional actions → Continue to full LLM analysis
- If web_search intent detected AND no additional actions → Return early with websearch agent only

### 4. Enhanced LLM Prompt with Multi-Intent Examples

Added explicit examples and rules for multi-intent queries:

```
CRITICAL RULES for Multi-Intent Queries (web search + another action):
1. "Search for X and email it" → Use BOTH websearch AND gmail agents, requiresSequential: true
2. "Find X and add to calendar" → Use BOTH websearch AND calendar agents, requiresSequential: true
3. Pattern: "[search/find/look up] X [and/then] [send/email/create/add/share]" → ALWAYS multi-agent sequential
4. NEVER route multi-intent queries to ONLY websearch - you MUST include both agents

Examples:
- "search for the latest AI news and email the top 3 articles to john@example.com" 
  → {"agents": ["websearch", "gmail"], "requiresSequential": true, ...}
- "find recent tech conferences and add them to my calendar" 
  → {"agents": ["websearch", "calendar"], "requiresSequential": true, ...}
```

## How It Works Now

### Execution Flow for Multi-Intent Queries

```
Query: "Search for the latest AI news and email the top 3 articles to john@example.com"
    ↓
1. Intent Classifier
   - hasMultipleIntents() detects "and email"
   - Skips quick checks
   - Uses LLM for full analysis
   - Returns: type='actionable' (not web_search, because it's multi-intent)
    ↓
2. analyzeQuery()
   - Intent is 'actionable', not 'web_search'
   - Continues to full LLM analysis
   - LLM analyzes entire query
   - Identifies: websearch + gmail agents needed
   - Returns: {
       agents: ['websearch', 'gmail'],
       requiresSequential: true,
       queries: {
         websearch: "latest AI news",
         gmail: "email top 3 AI news articles to john@example.com"
       }
     }
    ↓
3. Sequential Execution
   - Execute websearch agent → Get AI news articles
   - Execute gmail agent → Email the articles
    ↓
4. Success! ✅
```

### Execution Flow for Single-Intent Web Search

```
Query: "What's the latest news about Tesla?"
    ↓
1. Intent Classifier
   - hasMultipleIntents() returns false (no "and email" etc.)
   - quickCheckWebSearch() detects "latest news"
   - Returns: type='web_search'
    ↓
2. analyzeQuery()
   - Intent is 'web_search'
   - hasAdditionalActions check returns false
   - Returns early: {
       agents: ['websearch'],
       queries: { websearch: "latest news about Tesla" }
     }
    ↓
3. Execute websearch agent
    ↓
4. Success! ✅
```

## Implementation Details

### Files Modified

1. **`mainAgent/intentClassifier.js`**
   - Added `hasMultipleIntents()` method
   - Modified `classify()` to skip quick checks for multi-intent queries

2. **`mainAgent/mainAgent.js`**
   - Added conditional early return in web_search handling
   - Added multi-intent examples to LLM prompt
   - Added multi-intent rules to LLM prompt

### Code Changes

#### intentClassifier.js

```javascript
// NEW: Multi-intent detection
hasMultipleIntents(query) {
  const multiIntentPatterns = [
    /\b(and|then)\s+(send|email|share|create|schedule|add|make)/i,
    /\b(search|find|get|look up)\b.*\b(and|then)\b.*\b(send|email|share)/i,
    /\b(create|make|generate)\b.*\b(and|then)\b.*\b(send|email|share)/i,
  ];
  return multiIntentPatterns.some(pattern => pattern.test(query));
}

// MODIFIED: Skip quick checks for multi-intent
async classify(query, conversationHistory = []) {
  if (this.hasMultipleIntents(query)) {
    return await this.classifyIntent(query, conversationHistory);
  }
  // ... quick checks for single-intent queries
}
```

#### mainAgent.js

```javascript
// MODIFIED: Conditional early return
if (intentClassification.type === 'web_search' || intentClassification.requiresWebSearch) {
  const hasAdditionalActions = /\b(and|then)\s+(send|email|share|create|schedule|add|make|put)/i.test(query);
  
  if (hasAdditionalActions) {
    // Continue to full LLM analysis
  } else {
    // Return early with websearch only
    return { agents: ['websearch'], ... };
  }
}
```

## Testing

### Test Cases

1. **Multi-Intent: Web Search + Email**
   ```
   Query: "Search for the latest AI news and email the top 3 articles to john@example.com"
   Expected: websearch agent + gmail agent (sequential)
   ```

2. **Multi-Intent: Web Search + Calendar**
   ```
   Query: "Find upcoming tech conferences and add them to my calendar"
   Expected: websearch agent + calendar agent (sequential)
   ```

3. **Multi-Intent: Web Search + Docs**
   ```
   Query: "Look up Python tutorials and create a document with the best ones"
   Expected: websearch agent + docs agent (sequential)
   ```

4. **Single-Intent: Web Search Only**
   ```
   Query: "What's the latest news about Tesla?"
   Expected: websearch agent only
   ```

5. **Single-Intent: Email Only**
   ```
   Query: "Send an email to john@example.com"
   Expected: gmail agent only
   ```

### Manual Testing

```bash
# Test multi-intent query
curl -X POST http://localhost:3000/api/agent/query/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"query": "Search for the latest AI news and email the top 3 articles to john@example.com"}'

# Expected: Both websearch and gmail agents execute
```

### Log Verification

Look for these log messages:

**Multi-Intent Query:**
```
[IntentClassifier] 🔗 Multi-intent query detected - using LLM for full analysis
[MainAgent] 🔗 Web search query with additional actions - using full LLM analysis
[MainAgent] Agents: websearch, gmail
[MainAgent] requiresSequential: true
```

**Single-Intent Query:**
```
[IntentClassifier] ⚡ Quick check: Web Search
[MainAgent] 🌐 Detected standalone web search query
[MainAgent] Agents: websearch
```

## Edge Cases

### 1. Three or More Intents

**Query:** "Search for AI news, create a document, and email it to john@example.com"

**Expected:**
```javascript
{
  agents: ['websearch', 'docs', 'gmail'],
  requiresSequential: true,
  queries: {
    websearch: "AI news",
    docs: "create document with AI news",
    gmail: "email document to john@example.com"
  }
}
```

### 2. Ambiguous "and"

**Query:** "Search for AI and machine learning news"

**Analysis:** "and" connects topics, not actions
**Expected:** websearch agent only (single intent)

**How it works:** `hasMultipleIntents()` checks for "and [action verb]", not just "and"

### 3. Implicit Multi-Intent

**Query:** "Find the latest AI summit details for john@example.com"

**Analysis:** Implies "find X and send to Y"
**Expected:** LLM should detect this as multi-intent

**Current behavior:** May not be detected by pattern matching, but LLM should handle it

## Benefits

1. ✅ **Complete Query Execution**: All parts of multi-intent queries are now executed
2. ✅ **Maintains Performance**: Single-intent queries still use fast quick checks
3. ✅ **Better User Experience**: Users can express complex requests naturally
4. ✅ **Sequential Execution**: Actions execute in the right order (search first, then email)

## Comparison

### Before Fix

| Query Type | Detection | Execution | Result |
|------------|-----------|-----------|--------|
| "Search for X" | ✅ web_search | ✅ websearch | ✅ Works |
| "Search for X and email it" | ❌ web_search only | ❌ websearch only | ❌ Incomplete |

### After Fix

| Query Type | Detection | Execution | Result |
|------------|-----------|-----------|--------|
| "Search for X" | ✅ web_search | ✅ websearch | ✅ Works |
| "Search for X and email it" | ✅ multi-intent | ✅ websearch + gmail | ✅ Complete |

## Future Enhancements

### 1. More Complex Patterns

Support queries like:
- "Search for X, Y, and Z, then email the results"
- "Find X or Y and create a document"
- "Search for X unless Y, then email it"

### 2. Implicit Multi-Intent Detection

Improve detection of implicit multi-intent queries:
- "Find AI news for john@example.com" (implies: find + email)
- "Get conference details to add to calendar" (implies: get + add)

### 3. Parallel Multi-Intent

Support queries where actions can run in parallel:
- "Search for AI news and check my calendar" (independent actions)

### 4. Conditional Multi-Intent

Support queries with conditions:
- "Search for AI news and if there are more than 5 articles, email them"

## Troubleshooting

### Issue: Multi-Intent Still Not Detected

**Possible Causes:**
1. Pattern doesn't match `hasMultipleIntents()` regex
2. LLM not recognizing multi-intent in classification

**Solutions:**
1. Add more patterns to `hasMultipleIntents()`
2. Enhance LLM classification prompt
3. Check logs to see which path is taken

### Issue: Wrong Agent Order

**Possible Causes:**
1. LLM not setting `requiresSequential: true`
2. Dependencies not specified correctly

**Solutions:**
1. Verify LLM prompt emphasizes sequential execution
2. Check `dependencies` field in analysis result
3. Ensure examples show correct order

### Issue: Second Action Uses Wrong Data

**Possible Causes:**
1. First agent's results not passed to second agent
2. Query for second agent doesn't reference first agent's results

**Solutions:**
1. Verify sequential execution is working
2. Check that second agent's query mentions using results from first agent
3. Review `_enrichQueryWithPreviousResults()` in mainAgent.js

## Rollback Plan

If issues arise:

1. **Quick Fix**: Disable multi-intent detection
```javascript
// In intentClassifier.js
hasMultipleIntents(query) {
  return false; // Disable multi-intent detection
}
```

2. **Partial Rollback**: Keep detection but always use LLM
```javascript
// In intentClassifier.js
async classify(query, conversationHistory = []) {
  // Always use LLM, skip quick checks
  return await this.classifyIntent(query, conversationHistory);
}
```

3. **Full Rollback**:
```bash
git revert <commit-hash>
```

## Success Criteria

✅ **Multi-Intent Detection**
- Queries with "and [action]" detected as multi-intent
- LLM used for full analysis instead of quick checks

✅ **Complete Execution**
- All agents in multi-intent queries execute
- Sequential execution when needed
- Results passed between agents

✅ **Performance**
- Single-intent queries still fast (quick checks)
- Multi-intent queries complete successfully
- No timeout or errors

✅ **User Experience**
- Users can express complex requests naturally
- All parts of request are fulfilled
- Results are coherent and complete

## Conclusion

This fix enables the platform to handle complex, multi-intent queries like "Search for X and email it" by:
1. Detecting multi-intent patterns
2. Using LLM for full query analysis
3. Routing to multiple agents sequentially
4. Passing results between agents

Users can now express complex workflows in a single natural language query, making the platform more powerful and user-friendly.
