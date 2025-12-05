/**
 * Google Maps Agent Controller
 * 
 * HTTP endpoint for interacting with the Google Maps AI Agent.
 * Handles natural language queries and returns AI-processed responses.
 */

const express = require('express');
const MapsAgent = require('./mapsAgent');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Initialize the Maps AI Agent
const mapsAgent = new MapsAgent();

/**
 * POST /maps/agent/query
 * Process natural language queries about Google Maps
 * 
 * Request body:
 * {
 *   "query": "find cafes near me",
 *   "conversationHistory": [] // optional
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "response": "I found several cafes near you...",
 *   "query": "find cafes near me",
 *   "tools_used": ["maps_placesSearch"],
 *   "results": [...],
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
          query: "find restaurants near Times Square"
        }
      });
    }

    console.log(`[MapsAgentController] User ${userId} query: "${query}"`);

    // Process the query through the agent with conversation history
    const result = await mapsAgent.processQuery(query, userId, { conversationHistory });

    // Return the result
    res.json(result);

  } catch (error) {
    console.error('[MapsAgentController] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error processing Maps query',
      message: error.message
    });
  }
});

/**
 * GET /maps/agent/examples
 * Get example queries that the Maps agent can handle
 */
router.get('/agent/examples', (req, res) => {
  res.json({
    examples: [
      {
        category: "Place Search",
        queries: [
          "Find cafes near me",
          "Best hotels in Paris",
          "Restaurants near Times Square",
          "Temples in Jaipur",
          "Gyms in downtown Manhattan"
        ]
      },
      {
        category: "Nearby Search",
        queries: [
          "Find hospitals within 5km of my location",
          "Show me parks near 19.0760,72.8777",
          "Pharmacies within 2km radius",
          "ATMs near this location"
        ]
      },
      {
        category: "Place Details",
        queries: [
          "Tell me more about this place",
          "What are the opening hours?",
          "Show me reviews for this restaurant",
          "Get contact details for this business"
        ]
      },
      {
        category: "Distance & Directions",
        queries: [
          "How far is it from Mumbai to Pune?",
          "Distance between Eiffel Tower and Louvre Museum",
          "How long does it take to walk from here to Times Square?",
          "Driving time from San Francisco to Los Angeles"
        ]
      },
      {
        category: "Geocoding",
        queries: [
          "What are the coordinates of Taj Mahal?",
          "Convert 1600 Amphitheatre Parkway to coordinates",
          "What's the address of 19.0760,72.8777?",
          "Get location for Central Park, New York"
        ]
      }
    ],
    notes: [
      "You can combine multiple queries in one request",
      "The agent understands natural language and context",
      "Location can be specified as coordinates (lat,lng) or place names",
      "Supports multiple travel modes: driving, walking, bicycling, transit"
    ]
  });
});

/**
 * GET /maps/agent/capabilities
 * Get detailed information about Maps agent capabilities
 */
router.get('/agent/capabilities', (req, res) => {
  res.json({
    agent: 'Google Maps AI Agent',
    version: '1.0.0',
    capabilities: [
      {
        name: 'Place Search',
        description: 'Search for places using natural language queries',
        tool: 'maps_placesSearch',
        examples: ['Find cafes near me', 'Best hotels in Paris'],
        parameters: ['query', 'location (optional)', 'radius (optional)']
      },
      {
        name: 'Nearby Search',
        description: 'Find specific types of places near a location',
        tool: 'maps_nearbySearch',
        examples: ['Hospitals within 5km', 'ATMs nearby'],
        parameters: ['location (lat,lng)', 'radius', 'type (optional)']
      },
      {
        name: 'Place Details',
        description: 'Get comprehensive information about a specific place',
        tool: 'maps_placeDetails',
        examples: ['Details about this restaurant', 'Opening hours'],
        parameters: ['place_id']
      },
      {
        name: 'Distance Matrix',
        description: 'Calculate distance and travel time between locations',
        tool: 'maps_distanceMatrix',
        examples: ['Distance from Mumbai to Pune', 'Walking time to Times Square'],
        parameters: ['origins', 'destinations', 'mode (optional)']
      },
      {
        name: 'Geocoding',
        description: 'Convert address to coordinates',
        tool: 'maps_geocode',
        examples: ['Coordinates of Taj Mahal', 'Location of Central Park'],
        parameters: ['address']
      },
      {
        name: 'Reverse Geocoding',
        description: 'Convert coordinates to address',
        tool: 'maps_reverseGeocode',
        examples: ['Address of 19.0760,72.8777', 'What is at these coordinates'],
        parameters: ['lat', 'lng']
      }
    ],
    supported_place_types: [
      'restaurant', 'cafe', 'bar', 'hotel', 'hospital', 'pharmacy',
      'bank', 'atm', 'gym', 'park', 'museum', 'library', 'school',
      'university', 'shopping_mall', 'gas_station', 'airport', 'train_station'
    ],
    travel_modes: ['driving', 'walking', 'bicycling', 'transit']
  });
});

/**
 * GET /maps/agent/status
 * Check if the Maps agent is operational
 */
