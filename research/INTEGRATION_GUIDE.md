# 🔌 Deep Research Agent - Integration Guide

Complete guide for integrating the Deep Research Agent into your application.

## 📋 Table of Contents

1. [Backend Setup](#backend-setup)
2. [Frontend Integration](#frontend-integration)
3. [WebSocket Configuration](#websocket-configuration)
4. [API Usage](#api-usage)
5. [Error Handling](#error-handling)
6. [Best Practices](#best-practices)

---

## 🔧 Backend Setup

### 1. Environment Variables

Add to your `.env` file:

```bash
# Gemini AI API Key (required)
GEMINI_AI_API_KEY=your_gemini_api_key_here

# Serper API Key (required)
SERPER_API_KEY=your_serper_api_key_here
```

### 2. Install Dependencies

```bash
npm install @google/generative-ai axios
```

### 3. Register Routes

In `index.js`:

```javascript
// Import research routes
const researchAgentRoutes = require('./research/researchController');

// Register routes
app.use('/api/research', researchAgentRoutes);
```

### 4. Verify Installation

Check agent status:

```bash
curl http://localhost:3000/api/research/agent/status
```

Expected response:
```json
{
  "success": true,
  "status": "operational",
  "checks": {
    "gemini_api": "configured",
    "serper_api": "configured"
  },
  "message": "Deep Research Agent is ready"
}
```

---

## 🎨 Frontend Integration

### 1. Install Dependencies

```bash
npm install axios react-markdown socket.io-client
```

### 2. Import Component

```javascript
import DeepResearch from './components/research/DeepResearch';

function App() {
  return (
    <div>
      <DeepResearch />
    </div>
  );
}
```

### 3. Socket Context Setup

Ensure you have a Socket context provider:

```javascript
// contexts/SocketContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const newSocket = io(process.env.REACT_APP_API_URL || 'http://localhost:3000');
    setSocket(newSocket);

    return () => newSocket.close();
  }, []);

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
};
```

### 4. Wrap App with Provider

```javascript
// index.js or App.js
import { SocketProvider } from './contexts/SocketContext';

ReactDOM.render(
  <SocketProvider>
    <App />
  </SocketProvider>,
  document.getElementById('root')
);
```

---

## 📡 WebSocket Configuration

### Server-Side (Already Configured)

The research controller automatically uses the existing Socket.io instance:

```javascript
const { getIO } = require('../socket/socketManager');

const io = getIO();
io.to(socketId).emit('research:progress', {
  step: 'searching',
  message: '🌐 Searching multiple sources...',
  progress: 25
});
```

### Client-Side

Listen for progress updates:

```javascript
import { useSocket } from '../contexts/SocketContext';

function ResearchComponent() {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    socket.on('research:progress', (data) => {
      console.log('Progress:', data);
      // Update UI with progress
      setProgress(data);
    });

    return () => {
      socket.off('research:progress');
    };
  }, [socket]);
}
```

---

## 🔌 API Usage

### Basic Research Query

```javascript
const axios = require('axios');

async function conductResearch(query) {
  const token = localStorage.getItem('token');
  
  const response = await axios.post(
    'http://localhost:3000/api/research/agent/query',
    {
      query: query,
      socketId: socket.id // Optional, for progress updates
    },
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  return response.data;
}

// Usage
const result = await conductResearch('What are the best AI models for startups in 2026?');
console.log(result.answer);
console.log(result.sources);
```

### With Progress Tracking

```javascript
async function researchWithProgress(query, onProgress) {
  const socket = io('http://localhost:3000');
  
  // Listen for progress
  socket.on('research:progress', (data) => {
    onProgress(data);
  });

  // Start research
  const response = await axios.post(
    'http://localhost:3000/api/research/agent/query',
    {
      query,
      socketId: socket.id
    },
    {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    }
  );

  socket.close();
  return response.data;
}

// Usage
await researchWithProgress(
  'Compare React vs Vue.js',
  (progress) => {
    console.log(`[${progress.progress}%] ${progress.message}`);
  }
);
```

### Get Capabilities

```javascript
const response = await axios.get(
  'http://localhost:3000/api/research/agent/capabilities'
);

console.log(response.data.features);
console.log(response.data.limitations);
```

### Get Examples

```javascript
const response = await axios.get(
  'http://localhost:3000/api/research/agent/examples'
);

console.log(response.data.examples.informational);
console.log(response.data.examples.comparative);
console.log(response.data.examples.analytical);
```

### Clear Cache

```javascript
await axios.post(
  'http://localhost:3000/api/research/agent/clear-cache',
  {},
  {
    headers: {
      Authorization: `Bearer ${token}`
    }
  }
);
```

---

## 🛡️ Error Handling

### Backend Error Handling

The agent returns structured errors:

```javascript
{
  "success": false,
  "error": "Error message",
  "steps": ["Completed steps before error"],
  "metadata": {
    "query": "...",
    "duration": "5.2s",
    "timestamp": "..."
  }
}
```

### Frontend Error Handling

```javascript
try {
  const result = await conductResearch(query);
  
  if (!result.success) {
    // Handle research failure
    showError(result.error);
    return;
  }
  
  // Display results
  displayResults(result);
  
} catch (error) {
  // Handle network/API errors
  if (error.response) {
    // Server responded with error
    showError(error.response.data.message);
  } else if (error.request) {
    // No response received
    showError('Network error. Please check your connection.');
  } else {
    // Other errors
    showError(error.message);
  }
}
```

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `GEMINI_AI_API_KEY is not set` | Missing API key | Add key to `.env` |
| `SERPER_API_KEY is not set` | Missing API key | Add key to `.env` |
| `Query is required` | Empty query | Validate input |
| `Query is too long` | Query > 500 chars | Shorten query |
| `No sources found` | Search returned no results | Try different query |
| `Could not fetch content` | All URLs failed | Check internet connection |
| `Rate limit exceeded` | Too many requests | Wait and retry |

---

## ✅ Best Practices

### 1. Query Optimization

```javascript
// ✅ Good queries
"What are the best AI models for startups in 2026?"
"Compare React vs Vue.js for web development"
"Analyze the impact of AI on job markets"

// ❌ Poor queries
"AI" (too vague)
"Tell me everything about technology" (too broad)
"asdfghjkl" (nonsensical)
```

### 2. Progress UI

Show clear progress indicators:

```javascript
const progressMessages = {
  planning: '🔍 Understanding your question...',
  searching: '🌐 Searching multiple sources...',
  fetching: '📄 Reading top articles...',
  analyzing: '🧠 Analyzing information...',
  deeper_research: '🔁 Doing deeper research...',
  synthesizing: '✍️ Preparing final answer...'
};
```

### 3. Caching Strategy

```javascript
// Clear cache periodically
setInterval(async () => {
  await axios.post('/api/research/agent/clear-cache');
}, 3600000); // Every hour
```

### 4. Rate Limiting

Implement client-side rate limiting:

```javascript
let lastResearchTime = 0;
const MIN_INTERVAL = 5000; // 5 seconds

async function conductResearch(query) {
  const now = Date.now();
  if (now - lastResearchTime < MIN_INTERVAL) {
    throw new Error('Please wait before starting another research');
  }
  
  lastResearchTime = now;
  // ... conduct research
}
```

### 5. Timeout Handling

```javascript
const response = await axios.post(
  '/api/research/agent/query',
  { query },
  {
    timeout: 60000, // 60 second timeout
    headers: { Authorization: `Bearer ${token}` }
  }
);
```

### 6. Loading States

```javascript
const [isResearching, setIsResearching] = useState(false);
const [progress, setProgress] = useState(0);

async function handleResearch() {
  setIsResearching(true);
  setProgress(0);
  
  try {
    const result = await conductResearch(query);
    // Handle result
  } finally {
    setIsResearching(false);
    setProgress(100);
  }
}
```

---

## 🧪 Testing

### Unit Tests

```javascript
// test/research.test.js
const ResearchAgent = require('../research/researchAgent');

describe('ResearchAgent', () => {
  it('should conduct research successfully', async () => {
    const agent = new ResearchAgent();
    const result = await agent.processQuery('Test query');
    
    expect(result.success).toBe(true);
    expect(result.answer).toBeDefined();
    expect(result.sources).toBeInstanceOf(Array);
  });
});
```

### Integration Tests

```javascript
// test/research-api.test.js
const request = require('supertest');
const app = require('../index');

describe('Research API', () => {
  it('POST /api/research/agent/query', async () => {
    const response = await request(app)
      .post('/api/research/agent/query')
      .set('Authorization', `Bearer ${token}`)
      .send({ query: 'Test query' });
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
```

### Manual Testing

```bash
# Test with curl
curl -X POST http://localhost:3000/api/research/agent/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"query": "What are the best AI models for startups in 2026?"}'

# Test with provided script
node research/test-research.js
```

---

## 📊 Monitoring

### Log Research Metrics

```javascript
// Add to researchController.js
const result = await researchAgent.processQuery(query, onProgress);

// Log metrics
console.log({
  userId,
  query,
  success: result.success,
  duration: result.metadata.duration,
  sources: result.metadata.totalSources,
  timestamp: result.metadata.timestamp
});
```

### Track Usage

```javascript
// Track research queries
const researchMetrics = {
  totalQueries: 0,
  successfulQueries: 0,
  failedQueries: 0,
  averageDuration: 0
};

// Update after each research
researchMetrics.totalQueries++;
if (result.success) {
  researchMetrics.successfulQueries++;
} else {
  researchMetrics.failedQueries++;
}
```

---

## 🚀 Deployment

### Environment Variables

Ensure these are set in production:

```bash
GEMINI_AI_API_KEY=prod_key
SERPER_API_KEY=prod_key
NODE_ENV=production
```

### Performance Optimization

1. **Enable caching** - Content cache reduces API calls
2. **Rate limiting** - Prevent abuse
3. **Timeout configuration** - Set appropriate timeouts
4. **Error monitoring** - Track failures

### Security

1. **Authentication** - All endpoints require auth
2. **Input validation** - Validate query length and content
3. **Rate limiting** - Implement per-user limits
4. **API key protection** - Never expose keys to client

---

## 📚 Additional Resources

- [Gemini API Documentation](https://ai.google.dev/docs)
- [Serper API Documentation](https://serper.dev/docs)
- [Socket.io Documentation](https://socket.io/docs/)
- [React Markdown Documentation](https://github.com/remarkjs/react-markdown)

---

## 🤝 Support

For issues or questions:
1. Check the [README](./README.md)
2. Review error logs
3. Test with `test-research.js`
4. Verify API keys are configured

---

## 📝 Changelog

### v1.0.0 (2026-03-28)
- Initial release
- 5-stage research pipeline
- Real-time progress updates
- Source citation
- Follow-up question generation
- Content caching
- Comprehensive error handling
