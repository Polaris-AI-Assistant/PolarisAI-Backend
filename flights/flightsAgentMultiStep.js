/**
 * Flights Agent - Multi-Step Execution Version
 * Extends BaseAgent to support sequential multi-step operations.
 */

const BaseAgent = require('../base/BaseAgent');
const flightsService = require('./flightsService');
const OpenAI = require('openai');

class FlightsAgentMultiStep extends BaseAgent {
  constructor(llmClient) {
    const tools = {
      searchFlights: {
        definition: {
          type: 'function',
          function: {
            name: 'searchFlights',
            description: 'Search for flights between two cities',
            parameters: {
              type: 'object',
              properties: {
                from: { type: 'string', description: 'Departure city or airport code' },
                to: { type: 'string', description: 'Destination city or airport code' },
                departDate: { type: 'string', description: 'Departure date (YYYY-MM-DD)' },
                returnDate: { type: 'string', description: 'Return date (YYYY-MM-DD) for round trips' },
                passengers: { type: 'number', description: 'Number of passengers', default: 1 },
                tripType: { type: 'string', enum: ['oneWay', 'roundTrip'], description: 'Trip type', default: 'oneWay' }
              },
              required: ['from', 'to', 'departDate']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[FlightsAgent] ✈️ Searching flights from ${params.from} to ${params.to}`);
          try {
            // Map agent param names (departDate) to service param names (date)
            const serviceParams = {
              from: params.from,
              to: params.to,
              date: params.departDate || params.date,
              returnDate: params.returnDate,
              currency: params.currency,
              travelers: params.passengers || params.travelers
            };
            const result = await flightsService.searchFlights(serviceParams);
            const flights = result.best_flights || result.other_flights || [];
            console.log(`[FlightsAgent] ✅ Found ${flights.length} flights`);
            return { success: true, flights: flights, count: flights.length, raw: result };
          } catch (error) {
            console.error(`[FlightsAgent] ❌ Error searching flights:`, error.message);
            throw error;
          }
        }
      },

      compareFlights: {
        definition: {
          type: 'function',
          function: {
            name: 'compareFlights',
            description: 'Compare flight options by price, duration, and other factors',
            parameters: {
              type: 'object',
              properties: {
                flightIds: { type: 'array', items: { type: 'string' }, description: 'Flight IDs to compare' },
                sortBy: { type: 'string', enum: ['price', 'duration', 'departure'], description: 'Sort criteria', default: 'price' }
              },
              required: ['flightIds']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[FlightsAgent] 📊 Comparing ${params.flightIds.length} flights`);
          try {
            const comparison = await flightsService.compareFlights(context.userId, params);
            console.log(`[FlightsAgent] ✅ Comparison complete`);
            return { success: true, comparison: comparison };
          } catch (error) {
            console.error(`[FlightsAgent] ❌ Error comparing flights:`, error.message);
            throw error;
          }
        }
      },

      bookFlight: {
        definition: {
          type: 'function',
          function: {
            name: 'bookFlight',
            description: 'Book a flight',
            parameters: {
              type: 'object',
              properties: {
                flightId: { type: 'string', description: 'Flight ID to book' },
                passengers: { type: 'array', items: { type: 'object' }, description: 'Passenger details' },
                paymentMethod: { type: 'string', description: 'Payment method' }
              },
              required: ['flightId', 'passengers']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[FlightsAgent] 🎫 Booking flight: ${params.flightId}`);
          try {
            const booking = await flightsService.bookFlight(context.userId, params);
            console.log(`[FlightsAgent] ✅ Flight booked: ${booking.bookingId}`);
            return { success: true, bookingId: booking.bookingId, confirmationNumber: booking.confirmationNumber };
          } catch (error) {
            console.error(`[FlightsAgent] ❌ Error booking flight:`, error.message);
            throw error;
          }
        }
      }
    };

    super('FlightsAgent', tools, llmClient || new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));
  }

  getSystemPrompt() {
    const basePrompt = super.getSystemPrompt();

    // Build current date string dynamically so the LLM always has accurate temporal context
    const now = new Date();
    const currentDateStr = now.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
    const currentDateISO = now.toISOString().split('T')[0]; // YYYY-MM-DD

    return `${basePrompt}

**CURRENT DATE: ${currentDateStr} (${currentDateISO})**
- ALWAYS use this as the reference when resolving relative dates such as "today", "tomorrow", "this month", "next week", etc.
- "15th of this month" means the 15th day of the CURRENT month and CURRENT year: resolve to ${currentDateISO.slice(0, 7)}-15
- NEVER use dates from your training data. All dates must be derived from the current date above.

FLIGHTS SPECIFIC GUIDELINES:

1. **Flight Search**
   - Search for flights with departure and destination
   - Include date and number of passengers
   - Always use IATA airport codes (e.g., PNQ for Pune, NAG for Nagpur, BOM for Mumbai, DEL for Delhi)

2. **Multi-Step Example**
   User: "Search for flights from NYC to LA and book the cheapest one"
   
   Step 1: searchFlights({ from: "JFK", to: "LAX", departDate: "${currentDateISO.slice(0, 7)}-15" })
   Result: { flights: [...], count: 10 }
   
   Step 2: bookFlight({ flightId: "cheapest_flight_id", passengers: [...] })
   Result: { success: true, bookingId: "..." }

3. **Booking**
   - Compare flights before booking
   - Include passenger details
   - Provide confirmation number`;
  }

  async processQuery(query, userIdOrContext, options = {}) {
    console.log(`[FlightsAgent] 🚀 Processing query (multi-step): "${query}"`);
    
    // Detect which signature is being used
    let context;
    if (typeof userIdOrContext === 'string') {
      context = {
        userId: userIdOrContext,
        conversationId: options.conversationId,
        maxIterations: options.maxIterations || 15,
        forceToolExecution: options.forceToolExecution,
        conversationHistory: options.conversationHistory
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

module.exports = FlightsAgentMultiStep;
