# Language Detection Usage Map - Where It's Called

## Quick Reference: All Places Language Detection Happens

```
┌─────────────────────────────────────────────────────────────────┐
│                    LANGUAGE DETECTION FLOW                      │
└─────────────────────────────────────────────────────────────────┘

User Query
    ↓
┌─────────────────────────────────────────────────────────────────┐
│ 1. MainAgent.processQueryWithStreaming() [Line ~2160]           │
│    detectLanguage(query) → 'en' / 'hi' / 'mr' / etc.            │
│    ↓ Pass to all downstream methods                             │
└─────────────────────────────────────────────────────────────────┘
    ↓
    ├─ 2. MainAgent.analyzeQuery() [Line ~1510]
    │      getLanguageInstruction(detectedLanguage)
    │      Add to system prompt for query routing
    │      ↓
    │      LLM analyzes query in correct language
    │
    ├─ 3. MainAgent.executeAgentQueries() [Line ~1920 & ~1992]
    │      Pass conversationId to agents
    │      ↓
    │      CalendarAgent.processQuery() [Line ~30 in BaseAgent]
    │      ├─ detectLanguage(query) again (redundant but safe)
    │      ├─ getLanguageInstruction(detectedLanguage)
    │      └─ Add to system prompt
    │      ↓
    │      GmailAgent.processQuery() [Line ~30 in BaseAgent]
    │      ├─ detectLanguage(query) again
    │      ├─ getLanguageInstruction(detectedLanguage)
    │      └─ Add to system prompt
    │
    ├─ 4. MainAgent.streamConfirmedActionResponse() [Line ~4235]
    │      detectLanguage(query) from executionResult
    │      getLanguageInstruction(detectedLanguage)
    │      Add to system prompt for intermediate confirmation
    │      ↓
    │      LLM generates confirmation in correct language
    │
    ├─ 5. MainAgent.generateEmailFromScratch() [Line ~710]
    │      detectLanguage(originalQuery)
    │      getLanguageInstruction(detectedLanguage)
    │      Add to system prompt for email generation
    │      ↓
    │      LLM generates email in correct language
    │
    └─ 6. MainAgent.streamCombinedResponse() [Line ~4375]
         detectLanguage(query)
         getLanguageInstruction(detectedLanguage)
         Add to system prompt for final response
         ↓
         LLM generates final response in correct language

Final Response to User ✓ In Correct Language
```

## Detailed Call Stack

### 1. Entry Point: MainAgent.processQueryWithStreaming()
**File**: `PolarisAI-Backend/mainAgent/mainAgent.js`
**Line**: ~2160

```javascript
async processQueryWithStreaming(query, userId, options = {}, onChunk) {
  // ✅ CRITICAL: Detect language at the VERY START before any processing
  const languageDetection = require('../utils/languageDetection');
  const detectedLanguage = languageDetection.detectLanguage(query);
  const languageName = languageDetection.getLanguageName(detectedLanguage);
  console.log(`[MainAgent] 🌐 Detected language at START: ${languageName} (${detectedLanguage})`);
  
  // Pass to downstream methods
  const analysis = await this.analyzeQuery(
    enhancedQuery, 
    options.conversationHistory, 
    artifactContext, 
    memoryContext, 
    options.fileContext, 
    detectedLanguage  // ← PASS HERE
  );
  
  await this.streamCombinedResponse(
    enhancedQuery, 
    analysis, 
    results, 
    errors, 
    onChunk, 
    conversationId, 
    memoryContext, 
    options.conversationHistory || [], 
    options.fileContext, 
    detectedLanguage  // ← PASS HERE
  );
}
```

### 2. Query Analysis: MainAgent.analyzeQuery()
**File**: `PolarisAI-Backend/mainAgent/mainAgent.js`
**Line**: ~1510

```javascript
async analyzeQuery(query, conversationHistory = [], artifactContext = null, memoryContext = '', fileContext = null, detectedLanguage = 'en') {
  // Get language instruction for LLM
  const languageDetection = require('../utils/languageDetection');
  const languageInstruction = languageDetection.getLanguageInstruction(detectedLanguage);
  const languageName = languageDetection.getLanguageName(detectedLanguage);
  console.log(`[MainAgent] 🌐 analyzeQuery using language: ${languageName} (${detectedLanguage})`);
  
  // Add language instruction to system prompt
  const messages = [
    { 
      role: 'system', 
      content: `You are an expert at analyzing user requests...
      
