/**
 * Weather Service - OpenWeatherMap API Integration
 * Handles all weather-related API calls and data formatting
 */

const axios = require('axios');

const OPENWEATHER_API_KEY = process.env.OPEN_WEATHER_API_KEY;
const BASE_URL = 'https://api.openweathermap.org';

/**
 * Geocode a location name to coordinates
 */
async function geocodeLocation(locationName, limit = 1) {
  try {
    console.log(`[WeatherService] 🌍 Geocoding location: ${locationName}`);
    
    const response = await axios.get(`${BASE_URL}/geo/1.0/direct`, {
      params: {
        q: locationName,
        limit: limit,
        appid: OPENWEATHER_API_KEY
      }
    });

    if (!response.data || response.data.length === 0) {
      throw new Error('LOCATION_NOT_FOUND');
    }

    const location = response.data[0];
    console.log(`[WeatherService] ✅ Found: ${location.name}, ${location.country}`);
    
    return {
      name: location.name,
      latitude: location.lat,
      longitude: location.lon,
      country: location.country,
      state: location.state
    };
  } catch (error) {
    console.error('[WeatherService] ❌ Geocoding error:', error.message);
    throw error;
  }
}

/**
 * Reverse geocode coordinates to location name
 */
async function reverseGeocode(latitude, longitude) {
  try {
    console.log(`[WeatherService] 🌍 Reverse geocoding: ${latitude}, ${longitude}`);
    
    const response = await axios.get(`${BASE_URL}/geo/1.0/reverse`, {
      params: {
        lat: latitude,
        lon: longitude,
        limit: 1,
        appid: OPENWEATHER_API_KEY
      }
    });

    if (!response.data || response.data.length === 0) {
      return {
        name: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        latitude,
        longitude,
        country: 'Unknown'
      };
    }

    const location = response.data[0];
    return {
      name: location.name,
      latitude,
      longitude,
      country: location.country,
      state: location.state
    };
  } catch (error) {
    console.error('[WeatherService] ❌ Reverse geocoding error:', error.message);
    return {
      name: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
      latitude,
      longitude,
      country: 'Unknown'
    };
  }
}

/**
 * Get current weather and optional forecast
 */
async function getWeather(params) {
  const {
    location,
    daily_forecast = 0,
    units = 'metric',
    language = 'en'
  } = params;

  try {
    console.log(`[WeatherService] 🌤️ Getting weather for: ${location}`);
    
    // Geocode location
    const geoLocation = await geocodeLocation(location);
    
    // Get current weather
    const currentResponse = await axios.get(`${BASE_URL}/data/2.5/weather`, {
      params: {
        lat: geoLocation.latitude,
        lon: geoLocation.longitude,
        units: units,
        lang: language,
        appid: OPENWEATHER_API_KEY
      }
    });

    const current = currentResponse.data;
    
    // Format current weather
    const currentWeather = {
      temperature: Math.round(current.main.temp),
      feels_like: Math.round(current.main.feels_like),
      description: current.weather[0].description,
      main: current.weather[0].main,
      icon: current.weather[0].icon,
      humidity: current.main.humidity,
      pressure: current.main.pressure,
      wind_speed: current.wind.speed,
      wind_direction: current.wind.deg,
      cloudiness: current.clouds.all,
      visibility: current.visibility,
      rain_1h: current.rain?.['1h'],
      snow_1h: current.snow?.['1h'],
      timestamp: new Date(current.dt * 1000).toISOString(),
      sunrise: new Date(current.sys.sunrise * 1000).toISOString(),
      sunset: new Date(current.sys.sunset * 1000).toISOString()
    };

    const result = {
      success: true,
      data: {
        location: {
          requested: location,
          found: geoLocation.name,
          latitude: geoLocation.latitude,
          longitude: geoLocation.longitude,
          country: geoLocation.country,
          state: geoLocation.state,
          timezone_offset_seconds: current.timezone
        },
        current_weather: currentWeather,
        timestamp: new Date().toISOString()
      }
    };

    // Get forecast if requested
    if (daily_forecast > 0) {
      const forecastResponse = await axios.get(`${BASE_URL}/data/2.5/forecast`, {
        params: {
          lat: geoLocation.latitude,
          lon: geoLocation.longitude,
          units: units,
          lang: language,
          appid: OPENWEATHER_API_KEY
        }
      });

      result.data.daily_forecast = formatForecast(forecastResponse.data, daily_forecast);
    }

    console.log(`[WeatherService] ✅ Weather data retrieved successfully`);
    return result;

  } catch (error) {
    console.error('[WeatherService] ❌ Error getting weather:', error.message);
    throw handleWeatherError(error);
  }
}

