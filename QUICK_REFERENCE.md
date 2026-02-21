# Intent Classification - Quick Reference

## What Changed?

**Before:** Regex patterns tried to detect if a query was advisory or actionable
**After:** LLM (Claude) understands the query and classifies it correctly

## Why?

Regex couldn't handle edge cases like:
- "Help me create a document" → Should be ACTIONABLE (user wants action)
- "Help me understand how to create a document" → Should be ADVISORY (user wants guidance)

## How to Use

### For Backend Developers

**In `mainAgent.js`:**

```javascript
// Import the classifier
const IntentClassifier = require('./intentClassifier');

// Use it in analyzeQuery()
const intentClassifier = new IntentClassifier();
const classification = await intentClassifier.classify(query, conversationHistory);

// Check the classification
if (classification.type === 'actionable') {
  // Route to agents
} else if (classification.type === 'advisory') {
  // Provide advisory response
} else if (classification.type === 'conversational') {
  // Answer from context
} else if (classification.type === 'file_generation') {
  // Generate file
}
```

### Classification Types

| Type | Example | Routes to Agents? |
|------|---------|-------------------|
| `actionable` | "Create a google docs" | ✅ YES |
| `advisory` | "How do I create a google docs?" | ❌ NO |
| `conversational` | "What is my name?" | ❌ NO |
| `file_generation` | "Generate a PDF" | ❌ NO |

## Key Features

✅ **Quick Checks** - Obvious patterns don't need LLM
✅ **LLM Classification** - Nuanced cases use Claude
✅ **Conversation Context** - Considers chat history
✅ **Confidence Scores** - Know how confident the classification is
✅ **Reasoning** - Understand why it was classified that way

## Performance

- Quick checks: ~1-5ms
- LLM classification: ~200-500ms
- Total: ~200-500ms for ambiguous queries

## Debugging

Check console logs for classification details:

```
[IntentClassifier] 🤖 Classifying intent for query: "..."
[IntentClassifier] ✅ Classification result: {
  type: 'actionable',
  confidence: 0.98,
  reasoning: '...',
  actionType: 'create',
  shouldUseAgents: true
}
```

## Common Issues

**Q: Classification is slow**
A: LLM takes 200-500ms. This is normal. Consider caching for repeated queries.

**Q: Classification is wrong**
A: Check if conversation history is being passed. LLM uses context for better accuracy.

**Q: LLM API error**
A: Check `OPENAI_API_KEY` is set. Verify API rate limits.

## Files

- **`intentClassifier.js`** - The classifier implementation
- **`mainAgent.js`** - Uses the classifier in `analyzeQuery()`
- **`INTENT_CLASSIFICATION_REFACTOR.md`** - Detailed refactor document
- **`IMPLEMENTATION_GUIDE.md`** - Full implementation guide

## Next Steps

1. Test with edge cases
2. Monitor accuracy in production
3. Gather user feedback
4. Optimize performance if needed
5. Add new intent types as needed
