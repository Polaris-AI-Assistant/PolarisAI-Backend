# Flights Agent

The Flights Agent provides flight search functionality using SerpAPI Google Flights. It integrates seamlessly with the Polaris AI main agent system.

## Features

- **Flight Search**: Search for flights between any two cities or airports
- **Price Comparison**: Compare prices across different airlines and flight options
- **Price Insights**: Get information about price trends and best times to book
- **Round-trip Support**: Search for both one-way and round-trip flights
- **Multi-currency**: Support for different currencies (INR, USD, EUR, etc.)
- **Multiple Travelers**: Search for multiple adult passengers

## Configuration

### Environment Variables

Add the following to your `.env` file:

```env
SERPAPI_KEY=your_serpapi_key_here
# Optional: customize the endpoint
SERPAPI_ENGINE=google_flights
SERPAPI_FLIGHTS_ENDPOINT=https://serpapi.com/search.json
```

### Getting a SerpAPI Key

1. Go to [SerpAPI](https://serpapi.com/)
2. Sign up for an account
3. Navigate to the API Key section
4. Copy your API key and add it to `.env`

## API Endpoints

### POST /api/flights/agent/query

Process natural language queries about flights.

**Request:**
```json
{
  "query": "find flights from Mumbai to Delhi on December 15"
}
```

**Response:**
```json
{
  "success": true,
  "response": "I found several flights...",
  "query": "find flights...",
  "tools_used": [...],
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

### GET /api/flights/agent/examples

Get example queries users can try.

### GET /api/flights/agent/airports

Get a list of common airport codes for reference.

### GET /api/flights/agent/status

Check if the flights agent is operational.

## Tools

The Flights Agent has two tools:

### getFlightsList

Search for available flights between cities/airports.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| from | string | Yes | Departure city or airport code (e.g., BOM, Mumbai) |
| to | string | Yes | Arrival city or airport code (e.g., DEL, New Delhi) |
| date | string | Yes | Outbound date in YYYY-MM-DD format |
| returnDate | string | No | Return date for round-trip (YYYY-MM-DD) |
| currency | string | No | Currency code (default: INR) |
| travelers | number | No | Number of adult travelers (default: 1) |

### getFlightsPriceInsights

Get price insights and trends for flights.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| from | string | Yes | Departure city or airport code |
| to | string | Yes | Arrival city or airport code |
| date | string | Yes | Outbound date in YYYY-MM-DD format |

## Common Airport Codes

### India
| Code | City |
|------|------|
| BOM | Mumbai |
| DEL | Delhi |
| BLR | Bangalore |
| MAA | Chennai |
| CCU | Kolkata |
| HYD | Hyderabad |
| PNQ | Pune |
| AMD | Ahmedabad |
| GOI | Goa |
| JAI | Jaipur |

### International
| Code | City |
|------|------|
| JFK | New York |
| LAX | Los Angeles |
| LHR | London |
| DXB | Dubai |
| SIN | Singapore |
| HKG | Hong Kong |
| NRT | Tokyo |
| SYD | Sydney |
| CDG | Paris |
| FRA | Frankfurt |

## Usage with Main Agent

The Flights Agent is integrated with the Main Coordinator Agent. Users can ask flight-related questions through the main agent endpoint:

```bash
POST /api/agent/query
{
  "query": "find flights from Mumbai to Delhi tomorrow"
}
```

The main agent will automatically route flight-related queries to the Flights Agent.

## Example Queries

- "Find flights from Mumbai to Delhi on December 15"
- "Search for flights from BOM to BLR tomorrow"
- "Compare flight prices from Delhi to Goa for next week"
- "What's the cheapest flight from Bangalore to Chennai?"
- "Find round trip flights from Mumbai to Dubai from Dec 20 to Dec 27"
- "Show me morning flights from Pune to Hyderabad"
- "Find flights for 2 passengers from Delhi to London"

## Error Handling

The agent handles various error scenarios:

- **Missing API Key**: Returns an error if SERPAPI_KEY is not configured
- **Invalid Parameters**: Returns helpful error messages for invalid dates, city codes, etc.
- **Rate Limiting**: Handles API rate limits gracefully
- **Network Errors**: Provides user-friendly messages for connectivity issues

## Files

- `flightsService.js` - Core flight search service using SerpAPI
- `flightsAgent.js` - AI Agent with OpenAI function calling
- `flightsAgentController.js` - Express router with HTTP endpoints
- `README.md` - This documentation file
