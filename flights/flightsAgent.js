/**
 * Flights AI Agent using OpenAI
 * 
 * This agent provides intelligent flight search functionality using natural language queries.
 * It uses SerpAPI Google Flights to search for flights and provides price insights.
 * 
 * Features:
 * - Natural language query processing
 * - Flight search between cities/airports
 * - Price insights and trends
 * - Support for one-way and round-trip searches
 * - Multi-currency support
 * 
 * Usage:
 * const agent = new FlightsAgent();
 * const result = await agent.processQuery("find flights from Mumbai to Delhi on Dec 15", userId);
 */

const OpenAI = require('openai');
const flightsService = require('./flightsService');

class FlightsAgent {
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
   * Define OpenAI function schemas for flight tools
   * These schemas help the AI understand when and how to use each tool
   */
  defineTools() {
    return [
      {
        type: "function",
        function: {
          name: "getFlightsList",
          description: "Search available flights using SerpAPI Google Flights. Use this when the user wants to find, search, or compare flights between cities/airports on specific dates.",
          parameters: {
            type: "object",
            properties: {
              from: {
                type: "string",
                description: "Departure city or airport code (e.g., BOM, Mumbai, JFK, New York)"
              },
              to: {
                type: "string",
                description: "Arrival city or airport code (e.g., DEL, New Delhi, LAX, Los Angeles)"
              },
              date: {
                type: "string",
                description: "Outbound date in YYYY-MM-DD format"
              },
              returnDate: {
                type: "string",
                description: "Return date in YYYY-MM-DD format (optional, for round-trip flights)"
              },
              currency: {
                type: "string",
                description: "Currency code (e.g., INR, USD, EUR). Defaults to INR."
              },
              travelers: {
                type: "number",
                description: "Number of adult travelers. Defaults to 1."
              }
            },
            required: ["from", "to", "date"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getFlightsPriceInsights",
          description: "Get price insights and trends for flights using SerpAPI Google Flights. Use this when the user wants to know about price trends, cheapest days to fly, or when to book for the best deals.",
          parameters: {
            type: "object",
            properties: {
              from: {
                type: "string",
                description: "Departure city or airport code"
              },
              to: {
                type: "string",
                description: "Arrival city or airport code"
              },
              date: {
                type: "string",
                description: "Outbound date in YYYY-MM-DD format"
              }
            },
            required: ["from", "to", "date"]
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
      'getFlightsList': async (userId, params) => {
        try {
          const data = await flightsService.searchFlights(params);
          return {
            success: true,
            data: data,
            message: `Found flights from ${params.from} to ${params.to} on ${params.date}`
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      },
      'getFlightsPriceInsights': async (userId, params) => {
        try {
          const data = await flightsService.getFlightsPriceInsights(params);
          return {
            success: true,
            data: data,
            message: `Retrieved price insights for flights from ${params.from} to ${params.to}`
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
    // Get current date dynamically
    const now = new Date();
    const currentDateStr = now.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
    
    return `You are a helpful Flight Search AI Assistant that helps users find and compare flights.

**IMPORTANT - Current date is ${currentDateStr}**. Use this as reference for any date-related queries like "tomorrow", "next week", "next month".

Your capabilities include:
- **Flight Search**: Find available flights between any two cities/airports
- **Price Comparison**: Compare prices across different airlines and flight options
- **Price Insights**: Provide information about price trends and best times to book
- **Route Planning**: Help users plan their air travel with departure and arrival details

**Available Tools:**
1. **getFlightsList**: Search for available flights. Use when user wants to:
   - Find flights between cities
   - Compare flight options
   - Search for specific dates
   - Check flight availability

2. **getFlightsPriceInsights**: Get price trends and insights. Use when user wants to:
   - Know the cheapest days to fly
   - Understand price trends
   - Find best booking times
   - Compare price patterns

**RESPONSE FORMATTING GUIDELINES:**
1. Always respond in a professional, conversational, and friendly tone
2. Use proper formatting with emojis for better readability:
   - ✈️ for flight-related information
   - 💰 for price information
   - ⏰ for timing/duration
   - 🛫 for departures
   - 🛬 for arrivals
   - ⭐ for best/recommended options
   - 💡 for tips and insights
3. When showing flights, format them clearly with:
   - **Airline**: carrier name
   - **Price**: cost with currency
   - **Duration**: total flight time
   - **Departure**: time and airport
   - **Arrival**: time and airport
   - **Stops**: direct or number of stops
4. Highlight the best options first
5. Keep responses concise but informative

**AIRPORT CODE REFERENCE:**
Common Indian airports:
- Mumbai: BOM
- Delhi: DEL
- Bangalore: BLR
- Chennai: MAA
- Kolkata: CCU
- Hyderabad: HYD
- Pune: PNQ
- Ahmedabad: AMD
- Goa: GOI
- Jaipur: JAI

Common International airports:
- New York JFK: JFK
- Los Angeles: LAX
- London Heathrow: LHR
- Dubai: DXB
- Singapore: SIN
- Hong Kong: HKG
- Tokyo Narita: NRT
- Sydney: SYD
- Paris CDG: CDG
- Frankfurt: FRA

**DATE HANDLING:**
- For "tomorrow", add 1 day to current date
- For "next week", add 7 days
- For day names like "next Friday", calculate the upcoming date
- Always convert to YYYY-MM-DD format

**Guidelines:**
1. Always confirm the search parameters with the user
2. Provide price in the requested or default currency (INR)
3. Highlight direct flights when available
4. Mention layover details for connecting flights
5. Suggest alternative dates if prices seem high
6. Be helpful and proactive in suggesting options

Remember: You help users find the best flights for their travel needs!`;
  }

  /**
   * Main method to process user queries
   * 
   * @param {string} query - Natural language query from the user
   * @param {string} userId - User ID (not used for flights but kept for consistency)
   * @param {Object} options - Additional options (conversationHistory, forceToolExecution)
   * @returns {Promise<Object>} Processed response with flight data
   */
  async processQuery(query, userId, options = {}) {
    try {
      console.log(`[FlightsAgent] Processing query: "${query}"`);

      // If forceToolExecution is set, directly execute the tool without LLM
      if (options.forceToolExecution && options.forceToolExecution.toolName && options.forceToolExecution.params) {
        const toolName = options.forceToolExecution.toolName;
        const params = options.forceToolExecution.params;
        
        console.log(`[FlightsAgent] Force executing tool: ${toolName}`);
        console.log(`[FlightsAgent] With params:`, JSON.stringify(params, null, 2));
        
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

      // Add conversation history if provided (for context continuity)
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
      console.error('[FlightsAgent] Error processing query:', error);
      return this.handleError(error, query);
    }
  }

  /**
   * Execute tool calls requested by OpenAI
   */
  async handleToolCalls(toolCalls, userId, originalQuery, conversationHistory) {
    try {
      console.log(`[FlightsAgent] Executing ${toolCalls.length} tool call(s)`);

      const toolResults = [];
      const toolsUsed = [];

      // Execute each tool call
      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        console.log(`[FlightsAgent] Calling function: ${functionName}`, functionArgs);

        toolsUsed.push({
          name: functionName,
          arguments: functionArgs
        });

        // Get the function from our map
        const functionToCall = this.functionMap[functionName];

        if (!functionToCall) {
          throw new Error(`Function ${functionName} not found`);
        }

        // Call the function with userId as first parameter
        let result;
        try {
          result = await functionToCall(userId, functionArgs);
        } catch (funcError) {
          console.error(`[FlightsAgent] Error in ${functionName}:`, funcError);
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
      console.error('[FlightsAgent] Error handling tool calls:', error);
      return this.handleError(error, originalQuery);
    }
  }

  /**
   * Handle errors gracefully
   */
  handleError(error, query) {
    const errorMessage = error.message || 'An unknown error occurred';
    
    let userFriendlyMessage = 'I encountered an error while searching for flights. ';
    
    if (errorMessage.includes('SERPAPI_API_KEY') || errorMessage.includes('SERPAPI_KEY')) {
      userFriendlyMessage += 'The flight search service is not configured. Please contact support.';
    } else if (errorMessage.includes('Invalid date')) {
      userFriendlyMessage += 'Please provide a valid date in YYYY-MM-DD format.';
    } else if (errorMessage.includes('Rate limit')) {
      userFriendlyMessage += 'Too many requests. Please try again in a moment.';
    } else if (errorMessage.includes('timeout')) {
      userFriendlyMessage += 'The search is taking too long. Please try again.';
    } else if (errorMessage.includes('Invalid request')) {
      userFriendlyMessage += 'Please check your search parameters (city names, dates) and try again.';
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

module.exports = FlightsAgent;
