# Google Maps AI Agent

The Google Maps AI Agent provides intelligent, natural language access to Google Maps APIs, allowing users to search for places, get directions, calculate distances, and perform geocoding operations.

## Features

- **Place Search**: Find places using natural language queries
- **Nearby Search**: Discover specific types of places near a location
- **Place Details**: Get comprehensive information about any place
- **Distance Matrix**: Calculate distance and travel time between locations
- **Geocoding**: Convert addresses to coordinates
- **Reverse Geocoding**: Convert coordinates to addresses
- **Multi-modal Directions**: Support for driving, walking, bicycling, and transit

## Available Tools

### 1. `maps_placesSearch`
Search for places using Google Places API text search.

**Use Cases:**
- "Find cafes near me"
- "Best hotels in Paris"
- "Temples in Jaipur"
- "Restaurants near Times Square"

**Parameters:**
```javascript
{
  query: string,        // Required: what to search for
  location?: string,    // Optional: "lat,lng" to bias results
  radius?: number       // Optional: search radius in meters
}
```

### 2. `maps_nearbySearch`
Find specific types of places near a location (more structured than text search).

**Use Cases:**
- "Find hospitals within 5km"
- "ATMs near this location"
- "Parks nearby"

**Parameters:**
```javascript
{
  location: string,     // Required: "lat,lng"
  radius: number,       // Required: search radius in meters (max 50000)
  type?: string         // Optional: restaurant, hospital, cafe, etc.
}
```

### 3. `maps_placeDetails`
Get comprehensive details about a specific place.

**Use Cases:**
- "Tell me more about this restaurant"
- "What are the opening hours?"
- "Show me reviews"

**Parameters:**
```javascript
{
  place_id: string      // Required: Google Place ID from search results
}
```

### 4. `maps_distanceMatrix`
Calculate distance and travel time between two locations.

**Use Cases:**
- "How far is it from Mumbai to Pune?"
- "Walking time to Central Park"
- "Driving distance between addresses"

**Parameters:**
```javascript
{
  origins: string,         // Required: "lat,lng" OR address
  destinations: string,    // Required: "lat,lng" OR address
  mode?: string           // Optional: driving, walking, bicycling, transit
}
```

### 5. `maps_geocode`
Convert an address to latitude/longitude coordinates.

**Use Cases:**
- "What are the coordinates of Taj Mahal?"
- "Get location of Times Square"

**Parameters:**
```javascript
{
  address: string       // Required: full address
}
```

### 6. `maps_reverseGeocode`
Convert coordinates to a human-readable address.

**Use Cases:**
- "What's the address of 19.0760,72.8777?"
- "Where is this location?"

**Parameters:**
```javascript
{
  lat: number,         // Required: latitude
  lng: number          // Required: longitude
}
```

## API Endpoints

### Process Query
**POST** `/api/maps/agent/query`

Process natural language queries about Google Maps.

**Request:**
```json
{
  "query": "find restaurants near Times Square",
  "conversationHistory": []  // optional
}
```

**Response:**
```json
{
  "success": true,
  "response": "I found several restaurants near Times Square...",
  "query": "find restaurants near Times Square",
  "toolsUsed": ["maps.placesSearch"],
  "results": [...],
  "executionTime": 1234,
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

### Get Examples
**GET** `/api/maps/agent/examples`

Get example queries that the Maps agent can handle.

### Get Capabilities
**GET** `/api/maps/agent/capabilities`

Get detailed information about agent capabilities and supported features.

### Get Place Types
**GET** `/api/maps/agent/place-types`

Get a complete list of supported place types for filtering.

### Check Status
**GET** `/api/maps/agent/status`

Check if the Maps agent is operational.

## Supported Place Types

Common place types include:
- `restaurant`, `cafe`, `bar`
- `hotel`, `lodging`
- `hospital`, `pharmacy`, `doctor`
- `bank`, `atm`
- `gym`, `park`, `museum`
- `shopping_mall`, `store`
- `airport`, `train_station`, `gas_station`
- `school`, `university`, `library`
- And many more...

See `/api/maps/agent/place-types` for the complete list.

## Travel Modes

Supported travel modes for distance calculations:
- `driving` (default)
- `walking`
- `bicycling`
- `transit`

## Setup

### Environment Variables

Add the following to your `.env` file:

```env
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

### Getting a Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Places API
   - Distance Matrix API
   - Geocoding API
4. Go to "Credentials" and create an API key
5. (Optional) Restrict the API key to specific APIs for security

### Required APIs

The following Google Maps APIs must be enabled:
- **Places API**: For place search and details
- **Distance Matrix API**: For distance calculations
- **Geocoding API**: For geocoding and reverse geocoding

## Integration with Main Agent

The Maps agent is automatically available through the Main Coordinator Agent. You can use it directly or combine it with other agents:

### Direct Usage
```javascript
"find cafes near me"
"best hotels in Paris"
"how far is Mumbai from Pune"
```

### Combined with Other Agents
```javascript
"find restaurants near Times Square and add the best one to my calendar"
"search for hotels in Goa and email the list to john@example.com"
```

## Example Queries

### Place Search
- "Find cafes near me"
- "Best pizza places in New York"
- "Temples in Jaipur"
- "Hotels in downtown San Francisco"

### Nearby Search
- "Find hospitals within 5km of my location"
- "Show me ATMs nearby"
- "Parks within 2km radius"

### Place Details
- "Tell me more about this restaurant"
- "What are the opening hours?"
- "Show me reviews for this place"
- "Get contact information"

### Distance & Directions
- "How far is it from Mumbai to Pune?"
- "Walking time from here to Central Park"
- "Driving distance between San Francisco and Los Angeles"
- "Transit time to Times Square"

### Geocoding
- "What are the coordinates of Taj Mahal?"
- "Get location of Central Park"
- "What's the address of 19.0760,72.8777?"

## Architecture

```
User Query
    ↓
Main Agent (analyzes intent)
    ↓
Maps Agent (processes query)
    ↓
Maps Service (calls Google APIs)
    ↓
Google Maps APIs
    ↓
Formatted Response
```

## Error Handling

The agent handles various error scenarios:
- Invalid API key
- Invalid parameters
- API quota exceeded
- No results found
- Network errors

Errors are returned in a user-friendly format with suggestions for resolution.

## Best Practices

1. **Be Specific**: More specific queries yield better results
2. **Use Coordinates**: When available, coordinates are more accurate than addresses
3. **Specify Travel Mode**: Always specify walking, driving, etc. for distance queries
4. **Provide Context**: Include relevant details like "near me" or specific locations
5. **Check Status**: Use the status endpoint to verify API key configuration

## Limitations

- API rate limits apply based on your Google Cloud project
- Some features require a billing account
- Maximum radius for nearby search is 50,000 meters
- Results are limited to avoid excessive response sizes

## Support

For issues or questions:
1. Check the status endpoint to verify configuration
2. Review Google Maps API quotas in Cloud Console
3. Ensure all required APIs are enabled
4. Verify API key restrictions aren't blocking requests
