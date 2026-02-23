/**
 * Weather Agent Controller
 * Handles HTTP requests for weather-related queries
 */

const WeatherAgentMultiStep = require('./weatherAgentMultiStep');
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Process weather query
 */
async function processWeatherQuery(req, res) {
  try {
    const { query, userId, conversationId, language } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required'
      });
    }

    console.log('[WeatherController] 🌤️ Processing weather query:', query);
    console.log('[WeatherController] User ID:', userId);
    console.log('[WeatherController] Language:', language);

    // Create weather agent instance
    const weatherAgent = new WeatherAgentMultiStep(openai);

    // Process the query
    const result = await weatherAgent.processQuery(query, {
      userId,
      conversationId,
      language: language || 'en'
    });

    console.log('[WeatherController] ✅ Query processed successfully');

    return res.json({
      success: true,
      result: result
    });

  } catch (error) {
    console.error('[WeatherController] ❌ Error processing query:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to process weather query',
      details: error.code || 'UNKNOWN_ERROR'
    });
  }
}

/**
 * Get weather for a specific location (direct API endpoint)
 */
async function getWeather(req, res) {
  try {
    const { location, daily_forecast, units, language } = req.query;

    if (!location) {
      return res.status(400).json({
        success: false,
        error: 'Location is required'
      });
    }

    const weatherService = require('./weatherService');
    const result = await weatherService.getWeather({
      location,
      daily_forecast: parseInt(daily_forecast) || 0,
      units: units || 'metric',
      language: language || 'en'
    });

    return res.json(result);

  } catch (error) {
    console.error('[WeatherController] ❌ Error getting weather:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get weather data'
    });
  }
}

/**
 * Get air quality for a specific location (direct API endpoint)
 */
async function getAirQuality(req, res) {
  try {
    const { location, language } = req.query;

    if (!location) {
      return res.status(400).json({
        success: false,
        error: 'Location is required'
      });
    }

    const weatherService = require('./weatherService');
    const result = await weatherService.getAirQuality({
      location,
      language: language || 'en'
    });

    return res.json(result);

  } catch (error) {
    console.error('[WeatherController] ❌ Error getting air quality:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get air quality data'
    });
  }
}

module.exports = {
  processWeatherQuery,
  getWeather,
  getAirQuality
};
