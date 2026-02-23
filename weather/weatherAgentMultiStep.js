/**
 * Weather Agent - Multi-Step Execution Version
 * 
 * Handles all weather-related queries using OpenWeatherMap API
 * Supports natural language understanding and contextual responses
 */

const BaseAgent = require('../base/BaseAgent');
const weatherService = require('./weatherService');
const OpenAI = require('openai');

class WeatherAgentMultiStep extends BaseAgent {
  constructor(llmClient) {
    // Define tools with definition + execute pattern
    const tools = {
      getWeather: {
        definition: {
          type: 'function',
          function: {
            name: 'getWeather',
            description: 'Get current weather and optional forecast for a location. Use for queries about weather conditions, temperature, forecast, etc.',
            parameters: {
              type: 'object',
              properties: {
                location: {
                  type: 'string',
                  description: 'Location name (e.g., "New York", "London, UK", "Tokyo, JP")'
                },
                daily_forecast: {
                  type: 'number',
                  description: 'Number of days to forecast (0-5). 0 = current weather only, 1-5 = include forecast',
                  minimum: 0,
                  maximum: 5
                },
                units: {
                  type: 'string',
                  enum: ['metric', 'imperial', 'standard'],
                  description: 'Temperature units (metric=Celsius, imperial=Fahrenheit, standard=Kelvin)',
                  default: 'metric'
                },
                language: {
                  type: 'string',
                  description: 'Language code for weather descriptions (e.g., "en", "es", "fr")',
                  default: 'en'
                }
              },
              required: ['location']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[WeatherAgent] 🌤️ Getting weather for: ${params.location}`);
          
          try {
            const result = await weatherService.getWeather({
              location: params.location,
              daily_forecast: params.daily_forecast || 0,
              units: params.units || 'metric',
              language: params.language || context.language || 'en'
            });

            console.log(`[WeatherAgent] ✅ Weather data retrieved successfully`);
            
            return result.data;
          } catch (error) {
            console.error(`[WeatherAgent] ❌ Error getting weather:`, error);
            throw error;
          }
        }
      },

      getWeatherByCoordinates: {
        definition: {
          type: 'function',
          function: {
            name: 'getWeatherByCoordinates',
            description: 'Get weather by exact latitude and longitude coordinates. Use when user provides specific coordinates.',
            parameters: {
              type: 'object',
              properties: {
                latitude: {
                  type: 'number',
                  description: 'Latitude coordinate (-90 to 90)'
                },
                longitude: {
                  type: 'number',
                  description: 'Longitude coordinate (-180 to 180)'
                },
                daily_forecast: {
                  type: 'number',
                  description: 'Number of days to forecast (0-5)',
                  minimum: 0,
                  maximum: 5
                },
                units: {
                  type: 'string',
                  enum: ['metric', 'imperial', 'standard'],
                  description: 'Temperature units',
                  default: 'metric'
                },
                language: {
                  type: 'string',
                  description: 'Language code',
                  default: 'en'
                }
              },
              required: ['latitude', 'longitude']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[WeatherAgent] 🌤️ Getting weather for coordinates: ${params.latitude}, ${params.longitude}`);
          
          try {
            const result = await weatherService.getWeatherByCoordinates({
              latitude: params.latitude,
              longitude: params.longitude,
              daily_forecast: params.daily_forecast || 0,
              units: params.units || 'metric',
              language: params.language || context.language || 'en'
            });

            console.log(`[WeatherAgent] ✅ Weather data retrieved successfully`);
            
            return result.data;
          } catch (error) {
            console.error(`[WeatherAgent] ❌ Error getting weather:`, error);
            throw error;
          }
        }
      },

      getAirQuality: {
        definition: {
          type: 'function',
          function: {
            name: 'getAirQuality',
            description: 'Get air quality index and pollutant levels for a location. Use for queries about air pollution, air quality, or outdoor activity safety.',
            parameters: {
              type: 'object',
              properties: {
                location: {
                  type: 'string',
                  description: 'Location name (e.g., "Delhi", "Beijing", "Los Angeles")'
                },
                language: {
                  type: 'string',
                  description: 'Language code',
                  default: 'en'
                }
              },
              required: ['location']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[WeatherAgent] 🌫️ Getting air quality for: ${params.location}`);
          
          try {
            const result = await weatherService.getAirQuality({
              location: params.location,
              language: params.language || context.language || 'en'
            });

            console.log(`[WeatherAgent] ✅ Air quality data retrieved successfully`);
            
            return result.data;
          } catch (error) {
            console.error(`[WeatherAgent] ❌ Error getting air quality:`, error);
            throw error;
          }
        }
      },

      searchWeatherOnline: {
        definition: {
          type: 'function',
          function: {
            name: 'searchWeatherOnline',
            description: 'Search for weather information online using web search. Use this as a FALLBACK when OpenWeatherMap cannot find the location (e.g., small cities, towns). This will search AccuWeather, Weather.com, and other weather sites.',
            parameters: {
              type: 'object',
              properties: {
                location: {
                  type: 'string',
                  description: 'Location name to search weather for'
                },
                query_type: {
                  type: 'string',
                  enum: ['current', 'forecast', 'air_quality'],
                  description: 'Type of weather information needed',
                  default: 'current'
                }
              },
              required: ['location']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[WeatherAgent] 🌐 Searching weather online for: ${params.location}`);
          
          try {
            // Import websearch agent
            const WebSearchAgentMultiStep = require('../websearch/webSearchAgentMultiStep');
            const webSearchAgent = new WebSearchAgentMultiStep(context.llmClient);
            
            // Build appropriate search query
            let searchQuery;
            switch (params.query_type) {
              case 'forecast':
                searchQuery = `weather forecast ${params.location}`;
                break;
              case 'air_quality':
                searchQuery = `air quality index ${params.location}`;
                break;
              default:
                searchQuery = `current weather ${params.location}`;
            }
            
            console.log(`[WeatherAgent] 🔍 Web search query: "${searchQuery}"`);
            
            // Use websearch agent to get weather information
            const result = await webSearchAgent.processQuery(searchQuery, {
              userId: context.userId,
              conversationId: context.conversationId,
              language: context.language || 'en'
            });

            console.log(`[WeatherAgent] ✅ Weather information retrieved from web search`);
            
            // Extract the synthesized content from websearch result
            // The websearch agent returns executedActions with synthesizedContent
            let weatherContent = '';
            
            if (result.executedActions && result.executedActions.length > 0) {
              const researchAction = result.executedActions.find(
                action => action.tool === 'researchAndSynthesize' || action.tool === 'fetchAndSynthesize'
              );
              
              if (researchAction && researchAction.result) {
                weatherContent = researchAction.result.synthesizedContent || 
                                researchAction.result.synthesis || 
                                researchAction.result.content || '';
              }
            }
            
            // Fallback to summary if no synthesized content found
            if (!weatherContent) {
              weatherContent = result.summary || result.response || 'Weather information retrieved from online sources.';
            }
            
            return {
              source: 'web_search',
              location: params.location,
              query_type: params.query_type,
              weather_data: weatherContent,
              sources_used: result.executedActions?.[0]?.result?.sourcesUsed || 0,
              note: 'Information gathered from AccuWeather, Weather.com, and other weather sites.'
            };
          } catch (error) {
            console.error(`[WeatherAgent] ❌ Error searching weather online:`, error);
            throw error;
          }
        }
      }
    };

    // Initialize BaseAgent with tools
    super('WeatherAgent', tools, llmClient || new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));
    
    // Set custom system prompt for weather agent
    this.systemPrompt = `You are a helpful weather assistant. You provide accurate, up-to-date weather information and helpful advice.

IMPORTANT GUIDELINES:
1. Always try getWeather or getWeatherByCoordinates FIRST for weather data
2. If OpenWeatherMap returns a LOCATION_NOT_FOUND error, immediately use searchWeatherOnline as fallback
3. The searchWeatherOnline tool searches AccuWeather, Weather.com, and other weather sites for smaller cities/towns
4. When using searchWeatherOnline results, the weather_data field contains COMPLETE markdown-formatted weather information - use it directly in your response
5. Provide natural, conversational responses with relevant emojis
6. Include actionable advice when appropriate (clothing, activities, travel)
7. Format temperatures and measurements according to user's preference
8. If location is unclear, ask for clarification
9. For forecast queries, use daily_forecast parameter (1-5 days)
10. For air quality concerns, use getAirQuality tool
11. Be concise but informative

FALLBACK STRATEGY:
- Try getWeather first (uses OpenWeatherMap API)
- If error contains "not found" or "LOCATION_NOT_FOUND", call searchWeatherOnline
- searchWeatherOnline returns weather_data field with complete weather information in markdown format
- Present the weather_data content naturally to the user with appropriate emojis
- This ensures coverage for small cities and towns not in OpenWeatherMap database

RESPONSE FORMATTING:
- Use emojis to make responses engaging (☀️ 🌧️ ❄️ 🌤️ ⛈️ 🌫️)
- Include temperature with "feels like" when relevant
- Mention notable conditions (rain, wind, humidity)
- Provide context (e.g., "warmer than yesterday", "typical for this season")
- Add practical advice for extreme conditions
- When using web search fallback, present the detailed information naturally

EXAMPLES:
Query: "What's the weather in London?"
Response: "☁️ It's currently 15°C in London with partly cloudy skies. Feels like 13°C with a light breeze. Perfect weather for a walk! 🚶"

Query: "Will it rain tomorrow in Seattle?"
Response: "🌧️ Yes, expect rain tomorrow in Seattle. There's an 80% chance of showers starting around 2 PM, with temperatures around 12°C. Don't forget your umbrella! ☔"

Query: "What's the weather in Bhadrawati?" (small city not in OpenWeatherMap)
Response: "🌤️ Based on current weather data from AccuWeather and Weather.com:

**Current Conditions in Bhadrawati:**
- Temperature: 30°C (feels like 33°C)
- Conditions: Hazy sunshine with partly cloudy skies
- Humidity: 37-41%
- Wind: 3-12 km/h from South-Southwest

⚠️ Air quality is currently unhealthy - sensitive individuals should limit outdoor activities.

It's quite warm today! Stay hydrated and consider indoor activities during peak afternoon hours. 💧"

Query: "Is it safe to jog outside in Delhi?"
Response: "⚠️ I'd recommend indoor exercise today. The air quality in Delhi is currently 'Poor' (AQI: 4/5) with high PM2.5 levels. If you must go outside, consider wearing a mask and avoiding peak traffic hours."`;
  }

  /**
   * Override the response generation to add weather-specific formatting
   */
  async generateFinalResponse(query, executedActions, context) {
    // Get the base response from parent class
    const baseResponse = await super.generateFinalResponse(query, executedActions, context);
    
    // Add weather-specific enhancements
    return this.enhanceWeatherResponse(baseResponse, executedActions, context);
  }

  /**
   * Enhance response with weather-specific formatting and advice
   */
  enhanceWeatherResponse(response, executedActions, context) {
    // Check if we have weather data
    const weatherAction = executedActions.find(a => 
      a.tool === 'getWeather' || a.tool === 'getWeatherByCoordinates'
    );
    
    const airQualityAction = executedActions.find(a => a.tool === 'getAirQuality');
    
    if (!weatherAction && !airQualityAction) {
      return response;
    }

    // Add contextual advice based on conditions
    let advice = '';
    
    if (weatherAction?.result?.current_weather) {
      const weather = weatherAction.result.current_weather;
      advice += this.getWeatherAdvice(weather);
    }
    
    if (airQualityAction?.result?.air_quality) {
      const aqi = airQualityAction.result.air_quality;
      advice += this.getAirQualityAdvice(aqi);
    }
    
    // Append advice if generated
    if (advice) {
      return response + '\n\n' + advice;
    }
    
    return response;
  }

  /**
   * Generate weather-based advice
   */
  getWeatherAdvice(weather) {
    const advice = [];
    
    // Temperature advice
    if (weather.temperature < 0) {
      advice.push('🧥 Bundle up! It\'s freezing outside.');
    } else if (weather.temperature > 35) {
      advice.push('🌡️ Stay hydrated and avoid prolonged sun exposure.');
    }
    
    // Rain advice
    if (weather.rain_1h || weather.main === 'Rain') {
      advice.push('☔ Don\'t forget your umbrella!');
    }
    
    // Wind advice
    if (weather.wind_speed > 10) {
      advice.push('💨 It\'s quite windy - secure loose items.');
    }
    
    return advice.length > 0 ? '\n\n**💡 Tips:**\n' + advice.join('\n') : '';
  }

  /**
   * Generate air quality advice
   */
  getAirQualityAdvice(aqi) {
    if (aqi.index >= 4) {
      return '\n\n**⚠️ Air Quality Alert:**\nLimit outdoor activities and consider wearing a mask if you must go outside.';
    } else if (aqi.index === 3) {
      return '\n\n**💡 Air Quality Notice:**\nSensitive individuals should limit prolonged outdoor activities.';
    }
    return '';
  }
}

module.exports = WeatherAgentMultiStep;
