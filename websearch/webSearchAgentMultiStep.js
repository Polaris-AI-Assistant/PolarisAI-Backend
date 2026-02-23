/**
 * Web Search Agent - Research & Synthesis Pipeline
 * 
 * This is a TRUE research agent, not a search-results dumper.
 * 
 * 4-STAGE RESEARCH PIPELINE:
 * ===========================
 * Stage 1: Search (Discovery) - Find relevant URLs using Serper API
 * Stage 2: Fetch & Extract - Get actual page content, clean it
 * Stage 3: Synthesize - LLM combines sources into structured knowledge
 * Stage 4: Act - Pass synthesized content to other agents (docs, email, etc.)
 * 
 * CRITICAL PRINCIPLE:
 * Search results are REFERENCES. Only synthesized knowledge reaches the user.
 */

const BaseAgent = require('../base/BaseAgent');
const webSearchService = require('./webSearchService');
const contentExtractor = require('./contentExtractor');
const OpenAI = require('openai');

class WebSearchAgentMultiStep extends BaseAgent {
  constructor(llmClient) {
    const tools = {
      // ========== STAGE 1: SEARCH (DISCOVERY) ==========
      searchWeb: {
        definition: {
          type: 'function',
          function: {
            name: 'searchWeb',
            description: 'STAGE 1: Search the web to discover relevant URLs. This returns search metadata ONLY - not final content. Always follow with fetchAndSynthesize to get actual information.',
            parameters: {
              type: 'object',
              properties: {
                query: { 
                  type: 'string', 
                  description: 'The search query string' 
                },
                num: { 
                  type: 'number', 
                  description: 'Number of search results to return (1-10, default: 5)', 
                  default: 5 
                }
              },
              required: ['query']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`\n[WebSearchAgent] ========== STAGE 1: SEARCH (DISCOVERY) ==========`);
          console.log(`[WebSearchAgent] 🔍 Query: "${params.query}"`);
          
          try {
            const results = await webSearchService.searchWeb({
              ...params,
              num: Math.min(params.num || 5, 10)  // Limit to max 10
            });
            
            const topResults = (results.organic || []).slice(0, 5);
            console.log(`[WebSearchAgent] ✅ Found ${topResults.length} relevant URLs`);
            
            // Return ONLY metadata - not final content
            return {
              success: true,
              stage: 'discovery',
              query: params.query,
              totalResults: topResults.length,
              urls: topResults.map(r => r.link),
              metadata: topResults.map(r => ({
                title: r.title,
                url: r.link,
                snippet: r.snippet
              })),
              instruction: 'CRITICAL: These are search results (metadata only). You MUST call fetchAndSynthesize next to get actual content and synthesize it. Do NOT return these search results as final output.'
            };
          } catch (error) {
            console.error(`[WebSearchAgent] ❌ Search error:`, error.message);
            throw error;
          }
        }
      },

      // ========== STAGES 2 & 3: FETCH + SYNTHESIZE ==========
      fetchAndSynthesize: {
        definition: {
          type: 'function',
          function: {
            name: 'fetchAndSynthesize',
            description: 'STAGES 2 & 3: Fetch actual web page content from URLs, extract clean text, and synthesize into structured knowledge. This is the REQUIRED second step after searchWeb.',
            parameters: {
              type: 'object',
              properties: {
                urls: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Array of URLs to fetch and synthesize (max 5)'
                },
                query: {
                  type: 'string',
                  description: 'Original user query to guide synthesis'
                },
                synthesisGoal: {
                  type: 'string',
                  description: 'What to extract/synthesize (e.g., "restaurant information", "research paper summaries", "news highlights")'
                }
              },
              required: ['urls', 'query']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`\n[WebSearchAgent] ========== STAGES 2 & 3: FETCH + SYNTHESIZE ==========`);
          console.log(`[WebSearchAgent] 📚 Fetching ${params.urls.length} URLs...`);
          
          try {
            // STAGE 2: Fetch & Extract
            const urls = params.urls.slice(0, 5);  // Limit to 5 sources
            const extractedPages = await contentExtractor.extractMultiple(urls, 8000);
            
            const successfulPages = extractedPages.filter(p => p.success && p.content);
            console.log(`[WebSearchAgent] ✅ Successfully extracted ${successfulPages.length}/${urls.length} pages`);
            
            if (successfulPages.length === 0) {
              return {
                success: false,
                error: 'Could not extract content from any URLs',
                stage: 'extraction_failed'
              };
            }

            // STAGE 3: Synthesize with LLM
            console.log(`[WebSearchAgent] 🧠 Synthesizing content...`);
            
            const synthesisPrompt = this.buildSynthesisPrompt(
              params.query,
              params.synthesisGoal || 'relevant information',
              successfulPages
            );

            const llm = context.llm || this.llm;
            const synthesisResponse = await llm.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                {
                  role: 'system',
                  content: 'You are a research synthesis expert. Your job is to read multiple web sources and synthesize them into structured, coherent knowledge. Extract key information, remove duplicates, and organize clearly.'
                },
                {
                  role: 'user',
                  content: synthesisPrompt
                }
              ],
              temperature: 0.3,
              max_tokens: 2000
            });

            const synthesizedContent = synthesisResponse.choices[0].message.content;
            
            console.log(`[WebSearchAgent] ✅ Synthesis complete (${synthesizedContent.length} chars)`);

            return {
              success: true,
              stage: 'synthesized',
              query: params.query,
              synthesizedContent: synthesizedContent,
              sourcesUsed: successfulPages.length,
              sources: successfulPages.map(p => ({
                title: p.title,
                url: p.url
              })),
              instruction: 'This is synthesized knowledge from multiple sources. Use this as your final output or pass to document creation.'
            };

          } catch (error) {
            console.error(`[WebSearchAgent] ❌ Fetch/Synthesis error:`, error.message);
            throw error;
          }
        }
      },

