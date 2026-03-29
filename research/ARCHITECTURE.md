# 🏗️ Deep Research Agent - Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                            │
│  (React Component with Real-time Progress Updates)              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ HTTP POST + WebSocket
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                   RESEARCH CONTROLLER                            │
│  • Authentication                                                │
│  • Request validation                                            │
│  • WebSocket progress emission                                   │
│  • Response formatting                                           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                    RESEARCH AGENT                                │
│  • Query validation                                              │
│  • Progress mapping                                              │
│  • Error handling                                                │
│  • Result formatting                                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                  RESEARCH SERVICE                                │
│                  (5-Stage Pipeline)                              │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  STAGE 1: Query Understanding                            │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │ • Analyze query with Gemini                        │  │  │
│  │  │ • Generate 3-5 sub-queries                         │  │  │
│  │  │ • Classify intent (informational/comparative/      │  │  │
│  │  │   analytical)                                      │  │  │
│  │  │ • Create research plan                             │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                         │                                        │
│  ┌──────────────────────▼──────────────────────────────────┐  │
│  │  STAGE 2: Multi-Search (Parallel)                       │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │ • Execute searches in parallel                     │  │  │
│  │  │ • Fetch top 5 URLs per query                       │  │  │
│  │  │ • Deduplicate URLs                                 │  │  │
│  │  │ • Limit to max 15 total URLs                       │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                         │                                        │
│  ┌──────────────────────▼──────────────────────────────────┐  │
│  │  STAGE 3: Content Fetching                              │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │ • Fetch HTML from URLs (parallel)                  │  │  │
│  │  │ • Clean content (remove nav, ads, scripts)         │  │  │
│  │  │ • Limit to ~8k chars per page                      │  │  │
│  │  │ • Cache fetched content                            │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                         │                                        │
│  ┌──────────────────────▼──────────────────────────────────┐  │
│  │  STAGE 4: Iterative Research Loop                       │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │ Loop (max 2-3 iterations):                         │  │  │
│  │  │   1. Analyze collected content with Gemini         │  │  │
│  │  │   2. Identify missing information                  │  │  │
│  │  │   3. Generate follow-up queries                    │  │  │
│  │  │   4. Perform additional searches                   │  │  │
│  │  │   5. Fetch new content                             │  │  │
│  │  │   6. Stop when sufficient                          │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                         │                                        │
│  ┌──────────────────────▼──────────────────────────────────┐  │
│  │  STAGE 5: Final Synthesis                               │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │ • Generate TL;DR                                   │  │  │
│  │  │ • Create structured answer                         │  │  │
│  │  │ • Add source citations [1], [2], etc.             │  │  │
│  │  │ • Provide key takeaways                            │  │  │
│  │  │ • Generate follow-up questions                     │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                         │
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                   EXTERNAL SERVICES                              │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │  Gemini 1.5      │  │  Serper API      │  │  Web Content │  │
│  │  Flash           │  │  (Google Search) │  │  (HTTP)      │  │
│  │                  │  │                  │  │              │  │
│  │  • Query         │  │  • Web search    │  │  • HTML      │  │
│  │    planning      │  │  • News search   │  │    fetching  │  │
│  │  • Analysis      │  │  • Image search  │  │  • Content   │  │
│  │  • Synthesis     │  │                  │  │    parsing   │  │
│  └──────────────────┘  └──────────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

```
User Query
    │
    ├─→ [Controller] Validate & Authenticate
    │
    ├─→ [Agent] Process Query
    │       │
    │       ├─→ [Service] Stage 1: Plan Research
    │       │       │
    │       │       └─→ [Gemini] Analyze query → Sub-queries
    │       │
    │       ├─→ [Service] Stage 2: Multi-Search
    │       │       │
    │       │       └─→ [Serper] Parallel searches → URLs
    │       │
    │       ├─→ [Service] Stage 3: Fetch Content
    │       │       │
    │       │       └─→ [HTTP] Fetch & clean → Content
    │       │
    │       ├─→ [Service] Stage 4: Iterative Research
    │       │       │
    │       │       ├─→ [Gemini] Analyze → Missing info
    │       │       ├─→ [Serper] Follow-up searches
    │       │       └─→ [HTTP] Fetch more content
    │       │
    │       └─→ [Service] Stage 5: Synthesize
    │               │
    │               └─→ [Gemini] Generate answer → Result
    │
    └─→ [Controller] Format & Return
            │
            └─→ User receives comprehensive answer
```

