# Intent Classification Refactor - Implementation Guide

## Overview

This guide explains the refactoring from regex-based intent classification to LLM-based classification, addressing the issue where queries like "create a google docs titled 'Project Plan'" were incorrectly classified as advisory instead of actionable.

## Problem

**Before Refactor:**
```
Query: "create a google docs titled 'Project Plan' and add an introduction section in it"
Result: ❌ ADVISORY (incorrectly matched advisory regex patterns)
Expected: ✅ ACTIONABLE (should route to docs agent)
```

The regex patterns couldn't distinguish between:
- "Help me create a document" (ACTIONABLE - user wants action)
- "Help me understand how to create a document" (ADVISORY - user wants guidance)

## Solution

### New Files Created

1. **`PolarisAI-Backend/mainAgent/intentClassifier.js`**
   - LLM-based intent classification
   - Replaces regex pattern matching
   - Supports 4 intent types: actionable, advisory, conversational, file_generation
   - Quick checks for obvious patterns (no LLM overhead)
   - Full LLM classification for nuanced cases

### Modified Files

1. **`PolarisAI-Backend/mainAgent/mainAgent.js`**
   - Imports `IntentClassifier`
   - Updated `analyzeQuery()` method to use LLM classification
   - Removed regex-based advisory pattern checks
   - Maintains backward compatibility

2. **`PolarisAI-Frontend/lib/intentRecognition.ts`**
   - Added documentation note about backend LLM classification
   - This file remains for email-specific intent detection
   - General query intent classification now handled by backend

## How It Works

### Intent Classification Flow

```
User Query
    ↓
Quick Checks (No LLM)
├─ Is it obviously conversational? (e.g., "What is my name?")
│  └─ YES → Return CONVERSATIONAL
├─ Is it obviously file generation? (e.g., "Generate a PDF")
│  └─ YES → Return FILE_GENERATION
└─ NO → Continue to LLM
    ↓
LLM Classification
├─ Analyze query with conversation history
├─ Determine intent type
├─ Return confidence score and reasoning
└─ Return classification result
    ↓
Route Based on Intent
├─ ACTIONABLE → Route to appropriate agents
├─ ADVISORY → Provide advisory response (no agents)
├─ CONVERSATIONAL → Answer from context (no agents)
└─ FILE_GENERATION → Generate content and convert to file
```

### Example Classifications

**ACTIONABLE (Routes to Agents):**
```javascript
{
  type: 'actionable',
  confidence: 0.98,
  reasoning: 'User is requesting to create a document with specific content',
  actionType: 'create',
  shouldUseAgents: true
}
```

**ADVISORY (No Agents):**
```javascript
{
  type: 'advisory',
  confidence: 0.95,
  reasoning: 'User is asking for guidance on how to create a document, not requesting to create one',
  actionType: null,
  shouldUseAgents: false
}
```

## Integration Points

### In `mainAgent.js` - `analyzeQuery()` Method

**Before:**
```javascript
// Pre-check: Detect planning/advisory queries vs actual action queries
const advisoryPatterns = [
  /\b(planning|thinking|wondering|considering|i want to know|how\s+should|help me|suggest|advise|give me|provide|explain)\b.*\b(how|what|way|approach|strategy|plan|steps|process)\b/i,
  /\b(planning to create|planning to make|thinking about creating|considering creating|what.*to create)\b/i,
  // ... more patterns
];

const isAdvisory = advisoryPatterns.some(pattern => pattern.test(query));

if (isAdvisory && !/(create|make|send|book|schedule|build)\s+(a|the|my)?\s*(form|document|email|calendar|event|meet|form|sheet|pdf|txt)/i.test(query)) {
  return {
    agents: [],
    reasoning: "User is asking for advice, guidance, or planning help - no agents needed"
  };
}
```

**After:**
```javascript
// Use LLM-based intent classifier instead of regex
const intentClassifier = new IntentClassifier();
const intentClassification = await intentClassifier.classify(query, conversationHistory);

if (intentClassification.type === 'advisory') {
  return {
    agents: [],
    reasoning: "User is asking for advice, guidance, or planning help - no agents needed"
  };
}
```

## Testing

### Test Cases

Run these queries to verify correct classification:

**ACTIONABLE (should route to agents):**
```
✅ "create a google docs titled Project Plan"
✅ "send an email to john@example.com"
✅ "schedule a meeting for tomorrow"
✅ "help me create a document" (edge case - should be actionable)
✅ "guide me through sending an email" (edge case - should be actionable)
✅ "search for flights to NYC"
```

**ADVISORY (should NOT route to agents):**
```
✅ "How do I create a google docs?"
✅ "What's the best way to send emails?"
✅ "Should I schedule the meeting now or later?"
✅ "What are best practices for project planning?"
```

**CONVERSATIONAL (should NOT route to agents):**
```
✅ "What is my name?"
✅ "What did I tell you about the project?"
✅ "Remind me what we discussed"
```

**FILE_GENERATION (should NOT route to agents):**
```
✅ "Generate a PDF of the project plan"
✅ "Export this as a PDF"
✅ "Create a text file with the summary"
```

### Manual Testing

1. Start the backend server
2. Send test queries via the `/agent/query/stream` endpoint
3. Check console logs for classification results:
   ```
   [IntentClassifier] 🤖 Classifying intent for query: "..."
   [IntentClassifier] ✅ Classification result: {...}
   ```

## Performance Considerations

### Latency

- **Quick checks**: ~1-5ms (no LLM)
- **LLM classification**: ~200-500ms (typical)
- **Total**: ~200-500ms for ambiguous queries

### Optimization Opportunities

1. **Caching**: Cache classifications for identical queries
2. **Batch Processing**: Classify multiple queries in parallel
3. **Model Selection**: Use faster model for simple cases
4. **Fallback**: Quick regex fallback if LLM fails

## Troubleshooting

### Issue: Classification is slow

**Solution:**
- Check if LLM API is responding normally
- Consider caching classifications
- Use faster model (gpt-4o-mini is already optimized)

### Issue: Classification is incorrect

**Solution:**
- Check conversation history is being passed
- Review LLM reasoning in logs
- Add more examples to system prompt
- Consider user feedback for retraining

### Issue: LLM API errors

**Solution:**
- Verify `OPENAI_API_KEY` is set
- Check API rate limits
- Implement exponential backoff retry
- Fallback to conservative classification

## Migration Checklist

- [x] Create `intentClassifier.js` with LLM-based classification
- [x] Update `mainAgent.js` to use `IntentClassifier`
- [x] Remove regex-based advisory pattern checks
- [ ] Test with edge cases and ambiguous queries
- [ ] Monitor classification accuracy in production
- [ ] Gather user feedback on misclassifications
- [ ] Optimize performance if needed
- [ ] Document any new intent types discovered

## Future Improvements

1. **Multi-language Support**: Extend to non-English queries
2. **Tool Availability**: Consider available tools when classifying
3. **User Preferences**: Learn user's typical intent patterns
4. **Feedback Loop**: Track misclassifications and improve
5. **Hybrid Approach**: Combine LLM with lightweight heuristics
6. **Intent Confidence**: Use confidence scores to trigger clarification

## References

- **IntentClassifier**: `PolarisAI-Backend/mainAgent/intentClassifier.js`
- **MainAgent**: `PolarisAI-Backend/mainAgent/mainAgent.js`
- **Refactor Document**: `PolarisAI-Backend/INTENT_CLASSIFICATION_REFACTOR.md`
