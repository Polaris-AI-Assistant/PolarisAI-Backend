# Web Search Intent Classification Fix

## Problem Statement

When users ask queries like "do you know about the AI summit happening in Delhi?", the system was classifying them as **ADVISORY** queries and attempting to answer from the LLM's knowledge base instead of routing to the **websearch agent** to fetch current, real-time information.

### Example Issue:
- **Query**: "do u know about latest ai summit happening in delhi, India?"
- **Old Behavior**: Classified as ADVISORY → No agents called → LLM tries to answer from training data
- **Expected Behavior**: Classified as WEB_SEARCH → websearch agent called → Fetches current information from the internet

## Root Cause

The intent classifier had only 4 categories:
1. ACTIONABLE - User wants to perform an action
2. ADVISORY - User wants advice or information
3. CONVERSATIONAL - User asks about past interactions
4. FILE_GENERATION - User wants to generate a file

Queries requiring **current/real-time information** were being lumped into ADVISORY, which skipped agent routing entirely.

## Solution

### 1. Added New Intent Type: `WEB_SEARCH`

Modified `intentClassifier.js` to include a 5th intent type specifically for queries requiring current information:

```javascript
{
  type: 'web_search',
  confidence: 0.95,
  reasoning: 'User is asking for current/real-time information',
  actionType: 'web_search',
  shouldUseAgents: true,
  requiresWebSearch: true
}
```

### 2. Quick Pattern Detection

Added `quickCheckWebSearch()` method to detect obvious web search patterns without LLM:

**Patterns that trigger web search:**
- "latest", "current", "recent", "today", "now", "happening", "upcoming"
- "do you know about [current event]"
- "what's the latest [news/update]"
- "is there [event] happening"
- "when is [event] taking place"

### 3. Enhanced LLM Classification Prompt

Updated the classification prompt to explicitly recognize WEB_SEARCH as a distinct category:

```
2. **WEB_SEARCH**: User wants CURRENT/REAL-TIME information from the internet
   - Examples: "Do you know about the AI summit happening in Delhi?"
   - Examples: "What's the latest news about Tesla?"
   - Key indicators: "latest", "current", "recent", "happening", "today", "now"
   - IMPORTANT: Questions about CURRENT EVENTS need web search
```

### 4. Updated Main Agent Routing

Modified `mainAgent.js` to handle the new intent type:

```javascript
// Handle web search queries - requires current/real-time information
if (intentClassification.type === 'web_search' || intentClassification.requiresWebSearch) {
  console.log('[MainAgent] 🌐 Detected web search query - routing to websearch agent:', query);
  return {
    agents: ['websearch'],
    reasoning: "User is asking for current/real-time information that requires web search",
    queries: {
      websearch: query
    }
  };
}
```

### 5. Added Web Search to Available Agents

Updated the agent routing prompt to include websearch:

```
- websearch: Web search operations (search for current information, news, events, 
  real-time data from the internet). Use when user asks about CURRENT/LATEST/RECENT 
  information, events, news, or anything requiring up-to-date data from the web.
```

## Implementation Details

### Files Modified

1. **`mainAgent/intentClassifier.js`**
   - Added `WEB_SEARCH` intent type
   - Added `quickCheckWebSearch()` method
   - Updated classification prompt
   - Added `requiresWebSearch` flag to response

2. **`mainAgent/mainAgent.js`**
   - Added web search intent handling in `analyzeQuery()`
   - Updated available agents list
   - Added web search examples to routing prompt

### Key Changes

#### intentClassifier.js
```javascript
// New quick check method
quickCheckWebSearch(query) {
  const webSearchPatterns = [
    /\b(latest|current|recent|today|now|happening|upcoming)\b.*\b(news|event|summit|conference)/i,
    /\bdo you know (about|if|when|where)\b/i,
    // ... more patterns
  ];
  
  for (const pattern of webSearchPatterns) {
    if (pattern.test(query)) {
      return {
        type: 'web_search',
        confidence: 0.95,
        reasoning: 'Obvious web search query pattern',
        requiresWebSearch: true
      };
    }
  }
  return null;
}
```

#### mainAgent.js
```javascript
// New routing logic
if (intentClassification.type === 'web_search' || intentClassification.requiresWebSearch) {
  return {
    agents: ['websearch'],
    reasoning: "User is asking for current/real-time information",
    queries: { websearch: query }
  };
}
```

## Testing

### Test Script

Run the test script to verify intent classification:

```bash
cd PolarisAI-Backend/mainAgent
node test-websearch-intent.js
```

### Expected Results

| Query | Expected Type | Should Use Agents |
|-------|--------------|-------------------|
| "do u know about latest ai summit happening in delhi?" | web_search | ✅ Yes (websearch) |
| "what's the latest news about Tesla?" | web_search | ✅ Yes (websearch) |
| "how do I create a google form?" | advisory | ❌ No |
| "create a google form" | actionable | ✅ Yes (forms) |
| "what is my name?" | conversational | ❌ No |

## Benefits

1. **Accurate Current Information**: Users get real-time data from the web instead of outdated LLM knowledge
2. **Better User Experience**: Queries about events, news, and current information are properly handled
3. **Clear Intent Separation**: Web search is now a distinct intent, not confused with advisory
4. **Fast Pattern Matching**: Quick checks avoid unnecessary LLM calls for obvious patterns
5. **Fallback Support**: LLM classification still works for nuanced queries

## Examples

### Before Fix ❌
```
User: "do you know about the AI summit happening in Delhi?"
System: [ADVISORY] → No agents → "I don't have specific information..."
```

### After Fix ✅
```
User: "do you know about the AI summit happening in Delhi?"
System: [WEB_SEARCH] → websearch agent → Fetches current information from web
Result: "Yes! The AI Summit Delhi 2024 is happening on..."
```

## Edge Cases Handled

1. **"Do you know about X"** - Now routes to web search for current events
2. **"Latest/Recent/Current"** - Triggers web search
3. **"Happening/Upcoming"** - Indicates real-time information needed
4. **Advisory vs Web Search** - "How to create X" (advisory) vs "What's the latest X" (web search)

## Future Improvements

1. Add more sophisticated pattern matching for edge cases
2. Consider combining web search with other agents (e.g., "search for AI summit and add to calendar")
3. Add confidence thresholds for when to use web search vs LLM knowledge
4. Track web search usage metrics to improve classification

## Rollback Plan

If issues arise, revert these commits:
1. `intentClassifier.js` - Remove WEB_SEARCH type and quickCheckWebSearch()
2. `mainAgent.js` - Remove web search intent handling

The system will fall back to treating these as ADVISORY queries (original behavior).
