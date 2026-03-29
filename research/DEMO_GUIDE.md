# 🎬 Deep Research Agent - Demo Guide

Complete guide for demonstrating the Deep Research Agent's capabilities.

---

## 🚀 Quick Demo (5 minutes)

### Step 1: Verify Setup

```bash
# Check if API keys are configured
curl http://localhost:3000/api/research/agent/status

# Expected response:
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

### Step 2: Run Test Script

```bash
cd PolarisAI-Backend
node research/test-research.js
```

**What you'll see:**
```
🧪 Testing Deep Research Agent
============================================================

📝 Query: "What are the best AI models for startups in 2026?"

[PLANNING] 🔍 Understanding your question...
[SEARCHING] 🌐 Searching multiple sources...
[FETCHING] 📄 Reading top articles...
[ANALYZING] 🧠 Analyzing information...
[SYNTHESIZING] ✍️ Preparing final answer...

============================================================
✅ RESEARCH COMPLETED

📊 METADATA:
   Intent: informational
   Sources: 12
   Duration: 15.3s

📝 ANSWER:
## TL;DR
[Brief summary of best AI models for startups...]

📚 SOURCES:
   [1] Best AI Models for Startups in 2026
       https://example.com/ai-models
   [2] Startup AI Guide
       https://example.com/startup-guide
   ...

💡 FOLLOW-UP QUESTIONS:
   1. What are the costs of implementing these AI models?
   2. How do these models compare in terms of accuracy?
   3. What are the best practices for deploying AI in startups?

🎯 STEPS COMPLETED:
   1. Query understanding completed
   2. Found 12 sources
   3. Fetched 10 articles
   4. Deep analysis completed
   5. Final synthesis completed
```

### Step 3: Try via API

```bash
# Get example queries
curl http://localhost:3000/api/research/agent/examples

# Conduct research
curl -X POST http://localhost:3000/api/research/agent/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "query": "Compare React vs Vue.js for web development"
  }'
```

---

## 🎯 Demo Scenarios

### Scenario 1: Informational Query

**Query:** "What are the best AI models for startups in 2026?"

**Expected Output:**
- TL;DR summary
- Detailed comparison of models (GPT-4, Claude, Gemini, etc.)
- Cost considerations
- Use cases for startups
- Implementation recommendations
- 10-15 cited sources
- 3 follow-up questions

**Demo Points:**
- ✅ Multi-source research
- ✅ Comprehensive synthesis
- ✅ Source citations
- ✅ Follow-up questions

---

### Scenario 2: Comparative Query

**Query:** "Compare React vs Vue.js for web development"

**Expected Output:**
- TL;DR comparison
- Feature comparison table
- Performance analysis
- Learning curve comparison
- Community and ecosystem
- Use case recommendations
- 8-12 cited sources
- 3 follow-up questions

**Demo Points:**
- ✅ Structured comparison
- ✅ Multiple perspectives
- ✅ Balanced analysis
- ✅ Practical recommendations

---

### Scenario 3: Analytical Query

**Query:** "Analyze the impact of AI on job markets"

**Expected Output:**
- TL;DR analysis
- Current trends
- Job displacement analysis
- New job creation
- Skills in demand
- Future predictions
- Expert opinions
- 12-15 cited sources
- 3 follow-up questions

**Demo Points:**
- ✅ Deep analysis
- ✅ Multiple viewpoints
- ✅ Data-driven insights
- ✅ Expert citations

---

### Scenario 4: Current Events

**Query:** "Latest developments in quantum computing"

**Expected Output:**
- TL;DR of recent news
- Recent breakthroughs
- Key players and companies
- Technical advances
- Commercial applications
- Future outlook
- 10-12 cited sources (recent)
- 3 follow-up questions

**Demo Points:**
- ✅ Recent information
- ✅ News sources
- ✅ Technical accuracy
- ✅ Timely content

---

## 🎨 Frontend Demo

### Step 1: Start Frontend

```bash
cd PolarisAI-Frontend
npm start
```

### Step 2: Navigate to Research Page

Open browser: `http://localhost:3001/research` (or your route)

