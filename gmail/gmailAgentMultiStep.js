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
            description: 'Send a new email WITHOUT attachments to one or more recipients. For emails WITH attachments (pdf, documents, files), use sendEmailWithAttachment instead. Automatically converts Markdown formatting (##, ###, **, etc.) to HTML for better readability. Use only when user wants to send text email WITHOUT files.',
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

      sendEmailWithAttachment: {
        definition: {
          type: 'function',
          function: {
            name: 'sendEmailWithAttachment',
            description: 'Send an email WITH file attachments (PDF, documents, images, etc.). USE THIS TOOL when user wants to attach files to email - keywords: "attach", "attached", "pdf", "document", "file", "include file", "with attachment". DO NOT use sendEmail for emails with attachments. Files must be provided as fileIds array. Automatically converts Markdown formatting to HTML for better readability.',
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
                fileIds: {
                  type: 'array',
                  items: {
                    type: 'string'
                  },
                  description: 'Array of file IDs from uploaded files to attach to the email (required, minimum 1 file). These are UUIDs like "abc123-def456"'
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
              required: ['to', 'subject', 'body', 'fileIds']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[GmailAgent] 📧📎 Sending email with ${params.fileIds.length} attachment(s) to: ${params.to}`);
          
          try {
            // Defensive handling: if fileIds contains placeholder, use context fileIds if available
            let actualFileIds = params.fileIds;
            if (actualFileIds.some(id => id === 'YOUR_FILE_ID' || id.includes('placeholder'))) {
              console.log(`[GmailAgent] ⚠️ Detected placeholder file IDs, attempting to use context file IDs...`);
              
              if (context.attachedFileIds && context.attachedFileIds.length > 0) {
                console.log(`[GmailAgent] ✅ Using attached file IDs from context: ${context.attachedFileIds.join(', ')}`);
                actualFileIds = context.attachedFileIds;
              } else {
                // If no context fileIds, throw error with helpful message
                throw new Error(
                  `No file IDs provided. When sending emails with attachments, please specify which files to attach. ` +
                  `Available files should be included in the file IDs list. If files were uploaded, they will be available as file IDs in the system.`
                );
              }
            }
            
            // Auto-detect Markdown content
            const hasMarkdownSyntax = params.body.includes('##') || params.body.includes('**') || 
                                      params.body.includes('###') || params.body.includes('- **') ||
                                      params.body.includes('\n- ') || params.body.includes('\n* ');
            
            const result = await gmailService.sendEmailWithAttachmentsForUser(
              context.userId,
              params.to,
              params.subject,
              params.body,
              actualFileIds,
              {
                cc: params.cc,
                bcc: params.bcc,
                isHtml: params.isHtml || false,
                isMarkdown: hasMarkdownSyntax && !params.isHtml
              }
            );

            if (!result.success) {
              throw new Error(result.error || 'Failed to send email with attachments');
            }

            console.log(`[GmailAgent] ✅ Email with attachments sent successfully`);
            
            return {
              success: true,
              messageId: result.messageId,
              threadId: result.threadId,
              to: params.to,
              subject: params.subject,
              attachmentCount: actualFileIds.length,
              totalAttachmentSize: result.totalAttachmentSize,
              sentAt: new Date().toISOString()
            };
          } catch (error) {
            console.error(`[GmailAgent] ❌ Error sending email with attachments:`, error.message);
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
            description: 'Search for and list emails from the inbox. MUST be used FIRST to find email IDs before using readMessage. Supports Gmail search syntax like "from:sender-name", "subject:keyword", "has:attachment", etc. Use when user wants to see emails, search for messages, or find a specific email to read.',
            parameters: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Gmail search query (e.g., "from:john@example.com", "from:Google AI Studio", "subject:meeting", "has:attachment"). Multi-word sender names work too: "from:Google AI Studio"'
                },
                maxResults: {
                  type: 'number',
                  description: 'Maximum number of emails to return (default: 10). Use 1 or 5 for specific searches.',
                  default: 10
                },
                labelIds: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Filter by label IDs (optional)'
                }
              },
              required: []
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[GmailAgent] 📋 Listing messages`);
          
          try {
            let result;
            
            // Use searchEmails if query is provided, otherwise getLatestEmails
            if (params.query) {
              result = await gmailService.searchEmails(
                context.userId,
                {
                  query: params.query,
                  maxResults: params.maxResults || 10
                }
              );
            } else {
              result = await gmailService.getLatestEmails(
                context.userId,
                {
                  maxResults: params.maxResults || 10,
                  labelIds: params.labelIds
                }
              );
            }

            if (!result.success) {
              throw new Error(result.error || 'Failed to retrieve emails');
            }

            console.log(`[GmailAgent] ✅ Retrieved ${result.count} messages`);
            
            return {
              success: true,
              emails: result.emails || [],
              count: result.count || 0
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
            description: 'Read the full content of a specific email. MUST be used AFTER listMessages to get a real messageId. NEVER guess or make up messageIds. Use when you have a specific messageId from listMessages results and user wants to see the full email content.',
            parameters: {
              type: 'object',
              properties: {
                messageId: {
                  type: 'string',
                  description: 'The actual message ID from listMessages results (required). This must be a real ID returned by listMessages, not a guessed value like "1" or "abc123"'
                }
              },
              required: ['messageId']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[GmailAgent] 📖 Reading message: ${params.messageId}`);
          
          try {
            const result = await gmailService.readEmail(
              context.userId,
              { messageId: params.messageId }
            );

            if (!result.success) {
              throw new Error(result.error || 'Failed to read email');
            }

            console.log(`[GmailAgent] ✅ Message read successfully`);
            
            return {
              success: true,
              messageId: result.email.id,
              from: result.email.from,
              subject: result.email.subject,
              body: result.email.body,
              date: result.email.date,
              labels: result.email.labels
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
    
    // This will be enhanced by processQuery to include attachedFileIds context
    return `${basePrompt}

GMAIL SPECIFIC GUIDELINES:

1. **EMAIL ATTACHMENT RULES - CRITICAL**
   🔴 **MANDATORY DECISION LOGIC:**
   - IF query mentions: "attach", "attachment", "pdf", "file", "document", "with file", "include file"
   - THEN you MUST use sendEmailWithAttachment tool (NOT sendEmail)
   - IF query does NOT mention any attachment keywords AND no files are available
   - THEN use sendEmail tool
   
   ✅ CORRECT: "Send email with the pdf attached" → USE sendEmailWithAttachment
   ✅ CORRECT: "Email the document to john@example.com" → USE sendEmailWithAttachment (files available)
   ❌ WRONG: "Send email with the pdf attached" → USE sendEmail (missing attachment handling)
   
   **ATTACHMENT PARAMETER RULES:**
   - fileIds parameter is REQUIRED when using sendEmailWithAttachment
   - fileIds must be an array of file IDs (even if just one file: ["abc123"])
   - NEVER use placeholder values like "YOUR_FILE_ID"
   - ALWAYS use actual file IDs provided in the context
   - If no fileIds available, inform user that files must be uploaded first

2. **Email Sending**
   - Always send emails directly when user requests
   - Include subject and body content
   - Use sendEmail for immediate sending (WITHOUT attachments)
   - Use sendEmailWithAttachment for emails WITH files attached
   - Use createDraft if user wants to review first
   
   **CRITICAL - Email Address Extraction:**
   - If the query mentions a person's name but NO email address, you MUST check the conversation history
   - Look for messages that mention the person's email address (e.g., "John's email is john@example.com")
   - Search for patterns like: "email is", "email:", "contact:", "@gmail.com", "@outlook.com", etc.
   - NEVER make up or guess email addresses (like "name@example.com")
   - If you cannot find the email address in the query OR conversation history, ask the user for it
   - Examples of references: "send to this email", "share with that person", "email them"

3. **CRITICAL - Email Action Rules**
   ❌ NEVER call markAsRead after sendEmail - sent emails don't need to be marked as read
   ❌ NEVER call markAsRead on emails you just sent - only mark RECEIVED emails as read
   ✅ Only use markAsRead when user explicitly asks to mark a RECEIVED email as read
   ✅ After sendEmail succeeds, your job is DONE - do not call any other tools
   ✅ After sendEmailWithAttachment succeeds, your job is DONE - do not call any other tools
   ✅ After replyToEmail succeeds, your job is DONE - do not call any other tools
   ✅ After forwardEmail succeeds, your job is DONE - do not call any other tools
   
   **Example of WRONG behavior:**
   Step 1: sendEmail({ to: "john@example.com", ... })
   Step 2: markAsRead({ messageId: "abc123" }) ❌ WRONG! Don't do this!
   
   **Example of CORRECT behavior:**
   Step 1: sendEmailWithAttachment({ to: "john@example.com", fileIds: ["file123"], ... })
   Step 2: No more tools needed ✅ CORRECT! Stop here!

4. **Draft Management**
   - Use createDraft to compose without sending
   - User can review and send later
   - Include all email details in draft

5. **Email Organization**
   - Use addLabel to categorize emails
   - Mark emails as read after processing
   - Delete emails when user requests

6. **Search and Retrieval - CRITICAL WORKFLOW**
   - Use listMessages to search for emails
   - Use readMessage to get full email content
   - Support Gmail search syntax (from:, subject:, etc.)
   
   **IMPORTANT - Multi-Step Workflow:**
   When user asks to "read email from [sender]" or "show email about [topic]":
   ✅ STEP 1: Call listMessages with appropriate search query
      - For "read email from Google AI Studio" → listMessages({ query: "from:Google AI Studio", maxResults: 1 })
      - For "show emails about meetings" → listMessages({ query: "subject:meetings", maxResults: 5 })
   ✅ STEP 2: Extract messageId from the returned emails
   ✅ STEP 3: Call readMessage with the actual messageId
   
   ❌ NEVER call readMessage without first using listMessages
   ❌ NEVER make up or guess messageIds (like "1", "abc123", etc.)
   ❌ NEVER call readMessage if listMessages finds no results - inform user instead
   
   **Example CORRECT flow for "read the email from Google AI Studio":**
   Step 1: listMessages({ query: "from:Google AI Studio", maxResults: 1 })
   Step 2: Extract messageId from results (e.g., "19d049da96d7fcb5")
   Step 3: readMessage({ messageId: "19d049da96d7fcb5" })
   
   **Example WRONG flow:**
   Step 1: readMessage({ messageId: "1" }) ❌ WRONG - no search done, no real messageId`;
  }

  /**
   * Build initial system prompt with attachment context
   * This gets called by BaseAgent before LLM execution
   */
  buildInitialMessages(query, context, detectedLanguage = 'en') {
    // Call parent implementation
    const parentMessages = super.buildInitialMessages(query, context, detectedLanguage);
    
    // ENHANCE the system prompt with available file information
    if (context.attachedFileIds && context.attachedFileIds.length > 0) {
      const fileContext = `
      
⚡ **AVAILABLE FILES IN THIS MESSAGE:**
${context.attachedFileIds.map((id, i) => `  ${i + 1}. File ID: ${id}`).join('\n')}

These file IDs MUST be passed to the fileIds parameter when using sendEmailWithAttachment.`;
      
      // Enhance the system prompt
      if (parentMessages[0] && parentMessages[0].role === 'system') {
        parentMessages[0].content += fileContext;
      }
    }
    
    return parentMessages;
  }

  /**
   * Wrapper to maintain compatibility with old processQuery interface
   * Converts old interface to new BaseAgent interface
   */
  async processQuery(query, userIdOrContext, options = {}) {
    console.log(`[GmailAgent] 🚀 Processing query (multi-step): "${query}"`);
    
    // DEBUG: Log available tools
    console.log(`[GmailAgent] 🔧 Available tools: ${Object.keys(this.tools).join(', ')}`);
    
    // Detect which signature is being used
    let context;
    if (typeof userIdOrContext === 'string') {
      context = {
        userId: userIdOrContext,
        conversationId: options.conversationId,
        maxIterations: options.maxIterations || 15,
        forceToolExecution: options.forceToolExecution,
        conversationHistory: options.conversationHistory,
        fileIds: options.fileIds || [],
        attachedFiles: options.attachedFiles || []
      };
    } else if (typeof userIdOrContext === 'object') {
      context = userIdOrContext;
    } else {
      throw new Error(`Invalid processQuery signature`);
    }
    
    // Extract file IDs from context (passed as second parameter in new signature)
    const fileIds = context.fileIds || options.fileIds || [];
    
    // Extract attachedFiles (file metadata) from context
    const attachedFiles = context.attachedFiles || options.attachedFiles || [];
    
    // DEBUG: Log file IDs and attached files
    console.log(`[GmailAgent] 📎 File IDs: ${fileIds.length > 0 ? fileIds.join(', ').substring(0, 50) + '...' : 'None'}`);
    console.log(`[GmailAgent] 📋 Attached files (metadata): ${attachedFiles.length > 0 ? attachedFiles.length + ' file(s)' : 'None'}`);
    
    // ✅ ALWAYS add fileIds to context if available
    if (fileIds.length > 0) {
      context.attachedFileIds = fileIds;
      console.log(`[GmailAgent] ✅ Storing ${fileIds.length} file ID(s) in context for LLM access`);
    }
    
    // ✅ ALSO store attached files metadata in context for tool handlers
    if (attachedFiles.length > 0) {
      context.attachedFiles = attachedFiles;
      console.log(`[GmailAgent] ✅ Storing ${attachedFiles.length} file metadata in context for tool handlers`);
      
      // Log file details for debugging
      for (const file of attachedFiles) {
        console.log(`[GmailAgent]   📄 ${file.original_filename || file.filename} (${file.mime_type}) - ${file.id.substring(0, 8)}...`);
      }
    }
    
    // DEBUG: Check if attachment keywords are mentioned
    const attachmentKeywords = ['attach', 'attachment', 'pdf', 'file', 'document', 'with file', 'include file'];
    const hasAttachmentKeyword = attachmentKeywords.some(kw => query.toLowerCase().includes(kw));
    console.log(`[GmailAgent] 🔍 Attachment keywords detected: ${hasAttachmentKeyword ? 'YES' : 'NO'}`);
    
    // DEBUG: Log whether system prompt includes attachment context
    const systemPrompt = this.getSystemPrompt();
    const hasAttachmentInstructions = systemPrompt.includes('EMAIL ATTACHMENT RULES');
    console.log(`[GmailAgent] 📝 System prompt includes attachment context: ${hasAttachmentInstructions ? 'YES' : 'NO'}`);
    
    // If user mentioned attachments AND fileIds provided, enhance query with file info
    if (hasAttachmentKeyword && fileIds.length > 0) {
      console.log(`[GmailAgent] 📎 DETECTED: Attachment keyword + file IDs present`);
      console.log(`[GmailAgent] 🎯 WILL CALL: sendEmailWithAttachment tool`);
      
      // Build enriched query that includes file IDs
      const enrichedQuery = `${query}\n\n[Available Files for Attachment]: ${fileIds.map((id, i) => `File ${i + 1}: ${id}`).join(', ')}`;
      
      console.log(`[GmailAgent] 📤 Calling BaseAgent with enriched query and fileIds in context`);
      
      // Call BaseAgent's multi-step execution with enriched context
      const result = await super.processQuery(enrichedQuery, context);

      // Convert BaseAgent result to old format for backward compatibility
      return {
        success: result.success,
        response: result.summary,
        tools_used: result.executedActions.map(a => ({ name: a.tool })),
        raw_results: result.executedActions.map(a => a.result),
        conversationHistory: context.conversationHistory || [],
        totalSteps: result.totalSteps,
        errors: result.errors,
        attachedFileIds: fileIds
      };
    }
    
    // Call BaseAgent's multi-step execution with proper context
    console.log(`[GmailAgent] 📤 Calling BaseAgent with standard query`);
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
