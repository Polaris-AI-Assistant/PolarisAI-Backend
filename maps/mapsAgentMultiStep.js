/**
 * Maps Agent - Multi-Step Execution Version
 * Extends BaseAgent to support sequential multi-step operations.
 */

const BaseAgent = require('../base/BaseAgent');
const mapsService = require('./mapsService');
const OpenAI = require('openai');

class MapsAgentMultiStep extends BaseAgent {
  constructor(llmClient) {
    const tools = {
      searchPlaces: {
        definition: {
          type: 'function',
          function: {
            name: 'searchPlaces',
            description: 'Search for places by name or type',
            parameters: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query (e.g., "restaurants", "hotels")' },
                location: { type: 'string', description: 'Location to search around' },
                radius: { type: 'number', description: 'Search radius in meters', default: 5000 },
                type: { type: 'string', description: 'Place type filter' }
              },
              required: ['query']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[MapsAgent] 🔍 Searching places: "${params.query}"`);
          try {
            const places = await mapsService.searchPlaces(context.userId, params);
            console.log(`[MapsAgent] ✅ Found ${places.length} places`);
            return { success: true, places: places, count: places.length };
          } catch (error) {
            console.error(`[MapsAgent] ❌ Error searching places:`, error.message);
            throw error;
          }
        }
      },

      getDirections: {
        definition: {
          type: 'function',
          function: {
            name: 'getDirections',
            description: 'Get directions between two locations',
            parameters: {
              type: 'object',
              properties: {
                origin: { type: 'string', description: 'Starting location' },
                destination: { type: 'string', description: 'Destination location' },
                mode: { type: 'string', enum: ['driving', 'walking', 'transit', 'bicycling'], description: 'Travel mode', default: 'driving' }
              },
              required: ['origin', 'destination']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[MapsAgent] 🗺️ Getting directions from ${params.origin} to ${params.destination}`);
          try {
            const directions = await mapsService.getDirections(context.userId, params);
            console.log(`[MapsAgent] ✅ Directions retrieved`);
            return { success: true, directions: directions, distance: directions.distance, duration: directions.duration };
          } catch (error) {
            console.error(`[MapsAgent] ❌ Error getting directions:`, error.message);
            throw error;
          }
        }
      },

      getPlaceDetails: {
        definition: {
          type: 'function',
          function: {
            name: 'getPlaceDetails',
            description: 'Get detailed information about a place',
            parameters: {
              type: 'object',
              properties: {
                placeId: { type: 'string', description: 'Place ID' }
              },
              required: ['placeId']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[MapsAgent] ℹ️ Getting place details: ${params.placeId}`);
          try {
            const details = await mapsService.getPlaceDetails(context.userId, params.placeId);
            console.log(`[MapsAgent] ✅ Place details retrieved`);
            return { success: true, details: details };
          } catch (error) {
            console.error(`[MapsAgent] ❌ Error getting place details:`, error.message);
            throw error;
          }
        }
      },

      getNearbyPlaces: {
        definition: {
          type: 'function',
          function: {
            name: 'getNearbyPlaces',
            description: 'Find places near a location',
            parameters: {
              type: 'object',
              properties: {
                location: { type: 'string', description: 'Center location' },
                type: { type: 'string', description: 'Place type (e.g., "restaurant", "hotel")' },
                radius: { type: 'number', description: 'Search radius in meters', default: 5000 }
              },
              required: ['location', 'type']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[MapsAgent] 📍 Finding nearby ${params.type} near ${params.location}`);
          try {
            const places = await mapsService.getNearbyPlaces(context.userId, params);
            console.log(`[MapsAgent] ✅ Found ${places.length} nearby places`);
            return { success: true, places: places, count: places.length };
          } catch (error) {
            console.error(`[MapsAgent] ❌ Error finding nearby places:`, error.message);
            throw error;
          }
        }
      }
    };

    super('MapsAgent', tools, llmClient || new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));
  }

  getSystemPrompt() {
    const basePrompt = super.getSystemPrompt();
    return `${basePrompt}

GOOGLE MAPS SPECIFIC GUIDELINES:

1. **Place Search**
   - Search for places by name or type
   - Include location for context

2. **Multi-Step Example**
   User: "Find restaurants near me and get directions to the closest one"
   
   Step 1: getNearbyPlaces({ location: "current_location", type: "restaurant" })
   Result: { places: [...], count: 10 }
   
   Step 2: getDirections({ origin: "current_location", destination: "closest_restaurant" })
   Result: { success: true, distance: "...", duration: "..." }

3. **Navigation**
   - Get directions between locations
   - Support multiple travel modes
   - Include distance and duration

4. **Place Information**
   - Get detailed place information
   - Include ratings, hours, contact info`;
  }

  async processQuery(query, userIdOrContext, options = {}) {
    console.log(`[MapsAgent] 🚀 Processing query (multi-step): "${query}"`);
    
    // Detect which signature is being used
    let context;
    if (typeof userIdOrContext === 'string') {
      context = {
        userId: userIdOrContext,
        conversationId: options.conversationId,
        maxIterations: options.maxIterations || 15,
        forceToolExecution: options.forceToolExecution,
        conversationHistory: options.conversationHistory,
        userLocation: options.userLocation
      };
    } else if (typeof userIdOrContext === 'object') {
      context = userIdOrContext;
    } else {
      throw new Error(`Invalid processQuery signature`);
    }
    
    const result = await super.processQuery(query, context);

    return {
      success: result.success,
      response: result.summary,
      tools_used: result.executedActions.map(a => ({ name: a.tool })),
      raw_results: result.executedActions.map(a => a.result),
      conversationHistory: context.conversationHistory || [],
      totalSteps: result.totalSteps,
      errors: result.errors
    };
  }
}

module.exports = MapsAgentMultiStep;