### Step 3: Enter Query

Type: "What are the best AI models for startups in 2026?"

### Step 4: Watch Progress

**You'll see:**
1. Progress bar animating (0% → 100%)
2. Step indicators lighting up:
   - 🔍 Understanding
   - 🌐 Searching
   - 📄 Reading
   - 🧠 Analyzing
   - ✍️ Synthesizing
3. Status messages updating in real-time

### Step 5: View Results

**Results display:**
- Markdown-formatted answer
- Clickable source citations
- Follow-up question buttons
- Metadata (sources, duration, intent)

### Step 6: Try Follow-up

Click a follow-up question button to start new research.

---

## 📊 Progress Visualization

### Real-time Updates

```
Time: 0s
[████░░░░░░░░░░░░░░░░] 10%
🔍 Understanding your question...

Time: 3s
[████████░░░░░░░░░░░░] 25%
🌐 Searching multiple sources...

Time: 7s
[█████████████░░░░░░░] 45%
📄 Reading top articles...

Time: 11s
[████████████████░░░░] 65%
🧠 Analyzing information...

Time: 14s
[██████████████████░░] 90%
✍️ Preparing final answer...

Time: 16s
[████████████████████] 100%
✅ Research completed!
```

---

## 🎤 Demo Script

### Introduction (30 seconds)

> "Today I'll demonstrate our Deep Research Agent - a Perplexity-style research system that performs multi-step web research with real-time progress updates."

### Feature Highlight (1 minute)

> "The agent uses a 5-stage pipeline:
> 1. It understands your query and breaks it into sub-queries
> 2. Searches multiple sources in parallel
> 3. Fetches and cleans content from top URLs
> 4. Performs iterative deep research if needed
> 5. Synthesizes a comprehensive answer with citations"

### Live Demo (2 minutes)

> "Let me show you. I'll ask: 'What are the best AI models for startups in 2026?'"
> 
> [Type query and press Enter]
> 
> "Watch the progress bar - you can see it's understanding the question, searching sources, reading articles, analyzing information, and synthesizing the answer."
> 
> [Wait for completion]
> 
> "Here's the result - a comprehensive answer with a TL;DR, detailed sections, key takeaways, and 12 cited sources. Notice the follow-up questions it generated."

### Technical Details (1 minute)

> "Under the hood, it uses:
> - Gemini 1.5 Flash for AI processing
> - Serper API for web search
> - WebSocket for real-time updates
> - Content caching for optimization
> 
> The entire research takes 15-30 seconds and analyzes 10-15 sources."

### Q&A (30 seconds)

> "Any questions about the research agent?"

---

## 🎯 Key Demo Points

### Must-Show Features

1. ✅ **Real-time Progress**
   - Show progress bar animating
   - Point out step indicators
   - Highlight status messages

2. ✅ **Multi-source Research**
   - Mention 10-15 sources analyzed
   - Show source citations
   - Click a source link

3. ✅ **High-quality Synthesis**
   - Point out TL;DR
   - Show structured sections
   - Highlight key takeaways

4. ✅ **Follow-up Questions**
   - Show generated questions
   - Click one to start new research
   - Demonstrate continuity

5. ✅ **Performance**
   - Mention 15-30 second completion
   - Show metadata (duration, sources)
   - Highlight efficiency

---

## 🐛 Troubleshooting Demo Issues

### Issue: "API key not configured"

**Solution:**
```bash
# Check .env file
cat .env | grep -E "GEMINI|SERPER"

# Should show:
GEMINI_AI_API_KEY=AIzaSy...
SERPER_API_KEY=aca025...
```

### Issue: "No sources found"

**Solution:**
- Try a different query
- Check internet connection
- Verify Serper API key is valid

