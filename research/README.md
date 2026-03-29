# 🔬 Deep Research Agent

A production-grade Perplexity-style research system that performs multi-step web research with real-time progress updates and comprehensive synthesis.

## 🏗️ Architecture

The Deep Research Agent implements a **5-stage pipeline**:

### 1. Query Understanding
- Analyzes user query using Gemini 1.5 Flash
- Breaks query into 3-5 diverse sub-queries
- Classifies intent: `informational`, `comparative`, or `analytical`
- Generates research plan with reasoning

### 2. Multi-Search (Parallel)
- Executes multiple searches in parallel using Serper API
- Fetches top 3-5 URLs per query
- Deduplicates URLs across all searches
- Maintains source list with titles and snippets
- Limits to max 15 total URLs

### 3. Content Fetching
- Fetches HTML from each URL
- Extracts clean text (removes nav, ads, scripts)
- Limits content to ~8k chars per page
- Caches fetched content to avoid re-fetching
- Handles failures gracefully

### 4. Iterative Research Loop (Core)
- Analyzes collected content with Gemini
- Identifies missing information
- Generates follow-up queries if needed
- Performs additional searches (max 2-3 iterations)
- Stops when sufficient information is gathered

### 5. Final Synthesis
- Feeds all collected content to Gemini
- Generates comprehensive, well-structured answer
- Includes TL;DR for long answers
- Cites sources using [1], [2], etc. format
- Removes duplication
- Provides key takeaways
- Generates follow-up questions

## ⚙️ Model Configuration

```javascript
Model: gemini-1.5-flash
Temperature: 0.3 (factual)
Max Output Tokens: 8192
```

## 🎬 Thinking UI (Progress Updates)

The system emits real-time progress events via WebSocket:

1. 🔍 **Understanding** - Query analysis and planning
2. 🌐 **Searching** - Multi-source parallel search
3. 📄 **Reading** - Content fetching from URLs
4. 🧠 **Analyzing** - Deep content analysis
5. 🔁 **Deeper Research** - Follow-up queries (if needed)
6. ✍️ **Synthesizing** - Final answer generation

## 📡 API Endpoints

### POST `/api/research/agent/query`
Conduct deep research with streaming progress.

**Request:**
```json
{
  "query": "What are the best AI models for startups in 2026?",
  "socketId": "optional-socket-id"
}
```

**Response:**
```json
{
  "success": true,
  "answer": "## TL;DR\n...\n\n## Detailed Answer\n...",
  "sources": [
    { "id": 1, "title": "...", "url": "..." }
  ],
  "steps": ["Query understanding completed", "Found 12 sources", ...],
  "followUpQuestions": ["...", "...", "..."],
  "metadata": {
    "query": "...",
    "intent": "informational",
    "totalSources": 12,
    "duration": "15.3s",
    "timestamp": "2026-03-28T..."
  }
}
```

### GET `/api/research/agent/capabilities`
Get agent capabilities and features.

### GET `/api/research/agent/examples`
Get example queries by category.

### GET `/api/research/agent/status`
Check if agent is operational.

### POST `/api/research/agent/clear-cache`
Clear content cache (requires auth).

## 🚀 Usage Examples

### Informational Queries
```
What are the best AI models for startups in 2026?
Explain quantum computing and its current applications
What is the latest research on climate change solutions?
```

### Comparative Queries
```
Compare React vs Vue.js for web development
What are the differences between GPT-4 and Claude?
Python vs JavaScript for beginners
```

### Analytical Queries
```
Analyze the impact of AI on job markets
What are the pros and cons of remote work?
Evaluate the effectiveness of renewable energy
```

## 🧠 Response Format

The agent returns markdown-formatted answers with:

- **TL;DR** - Brief 2-3 sentence summary
- **Detailed Answer** - Comprehensive response with sections
- **Key Takeaways** - Bullet points of main insights
- **Source Citations** - [1], [2], etc. format
- **Follow-up Questions** - 3 relevant questions to extend research

## 🚀 Optimizations

### Caching
- Content cache prevents re-fetching same URLs
- Cache persists during agent lifetime
- Can be cleared via API endpoint