## Progress Updates Flow

```
[Service] Stage Update
    │
    ├─→ [Agent] Map to user-friendly message
    │
    ├─→ [Controller] Emit via WebSocket
    │
    └─→ [Frontend] Update UI
            │
            ├─→ Progress bar (0-100%)
            ├─→ Step indicators
            └─→ Status message
```

## Component Interaction

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend Layer                          │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  DeepResearch Component                              │  │
│  │  • Input handling                                    │  │
│  │  • Progress visualization                            │  │
│  │  • Result rendering                                  │  │
│  │  • WebSocket listener                                │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                         │ HTTP + WebSocket
                         │
┌─────────────────────────▼───────────────────────────────────┐
│                      Backend Layer                           │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Express Server (index.js)                           │  │
│  │  • Route registration                                │  │
│  │  • Middleware setup                                  │  │
│  │  • Socket.io initialization                          │  │
│  └──────────────────────────────────────────────────────┘  │
│                         │                                    │
│  ┌──────────────────────▼──────────────────────────────┐  │
│  │  Research Controller                                 │  │
│  │  • /api/research/agent/query                         │  │
│  │  • /api/research/agent/capabilities                  │  │
│  │  • /api/research/agent/examples                      │  │
│  │  • /api/research/agent/status                        │  │
│  │  • /api/research/agent/clear-cache                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                         │                                    │
│  ┌──────────────────────▼──────────────────────────────┐  │
│  │  Research Agent                                      │  │
│  │  • Query validation                                  │  │
│  │  • Progress mapping                                  │  │
│  │  • Error handling                                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                         │                                    │
│  ┌──────────────────────▼──────────────────────────────┐  │
│  │  Research Service                                    │  │
│  │  • 5-stage pipeline                                  │  │
│  │  • Content caching                                   │  │
│  │  • API orchestration                                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Caching Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                      Content Cache                           │
│                      (In-Memory Map)                         │
│                                                              │
│  Key: URL                                                    │
│  Value: Cleaned content (max 8k chars)                      │
│                                                              │
│  Benefits:                                                   │
│  • Prevents re-fetching same URLs                           │
│  • Reduces API calls                                        │
│  • Faster research for similar queries                      │
│                                                              │
│  Lifecycle:                                                  │
│  • Created on first fetch                                   │
│  • Persists during agent lifetime                           │
│  • Can be cleared via API                                   │
└─────────────────────────────────────────────────────────────┘
```

## Error Handling Flow

```
Error Occurs
    │
    ├─→ [Service] Catch & log error
    │       │
    │       └─→ Return structured error
    │
    ├─→ [Agent] Handle error
    │       │
    │       └─→ Format user-friendly message
    │
    ├─→ [Controller] Return error response
    │       │
    │       └─→ HTTP 500 with error details
    │
    └─→ [Frontend] Display error
            │
            └─→ Show error message to user
```

## Parallel Processing

```
Stage 2: Multi-Search
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  Query 1 ──→ [Serper] ──→ URLs 1                           │
│  Query 2 ──→ [Serper] ──→ URLs 2                           │
│  Query 3 ──→ [Serper] ──→ URLs 3    } Parallel             │
│  Query 4 ──→ [Serper] ──→ URLs 4                           │
│  Query 5 ──→ [Serper] ──→ URLs 5                           │
│                                                              │
│  All results → Deduplicate → Top 15 URLs                    │
└─────────────────────────────────────────────────────────────┘

Stage 3: Content Fetching
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  URL 1  ──→ [HTTP] ──→ Content 1                           │
│  URL 2  ──→ [HTTP] ──→ Content 2                           │
│  URL 3  ──→ [HTTP] ──→ Content 3                           │
│  ...                                } Parallel              │
│  URL 15 ──→ [HTTP] ──→ Content 15                          │
│                                                              │
│  All content → Clean & cache → Collected content            │
└─────────────────────────────────────────────────────────────┘
```

## State Management

```
┌─────────────────────────────────────────────────────────────┐
│                    Research State                            │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Query State                                         │  │
│  │  • Original query                                    │  │
│  │  • Sub-queries                                       │  │
│  │  • Intent classification                             │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Content State                                       │  │
│  │  • Collected sources                                 │  │
│  │  • Fetched content                                   │  │
│  │  • Cache status                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Progress State                                      │  │
│  │  • Current stage                                     │  │
│  │  • Completed steps                                   │  │
│  │  • Progress percentage                               │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Result State                                        │  │
│  │  • Generated answer                                  │  │
│  │  • Source citations                                  │  │
│  │  • Follow-up questions                               │  │
│  │  • Metadata                                          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Security Layers

