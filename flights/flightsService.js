/**
 * Flights Service Module
 * 
 * Provides flight search functionality using SerpAPI Google Flights.
 * This service handles all communication with the SerpAPI to search for flights
 * and retrieve pricing information.
 * 
 * Features:
 * - Search flights between airports/cities
 * - Support for one-way and round-trip searches
 * - Currency and traveler count configuration
 * - Price insights and trends
 */

const axios = require('axios');

/**
 * Search for flights using SerpAPI Google Flights
 * 
 * @param {Object} params - Flight search parameters
 * @param {string} params.from - Departure city or airport code (e.g., "BOM", "Mumbai")
 * @param {string} params.to - Arrival city or airport code (e.g., "DEL", "New Delhi")
 * @param {string} params.date - Outbound date in YYYY-MM-DD format
 * @param {string} [params.returnDate] - Optional return date in YYYY-MM-DD format
 * @param {string} [params.currency="INR"] - Currency code (e.g., "INR", "USD")
 * @param {number} [params.travelers=1] - Number of adult travelers
 * @returns {Promise<Object>} SerpAPI response with flight data
 * @throws {Error} If SERPAPI_API_KEY is not configured or API call fails
 */
async function searchFlights(params) {
  const apiKey = process.env.SERPAPI_KEY || process.env.SERPAPI_API_KEY;
  
  if (!apiKey) {
    throw new Error("SERPAPI_API_KEY is not set. Please configure the SERPAPI_KEY environment variable.");
  }

  // Validate required parameters
  if (!params.from) {
    throw new Error("Departure location (from) is required");
  }
  if (!params.to) {
    throw new Error("Arrival location (to) is required");
  }
  if (!params.date) {
    throw new Error("Outbound date is required");
  }

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(params.date)) {
    throw new Error("Invalid date format. Please use YYYY-MM-DD format.");
  }
  if (params.returnDate && !dateRegex.test(params.returnDate)) {
    throw new Error("Invalid return date format. Please use YYYY-MM-DD format.");
  }

  // Build query parameters for SerpAPI
  const queryParams = {
    engine: process.env.SERPAPI_ENGINE || "google_flights",
    departure_id: params.from.toUpperCase(),
    arrival_id: params.to.toUpperCase(),
    outbound_date: params.date,
    api_key: apiKey,
    currency: params.currency || "INR",
    adults: params.travelers || 1,
    hl: "en",
    gl: "in"
  };

  // Add return date for round-trip flights
  if (params.returnDate) {
    queryParams.return_date = params.returnDate;
    queryParams.type = "1"; // Round trip
  } else {
    queryParams.type = "2"; // One way
  }

  const endpoint = process.env.SERPAPI_FLIGHTS_ENDPOINT || "https://serpapi.com/search.json";

  console.log(`[FlightsService] Searching flights from ${params.from} to ${params.to} on ${params.date}`);
  console.log(`[FlightsService] Query params:`, JSON.stringify(queryParams, null, 2));

  try {
    const response = await axios.get(endpoint, { 
      params: queryParams,
      timeout: 30000 // 30 second timeout
    });

    console.log(`[FlightsService] Successfully retrieved flight data`);
    
    // Add metadata to the response
    const result = {
      ...response.data,
      search_metadata: {
        ...response.data.search_metadata,
        search_params: {
          from: params.from,
          to: params.to,
          date: params.date,
          returnDate: params.returnDate || null,
          currency: params.currency || "INR",
          travelers: params.travelers || 1
        }
      }
    };

    return result;

  } catch (error) {
    console.error('[FlightsService] Error searching flights:', error.message);
    
    if (error.response) {
      // API returned an error response
      const status = error.response.status;
      const data = error.response.data;
      
      if (status === 401) {
        throw new Error("Invalid SerpAPI key. Please check your SERPAPI_KEY configuration.");
      } else if (status === 400) {
        throw new Error(`Invalid request: ${data.error || 'Please check your search parameters.'}`);
      } else if (status === 429) {
        throw new Error("Rate limit exceeded. Please try again later.");
      } else {
        throw new Error(`Flight search failed: ${data.error || error.message}`);
      }
    } else if (error.code === 'ECONNABORTED') {
      throw new Error("Request timeout. The flight search is taking too long. Please try again.");
    } else if (error.code === 'ENOTFOUND') {
      throw new Error("Unable to connect to flight search service. Please check your internet connection.");
    } else {
      throw new Error(`Flight search failed: ${error.message}`);
    }
  }
}

/**
 * Get price insights for flights
 * This reuses the searchFlights function but returns only price-related data
 * 
 * @param {Object} params - Flight search parameters
 * @param {string} params.from - Departure city or airport code
 * @param {string} params.to - Arrival city or airport code
 * @param {string} params.date - Outbound date in YYYY-MM-DD format
 * @returns {Promise<Object>} Price insights data
 */
async function getFlightsPriceInsights(params) {
  const data = await searchFlights(params);
  
  return {
    best_flights: data.best_flights || [],
    other_flights: data.other_flights || [],
    price_graph: data.price_graph || null,
    price_insights: data.price_insights || null,
    search_params: data.search_metadata?.search_params || params
  };
}

/**
 * Format flight data for user-friendly display
 * Helper function to format raw API response into readable format
 * 
 * @param {Object} flightData - Raw flight data from SerpAPI
 * @returns {Object} Formatted flight data
 */
function formatFlightResults(flightData) {
  const formatFlight = (flight) => {
    if (!flight) return null;
    
    const flights = flight.flights || [];
    const firstLeg = flights[0] || {};
    const lastLeg = flights[flights.length - 1] || {};
    
    return {
      price: flight.price,
      total_duration: flight.total_duration,
      departure_time: firstLeg.departure_airport?.time,
      arrival_time: lastLeg.arrival_airport?.time,
      departure_airport: firstLeg.departure_airport?.name,
      arrival_airport: lastLeg.arrival_airport?.name,
      airline: firstLeg.airline,
      flight_number: firstLeg.flight_number,
      stops: flights.length - 1,
      layovers: flight.layovers || []
    };
  };

  return {
    best_flights: (flightData.best_flights || []).map(formatFlight).filter(Boolean),
    other_flights: (flightData.other_flights || []).map(formatFlight).filter(Boolean),
    search_info: flightData.search_metadata?.search_params || {}
  };
}

module.exports = {
  searchFlights,
  getFlightsPriceInsights,
  formatFlightResults
};
