/**
 * Google Maps AI Agent using OpenAI
 * 
 * This agent provides intelligent interaction with Google Maps APIs using natural language queries.
 * It dynamically selects and executes appropriate Maps API functions based on user intent.
 * 
 * Features:
 * - Natural language query processing
 * - Dynamic tool selection based on user intent
 * - Place search (text and nearby)
 * - Place details retrieval
 * - Distance and travel time calculation
 * - Geocoding and reverse geocoding
 * - Multi-tool query support
 * - Comprehensive error handling
 * 
 * Usage:
 * const agent = new MapsAgent();
 * const result = await agent.processQuery("find cafes near me", userId);
 */

const OpenAI = require('openai');
const mapsService = require('./mapsService');

class MapsAgent {
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
   * Define OpenAI function schemas for each Maps function
   * These schemas help the AI understand when and how to use each tool
   */
  defineTools() {
    return [
      // ========== PLACES SEARCH ==========
      {
        type: "function",
        function: {
          name: "maps_placesSearch",
          description: "Search for places using Google Places API text search. Useful for queries like 'cafes near me', 'best hotels in Goa', 'temples in Jaipur', etc.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "What the user is searching for (e.g., 'cafes', 'hotels in Paris', 'restaurants near Times Square')"
              },
              location: {
                type: "string",
                description: "Optional location as 'lat,lng' to bias search results"
              },
              radius: {
                type: "number",
                description: "Optional search radius in meters (e.g., 5000 for 5km)"
              }
            },
            required: ["query"]
          }
        }
      },

      // ========== NEARBY SEARCH ==========
      {
        type: "function",
        function: {
          name: "maps_nearbySearch",
          description: "Find nearby places around a specific location. More structured than text search. Best for finding specific types of places near coordinates.",
          parameters: {
            type: "object",
            properties: {
              location: {
                type: "string",
                description: "Required location as 'lat,lng' (e.g., '19.0760,72.8777')"
              },
              radius: {
                type: "number",
                description: "Search radius in meters (max 50000). Use 1000 for 1km, 5000 for 5km, etc."
              },
              type: {
                type: "string",
                description: "Optional place type to filter results: restaurant, hospital, cafe, bank, gym, school, park, etc."
              }
            },
            required: ["location", "radius"]
          }
        }
      },

      // ========== PLACE DETAILS ==========
      {
        type: "function",
        function: {
          name: "maps_placeDetails",
          description: "Get comprehensive details about a specific place including address, phone, website, hours, rating, reviews, and photos. Use when user wants detailed information about a specific place.",
          parameters: {
            type: "object",
            properties: {
              place_id: {
                type: "string",
                description: "The Google Place ID obtained from search results"
              }
            },
            required: ["place_id"]
          }
        }
      },

      // ========== DISTANCE MATRIX ==========
      {
        type: "function",
        function: {
          name: "maps_distanceMatrix",
          description: "Compute distance and travel time between two locations. Supports different travel modes. Use for 'how far', 'distance between', 'travel time' queries.",
          parameters: {
            type: "object",
            properties: {
              origins: {
                type: "string",
                description: "Starting location as 'lat,lng' OR full address (e.g., '19.0760,72.8777' or 'Mumbai, India')"
              },
              destinations: {
                type: "string",
                description: "Destination location as 'lat,lng' OR full address"
              },
              mode: {
                type: "string",
                enum: ["driving", "walking", "bicycling", "transit"],
                description: "Travel mode: driving (default), walking, bicycling, or transit"
              }
            },
            required: ["origins", "destinations"]
          }
        }
      },

      // ========== GEOCODE ==========
      {
        type: "function",
        function: {
          name: "maps_geocode",
          description: "Convert a human-readable address into latitude/longitude coordinates. Use when user provides an address and needs coordinates.",
          parameters: {
            type: "object",
            properties: {
              address: {
                type: "string",
                description: "The full address to geocode (e.g., '1600 Amphitheatre Parkway, Mountain View, CA')"
              }
            },
            required: ["address"]
          }
        }
      },

      // ========== REVERSE GEOCODE ==========
      {
        type: "function",
        function: {
          name: "maps_reverseGeocode",
          description: "Convert latitude/longitude coordinates into a human-readable address. Use when user provides coordinates and needs the address.",
          parameters: {
            type: "object",
            properties: {
              lat: {
                type: "number",
                description: "Latitude coordinate"
              },
              lng: {
                type: "number",
                description: "Longitude coordinate"
              }
            },
            required: ["lat", "lng"]
          }
        }
      }
    ];
  }

  /**
   * Map function names to actual service implementations
   */
  createFunctionMap() {
    return {
      'maps_placesSearch': mapsService.placesSearch,
      'maps_nearbySearch': mapsService.nearbySearch,
      'maps_placeDetails': mapsService.placeDetails,
      'maps_distanceMatrix': mapsService.distanceMatrix,
      'maps_geocode': mapsService.geocode,
      'maps_reverseGeocode': mapsService.reverseGeocode
    };
  }

  /**
   * Create the system prompt that defines agent behavior
   */
  createSystemPrompt() {
    return `You are a helpful Google Maps AI assistant specialized in helping users find places, get directions, and access location-based information.

**CRITICAL LANGUAGE REQUIREMENT:**
- ALWAYS respond in the SAME LANGUAGE as the user's query
- If user writes in English, respond in English
- If user writes in Hindi, respond in Hindi
- If user writes in Spanish, respond in Spanish
- Match the user's language EXACTLY - do not translate or switch languages

Your capabilities include:
1. **Place Search**: Find places using natural language queries (text search)
2. **Nearby Search**: Find specific types of places near a location
3. **Place Details**: Get comprehensive information about a specific place
4. **Distance Calculation**: Calculate distance and travel time between locations
5. **Geocoding**: Convert addresses to coordinates and vice versa

Key Guidelines:
- Always provide clear, helpful responses with relevant details
- When searching for places, include key information: name, address, rating, and distance if available
- For place details, highlight important information like opening hours, contact info, and reviews
- For distance queries, specify the travel mode and provide both distance and time
- If a query is ambiguous, make reasonable assumptions or ask for clarification
- Present information in a user-friendly, structured format
- When providing multiple results, limit to the most relevant 5-10 places
- Include actionable information like "open now" status when available
- For location-based queries without coordinates, use place names or addresses

Response Format:
- Use clear, conversational language
- Structure complex information with bullet points or numbered lists
- Highlight key details (ratings, distances, open/closed status)
- Provide context and recommendations when helpful
- Always be specific and accurate with locations and addresses

Remember: You're helping users navigate and discover the world around them. Be helpful, accurate, and informative!`;
  }

  /**
   * Process a natural language query about Google Maps
   * 
   * @param {string} query - User's natural language query
   * @param {string} userId - User ID (for potential future use)
   * @param {Object} options - Additional options
   * @param {Array} options.conversationHistory - Previous messages for context
   * @param {Object} options.forceToolExecution - Force execution of specific tool
   * @param {Object} options.userLocation - User's current location {lat, lng}
   * @returns {Promise<Object>} Processing result
   */
  async processQuery(query, userId, options = {}) {
    const startTime = Date.now();
    console.log(`\n[MapsAgent] 🗺️  Processing query for user ${userId}: "${query}"`);

    const { conversationHistory = [], forceToolExecution, userLocation } = options;

    // Check if query requires location but none provided
    const requiresLocation = query.toLowerCase().includes('near me') || 
                            query.toLowerCase().includes('nearby') ||
                            query.toLowerCase().includes('closest') ||
                            query.toLowerCase().includes('around me');

    if (requiresLocation && !userLocation) {
      console.log(`[MapsAgent] ⚠️  Query requires location but none provided`);
      return {
        success: false,
        error: 'location_required',
        response: '📍 I need your location to find places near you. Please enable location access or specify a city/area in your query.',
        query: query,
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    }

    if (userLocation) {
      console.log(`[MapsAgent] 📍 User location: ${userLocation.lat}, ${userLocation.lng}`);
    }

    try {
      // Build messages array with conversation history
      // If userLocation is provided, enhance the system prompt
      let systemPrompt = this.systemPrompt;
      if (userLocation) {
        systemPrompt += `\n\nIMPORTANT: The user's current location is: ${userLocation.lat},${userLocation.lng}. Use this for "near me" queries by passing it as the location parameter to place search tools.`;
      }

      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: query }
      ];

      // If we're forcing a specific tool execution (e.g., from confirmation)
      if (forceToolExecution) {
        console.log(`[MapsAgent] ⚡ Forcing tool execution: ${forceToolExecution.toolName}`);
        const toolFunction = this.functionMap[forceToolExecution.toolName];
        
        if (!toolFunction) {
          throw new Error(`Tool ${forceToolExecution.toolName} not found`);
        }

        // Inject userLocation into params if needed
        let params = { ...forceToolExecution.params };
        if (userLocation && !params.location) {
          params.location = `${userLocation.lat},${userLocation.lng}`;
        }

        const toolResult = await toolFunction(params);
        
        return {
          success: true,
          response: this.formatToolResult(forceToolExecution.toolName, toolResult),
          query: query,
          tools_used: [{ name: forceToolExecution.toolName, arguments: JSON.stringify(forceToolExecution.params) }],
          raw_results: [toolResult],
          executionTime: Date.now() - startTime,
          timestamp: new Date().toISOString()
        };
      }

      // Call OpenAI with function calling
      let response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: messages,
        tools: this.tools,
        tool_choice: "auto"
      });

      let assistantMessage = response.choices[0].message;
      const toolsUsed = [];
      const toolResults = [];

      // Handle multiple tool calls if needed
      while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        messages.push(assistantMessage);

        // Execute all tool calls
        for (const toolCall of assistantMessage.tool_calls) {
          const functionName = toolCall.function.name;
          let functionArgs = JSON.parse(toolCall.function.arguments);

          // Inject userLocation if available and tool requires location
          if (userLocation && !functionArgs.location) {
            // For placesSearch and nearbySearch, inject location if not provided
            if (functionName === 'mapsPlacesSearch' || functionName === 'mapsNearbySearch') {
              functionArgs.location = `${userLocation.lat},${userLocation.lng}`;
              console.log(`[MapsAgent] 📍 Injecting user location into ${functionName}`);
            }
          }

          console.log(`[MapsAgent] 🔧 Executing tool: ${functionName}`);
          console.log(`[MapsAgent] 📋 Arguments:`, JSON.stringify(functionArgs, null, 2));

          toolsUsed.push({ name: functionName, arguments: toolCall.function.arguments });

          try {
            // Get the actual function to call
            const functionToCall = this.functionMap[functionName];
            
            if (!functionToCall) {
              throw new Error(`Function ${functionName} not found in function map`);
            }

            // Execute the function
            const functionResponse = await functionToCall(functionArgs);
            toolResults.push({ tool: functionName, result: functionResponse });

            console.log(`[MapsAgent] ✅ Tool ${functionName} executed successfully`);

            // Add function result to messages
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(functionResponse)
            });

          } catch (error) {
            console.error(`[MapsAgent] ❌ Error executing ${functionName}:`, error);
            
            // Add error message to conversation
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({ 
                error: error.message,
                success: false 
              })
            });
          }
        }

        // Get next response from OpenAI
        response = await this.openai.chat.completions.create({
          model: "gpt-4o",
          messages: messages,
          tools: this.tools,
          tool_choice: "auto"
        });

        assistantMessage = response.choices[0].message;
      }

      // Extract final response
      const finalResponse = assistantMessage.content || "I've processed your request.";

      const executionTime = Date.now() - startTime;
      console.log(`[MapsAgent] ✨ Query processed successfully in ${executionTime}ms`);
      console.log(`[MapsAgent] 🔧 Tools used: ${toolsUsed.map(t => t.name).join(', ') || 'none'}`);

      return {
        success: true,
        response: finalResponse,
        query: query,
        tools_used: toolsUsed,
        raw_results: toolResults,
        executionTime: executionTime,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('[MapsAgent] ❌ Error processing query:', error);
      
      return {
        success: false,
        error: error.message,
        query: query,
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Format tool result for forced execution response
   */
  formatToolResult(toolName, result) {
    switch (toolName) {
      case 'maps_placesSearch':
      case 'maps_nearbySearch':
        if (result.results && result.results.length > 0) {
          const places = result.results.slice(0, 5).map((place, idx) => 
            `${idx + 1}. **${place.name}**\n   ${place.address || place.vicinity}\n   ${place.rating ? `⭐ ${place.rating} (${place.user_ratings_total} reviews)` : 'No rating'}`
          ).join('\n\n');
          return `Found ${result.results.length} places:\n\n${places}`;
        }
        return 'No places found matching your search.';

      case 'maps_placeDetails':
        const place = result;
        let details = `**${place.name}**\n\n`;
        if (place.address) details += `📍 ${place.address}\n`;
        if (place.phone) details += `📞 ${place.phone}\n`;
        if (place.website) details += `🌐 ${place.website}\n`;
        if (place.rating) details += `⭐ ${place.rating}/5 (${place.user_ratings_total} reviews)\n`;
        if (place.opening_hours) details += `🕒 ${place.opening_hours.open_now ? 'Open now' : 'Closed'}\n`;
        return details;

      case 'maps_distanceMatrix':
        return `**Distance**: ${result.distance.text}\n**Travel Time**: ${result.duration.text}\n**Mode**: ${result.mode}\n\nFrom: ${result.origin}\nTo: ${result.destination}`;

      case 'maps_geocode':
        if (result.results && result.results.length > 0) {
          const loc = result.results[0];
          return `**Address**: ${loc.formatted_address}\n**Coordinates**: ${loc.location.lat}, ${loc.location.lng}`;
        }
        return 'Could not geocode the address.';

      case 'maps_reverseGeocode':
        if (result.results && result.results.length > 0) {
          return `**Address**: ${result.results[0].formatted_address}`;
        }
        return 'Could not find address for these coordinates.';

      default:
        return JSON.stringify(result, null, 2);
    }
  }
}

module.exports = MapsAgent;
