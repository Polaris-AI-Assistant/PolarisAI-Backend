/**
 * Google Meet Agent - Multi-Step Execution Version
 * Extends BaseAgent to support sequential multi-step operations.
 */

const BaseAgent = require('../base/BaseAgent');
const meetService = require('./meetService');
const OpenAI = require('openai');

class MeetAgentMultiStep extends BaseAgent {
  constructor(llmClient) {
    const tools = {
      createMeeting: {
        definition: {
          type: 'function',
          function: {
            name: 'createMeeting',
            description: 'Create a new Google Meet meeting',
            parameters: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'Meeting title' },
                startTime: { type: 'string', description: 'Start time in ISO 8601 format' },
                endTime: { type: 'string', description: 'End time in ISO 8601 format' },
                description: { type: 'string', description: 'Meeting description' }
              },
              required: ['title']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[MeetAgent] 📹 Creating meeting: "${params.title}"`);
          try {
            const meeting = await meetService.createMeeting(context.userId, params);
            console.log(`[MeetAgent] ✅ Meeting created: ${meeting.id}`);
            return {
              success: true,
              meetingId: meeting.id,
              meetingLink: meeting.meetingLink,
              title: meeting.title,
              createdAt: new Date().toISOString()
            };
          } catch (error) {
            console.error(`[MeetAgent] ❌ Error creating meeting:`, error.message);
            throw error;
          }
        }
      },

      addParticipant: {
        definition: {
          type: 'function',
          function: {
            name: 'addParticipant',
            description: 'Add a participant to a meeting',
            parameters: {
              type: 'object',
              properties: {
                meetingId: { type: 'string', description: 'Meeting ID' },
                email: { type: 'string', description: 'Participant email' },
                role: { type: 'string', enum: ['organizer', 'presenter', 'attendee'], description: 'Participant role', default: 'attendee' }
              },
              required: ['meetingId', 'email']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[MeetAgent] 👤 Adding participant: ${params.email}`);
          try {
            await meetService.addParticipant(context.userId, params);
            console.log(`[MeetAgent] ✅ Participant added successfully`);
            return { success: true, meetingId: params.meetingId, email: params.email };
          } catch (error) {
            console.error(`[MeetAgent] ❌ Error adding participant:`, error.message);
            throw error;
          }
        }
      },

