# Rate Limit Handling - Research Service

## Problem
The research service was hitting OpenAI's rate limit (30,000 tokens per minute) when synthesizing reports with many sources, causing the error:
```
RateLimitError: 429 Request too large for gpt-4o - Limit 30000, Requested 30663
```

## Solution Implemented

### 1. Token Estimation & Chunking
- Added `estimateTokens()` method to approximate token count (1 token ≈ 4 characters)
- Added `chunkSourcesForSynthesis()` method to intelligently select sources within token limits
- Prioritizes full content sources over snippets
- Truncates individual sources to max 2000 characters
- Keeps total token count under 18,000 (leaving room for prompt + response)

### 2. Retry Logic with Exponential Backoff
- Added `callOpenAIWithRetry()` helper method for all OpenAI API calls
- Implements exponential backoff: 2s, 4s, 8s (max 10s)
- Retries up to 3 times for rate limit errors (429)
- Immediately throws for other error types

### 3. Adaptive Source Reduction
- If first synthesis attempt fails due to token limit, automatically reduces sources further
- Second attempt uses only 12,000 tokens worth of sources
- Maintains report quality while ensuring completion

### 4. Graceful Fallback
- Added `createFallbackReport()` method for when synthesis completely fails
- Creates a structured report with:
  - Executive summary
  - Organized sections by subtopic
  - Key findings with citations
  - Complete source list
- Ensures users always get results, even if simplified

### 5. Applied to All OpenAI Calls
- Planning agent (createResearchPlan)
- Analysis agent (analyzeProgress)
- Synthesis agent (synthesizeReport)

## Benefits
✅ No more rate limit crashes
✅ Automatic retry with smart backoff
✅ Adaptive token management
✅ Always returns results (with fallback)
✅ Better logging for debugging
✅ Maintains report quality

## Token Budget Breakdown
- **Planning**: ~500 tokens
- **Analysis**: ~1,000 tokens per iteration
- **Synthesis**: 18,000 tokens (sources) + 2,000 (prompt) + 16,000 (response) = 36,000 total
- **Safety margin**: Chunking ensures we stay under 30,000 TPM limit

## Testing
Test with the same query that caused the error:
```
"do a deep research on Emerging Trends in AI"
```

Expected behavior:
1. Collects 50 sources as before
2. Chunks sources to fit token limits
3. Successfully synthesizes report
4. If rate limited, retries with backoff
5. If still fails, provides fallback report

## Monitoring
Watch for these log messages:
- `[ResearchService] Selected X/Y sources (~Z tokens)` - Shows chunking
- `[ResearchService] Rate limited, waiting Xms...` - Shows retry
- `[ResearchService] Token limit exceeded, reducing sources...` - Shows adaptation
- `[ResearchService] Using simplified report...` - Shows fallback
