/**
 * LLM STABILITY - QUICK START GUIDE FOR DEVELOPERS
 * 
 * How to use the new LLMConfig system in your agents
 */

## Quick Start

### 1. Import LLMConfig
```javascript
const LLMConfig = require('../utils/llmConfig');
```

### 2. Normalize User Input
```javascript
// BEFORE (causes inconsistency):
const userQuery = "What's  the weather?";  // Extra space, contraction
await processQuery(userQuery);

// AFTER (stable):
const userQuery = "What's  the weather?";  // User input
const cleanQuery = LLMConfig.normalizeInput(userQuery);
// cleanQuery = "what is the weather" (normalized)
await processQuery(cleanQuery);
```

### 3. Use Standardized LLM Calls
```javascript
// BEFORE (varying temperatures):
const response = await openaiClient.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: messages,
  temperature: 0.7,  // Too high!
  max_tokens: 1500
});

// AFTER (standardized):
const response = await LLMConfig.createCompletion(
  openaiClient,
  messages,
  {
    temperature: LLMConfig.TEMPERATURE.DETERMINISTIC,  // 0.1
    maxTokens: 1500
  }
);
```

### 4. Add System Prompt with Reasoning
```javascript
// BEFORE (no reasoning):
const systemPrompt = "You are a helpful assistant.";

// AFTER (with chain-of-thought):
const systemPrompt = LLMConfig.createSystemPrompt(
  "You are a helpful assistant that helps users manage their tasks."
);
// This automatically adds:
// "You MUST follow this 2-step process:
//  STEP 1: ANALYZE & REASON
//  STEP 2: EXECUTE"
```

---

## Temperature Guidelines

### Use DETERMINISTIC (0.1) for:
- ✅ Intent classification
- ✅ Tool selection
- ✅ Parameter extraction
- ✅ Response combining
- ✅ Any decision-making

```javascript
const response = await LLMConfig.createCompletion(
  openaiClient,
  messages,
  { temperature: LLMConfig.TEMPERATURE.DETERMINISTIC }
);
```

### Use ANALYTICAL (0.15) for:
- ✅ Complex reasoning
- ✅ Analysis tasks
- ✅ When you need thoughtful responses

```javascript
const response = await LLMConfig.createCompletion(
  openaiClient,
  messages,
  { temperature: LLMConfig.TEMPERATURE.ANALYTICAL }
);
```

### Use NORMAL (0.2) for:
- ✅ General conversation
- ✅ Helpful responses
- ✅ Most use cases

```javascript
const response = await LLMConfig.createCompletion(
  openaiClient,
  messages,
  { temperature: LLMConfig.TEMPERATURE.NORMAL }
);
```

### NEVER use > 0.2 for:
❌ Tool selection
❌ Intent classification
❌ Parameter extraction
❌ Decision making

*(Higher temperatures = random, inconsistent behavior)*

---

## Common Patterns

### Pattern 1: Intent Classification
```javascript
const LLMConfig = require('../utils/llmConfig');

async function classifyIntent(query) {
  // 1. Normalize
  const clean Query = LLMConfig.normalizeInput(query);
  
  // 2. Add reasoning instruction
  const systemPrompt = LLMConfig.createSystemPrompt(
    "Classify this query into one of: ACTIONABLE, ADVISORY, CONVERSATIONAL"
  );
  
  // 3. Use deterministic temperature
  const response = await LLMConfig.createCompletion(
    this.openai,
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: cleanQuery }
    ],
    { temperature: LLMConfig.TEMPERATURE.DETERMINISTIC }
  );
  
  return response.choices[0].message.content;
}
```

### Pattern 2: Tool Parameter Extraction
```javascript
async function extractParams(userQuery, toolSchema) {
  // 1. Normalize input
  const cleanQuery = LLMConfig.normalizeInput(userQuery);
  
  // 2. Create schema prompt
  const prompt = `Extract parameters matching this schema:\n${JSON.stringify(toolSchema)}`;
  
  // 3. Use deterministic LLM call
  const response = await LLMConfig.createCompletion(
    this.openai,
    [
      { role: 'system', content: "Extract parameters as JSON" },
      { role: 'user', content: `${prompt}\n\nQuery: "${cleanQuery}"` }
    ],
    {
      temperature: LLMConfig.TEMPERATURE.DETERMINISTIC,
      responseFormat: { type: 'json_object' }
    }
  );
  
  return JSON.parse(response.choices[0].message.content);
}
```

