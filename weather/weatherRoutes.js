/**
 * Weather Routes
 * API endpoints for weather operations
 */

const express = require('express');
const router = express.Router();
const weatherController = require('./weatherAgentController');

// Weather agent query endpoint
router.post('/query', weatherController.processWeatherQuery);

// Direct weather data endpoints
router.get('/current', weatherController.getWeather);
router.get('/air-quality', weatherController.getAirQuality);

module.exports = router;
