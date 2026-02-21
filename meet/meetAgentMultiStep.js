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
      }
    };

    super('MeetAgent', tools, llmClient || new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));
  }

  getSystemPrompt() {
    const basePrompt = super.getSystemPrompt();
    return `${basePrompt}

GOOGLE MEET SPECIFIC GUIDELINES:

1. **Meeting Creation**
   - Create meeting first if user wants to create one
   - Include title and optional time details

2. **Multi-Step Example**
   User: "Create a meeting and add john@example.com"
   
   Step 1: createMeeting({ title: "Team Meeting" })
   Result: { meetingId: "abc123", meetingLink: "..." }
   
   Step 2: addParticipant({ meetingId: "abc123", email: "john@example.com" })
   Result: { success: true }

3. **Participant Management**
   - Add participants to meetings
   - Specify roles (organizer, presenter, attendee)
   - Send invitations`;
  }

  async processQuery(query, userId, options = {}) {
    console.log(`[MeetAgent] 🚀 Processing query (multi-step): "${query}"`);
    const result = await super.processQuery(query, {
      userId: userId,
      conversationId: options.conversationId,
      maxIterations: options.maxIterations || 15,
      forceToolExecution: options.forceToolExecution  // ✅ CRITICAL: Pass forceToolExecution to BaseAgent
    });

    return {
      success: result.success,
      response: result.summary,
      tools_used: result.executedActions.map(a => ({ name: a.tool })),
      raw_results: result.executedActions.map(a => a.result),
      conversationHistory: options.conversationHistory || [],
      totalSteps: result.totalSteps,
      errors: result.errors
    };
  }
}

module.exports = MeetAgentMultiStep;