${languageInstruction}

...` 
    },
    { role: 'user', content: analysisPrompt + fileContextSection }
  ];

  const response = await this.openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: messages,
    temperature: 0.3,
    response_format: { type: "json_object" }
  });
}
```

### 3. Agent Execution: MainAgent.executeAgentQueries()
**File**: `PolarisAI-Backend/mainAgent/mainAgent.js`
**Line**: ~1920 (sequential) & ~1992 (parallel)

```javascript
async executeAgentQueries(analysis, userId, conversationId = null, userLocation = null, timeline = null, conversationHistory = []) {
  if (analysis.requiresSequential) {
    for (const agentName of analysis.agents) {
      // ... setup code ...
      
      // Build options for the agent (sequential execution)
      const agentOptions = {
        conversationId: conversationId,  // ✅ CRITICAL: Pass conversationId
        conversationHistory: conversationHistory,
        ...(agentName === 'maps' && userLocation ? { userLocation } : {})
      };

      const result = await agent.processQuery(agentQuery, userId, agentOptions);
      // ↓ Goes to BaseAgent.processQuery()
    }
  } else {
    // Parallel execution
    const agentPromises = analysis.agents.map(async (agentName) => {
      // ... setup code ...
      
      const agentOptions = {
        conversationId: conversationId,  // ✅ CRITICAL: Pass conversationId
        conversationHistory: conversationHistory,
        ...(agentName === 'maps' && userLocation ? { userLocation } : {})
      };

      const result = await agent.processQuery(agentQuery, userId, agentOptions);
      // ↓ Goes to BaseAgent.processQuery()
    });
  }
}
```

### 4. Specialized Agent: BaseAgent.processQuery()
**File**: `PolarisAI-Backend/base/BaseAgent.js`
**Line**: ~30

```javascript
async processQuery(query, context = {}) {
  console.log(`\n[${this.agentName}] 🚀 Processing query: "${query}"`);

  // ✅ Detect query language
  const languageDetection = require('../utils/languageDetection');
  const detectedLanguage = languageDetection.detectLanguage(query);
  const languageName = languageDetection.getLanguageName(detectedLanguage);
  console.log(`[${this.agentName}] 🌐 Detected language: ${languageName} (${detectedLanguage})`);

  const messages = this.buildInitialMessages(query, context, detectedLanguage);
  // ↓ buildInitialMessages adds language instruction to system prompt
}
```

### 5. Intermediate Confirmation: MainAgent.streamConfirmedActionResponse()
**File**: `PolarisAI-Backend/mainAgent/mainAgent.js`
**Line**: ~4235

```javascript
async streamConfirmedActionResponse(executionResult, onChunk, timeline = null) {
  const { result, query, toolName, agentName, nextConfirmation } = executionResult;

  // ✅ CRITICAL: Detect language from the original query
  const languageDetection = require('../utils/languageDetection');
  const detectedLanguage = languageDetection.detectLanguage(query);
  const languageInstruction = languageDetection.getLanguageInstruction(detectedLanguage);
  const languageName = languageDetection.getLanguageName(detectedLanguage);
  console.log(`[MainAgent] 🌐 streamConfirmedActionResponse using language: ${languageName} (${detectedLanguage})`);

  // ... build responsePrompt ...

  const messages = [
    { role: 'system', content: this.systemPrompt + '\n\n' + languageInstruction },
    { role: 'user', content: responsePrompt }
  ];

  const stream = await this.openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: messages,
    temperature: 0.7,
    stream: true,
  });
}
```

### 6. Email Generation: MainAgent.generateEmailFromScratch()
**File**: `PolarisAI-Backend/mainAgent/mainAgent.js`
**Line**: ~710