```
┌─────────────────────────────────────────────────────────────┐
│                      Security Layers                         │
│                                                              │
│  Layer 1: Authentication                                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  • JWT token validation                              │  │
│  │  • User identification                               │  │
│  │  • Session management                                │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  Layer 2: Input Validation                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  • Query length check (max 500 chars)               │  │
│  │  • Query content validation                          │  │
│  │  • Parameter sanitization                            │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  Layer 3: API Key Protection                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  • Environment variables                             │  │
│  │  • Never exposed to client                           │  │
│  │  • Secure storage                                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  Layer 4: Content Sanitization                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  • HTML cleaning                                     │  │
│  │  • Script removal                                    │  │
│  │  • Safe content extraction                           │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  Layer 5: Rate Limiting (Recommended)                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  • Per-user limits                                   │  │
│  │  • Global limits                                     │  │
│  │  • Abuse prevention                                  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Scalability Considerations

```
Current Architecture (Single Instance)
┌─────────────────────────────────────────────────────────────┐
│  Express Server                                              │
│  • In-memory cache                                           │
│  • Single process                                            │
│  • WebSocket connections                                     │
└─────────────────────────────────────────────────────────────┘

Future Architecture (Distributed)
┌─────────────────────────────────────────────────────────────┐
│  Load Balancer                                               │
│  ├─→ Server Instance 1                                       │
│  ├─→ Server Instance 2                                       │
│  └─→ Server Instance N                                       │
│                                                              │
│  Shared Services:                                            │
│  • Redis (distributed cache)                                 │
│  • Redis (WebSocket pub/sub)                                │
│  • Database (research history)                               │
│  • Message Queue (async processing)                          │
└─────────────────────────────────────────────────────────────┘
```

## Performance Optimization

```
Optimization Strategies
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  1. Parallel Processing                                      │
│     • Multiple searches simultaneously                       │
│     • Parallel content fetching                             │
│     • Reduces total time by ~60%                            │
│                                                              │
│  2. Content Caching                                          │
│     • In-memory cache for fetched content                   │
│     • Prevents redundant HTTP requests                      │
│     • Reduces API calls by ~40%                             │
│                                                              │
│  3. URL Deduplication                                        │
│     • Removes duplicate sources                             │
│     • Reduces content fetching                              │
│     • Improves result quality                               │
│                                                              │
│  4. Content Limiting                                         │
│     • Max 8k chars per page                                 │
│     • Focuses on main content                               │
│     • Reduces processing time                               │
│                                                              │
│  5. Smart Iteration                                          │
│     • Stops when sufficient information                     │
│     • Max 2-3 iterations                                    │
│     • Prevents unnecessary searches                         │
└─────────────────────────────────────────────────────────────┘
```

## Monitoring Points

```
Key Metrics to Monitor
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  Performance Metrics:                                        │
│  • Average research duration                                 │
│  • API response time                                         │
│  • Content fetch success rate                               │
│  • Cache hit rate                                            │
│                                                              │
│  Usage Metrics:                                              │
│  • Total research queries                                    │
│  • Queries per user                                          │
│  • Success rate                                              │
│  • Error rate                                                │
│                                                              │
│  Quality Metrics:                                            │
│  • Sources per query                                         │
│  • Iterations per query                                      │
│  • Follow-up question usage                                  │
│  • User satisfaction                                         │
│                                                              │
│  Resource Metrics:                                           │
│  • Gemini API calls                                          │
│  • Serper API calls                                          │
│  • HTTP requests                                             │
│  • Memory usage                                              │
└─────────────────────────────────────────────────────────────┘
```

---

This architecture provides a solid foundation for a production-grade research system with room for future enhancements and scaling.
