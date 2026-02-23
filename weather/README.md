# Weather Agent - OpenWeatherMap Integration

Comprehensive weather agent that handles ALL weather-related user queries using OpenWeatherMap API.

## Features

- ✅ Current weather conditions
- ✅ 5-day weather forecast
- ✅ Air quality index and pollutants
- ✅ Natural language understanding
- ✅ Multi-language support
- ✅ Contextual advice (clothing, activities, travel)
- ✅ Location resolution (city names, coordinates)
- ✅ Emoji-rich responses
- ✅ Error handling with helpful suggestions
- ✅ Websearch fallback for small cities/towns not in OpenWeatherMap

## How It Works

The weather agent uses a two-tier approach:

1. **Primary Source (OpenWeatherMap API)**: Fast, structured data for major cities worldwide
2. **Fallback Source (Web Search)**: When OpenWeatherMap doesn't have data for a location, the agent automatically searches AccuWeather, Weather.com, and other weather sites

This ensures comprehensive coverage for both major cities and small towns.

## API Integration

### OpenWeatherMap API
- **Current Weather**: `/weather`
- **5-Day Forecast**: `/forecast`
- **Air Quality**: `/air_pollution`
- **Geocoding**: `/geo/1.0/direct`
- **Reverse Geocoding**: `/geo/1.0/reverse`

## Agent Tools

### 1. getWeather
Get current weather and optional forecast for a location.

**Parameters:**
- `location` (required): Location name (e.g., "New York", "London, UK")
- `daily_forecast` (optional): Number of days (0-5, default: 0)
- `units` (optional): 'metric' | 'imperial' | 'standard' (default: 'metric')
- `language` (optional): Language code (default: 'en')

**Example:**
```javascript
{
  location: "London",
  daily_forecast: 3,
  units: "metric",
  language: "en"
}
```

### 2. getWeatherByCoordinates
Get weather by exact latitude and longitude.

**Parameters:**
- `latitude` (required): Latitude (-90 to 90)
- `longitude` (required): Longitude (-180 to 180)
- `daily_forecast` (optional): Number of days (0-5)
- `units` (optional): Temperature units
- `language` (optional): Language code

**Example:**
```javascript
{
  latitude: 40.7128,
  longitude: -74.0060,
  daily_forecast: 1
}
```

### 3. getAirQuality
Get air quality index and pollutant levels.

**Parameters:**
- `location` (required): Location name
- `language` (optional): Language code

**Example:**
```javascript
{
  location: "Delhi",
  language: "en"
}
```

### 4. searchWeatherOnline (Fallback)
Search for weather information online when OpenWeatherMap doesn't have data for a location.

**Parameters:**
- `location` (required): Location name
- `query_type` (optional): 'current' | 'forecast' | 'air_quality' (default: 'current')

**Example:**
```javascript
{
  location: "Bhadrawati",
  query_type: "current"
}
```

**Note:** This tool is automatically used as a fallback when OpenWeatherMap returns a "location not found" error. It searches AccuWeather, Weather.com, and other weather sites to provide information for small cities and towns.

## Usage Examples

### Natural Language Queries

```javascript
// Current weather
"What's the weather in London?"
"How's the weather today?"
"Weather in Tokyo"

// Forecast
"Weather forecast for next 3 days in Paris"
"Will it rain tomorrow in Seattle?"
"What's the weather going to be like this week?"

// Temperature
"How hot is it in Dubai?"
"What's the temperature in New York?"
"Is it cold in Moscow?"

// Air Quality
"Air quality in Delhi"
"Is it safe to exercise outside in Beijing?"
"What's the pollution level in Los Angeles?"

// Specific conditions
"Is it raining in London?"
"How windy is it in Chicago?"
"When is sunset today?"

// Multi-location
"Compare weather in New York and Los Angeles"
"Is it warmer in Miami or San Diego?"

// Activity planning
"Should I bring an umbrella today?"
"Good day for a picnic?"
"What should I wear today?"
```

### API Endpoints

#### Process Natural Language Query
```http
POST /api/weather/query
Content-Type: application/json

{
  "query": "What's the weather in London?",
  "userId": "user-123",
  "language": "en"
}
```

#### Get Current Weather
```http
GET /api/weather/current?location=London&daily_forecast=3&units=metric
```

#### Get Air Quality
```http
GET /api/weather/air-quality?location=Delhi
```

## Response Format

### Weather Response
```json
{
  "success": true,
  "data": {
    "location": {
      "requested": "London",
      "found": "London",
      "latitude": 51.5074,
      "longitude": -0.1278,
      "country": "GB",
      "timezone_offset_seconds": 0
    },
    "current_weather": {
      "temperature": 15,
      "feels_like": 13,
      "description": "partly cloudy",
      "main": "Clouds",
      "icon": "02d",
      "humidity": 72,
      "pressure": 1013,
      "wind_speed": 3.5,
      "wind_direction": 180,
      "cloudiness": 40,
      "visibility": 10000,
      "timestamp": "2026-02-23T10:00:00.000Z",
      "sunrise": "2026-02-23T07:15:00.000Z",
      "sunset": "2026-02-23T17:30:00.000Z"
    },
    "daily_forecast": [
      {
        "date": "2026-02-23",
        "readable_date": "2/23/2026",
        "day_of_week": "Monday",
        "min_temp": 12,
        "max_temp": 18,
        "dominant_condition": "Clouds",
        "dominant_icon": "02d",
        "forecasts": [...]
      }
    ]
  }
}
```

