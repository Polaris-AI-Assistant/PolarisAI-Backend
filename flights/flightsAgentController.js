/**
 * Flights Agent Controller
 * 
 * HTTP endpoint for interacting with the Flights AI Agent.
 * Handles natural language queries for flight searches and returns AI-processed responses.
 */

const express = require('express');
const FlightsAgent = require('./flightsAgent');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Initialize the Flights AI Agent
const flightsAgent = new FlightsAgent();

/**
 * POST /flights/agent/query
 * Process natural language queries about flights
 * 
 * Request body:
 * {
 *   "query": "find flights from Mumbai to Delhi on December 15"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "response": "I found several flights...",
 *   "query": "find flights...",
 *   "tools_used": [...],
 *   "timestamp": "2025-01-01T00:00:00.000Z"
 * }
 */
router.post('/agent/query', authenticateToken, async (req, res) => {
  try {
    const { query, conversationHistory } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Query is required and must be a non-empty string',
        example: {
          query: "find flights from Mumbai to Delhi on December 15"
        }
      });
    }

    console.log(`[FlightsAgentController] User ${userId} query: "${query}"`);

    // Process the query through the agent with conversation history
    const result = await flightsAgent.processQuery(query, userId, { conversationHistory });

    // Return the result
    res.json(result);

  } catch (error) {
    console.error('[FlightsAgentController] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process query',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /flights/agent/examples
 * Get example queries that users can try
 */
router.get('/agent/examples', (req, res) => {
  res.json({
    success: true,
    examples: [
      {
        category: "Flight Search",
        queries: [
          "Find flights from Mumbai to Delhi on December 15",
          "Search for flights from BOM to BLR tomorrow",
          "Show me flights from New York to Los Angeles next week",
          "Find round trip flights from Delhi to Goa from Dec 20 to Dec 27"
        ]
      },
      {
        category: "Price Comparison",
        queries: [
          "Compare flight prices from Mumbai to Dubai for next month",
          "What's the cheapest flight from Bangalore to Chennai?",
          "Find the best deals on flights from Delhi to London"
        ]
      },
      {
        category: "Price Insights",
        queries: [
          "When is the best time to book flights from Mumbai to Singapore?",
          "What are the cheapest days to fly from Delhi to Bangkok?",
          "Show me price trends for flights to Goa"
        ]
      },
      {
        category: "Specific Requirements",
        queries: [
          "Find direct flights from BOM to DEL on January 10",
          "Search flights for 2 passengers from Chennai to Hyderabad",
          "Find morning flights from Pune to Bangalore tomorrow"
        ]
      }
    ],
    tips: [
      "Use airport codes (BOM, DEL, BLR) for more accurate results",
      "Specify dates in formats like 'December 15', 'Dec 15', 'next Friday', or '2025-01-15'",
      "Mention if you need round-trip by including return date",
      "Specify number of travelers if more than 1"
    ],
    supported_features: [
      "One-way and round-trip searches",
      "Multiple currency support (INR, USD, EUR, etc.)",
      "Price insights and trends",
      "Multiple passenger support"
    ]
  });
});

/**
 * GET /flights/agent/airports
 * Get list of common airport codes for reference
 */
router.get('/agent/airports', (req, res) => {
  res.json({
    success: true,
    airports: {
      india: [
        { code: "BOM", city: "Mumbai", name: "Chhatrapati Shivaji Maharaj International" },
        { code: "DEL", city: "Delhi", name: "Indira Gandhi International" },
        { code: "BLR", city: "Bangalore", name: "Kempegowda International" },
        { code: "MAA", city: "Chennai", name: "Chennai International" },
        { code: "CCU", city: "Kolkata", name: "Netaji Subhas Chandra Bose International" },
        { code: "HYD", city: "Hyderabad", name: "Rajiv Gandhi International" },
        { code: "PNQ", city: "Pune", name: "Pune International" },
        { code: "AMD", city: "Ahmedabad", name: "Sardar Vallabhbhai Patel International" },
        { code: "GOI", city: "Goa", name: "Goa International" },
        { code: "JAI", city: "Jaipur", name: "Jaipur International" },
        { code: "COK", city: "Kochi", name: "Cochin International" },
        { code: "TRV", city: "Thiruvananthapuram", name: "Trivandrum International" }
      ],
      international: [
        { code: "JFK", city: "New York", name: "John F. Kennedy International" },
        { code: "LAX", city: "Los Angeles", name: "Los Angeles International" },
        { code: "LHR", city: "London", name: "Heathrow Airport" },
        { code: "DXB", city: "Dubai", name: "Dubai International" },
        { code: "SIN", city: "Singapore", name: "Singapore Changi" },
        { code: "HKG", city: "Hong Kong", name: "Hong Kong International" },
        { code: "NRT", city: "Tokyo", name: "Narita International" },
        { code: "SYD", city: "Sydney", name: "Sydney Airport" },
        { code: "CDG", city: "Paris", name: "Charles de Gaulle" },
        { code: "FRA", city: "Frankfurt", name: "Frankfurt Airport" },
        { code: "BKK", city: "Bangkok", name: "Suvarnabhumi Airport" },
        { code: "KUL", city: "Kuala Lumpur", name: "Kuala Lumpur International" }
      ]
    }
  });
});

/**
 * GET /flights/agent/status
 * Check if the flights agent is operational
 */
router.get('/agent/status', (req, res) => {
  const hasApiKey = !!(process.env.SERPAPI_KEY || process.env.SERPAPI_API_KEY);
  
  res.json({
    success: true,
    status: hasApiKey ? 'operational' : 'configuration_required',
    message: hasApiKey 
      ? 'Flights agent is ready to search flights' 
      : 'SERPAPI_KEY is not configured',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
