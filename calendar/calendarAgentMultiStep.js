/**
 * Google Calendar Agent - Multi-Step Execution Version
 * 
 * This is the PRODUCTION version that should replace the old calendarAgent.js
 * It extends BaseAgent to support sequential multi-step operations.
 * 
 * Handles queries like:
 * - "Schedule a meeting tomorrow at 2pm and add john@example.com as attendee"
 * - "Create a calendar event and send invites to the team"
 * - "Schedule a meeting and add it to my work calendar"
 */

const BaseAgent = require('../base/BaseAgent');
const calendarService = require('./calendarService');
const OpenAI = require('openai');

class CalendarAgentMultiStep extends BaseAgent {
  constructor(llmClient) {
    // Define tools with definition + execute pattern
    const tools = {
      createEvent: {
        definition: {
          type: 'function',
          function: {
            name: 'createEvent',
            description: 'Create a new calendar event with specified details, time, and attendees. Use when user wants to schedule, create, or add an event/meeting/appointment.',
            parameters: {
              type: 'object',
              properties: {
                summary: {
                  type: 'string',
                  description: 'Title of the calendar event (e.g., "Team Meeting", "Doctor Appointment")'
                },
                description: {
                  type: 'string',
                  description: 'Detailed description of the event including agenda, purpose, or notes'
                },
                location: {
                  type: 'string',
                  description: 'Physical location or virtual meeting link'
                },
                startDateTime: {
                  type: 'string',
                  description: 'Start date and time in ISO 8601 format (e.g., "2024-04-15T09:00:00")'
                },
                endDateTime: {
                  type: 'string',
                  description: 'End date and time in ISO 8601 format'
                },
                timeZone: {
                  type: 'string',
                  description: 'Time zone for the event (e.g., "UTC", "America/Los_Angeles")',
                  default: 'UTC'
                },
                calendarId: {
                  type: 'string',
                  description: 'Calendar ID ("primary" for main calendar, or specific calendar ID)',
                  default: 'primary'
                },
                attendees: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'List of email addresses to invite'
                },
                recurrence: {
                  type: 'string',
                  description: 'RRULE format for repeating events (e.g., "RRULE:FREQ=WEEKLY;COUNT=10")'
                },
                sendUpdates: {
                  type: 'string',
                  enum: ['all', 'externalOnly', 'none'],
                  description: 'Whether to send notifications',
                  default: 'none'
                },
                addGoogleMeet: {
                  type: 'boolean',
                  description: 'Whether to add Google Meet link',
                  default: false
                }
              },
              required: ['summary', 'startDateTime', 'endDateTime']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[CalendarAgent] 📅 Creating event: "${params.summary}"`);
          
          try {
            const result = await calendarService.createEvent(
              context.userId,
              params
            );

            if (!result.success) {
              throw new Error(result.error || 'Failed to create event');
            }

            const event = result.event;  // ✅ Extract event from result
            console.log(`[CalendarAgent] ✅ Event created: ${event.id}`);
            
            return {
              success: true,
              eventId: event.id,
              eventLink: event.htmlLink,
              summary: event.summary,
              startTime: event.start,
              endTime: event.end,
              meetLink: event.hangoutLink || event.conferenceData?.entryPoints?.[0]?.uri,
              createdAt: new Date().toISOString()
            };
          } catch (error) {
            console.error(`[CalendarAgent] ❌ Error creating event:`, error.message);
            throw error;
          }
        }
      },

      updateEvent: {
        definition: {
          type: 'function',
          function: {
            name: 'updateEvent',
            description: 'Modify an existing calendar event by changing any of its properties. Use when user wants to update, modify, reschedule, or change an event.',
            parameters: {
              type: 'object',
              properties: {
                eventId: {
                  type: 'string',
                  description: 'Unique identifier of the event to update (required)'
                },
                calendarId: {
                  type: 'string',
                  description: 'Calendar ID containing the event',
                  default: 'primary'
                },
                summary: {
                  type: 'string',
                  description: 'New title for the event'
                },
                description: {
                  type: 'string',
                  description: 'New description for the event'
                },
                location: {
                  type: 'string',
                  description: 'New location for the event'
                },
                startDateTime: {
                  type: 'string',
                  description: 'New start date and time in ISO 8601 format'
                },
                endDateTime: {
                  type: 'string',
                  description: 'New end date and time in ISO 8601 format'
                },
                timeZone: {
                  type: 'string',
                  description: 'Time zone for the event'
                },
                attendees: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'New list of attendee emails (replaces existing)'
                },
                sendUpdates: {
                  type: 'string',
                  enum: ['all', 'externalOnly', 'none'],
                  description: 'Whether to notify attendees',
                  default: 'none'
                }
              },
              required: ['eventId']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[CalendarAgent] 📝 Updating event: ${params.eventId}`);
          
          try {
            const event = await calendarService.updateEvent(
              context.userId,
              params.eventId,
              params
            );

            console.log(`[CalendarAgent] ✅ Event updated successfully`);
            
            return {
              success: true,
              eventId: event.id,
              message: 'Event updated successfully'
            };
          } catch (error) {
            console.error(`[CalendarAgent] ❌ Error updating event:`, error.message);
            throw error;
          }
        }
      },

      deleteEvent: {
        definition: {
          type: 'function',
          function: {
            name: 'deleteEvent',
            description: 'Remove a calendar event permanently. Use when user wants to delete, remove, or cancel an event.',
            parameters: {
              type: 'object',
              properties: {
                eventId: {
                  type: 'string',
                  description: 'Unique identifier of the event to delete (required)'
                },
                calendarId: {
                  type: 'string',
                  description: 'Calendar ID containing the event',
                  default: 'primary'
                },
                sendUpdates: {
                  type: 'string',
                  enum: ['all', 'externalOnly', 'none'],
                  description: 'Whether to notify attendees about cancellation',
                  default: 'none'
                }
              },
              required: ['eventId']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[CalendarAgent] 🗑️ Deleting event: ${params.eventId}`);
          
          try {
            await calendarService.deleteEvent(
              context.userId,
              params.eventId,
              params
            );

            console.log(`[CalendarAgent] ✅ Event deleted successfully`);
            
            return {
              success: true,
              eventId: params.eventId,
              message: 'Event deleted successfully'
            };
          } catch (error) {
            console.error(`[CalendarAgent] ❌ Error deleting event:`, error.message);
            throw error;
          }
        }
      },

      getEvents: {
        definition: {
          type: 'function',
          function: {
            name: 'getEvents',
            description: 'Retrieve calendar events within a time range with optional filtering. Use when user asks about their schedule, upcoming events, or wants to search events.',
            parameters: {
              type: 'object',
              properties: {
                timeMin: {
                  type: 'string',
                  description: 'Start of time range in ISO 8601 format'
                },
                timeMax: {
                  type: 'string',
                  description: 'End of time range in ISO 8601 format'
                },
                maxResults: {
                  type: 'number',
                  description: 'Maximum number of events to return (1-50)',
                  default: 20
                },
                calendarId: {
                  type: 'string',
                  description: 'Calendar ID to fetch events from',
                  default: 'primary'
                },
                query: {
                  type: 'string',
                  description: 'Free text search query to filter events'
                }
              },
              required: []
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[CalendarAgent] 📋 Retrieving events`);
          
          try {
            const events = await calendarService.getEvents(
              context.userId,
              params
            );

            console.log(`[CalendarAgent] ✅ Retrieved ${events.length} events`);
            
            return {
              success: true,
              events: events,
              count: events.length
            };
          } catch (error) {
            console.error(`[CalendarAgent] ❌ Error retrieving events:`, error.message);
            throw error;
          }
        }
      },

      addAttendees: {
        definition: {
          type: 'function',
          function: {
            name: 'addAttendees',
            description: 'Add attendees to an existing calendar event. Use when user wants to invite people to an event.',
            parameters: {
              type: 'object',
              properties: {
                eventId: {
                  type: 'string',
                  description: 'Unique identifier of the event (required)'
                },
                calendarId: {
                  type: 'string',
                  description: 'Calendar ID containing the event',
                  default: 'primary'
                },
                attendees: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'List of email addresses to add as attendees (required)'
                },
                sendUpdates: {
                  type: 'string',
                  enum: ['all', 'externalOnly', 'none'],
                  description: 'Whether to notify attendees',
                  default: 'all'
                }
              },
              required: ['eventId', 'attendees']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[CalendarAgent] 👥 Adding attendees to event: ${params.eventId}`);
          
          try {
            const result = await calendarService.addAttendees(
              context.userId,
              params.eventId,
              params.attendees,
              {
                calendarId: params.calendarId || 'primary',
                sendUpdates: params.sendUpdates || 'all'
              }
            );

            if (!result.success) {
              throw new Error(result.error || 'Failed to add attendees');
            }

            console.log(`[CalendarAgent] ✅ Attendees added successfully`);
            
            return {
              success: true,
              eventId: result.event.id,
              attendeesAdded: result.attendeesAdded,
              message: result.message
            };
          } catch (error) {
            console.error(`[CalendarAgent] ❌ Error adding attendees:`, error.message);
            throw error;
          }
        }
      },

      createCalendar: {
        definition: {
          type: 'function',
          function: {
            name: 'createCalendar',
            description: 'Create a new secondary calendar. Use when user wants to create a new calendar.',
            parameters: {
              type: 'object',
              properties: {
                summary: {
                  type: 'string',
                  description: 'Name of the new calendar (required)'
                },
                description: {
                  type: 'string',
                  description: 'Description of the calendar'
                },
                timeZone: {
                  type: 'string',
                  description: 'Time zone for the calendar',
                  default: 'UTC'
                }
              },
              required: ['summary']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[CalendarAgent] 📅 Creating calendar: "${params.summary}"`);
          
          try {
            const calendar = await calendarService.createCalendar(
              context.userId,
              params
            );

            console.log(`[CalendarAgent] ✅ Calendar created: ${calendar.id}`);
            
            return {
              success: true,
              calendarId: calendar.id,
              summary: calendar.summary,
              createdAt: new Date().toISOString()
            };
          } catch (error) {
            console.error(`[CalendarAgent] ❌ Error creating calendar:`, error.message);
            throw error;
          }
        }
      }
    };

    // Initialize BaseAgent with tools
    super('CalendarAgent', tools, llmClient || new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));
  }

