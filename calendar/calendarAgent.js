/**
 * Google Calendar AI Agent using OpenAI
 * 
 * This agent provides intelligent interaction with Google Calendar using natural language queries.
 * It dynamically selects and executes appropriate Calendar API functions based on user intent.
 * 
 * Features:
 * - Natural language query processing
 * - Dynamic tool selection based on user intent
 * - Event creation, updating, and deletion
 * - Calendar management
 * - Event retrieval and searching
 * - Multi-tool query support
 * - Comprehensive error handling
 * 
 * Usage:
 * const agent = new CalendarAgent();
 * const result = await agent.processQuery("schedule a meeting tomorrow at 2pm", userId);
 */

const OpenAI = require('openai');
const calendarService = require('./calendarService');

class CalendarAgent {
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
   * Define OpenAI function schemas for each Calendar function
   * These schemas help the AI understand when and how to use each tool
   */
  defineTools() {
    return [
      {
        type: "function",
        function: {
          name: "createEvent",
          description: "Create a new calendar event with specified details, time, and attendees. Use when user wants to schedule, create, or add an event/meeting/appointment.",
          parameters: {
            type: "object",
            properties: {
              summary: {
                type: "string",
                description: "Title of the calendar event (e.g., 'Team Meeting', 'Doctor Appointment')"
              },
              description: {
                type: "string",
                description: "Detailed description of the event including agenda, purpose, or notes"
              },
              location: {
                type: "string",
                description: "Physical location or virtual meeting link"
              },
              startDateTime: {
                type: "string",
                description: "Start date and time in ISO 8601 format (e.g., '2024-04-15T09:00:00' or with timezone '2024-04-15T09:00:00-07:00')"
              },
              endDateTime: {
                type: "string",
                description: "End date and time in ISO 8601 format"
              },
              timeZone: {
                type: "string",
                description: "Time zone for the event (e.g., 'UTC', 'America/Los_Angeles')",
                default: "UTC"
              },
              calendarId: {
                type: "string",
                description: "Calendar ID ('primary' for main calendar, or specific calendar ID)",
                default: "primary"
              },
              attendees: {
                type: "array",
                items: { type: "string" },
                description: "List of email addresses to invite"
              },
              recurrence: {
                type: "string",
                description: "RRULE format for repeating events (e.g., 'RRULE:FREQ=WEEKLY;COUNT=10')"
              },
              sendUpdates: {
                type: "string",
                enum: ["all", "externalOnly", "none"],
                description: "Whether to send notifications",
                default: "none"
              },
              addGoogleMeet: {
                type: "boolean",
                description: "Whether to add Google Meet link",
                default: false
              }
            },
            required: ["summary", "startDateTime", "endDateTime"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getEvents",
          description: "Retrieve calendar events within a time range with optional filtering. CRITICAL: Unless user specifies a year or date range, ONLY return events from current year (2025). Use when user asks about their schedule, upcoming events, or wants to search events. Default returns from now until end of 2025.",
          parameters: {
            type: "object",
            properties: {
              timeMin: {
                type: "string",
                description: "Start of time range in ISO 8601 format (e.g., '2025-10-28T00:00:00Z'). If not specified, defaults to current time (Oct 28, 2025)."
              },
              timeMax: {
                type: "string",
                description: "End of time range in ISO 8601 format (e.g., '2025-12-31T23:59:59Z'). If not specified, defaults to end of current year (Dec 31, 2025). ONLY use dates beyond 2025 if user explicitly mentions a future year."
              },
              maxResults: {
                type: "number",
                description: "Maximum number of events to return (1-50). Default is 20. Use lower numbers to avoid overwhelming the user.",
                default: 20
              },
              calendarId: {
                type: "string",
                description: "Calendar ID to fetch events from",
                default: "primary"
              },
              orderBy: {
                type: "string",
                enum: ["startTime", "updated"],
                description: "Order events by start time or last updated",
                default: "startTime"
              },
              query: {
                type: "string",
                description: "Free text search query to filter events"
              }
            },
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "updateEvent",
          description: "Modify an existing calendar event by changing any of its properties. Use when user wants to update, modify, reschedule, or change an event.",
          parameters: {
            type: "object",
            properties: {
              eventId: {
                type: "string",
                description: "Unique identifier of the event to update (required)"
              },
              calendarId: {
                type: "string",
                description: "Calendar ID containing the event",
                default: "primary"
              },
              summary: {
                type: "string",
                description: "New title for the event"
              },
              description: {
                type: "string",
                description: "New description for the event"
              },
              location: {
                type: "string",
                description: "New location for the event"
              },
              startDateTime: {
                type: "string",
                description: "New start date and time in ISO 8601 format"
              },
              endDateTime: {
                type: "string",
                description: "New end date and time in ISO 8601 format"
              },
              timeZone: {
                type: "string",
                description: "Time zone for the event"
              },
              attendees: {
                type: "array",
                items: { type: "string" },
                description: "New list of attendee emails (replaces existing)"
              },
              recurrence: {
                type: "string",
                description: "New recurrence rule (replaces existing)"
              },
              sendUpdates: {
                type: "string",
                enum: ["all", "externalOnly", "none"],
                description: "Whether to notify attendees",
                default: "none"
              },
              addGoogleMeet: {
                type: "boolean",
                description: "Whether to add/update Google Meet link"
              }
            },
            required: ["eventId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "deleteEvent",
          description: "Remove a calendar event permanently. Use when user wants to delete, remove, or cancel an event.",
          parameters: {
            type: "object",
            properties: {
              eventId: {
                type: "string",
                description: "Unique identifier of the event to delete (required)"
              },
              calendarId: {
                type: "string",
                description: "Calendar ID containing the event",
                default: "primary"
              },
              sendUpdates: {
                type: "string",
                enum: ["all", "externalOnly", "none"],
                description: "Whether to notify attendees about cancellation",
                default: "none"
              }
            },
            required: ["eventId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getCalendars",
          description: "List all calendars accessible to the user. Use when user asks about their calendars or wants to see calendar list.",
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
          name: "getCalendar",
          description: "Get detailed information about a specific calendar. Use when user asks about details of a particular calendar.",
          parameters: {
            type: "object",
            properties: {
              calendarId: {
                type: "string",
                description: "Calendar ID to retrieve",
                default: "primary"
              }
            },
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "createCalendar",
          description: "Create a new secondary calendar. Use when user wants to create a new calendar.",
          parameters: {
            type: "object",
            properties: {
              summary: {
                type: "string",
                description: "Name of the new calendar (required)"
              },
              description: {
                type: "string",
                description: "Description of the calendar"
              },
              timeZone: {
                type: "string",
                description: "Time zone for the calendar",
                default: "UTC"
              }
            },
            required: ["summary"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "updateCalendar",
          description: "Update properties of an existing calendar. Use when user wants to modify calendar settings.",
          parameters: {
            type: "object",
            properties: {
              calendarId: {
                type: "string",
                description: "Calendar ID to update (required)"
              },
              summary: {
                type: "string",
                description: "New name for the calendar"
              },
              description: {
                type: "string",
                description: "New description for the calendar"
              },
              timeZone: {
                type: "string",
                description: "New time zone for the calendar"
              }
            },
            required: ["calendarId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "deleteCalendar",
          description: "Delete a secondary calendar (primary calendar cannot be deleted). Use when user wants to remove a calendar.",
          parameters: {
            type: "object",
            properties: {
              calendarId: {
                type: "string",
                description: "Calendar ID to delete (required, cannot be 'primary')"
              }
            },
            required: ["calendarId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "respondToEvent",
          description: "Update your response status for a calendar event (accept, decline, tentative, or needs action). Use when user wants to respond to an event invitation.",
          parameters: {
            type: "object",
            properties: {
              eventId: {
                type: "string",
                description: "Event ID to respond to (required)"
              },
              responseStatus: {
                type: "string",
                enum: ["accepted", "declined", "tentative", "needsAction"],
                description: "Response status (required)"
              },
              calendarId: {
                type: "string",
                description: "Calendar ID containing the event",
                default: "primary"
              }
            },
            required: ["eventId", "responseStatus"]
          }
        }
      }
    ];
  }

  /**
   * Map function names to their implementations
   */
  createFunctionMap() {
    return {
      createEvent: async (userId, args) => {
        return await calendarService.createEvent(userId, args);
      },
      getEvents: async (userId, args) => {
        return await calendarService.getEvents(userId, args);
      },
      updateEvent: async (userId, args) => {
        const { eventId, calendarId, sendUpdates, ...updates } = args;
        return await calendarService.updateEvent(userId, eventId, updates, calendarId, sendUpdates);
      },
      deleteEvent: async (userId, args) => {
        return await calendarService.deleteEvent(userId, args.eventId, args.calendarId, args.sendUpdates);
      },
      getCalendars: async (userId, args) => {
        return await calendarService.getCalendars(userId);
      },
      getCalendar: async (userId, args) => {
        return await calendarService.getCalendar(userId, args.calendarId);
      },
      createCalendar: async (userId, args) => {
        return await calendarService.createCalendar(userId, args.summary, args.description, args.timeZone);
      },
      updateCalendar: async (userId, args) => {
        const { calendarId, ...updates } = args;
        return await calendarService.updateCalendar(userId, calendarId, updates);
      },
      deleteCalendar: async (userId, args) => {
        return await calendarService.deleteCalendar(userId, args.calendarId);
      },
      respondToEvent: async (userId, args) => {
        return await calendarService.respondToEvent(userId, args.eventId, args.responseStatus, args.calendarId);
      }
    };
  }

  /**
   * Create system prompt for the AI agent
   */
  createSystemPrompt() {
    // Get current date dynamically
    const now = new Date();
    const currentDateStr = now.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
    const currentYear = now.getFullYear();
    const endOfYear = `December 31, ${currentYear}`;
    
    return `You are an intelligent Google Calendar assistant. You help users manage their calendar events and schedules through natural language.

Your capabilities:
1. **Create Events**: Schedule meetings, appointments, and events with dates, times, locations, and attendees
2. **Get Events**: Retrieve and search calendar events based on time ranges or search queries
3. **Update Events**: Modify existing events (time, location, attendees, etc.)
4. **Delete Events**: Remove events from the calendar
5. **Manage Calendars**: List, create, update, and delete calendars
6. **Respond to Events**: Accept, decline, or tentatively respond to event invitations

Important guidelines:
- When creating events, always include start and end times
- Use ISO 8601 format for dates and times
- **IMPORTANT - Current date is ${currentDateStr}**. Use this as reference for relative dates like "today", "tomorrow", "next week", etc.
- **CRITICAL**: Unless user specifies a year or specific date range, ONLY retrieve events from the current year (${currentYear})
- When user asks for "all events" or "list events" without specifying dates, default to current year only (today - ${endOfYear})
- If user wants events from other years, they must explicitly mention the year
- Default to showing 10-20 events maximum unless user specifically asks for more
- For recurring events, use RRULE format (e.g., "RRULE:FREQ=WEEKLY;COUNT=10")
- Always provide clear, helpful responses with event summaries in a readable format
- If you need more information (like event ID), ask the user

**CRITICAL: When creating events, ALWAYS format the response EXACTLY like this:**

Event Title
[Event Name]

Date & Time
[Day, Month Date, Year]
[Start Time - End Time with timezone]
Duration: [duration]

Location
[Google Meet link or physical location]

Attendees (count)
[email addresses]

- When listing events, format them with numbered list and provide link at the end:
  1. **Event Title**
     - Date & Time: [details]
     - Location: [if available]
     - [View Event](URL)
- Suggest adding Google Meet links for virtual meetings when appropriate
- Never try to retrieve more than 50 events at once to avoid overloading the system

Be conversational, helpful, and proactive in your assistance. Always interpret user queries with reasonable defaults focused on the CURRENT YEAR (2025) only.`;
  }

  /**
   * Process a natural language query
   */
  async processQuery(query, userId, options = {}) {
    const { conversationHistory = [], forceToolExecution } = options;

    try {
      console.log(`[CalendarAgent] Processing query for user ${userId}: "${query}"`);

      // If forceToolExecution is set, directly execute the tool without LLM
      if (forceToolExecution && forceToolExecution.toolName && forceToolExecution.params) {
        console.log(`[CalendarAgent] Force executing tool: ${forceToolExecution.toolName}`);
        console.log(`[CalendarAgent] With exact params:`, JSON.stringify(forceToolExecution.params, null, 2));
        
        const functionToCall = this.functionMap[forceToolExecution.toolName];
        if (!functionToCall) {
          throw new Error(`Unknown function: ${forceToolExecution.toolName}`);
        }

        const result = await functionToCall(userId, forceToolExecution.params);
        
        // Generate a response message based on the result
        let responseText = "I've completed your request.";
        if (result.success && result.data) {
          if (forceToolExecution.toolName === 'createEvent') {
            const event = result.data;
            responseText = `I've created your calendar event "${event.summary || 'Event'}".`;
            if (event.htmlLink) {
              responseText += ` You can view it here: ${event.htmlLink}`;
            }
          }
        }

        return {
          success: true,
          response: responseText,
          query: query,
          tools_used: [{
            name: forceToolExecution.toolName,
            arguments: forceToolExecution.params
          }],
          function_results: [{
            function: forceToolExecution.toolName,
            result: result
          }],
          raw_results: [result],
          timestamp: new Date().toISOString(),
          iterations: 0
        };
      }

      // Build messages array with conversation history
      const messages = [
        { role: "system", content: this.systemPrompt },
        ...conversationHistory,
        { role: "user", content: query }
      ];

      // Initial API call to OpenAI
      let response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: messages,
        tools: this.tools,
        tool_choice: "auto",
      });

      let assistantMessage = response.choices[0].message;
      const toolsUsed = [];
      const functionResults = [];
      let iterationCount = 0;
      const maxIterations = 10;

      // Handle function calls in a loop (agent might need multiple tool calls)
      while (assistantMessage.tool_calls && iterationCount < maxIterations) {
        iterationCount++;
        console.log(`[CalendarAgent] Iteration ${iterationCount}: Processing ${assistantMessage.tool_calls.length} tool calls`);

        messages.push(assistantMessage);

        // Execute all tool calls
        for (const toolCall of assistantMessage.tool_calls) {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);

          console.log(`[CalendarAgent] Calling function: ${functionName}`);
          console.log(`[CalendarAgent] Arguments:`, JSON.stringify(functionArgs, null, 2));

          toolsUsed.push({
            name: functionName,
            arguments: functionArgs
          });

          try {
            // Execute the function
            const functionToCall = this.functionMap[functionName];
            if (!functionToCall) {
              throw new Error(`Unknown function: ${functionName}`);
            }

            const result = await functionToCall(userId, functionArgs);
            functionResults.push({
              function: functionName,
              result: result
            });

            console.log(`[CalendarAgent] Function result:`, JSON.stringify(result, null, 2));

            // Add function result to messages
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(result),
            });

          } catch (error) {
            console.error(`[CalendarAgent] Error executing ${functionName}:`, error);
            const errorResult = {
              success: false,
              error: error.message
            };
            functionResults.push({
              function: functionName,
              result: errorResult
            });

            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(errorResult),
            });
          }
        }

        // Get next response from OpenAI
        response = await this.openai.chat.completions.create({
          model: "gpt-4o",
          messages: messages,
          tools: this.tools,
          tool_choice: "auto",
        });

        assistantMessage = response.choices[0].message;
      }

      // Get final response
      const finalResponse = assistantMessage.content || "I've processed your request.";

      console.log(`[CalendarAgent] Final response: ${finalResponse}`);

      return {
        success: true,
        response: finalResponse,
        query: query,
        tools_used: toolsUsed,
        function_results: functionResults,
        raw_results: functionResults.map(fr => fr.result),  // Include raw results for artifact extraction
        timestamp: new Date().toISOString(),
        iterations: iterationCount
      };

    } catch (error) {
      console.error('[CalendarAgent] Error:', error);
      return {
        success: false,
        error: error.message,
        query: query,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = CalendarAgent;