### Pattern 3: Response Combining
```javascript
async function combineResponses(responses, query) {
  // 1. Normalize query
  const cleanQuery = LLMConfig.normalizeInput(query);
  
  // 2. Create combining prompt
  const prompt = `Combine these responses into one coherent answer:\n${JSON.stringify(responses)}`;
  
  // 3. Use deterministic combination
  const combined = await LLMConfig.createCompletion(
    this.openai,
    [
      { role: 'system', content: "Combine responses coherently" },
      { role: 'user', content: `Query: "${cleanQuery}"\n\n${prompt}` }
    ],
    {
      temperature: LLMConfig.TEMPERATURE.DETERMINISTIC,
      maxTokens: 2000
    }
  );
  
  return combined.choices[0].message.content;
}
```

---

## Validation

LLMConfig automatically validates temperatures:

```javascript
// If someone tries to use high temperature:
const BAD_TEMP = 0.8;

// LLMConfig.validateTemperature() will:
const validatedTemp = LLMConfig.validateTemperature(BAD_TEMP);
// WARNING: Temperature 0.8 is too high for deterministic behavior.
// validatedTemp = 0.1
```

You can also check directly:
```javascript
if (!LLMConfig.validateTemperature(temp)) {
  console.warn("Temperature too high!");
}
```

---

## Environment Variables (Optional)

In your `.env` or `.env.local`:

```bash
# Enable seed-based reproducibility (exact same output each time)
ENABLE_LLM_REPRODUCIBILITY=true

# Debug flags
DEBUG_LLM_NORMALIZATION=true
DEBUG_LLM_TEMPERATURES=true
DEBUG_CHAIN_OF_THOUGHT=true

# Customize temperatures (optional)
LLM_DETERMINISTIC_TEMP=0.1
LLM_ANALYTICAL_TEMP=0.15
LLM_NORMAL_TEMP=0.2
```

---

## Migration Checklist

Updating an existing agent to use LLMConfig:

- [ ] Import `const LLMConfig = require('../utils/llmConfig');`
- [ ] Normalize input: `LLMConfig.normalizeInput(userQuery)`
- [ ] Add system prompt: `LLMConfig.createSystemPrompt(basePrompt)`
- [ ] Update LLM call: `LLMConfig.createCompletion(...)`
- [ ] Set correct temperature: `DETERMINISTIC` for decisions
- [ ] Test: Same query = same response (5 times)
- [ ] Monitor: Check for consistency improvements

---

## Common Mistakes to Avoid

❌ **WRONG:**
```javascript
const response = await openai.chat.completions.create({
  temperature: 0.7,  // Too high!
  ...
});
```

✅ **RIGHT:**
```javascript
const response = await LLMConfig.createCompletion(
  openai,
  messages,
  { temperature: LLMConfig.TEMPERATURE.DETERMINISTIC }
);
```

---

❌ **WRONG:**
```javascript
// Sending unnormalized user input
await processQuery("What's  the weather?");  // Inconsistent
```

✅ **RIGHT:**
```javascript
// Normalize first
const clean = LLMConfig.normalizeInput("What's  the weather?");
// clean = "what is the weather"
await processQuery(clean);
```

---

❌ **WRONG:**
```javascript
// No reasoning instruction
const systemPrompt = "Answer questions";
```

✅ **RIGHT:**
```javascript
// Add reasoning instruction
const systemPrompt = LLMConfig.createSystemPrompt(
  "Answer questions by thinking first"
);
```

---

## Testing Your Implementation

```javascript
// Test consistency: Same query should give identical responses
async function testConsistency(agent, query) {
  const results = [];
  
  for (let i = 0; i < 5; i++) {
    const result = await agent.process(query);
    results.push(result);
  }
  
  // All should be identical (or very similar)
  const allSame = results.every(r => r === results[0]);
  console.log(`Consistency: ${allSame ? '✓ PASS' : '✗ FAIL'}`);
  
  return allSame;
}

// Test normalization: Different inputs should give same response
async function testNormalization(agent) {
  const variations = [
    "What's the weather?",
    "What is the weather?",
    "what is the weather",
    "WHAT IS THE WEATHER?"
  ];
  
  const results = [];
  for (const query of variations) {
    const result = await agent.process(query);
    results.push(result);
  }
  
  // All should be identical
  const allSame = results.every(r => r === results[0]);
  console.log(`Normalization: ${allSame ? '✓ PASS' : '✗ FAIL'}`);
  
  return allSame;
}
```

---

## Support & Debugging

Enable debug logging:
```javascript
// In LLMConfig.js, temporarily:
console.log('[LLMConfig] Input normalization:', { original, normalized });
console.log('[LLMConfig] Temperature:', temperature);
console.log('[LLMConfig] Using model:', params.model);
```

Check your implementation:
1. Are you normalizing input? ✓
2. Are you using LLMConfig.createCompletion()? ✓
3. Is your temperature ≤ 0.2? ✓
4. Do you have chain-of-thought instruction? ✓

If still inconsistent:
1. Check temperature hasn't been overridden
2. Verify input normalization is working
3. Check LLMConfig is being used in all LLM calls
4. Verify system prompt includes reasoning instruction
