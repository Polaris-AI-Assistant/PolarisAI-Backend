# Quick Start - Research Progress Events

## TL;DR

Emit these WebSocket events during research to show progress in the UI:

```javascript
// 1. Start planning
sendChunk({
  type: 'timeline_research_step',
  eventId: `research-${Date.now()}`,
  timestamp: new Date().toISOString(),
  researchStep: {
    id: 'planning',
    action: 'planning',
    status: 'active',
    sources: []
  }
});

// 2. Complete planning
sendChunk({
  type: 'timeline_research_step',
  eventId: `research-${Date.now()}`,
  timestamp: new Date().toISOString(),
  researchStep: {
    id: 'planning',
    action: 'planning',
    status: 'done',
    sources: []
  }
});

// 3. Start searching
sendChunk({
  type: 'timeline_research_step',
  eventId: `research-${Date.now()}`,
  timestamp: new Date().toISOString(),
  researchStep: {
    id: 'searching',
    action: 'searching',
    status: 'active',
    sources: []
  }
});

// 4. Add sources as you find them
sendChunk({
  type: 'timeline_research_step',
  eventId: `research-${Date.now()}`,
  timestamp: new Date().toISOString(),
  researchStep: {
    id: 'searching',
    action: 'searching',
    status: 'active',
    sources: ['arxiv.org']  // Just the domain
  }
});

// 5. Complete searching
sendChunk({
  type: 'timeline_research_step',
  eventId: `research-${Date.now()}`,
  timestamp: new Date().toISOString(),
  researchStep: {
    id: 'searching',
    action: 'searching',
    status: 'done',
    sources: []
  }
});

// Repeat for: reading, analyzing, synthesizing
```

## Step IDs (in order)

1. `planning` - Planning research strategy
2. `searching` - Searching the web
3. `reading` - Reading sources
4. `analyzing` - Analyzing & cross-referencing
5. `synthesizing` - Synthesizing findings

## Status Values

- `idle` - Not started (default)
- `active` - Currently running (shows spinner)
- `done` - Completed (shows green dot)
- `error` - Failed (shows red dot)

## Optional Fields

```javascript
researchStep: {
  id: 'searching',
  action: 'searching',
  status: 'active',
  detail: 'Querying 5 sources...',  // Optional detail text
  sources: ['arxiv.org', 'nature.com']  // Optional source domains
}
```

## Where to Add

### In `researchService.js`

Add `onProgress` callback parameter:

```javascript
async conductResearch(query, onProgress) {
  // Emit events using onProgress(event)
  onProgress({
    type: 'timeline_research_step',
    eventId: `research-${Date.now()}`,
    timestamp: new Date().toISOString(),
    researchStep: { id: 'planning', action: 'planning', status: 'active', sources: [] }
  });
  
  // ... your research code ...
}
```

### In `researchAgent.js`

Pass the callback through:

```javascript
async processQuery(query, userId, chatSessionId, sendChunk) {
  const result = await this.researchService.conductResearch(
    query,
    (progressEvent) => sendChunk(progressEvent)  // Forward to WebSocket
  );
  return result;
}
```

## Testing

Run this query:
```
"do a deep research on Emerging Trends in AI"
```

You should see animated progress steps appear in the timeline.

## Full Documentation

See `FRONTEND_INTEGRATION.md` for complete details.
