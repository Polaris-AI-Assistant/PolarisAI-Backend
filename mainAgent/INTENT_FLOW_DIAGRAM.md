# Intent Classification Flow Diagram

## Before Fix (Problem)

```
User Query: "do you know about AI summit in Delhi?"
    │
    ├─→ Intent Classifier
    │       │
    │       ├─→ Check: Conversational? ❌
    │       ├─→ Check: File Generation? ❌
    │       ├─→ LLM Classification
    │       │       │
    │       │       └─→ "User wants information/advice"
    │       │
    │       └─→ Result: ADVISORY
    │
    ├─→ Main Agent analyzeQuery()
    │       │
    │       └─→ "Advisory query - skip agents"
    │
    └─→ Response: agents = []
            │
            └─→ LLM tries to answer from training data
                    │
                    └─→ ❌ "I don't have specific information..."
```

## After Fix (Solution)

```
User Query: "do you know about AI summit in Delhi?"
    │
    ├─→ Intent Classifier
    │       │
    │       ├─→ Quick Check: Web Search Pattern? ✅
    │       │       │
    │       │       └─→ Matches: "do you know" + "happening"
    │       │
    │       └─→ Result: WEB_SEARCH (confidence: 0.95)
    │
    ├─→ Main Agent analyzeQuery()
    │       │
    │       └─→ "Web search query detected"
    │
    └─→ Response: agents = ['websearch']
            │
            └─→ WebSearch Agent
                    │
                    ├─→ Search web for current info
                    │
                    └─→ ✅ "Yes! AI Summit Delhi 2024 is on..."
```

## Complete Intent Classification Decision Tree

```
                    User Query
                        │
                        ▼
            ┌───────────────────────┐
            │  Intent Classifier    │
            └───────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
    Quick Checks    Quick Checks    Quick Checks
    Web Search?     Conversational? File Gen?
        │               │               │
        ├─ Yes ─────────┼───────────────┼──→ Return immediately
        │               │               │
        └─ No ──────────┴───────────────┘
                        │
                        ▼
                ┌───────────────┐
                │  LLM Analysis │
                └───────────────┘
                        │
        ┌───────────────┼───────────────┬───────────────┐
        ▼               ▼               ▼               ▼
    WEB_SEARCH      ACTIONABLE      ADVISORY      CONVERSATIONAL
        │               │               │               │
        ▼               ▼               ▼               ▼
    websearch       Specific        No agents       No agents
    agent           agents          (LLM answers)   (from history)
```

## Intent Type Characteristics

### 🌐 WEB_SEARCH (NEW!)
- **Triggers**: latest, current, recent, happening, today, now, upcoming
- **Examples**: "do you know about X", "what's the latest Y"
- **Action**: Route to websearch agent
- **Use Case**: Current events, news, real-time data

### ⚡ ACTIONABLE
- **Triggers**: create, make, send, schedule, search, find
- **Examples**: "create a form", "send email", "schedule meeting"
- **Action**: Route to specific agents (forms, gmail, calendar, etc.)
- **Use Case**: User wants to perform an action

### 💡 ADVISORY
- **Triggers**: how to, best way, should I, what's the best
- **Examples**: "how do I create a form?", "best practices for X"
- **Action**: No agents, LLM provides guidance
- **Use Case**: User wants advice or general knowledge

### 💬 CONVERSATIONAL
- **Triggers**: what did, remind me, tell me about, what was
- **Examples**: "what is my name?", "what did we discuss?"
- **Action**: No agents, answer from conversation history
- **Use Case**: User asks about past interactions

### 📄 FILE_GENERATION
- **Triggers**: generate/export/create + pdf/txt
- **Examples**: "generate a PDF", "export as text file"
- **Action**: No agents, generate file from LLM response
- **Use Case**: User wants to download content as file

## Pattern Matching Priority

```
1. Web Search Patterns (HIGHEST PRIORITY)
   ├─ "do you know about [event]"
   ├─ "latest/current/recent [topic]"
   └─ "happening/upcoming [event]"

2. Conversational Patterns
   ├─ "what is my name"
   ├─ "what did I tell you"
   └─ "remind me"

3. File Generation Patterns
   ├─ "generate PDF"
   ├─ "export as TXT"
   └─ "create text file"

4. LLM Classification (FALLBACK)
   └─ For nuanced queries that don't match patterns
```

## Key Insight

The fix separates **"asking for information"** into two categories:

1. **ADVISORY**: General knowledge questions (how-to, best practices)
   - Example: "How do I create a form?"
   - Answer: From LLM's training data

2. **WEB_SEARCH**: Current/real-time information questions
   - Example: "Do you know about the AI summit?"
   - Answer: From web search (current data)

This distinction is critical for providing accurate, up-to-date information!
