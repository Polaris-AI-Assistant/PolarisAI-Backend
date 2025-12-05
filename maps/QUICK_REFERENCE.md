# Google Maps Agent - Quick Reference

## 🚀 Quick Start

The Google Maps agent is now fully integrated into your Polaris AI system!

## ✅ What Was Implemented

### Backend Files Created
- `/maps/mapsService.js` - Core service with 6 Google Maps API integrations
- `/maps/mapsAgent.js` - AI agent with natural language processing
- `/maps/mapsAgentController.js` - HTTP endpoints and routing
- `/maps/README.md` - Comprehensive documentation

### Backend Updates
- `mainAgent/mainAgent.js` - Added Maps agent to coordinator
- `index.js` - Added Maps routes and API documentation

### Frontend Files Created
- `lib/maps.ts` - Maps service client library
- Updated `lib/mainAgent.ts` - Added Maps icons, names, and colors

## 🔑 Environment Variable

**Required:** Add to your `.env` file:
```env
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

### Getting API Key
1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Create/select a project
3. Enable these APIs:
   - Places API
   - Distance Matrix API  
   - Geocoding API
4. Create credentials → API Key
5. Copy to your `.env` file

## 🗺️ Available Tools

### 1. **maps.placesSearch**
```javascript
// Find places using text search
"Find cafes near me"
"Best hotels in Paris"
"Restaurants near Times Square"
```

### 2. **maps.nearbySearch**
```javascript
// Find specific types of places
"Hospitals within 5km"
"ATMs nearby"
"Parks within 2km radius"
```

### 3. **maps.placeDetails**
```javascript
// Get detailed info about a place
"Tell me more about this restaurant"
"What are the opening hours?"
"Show me reviews"
```

### 4. **maps.distanceMatrix**
```javascript
// Calculate distance and travel time
"How far is Mumbai from Pune?"
"Walking time to Central Park"
"Driving distance to LAX"
```

### 5. **maps.geocode**
```javascript
// Address → Coordinates
"Coordinates of Taj Mahal"
"Location of Times Square"
```

### 6. **maps.reverseGeocode**
```javascript
// Coordinates → Address
"What's at 19.0760,72.8777?"
"Address of these coordinates"
```

## 🎯 Example Queries

### Single Agent Queries
```
"Find cafes near me"
"Best pizza in New York"
"How far is Mumbai from Pune?"
"Coordinates of Eiffel Tower"
"Hospitals within 5km"
```

### Multi-Agent Queries (Combined with other agents)
```
"Find restaurants in Times Square and add the best one to my calendar"
"Search for hotels in Goa and email the list to john@example.com"
"Find the nearest hospital and send the address to my phone"
```

## 📍 API Endpoints

### Main Query Endpoint
```
POST /api/maps/agent/query
```

### Additional Endpoints
```
GET /api/maps/agent/examples       - Get example queries
GET /api/maps/agent/capabilities   - Get capabilities list
GET /api/maps/agent/place-types    - Get supported place types
GET /api/maps/agent/status         - Check agent status
```

## 🧪 Testing

### 1. Check Status
```bash
curl http://localhost:3000/api/maps/agent/status
```

### 2. Test Query (with auth)
```bash
curl -X POST http://localhost:3000/api/maps/agent/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"query": "find cafes near Times Square"}'
```

### 3. From Main Agent
```bash
curl -X POST http://localhost:3000/api/agent/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"query": "find restaurants in Paris"}'
```

## 🔧 Supported Features

### Place Types (100+ types)
- **Food & Drink**: restaurant, cafe, bar, bakery
- **Lodging**: hotel, motel, lodging
- **Healthcare**: hospital, pharmacy, doctor, dentist
- **Services**: bank, atm, gas_station, parking
- **Recreation**: park, gym, museum, library
- **Shopping**: store, shopping_mall, supermarket
- [Full list available via `/api/maps/agent/place-types`]

### Travel Modes
- `driving` (default)
- `walking`
- `bicycling`
- `transit`

## 🎨 Frontend Integration

The agent is automatically available through:
1. **Main Agent Chat** - Just ask naturally
2. **Direct Maps queries** - Processed intelligently
3. **Combined with other agents** - Seamless coordination

### UI Elements
- **Icon**: 🗺️
- **Color**: Orange
- **Display Name**: Maps

## ⚡ Performance Notes

- Response times: 500-2000ms (depends on Google API)
- Results limited to 5-10 places to avoid overwhelming users
- Place photos limited to 3 per place
- Reviews limited to 5 per place

## 🛠️ Troubleshooting

### "API key not configured"
→ Add `GOOGLE_MAPS_API_KEY` to `.env`

### "API error: REQUEST_DENIED"
→ Enable required APIs in Google Cloud Console

### "ZERO_RESULTS"
→ Try different search terms or location

### "OVER_QUERY_LIMIT"
→ Check API quotas in Google Cloud Console

## 📝 Implementation Notes

### Architecture Flow
```
User Query
    ↓
Main Agent (analyzes intent)
    ↓
Maps Agent (processes with OpenAI)
    ↓
Maps Service (calls Google APIs)
    ↓
Google Maps APIs
    ↓
Formatted Response to User
```

### Key Features
✅ Natural language understanding (via OpenAI GPT-4)
✅ Multi-tool support (handles complex queries)
✅ Error handling with user-friendly messages
✅ Automatic result formatting
✅ Integration with main agent coordinator
✅ Conversation context support
✅ Streaming responses (through main agent)

## 🚀 Next Steps

1. **Add API Key**: Update `.env` with your Google Maps API key
2. **Restart Backend**: `npm start` in backend directory
3. **Test**: Try queries in your frontend chat
4. **Monitor**: Check Google Cloud Console for API usage

## 📚 Documentation

- Backend: `/maps/README.md`
- API Docs: `http://localhost:3000/api` (when running)
- Google Maps API: https://developers.google.com/maps

---

**Status**: ✅ Fully Implemented
**Version**: 1.0.0
**Date**: December 5, 2025