  /**
   * Override system prompt with Calendar specific instructions
   */
  getSystemPrompt() {
    const basePrompt = super.getSystemPrompt();
    
    return `${basePrompt}

GOOGLE CALENDAR SPECIFIC GUIDELINES:

1. **Event Creation**
   - Always create an event first if the user wants to schedule something
   - Include all relevant details: title, time, location, attendees
   - Use ISO 8601 format for dates/times
   - Add Google Meet link if it's a meeting

2. **Multi-Step Example**
   User: "Schedule a meeting tomorrow at 2pm and add john@example.com"
   
   Step 1: createEvent({ summary: "Meeting", startDateTime: "...", endDateTime: "...", attendees: ["john@example.com"] })
   Result: { eventId: "abc123", eventLink: "https://..." }
   
   Step 2: No more tools needed
   Execution complete

3. **Attendee Management**
   - Use addAttendees to add people to existing events
   - Always send updates when adding attendees
   - Include attendee emails in createEvent if known upfront

4. **Calendar Operations**
   - Create new calendars when user requests
   - Use primary calendar by default
   - Specify calendarId when working with specific calendars

5. **Always Return Event Links**
   - Users need to access their events
   - Include event links in results when available`;
  }

  /**
   * Wrapper to maintain compatibility with old processQuery interface
   * Converts old interface to new BaseAgent interface
   */
  async processQuery(query, userIdOrContext, options = {}) {
    console.log(`[CalendarAgent] 🚀 Processing query (multi-step): "${query}"`);
    
    // Detect which signature is being used
    let context;
    if (typeof userIdOrContext === 'string') {
      context = {
        userId: userIdOrContext,
        conversationId: options.conversationId,
        maxIterations: options.maxIterations || 15,
        forceToolExecution: options.forceToolExecution,
        conversationHistory: options.conversationHistory
      };
    } else if (typeof userIdOrContext === 'object') {
      context = userIdOrContext;
    } else {
      throw new Error(`Invalid processQuery signature`);
    }
    
    // Call BaseAgent's multi-step execution with proper context
    const result = await super.processQuery(query, context);

    // Convert BaseAgent result to old format for backward compatibility
    return {
      success: result.success,
      response: result.summary,
      tools_used: result.executedActions.map(a => ({ name: a.tool })),
      raw_results: result.executedActions.map(a => a.result),
      conversationHistory: context.conversationHistory || [],
      totalSteps: result.totalSteps,
      errors: result.errors
    };
  }
}

module.exports = CalendarAgentMultiStep;