      // ========== CONVENIENCE: ALL-IN-ONE RESEARCH ==========
      researchAndSynthesize: {
        definition: {
          type: 'function',
          function: {
            name: 'researchAndSynthesize',
            description: 'ALL-IN-ONE: Search, fetch, and synthesize in one step. Use this for complete research tasks.',
            parameters: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The research query'
                },
                synthesisGoal: {
                  type: 'string',
                  description: 'What to extract/synthesize from sources'
                },
                numSources: {
                  type: 'number',
                  description: 'Number of sources to use (1-5, default: 3)',
                  default: 3
                }
              },
              required: ['query']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`\n[WebSearchAgent] ========== ALL-IN-ONE RESEARCH ==========`);
          console.log(`[WebSearchAgent] 🔬 Research query: "${params.query}"`);
          
          try {
            // Stage 1: Search
            const searchResults = await webSearchService.searchWeb({
              query: params.query,
              num: 10
            });
            
            const topUrls = (searchResults.organic || [])
              .slice(0, params.numSources || 3)
              .map(r => r.link);
            
            console.log(`[WebSearchAgent] 📍 Selected ${topUrls.length} sources`);

            // Stages 2 & 3: Fetch + Synthesize
            const extractedPages = await contentExtractor.extractMultiple(topUrls, 8000);
            const successfulPages = extractedPages.filter(p => p.success && p.content);
            
            if (successfulPages.length === 0) {
              return {
                success: false,
                error: 'Could not extract content from any sources',
                stage: 'extraction_failed'
              };
            }

            console.log(`[WebSearchAgent] 🧠 Synthesizing from ${successfulPages.length} sources...`);
            
            const synthesisPrompt = this.buildSynthesisPrompt(
              params.query,
              params.synthesisGoal || 'relevant information',
              successfulPages
            );

            const llm = context.llm || this.llm;
            const synthesisResponse = await llm.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                {
                  role: 'system',
                  content: 'You are a research synthesis expert. Extract key information from multiple sources, remove duplicates, and organize into clear, structured content.'
                },
                {
                  role: 'user',
                  content: synthesisPrompt
                }
              ],
              temperature: 0.3,
              max_tokens: 2000
            });

            const synthesizedContent = synthesisResponse.choices[0].message.content;
            
            console.log(`[WebSearchAgent] ✅ Research complete!`);

            return {
              success: true,
              stage: 'complete',
              query: params.query,
              synthesizedContent: synthesizedContent,
              sourcesUsed: successfulPages.length,
              sources: successfulPages.map(p => ({
                title: p.title,
                url: p.url
              }))
            };

          } catch (error) {
            console.error(`[WebSearchAgent] ❌ Research error:`, error.message);
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
   * Build synthesis prompt for LLM
   */
  buildSynthesisPrompt(query, goal, pages) {
    let prompt = `User Query: "${query}"\n`;
    prompt += `Synthesis Goal: Extract and organize ${goal}\n\n`;
    prompt += `I have fetched content from ${pages.length} web sources. Please:\n`;
    prompt += `1. Read all sources carefully\n`;
    prompt += `2. Extract key information relevant to the query\n`;
    prompt += `3. Remove duplicate information\n`;
    prompt += `4. Synthesize into clear, structured content\n`;
    prompt += `5. Organize with headers and sections\n`;
    prompt += `6. Do NOT just list the sources - synthesize the knowledge\n\n`;
    prompt += `Sources:\n\n`;

    pages.forEach((page, index) => {
      prompt += `--- SOURCE ${index + 1}: ${page.title} ---\n`;
      prompt += `URL: ${page.url}\n`;
      prompt += `Content:\n${page.content.substring(0, 3000)}\n\n`;
    });

    prompt += `\nNow synthesize this information into structured, coherent content that directly answers the user's query.`;
    prompt += `\nFormat with markdown (headers, bullet points, etc.) for readability.`;
    prompt += `\nOptionally cite sources at the end if relevant.`;

    return prompt;
  }

  /**
   * Get system prompt for the web search agent
   */
  getSystemPrompt() {
    return `You are a Web Research & Synthesis Agent.

**CRITICAL ARCHITECTURE:**

You operate as a 4-STAGE RESEARCH PIPELINE:

STAGE 1: SEARCH (Discovery)
- Use searchWeb to find relevant URLs
- This returns metadata ONLY (titles, snippets, links)
- This is NOT final output

STAGE 2: FETCH (Content Extraction)
- Automatically happens in fetchAndSynthesize
- Fetches actual web page content
- Cleans HTML, removes ads/navigation

STAGE 3: SYNTHESIZE (Knowledge Creation)
- LLM reads all sources
- Extracts relevant information
- Removes duplicates
- Creates structured, coherent output
- This IS the final content

STAGE 4: ACT (Delivery)
- Pass synthesized content to user or other agents
- Never pass raw search results

**EXECUTION RULES:**

1. For ANY research query, you MUST:
   - Call searchWeb first (Stage 1)
   - Then call fetchAndSynthesize (Stages 2 & 3)
   - Return synthesized content (Stage 4)

2. NEVER return search results as final output
   - Search results are references, not answers
   - Always synthesize before responding

3. Use researchAndSynthesize for convenience
   - Does all stages in one call
   - Recommended for most queries

**EXAMPLE FLOW:**

User: "Find information about machine learning papers"

WRONG:
- searchWeb → return titles/links ❌

CORRECT:
- researchAndSynthesize → return synthesized knowledge ✅

OR:
- searchWeb → get URLs
- fetchAndSynthesize → get synthesized content ✅

**OUTPUT FORMAT:**

Your synthesized content should be:
- Structured with headers
- Organized by topic/category
- Free of duplicate information
- Directly answering the query
- Optionally citing sources at end

Remember: You are a RESEARCH agent, not a search engine. Synthesize knowledge, don't dump links.`;
  }
}

module.exports = WebSearchAgentMultiStep;
