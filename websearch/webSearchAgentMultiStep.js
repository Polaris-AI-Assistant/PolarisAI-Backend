/**
 * Web Search Agent - Multi-Step Execution Version
 * Extends BaseAgent to support sequential multi-step operations.
 */

const BaseAgent = require('../base/BaseAgent');
const webSearchService = require('./webSearchService');
const OpenAI = require('openai');

class WebSearchAgentMultiStep extends BaseAgent {
  constructor(llmClient) {
    const tools = {
      searchWeb: {
        definition: {
          type: 'function',
          function: {
            name: 'searchWeb',
            description: 'Search the web for information, websites, and articles using Serper API. After calling this, you MUST synthesize the results into a conversational response for the user.',
            parameters: {
              type: 'object',
              properties: {
                query: { 
                  type: 'string', 
                  description: 'The search query string' 
                },
                num: { 
                  type: 'number', 
                  description: 'Number of search results to return (1-100)', 
                  default: 10 
                },
                location: { 
                  type: 'string', 
                  description: 'Location for localized results (e.g., "United States", "India")' 
                },
                gl: { 
                  type: 'string', 
                  description: 'Country code for results (e.g., "us", "in")' 
                },
                hl: { 
                  type: 'string', 
                  description: 'Language code for results (e.g., "en", "hi")' 
                }
              },
              required: ['query']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[WebSearchAgent] 🔍 Searching web for: "${params.query}"`);
          try {
            const results = await webSearchService.searchWeb(params);
            console.log(`[WebSearchAgent] ✅ Found ${results.organic?.length || 0} results`);
            
            // Format results in a way that's easy for LLM to synthesize
            const formattedResults = {
              success: true,
              query: params.query,
              totalResults: results.organic?.length || 0,
              answerBox: results.answerBox || null,
              knowledgeGraph: results.knowledgeGraph || null,
              topResults: (results.organic || []).slice(0, 5).map(r => ({
                title: r.title,
                snippet: r.snippet,
                link: r.link,
                date: r.date || null
              })),
              instruction: 'IMPORTANT: Synthesize these search results into a conversational, user-friendly response. Do NOT return raw bullet points. Answer the user\'s question naturally using information from these results.'
            };
            
            return formattedResults;
          } catch (error) {
            console.error(`[WebSearchAgent] ❌ Error searching web:`, error.message);
            throw error;
          }
        }
      },

      searchNews: {
        definition: {
          type: 'function',
          function: {
            name: 'searchNews',
            description: 'Search for news articles and current events using Serper API. After calling this, you MUST synthesize the results into a conversational response for the user.',
            parameters: {
              type: 'object',
              properties: {
                query: { 
                  type: 'string', 
                  description: 'The news search query' 
                },
                num: { 
                  type: 'number', 
                  description: 'Number of news results to return', 
                  default: 10 
                },
                location: { 
                  type: 'string', 
                  description: 'Location for localized news (e.g., "United States", "India")' 
                }
              },
              required: ['query']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[WebSearchAgent] 📰 Searching news for: "${params.query}"`);
          try {
            const results = await webSearchService.searchNews(params);
            console.log(`[WebSearchAgent] ✅ Found ${results.news?.length || 0} news articles`);
            
            // Format results for LLM synthesis
            const formattedResults = {
              success: true,
              query: params.query,
              totalResults: results.news?.length || 0,
              topNews: (results.news || []).slice(0, 5).map(n => ({
                title: n.title,
                snippet: n.snippet,
                link: n.link,
                source: n.source,
                date: n.date || null
              })),
              instruction: 'IMPORTANT: Synthesize these news results into a conversational, user-friendly response. Do NOT return raw bullet points. Present the news naturally.'
            };
            
            return formattedResults;
          } catch (error) {
            console.error(`[WebSearchAgent] ❌ Error searching news:`, error.message);
            throw error;
          }
        }
      },

      searchImages: {
        definition: {
          type: 'function',
          function: {
            name: 'searchImages',
            description: 'Search for images and visual content using Serper API',
            parameters: {
              type: 'object',
              properties: {
                query: { 
                  type: 'string', 
                  description: 'The image search query' 
                },
                num: { 
                  type: 'number', 
                  description: 'Number of image results to return', 
                  default: 10 
                }
              },
              required: ['query']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[WebSearchAgent] 🖼️ Searching images for: "${params.query}"`);
          try {
            const results = await webSearchService.searchImages(params);
            console.log(`[WebSearchAgent] ✅ Found ${results.images?.length || 0} images`);
            return { 
              success: true, 
              results: results,
              images: results.images || [],
              count: results.images?.length || 0
            };
          } catch (error) {
            console.error(`[WebSearchAgent] ❌ Error searching images:`, error.message);
            throw error;
          }
        }
      }
    };

    // Initialize the base agent with tools
    const openai = llmClient || new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    super('websearch', tools, openai);
  }

  /**
   * Get system prompt for the web search agent
   */
  getSystemPrompt() {
    const now = new Date();
    const currentDateStr = now.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });

    return `You are a Web Search AI Assistant specialized in finding information on the internet and presenting it in a conversational, user-friendly way.

**CRITICAL LANGUAGE REQUIREMENT:**
- ALWAYS respond in the SAME LANGUAGE as the user's query
- If user writes in English, respond in English
- If user writes in Hindi, respond in Hindi
- Match the user's language EXACTLY

**Current date: ${currentDateStr}**

Your capabilities:
- **searchWeb**: Find websites, articles, and general information
- **searchNews**: Find recent news articles and current events
- **searchImages**: Find images and visual content

**CRITICAL RESPONSE FORMATTING RULES:**

1. **NEVER return raw search results as bullet points**
   - ❌ BAD: "Title: X, Source: Y, Date: Z, Snippet: ..."
   - ✅ GOOD: "Yes! The India AI Impact Summit 2026 was the most recent major AI summit in Delhi. Here are the key details: ..."

2. **Synthesize information into conversational responses**
   - Read through ALL search results
   - Extract the most relevant information
   - Combine information from multiple sources
   - Present it as a natural, flowing response
   - Answer the user's question directly

3. **Structure your response like a human would:**
   - Start with a direct answer to the question
   - Provide key details in organized sections
   - Use headers, bullet points, and formatting for readability
   - Include specific facts, dates, numbers, and names
   - End with additional context or related information if helpful

4. **After calling searchWeb/searchNews:**
   - DO NOT call any more tools
   - Immediately synthesize the results into a conversational response
   - Present the information in a user-friendly format
   - Stop execution (don't call tools again)

**Example of GOOD response format:**

User: "do you know about the AI summit happening in Delhi?"

After searchWeb returns results, you should respond:

"Yes! The **India AI Impact Summit 2026** was the most recent major AI summit in Delhi. Here are the key details:

## Event Overview
- **Dates:** February 16-21, 2026 (extended to 6 days due to high demand)
- **Venue:** Bharat Mandapam, Delhi
- **Inaugurated by:** PM Narendra Modi

## Scale & Attendance
- Over **100 countries** participated
- **20+ heads of state**
- **40+ tech CEOs**
- **250,000+ guests**

## Key Highlights
- Focus on AI governance and ethical AI development
- Major announcements from tech companies about AI investments in India
- Discussions on AI's role in solving global challenges

This was a landmark event showcasing India's growing role in the global AI ecosystem."

**Guidelines:**
1. Use clear and specific search queries
2. Present the most relevant results first
3. Synthesize key information from search results into natural language
4. Highlight answer boxes and knowledge graphs when available
5. Be helpful, conversational, and proactive
6. Format responses with headers, bullet points, and emphasis for readability
7. Include sources at the end if user might want to verify information

**Format elements you can use:**
- Headers (##) for sections
- Bullet points for lists
- **Bold** for emphasis
- Specific facts, dates, and numbers
- Natural, flowing sentences

Remember: You are a conversational AI assistant, not a search results aggregator. Transform raw search data into helpful, human-friendly responses!`;
  }
}

module.exports = WebSearchAgentMultiStep;
