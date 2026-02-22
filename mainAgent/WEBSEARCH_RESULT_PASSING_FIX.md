# Web Search Result Passing Fix

## Problem Statement

When executing multi-intent queries like "Search for AI news and email the top 3 articles", the Gmail agent was calling `listMessages` instead of `sendEmail` because it didn't have access to the websearch results.

### Example Issue

**Query:** "Search for the latest AI news and email the top 3 articles to john@example.com"

**What Happened:**
1. ✅ Websearch agent executed → Found AI news articles
2. ✅ Gmail agent called (sequential execution working)
3. ❌ Gmail agent called `listMessages` trying to find "AI news" in inbox
4. ❌ Gmail agent never called `sendEmail`

**Why:**
The Gmail agent received the query "email the top 3 AI news articles to john@example.com" but had NO CONTEXT about what the AI news articles were. It didn't know:
- What articles were found
- Their titles, links, or content
- That it should use results from the previous agent

So it tried to search for "AI news" in the user's Gmail inbox instead!

## Root Cause

The `_enrichQueryWithPreviousResults()` method only enriched queries with **links** from previous results (Google Meet, Forms, Docs, etc.). It didn't handle **websearch results** which contain articles with titles, snippets, and links - not just simple URLs.

```javascript
// OLD CODE - Only extracted links
for (const [prevAgent, prevResult] of Object.entries(previousResults)) {
  // Extract links from raw_results
  if (prevResult.raw_results && Array.isArray(prevResult.raw_results)) {
    // ... extract Google Meet, Forms, Docs links
  }
}

// If no links found, return original query (no enrichment)
if (collectedData.length === 0) {
  return agentQuery; // ❌ Websearch results ignored!
}
```

## Solution

Enhanced `_enrichQueryWithPreviousResults()` to detect and pass websearch results to email agents.

### Key Changes

1. **Detect Websearch Results**
```javascript
// NEW: Handle websearch results
if (prevAgent === 'websearch') {
  console.log(`[MainAgent] 📰 Found websearch results to include in email`);
  
  // Extract summary
  if (prevResult.summary) {
    websearchResults = {
      type: 'websearch',
      summary: prevResult.summary
    };
  }
  
  // Extract articles
  if (prevResult.results) {
    const toolResults = Object.values(prevResult.results);
    for (const toolResult of toolResults) {
      if (toolResult.topNews) {
        websearchResults.articles = toolResult.topNews.slice(0, 3);
      }
    }
  }
}
```

2. **Format Articles for Email**
```javascript
if (websearchResults && websearchResults.articles) {
  enrichmentText += `Top Articles:\n`;
  websearchResults.articles.forEach((article, index) => {
    enrichmentText += `${index + 1}. ${article.title}\n`;
    if (article.snippet) enrichmentText += `   ${article.snippet}\n`;
    if (article.link) enrichmentText += `   Link: ${article.link}\n`;
    if (article.source) enrichmentText += `   Source: ${article.source}\n`;
    if (article.date) enrichmentText += `   Date: ${article.date}\n`;
    enrichmentText += `\n`;
  });
}
```

3. **Pass to Email Agent**
```javascript
const enrichedQuery = `${agentQuery}

IMPORTANT CONTEXT FROM PREVIOUS ACTION:
${enrichmentText}
Include the information above in the email body with proper formatting.`;
```

## How It Works Now

### Execution Flow

```
Query: "Search for AI news and email the top 3 to john@example.com"
    ↓
1. Websearch agent executes
   - Searches for "latest AI news"
   - Gets 10 news articles
   - Returns: {
       success: true,
       summary: "Recent AI news...",
       results: {
         topNews: [
           { title: "...", snippet: "...", link: "...", source: "...", date: "..." },
           { title: "...", snippet: "...", link: "...", source: "...", date: "..." },
           { title: "...", snippet: "...", link: "...", source: "...", date: "..." }
         ]
       }
     }
    ↓
2. _enrichQueryWithPreviousResults() called
   - Detects websearch results
   - Extracts top 3 articles
   - Formats them nicely
   - Enriches Gmail query with article details
    ↓
3. Gmail agent receives enriched query:
   "email the top 3 AI news articles to john@example.com
   
   IMPORTANT CONTEXT FROM PREVIOUS ACTION:
   WEB SEARCH RESULTS TO INCLUDE IN EMAIL:
   
   Top Articles:
   1. Artificial Intelligence (AI) News Updates...
      Stay ahead of the curve with the latest AI news...
      Link: https://...
      Source: The Economic Times
      Date: 4 hours ago
   
   2. AI regulations are needed...
      To safeguard ourselves, let's acknowledge...
      Link: https://...
      Source: San Antonio Express-News
      Date: 2 hours ago
   
   3. Global/India: AI Impact Summit...
      Responding at the conclusion of the five-day...
      Link: https://...
      Source: Amnesty International
      Date: 1 day ago"
    ↓
4. Gmail agent now knows:
   - What the articles are
   - Their titles, snippets, links
   - That it should send an email (not search inbox)
    ↓
5. Gmail agent calls sendEmail ✅
   - Creates email with article details
   - Sends to john@example.com
    ↓
6. Success! ✅
```

