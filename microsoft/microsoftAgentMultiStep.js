/**
 * Microsoft Agent - Multi-Step Execution Version
 * Extends BaseAgent to support sequential multi-step operations.
 */

const BaseAgent = require('../base/BaseAgent');
const microsoftService = require('./microsoftService');
const OpenAI = require('openai');

class MicrosoftAgentMultiStep extends BaseAgent {
  constructor(llmClient) {
    const tools = {
      createDocument: {
        definition: {
          type: 'function',
          function: {
            name: 'createDocument',
            description: 'Create a new Word document',
            parameters: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'Document title' },
                content: { type: 'string', description: 'Initial document content' }
              },
              required: ['title']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[MicrosoftAgent] 📄 Creating document: "${params.title}"`);
          try {
            const doc = await microsoftService.createDocument(context.userId, params);
            console.log(`[MicrosoftAgent] ✅ Document created: ${doc.id}`);
            return {
              success: true,
              documentId: doc.id,
              title: doc.name,
              url: doc.webUrl,
              createdAt: new Date().toISOString()
            };
          } catch (error) {
            console.error(`[MicrosoftAgent] ❌ Error creating document:`, error.message);
            throw error;
          }
        }
      },

      createEmail: {
        definition: {
          type: 'function',
          function: {
            name: 'createEmail',
            description: 'Send an email via Outlook',
            parameters: {
              type: 'object',
              properties: {
                to: { type: 'string', description: 'Recipient email' },
                subject: { type: 'string', description: 'Email subject' },
                body: { type: 'string', description: 'Email body' },
                cc: { type: 'string', description: 'CC recipients' },
                bcc: { type: 'string', description: 'BCC recipients' }
              },
              required: ['to', 'subject', 'body']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[MicrosoftAgent] 📧 Sending email to: ${params.to}`);
          try {
            const result = await microsoftService.createEmail(context.userId, params);
            console.log(`[MicrosoftAgent] ✅ Email sent successfully`);
            return { success: true, messageId: result.id, to: params.to, sentAt: new Date().toISOString() };
          } catch (error) {
            console.error(`[MicrosoftAgent] ❌ Error sending email:`, error.message);
            throw error;
          }
        }
      },

      createCalendarEvent: {
        definition: {
          type: 'function',
          function: {
            name: 'createCalendarEvent',
            description: 'Create a calendar event in Outlook',
            parameters: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'Event title' },
                startTime: { type: 'string', description: 'Start time in ISO 8601 format' },
                endTime: { type: 'string', description: 'End time in ISO 8601 format' },
                description: { type: 'string', description: 'Event description' },
                attendees: { type: 'array', items: { type: 'string' }, description: 'Attendee emails' }
              },
              required: ['title', 'startTime', 'endTime']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[MicrosoftAgent] 📅 Creating calendar event: "${params.title}"`);
          try {
            const event = await microsoftService.createCalendarEvent(context.userId, params);
            console.log(`[MicrosoftAgent] ✅ Event created: ${event.id}`);
            return { success: true, eventId: event.id, title: event.subject, url: event.webLink };
          } catch (error) {
            console.error(`[MicrosoftAgent] ❌ Error creating event:`, error.message);
            throw error;
          }
        }
      },

      createExcelWorkbook: {
        definition: {
          type: 'function',
          function: {
            name: 'createExcelWorkbook',
            description: 'Create a new Excel workbook',
            parameters: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'Workbook title' }
              },
              required: ['title']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[MicrosoftAgent] 📊 Creating Excel workbook: "${params.title}"`);
          try {
            const workbook = await microsoftService.createExcelWorkbook(context.userId, params);
            console.log(`[MicrosoftAgent] ✅ Workbook created: ${workbook.id}`);
            return { success: true, workbookId: workbook.id, title: workbook.name, url: workbook.webUrl };
          } catch (error) {
            console.error(`[MicrosoftAgent] ❌ Error creating workbook:`, error.message);
            throw error;
          }
        }
      },

      createTeamsMessage: {
        definition: {
          type: 'function',
          function: {
            name: 'createTeamsMessage',
            description: 'Send a message in Microsoft Teams',
            parameters: {
              type: 'object',
              properties: {
                channelId: { type: 'string', description: 'Channel ID' },
                message: { type: 'string', description: 'Message content' }
              },
              required: ['channelId', 'message']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[MicrosoftAgent] 💬 Sending Teams message`);
          try {
            const result = await microsoftService.createTeamsMessage(context.userId, params);
            console.log(`[MicrosoftAgent] ✅ Message sent successfully`);
            return { success: true, messageId: result.id, sentAt: new Date().toISOString() };
          } catch (error) {
            console.error(`[MicrosoftAgent] ❌ Error sending message:`, error.message);
            throw error;
          }
        }
      },

      createOneDriveFolder: {
        definition: {
          type: 'function',
          function: {
            name: 'createOneDriveFolder',
            description: 'Create a folder in OneDrive',
            parameters: {
              type: 'object',
              properties: {
                folderName: { type: 'string', description: 'Folder name' },
                parentPath: { type: 'string', description: 'Parent folder path', default: '/' }
              },
              required: ['folderName']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[MicrosoftAgent] 📁 Creating OneDrive folder: "${params.folderName}"`);
          try {
            const folder = await microsoftService.createOneDriveFolder(context.userId, params);
            console.log(`[MicrosoftAgent] ✅ Folder created: ${folder.id}`);
            return { success: true, folderId: folder.id, folderName: folder.name, url: folder.webUrl };
          } catch (error) {
            console.error(`[MicrosoftAgent] ❌ Error creating folder:`, error.message);
            throw error;
          }
        }
      }
    };

    super('MicrosoftAgent', tools, llmClient || new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));
  }

  getSystemPrompt() {
    const basePrompt = super.getSystemPrompt();
    return `${basePrompt}

MICROSOFT 365 SPECIFIC GUIDELINES:

1. **Document Creation**
   - Create Word documents for text content
   - Create Excel workbooks for data
   - Include title and optional initial content

2. **Multi-Step Example**
   User: "Create a Word document and send it via email"
   
   Step 1: createDocument({ title: "Report" })
   Result: { documentId: "abc123", url: "..." }
   
   Step 2: createEmail({ to: "john@example.com", subject: "Report", body: "..." })
   Result: { success: true }

3. **Communication**
   - Send emails via Outlook
   - Send Teams messages
   - Create calendar events
   
   **CRITICAL - Email Address Extraction:**
   - If the query mentions a person's name but NO email address, you MUST check the conversation history
   - Look for messages that mention the person's email address (e.g., "John's email is john@example.com")
   - Search for patterns like: "email is", "email:", "contact:", "@gmail.com", "@outlook.com", etc.
   - NEVER make up or guess email addresses (like "name@example.com")
   - If you cannot find the email address in the query OR conversation history, ask the user for it
   - Examples of references: "send to this email", "share with that person", "email them"

4. **Storage**
   - Create OneDrive folders
   - Organize files and documents`;
  }

  async processQuery(query, userIdOrContext, options = {}) {
    console.log(`[MicrosoftAgent] 🚀 Processing query (multi-step): "${query}"`);
    
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

module.exports = MicrosoftAgentMultiStep;
