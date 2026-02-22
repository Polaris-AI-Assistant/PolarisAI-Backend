# Web Search Agent

An intelligent AI agent that performs web searches using the Serper API. Supports general web search, news search, and image search with natural language processing.

## Features

- **General Web Search**: Find information, websites, and articles
- **News Search**: Search for recent news articles and current events
- **Image Search**: Find images and visual content
- **Natural Language Processing**: Understands conversational queries
- **Multi-language Support**: Responds in the same language as the query
- **Rich Results**: Includes answer boxes, knowledge graphs, and related searches

## API Endpoints

### Query Endpoint
```
POST /api/websearch/agent/query
```

**Request Body:**
```json
{
  "query": "search for latest AI news",
  "conversationHistory": [] // optional
}
```

**Response:**
```json
{
  "success": true,
  "response": "Here are the latest AI news...",
  "query": "search for latest AI news",
  "tools_used": [
    {
      "name": "searchNews",
      "arguments": {
        "query": "latest AI news",
        "num": 10
      }
    }
  ],
  "raw_results": [...],
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

### Examples Endpoint
```
GET /api/websearch/agent/examples
```

Returns example queries for different search types.

### Capabilities Endpoint
```
GET /api/websearch/agent/capabilities
```

Returns detailed information about the agent's capabilities.

### Status Endpoint
```
GET /api/websearch/agent/status
```

Check if the web search agent is operational.

## Environment Variables

```env
SERPER_API_KEY=your_serper_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
```

## Usage Examples

### General Web Search
```
"Search for information about artificial intelligence"
"Find the best restaurants in New York"
"What is quantum computing?"
```

### News Search
```
"Find latest news about technology"
"Search for recent news about SpaceX"
"What's the latest news on AI developments?"
```

### Image Search
```
"Find images of the Eiffel Tower"
"Search for pictures of golden retrievers"
"Show me images of modern architecture"
```

## Integration with Main Agent

The web search agent is automatically integrated with the main coordinator agent. Users can ask questions that require web searches, and the main agent will route them appropriately.

Example:
```
"Search for the latest news about AI and create a document summarizing it"
```

This will:
1. Use the web search agent to find news
2. Use the docs agent to create a summary document

## Files

- `webSearchService.js` - Service layer for Serper API
- `webSearchAgent.js` - Standalone agent implementation
- `webSearchAgentController.js` - HTTP endpoints
- `webSearchAgentMultiStep.js` - Multi-step execution version for main agent integration

## Error Handling

The agent handles various error scenarios:
- Missing API key
- Rate limiting
- Network timeouts
- Invalid queries
- API errors

All errors are returned with user-friendly messages.

## Testing

Test the agent using curl:

```bash
# Test web search
curl -X POST http://localhost:3000/api/websearch/agent/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"query": "search for latest AI news"}'

# Check status
curl http://localhost:3000/api/websearch/agent/status
```

## Notes

- Requires active Serper API subscription
- Search results depend on Google's index
- Subject to Serper API rate limits
- Supports localized and multi-language searches
