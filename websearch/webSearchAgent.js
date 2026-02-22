/**
 * Web Search AI Agent
 * 
 * An intelligent agent that processes natural language queries and performs web searches
 * using the Serper API. Supports general web search, news search, and image search.
 */

const OpenAI = require('openai');
const webSearchService = require('./webSearchService');

/**
 * Web Search Agent Class
 * Handles natural language queries for web searches
 */
class WebSearchAgent {
  constructor() {
    // Initialize OpenAI client with API key from environment
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Define available tools/functions that the agent can use
    this.tools = this.defineTools();
    
    // Map function names to actual implementations
    this.functionMap = this.createFunctionMap();

    // System prompt that defines the agent's behavior and capabilities
    this.systemPrompt = this.createSystemPrompt();
  }

  /**
   * Define OpenAI function schemas for web search tools
   */
  defineTools() {
    return [
      {
        type: "function",
        function: {
          name: "searchWeb",
          description: "Perform a general web search using Serper API. Use this when the user wants to search for information, websites, articles, or general content on the internet.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "The search query string"
              },
              num: {
                type: "number",
                description: "Number of search results to return (1-100). Defaults to 10."
              },
              location: {
                type: "string",
                description: "Location for localized results (e.g., 'United States', 'India', 'United Kingdom')"
              },
              gl: {
                type: "string",
                description: "Country code for results (e.g., 'us', 'in', 'uk')"
              },
              hl: {
                type: "string",
                description: "Language code for results (e.g., 'en', 'hi', 'es')"
              }
            },
            required: ["query"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "searchNews",
          description: "Search for news articles using Serper API. Use this when the user wants to find recent news, current events, or news articles about a specific topic.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "The news search query"
              },
              num: {
                type: "number",
                description: "Number of news results to return. Defaults to 10."
              },
              location: {
                type: "string",
                description: "Location for localized news (e.g., 'United States', 'India')"
              }
            },
            required: ["query"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "searchImages",
          description: "Search for images using Serper API. Use this when the user wants to find images, photos, or visual content.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "The image search query"
              },
              num: {
                type: "number",
                description: "Number of image results to return. Defaults to 10."
              }
            },
            required: ["query"]
          }
        }
      }
    ];
  }

  /**
   * Create mapping between function names and their implementations
   */
  createFunctionMap() {
    return {
      'searchWeb': async (userId, params) => {
        try {
          const data = await webSearchService.searchWeb(params);
          return {
            success: true,
            data: data,
            message: `Found web search results for: "${params.query}"`
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      },
      'searchNews': async (userId, params) => {
        try {
          const data = await webSearchService.searchNews(params);
          return {
            success: true,
            data: data,
            message: `Found news articles for: "${params.query}"`
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      },
      'searchImages': async (userId, params) => {
        try {
          const data = await webSearchService.searchImages(params);
          return {
            success: true,
            data: data,
            message: `Found images for: "${params.query}"`
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }
    };
  }

  /**
   * Create system prompt that defines the agent's behavior
   */
  createSystemPrompt() {
    const now = new Date();
    const currentDateStr = now.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
    
    return `You are a helpful Web Search AI Assistant that helps users find information on the internet.

**CRITICAL LANGUAGE REQUIREMENT:**
- ALWAYS respond in the SAME LANGUAGE as the user's query
- If user writes in English, respond in English
- If user writes in Hindi, respond in Hindi
- If user writes in Spanish, respond in Spanish
- Match the user's language EXACTLY - do not translate or switch languages

**IMPORTANT - Current date is ${currentDateStr}**. Use this as reference for any time-sensitive queries.

Your capabilities include:
- **Web Search**: Find websites, articles, and general information on the internet
- **News Search**: Find recent news articles and current events
- **Image Search**: Find images and visual content
- **Information Retrieval**: Help users discover and access online information

**Available Tools:**
1. **searchWeb**: General web search. Use when user wants to:
   - Find information about any topic
   - Search for websites or articles
   - Look up facts, definitions, or explanations
   - Discover resources or content online
   - Get general information

2. **searchNews**: News search. Use when user wants to:
   - Find recent news articles
   - Get updates on current events
   - Search for news about specific topics
   - Find breaking news or latest developments

3. **searchImages**: Image search. Use when user wants to:
   - Find images or photos
   - Look for visual content
   - Search for pictures of specific things
   - Discover visual resources

**RESPONSE FORMATTING GUIDELINES:**
1. Always respond in a professional, conversational, and helpful tone
2. Use proper formatting with emojis for better readability:
   - 🔍 for search-related information
   - 📰 for news articles
   - 🖼️ for images
   - 🌐 for websites
   - 💡 for insights or tips
   - ⭐ for top/recommended results
   - 📌 for important information
3. When showing search results, format them clearly with:
   - **Title**: The title of the result
   - **Link**: The URL
   - **Snippet**: Brief description or excerpt
   - **Source**: Website or publication name (if available)
4. Highlight the most relevant results first
5. Keep responses concise but informative
6. If there's an answer box or knowledge graph, present that information prominently
7. Include "People Also Ask" questions when relevant
8. Suggest related searches when appropriate

**Search Quality Guidelines:**
1. Use clear and specific search queries
2. For localized results, specify location when relevant
3. For news, focus on recent and credible sources
4. Present results in order of relevance
5. Summarize key findings when appropriate
6. Provide context for search results

**Guidelines:**
1. Always confirm what the user is searching for
2. Provide the most relevant results first
3. Summarize key information from search results
4. Offer to search for more specific information if needed
5. Be helpful and proactive in suggesting related searches
6. Respect user privacy and search intent

Remember: You help users find accurate and relevant information from the web!`;
  }

  /**
   * Main method to process user queries
   * 
   * @param {string} query - Natural language query from the user
   * @param {string} userId - User ID
   * @param {Object} options - Additional options (conversationHistory, forceToolExecution)
   * @returns {Promise<Object>} Processed response with search results
   */
  async processQuery(query, userId, options = {}) {
    try {
      console.log(`[WebSearchAgent] Processing query: "${query}"`);

      // If forceToolExecution is set, directly execute the tool without LLM
      if (options.forceToolExecution && options.forceToolExecution.toolName && options.forceToolExecution.params) {
        const toolName = options.forceToolExecution.toolName;
        const params = options.forceToolExecution.params;
        
        console.log(`[WebSearchAgent] Force executing tool: ${toolName}`);
        console.log(`[WebSearchAgent] With params:`, JSON.stringify(params, null, 2));
        
        const functionToCall = this.functionMap[toolName];
        if (!functionToCall) {
          throw new Error(`Unknown function: ${toolName}`);
        }

        const result = await functionToCall(userId, params);
        
        return {
          success: true,
          response: result.success ? result.message : result.error,
          query: query,
          tools_used: [{
            name: toolName,
            arguments: params
          }],
          raw_results: [result],
          timestamp: new Date().toISOString()
        };
      }

      // Build messages array with conversation history if provided
      const messages = [
        {
          role: "system",
          content: this.systemPrompt
        }
      ];

      // Add conversation history if provided
      if (options.conversationHistory && Array.isArray(options.conversationHistory)) {
        messages.push(...options.conversationHistory);
      }

      // Add current query
      messages.push({
        role: "user",
        content: query
      });

      // Call OpenAI with function calling enabled
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messages,
        tools: this.tools,
        tool_choice: "auto",
        max_tokens: 2000,
        temperature: 0.3
      });

      const message = response.choices[0].message;

      // Check if OpenAI wants to call any functions
      if (message.tool_calls && message.tool_calls.length > 0) {
        return await this.handleToolCalls(message.tool_calls, userId, query, messages);
      } else {
        // No tools needed, return direct response
        return {
          success: true,
          response: message.content,
          query: query,
          tools_used: [],
          timestamp: new Date().toISOString()
        };
      }

    } catch (error) {
      console.error('[WebSearchAgent] Error processing query:', error);
      return this.handleError(error, query);
    }
  }

  /**
   * Execute tool calls requested by OpenAI
   */
  async handleToolCalls(toolCalls, userId, originalQuery, conversationHistory) {
    try {
      console.log(`[WebSearchAgent] Executing ${toolCalls.length} tool call(s)`);

      const toolResults = [];
      const toolsUsed = [];

      // Execute each tool call
      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        console.log(`[WebSearchAgent] Calling function: ${functionName}`, functionArgs);

        toolsUsed.push({
          name: functionName,
          arguments: functionArgs
        });

        // Get the function from our map
        const functionToCall = this.functionMap[functionName];

        if (!functionToCall) {
          throw new Error(`Function ${functionName} not found`);
        }

        // Call the function
        let result;
        try {
          result = await functionToCall(userId, functionArgs);
        } catch (funcError) {
          console.error(`[WebSearchAgent] Error in ${functionName}:`, funcError);
          result = { success: false, error: funcError.message };
        }

        toolResults.push({
          tool_call_id: toolCall.id,
          role: "tool",
          name: functionName,
          content: JSON.stringify(result)
        });
      }

      // Send tool results back to OpenAI for final response
      const finalMessages = [
        ...conversationHistory,
        {
          role: "assistant",
          content: null,
          tool_calls: toolCalls
        },
        ...toolResults
      ];

      const finalResponse = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: finalMessages,
        max_tokens: 2000,
        temperature: 0.5
      });

      return {
        success: true,
        response: finalResponse.choices[0].message.content,
        query: originalQuery,
        tools_used: toolsUsed,
        raw_results: toolResults.map(r => JSON.parse(r.content)),
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('[WebSearchAgent] Error handling tool calls:', error);
      return this.handleError(error, originalQuery);
    }
  }

  /**
   * Handle errors gracefully
   */
  handleError(error, query) {
    const errorMessage = error.message || 'An unknown error occurred';
    
    let userFriendlyMessage = 'I encountered an error while searching. ';
    
    if (errorMessage.includes('SERPER_API_KEY')) {
      userFriendlyMessage += 'The web search service is not configured. Please contact support.';
    } else if (errorMessage.includes('Rate limit')) {
      userFriendlyMessage += 'Too many requests. Please try again in a moment.';
    } else if (errorMessage.includes('timeout')) {
      userFriendlyMessage += 'The search is taking too long. Please try again.';
    } else if (errorMessage.includes('Invalid request')) {
      userFriendlyMessage += 'Please check your search query and try again.';
    } else {
      userFriendlyMessage += `Error: ${errorMessage}`;
    }

    return {
      success: false,
      response: userFriendlyMessage,
      query: query,
      error: errorMessage,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = WebSearchAgent;
