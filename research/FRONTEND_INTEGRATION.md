# Deep Research Progress UI - Backend Integration Guide

## Overview
The frontend now has a Perplexity-style inline research progress indicator that displays real-time research steps within the timeline component. This guide explains how to emit the required WebSocket events from the backend.

## Frontend Components Created

1. **DeepResearchIndicator.tsx** - New component that renders animated research progress
2. **Timeline.tsx** - Updated to support research steps and new event type
3. **MainAgentContent.tsx** - Updated to manage research steps state and handle WebSocket messages

## WebSocket Event Contract

### Event Type: `timeline_research_step`

Emit this event whenever a research micro-step changes status.

### Event Structure

```javascript
{
  type: 'timeline_research_step',
  eventId: 'unique-event-id',  // UUID or timestamp-based ID
  timestamp: '2026-03-29T07:30:00.000Z',  // ISO 8601 format
  researchStep: {
    id: 'searching',  // One of: 'planning', 'searching', 'reading', 'analyzing', 'synthesizing'
    action: 'searching',  // Same as id
    label: 'Searching the web',  // Display label (optional, has defaults)
    detail: 'Querying arxiv, techcrunch...',  // Optional detail text
    doneLabel: 'Found relevant results',  // Display when done (optional, has defaults)
    sources: ['arxiv.org', 'techcrunch.com'],  // Array of domain names
    status: 'active'  // One of: 'idle', 'active', 'done', 'error'
  }
}
```

## Research Step IDs

The frontend expects these specific step IDs in order:

1. **planning** - Planning research strategy
2. **searching** - Searching the web
3. **reading** - Reading sources
4. **analyzing** - Analyzing & cross-referencing
5. **synthesizing** - Synthesizing findings

## Status Flow

For each step, emit events in this sequence:

1. **Start**: `status: 'active'` - Shows spinner and bold label
2. **Progress**: `status: 'active'` with updated `sources` array - Adds source chips
3. **Complete**: `status: 'done'` - Shows green dot and done label
4. **Error** (if needed): `status: 'error'` - Shows red dot

## Integration Example

### In `researchService.js`

Add a callback parameter to emit progress:

```javascript
async conductResearch(query, onProgress) {
  // Stage 1: Planning
  onProgress({
    type: 'timeline_research_step',
    eventId: `research-${Date.now()}-1`,
    timestamp: new Date().toISOString(),
    researchStep: {
      id: 'planning',
      action: 'planning',
      status: 'active',
      detail: 'Breaking query into sub-questions...',
      sources: []
    }
  });

  const plan = await this.createResearchPlan(query);

  onProgress({
    type: 'timeline_research_step',
    eventId: `research-${Date.now()}-2`,
    timestamp: new Date().toISOString(),
    researchStep: {
      id: 'planning',
      action: 'planning',
      status: 'done',
      sources: []
    }
  });

  // Stage 2: Searching
  onProgress({
    type: 'timeline_research_step',
    eventId: `research-${Date.now()}-3`,
    timestamp: new Date().toISOString(),
    researchStep: {
      id: 'searching',
      action: 'searching',
      status: 'active',
      detail: `Executing ${searchQueries.length} searches...`,
      sources: []
    }
  });

  // As sources are found, emit incremental updates
  for (const source of sources) {
    const domain = new URL(source.url).hostname.replace('www.', '');
    onProgress({
      type: 'timeline_research_step',
      eventId: `research-${Date.now()}-${Math.random()}`,
      timestamp: new Date().toISOString(),
      researchStep: {
        id: 'searching',
        action: 'searching',
        status: 'active',
        sources: [domain]  // Frontend will merge without duplicates
      }
    });
  }

  onProgress({
    type: 'timeline_research_step',
    eventId: `research-${Date.now()}-4`,
    timestamp: new Date().toISOString(),
    researchStep: {
      id: 'searching',
      action: 'searching',
      status: 'done',
      sources: []  // All sources already sent
    }
  });

  // Stage 3: Reading
  onProgress({
    type: 'timeline_research_step',
    eventId: `research-${Date.now()}-5`,
    timestamp: new Date().toISOString(),
    researchStep: {
      id: 'reading',
      action: 'reading',
      status: 'active',
      detail: `Extracting content from ${sources.length} sources...`,
      sources: []
    }
  });

  // ... continue for analyzing and synthesizing
}
```

### In `researchAgent.js`

Wire up the progress callback to the WebSocket:

```javascript
async processQuery(query, userId, chatSessionId, sendChunk) {
  const onProgress = (progressEvent) => {
    // Send to frontend via WebSocket
    sendChunk(progressEvent);
  };

  const result = await this.researchService.conductResearch(
    query,
    onProgress
  );

  return result;
}
```

### In `mainAgent.js`

Ensure the research agent's sendChunk is properly wired:

```javascript
// When executing research agent
const researchResult = await researchAgent.processQuery(
  query,
  userId,
  chatSessionId,
  (chunk) => {
    // Forward to SSE stream
    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
  }
);
```

## Source Domain Extraction

Extract clean domain names from URLs:

```javascript
function extractDomain(url) {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// Usage
const sources = ['arxiv.org', 'techcrunch.com', 'nature.com'];
```

## Visual Behavior

### Active Step
- Spinning loader icon (colored by action type)
- Bold white label
- Gray detail text below
- Source chips appear as they're added (max 2 shown, rest as "+N more")

### Completed Step
- Small green dot
- Gray "done" label
- All source chips visible

### Error Step
- Red dot
- Red label text

## Color Coding

Each action has a specific color:
- **planning**: Purple (#7F77DD)
- **searching**: Blue (#378ADD)
- **reading**: Green (#1D9E75)
- **analyzing**: Orange (#BA7517)
- **synthesizing**: Pink (#D4537E)

## Testing

Test with this query:
```
"do a deep research on Emerging Trends in AI"
```

Expected behavior:
1. Timeline shows "Research agent is processing..."
2. DeepResearchIndicator appears below with 5 steps
3. Steps animate from idle → active → done
4. Source chips appear incrementally during searching/reading
5. All steps complete with green dots

## Troubleshooting

### Indicator doesn't appear
- Check that `agentName === 'research'` or `'deep_research'`
- Verify at least one step has `status !== 'idle'`
- Ensure WebSocket events are being sent

### Sources not showing
- Verify `sources` array contains domain strings (not full URLs)
- Check that sources are being sent with `status: 'active'`
- Frontend merges sources automatically, no need to send full array each time

### Steps not updating
- Ensure `id` matches one of the 5 expected step IDs
- Check that `status` is one of: 'idle', 'active', 'done', 'error'
- Verify events are being emitted in sequence

## Performance Notes

- Frontend handles source deduplication automatically
- No need to throttle progress events - React batches updates
- Source chips animate in with staggered delays for smooth UX
- Maximum 2 source chips shown during active state to prevent overflow
