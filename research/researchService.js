/**
 * Deep Research Service - Agentic RAG System
 * 
 * Multi-agent system that performs iterative research like ChatGPT Deep Research.
 * Uses GPT-4 for reasoning, planning, and synthesis.
 * 
 * Architecture:
 * 1. Planning Agent - Creates research plan
 * 2. Search Agent - Executes searches iteratively
 * 3. Analysis Agent - Analyzes gaps and determines next steps
 * 4. Synthesis Agent - Combines findings into executive summary
 * 
 * Content Fetching Strategy:
 * - Primary: Firecrawl API (best for anti-bot bypass)
 * - Fallback 1: Jina AI Reader (clean markdown extraction)
 * - Fallback 2: Direct fetch with browser headers
 * - Fallback 3: Use search snippet
 */

const OpenAI = require('openai');
const axios = require('axios');

class ResearchService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.serperApiKey = process.env.SERPER_API_KEY;
    this.firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
    
    // Configuration
    this.maxIterations = 5;
    this.maxSearchesPerIteration = 3;
    this.maxSourcesPerSearch = 5;
    this.maxTotalSources = 50;
    this.contentCache = new Map();
    
    // State tracking
    this.searchCount = 0;
    this.citationCount = 0;
    this.visitedUrls = new Set();
    this.fetchStats = {
      firecrawl: 0,
      jina: 0,
      direct: 0,
      snippet: 0,
      failed: 0
    };
  }

  /**
   * Helper method to emit timeline research step events
   * Supports both legacy format and new search query format
   */
  emitResearchStep(onProgress, stepPayload) {
    if (!onProgress) {
      console.log('[ResearchService] ⚠️ emitResearchStep called but onProgress is null');
      return;
    }
    
    console.log('[ResearchService] 📡 Emitting research step:', JSON.stringify(stepPayload).substring(0, 200));
    
    // Support both legacy (stepId, status, sources) and new (full payload) formats
    let payload = stepPayload;
    
    // Legacy format: (onProgress, 'planning', 'active', [], 'detail')
    if (typeof stepPayload === 'string') {
      const stepId = arguments[1];
      const status = arguments[2];
      const sources = arguments[3] || [];
      const detail = arguments[4] || '';
      
      const stepConfig = {
        planning: { action: 'planning' },
        searching: { action: 'searching' },
        analyzing: { action: 'analyzing' },
        synthesizing: { action: 'synthesizing' }
      };
      
      const config = stepConfig[stepId];
      if (!config) return;
      
      payload = {
        type: 'timeline_research_step',
        eventId: `research-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        timestamp: new Date().toISOString(),
        researchStep: {
          id: stepId,
          status: status,
          detail: detail || undefined,
          sources: sources.length > 0 ? sources : undefined
        }
      };
    } else {
      // New format: full payload object
      payload = {
        type: 'timeline_research_step',
        eventId: `research-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        timestamp: new Date().toISOString(),
        researchStep: stepPayload
      };
    }
    
    onProgress(payload);
  }

  /**
   * Helper to strip user query prefix from search query text
   * E.g., "do a deep research on Emerging Trends in AI AI in Healthcare" 
   * becomes "AI in Healthcare"
   */
  stripQueryPrefix(searchQuery, userQuery) {
    const cleanedUserQuery = userQuery
      .toLowerCase()
      .replace(/^(do a deep research on|research|search for)\s+/i, '')
      .trim();
    
    const cleanedSearchQuery = searchQuery
      .toLowerCase()
      .replace(/^(do a deep research on|research|search for)\s+/i, '')
      .trim();
    
    // Try to find where the search query starts in the full string
    if (cleanedSearchQuery.includes(cleanedUserQuery)) {
      // Strip the user query prefix
      let result = searchQuery.substring(
        searchQuery.toLowerCase().indexOf(cleanedSearchQuery) + cleanedUserQuery.length
      ).trim();
      
      // Clean up any remaining prefix patterns
      result = result.replace(/^\s*-\s*/, '').trim();
      return result || searchQuery;
    }
    
    return searchQuery;
  }

  /**
   * Helper to extract domain from URL
   */
  extractDomain(url) {
    try {
      const hostname = new URL(url).hostname;
      return hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }

  /**
   * Helper method to call OpenAI with retry logic
   */
  async callOpenAIWithRetry(params, maxRetries = 3) {
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.openai.chat.completions.create(params);
      } catch (error) {
        lastError = error;

        // Handle rate limit errors
        if (error.status === 429) {
          if (attempt < maxRetries) {
            const waitTime = Math.min(1000 * Math.pow(2, attempt), 10000);
            console.log(`[ResearchService] Rate limited, waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
        }

        // For non-rate-limit errors, throw immediately
        if (error.status !== 429) {
          throw error;
        }
      }
    }

    throw lastError;
  }

  /**
   * AGENT 1: Planning Agent
   * Creates a detailed research plan with subtopics
   */
  async createResearchPlan(query, onProgress) {
    onProgress?.({ 
      step: 'planning', 
      message: '🧠 Creating research plan...',
      progress: 5
    });

    const planningPrompt = `You are a research planning expert. Create a comprehensive research plan for this query.

Query: "${query}"

Create a detailed research plan with:
1. Main topic understanding
2. 4-6 key subtopics to explore
3. Specific questions to answer for each subtopic
4. Expected outcome

Respond in JSON format:
{
  "title": "Research title",
  "mainTopic": "Brief description",
  "subtopics": [
    {
      "name": "Subtopic name",
      "description": "What to research",
      "questions": ["Question 1", "Question 2"]
    }
  ],
  "expectedOutcome": "What the final report should cover"
}`;

    try {
      const response = await this.callOpenAIWithRetry({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: planningPrompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      const plan = JSON.parse(response.choices[0].message.content);
      console.log('[ResearchService] Research plan created:', plan.title);
      
      return plan;
    } catch (error) {
      console.error('[ResearchService] Planning error:', error.message);
      // Fallback plan
      return {
        title: `Research on ${query}`,
        mainTopic: query,
        subtopics: [
          { name: 'Overview', description: 'General overview', questions: [query] },
          { name: 'Details', description: 'Detailed information', questions: [`Details about ${query}`] }
        ],
        expectedOutcome: 'Comprehensive understanding'
      };
    }
  }

  /**
   * AGENT 2: Search Agent
   * Executes searches and collects sources
   */
  async executeSearch(searchQuery) {
    this.searchCount++;
    
    try {
      const response = await axios.post(
        'https://google.serper.dev/search',
        {
          q: searchQuery,
          num: this.maxSourcesPerSearch
        },
        {
          headers: {
            'X-API-KEY': this.serperApiKey,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const results = response.data.organic || [];
      const sources = [];

      for (const item of results) {
        if (!this.visitedUrls.has(item.link) && sources.length < this.maxSourcesPerSearch) {
          this.visitedUrls.add(item.link);
          sources.push({
            url: item.link,
            title: item.title,
            snippet: item.snippet,
            searchQuery: searchQuery
          });
        }
      }

      console.log(`[ResearchService] Search "${searchQuery}" found ${sources.length} new sources`);
      return sources;
    } catch (error) {
      console.error(`[ResearchService] Search failed:`, error.message);
      return [];
    }
  }

  /**
   * Strategy 1: Firecrawl API (BEST - bypasses all anti-bot)
   * Professional scraping service with JS rendering
   */
  async fetchWithFirecrawl(url) {
    if (!this.firecrawlApiKey) {
      return null;
    }

    try {
      const response = await axios.post(
        'https://api.firecrawl.dev/v0/scrape',
        {
          url: url,
          pageOptions: {
            onlyMainContent: true
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.firecrawlApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      if (response.data?.data?.markdown) {
        const content = response.data.data.markdown.substring(0, 10000);
        this.fetchStats.firecrawl++;
        return content;
      }
      
      return null;
    } catch (error) {
      console.log(`[Firecrawl] Failed for ${url}: ${error.message}`);
      return null;
    }
  }

  /**
   * Strategy 2: Jina AI Reader (FREE - clean markdown)
   * Converts any URL to clean, LLM-friendly markdown
   */
  async fetchWithJina(url) {
    try {
      const jinaUrl = `https://r.jina.ai/${url}`;
      const response = await axios.get(jinaUrl, {
        headers: {
          'Accept': 'application/json',
          'X-Return-Format': 'markdown'
        },
        timeout: 12000
      });

      if (response.data && typeof response.data === 'string' && response.data.length > 200) {
        const content = response.data.substring(0, 10000);
        this.fetchStats.jina++;
        return content;
      }
      
      return null;
    } catch (error) {
      console.log(`[Jina] Failed for ${url}: ${error.message}`);
      return null;
    }
  }

  /**
   * Strategy 3: Direct fetch with realistic browser headers
   */
  async fetchDirect(url) {
    try {
      const response = await axios.get(url, {
        timeout: 8000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Cache-Control': 'max-age=0'
        },
        maxRedirects: 5,
        validateStatus: (status) => status < 500
      });

      if (response.status >= 400) {
        throw new Error(`HTTP ${response.status}`);
      }

      let text = response.data
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (text.length < 200) {
        throw new Error('Content too short');
      }

      text = text.substring(0, 10000);
      this.fetchStats.direct++;
      return text;
      
    } catch (error) {
      console.log(`[Direct] Failed for ${url}: ${error.message}`);
      return null;
    }
  }

  /**
   * Smart content fetching with cascading fallbacks
   * Tries multiple strategies in order of reliability
   */
  async fetchContent(url, snippet = '') {
    // Check cache first
    if (this.contentCache.has(url)) {
      return this.contentCache.get(url);
    }

    console.log(`[Fetch] Attempting: ${url}`);

    // Strategy 1: Try Firecrawl (best for anti-bot bypass)
    if (this.firecrawlApiKey) {
      const content = await this.fetchWithFirecrawl(url);
      if (content) {
        this.contentCache.set(url, content);
        console.log(`[Fetch] ✅ Firecrawl success`);
        return content;
      }
    }

    // Strategy 2: Try Jina AI Reader (free, works well)
    const jinaContent = await this.fetchWithJina(url);
    if (jinaContent) {
      this.contentCache.set(url, jinaContent);
      console.log(`[Fetch] ✅ Jina success`);
      return jinaContent;
    }

    // Strategy 3: Try direct fetch with browser headers
    const directContent = await this.fetchDirect(url);
    if (directContent) {
      this.contentCache.set(url, directContent);
      console.log(`[Fetch] ✅ Direct success`);
      return directContent;
    }

    // Strategy 4: Use snippet as fallback
    if (snippet && snippet.length > 50) {
      console.log(`[Fetch] ⚠️ Using snippet fallback`);
      this.fetchStats.snippet++;
      return snippet;
    }

    console.log(`[Fetch] ❌ All strategies failed`);
    this.fetchStats.failed++;
    return null;
  }

  /**
   * AGENT 3: Analysis Agent
   * Analyzes collected information and determines next steps
   */
  async analyzeProgress(query, plan, collectedData, iteration, onProgress) {
    onProgress?.({ 
      step: 'analyzing', 
      message: `🔍 Analyzing findings (iteration ${iteration})...`,
      progress: 40 + (iteration * 10)
    });

    const analysisPrompt = `You are a research analyst. Analyze the research progress and determine next steps.

Original Query: "${query}"

Research Plan:
${JSON.stringify(plan.subtopics, null, 2)}

Collected Data Summary:
${collectedData.slice(0, 10).map((d, i) => `${i + 1}. ${d.title}: ${d.snippet || d.content?.substring(0, 200)}`).join('\n')}

Total sources collected: ${collectedData.length}
Current iteration: ${iteration}

Analyze:
1. What information do we have?
2. What gaps exist?
3. What should we search for next?
4. Is the research sufficient?

Respond in JSON format:
{
  "isSufficient": true/false,
  "coverageAnalysis": "What we have covered",
  "gaps": ["Gap 1", "Gap 2"],
  "nextSearches": ["Search query 1", "Search query 2", "Search query 3"],
  "reasoning": "Why we need more or why we're done"
}`;

    try {
      const response = await this.callOpenAIWithRetry({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: analysisPrompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      const analysis = JSON.parse(response.choices[0].message.content);
      console.log('[ResearchService] Analysis:', analysis.isSufficient ? 'Sufficient' : 'Need more');
      
      return analysis;
    } catch (error) {
      console.error('[ResearchService] Analysis error:', error.message);
      return {
        isSufficient: true,
        coverageAnalysis: 'Analysis failed',
        gaps: [],
        nextSearches: [],
        reasoning: 'Proceeding with available data'
      };
    }
  }

  /**
   * Estimate token count (rough approximation: 1 token ≈ 4 characters)
   */
  estimateTokens(text) {
    return Math.ceil(text.length / 4);
  }

  /**
   * Chunk sources to fit within token limits
   * Keeps token count under maxTokens while prioritizing full content sources
   */
  chunkSourcesForSynthesis(sources, maxTokens = 20000) {
    const fullContentSources = sources.filter(s => s.fetchMethod === 'full');
    const snippetSources = sources.filter(s => s.fetchMethod === 'snippet');
    
    let currentTokens = 0;
    const selectedSources = [];
    
    // Priority 1: Add full content sources (truncated if needed)
    for (const source of fullContentSources) {
      const contentLength = Math.min(2000, source.content?.length || 0); // Max 2000 chars per source
      const truncatedContent = source.content?.substring(0, contentLength);
      const sourceTokens = this.estimateTokens(truncatedContent || '');
      
      if (currentTokens + sourceTokens < maxTokens) {
        selectedSources.push({
          ...source,
          content: truncatedContent
        });
        currentTokens += sourceTokens;
      } else {
        break;
      }
    }
    
    // Priority 2: Add snippet sources
    for (const source of snippetSources) {
      const sourceTokens = this.estimateTokens(source.content || '');
      
      if (currentTokens + sourceTokens < maxTokens) {
        selectedSources.push(source);
        currentTokens += sourceTokens;
      } else {
        break;
      }
    }
    
    console.log(`[ResearchService] Selected ${selectedSources.length}/${sources.length} sources (~${currentTokens} tokens)`);
    return selectedSources;
  }

  /**
   * AGENT 4: Synthesis Agent
   * Creates executive summary with citations
   */
  async synthesizeReport(query, plan, allData, onProgress) {
    onProgress?.({ 
      step: 'synthesizing', 
      message: '✍️ Writing executive summary...',
      progress: 85
    });

    // Prepare sources with citation numbers
    const sources = allData.map((item, index) => ({
      id: index + 1,
      title: item.title,
      url: item.url,
      content: item.content || item.snippet,
      fetchMethod: item.fetchMethod || 'snippet'
    }));

    this.citationCount = sources.length;

    // Chunk sources to fit within token limits (leave room for prompt + response)
    const chunkedSources = this.chunkSourcesForSynthesis(sources, 18000);

    // Separate chunked sources by type
    const fullContentSources = chunkedSources.filter(s => s.fetchMethod === 'full');
    const snippetSources = chunkedSources.filter(s => s.fetchMethod === 'snippet');

    const synthesisPrompt = `You are an expert research writer creating an EXTREMELY COMPREHENSIVE, DETAILED, and EXHAUSTIVE research report.

Query: "${query}"

Research Plan: ${plan.title}
Subtopics to cover:
${plan.subtopics.map(s => `- ${s.name}: ${s.description}`).join('\n')}

FULL CONTENT SOURCES (${fullContentSources.length} sources with complete text):
${fullContentSources.map(s => `[${s.id}] ${s.title}\nURL: ${s.url}\nContent: ${s.content}...\n`).join('\n---\n')}

${snippetSources.length > 0 ? `
SNIPPET-ONLY SOURCES (${snippetSources.length} sources with summaries):
${snippetSources.map(s => `[${s.id}] ${s.title}\nURL: ${s.url}\nSnippet: ${s.content}\n`).join('\n---\n')}
` : ''}

TOTAL SOURCES AVAILABLE: ${sources.length} (using ${chunkedSources.length} in this synthesis)

CRITICAL INSTRUCTIONS - READ CAREFULLY:

You MUST create an EXTREMELY LONG and DETAILED report. This is NOT a summary - this is a COMPREHENSIVE RESEARCH DOCUMENT.

MINIMUM LENGTH REQUIREMENT: 4000 WORDS (NOT 2000!)

DO NOT SUMMARIZE. DO NOT BE BRIEF. INCLUDE EVERY DETAIL.

Your report MUST include:

## 1. Executive Summary (500-700 words)
- Comprehensive overview of ALL major aspects
- Include specific statistics, dates, names, numbers from sources
- Multiple paragraphs covering different angles
- Use citations [1], [2], [3] for EVERY fact
- DO NOT be brief - be thorough and detailed

## 2. Historical Context and Evolution (600-800 words)
- Detailed timeline with specific dates and events
- Key pioneers and their contributions (names, years, achievements)
- Evolution through different eras
- Technological milestones
- How the field has changed over time
- Multiple paragraphs with extensive detail
- Cite sources [X] after every fact

## 3. Core Concepts and Fundamentals (800-1000 words)
- Explain EACH core concept in detail (not just list them)
- Technical definitions with examples
- Mathematical foundations where relevant
- Key algorithms and methodologies
- Tools and technologies used
- Programming languages and frameworks
- Data structures and processes
- 3-4 paragraphs PER concept
- Heavy citation usage [X]

## 4. Techniques and Methodologies (700-900 words)
- Detailed explanation of each technique
- Step-by-step processes
- When and why each technique is used
- Advantages and disadvantages
- Real-world implementation details
- Code concepts and workflows
- Best practices
- Multiple paragraphs per technique
- Cite extensively [X]

## 5. Industry Applications (800-1000 words)
- DETAILED case studies for EACH industry:
  * Healthcare: specific applications, examples, impact, statistics
  * Finance: specific applications, examples, impact, statistics
  * Retail: specific applications, examples, impact, statistics
  * Technology: specific applications, examples, impact, statistics
  * Manufacturing: specific applications, examples, impact, statistics
- For EACH industry, write 2-3 paragraphs with:
  * Specific company examples
  * Quantifiable results (percentages, dollar amounts, time saved)
  * Technical implementation details
  * Challenges faced and solutions
- Use citations [X] for every claim

## 6. Key Findings and Insights (400-600 words)
- List 12-15 major findings (not 8-10)
- EACH finding should be 3-4 sentences with:
  * The finding itself
  * Supporting evidence from sources
  * Implications and significance
  * Specific examples or statistics
- Every finding must have citations [X]

## 7. Career Paths and Roles (400-500 words)
- Detailed description of each role:
  * Data Scientist: responsibilities, skills, salary ranges, career progression
  * Data Engineer: responsibilities, skills, salary ranges, career progression
  * ML Engineer: responsibilities, skills, salary ranges, career progression
  * Data Analyst: responsibilities, skills, salary ranges, career progression
- Required skills for each role (technical and soft skills)
- Educational requirements
- Certification programs
- Career trajectory and growth opportunities
- Cite sources [X]

## 8. Tools and Technologies (500-600 words)
- Comprehensive list of tools with detailed descriptions:
  * Programming languages (Python, R, SQL, etc.) - what each is used for
  * Libraries and frameworks (pandas, scikit-learn, TensorFlow, etc.) - capabilities
  * Visualization tools (Tableau, Power BI, matplotlib, etc.) - use cases
  * Big data platforms (Hadoop, Spark, etc.) - when to use
  * Cloud platforms (AWS, Azure, GCP) - services and features
- For EACH tool: purpose, strengths, weaknesses, learning curve
- Industry adoption rates and trends
- Cite sources [X]

## 9. Challenges and Limitations (600-700 words)
- DETAILED discussion of EACH challenge:
  * Data quality issues: types, causes, solutions, examples
  * Privacy concerns: regulations, best practices, case studies
  * Algorithmic bias: sources, detection, mitigation, examples
  * Scalability issues: technical challenges, solutions
  * Interpretability: black box problem, explainable AI
  * Resource constraints: computational, financial, human
  * Integration challenges: legacy systems, organizational resistance
- For EACH challenge: 2-3 paragraphs with real examples
- Cite extensively [X]

## 10. Ethical Considerations (500-600 words)
- Data privacy: GDPR, CCPA, regulations, compliance
- Algorithmic fairness: bias detection, fairness metrics
- Transparency: explainability requirements, stakeholder communication
- Accountability: who is responsible, governance frameworks
- Real-world ethical dilemmas with case studies
- Best practices and guidelines
- Industry standards and frameworks
- Multiple paragraphs with specific examples
- Heavy citations [X]

## 11. Future Trends and Predictions (600-700 words)
- Emerging technologies with detailed explanations:
  * AutoML: capabilities, limitations, impact
  * Quantum computing: potential applications, timeline
  * Edge AI: use cases, benefits, challenges
  * Federated learning: how it works, applications
  * Explainable AI: techniques, importance
- Market predictions with specific numbers and timeframes
- Expected growth rates by sector
- Upcoming innovations and research directions
- Skills that will be in demand
- How the field will evolve (5-10 year outlook)
- Cite sources [X]

## 12. Best Practices and Recommendations (400-500 words)
- Detailed recommendations for:
  * Organizations implementing data science
  * Individuals starting in the field
  * Teams building data science capabilities
  * Leaders managing data science projects
- Step-by-step guidance
- Common pitfalls to avoid
- Success factors
- Resource allocation
- Cite sources [X]

## 13. Conclusion (300-400 words)
- Comprehensive summary tying everything together
- Key takeaways (10-12 points)
- Final thoughts on significance and impact
- Call to action or future outlook
- Cite sources [X]

FORMATTING REQUIREMENTS:
- Use ## for main sections
- Use ### for subsections within sections
- Use **bold** for key terms and emphasis
- Use bullet points for lists
- Use numbered lists for sequential items
- Use > blockquotes for important quotes or statistics
- Use inline citations [1], [2], [3] after EVERY fact, statistic, or claim

CITATION REQUIREMENTS:
- You have ${sources.length} total sources - reference them appropriately
- Use the ${chunkedSources.length} sources provided above for detailed content
- Every paragraph MUST have multiple citations
- Every statistic MUST have a citation
- Every claim MUST have a citation
- Aim for 80+ total citation references throughout the document

WRITING STYLE:
- Professional and academic tone
- Use specific numbers, dates, names, percentages
- Include technical details where appropriate
- Write for an educated audience
- Be thorough, not brief
- Expand on every point with examples
- Use transitional phrases between sections

REMEMBER: 
- MINIMUM 4000 WORDS (this is CRITICAL)
- DO NOT SUMMARIZE - INCLUDE ALL DETAILS
- EVERY source should contribute information
- MORE is better than less
- Be EXHAUSTIVE, not concise
- Think of this as a research paper, not a blog post

START WRITING NOW - MAKE IT EXTREMELY LONG AND DETAILED:`;

    // Retry logic for rate limits
    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.callOpenAIWithRetry({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: synthesisPrompt }],
          temperature: 0.7,
          max_tokens: 16000
        });

        const report = response.choices[0].message.content;
        const wordCount = Math.round(report.split(/\s+/).length);
        console.log(`[ResearchService] Report synthesized (${report.length} chars, ${wordCount} words)`);
        
        if (wordCount < 3000) {
          console.warn(`[ResearchService] ⚠️ Report is shorter than expected (${wordCount} words < 3000 target)`);
        }
        
        return {
          report,
          sources: sources.map(s => ({ id: s.id, title: s.title, url: s.url }))
        };

      } catch (error) {
        lastError = error;
        
        // Handle rate limit errors
        if (error.status === 429) {
          const isTokenLimit = error.message?.includes('tokens per min') || error.message?.includes('Request too large');
          
          if (isTokenLimit && attempt === 1) {
            // First attempt failed due to token limit - reduce sources further
            console.warn(`[ResearchService] Token limit exceeded, reducing sources...`);
            const reducedSources = this.chunkSourcesForSynthesis(sources, 12000);
            
            // Update the prompt with fewer sources
            const reducedFullContent = reducedSources.filter(s => s.fetchMethod === 'full');
            const reducedSnippets = reducedSources.filter(s => s.fetchMethod === 'snippet');
            
            const reducedPrompt = synthesisPrompt.replace(
              /FULL CONTENT SOURCES[\s\S]*?TOTAL SOURCES AVAILABLE/,
              `FULL CONTENT SOURCES (${reducedFullContent.length} sources):
${reducedFullContent.map(s => `[${s.id}] ${s.title}\nURL: ${s.url}\nContent: ${s.content}...\n`).join('\n---\n')}

${reducedSnippets.length > 0 ? `
SNIPPET-ONLY SOURCES (${reducedSnippets.length} sources):
${reducedSnippets.map(s => `[${s.id}] ${s.title}\nURL: ${s.url}\nSnippet: ${s.content}\n`).join('\n---\n')}
` : ''}

TOTAL SOURCES AVAILABLE`
            );
            
            try {
              const retryResponse = await this.callOpenAIWithRetry({
                model: 'gpt-4o',
                messages: [{ role: 'user', content: reducedPrompt }],
                temperature: 0.7,
                max_tokens: 16000
              });

              const report = retryResponse.choices[0].message.content;
              const wordCount = Math.round(report.split(/\s+/).length);
              console.log(`[ResearchService] Report synthesized with reduced sources (${report.length} chars, ${wordCount} words)`);
              
              return {
                report,
                sources: sources.map(s => ({ id: s.id, title: s.title, url: s.url }))
              };
            } catch (retryError) {
              console.error(`[ResearchService] Retry with reduced sources failed:`, retryError.message);
              lastError = retryError;
            }
          }
          
          // Wait before retrying (exponential backoff)
          if (attempt < maxRetries) {
            const waitTime = Math.min(1000 * Math.pow(2, attempt), 10000); // Max 10 seconds
            console.log(`[ResearchService] Rate limited, waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
        }
        
        // For non-rate-limit errors or final attempt, throw
        console.error('[ResearchService] Synthesis error:', error.message);
        throw error;
      }
    }

    // If all retries failed
    throw lastError || new Error('Synthesis failed after all retries');
  }

  /**
   * Main research pipeline - Agentic RAG Loop with Live Search Query Tracking
   */
  async conductResearch(query, onProgress) {
    const startTime = Date.now();
    this.searchCount = 0;
    this.citationCount = 0;
    this.visitedUrls.clear();
    
    // Track search queries for timeline events
    const searchQueryMap = new Map(); // Map of searchQueryId -> SearchQueryItem tracking

    try {
      // Stage 1: Create Research Plan
      this.emitResearchStep(onProgress, { id: 'planning', status: 'active' });
      
      const plan = await this.createResearchPlan(query, onProgress);
      
      // Emit plan created event with title
      this.emitResearchStep(onProgress, { 
        id: 'planning', 
        status: 'done',
        planTitle: plan.title || `Research: ${query.substring(0, 50)}`
      });
      
      onProgress?.({
        step: 'plan_ready',
        message: '📋 Research plan ready',
        progress: 10,
        plan: plan
      });

      // Stage 2: Iterative Research Loop (Agentic RAG)
      let allData = [];
      let iteration = 0;
      let successfulFetches = 0;
      let failedFetches = 0;
      let totalQueriesFired = 0;
      
      // Start searching phase
      this.emitResearchStep(onProgress, { 
        id: 'searching', 
        status: 'active',
        searchQueries: []
      });

      while (iteration < this.maxIterations) {
        iteration++;
        
        onProgress?.({
          step: 'searching',
          message: `🌐 Conducting searches (iteration ${iteration}/${this.maxIterations}) · ${allData.length} sources`,
          progress: 15 + (iteration * 12)
        });

        // Determine what to search
        let searchQueries = [];
        if (iteration === 1) {
          // First iteration: search based on plan
          searchQueries = plan.subtopics.slice(0, this.maxSearchesPerIteration).map(st => 
            `${query} ${st.name}`
          );
        } else {
          // Subsequent iterations: analyze and search gaps
          console.log(`[ResearchService] Analysis: Iteration ${iteration}, checking if we need more sources...`);
          const analysis = await this.analyzeProgress(query, plan, allData, iteration, onProgress);
          
          // Emit replanning indicator if we're continuing
          if (!analysis.isSufficient && allData.length < this.maxTotalSources) {
            console.log('[ResearchService] Analysis: Need more');
            this.emitResearchStep(onProgress, {
              id: 'searching',
              status: 'active',
              replanningTriggered: true
            });
          }
          
          if (analysis.isSufficient || allData.length >= this.maxTotalSources) {
            console.log('[ResearchService] Research sufficient, stopping');
            break;
          }
          
          searchQueries = analysis.nextSearches.slice(0, this.maxSearchesPerIteration);
        }

        // Execute searches
        for (const rawSearchQuery of searchQueries) {
          // Create unique ID for this search query
          const searchQueryId = `sq-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          totalQueriesFired++;
          
          // Strip user query prefix for display
          const strippedQuery = this.stripQueryPrefix(rawSearchQuery, query);
          
          console.log(`[ResearchService] Search "${strippedQuery}" starting...`);
          
          // Emit search query started event
          this.emitResearchStep(onProgress, {
            id: 'searching',
            status: 'active',
            searchQuery: {
              id: searchQueryId,
              text: strippedQuery,
              rawText: rawSearchQuery,
              status: 'active',
              sources: []
            }
          });
          
          // Execute the search
          const sources = await this.executeSearch(rawSearchQuery);
          console.log(`[ResearchService] Search "${strippedQuery}" found ${sources.length} new sources`);
          this.searchCount++;
          
          // Emit each source as it's found (domain only, stripped from URL)
          let sourceCount = 0;
          for (const source of sources) {
            const domain = this.extractDomain(source.url);
            sourceCount++;
            
            // Log fetch attempt
            console.log(`[Fetch] Attempting: ${source.url}`);
            
            // Emit source found event
            this.emitResearchStep(onProgress, {
              id: 'searching',
              status: 'active',
              searchQuery: {
                id: searchQueryId,
                text: strippedQuery,
                status: 'active',
                addSource: domain
              }
            });
            
            // Fetch content with smart fallback strategy
            const content = await this.fetchContent(source.url, source.snippet);
            
            // Log fetch result
            if (content) {
              if (content === source.snippet) {
                console.log(`[Fetch] ⚠️ Using snippet fallback`);
              } else {
                console.log(`[Fetch] ✅ Direct success`);
              }
              
              allData.push({ 
                ...source, 
                content,
                fetchMethod: content === source.snippet ? 'snippet' : 'full'
              });
              if (content !== source.snippet) {
                successfulFetches++;
              } else {
                failedFetches++;
              }
            } else {
              console.log(`[Fetch] ❌ All strategies failed`);
            }
            
            if (allData.length >= this.maxTotalSources) break;
          }
          
          // Emit search query completed event with final source count
          this.emitResearchStep(onProgress, {
            id: 'searching',
            status: 'active',
            searchQuery: {
              id: searchQueryId,
              text: strippedQuery,
              status: 'done',
              sourceCount: sourceCount
            }
          });
          
          if (allData.length >= this.maxTotalSources) break;
        }

        onProgress?.({
          step: 'fetching',
          message: `📄 Reading content (iteration ${iteration}) · ${allData.length} sources (${successfulFetches} full, ${failedFetches} snippets)`,
          progress: 20 + (iteration * 12)
        });
      }
      
      // Complete searching phase with final stats
      this.emitResearchStep(onProgress, {
        id: 'searching',
        status: 'done',
        totalSearches: totalQueriesFired,
        totalSources: allData.length
      });

      console.log(`[ResearchService] Collected ${allData.length} sources from ${totalQueriesFired} searches`);
      console.log(`[ResearchService] Fetch stats:`, this.fetchStats);
      console.log(`[ResearchService] Success: ${successfulFetches} full, ${failedFetches} snippets`);
      
      // Start analyzing phase
      this.emitResearchStep(onProgress, { 
        id: 'analyzing', 
        status: 'active'
      });
      
      // Simulate some analysis time
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Complete analyzing phase
      this.emitResearchStep(onProgress, { 
        id: 'analyzing', 
        status: 'done'
      });

      // Stage 3: Synthesize Report
      this.emitResearchStep(onProgress, { 
        id: 'synthesizing', 
        status: 'active'
      });
      
      let report, reportSources;
      
      try {
        const result = await this.synthesizeReport(query, plan, allData, onProgress);
        report = result.report;
        reportSources = result.sources;
      } catch (synthesisError) {
        console.error('[ResearchService] Synthesis failed, creating fallback report:', synthesisError.message);
        
        // Create a simpler fallback report
        report = this.createFallbackReport(query, plan, allData);
        reportSources = allData.map((item, index) => ({
          id: index + 1,
          title: item.title,
          url: item.url
        }));
        
        onProgress?.({
          step: 'warning',
          message: '⚠️ Using simplified report due to synthesis limitations',
          progress: 90
        });
      }
      
      // Complete synthesizing phase with word count
      const wordCount = Math.round(report.split(/\s+/).length);
      console.log(`[ResearchService] Report synthesized`);
      this.emitResearchStep(onProgress, { 
        id: 'synthesizing', 
        status: 'done',
        wordCount: wordCount
      });

      const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1); // minutes

      return {
        success: true,
        answer: report,
        sources: reportSources,
        plan: plan,
        metadata: {
          query,
          duration: `${duration}m`,
          searchCount: this.searchCount,
          citationCount: this.citationCount,
          sourcesAnalyzed: allData.length,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('[ResearchService] Research failed:', error);
      // Emit error state for current step
      this.emitResearchStep(onProgress, { 
        id: 'synthesizing', 
        status: 'error'
      });
      return {
        success: false,
        error: error.message,
        metadata: {
          query,
          searchCount: this.searchCount,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Create a fallback report when synthesis fails
   * Uses a simpler structure with the collected data
   */
  createFallbackReport(query, plan, allData) {
    const sources = allData.map((item, index) => ({
      id: index + 1,
      title: item.title,
      url: item.url,
      content: item.content || item.snippet
    }));

    let report = `# Research Report: ${query}\n\n`;
    report += `## Executive Summary\n\n`;
    report += `This research report was compiled from ${sources.length} sources across ${plan.subtopics.length} key areas. `;
    report += `Due to processing constraints, this is a structured summary of the collected information.\n\n`;

    // Add subtopics
    for (const subtopic of plan.subtopics) {
      report += `## ${subtopic.name}\n\n`;
      report += `${subtopic.description}\n\n`;

      // Find relevant sources for this subtopic
      const relevantSources = sources.filter(s => 
        s.title.toLowerCase().includes(subtopic.name.toLowerCase()) ||
        s.content.toLowerCase().includes(subtopic.name.toLowerCase())
      ).slice(0, 5);

      if (relevantSources.length > 0) {
        report += `### Key Findings\n\n`;
        for (const source of relevantSources) {
          const excerpt = source.content.substring(0, 300).trim();
          report += `- ${excerpt}... [${source.id}]\n\n`;
        }
      }
    }

    // Add sources section
    report += `## Sources\n\n`;
    for (const source of sources) {
      report += `[${source.id}] [${source.title}](${source.url})\n\n`;
    }

    report += `\n---\n\n`;
    report += `*Note: This report was generated with a simplified structure due to processing limitations. `;
    report += `The information is based on ${sources.length} verified sources.*\n`;

    return report;
  }

  clearCache() {
    this.contentCache.clear();
    this.visitedUrls.clear();
    this.fetchStats = {
      firecrawl: 0,
      jina: 0,
      direct: 0,
      snippet: 0,
      failed: 0
    };
  }
}

module.exports = ResearchService;