router.get('/agent/status', (req, res) => {
  const hasApiKey = !!process.env.GOOGLE_MAPS_API_KEY;
  
  res.json({
    status: hasApiKey ? 'operational' : 'misconfigured',
    agent: 'Google Maps AI Agent',
    api_key_configured: hasApiKey,
    message: hasApiKey 
      ? 'Maps agent is ready to process queries'
      : 'Google Maps API key not configured',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /maps/agent/place-types
 * Get list of supported place types
 */
router.get('/agent/place-types', (req, res) => {
  res.json({
    place_types: [
      { type: 'accounting', description: 'Accounting services' },
      { type: 'airport', description: 'Airport' },
      { type: 'amusement_park', description: 'Amusement park' },
      { type: 'aquarium', description: 'Aquarium' },
      { type: 'art_gallery', description: 'Art gallery' },
      { type: 'atm', description: 'ATM' },
      { type: 'bakery', description: 'Bakery' },
      { type: 'bank', description: 'Bank' },
      { type: 'bar', description: 'Bar' },
      { type: 'beauty_salon', description: 'Beauty salon' },
      { type: 'bicycle_store', description: 'Bicycle store' },
      { type: 'book_store', description: 'Book store' },
      { type: 'bowling_alley', description: 'Bowling alley' },
      { type: 'bus_station', description: 'Bus station' },
      { type: 'cafe', description: 'Cafe' },
      { type: 'campground', description: 'Campground' },
      { type: 'car_dealer', description: 'Car dealer' },
      { type: 'car_rental', description: 'Car rental' },
      { type: 'car_repair', description: 'Car repair' },
      { type: 'car_wash', description: 'Car wash' },
      { type: 'casino', description: 'Casino' },
      { type: 'cemetery', description: 'Cemetery' },
      { type: 'church', description: 'Church' },
      { type: 'city_hall', description: 'City hall' },
      { type: 'clothing_store', description: 'Clothing store' },
      { type: 'convenience_store', description: 'Convenience store' },
      { type: 'courthouse', description: 'Courthouse' },
      { type: 'dentist', description: 'Dentist' },
      { type: 'department_store', description: 'Department store' },
      { type: 'doctor', description: 'Doctor' },
      { type: 'drugstore', description: 'Drugstore' },
      { type: 'electrician', description: 'Electrician' },
      { type: 'electronics_store', description: 'Electronics store' },
      { type: 'embassy', description: 'Embassy' },
      { type: 'fire_station', description: 'Fire station' },
      { type: 'florist', description: 'Florist' },
      { type: 'funeral_home', description: 'Funeral home' },
      { type: 'furniture_store', description: 'Furniture store' },
      { type: 'gas_station', description: 'Gas station' },
      { type: 'gym', description: 'Gym' },
      { type: 'hair_care', description: 'Hair care' },
      { type: 'hardware_store', description: 'Hardware store' },
      { type: 'hindu_temple', description: 'Hindu temple' },
      { type: 'home_goods_store', description: 'Home goods store' },
      { type: 'hospital', description: 'Hospital' },
      { type: 'insurance_agency', description: 'Insurance agency' },
      { type: 'jewelry_store', description: 'Jewelry store' },
      { type: 'laundry', description: 'Laundry' },
      { type: 'lawyer', description: 'Lawyer' },
      { type: 'library', description: 'Library' },
      { type: 'light_rail_station', description: 'Light rail station' },
      { type: 'liquor_store', description: 'Liquor store' },
      { type: 'local_government_office', description: 'Local government office' },
      { type: 'locksmith', description: 'Locksmith' },
      { type: 'lodging', description: 'Lodging' },
      { type: 'meal_delivery', description: 'Meal delivery' },
      { type: 'meal_takeaway', description: 'Meal takeaway' },
      { type: 'mosque', description: 'Mosque' },
      { type: 'movie_rental', description: 'Movie rental' },
      { type: 'movie_theater', description: 'Movie theater' },
      { type: 'moving_company', description: 'Moving company' },
      { type: 'museum', description: 'Museum' },
      { type: 'night_club', description: 'Night club' },
      { type: 'painter', description: 'Painter' },
      { type: 'park', description: 'Park' },
      { type: 'parking', description: 'Parking' },
      { type: 'pet_store', description: 'Pet store' },
      { type: 'pharmacy', description: 'Pharmacy' },
      { type: 'physiotherapist', description: 'Physiotherapist' },
      { type: 'plumber', description: 'Plumber' },
      { type: 'police', description: 'Police' },
      { type: 'post_office', description: 'Post office' },
      { type: 'primary_school', description: 'Primary school' },
      { type: 'real_estate_agency', description: 'Real estate agency' },
      { type: 'restaurant', description: 'Restaurant' },
      { type: 'roofing_contractor', description: 'Roofing contractor' },
      { type: 'rv_park', description: 'RV park' },
      { type: 'school', description: 'School' },
      { type: 'secondary_school', description: 'Secondary school' },
      { type: 'shoe_store', description: 'Shoe store' },
      { type: 'shopping_mall', description: 'Shopping mall' },
      { type: 'spa', description: 'Spa' },
      { type: 'stadium', description: 'Stadium' },
      { type: 'storage', description: 'Storage' },
      { type: 'store', description: 'Store' },
      { type: 'subway_station', description: 'Subway station' },
      { type: 'supermarket', description: 'Supermarket' },
      { type: 'synagogue', description: 'Synagogue' },
      { type: 'taxi_stand', description: 'Taxi stand' },
      { type: 'tourist_attraction', description: 'Tourist attraction' },
      { type: 'train_station', description: 'Train station' },
      { type: 'transit_station', description: 'Transit station' },
      { type: 'travel_agency', description: 'Travel agency' },
      { type: 'university', description: 'University' },
      { type: 'veterinary_care', description: 'Veterinary care' },
      { type: 'zoo', description: 'Zoo' }
    ],
    notes: [
      'Use these types with nearbySearch for filtered results',
      'Multiple types can be relevant for a single place',
      'Some queries work better with text search instead of type filtering'
    ]
  });
});

module.exports = router;
