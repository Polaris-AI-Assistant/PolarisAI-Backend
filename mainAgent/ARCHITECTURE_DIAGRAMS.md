# Main Agent System Architecture Diagrams

## 1. High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER / CLIENT                           │
│                    (Frontend Application)                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ HTTP Request
                             │ POST /api/agent/query
                             │ Authorization: Bearer token
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   MAIN AGENT CONTROLLER                          │
│                  (mainAgentController.js)                        │
│  • Authentication Check                                          │
│  • Request Validation                                            │
│  • Response Formatting                                           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      MAIN AGENT CORE                             │
│                     (mainAgent.js)                               │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │            STEP 1: QUERY ANALYSIS                        │  │
│  │  • Uses OpenAI GPT-4                                     │  │
│  │  • Determines required agents                            │  │
│  │  • Decides execution strategy                            │  │
│  │  • Identifies dependencies                               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                             │                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         STEP 2: AGENT EXECUTION                          │  │
│  │                                                          │  │
│  │  ┌─────────────────────┬──────────────────────┐        │  │
│  │  │   PARALLEL MODE     │   SEQUENTIAL MODE    │        │  │
│  │  │   (Independent)     │   (Dependencies)     │        │  │
│  │  │                     │                      │        │  │
│  │  │  All agents run     │  Agents run in       │        │  │
│  │  │  simultaneously     │  dependency order    │        │  │
│  │  └─────────────────────┴──────────────────────┘        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                             │                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │       STEP 3: RESPONSE AGGREGATION                       │  │
│  │  • Combines all responses                                │  │
│  │  • Eliminates redundancy                                 │  │
│  │  • Uses OpenAI for natural output                        │  │
│  │  • Handles errors gracefully                             │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌─────────────┐      ┌─────────────┐     ┌─────────────┐
│  Calendar   │      │    Docs     │     │   Forms     │
│   Agent     │      │   Agent     │     │   Agent     │
└─────────────┘      └─────────────┘     └─────────────┘
        │                    │                    │
        ▼                    ▼                    ▼
┌─────────────┐      ┌─────────────┐     ┌─────────────┐
│   GitHub    │      │    Meet     │     │   Sheets    │
│   Agent     │      │   Agent     │     │   Agent     │
└─────────────┘      └─────────────┘     └─────────────┘
        │                    │                    │
        └────────────────────┴────────────────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │  External Services   │
                  │  • Google Calendar   │
                  │  • Google Docs       │
                  │  • Google Forms      │
                  │  • GitHub            │
                  │  • Google Meet       │
                  │  • Google Sheets     │
                  └──────────────────────┘
```

## 2. Request Flow Diagram

### Single Agent Request
```
User Query: "Show my calendar events"
     │
     ▼
┌─────────────────┐
│ Main Agent      │ ──► Analyzes query
│ Query Analysis  │     Identifies: Calendar agent needed
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Calendar Agent  │ ──► Executes query
│ Execution       │     Uses Calendar API
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Direct Return   │ ──► Returns Calendar agent response
│ (No aggregation)│     (No need to combine)
└────────┬────────┘
         │
         ▼
    Final Response
```

### Multi-Agent Request (Parallel)
```
User Query: "Show GitHub repos and calendar events"
     │
     ▼
┌─────────────────┐
│ Main Agent      │ ──► Analyzes query
│ Query Analysis  │     Identifies: GitHub + Calendar
│                 │     Mode: Parallel (independent)
└────────┬────────┘
         │
         ├─────────────────────┬─────────────────────┐
         ▼                     ▼                     ▼
┌─────────────────┐   ┌─────────────────┐
│ GitHub Agent    │   │ Calendar Agent  │   (Run simultaneously)
│ Execution       │   │ Execution       │
└────────┬────────┘   └────────┬────────┘
         │                     │
         └─────────┬───────────┘
                   ▼
         ┌─────────────────┐
         │ Response        │ ──► Combines responses
         │ Aggregation     │     Creates coherent output
         │ (OpenAI)        │
         └────────┬────────┘
                  │
                  ▼
           Final Response
