# Conversational Agent Routing Fix

## Problem

Advisory and guidance queries (like "How do I cook bhindi?" or "Give me a study plan for React") were being handled directly by the main agent instead of being routed to the specialized conversational agent. This resulted in:

1. Lower quality responses (main agent's generic LLM call vs conversational agent's optimized prompts)
2. Missing specialized handling for coding, recipes, study plans, etc.
3. Inconsistent response quality across different query types

### Example Issue

**User Query:** "Hello bhai, mujhe na bhindi ki sabji banani hai, kaise banau?" (How do I cook bhindi?)

**System Behavior (Before Fix):**
1. ❌ Intent classified as "advisory"
2. ❌ Main agent returns empty agents array
3. ❌ Main agent handles response directly with generic prompt
4. ❌ Response lacks specialized cooking instructions format
5. ❌ Timeline shows: "User is asking for advice - no agents needed"

**Expected Behavior:**
1. ✅ Intent classified as "advisory" or "isConversational: true"
2. ✅ Routed to conversational agent
3. ✅ Conversational agent uses specialized prompts for cooking/recipes
4. ✅ Response includes step-by-step instructions, ingredients, tips
5. ✅ Timeline shows: "Routing to conversational agent"

## Root Cause

In `mainAgent.js`, the `analyzeQuery` function was handling advisory queries by returning an empty agents array:

```javascript
// ❌ BEFORE (Line 2362)
if (intentClassification.type === 'advisory') {
  console.log('[MainAgent] 💡 Detected advisory/planning query - skipping agents:', query);
  return {
    agents: [],
    reasoning: "User is asking for advice, guidance, or planning help - no agents needed, will provide advisory response"
  };
}
```

This caused the main agent to handle the response directly instead of routing to the conversational agent.

## Solution

### 1. Register Conversational Agent

Added the conversational agent to the main agent's agents registry:

```javascript
// ✅ NEW: Import conversational agent
const ConversationalAgent = require('../agents/conversationalAgent');

// ✅ NEW: Register in agents object
this.agents = {
  calendar: new CalendarAgentMultiStep(),
  docs: new DocsAgentMultiStep(),
  // ... other agents
  conversational: new ConversationalAgent()  // ✅ Added
};
```

### 2. Route Advisory Queries to Conversational Agent

Modified the advisory query handling to route to conversational agent:

```javascript
// ✅ AFTER (Lines 2362-2371)
if (intentClassification.type === 'advisory' || intentClassification.isConversational === true) {
  console.log('[MainAgent] 💡 Detected advisory/planning query - routing to conversational agent:', query);
  return {
    agents: ['conversational'],
    queries: {
      conversational: query
    },
    reasoning: "User is asking for advice, guidance, or planning help - routing to conversational agent for high-quality LLM response",
    requiresSequential: false
  };
}
```

### 3. Adapt Conversational Agent Response Format

Modified the conversational agent to return the stream wrapped in a result object:

```javascript
// ✅ NEW: Return stream wrapped in result object
return {
  success: true,
  stream: stream,  // ✅ Return the stream for real-time streaming
  agentName: 'conversational',
  isStreaming: true  // ✅ Flag to indicate this is a streaming response
};
```

This allows the main agent to consume the stream and forward it to the client in real-time.

### 4. Add Real-Time Streaming for Conversational Responses

Added special handling in `streamCombinedResponse` to stream conversational agent responses in real-time:

```javascript
// ✅ NEW: Stream conversational responses in real-time (Lines 6270-6295)
const isConversational = analysis.agents && analysis.agents.includes('conversational') && 
                        results.conversational && results.conversational.success;

if (isConversational && results.conversational.isStreaming && results.conversational.stream) {
  console.log('[MainAgent] 💬 Conversational query detected - streaming response in real-time');
  
  // Stream the response directly from the conversational agent's stream
  const stream = results.conversational.stream;
  
  try {
    for await (const chunk of stream) {
      if (chunk.choices[0].delta.content) {
        const text = chunk.choices[0].delta.content;
        onChunk({ type: 'content', text: text });  // ✅ Stream each chunk immediately
      }
    }
    
    console.log('[MainAgent] ✅ Conversational response streamed successfully');
    return;
  } catch (streamError) {
    console.error('[MainAgent] ❌ Error streaming conversational response:', streamError);
    onChunk({ 
      type: 'content', 
      text: '\n\nI encountered an error while streaming the response. Please try again.' 
    });
    return;
  }
}
```