### Issue: "WebSocket not connecting"

**Solution:**
- Ensure server is running
- Check Socket.io configuration
- Verify frontend socket setup

### Issue: "Slow research"

**Solution:**
- Normal for first query (no cache)
- Subsequent queries are faster
- Check internet speed

---

## 📸 Screenshot Checklist

For documentation/marketing:

- [ ] Initial query input screen
- [ ] Progress bar at 25%
- [ ] Progress bar at 65%
- [ ] Progress bar at 100%
- [ ] Complete answer with TL;DR
- [ ] Source citations section
- [ ] Follow-up questions
- [ ] Metadata display
- [ ] Mobile responsive view

---

## 🎥 Video Demo Script

### Opening (5 seconds)
- Show Polaris AI logo
- Title: "Deep Research Agent Demo"

### Query Input (10 seconds)
- Type query slowly
- Show autocomplete/suggestions
- Press Enter

### Progress Animation (20 seconds)
- Show full progress sequence
- Highlight each stage
- Show status messages

### Results Display (20 seconds)
- Scroll through answer
- Highlight TL;DR
- Show source citations
- Point out follow-up questions

### Follow-up Demo (10 seconds)
- Click follow-up question
- Show new research starting
- Fast-forward to results

### Closing (5 seconds)
- Show "Research completed" message
- Display Polaris AI logo
- End screen

**Total Duration:** 70 seconds

---

## 🎓 Training Guide

### For New Users

1. **Start Simple**
   - Try: "What is artificial intelligence?"
   - Observe the process
   - Read the answer

2. **Try Comparison**
   - Try: "Compare Python vs JavaScript"
   - See structured comparison
   - Check sources

3. **Use Follow-ups**
   - Click a follow-up question
   - See how it extends research
   - Build knowledge progressively

4. **Explore Examples**
   - Check `/api/research/agent/examples`
   - Try different categories
   - Learn query patterns

### For Developers

1. **Read Documentation**
   - Start with QUICK_START.md
   - Review INTEGRATION_GUIDE.md
   - Study ARCHITECTURE.md

2. **Run Tests**
   - Execute test-research.js
   - Try API endpoints
   - Check error handling

3. **Integrate**
   - Add to your app
   - Configure WebSocket
   - Test thoroughly

---

## 📊 Demo Metrics

### Success Indicators

- ✅ Research completes in <30 seconds
- ✅ 10+ sources cited
- ✅ Comprehensive answer (>500 words)
- ✅ 3 follow-up questions generated
- ✅ No errors during demo
- ✅ Smooth progress updates
- ✅ Sources are relevant and recent

### Quality Checks

- ✅ Answer is accurate
- ✅ Sources are authoritative
- ✅ Citations are correct
- ✅ Follow-ups are relevant
- ✅ TL;DR is concise
- ✅ Key takeaways are clear

---

## 🎉 Demo Conclusion

### Summary Points

1. **Powerful Research**
   - Multi-step analysis
   - 10-15 sources
   - Comprehensive synthesis

2. **Great UX**
   - Real-time progress
   - Clear visualization
   - Intuitive interface

3. **Production Ready**
   - Fast performance
   - Error handling
   - Well documented

4. **Easy Integration**
   - Simple API
   - WebSocket support
   - React component included

### Call to Action

> "The Deep Research Agent is ready to use. Try it with your own queries, integrate it into your app, and let us know your feedback!"

---

## 📞 Demo Support

### Resources
- 📖 Full docs: `README.md`
- 🚀 Quick start: `QUICK_START.md`
- 🔌 Integration: `INTEGRATION_GUIDE.md`
- 🧪 Test: `test-research.js`

### Contact
- GitHub Issues
- Team Slack
- Email support

---

**Demo prepared by:** Polaris AI Team
**Last updated:** March 28, 2026
**Status:** ✅ Ready for Demo