```

### Multi-Agent Request (Sequential)
```
User Query: "Create document and schedule meeting about it"
     │
     ▼
┌─────────────────┐
│ Main Agent      │ ──► Analyzes query
│ Query Analysis  │     Identifies: Docs → Calendar
│                 │     Mode: Sequential (dependent)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Docs Agent      │ ──► Step 1: Create document
│ Execution       │     Returns: document ID & link
└────────┬────────┘
         │ (Document info available)
         ▼
┌─────────────────┐
│ Calendar Agent  │ ──► Step 2: Create event
│ Execution       │     Includes: document link
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Response        │ ──► Combines sequential results
│ Aggregation     │     Describes both actions
└────────┬────────┘
         │
         ▼
    Final Response
```

## 3. Component Interaction Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      MAIN AGENT                             │
│                                                             │
│  Properties:                                                │
│  • openai: OpenAI client                                    │
│  • agents: {calendar, docs, forms, github, meet, sheets}    │
│  • systemPrompt: Coordinator instructions                   │
│                                                             │
│  Methods:                                                   │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ processQuery(query, userId, options)                │  │
│  │  ├─> analyzeQuery()                                 │  │
│  │  ├─> executeAgentQueries()                          │  │
│  │  └─> combineResponses()                             │  │
│  └─────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ analyzeQuery(query, history)                        │  │
│  │  └─> Returns: {agents, queries, mode, deps}        │  │
│  └─────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ executeAgentQueries(analysis, userId)               │  │
│  │  ├─> If parallel: Promise.all()                     │  │
│  │  └─> If sequential: await in loop                   │  │
│  └─────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ combineResponses(query, analysis, results, errors)  │  │
│  │  └─> Returns: aggregated natural response          │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                         │
                         │ Uses
                         ▼
        ┌────────────────────────────────┐
        │      SPECIALIZED AGENTS        │
        │                                │
        │  Each agent has:               │
        │  • processQuery(query, userId) │
        │  • defineTools()               │
        │  • createFunctionMap()         │
        │  • systemPrompt                │
        └────────────────────────────────┘
```

## 4. Data Flow Diagram

```
Request Body
┌──────────────────────┐
│ {                    │
│   query: "...",      │
│   conversationHist..│
│ }                    │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Authentication       │
│ • Verify token       │
│ • Extract user ID    │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Main Agent           │
│ Analysis Phase       │
│                      │
│ Input:               │
│ • User query         │
│ • Conversation hist  │
│                      │
│ Output:              │
│ • agents: []         │
│ • queries: {}        │
│ • mode: parallel/seq │
│ • reasoning: "..."   │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Execution Phase      │
│                      │
│ For each agent:      │
│ • agent.processQuery │
│ • Collect results    │
│ • Handle errors      │
│                      │
│ Returns:             │
│ • results: {}        │
│ • errors: {}         │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Aggregation Phase    │
│                      │
│ Input:               │
│ • Original query     │
│ • Analysis           │
│ • Agent results      │
│ • Agent errors       │
│                      │
│ Output:              │
│ • Combined response  │
│ • Tools used         │
│ • Agents used        │
└──────────┬───────────┘
           │
           ▼
Response Body
┌──────────────────────┐
│ {                    │
│   success: true,     │
│   query: "...",      │
│   response: "...",   │
│   agentsUsed: [],    │
│   toolsUsed: [],     │
│   analysis: {},      │
│   processingTime,    │
│   timestamp          │
│ }                    │
└──────────────────────┘
```

## 5. Error Handling Flow

