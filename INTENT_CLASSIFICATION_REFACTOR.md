# Intent Classification Refactor: Regex → LLM

## Problem Statement

The system was using regex patterns to classify user intent, which caused false positives:

**Example Issue:**
- Query: "create a google docs titled 'Project Plan' and add an introduction section in it"
- Expected: ACTIONABLE (user wants to create a document)
- Actual: ADVISORY (regex matched "help me" pattern incorrectly)

Regex cannot understand:
- Context and nuance
- Ambiguous phrasing like "Help me create X" (actionable, not advisory)
- "Guide me through sending an email" (actionable, not advisory)
- Edge cases and exceptions

## Solution: LLM-Based Intent Classification

### Architecture

**New Module:** `PolarisAI-Backend/mainAgent/intentClassifier.js`

The `IntentClassifier` class uses Claude to classify queries into:

1. **ACTIONABLE** - User wants to perform an action
   - "Create a google docs titled Project Plan"
   - "Send an email to john@example.com"
   - "Help me create a document" (user wants action, not tutorial)
   - "Guide me through sending an email" (user wants to perform action)

2. **ADVISORY** - User wants advice/guidance/information
   - "How do I create a google docs?"
   - "What's the best way to send emails?"
   - "Should I schedule the meeting now or later?"

3. **CONVERSATIONAL** - User asking about past interactions
   - "What is my name?"
   - "What did I tell you about the project?"
   - "Remind me what we discussed"

4. **FILE_GENERATION** - User wants to generate a file (PDF/TXT)
   - "Generate a PDF of the project plan"
   - "Export this as a PDF"

### Implementation Details

**Quick Checks (No LLM):**
- Obvious conversational patterns (e.g., "What is my name?")
- Obvious file generation patterns (e.g., "Generate a PDF")

**LLM Classification:**
- Used for nuanced cases where context matters
- Considers conversation history for better understanding
- Returns confidence score and reasoning

### Integration Points

**mainAgent.js - analyzeQuery() method:**
```javascript
// OLD: Regex-based checks
const advisoryPatterns = [/pattern1/, /pattern2/, ...];
const isAdvisory = advisoryPatterns.some(pattern => pattern.test(query));

// NEW: LLM-based classification
const intentClassifier = new IntentClassifier();
const intentClassification = await intentClassifier.classify(query, conversationHistory);

if (intentClassification.type === 'advisory') {
  // Handle advisory query
}
```

### Benefits

1. **Accuracy**: LLM understands context, not just patterns
2. **Flexibility**: Handles edge cases and ambiguous phrasing
3. **Maintainability**: No need to maintain complex regex patterns
4. **Scalability**: Easy to add new intent types
5. **Transparency**: LLM provides reasoning for classification

### Performance Considerations

- Quick checks bypass LLM for obvious patterns (conversational, file generation)
- LLM only called for ambiguous cases
- Caching could be added for repeated queries
- Typical latency: 200-500ms for LLM classification

### Migration Path

1. ✅ Created `intentClassifier.js` with LLM-based classification
2. ✅ Updated `mainAgent.js` to use `IntentClassifier`
3. ⏳ Remove old regex patterns from `mainAgent.js`
4. ⏳ Update frontend `intentRecognition.ts` similarly
5. ⏳ Test with edge cases and ambiguous queries
6. ⏳ Monitor classification accuracy in production

### Testing Recommendations

Test cases to verify correct classification:

**ACTIONABLE (should route to agents):**
- "create a google docs titled Project Plan"
- "send an email to john@example.com"
- "schedule a meeting for tomorrow"
- "help me create a document" ← Edge case
- "guide me through sending an email" ← Edge case
- "search for flights to NYC"
- "find me a hotel in Paris"

**ADVISORY (should NOT route to agents):**
- "How do I create a google docs?"
- "What's the best way to send emails?"
- "Should I schedule the meeting now or later?"
- "What are best practices for project planning?"

**CONVERSATIONAL (should NOT route to agents):**
- "What is my name?"
- "What did I tell you about the project?"
- "Remind me what we discussed"
- "What flights did I search for?"

**FILE_GENERATION (should NOT route to agents):**
- "Generate a PDF of the project plan"
- "Export this as a PDF"
- "Create a text file with the summary"

### Future Improvements

1. **Caching**: Cache classifications for identical queries
2. **Feedback Loop**: Track misclassifications and retrain
3. **Multi-language**: Extend to support non-English queries
4. **Tool Availability**: Consider available tools when classifying
5. **User Preferences**: Learn user's typical intent patterns
