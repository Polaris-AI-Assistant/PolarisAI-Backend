/**
 * Google Meet AI Agent using OpenAI
 * 
 * This agent provides intelligent interaction with Google Meet using natural language queries.
 * It dynamically selects and executes appropriate Meet API functions based on user intent.
 * 
 * Features:
 * - Natural language query processing
 * - Dynamic tool selection based on user intent
 * - Meeting space creation and management
 * - Conference history retrieval
 * - Recording access and management
 * - Participant tracking
 * - Multi-tool query support
 * - Comprehensive error handling
 * 
 * Usage:
 * const agent = new MeetAgent();
 * const result = await agent.processQuery("create a new meeting", userId);
 */

const OpenAI = require('openai');
const meetService = require('./meetService');

class MeetAgent {
  constructor() {
    // Initialize OpenAI client with API key from environment
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Define available tools/functions that the agent can use
    this.tools = this.defineTools();
    
    // Map function names to actual implementations
    this.functionMap = this.createFunctionMap();

    // System prompt that defines the agent's behavior and capabilities
    this.systemPrompt = this.createSystemPrompt();
  }

  /**
   * Define OpenAI function schemas for each Meet function
   * These schemas help the AI understand when and how to use each tool
   */
  defineTools() {
    return [
      {
        type: "function",
        function: {
          name: "createMeetingSpace",
          description: "Create a new Google Meet meeting space with a unique meeting link. Use when user wants to create, start, or set up a new meeting.",
          parameters: {
            type: "object",
            properties: {},
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getMeetingSpace",
          description: "Get details of an existing meeting space by its name/ID. Use when user asks about a specific meeting space.",
          parameters: {
            type: "object",
            properties: {
              spaceName: {
                type: "string",
                description: "The name of the meeting space (format: spaces/{space_id})"
              }
            },
            required: ["spaceName"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "listConferences",
          description: "List all past conferences/meetings in a space. Use when user asks about meeting history or past meetings.",
          parameters: {
            type: "object",
            properties: {
              spaceName: {
                type: "string",
                description: "The name of the meeting space (format: spaces/{space_id})"
              },
              pageSize: {
                type: "number",
                description: "Maximum number of conferences to return (default: 20, max: 100)"
              },
              pageToken: {
                type: "string",
                description: "Token for pagination to get next page of results"
              }
            },
            required: ["spaceName"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getConference",
          description: "Get details of a specific conference/meeting. Use when user asks about a particular meeting instance.",
          parameters: {
            type: "object",
            properties: {
              conferenceName: {
                type: "string",
                description: "The name of the conference (format: conferenceRecords/{conference_id})"
              }
            },
            required: ["conferenceName"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "listRecordings",
          description: "List all recordings for a conference. Use when user asks about meeting recordings or wants to see recorded meetings.",
          parameters: {
            type: "object",
            properties: {
              conferenceName: {
                type: "string",
                description: "The name of the conference (format: conferenceRecords/{conference_id})"
              },
              pageSize: {
                type: "number",
                description: "Maximum number of recordings to return (default: 20, max: 100)"
              },
              pageToken: {
                type: "string",
                description: "Token for pagination to get next page of results"
              }
            },
            required: ["conferenceName"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getRecording",
          description: "Get details of a specific meeting recording. Use when user asks about a particular recording.",
          parameters: {
            type: "object",
            properties: {
              recordingName: {
                type: "string",
                description: "The name of the recording resource"
              }
            },
            required: ["recordingName"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "listParticipants",
          description: "List all participants who joined a conference. Use when user asks about who attended a meeting.",
          parameters: {
            type: "object",
            properties: {
              conferenceName: {
                type: "string",
                description: "The name of the conference (format: conferenceRecords/{conference_id})"
              },
              pageSize: {
                type: "number",
                description: "Maximum number of participants to return (default: 20, max: 100)"
              },
              pageToken: {
                type: "string",
                description: "Token for pagination to get next page of results"
              }
            },
            required: ["conferenceName"]
          }
        }
      }
    ];
  }

  /**
   * Create a mapping of function names to their implementations
   */
  createFunctionMap() {
    return {
      createMeetingSpace: meetService.createMeetingSpace,
      getMeetingSpace: meetService.getMeetingSpace,
      listConferences: meetService.listConferences,
      getConference: meetService.getConference,
      listRecordings: meetService.listRecordings,
      getRecording: meetService.getRecording,
      listParticipants: meetService.listParticipants
    };
  }

  /**
   * Create the system prompt that defines agent behavior
   */
  createSystemPrompt() {
    return `You are a helpful AI assistant specialized in Google Meet management.

Your capabilities:
- Create new meeting spaces with unique meeting links
- Retrieve meeting space details
- Access conference history and past meetings
- List and retrieve meeting recordings
- Track meeting participants
- Provide meeting analytics and summaries

Guidelines:
1. Always be clear and concise in your responses
2. When creating a meeting, provide the meeting link prominently
3. Format meeting times in a user-friendly way
4. If a user asks for recordings, check if the recording feature was enabled
5. Provide actionable information and next steps
6. Handle errors gracefully and suggest alternatives
7. When listing items, summarize key information first

**CRITICAL: When creating a Google Meet, ALWAYS format the response like this:**

Event Title
Google Meet

Date & Time
[Day, Month Date, Year]
[Start Time - End Time with timezone]
Duration: [duration]

Location
[Google Meet link]

Attendees (count if any)
[email addresses if any]

Important Notes:
- Meeting spaces persist and can be reused
- Recordings are stored in Google Drive
- Conference records contain historical meeting data
- Participant information includes join/leave times

Always confirm successful operations and provide relevant details like meeting links, times, and participant counts.`;
  }

  /**
   * Process a natural language query
   * @param {string} query - The user's natural language query
   * @param {string} userId - The user ID for authentication
   * @param {Object} options - Additional options (conversationHistory, etc.)
   * @returns {Promise<Object>} - The processed result
   */
  async processQuery(query, userId, options = {}) {
    try {
      console.log(`[MeetAgent] Processing query for user ${userId}: "${query}"`);

      // Build messages array with conversation history if provided
      const messages = [
        { role: "system", content: this.systemPrompt }
      ];

      // Add conversation history if provided
      if (options.conversationHistory && Array.isArray(options.conversationHistory)) {
        messages.push(...options.conversationHistory);
      }

      // Add current query
      messages.push({ role: "user", content: query });

      // Call OpenAI with function calling
      let response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messages,
        tools: this.tools,
        tool_choice: "auto",
        temperature: 0.7,
      });

      let assistantMessage = response.choices[0].message;
      const toolsUsed = [];

      // Handle function calls
      while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        console.log(`[MeetAgent] AI wants to call ${assistantMessage.tool_calls.length} function(s)`);

        // Add assistant message to conversation
        messages.push(assistantMessage);

        // Execute all function calls
        for (const toolCall of assistantMessage.tool_calls) {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);

          console.log(`[MeetAgent] Calling function: ${functionName}`, functionArgs);
          toolsUsed.push({ name: functionName, args: functionArgs });

          // Execute the function
          const functionToCall = this.functionMap[functionName];
          let functionResult;

          try {
            // Add userId as first parameter to all function calls
            functionResult = await functionToCall(userId, ...Object.values(functionArgs));
          } catch (error) {
            console.error(`[MeetAgent] Error executing ${functionName}:`, error);
            functionResult = {
              success: false,
              error: error.message
            };
          }

          // Add function result to messages
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(functionResult)
          });
        }

        // Get next response from AI
        response = await this.openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: messages,
          tools: this.tools,
          tool_choice: "auto",
          temperature: 0.7,
        });

        assistantMessage = response.choices[0].message;
      }

      // Return final response
      return {
        success: true,
        response: assistantMessage.content,
        query: query,
        tools_used: toolsUsed,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('[MeetAgent] Error processing query:', error);
      return {
        success: false,
        error: 'Failed to process query',
        message: error.message,
        query: query,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = MeetAgent;