```javascript
async generateEmailFromScratch(recipientEmail, itemType, itemDetails, originalQuery, userId) {
  // ✅ CRITICAL: Detect language from the original query
  const languageDetection = require('../utils/languageDetection');
  const detectedLanguage = languageDetection.detectLanguage(originalQuery);
  const languageInstruction = languageDetection.getLanguageInstruction(detectedLanguage);
  const languageName = languageDetection.getLanguageName(detectedLanguage);
  console.log(`[MainAgent] 🌐 generateEmailFromScratch using language: ${languageName} (${detectedLanguage})`);

  // ... build prompt ...

  const response = await this.openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { 
        role: 'system', 
        content: 'You are a professional email writer. Return only valid JSON. Use actual names, not placeholders.\n\n' + languageInstruction 
      },
      { role: 'user', content: prompt }
    ],
    temperature: 0.3,
    response_format: { type: "json_object" }
  });
}
```

### 7. Final Response: MainAgent.streamCombinedResponse()
**File**: `PolarisAI-Backend/mainAgent/mainAgent.js`
**Line**: ~4375

```javascript
async streamCombinedResponse(query, analysis, results, errors, onChunk, conversationId = null, memoryContext = '', conversationHistory = [], fileContext = null, detectedLanguage = 'en') {
  // Get language instruction for LLM
  const languageDetection = require('../utils/languageDetection');
  const languageInstruction = languageDetection.getLanguageInstruction(detectedLanguage);
  const languageName = languageDetection.getLanguageName(detectedLanguage);
  console.log(`[MainAgent] 🌐 streamCombinedResponse using language: ${languageName} (${detectedLanguage})`);

  // ... build responsePrompt ...

  const messages = [
    { role: 'system', content: systemPrompt + '\n\n' + languageInstruction },
    // ... add conversation history ...
    { role: 'user', content: responsePrompt }
  ];

  const stream = await this.openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: messages,
    temperature: 0.7,
    stream: true,
  });
}
```

## Log Output Example

When a Hindi query is processed, you'll see:

```
[MainAgentController] User 263c2f1d-a063-4e68-b7ff-b72447c1c0d0 streaming query: "कल शाम 5 बजे के लिए एक मीटिंग शेड्यूल करें"

[MainAgent] 🌐 Detected language at START: Hindi (hi)
[MainAgent] 🌐 analyzeQuery using language: Hindi (hi)
[MainAgent] Executing calendar sequentially with query: "कल शाम 5 बजे के लिए एक मीटिंग शेड्यूल करें"
[CalendarAgent] 🌐 Detected language: Hindi (hi)
[MainAgent] 🌐 streamConfirmedActionResponse using language: Hindi (hi)
[MainAgent] 🌐 generateEmailFromScratch using language: Hindi (hi)
[GmailAgent] 🌐 Detected language: Hindi (hi)
[MainAgent] 🌐 streamCombinedResponse using language: Hindi (hi)
```

## Summary Table

| Component | File | Line | Function | Purpose |
|-----------|------|------|----------|---------|
| **Entry Point** | mainAgent.js | ~2160 | processQueryWithStreaming() | Detect language at start |
| **Query Routing** | mainAgent.js | ~1510 | analyzeQuery() | Route query in correct language |
| **Agent Execution** | mainAgent.js | ~1920 | executeAgentQueries() | Pass conversationId to agents |
| **Specialized Agent** | BaseAgent.js | ~30 | processQuery() | Detect language in agent |
| **Intermediate Response** | mainAgent.js | ~4235 | streamConfirmedActionResponse() | Confirm action in correct language |
| **Email Generation** | mainAgent.js | ~710 | generateEmailFromScratch() | Generate email in correct language |
| **Final Response** | mainAgent.js | ~4375 | streamCombinedResponse() | Generate final response in correct language |
| **Utility** | languageDetection.js | - | detectLanguage() | Core detection logic |
| **Utility** | languageDetection.js | - | getLanguageInstruction() | Generate LLM instruction |

## Key Points

1. **Language is detected ONCE** at the entry point (processQueryWithStreaming)
2. **Language is passed through the entire chain** to all downstream methods
3. **Language instruction is added to EVERY LLM call** to enforce consistency
4. **Specialized agents also detect language** (redundant but safe)
5. **Intermediate responses use language detection** from original query
6. **Email generation uses language detection** from original query
7. **Final response uses detected language** from entry point

This ensures 100% consistency: all responses are in the same language as the user's query.