/**
 * Get weather by coordinates
 */
async function getWeatherByCoordinates(params) {
  const {
    latitude,
    longitude,
    daily_forecast = 0,
    units = 'metric',
    language = 'en'
  } = params;

  try {
    console.log(`[WeatherService] 🌤️ Getting weather for coordinates: ${latitude}, ${longitude}`);
    
    // Reverse geocode to get location name
    const geoLocation = await reverseGeocode(latitude, longitude);
    
    // Get current weather
    const currentResponse = await axios.get(`${BASE_URL}/data/2.5/weather`, {
      params: {
        lat: latitude,
        lon: longitude,
        units: units,
        lang: language,
        appid: OPENWEATHER_API_KEY
      }
    });

    const current = currentResponse.data;
    
    const currentWeather = {
      temperature: Math.round(current.main.temp),
      feels_like: Math.round(current.main.feels_like),
      description: current.weather[0].description,
      main: current.weather[0].main,
      icon: current.weather[0].icon,
      humidity: current.main.humidity,
      pressure: current.main.pressure,
      wind_speed: current.wind.speed,
      wind_direction: current.wind.deg,
      cloudiness: current.clouds.all,
      visibility: current.visibility,
      rain_1h: current.rain?.['1h'],
      snow_1h: current.snow?.['1h'],
      timestamp: new Date(current.dt * 1000).toISOString(),
      sunrise: new Date(current.sys.sunrise * 1000).toISOString(),
      sunset: new Date(current.sys.sunset * 1000).toISOString()
    };

    const result = {
      success: true,
      data: {
        location: {
          requested: `${latitude}, ${longitude}`,
          found: geoLocation.name,
          latitude: latitude,
          longitude: longitude,
          country: geoLocation.country,
          state: geoLocation.state,
          timezone_offset_seconds: current.timezone
        },
        current_weather: currentWeather,
        timestamp: new Date().toISOString()
      }
    };

    // Get forecast if requested
    if (daily_forecast > 0) {
      const forecastResponse = await axios.get(`${BASE_URL}/data/2.5/forecast`, {
        params: {
          lat: latitude,
          lon: longitude,
          units: units,
          lang: language,
          appid: OPENWEATHER_API_KEY
        }
      });

      result.data.daily_forecast = formatForecast(forecastResponse.data, daily_forecast);
    }

    console.log(`[WeatherService] ✅ Weather data retrieved successfully`);
    return result;

  } catch (error) {
    console.error('[WeatherService] ❌ Error getting weather:', error.message);
    throw handleWeatherError(error);
  }
}

/**
 * Get air quality data
 */
async function getAirQuality(params) {
  const { location, language = 'en' } = params;

  try {
    console.log(`[WeatherService] 🌫️ Getting air quality for: ${location}`);
    
    // Geocode location
    const geoLocation = await geocodeLocation(location);
    
    // Get air quality
    const response = await axios.get(`${BASE_URL}/data/2.5/air_pollution`, {
      params: {
        lat: geoLocation.latitude,
        lon: geoLocation.longitude,
        appid: OPENWEATHER_API_KEY
      }
    });

    const aqi = response.data.list[0];
    const aqiLevel = getAQILevel(aqi.main.aqi);
    
    const result = {
      success: true,
      data: {
        location: {
          requested: location,
          found: geoLocation.name,
          latitude: geoLocation.latitude,
          longitude: geoLocation.longitude,
          country: geoLocation.country,
          state: geoLocation.state
        },
        air_quality: {
          index: aqi.main.aqi,
          level: aqiLevel.level,
          description: aqiLevel.description,
          timestamp: new Date(aqi.dt * 1000).toISOString(),
          components: {
            co: aqi.components.co,
            no: aqi.components.no,
            no2: aqi.components.no2,
            o3: aqi.components.o3,
            so2: aqi.components.so2,
            pm2_5: aqi.components.pm2_5,
            pm10: aqi.components.pm10,
            nh3: aqi.components.nh3
          }
        },
        timestamp: new Date().toISOString()
      }
    };

    console.log(`[WeatherService] ✅ Air quality data retrieved successfully`);
    return result;

  } catch (error) {
    console.error('[WeatherService] ❌ Error getting air quality:', error.message);
    throw handleWeatherError(error);
  }
}