### Air Quality Response
```json
{
  "success": true,
  "data": {
    "location": {
      "requested": "Delhi",
      "found": "Delhi",
      "latitude": 28.6139,
      "longitude": 77.2090,
      "country": "IN"
    },
    "air_quality": {
      "index": 4,
      "level": "Poor",
      "description": "Some members of the general public may experience health effects...",
      "timestamp": "2026-02-23T10:00:00.000Z",
      "components": {
        "co": 230.5,
        "no": 0.5,
        "no2": 15.2,
        "o3": 45.8,
        "so2": 8.3,
        "pm2_5": 85.4,
        "pm10": 120.6,
        "nh3": 12.1
      }
    }
  }
}
```

## Error Handling

The agent handles various error scenarios with intelligent fallback:

### Location Not Found (with Automatic Fallback)
When OpenWeatherMap doesn't have data for a location, the agent automatically searches online weather sources:

```
User: "What's the weather in Bhadrawati?"
Agent: 
1. Tries OpenWeatherMap → Location not found
2. Automatically falls back to web search
3. Searches AccuWeather, Weather.com, etc.
4. Returns weather information from online sources
```

The user never sees the error - they just get the weather information they need!

### Location Not Found
```json
{
  "code": "LOCATION_NOT_FOUND",
  "message": "Location not found. Please check the spelling or try a different location.",
  "suggestion": "Try using format: 'City, Country Code' (e.g., 'London, UK')"
}
```

**Note:** This error is now rare because the agent automatically falls back to web search for locations not in OpenWeatherMap.

### Rate Limiting
```json
{
  "code": "RATE_LIMIT",
  "message": "Too many requests. Please try again in a moment.",
  "retryAfter": 60
}
```

### Network Error
```json
{
  "code": "NETWORK_ERROR",
  "message": "Unable to connect to weather service. Please try again.",
  "retryable": true
}
```

## Configuration

### Environment Variables
```env
OPEN_WEATHER_API_KEY=your_api_key_here
OPENAI_API_KEY=your_openai_key_here
```

### Get OpenWeatherMap API Key
1. Sign up at https://openweathermap.org/
2. Go to API Keys section
3. Generate a new API key
4. Add to `.env` file

## Testing

Run the test suite:
```bash
# Test basic weather functionality
node weather/test-weather-agent.js

# Test websearch fallback for small cities
node weather/test-websearch-fallback.js
```

## Integration with Main Agent

The weather agent is automatically integrated with the main agent. Users can ask weather questions naturally:

```javascript
// These queries are automatically routed to the weather agent
"What's the weather in London?"
"Will it rain tomorrow?"
"Air quality in Delhi"
"Temperature in Dubai"
```

## Advanced Features

### Contextual Advice
The agent provides helpful advice based on conditions:
- 🧥 Clothing recommendations
- ☔ Umbrella reminders
- 💨 Wind warnings
- 🌡️ Heat/cold advisories
- 😷 Air quality alerts

### Multi-language Support
Supports weather descriptions in multiple languages:
```javascript
// Spanish
"¿Qué tiempo hace en Madrid?"

// French
"Quel temps fait-il à Paris?"

// German
"Wie ist das Wetter in Berlin?"
```

### Location Resolution
Automatically handles:
- City names: "London", "New York"
- City + Country: "London, UK", "Paris, FR"
- Coordinates: "40.7128, -74.0060"
- Implicit location: "weather here", "current location"

## Architecture

```
weather/
├── weatherService.js          # OpenWeatherMap API integration
├── weatherAgentMultiStep.js   # Agent implementation (extends BaseAgent)
├── weatherAgentController.js  # HTTP request handlers
├── weatherRoutes.js           # Express routes
├── test-weather-agent.js      # Test suite
└── README.md                  # This file
```

## Dependencies

- `axios`: HTTP requests to OpenWeatherMap API
- `openai`: LLM for natural language understanding
- `express`: HTTP server and routing

## Future Enhancements

- [ ] Weather alerts and warnings
- [ ] Historical weather data
- [ ] UV index information
- [ ] Pollen count data
- [ ] Weather maps and radar
- [ ] Severe weather notifications
- [ ] Location-based automatic updates
- [ ] Weather comparison charts
- [ ] Integration with calendar for event planning

## Support

For issues or questions:
1. Check the error message and suggestions
2. Verify API key is valid
3. Check OpenWeatherMap API status
4. Review test suite for examples