## Implementation Details

### Files Modified

- ✅ `mainAgent/mainAgent.js` - Enhanced `_enrichQueryWithPreviousResults()`

### Code Changes

#### Before
```javascript
async _enrichQueryWithPreviousResults(agentQuery, agentName, previousResults, userId) {
  // Only handled links from Google Meet, Forms, Docs, etc.
  // Ignored websearch results
  
  if (collectedData.length === 0) {
    return agentQuery; // No enrichment
  }
  
  // ... enrich with links only
}
```

#### After
```javascript
async _enrichQueryWithPreviousResults(agentQuery, agentName, previousResults, userId) {
  const collectedData = [];
  let websearchResults = null;
  
  for (const [prevAgent, prevResult] of Object.entries(previousResults)) {
    // NEW: Handle websearch results
    if (prevAgent === 'websearch') {
      websearchResults = {
        summary: prevResult.summary,
        articles: extractTopArticles(prevResult)
      };
      continue;
    }
    
    // Existing: Handle links from other agents
    // ... extract Google Meet, Forms, Docs links
  }
  
  // NEW: Enrich even if no links (but has websearch results)
  if (collectedData.length === 0 && !websearchResults) {
    return agentQuery;
  }
  
  // Build enrichment with both links AND websearch results
  let enrichmentText = '';
  
  if (collectedData.length > 0) {
    enrichmentText += formatLinks(collectedData);
  }
  
  if (websearchResults) {
    enrichmentText += formatWebsearchResults(websearchResults);
  }
  
  return enrichedQuery;
}
```

### Article Extraction Logic

```javascript
// Extract articles from websearch results
if (prevResult.results) {
  const toolResults = Object.values(prevResult.results);
  for (const toolResult of toolResults) {
    // Check for news articles
    if (toolResult.topNews && Array.isArray(toolResult.topNews)) {
      websearchResults.articles = toolResult.topNews.slice(0, 3);
    }
    // Check for general search results
    else if (toolResult.topResults && Array.isArray(toolResult.topResults)) {
      websearchResults.articles = toolResult.topResults.slice(0, 3);
    }
  }
}
```

## Testing

### Test Case 1: Web Search + Email

**Query:** "Search for the latest AI news and email the top 3 articles to john@example.com"

**Expected Behavior:**
1. Websearch agent finds AI news
2. Gmail agent receives enriched query with article details
3. Gmail agent calls `sendEmail` (NOT `listMessages`)
4. Email sent with formatted article list

**Verification:**
```
[MainAgent] 📰 Found websearch results to include in email
[MainAgent] ✅ Enriched gmail query with 0 link(s) and websearch results
[GmailAgent] 📞 Calling tool: sendEmail
```

### Test Case 2: Web Search + Outlook Email

**Query:** "Find recent tech conferences and send details via outlook to jane@example.com"

**Expected Behavior:**
1. Websearch agent finds tech conferences
2. Microsoft agent receives enriched query with conference details
3. Microsoft agent calls `microsoft_sendEmail`
4. Email sent via Outlook

### Test Case 3: Form + Email (Existing Functionality)

**Query:** "Create a feedback form and email it to john@example.com"

**Expected Behavior:**
1. Forms agent creates form
2. Gmail agent receives enriched query with form link
3. Gmail agent calls `sendEmail` with form link
4. Email sent with form link

**Verification:** Should still work (no regression)

## Edge Cases

### 1. No Articles Found

**Scenario:** Websearch returns no results

**Behavior:**
```javascript
if (!websearchResults || !websearchResults.articles) {
  // No enrichment for websearch
  // Gmail agent gets original query
}
```

**Result:** Gmail agent will ask user for clarification

### 2. Multiple Previous Agents

**Scenario:** "Search for AI news, create a doc, and email both"