### Parallel Processing
- Multiple searches execute simultaneously
- Content fetching is parallelized
- Reduces total research time

### URL Limits
- Max 5 URLs per query
- Max 15 total URLs across all searches
- Prevents excessive API calls

### Content Limits
- 8k chars per page
- Focuses on main content
- Removes navigation, ads, scripts

## 🛑 Safety & Quality Rules

1. **No Hallucination** - Only uses fetched content
2. **Source Verification** - All claims are cited
3. **Insufficient Data Handling** - Explicitly states when data is lacking
4. **Recent Sources** - Prefers authoritative and recent sources
5. **Error Handling** - Graceful degradation on failures

## 🎯 Advanced Features

### Follow-up Questions
Automatically generates 3 relevant follow-up questions based on the research.

### Quick Summary (TL;DR)
Provides a brief summary at the top of long answers.

### Confidence Indicators
- Source count in metadata
- Research duration
- Intent classification

## 🔧 Configuration

### Environment Variables
```bash
GEMINI_AI_API_KEY=your_gemini_api_key
SERPER_API_KEY=your_serper_api_key
```

### Tunable Parameters

In `researchService.js`:
```javascript
this.maxIterations = 2;        // Max research iterations
this.maxUrlsPerQuery = 5;      // URLs per search query
this.maxTotalUrls = 15;        // Total URLs across all searches
```

## 📊 Performance

Typical research times:
- Simple queries: 10-15 seconds
- Complex queries: 20-30 seconds
- Deep research (2 iterations): 30-45 seconds

## 🐛 Error Handling

The agent handles:
- Missing API keys
- Search failures
- Content fetch failures
- Parsing errors
- Timeout issues
- Rate limiting

All errors are logged and returned with user-friendly messages.

## 🔌 WebSocket Events

### Client → Server
```javascript
// Connect with socket ID in request
{
  "query": "...",
  "socketId": socket.id
}
```

### Server → Client
```javascript
socket.on('research:progress', (data) => {
  // data.step: 'planning' | 'searching' | 'fetching' | 'analyzing' | 'synthesizing'
  // data.message: User-friendly progress message
  // data.progress: 0-100 percentage
});
```

## 📝 Example Integration

```javascript
// Frontend example
const handleResearch = async (query) => {
  const response = await axios.post('/api/research/agent/query', {
    query,
    socketId: socket.id
  });
  
  return response.data;
};

// Listen for progress
socket.on('research:progress', (update) => {
  console.log(update.message); // "🔍 Understanding your question..."
  updateProgressBar(update.progress); // 0-100
});
```

## 🎨 Frontend Component

A complete React TypeScript component is provided in:
```
PolarisAI-Frontend/src/components/research/DeepResearch.tsx
```

Features:
- Real-time progress visualization
- Step-by-step progress indicators
- Markdown rendering for answers
- Source citations with links
- Follow-up question buttons
- Metadata display

## 🧪 Testing

Test the agent:
```bash
node PolarisAI-Backend/research/test-research.js
```

## 📚 Dependencies

```json
{
  "@google/generative-ai": "^0.21.0",
  "axios": "^1.7.9",
  "express": "^4.21.2"
}
```

## 🔐 Security

- Requires authentication for all endpoints
- Rate limiting recommended
- Content sanitization for fetched HTML
- URL validation before fetching

## 🌟 Best Practices

1. **Be Specific** - More specific queries yield better results
2. **Current Topics** - Works best with recent information
3. **Follow-ups** - Use generated follow-up questions to dive deeper
4. **Cache Management** - Clear cache periodically for fresh results
5. **Error Handling** - Always handle potential failures gracefully

## 📈 Future Enhancements

- [ ] Confidence scoring for answers
- [ ] Multi-language support
- [ ] PDF content extraction
- [ ] Academic paper parsing
- [ ] Image analysis integration
- [ ] Video transcript analysis
- [ ] Redis caching for distributed systems
- [ ] Rate limiting per user
- [ ] Research history tracking

## 🤝 Contributing

When extending the research agent:
1. Maintain the 5-stage pipeline structure
2. Add progress updates for new stages
3. Update documentation
4. Add tests for new features
5. Follow existing code style

## 📄 License

Part of Polaris AI Backend System
