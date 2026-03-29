# 🚀 Deep Research Agent - Quick Start

Get up and running with the Deep Research Agent in 5 minutes.

## ⚡ Quick Setup

### 1. Install Dependencies (Already Done ✅)

```bash
npm install @google/generative-ai axios
```

### 2. Configure API Keys

Add to `PolarisAI-Backend/.env`:

```bash
GEMINI_AI_API_KEY=AIzaSyANAE4oCJ9tR6K0qhmUF1kBKywdK58oGSk
SERPER_API_KEY=aca02580c9703f4f199a5d820be70370ce0deb3c
```

✅ **Already configured in your .env file!**

### 3. Start Backend Server

```bash
cd PolarisAI-Backend
npm start
```

### 4. Test the Agent

```bash
# Quick test
node research/test-research.js

# Or test via API
curl -X POST http://localhost:3000/api/research/agent/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"query": "What are the best AI models for startups in 2026?"}'
```

## 📱 Frontend Setup

### 1. Add Component to Your App

```javascript
// In your main App.js or routes
import DeepResearch from './components/research/DeepResearch';

function App() {
  return (
    <div>
      <DeepResearch />
    </div>
  );
}
```

### 2. Install Frontend Dependencies

```bash
cd PolarisAI-Frontend
npm install react-markdown
```

### 3. Start Frontend

```bash
npm start
```

### 4. Access Research Interface

Navigate to: `http://localhost:3001` (or your frontend URL)

## 🎯 Try These Queries

### Informational
```
What are the best AI models for startups in 2026?
Explain quantum computing and its current applications
What is the latest research on climate change solutions?
```

### Comparative
```
Compare React vs Vue.js for web development
What are the differences between GPT-4 and Claude?
Python vs JavaScript for beginners
```

### Analytical
```
Analyze the impact of AI on job markets
What are the pros and cons of remote work?
Evaluate the effectiveness of renewable energy
```

## 📊 Expected Output

When you run a research query, you'll see:

1. **Progress Updates** (real-time via WebSocket)
   - 🔍 Understanding your question...
   - 🌐 Searching multiple sources...
   - 📄 Reading top articles...
   - 🧠 Analyzing information...
   - ✍️ Preparing final answer...

2. **Comprehensive Answer**
   - TL;DR summary
   - Detailed sections
   - Key takeaways
   - Source citations [1], [2], etc.

3. **Sources List**
   - Clickable links to original sources
   - Numbered for citation reference

4. **Follow-up Questions**
   - 3 relevant questions to extend research

5. **Metadata**
   - Total sources analyzed
   - Research duration
   - Query intent classification

## 🔍 API Endpoints

### Check Status
```bash
curl http://localhost:3000/api/research/agent/status
```

### Get Examples
```bash
curl http://localhost:3000/api/research/agent/examples
```

### Get Capabilities
```bash
curl http://localhost:3000/api/research/agent/capabilities
```

### Conduct Research
```bash
curl -X POST http://localhost:3000/api/research/agent/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "query": "What are the best AI models for startups in 2026?",
    "socketId": "optional-socket-id"
  }'
```

## 🎨 Frontend Component Features

The `DeepResearch` component includes:

- ✅ Real-time progress bar
- ✅ Step-by-step progress indicators
- ✅ Markdown-formatted answers
- ✅ Clickable source citations
- ✅ Follow-up question buttons
- ✅ Metadata display
- ✅ Error handling
- ✅ Responsive design

## 🐛 Troubleshooting

### "GEMINI_AI_API_KEY is not set"
**Solution:** Add the key to `.env` file (already done ✅)

### "SERPER_API_KEY is not set"
**Solution:** Add the key to `.env` file (already done ✅)

### "No sources found"
**Solution:** Try a different or more specific query

### "Could not fetch content"
**Solution:** Check internet connection and try again

### WebSocket not connecting
**Solution:** Ensure Socket.io is properly configured in `socketManager.js`

## 📁 File Structure

```
PolarisAI-Backend/
└── research/
    ├── researchAgent.js          # Main agent class
    ├── researchService.js        # Core research logic
    ├── researchController.js     # API endpoints
    ├── test-research.js          # Test script
    ├── README.md                 # Full documentation
    ├── INTEGRATION_GUIDE.md      # Integration guide
    └── QUICK_START.md            # This file

PolarisAI-Frontend/
└── src/
    └── components/
        └── research/
            ├── DeepResearch.tsx  # React TypeScript component
            └── DeepResearch.css  # Styles
```

## 🎯 Next Steps

1. ✅ **Test the agent** - Run `node research/test-research.js`
2. ✅ **Try the API** - Use curl or Postman
3. ✅ **Use the UI** - Access the frontend component
4. 📚 **Read full docs** - Check `README.md` for details
5. 🔌 **Integrate** - Follow `INTEGRATION_GUIDE.md`

## 💡 Pro Tips

1. **Be specific** - More specific queries = better results
2. **Use follow-ups** - Click generated follow-up questions
3. **Check sources** - Review cited sources for accuracy
4. **Clear cache** - Clear cache periodically for fresh results
5. **Monitor progress** - Watch real-time progress updates

## 🌟 Example Usage

```javascript
// Simple usage
const result = await axios.post('/api/research/agent/query', {
  query: 'What are the best AI models for startups in 2026?'
}, {
  headers: { Authorization: `Bearer ${token}` }
});

console.log(result.data.answer);
console.log(result.data.sources);
console.log(result.data.followUpQuestions);
```

## 📞 Support

- 📖 Full documentation: `README.md`
- 🔌 Integration guide: `INTEGRATION_GUIDE.md`
- 🧪 Test script: `test-research.js`
- 🌐 API docs: `http://localhost:3000/api`

## ✅ Checklist

- [x] Dependencies installed
- [x] API keys configured
- [x] Routes registered in `index.js`
- [x] Backend server running
- [x] Frontend component created
- [ ] Test with `test-research.js`
- [ ] Try via API
- [ ] Use frontend UI
- [ ] Read full documentation

---

**You're all set! 🎉**

Start researching with: `node research/test-research.js`