      updateMeeting: {
        definition: {
          type: 'function',
          function: {
            name: 'updateMeeting',
            description: 'Update meeting details',
            parameters: {
              type: 'object',
              properties: {
                meetingId: { type: 'string', description: 'Meeting ID' },
                title: { type: 'string', description: 'New title' },
                description: { type: 'string', description: 'New description' },
                startTime: { type: 'string', description: 'New start time' },
                endTime: { type: 'string', description: 'New end time' }
              },
              required: ['meetingId']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[MeetAgent] 🔄 Updating meeting: ${params.meetingId}`);
          try {
            await meetService.updateMeeting(context.userId, params);
            console.log(`[MeetAgent] ✅ Meeting updated successfully`);
            return { success: true, meetingId: params.meetingId };
          } catch (error) {
            console.error(`[MeetAgent] ❌ Error updating meeting:`, error.message);
            throw error;
          }
        }
      },

      deleteMeeting: {
        definition: {
          type: 'function',
          function: {
            name: 'deleteMeeting',
            description: 'Delete a meeting',
            parameters: {
              type: 'object',
              properties: {
                meetingId: { type: 'string', description: 'Meeting ID' }
              },
              required: ['meetingId']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[MeetAgent] 🗑️ Deleting meeting: ${params.meetingId}`);
          try {
            await meetService.deleteMeeting(context.userId, params.meetingId);
            console.log(`[MeetAgent] ✅ Meeting deleted successfully`);
            return { success: true, meetingId: params.meetingId };
          } catch (error) {
            console.error(`[MeetAgent] ❌ Error deleting meeting:`, error.message);
            throw error;
          }
        }
      },

      listConferences: {
        definition: {
          type: 'function',
          function: {
            name: 'listConferences',
            description: 'List all past Google Meet conferences. Use when user asks about meeting history, past meetings, previous conferences, or their meetings.',
            parameters: {
              type: 'object',
              properties: {
                spaceName: {
                  type: 'string',
                  description: 'Optional: specific meeting space name/ID in format spaces/{space_id}. If not provided, lists all conferences accessible to user.'
                },
                pageSize: {
                  type: 'number',
                  description: 'Number of conferences to return (default: 20, max: 100)'
                },
                pageToken: {
                  type: 'string',
                  description: 'Token for pagination to get next page of results'
                }
              },
              required: []
            }
          }
        },
        execute: async (params, context) => {
          // Google Meet API v2 doesn't use spaceName parameter - it returns user's own conferences
          // The spaceName is kept for backward compatibility but not sent to the API
          console.log(`[MeetAgent] 📋 Retrieving your past conferences`);
          try {
            const result = await meetService.listConferences(
              context.userId,
              params.spaceName || null,
              params.pageSize || 20,
              params.pageToken
            );
            if (result.success) {
              console.log(`[MeetAgent] ✅ Found ${result.count} past conferences`);
            } else {
              console.log(`[MeetAgent] ⚠️ Error retrieving conferences: ${result.error}`);
            }
            return result;
          } catch (error) {
            console.error(`[MeetAgent] ❌ Error listing conferences:`, error.message);
            return {
              success: false,
              error: error.message,
              conferences: []
            };
          }
        }
      },

      getConference: {
        definition: {
          type: 'function',
          function: {
            name: 'getConference',
            description: 'Get details of a specific past Google Meet conference',
            parameters: {
              type: 'object',
              properties: {
                conferenceName: {
                  type: 'string',
                  description: 'The conference name/ID in format conferenceRecords/{record_id}'
                }
              },
              required: ['conferenceName']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[MeetAgent] 🔍 Getting conference details: ${params.conferenceName}`);
          try {
            const result = await meetService.getConference(context.userId, params.conferenceName);
            console.log(`[MeetAgent] ✅ Retrieved conference details`);
            return result;
          } catch (error) {
            console.error(`[MeetAgent] ❌ Error getting conference:`, error.message);
            throw error;
          }
        }
      },

      listParticipants: {
        definition: {
          type: 'function',
          function: {
            name: 'listParticipants',
            description: 'List all participants who joined a Google Meet conference. Shows who attended and when they joined/left.',
            parameters: {
              type: 'object',
              properties: {
                conferenceName: {
                  type: 'string',
                  description: 'The conference name/ID in format conferenceRecords/{record_id}'
                },
                pageSize: {
                  type: 'number',
                  description: 'Number of participants to return (default: 20, max: 100)'
                },
                pageToken: {
                  type: 'string',
                  description: 'Token for pagination to get next page of results'
                }
              },
              required: ['conferenceName']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[MeetAgent] 👥 Listing participants for conference: ${params.conferenceName}`);
          try {
            const result = await meetService.listParticipants(
              context.userId,
              params.conferenceName,
              params.pageSize || 20,
              params.pageToken
            );
            console.log(`[MeetAgent] ✅ Found ${result.count} participants`);
            return result;
          } catch (error) {
            console.error(`[MeetAgent] ❌ Error listing participants:`, error.message);
            throw error;
          }
        }
      },

      getMeetingSpace: {
        definition: {
          type: 'function',
          function: {
            name: 'getMeetingSpace',
            description: 'Get details of a specific Google Meet space, including active conference info',
            parameters: {
              type: 'object',
              properties: {
                spaceName: {
                  type: 'string',
                  description: 'The meeting space name/ID in format spaces/{space_id}'
                }
              },
              required: ['spaceName']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[MeetAgent] 🏠 Getting meeting space: ${params.spaceName}`);
          try {
            const result = await meetService.getMeetingSpace(context.userId, params.spaceName);
            console.log(`[MeetAgent] ✅ Retrieved meeting space details`);
            return result;
          } catch (error) {
            console.error(`[MeetAgent] ❌ Error getting meeting space:`, error.message);
            throw error;
          }
        }
      }
    };

    super('MeetAgent', tools, llmClient || new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));
  }

  getSystemPrompt() {
    const basePrompt = super.getSystemPrompt();
    return `${basePrompt}

GOOGLE MEET SPECIFIC GUIDELINES:

1. **Retrieving Past Meetings (USER'S TOP REQUEST) - SIMPLIFIED**
   - When user asks: "Show my past meetings", "List my meetings", "What meetings did I have?"
   - ✅ ALWAYS use listConferences() tool - NO parameters needed at all
   - listConferences() automatically retrieves ALL past conferences for the authenticated user
   - This is the simplest and most direct way to get meeting history
   - You can also use listParticipants() afterwards to show who attended if user asks for that detail
   
   Example flow:
   User: "list my past Google Meet meetings"
   → Call listConferences() with NO parameters
   → Returns list of all past conferences with dates and times
   → User can ask "who was in meeting X?" and you call listParticipants()

2. **Meeting Creation**
   - Create meeting first if user wants to create one
   - Include title and optional time details

3. **Multi-Step Example**
   User: "Create a meeting and add john@example.com"
   
   Step 1: createMeeting({ title: "Team Meeting" })
   Result: { meetingId: "abc123", meetingLink: "..." }
   
   Step 2: addParticipant({ meetingId: "abc123", email: "john@example.com" })
   Result: { success: true }

4. **Participant Details Example**
   User: "Who attended my last meeting?"
   
   Step 1: listConferences() → Gets past meetings (user's own conferences)
   Step 2: listParticipants({ conferenceName: "conferenceRecords/ABC123" }) → Shows attendees

5. **Participant Management**
   - Add participants to meetings
   - Specify roles (organizer, presenter, attendee)
   - Send invitations`;
  }

  async processQuery(query, userIdOrContext, options = {}) {
    console.log(`[MeetAgent] 🚀 Processing query (multi-step): "${query}"`);
    
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
    
    const result = await super.processQuery(query, context);

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

module.exports = MeetAgentMultiStep;
