# Intent Classification - Testing Guide

## Overview

This guide explains how to test the LLM-based intent classification system to ensure it correctly classifies user queries.

## Prerequisites

- Backend server running
- `OPENAI_API_KEY` environment variable set
- Access to the `/agent/query/stream` endpoint

## Test Categories

### 1. ACTIONABLE Queries (Should Route to Agents)

These queries should be classified as ACTIONABLE and route to appropriate agents.

#### Test Cases

```bash
# Test 1: Simple document creation
curl -X POST http://localhost:3000/agent/query/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "query": "create a google docs titled Project Plan"
  }'

# Expected: ACTIONABLE, routes to docs agent
# Console: [IntentClassifier] ✅ Classification result: { type: 'actionable', ... }
```

```bash
# Test 2: Email sending
curl -X POST http://localhost:3000/agent/query/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "query": "send an email to john@example.com with the project details"
  }'

# Expected: ACTIONABLE, routes to gmail agent
```

```bash
# Test 3: Meeting scheduling
curl -X POST http://localhost:3000/agent/query/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "query": "schedule a meeting for tomorrow at 2 PM"
  }'

# Expected: ACTIONABLE, routes to calendar agent
```

```bash
# Test 4: Edge case - "Help me create"
curl -X POST http://localhost:3000/agent/query/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "query": "help me create a google form for customer feedback"
  }'

# Expected: ACTIONABLE (not ADVISORY!)
# This is the key test case that was failing before
```

```bash
# Test 5: Edge case - "Guide me through"
curl -X POST http://localhost:3000/agent/query/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "query": "guide me through sending an email to the team"
  }'

# Expected: ACTIONABLE (not ADVISORY!)
# Another key test case that was failing before
```

```bash
# Test 6: Flight search
curl -X POST http://localhost:3000/agent/query/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "query": "search for flights to NYC next week"
  }'

# Expected: ACTIONABLE, routes to flights agent
```

### 2. ADVISORY Queries (Should NOT Route to Agents)

These queries should be classified as ADVISORY and provide guidance instead.

#### Test Cases

```bash
# Test 1: How-to question
curl -X POST http://localhost:3000/agent/query/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "query": "How do I create a google docs?"
  }'

# Expected: ADVISORY, no agents called
```

```bash
# Test 2: Best practices question
curl -X POST http://localhost:3000/agent/query/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "query": "What is the best way to send emails?"
  }'

# Expected: ADVISORY, no agents called
```

```bash
# Test 3: Decision question
curl -X POST http://localhost:3000/agent/query/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "query": "Should I schedule the meeting now or later?"
  }'

# Expected: ADVISORY, no agents called
```

```bash
# Test 4: Advice request
curl -X POST http://localhost:3000/agent/query/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "query": "What are best practices for project planning?"
  }'

# Expected: ADVISORY, no agents called
```

### 3. CONVERSATIONAL Queries (Should NOT Route to Agents)

These queries should be classified as CONVERSATIONAL and answered from context.

#### Test Cases

```bash
# Test 1: Name question
curl -X POST http://localhost:3000/agent/query/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "query": "What is my name?"
  }'

# Expected: CONVERSATIONAL, no agents called
```

```bash
# Test 2: Past conversation question
curl -X POST http://localhost:3000/agent/query/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "query": "What did I tell you about the project?"
  }'

# Expected: CONVERSATIONAL, no agents called
```

```bash
# Test 3: Reminder request
curl -X POST http://localhost:3000/agent/query/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "query": "Remind me what we discussed"
  }'

# Expected: CONVERSATIONAL, no agents called
```

```bash
# Test 4: Past actions question
curl -X POST http://localhost:3000/agent/query/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "query": "What flights did I search for?"
  }'

# Expected: CONVERSATIONAL, no agents called
```

### 4. FILE_GENERATION Queries (Should NOT Route to Agents)

These queries should be classified as FILE_GENERATION and generate files.

#### Test Cases

```bash
# Test 1: PDF generation
curl -X POST http://localhost:3000/agent/query/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "query": "Generate a PDF of the project plan"
  }'

# Expected: FILE_GENERATION, no agents called
```

```bash
# Test 2: PDF export
curl -X POST http://localhost:3000/agent/query/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "query": "Export this as a PDF"
  }'

# Expected: FILE_GENERATION, no agents called
```

```bash
# Test 3: Text file creation
curl -X POST http://localhost:3000/agent/query/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "query": "Create a text file with the summary"
  }'

# Expected: FILE_GENERATION, no agents called
```

## Checking Results

### Console Logs

Look for these log messages to verify classification:

```
[IntentClassifier] 🤖 Classifying intent for query: "..."
[IntentClassifier] ✅ Classification result: {
  type: 'actionable' | 'advisory' | 'conversational' | 'file_generation',
  confidence: 0.0-1.0,
  reasoning: "...",
  actionType: "...",
  shouldUseAgents: true | false
}
```

### Response Stream

The response will include:
- `analysis` event with agents that will be used
- `status` events showing progress
- `content` event with the final response

### Verification Checklist

For each test case, verify:

- [ ] Classification type is correct
- [ ] Confidence score is high (>0.8)
- [ ] Reasoning makes sense
- [ ] Agents are routed correctly (or not routed if advisory/conversational)
- [ ] Response is appropriate for the query

## Automated Testing

### Test Script

Create a file `test-intent-classification.js`:

```javascript
const axios = require('axios');

const testCases = [
  {
    query: "create a google docs titled Project Plan",
    expectedType: 'actionable',
    category: 'ACTIONABLE'
  },
  {
    query: "How do I create a google docs?",
    expectedType: 'advisory',
    category: 'ADVISORY'
  },
  {
    query: "What is my name?",
    expectedType: 'conversational',
    category: 'CONVERSATIONAL'
  },
  {
    query: "Generate a PDF of the project plan",
    expectedType: 'file_generation',
    category: 'FILE_GENERATION'
  },
  {
    query: "help me create a document",
    expectedType: 'actionable',
    category: 'EDGE_CASE'
  },
  {
    query: "guide me through sending an email",
    expectedType: 'actionable',
    category: 'EDGE_CASE'
  }
];

async function runTests() {
  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    try {
      const response = await axios.post(
        'http://localhost:3000/agent/query/stream',
        { query: testCase.query },
        { headers: { 'Authorization': 'Bearer YOUR_TOKEN' } }
      );

      // Parse SSE response to get classification
      const lines = response.data.split('\n');
      const analysisLine = lines.find(l => l.startsWith('data: ') && l.includes('analysis'));
      
      if (analysisLine) {
        const data = JSON.parse(analysisLine.substring(6));
        const actualType = data.type;

        if (actualType === testCase.expectedType) {
          console.log(`✅ PASS: ${testCase.category} - "${testCase.query}"`);
          passed++;
        } else {
          console.log(`❌ FAIL: ${testCase.category} - "${testCase.query}"`);
          console.log(`   Expected: ${testCase.expectedType}, Got: ${actualType}`);
          failed++;
        }
      }
    } catch (error) {
      console.log(`❌ ERROR: ${testCase.category} - "${testCase.query}"`);
      console.log(`   ${error.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
```

Run with:
```bash
node test-intent-classification.js
```

## Performance Testing

### Latency Measurement

Add timing to your test script:

```javascript
const startTime = Date.now();
const response = await axios.post(...);
const endTime = Date.now();
const latency = endTime - startTime;

console.log(`Latency: ${latency}ms`);
```

Expected latencies:
- Quick checks: 1-5ms
- LLM classification: 200-500ms
- Total: 200-500ms for ambiguous queries

### Load Testing

Test with multiple concurrent requests:

```bash
# Using Apache Bench
ab -n 100 -c 10 -p query.json http://localhost:3000/agent/query/stream

# Using wrk
wrk -t4 -c100 -d30s http://localhost:3000/agent/query/stream
```

## Troubleshooting

### Issue: Classification is slow

**Check:**
- Is LLM API responding normally?
- Are there network issues?
- Is the model overloaded?

**Solution:**
- Check OpenAI API status
- Verify network connectivity
- Consider implementing caching

### Issue: Classification is incorrect

**Check:**
- Is conversation history being passed?
- Are there any error messages in logs?
- Is the query ambiguous?

**Solution:**
- Review LLM reasoning in logs
- Add more context to the query
- Check if quick checks are interfering

### Issue: LLM API errors

**Check:**
- Is `OPENAI_API_KEY` set?
- Is the API key valid?
- Are rate limits exceeded?

**Solution:**
- Verify environment variables
- Check API key validity
- Implement exponential backoff retry

## Success Criteria

✅ All ACTIONABLE queries route to agents
✅ All ADVISORY queries do NOT route to agents
✅ All CONVERSATIONAL queries do NOT route to agents
✅ All FILE_GENERATION queries do NOT route to agents
✅ Edge cases like "help me create" are classified correctly
✅ Latency is acceptable (<1 second)
✅ Confidence scores are high (>0.8)
✅ No LLM API errors

## Next Steps

1. Run all test cases
2. Verify results match expectations
3. Check console logs for classification details
4. Monitor performance metrics
5. Gather feedback from users
6. Iterate and improve as needed
