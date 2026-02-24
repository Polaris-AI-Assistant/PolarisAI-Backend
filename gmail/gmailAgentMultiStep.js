/**
 * Gmail Agent - Multi-Step Execution Version
 * 
 * This is the PRODUCTION version that should replace the old gmailAgent.js
 * It extends BaseAgent to support sequential multi-step operations.
 * 
 * Handles queries like:
 * - "Create a draft email to john@example.com and then send it"
 * - "Send an email and add a label to it"
 * - "Reply to an email and mark it as read"
 */

const BaseAgent = require('../base/BaseAgent');
const gmailService = require('./gmailService');
const OpenAI = require('openai');

class GmailAgentMultiStep extends BaseAgent {
  constructor(llmClient) {
    // Define tools with definition + execute pattern
    const tools = {
      sendEmail: {
        definition: {
          type: 'function',
          function: {
            name: 'sendEmail',
            description: 'Send a new email to one or more recipients. Automatically converts Markdown formatting (##, ###, **, etc.) to HTML for better readability. Use when user wants to send, compose, or write a new email.',
            parameters: {
              type: 'object',
              properties: {
                to: {
                  type: 'string',
                  description: 'Recipient email address (required)'
                },
                subject: {
                  type: 'string',
                  description: 'Email subject line (required)'
                },
                body: {
                  type: 'string',
                  description: 'Email body content. Can include Markdown formatting which will be automatically converted to HTML (required)'
                },
                cc: {
                  type: 'string',
                  description: 'CC recipients (comma-separated emails)'
                },
                bcc: {
                  type: 'string',
                  description: 'BCC recipients (comma-separated emails)'
                },
                isHtml: {
                  type: 'boolean',
                  description: 'Whether the body is already HTML content (default: false). If false and Markdown is detected, it will be auto-converted to HTML'
                }
              },
              required: ['to', 'subject', 'body']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[GmailAgent] 📧 Sending email to: ${params.to}`);
          
          try {
            // Auto-detect Markdown content
            const hasMarkdownSyntax = params.body.includes('##') || params.body.includes('**') || 
                                      params.body.includes('###') || params.body.includes('- **') ||
                                      params.body.includes('\n- ') || params.body.includes('\n* ');
            
            const result = await gmailService.sendEmailForUser(
              context.userId,
              params.to,
              params.subject,
              params.body,
              {
                cc: params.cc,
                bcc: params.bcc,
                isHtml: params.isHtml || false,
                isMarkdown: hasMarkdownSyntax && !params.isHtml
              }
            );

            if (!result.success) {
              throw new Error(result.message || 'Failed to send email');
            }

            console.log(`[GmailAgent] ✅ Email sent successfully`);
            
            return {
              success: true,
              messageId: result.messageId,
              threadId: result.threadId,
              to: params.to,
              subject: params.subject,
              sentAt: new Date().toISOString()
            };
          } catch (error) {
            console.error(`[GmailAgent] ❌ Error sending email:`, error.message);
            throw error;
          }
        }
      },

      createDraft: {
        definition: {
          type: 'function',
          function: {
            name: 'createDraft',
            description: 'Create a draft email without sending it. Use when user wants to compose an email but not send it yet.',
            parameters: {
              type: 'object',
              properties: {
                to: {
                  type: 'string',
                  description: 'Recipient email address (required)'
                },
                subject: {
                  type: 'string',
                  description: 'Email subject line (required)'
                },
                body: {
                  type: 'string',
                  description: 'Email body content (required)'
                },
                cc: {
                  type: 'string',
                  description: 'CC recipients (comma-separated emails)'
                },
                bcc: {
                  type: 'string',
                  description: 'BCC recipients (comma-separated emails)'
                },
                isHtml: {
                  type: 'boolean',
                  description: 'Whether the body is HTML content (default: false)'
                }
              },
              required: ['to', 'subject', 'body']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[GmailAgent] 📝 Creating draft email to: ${params.to}`);
          
          try {
            const result = await gmailService.createDraft(
              context.userId,
              params
            );

            console.log(`[GmailAgent] ✅ Draft created successfully`);
            
            return {
              success: true,
              draftId: result.id,
              to: params.to,
              subject: params.subject,
              createdAt: new Date().toISOString()
            };
          } catch (error) {
            console.error(`[GmailAgent] ❌ Error creating draft:`, error.message);
            throw error;
          }
        }
      },

      replyToEmail: {
        definition: {
          type: 'function',
          function: {
            name: 'replyToEmail',
            description: 'Reply to an existing email. Use when user wants to respond or reply to a received email.',
            parameters: {
              type: 'object',
              properties: {
                messageId: {
                  type: 'string',
                  description: 'The ID of the email to reply to (required)'
                },
                body: {
                  type: 'string',
                  description: 'Reply body content (required)'
                },
                replyAll: {
                  type: 'boolean',
                  description: 'Whether to reply to all recipients (default: false)'
                },
                isHtml: {
                  type: 'boolean',
                  description: 'Whether the body is HTML content (default: false)'
                }
              },
              required: ['messageId', 'body']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[GmailAgent] 💬 Replying to email: ${params.messageId}`);
          
          try {
            const result = await gmailService.replyToEmail(
              context.userId,
              params
            );

            console.log(`[GmailAgent] ✅ Reply sent successfully`);
            
            return {
              success: true,
              messageId: result.id,
              repliedAt: new Date().toISOString()
            };
          } catch (error) {
            console.error(`[GmailAgent] ❌ Error replying to email:`, error.message);
            throw error;
          }
        }
      },

      listMessages: {
        definition: {
          type: 'function',
          function: {
            name: 'listMessages',
            description: 'List emails from the inbox or search for emails. Use when user wants to see their emails or search for specific messages.',
            parameters: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query (e.g., "from:john@example.com", "subject:meeting")'
                },
                maxResults: {
                  type: 'number',
                  description: 'Maximum number of emails to return (default: 10)',
                  default: 10
                },
                labelIds: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Filter by label IDs'
                }
              },
              required: []
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[GmailAgent] 📋 Listing messages`);
          
          try {
            const messages = await gmailService.listMessages(
              context.userId,
              params
            );

            console.log(`[GmailAgent] ✅ Retrieved ${messages.length} messages`);
            
            return {
              success: true,
              messages: messages,
              count: messages.length
            };
          } catch (error) {
            console.error(`[GmailAgent] ❌ Error listing messages:`, error.message);
            throw error;
          }
        }
      },

      readMessage: {
        definition: {
          type: 'function',
          function: {
            name: 'readMessage',
            description: 'Read the full content of a specific email. Use when user wants to see the details of an email.',
            parameters: {
              type: 'object',
              properties: {
                messageId: {
                  type: 'string',
                  description: 'The ID of the email to read (required)'
                }
              },
              required: ['messageId']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[GmailAgent] 📖 Reading message: ${params.messageId}`);
          
          try {
            const message = await gmailService.readMessage(
              context.userId,
              params.messageId
            );

            console.log(`[GmailAgent] ✅ Message read successfully`);
            
            return {
              success: true,
              messageId: message.id,
              from: message.from,
              subject: message.subject,
              body: message.body,
              date: message.date
            };
          } catch (error) {
            console.error(`[GmailAgent] ❌ Error reading message:`, error.message);
            throw error;
          }
        }
      },

      deleteMessage: {
        definition: {
          type: 'function',
          function: {
            name: 'deleteMessage',
            description: 'Delete an email permanently. Use when user wants to delete or remove an email.',
            parameters: {
              type: 'object',
              properties: {
                messageId: {
                  type: 'string',
                  description: 'The ID of the email to delete (required)'
                }
              },
              required: ['messageId']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[GmailAgent] 🗑️ Deleting message: ${params.messageId}`);
          
          try {
            await gmailService.deleteMessage(
              context.userId,
              params.messageId
            );

            console.log(`[GmailAgent] ✅ Message deleted successfully`);
            
            return {
              success: true,
              messageId: params.messageId,
              message: 'Email deleted successfully'
            };
          } catch (error) {
            console.error(`[GmailAgent] ❌ Error deleting message:`, error.message);
            throw error;
          }
        }
      },

      markAsRead: {
        definition: {
          type: 'function',
          function: {
            name: 'markAsRead',
            description: 'Mark an email as read. Use when user wants to mark an email as read.',
            parameters: {
              type: 'object',
              properties: {
                messageId: {
                  type: 'string',
                  description: 'The ID of the email to mark as read (required)'
                }
              },
              required: ['messageId']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[GmailAgent] ✓ Marking message as read: ${params.messageId}`);
          
          try {
            await gmailService.markAsRead(
              context.userId,
              params.messageId
            );

            console.log(`[GmailAgent] ✅ Message marked as read`);
            
            return {
              success: true,
              messageId: params.messageId,
              message: 'Email marked as read'
            };
          } catch (error) {
            console.error(`[GmailAgent] ❌ Error marking as read:`, error.message);
            throw error;
          }
        }
      },

      addLabel: {
        definition: {
          type: 'function',
          function: {
            name: 'addLabel',
            description: 'Add a label to an email. Use when user wants to label, tag, or categorize an email.',
            parameters: {
              type: 'object',
              properties: {
                messageId: {
                  type: 'string',
                  description: 'The ID of the email (required)'
                },
                labelName: {
                  type: 'string',
                  description: 'Name of the label to add (required)'
                }
              },
              required: ['messageId', 'labelName']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[GmailAgent] 🏷️ Adding label to message: ${params.messageId}`);
          
          try {
            await gmailService.addLabel(
              context.userId,
              params.messageId,
              params.labelName
            );

            console.log(`[GmailAgent] ✅ Label added successfully`);
            
            return {
              success: true,
              messageId: params.messageId,
              label: params.labelName,
              message: `Label "${params.labelName}" added`
            };
          } catch (error) {
            console.error(`[GmailAgent] ❌ Error adding label:`, error.message);
            throw error;
          }
        }
      }
    };

    // Initialize BaseAgent with tools
    super('GmailAgent', tools, llmClient || new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));
  }

  /**
   * Override system prompt with Gmail specific instructions
   */
  getSystemPrompt() {
    const basePrompt = super.getSystemPrompt();
    
    return `${basePrompt}

GMAIL SPECIFIC GUIDELINES:

1. **Email Sending**
   - Always send emails directly when user requests
   - Include subject and body content
   - Use sendEmail for immediate sending
   - Use createDraft if user wants to review first
   
   **CRITICAL - Email Address Extraction:**
   - If the query mentions a person's name but NO email address, you MUST check the conversation history
   - Look for messages that mention the person's email address (e.g., "John's email is john@example.com")
   - Search for patterns like: "email is", "email:", "contact:", "@gmail.com", "@outlook.com", etc.
   - NEVER make up or guess email addresses (like "name@example.com")
   - If you cannot find the email address in the query OR conversation history, ask the user for it
   - Examples of references: "send to this email", "share with that person", "email them"

2. **CRITICAL - Email Action Rules**
   ❌ NEVER call markAsRead after sendEmail - sent emails don't need to be marked as read
   ❌ NEVER call markAsRead on emails you just sent - only mark RECEIVED emails as read
   ✅ Only use markAsRead when user explicitly asks to mark a RECEIVED email as read
   ✅ After sendEmail succeeds, your job is DONE - do not call any other tools
   ✅ After replyToEmail succeeds, your job is DONE - do not call any other tools
   ✅ After forwardEmail succeeds, your job is DONE - do not call any other tools
   
   **Example of WRONG behavior:**
   Step 1: sendEmail({ to: "john@example.com", ... })
   Step 2: markAsRead({ messageId: "abc123" }) ❌ WRONG! Don't do this!
   
   **Example of CORRECT behavior:**
   Step 1: sendEmail({ to: "john@example.com", ... })
   Step 2: No more tools needed ✅ CORRECT! Stop here!

3. **Draft Management**
   - Use createDraft to compose without sending
   - User can review and send later
   - Include all email details in draft

4. **Email Organization**
   - Use addLabel to categorize emails
   - Mark emails as read after processing
   - Delete emails when user requests

5. **Search and Retrieval**
   - Use listMessages to search for emails
   - Use readMessage to get full email content
   - Support Gmail search syntax (from:, subject:, etc.)`;
  }

  /**
   * Wrapper to maintain compatibility with old processQuery interface
   * Converts old interface to new BaseAgent interface
   */
  async processQuery(query, userIdOrContext, options = {}) {
    console.log(`[GmailAgent] 🚀 Processing query (multi-step): "${query}"`);
    
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

module.exports = GmailAgentMultiStep;