This ensures responses are streamed token-by-token to the client for a smooth, real-time experience.

### 5. Enhanced Conversational Agent Prompts

Added specialized handling for cooking/recipe queries in the conversational agent:

```javascript
🍳 FOR COOKING/RECIPE QUESTIONS:
- Provide step-by-step instructions
- List ingredients clearly
- Include cooking times and temperatures
- Add helpful tips and variations
- Mention common mistakes to avoid
```

## How It Works Now

### Flow Diagram

```
User Query: "How do I cook bhindi?"
    ↓
1. Intent Classification
    → Type: "advisory"
    → isConversational: true
    ↓
2. Route to Conversational Agent
    → agents: ['conversational']
    → queries: { conversational: query }
    ↓
3. Conversational Agent Execution
    → Uses specialized cooking prompt
    → Generates streaming response
    → Returns: { success: true, stream: <OpenAI Stream>, isStreaming: true }
    ↓
4. Stream Response in Real-Time
    → Consume stream from conversational agent
    → Forward each token immediately to client
    → No buffering or post-processing
    ↓
5. User receives high-quality cooking instructions in real-time
```

## Query Types Routed to Conversational Agent

### Advisory Queries
- "How do I create a Google Doc?"
- "What's the best way to organize my calendar?"
- "Should I use GitHub or GitLab?"

### Coding Queries
- "Write Python code to add two numbers"
- "Explain how JWT authentication works"
- "Give me a React component for a button"

### Study Plans
- "Create a study plan for learning React"
- "Give me a roadmap for becoming a data scientist"
- "How should I learn machine learning?"

### Cooking/Recipes
- "How do I cook bhindi?"
- "Give me a recipe for pasta"
- "How to make biryani?"

### General Knowledge
- "What is the difference between REST and GraphQL?"
- "Explain quantum computing"
- "How does blockchain work?"

## Benefits

1. **Real-Time Streaming**: Responses stream token-by-token for immediate user feedback
2. **Higher Quality Responses**: Conversational agent has specialized prompts for different query types
3. **Consistent Routing**: All advisory queries go through the same agent
4. **Better User Experience**: Responses are tailored to the query type (coding, recipes, study plans, etc.)
5. **Proper Timeline Events**: Shows "Routing to conversational agent" instead of "no agents needed"
6. **No Buffering**: Responses start appearing immediately, not after full generation
7. **Extensibility**: Easy to add more specialized handling in conversational agent

## Files Modified

1. **PolarisAI-Backend/mainAgent/mainAgent.js**
   - Added ConversationalAgent import (line 47)
   - Registered conversational agent in agents object (line 103)
   - Modified advisory query routing (lines 2362-2371)
   - Added direct streaming for conversational responses (lines 6270-6290)

2. **PolarisAI-Backend/agents/conversationalAgent.js**
   - Modified processQuery to return stream wrapped in result object (lines 50-180)
   - Added cooking/recipe handling in system prompt (lines 120-126)
   - Returns stream directly for real-time streaming (lines 165-172)

## Testing

Test with various advisory queries:

```bash
# Cooking query
"Hello bhai, mujhe na bhindi ki sabji banani hai, kaise banau?"

# Coding query
"Write Python code to reverse a string"

# Study plan query
"Give me a study plan for learning React"

# General advisory
"How do I organize my Google Calendar?"
```

Expected behavior:
- Timeline shows: "Routing to conversational agent"
- Response streams in real-time (token-by-token)
- Response is comprehensive and well-formatted
- Includes specialized handling based on query type
- No delay - starts streaming immediately

## Related Files

- **PolarisAI-Backend/mainAgent/intentClassifier.js**: Classifies queries as advisory
- **PolarisAI-Backend/mainAgent/mainAgentController.js**: Handles streaming to client
- **PolarisAI-Backend/utils/languageDetection.js**: Detects query language

## Future Improvements

1. Add more specialized query types (math, science, history, etc.)
2. Support for multi-turn conversations with context
3. Add memory integration for personalized responses
4. Support for code execution and validation
5. Add image generation for visual explanations
6. Support for voice input/output

## Notes

- Conversational agent responses stream in real-time (token-by-token) for immediate user feedback
- The stream is forwarded directly from OpenAI to the client without buffering
- The agent uses GPT-4o-mini for fast, high-quality responses
- Responses are language-aware and match the user's query language
- The agent has access to conversation history for context
- Maximum response length is 2000 tokens for comprehensive answers
- Error handling ensures graceful fallback if streaming fails