**Behavior:**
```javascript
// Collect from all previous agents
- websearchResults: AI news articles
- collectedData: Google Doc link

// Enrich with BOTH
enrichmentText = formatLinks(collectedData) + formatWebsearchResults(websearchResults);
```

**Result:** Email includes both doc link and news articles

### 3. Websearch Summary Only (No Articles)

**Scenario:** Websearch returns summary but no article list

**Behavior:**
```javascript
if (websearchResults.summary) {
  enrichmentText += `Summary: ${websearchResults.summary}\n\n`;
}
```

**Result:** Email includes summary text

## Benefits

1. ✅ **Correct Tool Selection**: Gmail agent now calls `sendEmail` instead of `listMessages`
2. ✅ **Complete Information**: Email includes actual article details, not placeholders
3. ✅ **Better Formatting**: Articles formatted nicely with titles, snippets, links
4. ✅ **Works with Any Email Agent**: Supports both Gmail and Microsoft Outlook
5. ✅ **No Regression**: Existing link-passing functionality still works

## Comparison

### Before Fix

```
Gmail Query: "email the top 3 AI news articles to john@example.com"

Gmail Agent Thinking:
- "I need to find AI news articles"
- "Let me search the user's inbox for 'AI news'"
- Calls: listMessages(query="AI news")
- ❌ Wrong tool!
```

### After Fix

```
Gmail Query: "email the top 3 AI news articles to john@example.com

IMPORTANT CONTEXT FROM PREVIOUS ACTION:
WEB SEARCH RESULTS TO INCLUDE IN EMAIL:

Top Articles:
1. Artificial Intelligence (AI) News Updates...
   Link: https://...
   Source: The Economic Times
   
2. AI regulations are needed...
   Link: https://...
   Source: San Antonio Express-News
   
3. Global/India: AI Impact Summit...
   Link: https://...
   Source: Amnesty International"

Gmail Agent Thinking:
- "I have the article details from previous search"
- "I need to send an email with these articles"
- Calls: sendEmail(to="john@example.com", body="Here are the top 3 AI news articles...")
- ✅ Correct tool!
```

## Future Enhancements

### 1. Support More Result Types

- Maps results (places, directions)
- Flight results (flight options)
- Image results (image URLs)

### 2. Smarter Formatting

- HTML email formatting
- Embedded images
- Rich text formatting

### 3. Result Filtering

- Let user specify which results to include
- "Email the first 5 results"
- "Email only results from last week"

### 4. Result Transformation

- Summarize long articles
- Translate to different language
- Extract key points

## Troubleshooting

### Issue: Gmail Still Calling listMessages

**Possible Causes:**
1. Websearch results not being extracted
2. Enrichment not happening
3. Gmail agent not seeing enriched query

**Solutions:**
1. Check logs for "Found websearch results to include in email"
2. Verify `prevResult.results` contains articles
3. Check enriched query in logs

### Issue: Email Missing Article Details

**Possible Causes:**
1. Articles not formatted correctly
2. Gmail agent not including them in email body

**Solutions:**
1. Verify enrichment text includes article details
2. Check Gmail agent's system prompt emphasizes using provided context
3. Review generated email content

### Issue: Wrong Number of Articles

**Possible Causes:**
1. Slice(0, 3) not working correctly
2. Articles array empty

**Solutions:**
1. Verify `topNews` or `topResults` has articles
2. Check slice logic
3. Add fallback for empty arrays

## Rollback Plan

If issues arise:

**Quick Fix:** Disable websearch enrichment
```javascript
// In _enrichQueryWithPreviousResults
if (prevAgent === 'websearch') {
  continue; // Skip websearch enrichment
}
```

**Full Rollback:**
```bash
git revert <commit-hash>
```

## Success Criteria

✅ **Correct Tool Selection**
- Gmail agent calls `sendEmail` (not `listMessages`)
- Microsoft agent calls `microsoft_sendEmail`

✅ **Complete Information**
- Email includes article titles
- Email includes article snippets
- Email includes article links
- Email includes sources and dates

✅ **Proper Formatting**
- Articles numbered (1, 2, 3)
- Each article has all details
- Easy to read

✅ **No Regression**
- Existing link-passing still works
- Form + Email still works
- Doc + Email still works

## Conclusion

This fix enables websearch results to be properly passed to email agents in multi-intent queries. The Gmail/Microsoft agent now receives complete article information and can send properly formatted emails with the search results.

The key insight is that websearch results are different from other agent results - they don't produce simple links, but rather structured data (articles) that need to be formatted and passed to the next agent.