```
┌─────────────────────┐
│ User Query          │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Validation          │
│ • Non-empty?        │ ──No──► 400 Bad Request
│ • String type?      │
└──────────┬──────────┘
          Yes
           │
           ▼
┌─────────────────────┐
│ Authentication      │
│ • Valid token?      │ ──No──► 401 Unauthorized
└──────────┬──────────┘
          Yes
           │
           ▼
┌─────────────────────┐
│ Query Analysis      │
│ • Parse query       │ ──Fail──► Log + Retry
│ • Identify agents   │           or Return Error
└──────────┬──────────┘
         Success
           │
           ▼
┌─────────────────────┐
│ Agent Execution     │
│                     │
│ For each agent:     │
│ Try:                │
│   Execute query ────┼─── Success ──► Add to results
│ Catch:              │
│   Log error ────────┼─── Failure ──► Add to errors
│   Continue...       │                 Continue...
└──────────┬──────────┘
           │
           │ (Even if some agents fail)
           ▼
┌─────────────────────┐
│ Response Formation  │
│                     │
│ If any success:     │
│   Partial success ──┼──► Return what worked
│                     │     + error details
│ If all failed:      │
│   Complete fail ────┼──► Return error message
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ HTTP Response       │
│ • 200 OK (partial)  │
│ • 500 Error (total) │
└─────────────────────┘
```

## 6. Execution Modes Comparison

```
PARALLEL MODE (Default for independent operations)
═══════════════════════════════════════════════════

Timeline: ────────────────────────────►
          ┌─────────────────┐
          │ Calendar Agent  │ ──► Returns result A
          ├─────────────────┤
          │  GitHub Agent   │ ──► Returns result B
          ├─────────────────┤
          │   Docs Agent    │ ──► Returns result C
          └─────────────────┘
               │
               ▼
    All complete at ~same time
         Combine results
              │
              ▼
        Final Response

Advantages:
✓ Faster execution
✓ Better resource utilization
✓ Lower total latency

Use when:
• Operations are independent
• No data sharing needed
• Query involves multiple services


SEQUENTIAL MODE (For dependent operations)
═══════════════════════════════════════════════════

Timeline: ────────────────────────────────────────►
          ┌─────────────────┐
Step 1:   │   Docs Agent    │ ──► Creates doc
          └────────┬────────┘     Returns doc ID
                   │
                   │ (Use doc ID)
                   ▼
          ┌─────────────────┐
Step 2:   │ Calendar Agent  │ ──► Creates event
          └────────┬────────┘     Links to doc
                   │
                   ▼
             Final Response

Advantages:
✓ Enables data flow between agents
✓ Maintains operation order
✓ Supports complex workflows

Use when:
• Later operations need earlier results
• Order matters
• Operations have dependencies
```

## 7. System States

```
┌──────────────────────────────────────────────────────────┐
│                    SYSTEM STATES                         │
└──────────────────────────────────────────────────────────┘

IDLE
┌────────────────┐
│ No active      │
│ requests       │
│ Agents ready   │
└───────┬────────┘
        │ New request
        ▼
ANALYZING
┌────────────────┐
│ OpenAI analyzing│
│ Determining     │
│ route strategy  │
└───────┬────────┘
        │
        ▼
EXECUTING
┌────────────────┐
│ Agents running  │
│ Waiting for     │
│ completions     │
└───────┬────────┘
        │
        ▼
AGGREGATING
┌────────────────┐
│ Combining       │
│ responses       │
│ Formatting      │
└───────┬────────┘
        │
        ▼
COMPLETE
┌────────────────┐
│ Response ready  │
│ Return to user  │
└───────┬────────┘
        │
        ▼
     IDLE

ERROR
┌────────────────┐
│ Something failed│
│ Log + Return err│
└────────────────┘
```

## Legend

```
┌─────┐
│ Box │  = Component / Process
└─────┘

   │
   ▼     = Flow direction / Data flow

  ───►   = Direct connection

┌─────┐
│  ▼  │  = Decision point
└─────┘

═════   = Strong emphasis / Major section
```
