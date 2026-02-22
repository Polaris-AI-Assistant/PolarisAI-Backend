# Web Search Agent - Integration Guide

## ✅ Implementation Complete

The Web Search Agent has been successfully implemented and integrated into your PolarisAI backend system.

## 🎯 What's Working

All tests passed successfully:
- ✅ General web search
- ✅ News search  
- ✅ Image search
- ✅ Error handling
- ✅ Main agent integration
- ✅ API endpoints
- ✅ Authentication

## 🚀 How to Use

### 1. Direct API Calls

**Web Search:**
```bash
curl -X POST http://localhost:3000/api/websearch/agent/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "query": "search for latest AI developments"
  }'
```

**Check Status:**
```bash
curl http://localhost:3000/api/websearch/agent/status
```

**Get Examples:**
```bash
curl http://localhost:3000/api/websearch/agent/examples
```

### 2. Through Main Agent

The web search agent is automatically available through the main coordinator:

```bash
curl -X POST http://localhost:3000/api/agent/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "query": "search the web for Python tutorials"
  }'
```

### 3. Multi-Agent Workflows

Combine web search with other agents:

```bash
# Search and create document
curl -X POST http://localhost:3000/api/agent/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "query": "search for AI news and create a document summarizing the top 3 articles"
  }'
```

```bash
# Search and send email
curl -X POST http://localhost:3000/api/agent/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "query": "search for latest tech news and email me a summary"
  }'
```

## 📋 Available Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/websearch/agent/query` | POST | Process natural language search queries |
| `/api/websearch/agent/examples` | GET | Get example queries |
| `/api/websearch/agent/capabilities` | GET | Get agent capabilities |
| `/api/websearch/agent/status` | GET | Check agent status |

## 🔧 Configuration

The agent uses these environment variables (already configured):

```env
SERPER_API_KEY=aca02580c9703f4f199a5d820be70370ce0deb3c
OPENAI_API_KEY=sk-proj-...
```

## 📝 Example Queries

### General Search
- "Search for information about quantum computing"
- "Find the best restaurants in Paris"
- "What is machine learning?"
- "Search for Python programming tutorials"

### News Search
- "Find latest news about SpaceX"
- "Search for recent AI developments"
- "What's happening in tech today?"
- "Find breaking news"

### Image Search
- "Find images of the Eiffel Tower"
- "Search for pictures of golden retrievers"
- "Show me photos of modern architecture"

### Multi-Agent Queries
- "Search for AI tutorials and create a document with the top 5"
- "Find news about technology and send me an email summary"
- "Search for flight prices to Tokyo and create a calendar event"

## 🧪 Testing

Run the test suite:
```bash
cd PolarisAI-Backend
node websearch/test-websearch.js
```

Expected output:
```
🧪 Testing Web Search Agent
============================================================
✅ SERPER_API_KEY found
✅ Web search successful
✅ News search successful
✅ Image search successful
✅ Error handling works correctly
🎉 All tests completed!
```

## 🎨 Frontend Integration

### React/Next.js Example

```javascript
// Search function
async function searchWeb(query) {
  const response = await fetch('/api/websearch/agent/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ query })
  });
  
  const data = await response.json();
  return data;
}

// Usage
const result = await searchWeb("search for latest AI news");
console.log(result.response); // AI-formatted response
console.log(result.raw_results); // Raw search results
```

### Through Main Agent

```javascript
// Use main agent for automatic routing
async function askAgent(query) {
  const response = await fetch('/api/agent/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ query })
  });
  
  return await response.json();
}

// The main agent will automatically use web search when needed
const result = await askAgent("search for Python tutorials and create a document");
```

## 📊 Response Format

```json
{
  "success": true,
  "response": "Here are the latest AI developments I found...",
  "query": "search for latest AI developments",
  "tools_used": [
    {
      "name": "searchWeb",
      "arguments": {
        "query": "latest AI developments",
        "num": 10
      }
    }
  ],
  "raw_results": [
    {
      "success": true,
      "data": {
        "organic": [...],
        "answerBox": {...},
        "knowledgeGraph": {...},
        "relatedSearches": [...]
      }
    }
  ],
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

## 🔍 Features

- **Natural Language Processing**: Understands conversational queries
- **Multi-language Support**: Responds in the same language as the query
- **Rich Results**: Includes answer boxes, knowledge graphs, related searches
- **Error Handling**: User-friendly error messages
- **Conversation History**: Maintains context across queries
- **Integration**: Works seamlessly with other agents

## 🛠️ Troubleshooting

### Agent Not Working

1. Check API key:
```bash
grep SERPER_API_KEY PolarisAI-Backend/.env
```

2. Check status:
```bash
curl http://localhost:3000/api/websearch/agent/status
```

3. Check logs:
```bash
# Look for [WebSearchAgent] or [WebSearchService] in server logs
```

### Rate Limiting

If you hit rate limits:
- Wait a few minutes before retrying
- Consider upgrading your Serper API plan
- Implement caching for frequently searched queries

### Empty Results

If searches return no results:
- Check your query is specific enough
- Try different keywords
- Verify internet connectivity
- Check Serper API status

## 📚 Documentation

- [README.md](./README.md) - Full documentation
- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - Technical details
- [test-websearch.js](./test-websearch.js) - Test suite

## 🎉 Next Steps

1. **Start the server**: `npm start` or `node index.js`
2. **Test the endpoints**: Use the curl commands above
3. **Integrate with frontend**: Use the React examples
4. **Monitor usage**: Check logs and status endpoint
5. **Customize**: Modify prompts or add features as needed

## 💡 Tips

- Use specific queries for better results
- Combine with other agents for powerful workflows
- Check the examples endpoint for query ideas
- Monitor the status endpoint for health checks
- Use conversation history for context-aware searches

## 🤝 Support

If you encounter issues:
1. Check the test suite: `node websearch/test-websearch.js`
2. Verify environment variables are set
3. Check server logs for errors
4. Review the documentation files

---

**Status**: ✅ Ready for Production

**Last Updated**: 2025-01-01

**Version**: 1.0.0