/**
 * Format forecast data into daily summaries
 */
function formatForecast(forecastData, days) {
  const dailyMap = new Map();
  
  // Group forecasts by date
  forecastData.list.forEach(item => {
    const date = new Date(item.dt * 1000);
    const dateKey = date.toISOString().split('T')[0];
    
    if (!dailyMap.has(dateKey)) {
      dailyMap.set(dateKey, []);
    }
    
    dailyMap.get(dateKey).push({
      time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
      timestamp: date.toISOString(),
      temperature: Math.round(item.main.temp),
      feels_like: Math.round(item.main.feels_like),
      description: item.weather[0].description,
      main: item.weather[0].main,
      icon: item.weather[0].icon,
      humidity: item.main.humidity,
      wind_speed: item.wind.speed,
      probability: item.pop
    });
  });

  // Convert to array and limit to requested days
  const dailyForecasts = [];
  let count = 0;
  
  for (const [dateKey, forecasts] of dailyMap) {
    if (count >= days) break;
    
    const date = new Date(dateKey);
    const temps = forecasts.map(f => f.temperature);
    const feelsLike = forecasts.map(f => f.feels_like);
    
    // Find dominant condition
    const conditionCounts = {};
    forecasts.forEach(f => {
      conditionCounts[f.main] = (conditionCounts[f.main] || 0) + 1;
    });
    const dominantCondition = Object.keys(conditionCounts).reduce((a, b) => 
      conditionCounts[a] > conditionCounts[b] ? a : b
    );
    const dominantIcon = forecasts.find(f => f.main === dominantCondition)?.icon || forecasts[0].icon;
    
    dailyForecasts.push({
      date: dateKey,
      readable_date: date.toLocaleDateString('en-US'),
      day_of_week: date.toLocaleDateString('en-US', { weekday: 'long' }),
      forecasts: forecasts,
      min_temp: Math.min(...temps),
      max_temp: Math.max(...temps),
      min_feels_like: Math.min(...feelsLike),
      max_feels_like: Math.max(...feelsLike),
      dominant_condition: dominantCondition,
      dominant_icon: dominantIcon
    });
    
    count++;
  }
  
  return dailyForecasts;
}

/**
 * Get AQI level description
 */
function getAQILevel(index) {
  const levels = {
    1: {
      level: 'Good',
      description: 'Air quality is satisfactory, and air pollution poses little or no risk.'
    },
    2: {
      level: 'Fair',
      description: 'Air quality is acceptable. However, there may be a risk for some people, particularly those who are unusually sensitive to air pollution.'
    },
    3: {
      level: 'Moderate',
      description: 'Members of sensitive groups may experience health effects. The general public is less likely to be affected.'
    },
    4: {
      level: 'Poor',
      description: 'Some members of the general public may experience health effects; members of sensitive groups may experience more serious health effects.'
    },
    5: {
      level: 'Very Poor',
      description: 'Health alert: The risk of health effects is increased for everyone.'
    }
  };
  
  return levels[index] || levels[3];
}

/**
 * Handle weather API errors
 */
function handleWeatherError(error) {
  if (error.message === 'LOCATION_NOT_FOUND') {
    return {
      code: 'LOCATION_NOT_FOUND',
      message: 'Location not found. Please check the spelling or try a different location.',
      suggestion: 'Try using format: "City, Country Code" (e.g., "London, UK")'
    };
  }
  
  if (error.response) {
    const status = error.response.status;
    
    if (status === 404) {
      return {
        code: 'LOCATION_NOT_FOUND',
        message: 'Location not found. Please check the spelling or try a different location.'
      };
    }
    
    if (status === 401) {
      return {
        code: 'API_ERROR',
        message: 'Weather service authentication failed.',
        internal: true
      };
    }
    
    if (status === 429) {
      return {
        code: 'RATE_LIMIT',
        message: 'Too many requests. Please try again in a moment.',
        retryAfter: 60
      };
    }
  }
  
  if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
    return {
      code: 'NETWORK_ERROR',
      message: 'Unable to connect to weather service. Please try again.',
      retryable: true
    };
  }
  
  return {
    code: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred while fetching weather data.',
    details: error.message
  };
}

module.exports = {
  geocodeLocation,
  reverseGeocode,
  getWeather,
  getWeatherByCoordinates,
  getAirQuality
};
