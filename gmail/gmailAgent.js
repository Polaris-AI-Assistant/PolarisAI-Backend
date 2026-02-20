/**
 * Gmail AI Agent using OpenAI
 * 
 * This agent provides intelligent interaction with Gmail using natural language queries.
 * It dynamically selects and executes appropriate Gmail API functions based on user intent.
 * 
 * Features:
 * - Natural language query processing
 * - Dynamic tool selection based on user intent
 * - Email sending, replying, and forwarding
 * - Email reading and search
 * - Draft management
 * - Label management
 * - Filter management
 * - Multi-tool query support
 * - Comprehensive error handling
 * 
 * Usage:
 * const agent = new GmailAgent();
 * const result = await agent.processQuery("send an email to john@example.com", userId);
 */

const OpenAI = require('openai');
const gmailService = require('./gmailService');

class GmailAgent {
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
   * Define OpenAI function schemas for each Gmail function
   * These schemas help the AI understand when and how to use each tool
   */
  defineTools() {
    return [
      // ========== EMAIL SENDING ==========
      {
        type: "function",
        function: {
          name: "sendEmail",
          description: "Send a new email to one or more recipients. Use when user wants to send, compose, or write a new email.",
          parameters: {
            type: "object",
            properties: {
              to: {
                type: "string",
                description: "Recipient email address (required)"
              },
              subject: {
                type: "string",
                description: "Email subject line (required)"
              },
              body: {
                type: "string",
                description: "Email body content (required)"
              },
              cc: {
                type: "string",
                description: "CC recipients (comma-separated emails)"
              },
              bcc: {
                type: "string",
                description: "BCC recipients (comma-separated emails)"
              },
              isHtml: {
                type: "boolean",
                description: "Whether the body is HTML content (default: false)"
              }
            },
            required: ["to", "subject", "body"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "replyToEmail",
          description: "Reply to an existing email. Use when user wants to respond or reply to a received email.",
          parameters: {
            type: "object",
            properties: {
              messageId: {
                type: "string",
                description: "The ID of the email to reply to (required)"
              },
              body: {
                type: "string",
                description: "Reply message body (required)"
              },
              replyAll: {
                type: "boolean",
                description: "Whether to reply to all recipients (default: false)"
              }
            },
            required: ["messageId", "body"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "forwardEmail",
          description: "Forward an email to another recipient. Use when user wants to forward or share an email with someone else.",
          parameters: {
            type: "object",
            properties: {
              messageId: {
                type: "string",
                description: "The ID of the email to forward (required)"
              },
              to: {
                type: "string",
                description: "Recipient email address to forward to (required)"
              },
              additionalMessage: {
                type: "string",
                description: "Optional message to add before the forwarded content"
              }
            },
            required: ["messageId", "to"]
          }
        }
      },

      // ========== EMAIL READING ==========
      {
        type: "function",
        function: {
          name: "readEmail",
          description: "Read the full content of a specific email by its ID. Use when user wants to see or read an email's details.",
          parameters: {
            type: "object",
            properties: {
              messageId: {
                type: "string",
                description: "The ID of the email to read (required)"
              }
            },
            required: ["messageId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getLatestEmails",
          description: "Get the most recent emails from the inbox. Use when user asks about recent, latest, or new emails.",
          parameters: {
            type: "object",
            properties: {
              maxResults: {
                type: "number",
                description: "Maximum number of emails to return (default: 10, max: 50)"
              },
              labelIds: {
                type: "array",
                items: { type: "string" },
                description: "Filter by label IDs (e.g., ['INBOX', 'IMPORTANT'])"
              }
            },
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getUnreadEmails",
          description: "Get unread emails from the inbox. Use when user asks about unread messages or what they haven't read yet.",
          parameters: {
            type: "object",
            properties: {
              maxResults: {
                type: "number",
                description: "Maximum number of emails to return (default: 10, max: 50)"
              }
            },
            required: []
          }
        }
      },

      // ========== EMAIL SEARCH ==========
      {
        type: "function",
        function: {
          name: "searchEmails",
          description: "Search emails using Gmail search syntax. Use when user wants to find specific emails by keyword, sender, date, etc.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Gmail search query (e.g., 'from:john@example.com', 'subject:invoice', 'has:attachment') (required)"
              },
              maxResults: {
                type: "number",
                description: "Maximum number of results (default: 20)"
              }
            },
            required: ["query"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getEmailsByThread",
          description: "Get all emails in a conversation thread. Use when user wants to see the full email conversation or thread.",
          parameters: {
            type: "object",
            properties: {
              threadId: {
                type: "string",
                description: "The thread ID to retrieve (required)"
              }
            },
            required: ["threadId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getEmailsBySender",
          description: "Get all emails from a specific sender. Use when user wants to see all emails from someone.",
          parameters: {
            type: "object",
            properties: {
              senderEmail: {
                type: "string",
                description: "The sender's email address (required)"
              },
              maxResults: {
                type: "number",
                description: "Maximum number of results (default: 20)"
              }
            },
            required: ["senderEmail"]
          }
        }
      },

      // ========== DRAFT MANAGEMENT ==========
      {
        type: "function",
        function: {
          name: "createDraft",
          description: "Create an email draft without sending. Use when user wants to save a draft or prepare an email for later.",
          parameters: {
            type: "object",
            properties: {
              to: {
                type: "string",
                description: "Recipient email address (required)"
              },
              subject: {
                type: "string",
                description: "Email subject (required)"
              },
              body: {
                type: "string",
                description: "Email body (required)"
              },
              cc: {
                type: "string",
                description: "CC recipients"
              },
              bcc: {
                type: "string",
                description: "BCC recipients"
              }
            },
            required: ["to", "subject", "body"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "listDrafts",
          description: "List all email drafts. Use when user wants to see their saved drafts.",
          parameters: {
            type: "object",
            properties: {
              maxResults: {
                type: "number",
                description: "Maximum number of drafts to return (default: 20)"
              }
            },
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "updateDraft",
          description: "Update an existing draft. Use when user wants to modify or edit a saved draft.",
          parameters: {
            type: "object",
            properties: {
              draftId: {
                type: "string",
                description: "The ID of the draft to update (required)"
              },
              to: {
                type: "string",
                description: "New recipient email"
              },
              subject: {
                type: "string",
                description: "New subject"
              },
              body: {
                type: "string",
                description: "New body content"
              }
            },
            required: ["draftId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "deleteDraft",
          description: "Delete a draft. Use when user wants to discard or remove a saved draft.",
          parameters: {
            type: "object",
            properties: {
              draftId: {
                type: "string",
                description: "The ID of the draft to delete (required)"
              }
            },
            required: ["draftId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "sendDraft",
          description: "Send an existing draft. Use when user wants to send a saved draft.",
          parameters: {
            type: "object",
            properties: {
              draftId: {
                type: "string",
                description: "The ID of the draft to send (required)"
              }
            },
            required: ["draftId"]
          }
        }
      },

      // ========== LABEL MANAGEMENT ==========
      {
        type: "function",
        function: {
          name: "listLabels",
          description: "List all Gmail labels/folders. Use when user asks about labels, folders, or categories.",
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
          name: "createLabel",
          description: "Create a new Gmail label. Use when user wants to create a new label or folder.",
          parameters: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "The name of the new label (required)"
              },
              labelListVisibility: {
                type: "string",
                enum: ["labelShow", "labelShowIfUnread", "labelHide"],
                description: "Visibility in label list (default: labelShow)"
              },
              messageListVisibility: {
                type: "string",
                enum: ["show", "hide"],
                description: "Visibility in message list (default: show)"
              }
            },
            required: ["name"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "applyLabels",
          description: "Apply labels to an email. Use when user wants to label, tag, or categorize an email.",
          parameters: {
            type: "object",
            properties: {
              messageId: {
                type: "string",
                description: "The ID of the email (required)"
              },
              labelIds: {
                type: "array",
                items: { type: "string" },
                description: "Array of label IDs to apply (required)"
              }
            },
            required: ["messageId", "labelIds"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "removeLabels",
          description: "Remove labels from an email. Use when user wants to unlabel or remove tags from an email.",
          parameters: {
            type: "object",
            properties: {
              messageId: {
                type: "string",
                description: "The ID of the email (required)"
              },
              labelIds: {
                type: "array",
                items: { type: "string" },
                description: "Array of label IDs to remove (required)"
              }
            },
            required: ["messageId", "labelIds"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "deleteLabel",
          description: "Delete a Gmail label. Use when user wants to remove a label.",
          parameters: {
            type: "object",
            properties: {
              labelId: {
                type: "string",
                description: "The ID of the label to delete (required)"
              }
            },
            required: ["labelId"]
          }
        }
      },

      // ========== FILTER MANAGEMENT ==========
      {
        type: "function",
        function: {
          name: "listFilters",
          description: "List all email filters. Use when user asks about their email rules or filters.",
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
          name: "createFilter",
          description: "Create an email filter/rule. Use when user wants to set up automatic email sorting or actions.",
          parameters: {
            type: "object",
            properties: {
              criteria: {
                type: "object",
                description: "Filter matching criteria",
                properties: {
                  from: { type: "string", description: "Match emails from this address" },
                  to: { type: "string", description: "Match emails to this address" },
                  subject: { type: "string", description: "Match emails with this subject" },
                  query: { type: "string", description: "Gmail search query for matching" },
                  hasAttachment: { type: "boolean", description: "Match emails with attachments" }
                }
              },
              action: {
                type: "object",
                description: "Actions to perform on matching emails",
                properties: {
                  addLabelIds: { type: "array", items: { type: "string" }, description: "Labels to add" },
                  removeLabelIds: { type: "array", items: { type: "string" }, description: "Labels to remove" },
                  forward: { type: "string", description: "Email to forward to" },
                  markAsRead: { type: "boolean", description: "Mark as read" },
                  star: { type: "boolean", description: "Star the email" },
                  archive: { type: "boolean", description: "Archive the email" },
                  trash: { type: "boolean", description: "Move to trash" }
                }
              }
            },
            required: ["criteria", "action"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "deleteFilter",
          description: "Delete an email filter. Use when user wants to remove an email rule.",
          parameters: {
            type: "object",
            properties: {
              filterId: {
                type: "string",
                description: "The ID of the filter to delete (required)"
              }
            },
            required: ["filterId"]
          }
        }
      },

      // ========== EMAIL ACTIONS ==========
      {
        type: "function",
        function: {
          name: "markAsRead",
          description: "Mark an email as read. Use when user wants to mark emails as read.",
          parameters: {
            type: "object",
            properties: {
              messageId: {
                type: "string",
                description: "The ID of the email to mark as read (required)"
              }
            },
            required: ["messageId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "markAsUnread",
          description: "Mark an email as unread. Use when user wants to mark emails as unread.",
          parameters: {
            type: "object",
            properties: {
              messageId: {
                type: "string",
                description: "The ID of the email to mark as unread (required)"
              }
            },
            required: ["messageId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "starEmail",
          description: "Star/unstar an email. Use when user wants to star or mark an email as important.",
          parameters: {
            type: "object",
            properties: {
              messageId: {
                type: "string",
                description: "The ID of the email (required)"
              },
              starred: {
                type: "boolean",
                description: "Whether to star (true) or unstar (false) (default: true)"
              }
            },
            required: ["messageId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "trashEmail",
          description: "Move an email to trash. Use when user wants to delete or trash an email.",
          parameters: {
            type: "object",
            properties: {
              messageId: {
                type: "string",
                description: "The ID of the email to trash (required)"
              }
            },
            required: ["messageId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "archiveEmail",
          description: "Archive an email (remove from inbox). Use when user wants to archive an email.",
          parameters: {
            type: "object",
            properties: {
              messageId: {
                type: "string",
                description: "The ID of the email to archive (required)"
              }
            },
            required: ["messageId"]
          }
        }
      }
    ];
  }

  /**
   * Create mapping between function names and their implementations
   */
  createFunctionMap() {
    return {
      // Email Sending
      'sendEmail': gmailService.sendEmailForAgent,
      'replyToEmail': gmailService.replyToEmail,
      'forwardEmail': gmailService.forwardEmail,
      
      // Email Reading
      'readEmail': gmailService.readEmail,
      'getLatestEmails': gmailService.getLatestEmails,
      'getUnreadEmails': gmailService.getUnreadEmails,
      
      // Email Search
      'searchEmails': gmailService.searchEmails,
      'getEmailsByThread': gmailService.getEmailsByThread,
      'getEmailsBySender': gmailService.getEmailsBySender,
      
      // Draft Management
      'createDraft': gmailService.createDraft,
      'listDrafts': gmailService.listDrafts,
      'updateDraft': gmailService.updateDraft,
      'deleteDraft': gmailService.deleteDraft,
      'sendDraft': gmailService.sendDraft,
      
      // Label Management
      'listLabels': gmailService.listLabels,
      'createLabel': gmailService.createLabel,
      'applyLabels': gmailService.applyLabels,
      'removeLabels': gmailService.removeLabels,
      'deleteLabel': gmailService.deleteLabel,
      
      // Filter Management
      'listFilters': gmailService.listFilters,
      'createFilter': gmailService.createFilter,
      'deleteFilter': gmailService.deleteFilter,
      
      // Email Actions
      'markAsRead': gmailService.markAsRead,
      'markAsUnread': gmailService.markAsUnread,
      'starEmail': gmailService.starEmail,
      'trashEmail': gmailService.trashEmail,
      'archiveEmail': gmailService.archiveEmail
    };
  }

  /**
   * Create system prompt that defines the agent's behavior
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
    
    return `You are a helpful Gmail AI Assistant that helps users interact with their Gmail through natural language queries.

**IMPORTANT - Current date is ${currentDateStr}**. Use this as reference for any date-related queries.

Your capabilities include:
- **Sending Emails**: Compose and send new emails, reply to existing emails, forward emails
- **Reading Emails**: Read specific emails, get latest/unread emails
- **Searching Emails**: Search by sender, subject, date, keywords, attachments
- **Draft Management**: Create, list, update, delete, and send drafts
- **Label Management**: List, create, apply, remove, and delete labels
- **Filter Management**: Create, list, and delete email filters/rules
- **Email Actions**: Mark as read/unread, star, trash, archive emails

**PROFESSIONAL EMAIL WRITING GUIDELINES (CRITICAL):**
When composing ANY email, you MUST follow this professional format:

1. **Subject Line**: NEVER use just a filename or single word. Create descriptive, professional subjects:
   - BAD: "students" or "Document" or "File"
   - GOOD: "Sharing Excel Workbook: Student Records" or "Document Shared: [Filename]" or "Action Required: Review Attached Document"
   - Include context: what it is + why you're sending it

2. **Email Body Structure** - Use this EXACT format:
   """
   Hi [Recipient First Name],

   I hope this message finds you well.

   [Main purpose paragraph - 2-3 sentences explaining why you're writing]

   [Details paragraph - key information, links, or action items]
   📎 Document Link: [URL]

   [Call to action - what you want them to do next]

   Please feel free to reach out if you have any questions.

   Best regards,
   [SENDER'S ACTUAL NAME FROM ACCOUNT]
   """

3. **NEVER use placeholders** like "[Your Name]" - always use the actual sender's name
4. **Professional tone**: Warm but business-appropriate
5. **Clear formatting**: Use line breaks between paragraphs
6. **Meaningful content**: Explain the purpose, don't just dump a link

**RESPONSE FORMATTING GUIDELINES:**
1. Always respond in a professional, conversational, and friendly tone
2. Use proper formatting with emojis for better readability:
   - ✅ for successful operations
   - 📧 for email-related actions
   - 📨 for sent emails
   - 📬 for received/read emails
   - 📝 for drafts
   - 🏷️ for labels
   - 🔍 for search results
   - ⚠️ for warnings or limitations
   - ❓ for questions to user
3. When showing emails, format them clearly with:
   - **From**: sender
   - **Subject**: subject line
   - **Date**: when received
   - **Preview**: first few lines of content
4. After successful operations, ask if the user needs anything else
5. Keep responses concise but informative

**Gmail Search Syntax (for searchEmails tool):**
- from:email@example.com - emails from specific sender
- to:email@example.com - emails to specific recipient
- subject:keyword - emails with keyword in subject
- has:attachment - emails with attachments
- is:unread - unread emails
- is:starred - starred emails
- after:2024/01/01 - emails after date
- before:2024/12/31 - emails before date
- larger:10M - emails larger than 10MB
- label:labelname - emails with specific label

**Guidelines:**
1. Always be helpful, friendly, and provide clear, concise responses
2. When composing emails, use professional and appropriate language
3. When searching, help users construct proper search queries
4. For sensitive operations (delete, trash), confirm with the user
5. Provide email IDs when relevant for follow-up actions
6. When listing emails, show key details: sender, subject, date, snippet
7. Handle errors gracefully and provide helpful suggestions
8. Be proactive in suggesting next steps

**IMPORTANT REMINDERS:**
- Always include message IDs in your responses so users can reference them
- When forwarding or replying, confirm the action was successful
- For draft operations, let users know they can send the draft when ready
- When creating filters, explain what the filter will do

**Example Responses:**

Sending Email:
"✅ Email sent successfully!

📨 **To**: john@example.com
**Subject**: Meeting Tomorrow
**Message ID**: abc123

Would you like me to do anything else?"

Listing Emails:
"📬 Here are your 5 latest emails:

1. **From**: boss@company.com
   **Subject**: Project Update
   **Date**: Dec 2, 2024
   **ID**: msg123

2. **From**: newsletter@tech.com
   **Subject**: Weekly Tech News
   **Date**: Dec 1, 2024
   **ID**: msg124

Would you like to read any of these?"

Remember: You have full access to Gmail operations. Help users manage their emails efficiently!`;
  }

  /**
   * Main method to process user queries
   * 
   * @param {string} query - Natural language query from the user
   * @param {string} userId - User ID for authentication
   * @param {Object} options - Additional options (conversationHistory, forceToolExecution)
   * @returns {Promise<Object>} Processed response with Gmail data
   */
  async processQuery(query, userId, options = {}) {
    try {
      console.log(`[GmailAgent] Processing query: "${query}" for user: ${userId}`);

      // If forceToolExecution is set, directly execute the tool without LLM
      if (options.forceToolExecution && options.forceToolExecution.toolName && options.forceToolExecution.params) {
        const toolName = options.forceToolExecution.toolName;
        let params = { ...options.forceToolExecution.params };
        
        // Special handling for sendEmail
        if (toolName === 'sendEmail') {
          // Check if email content was already AI-generated during confirmation preview
          if (params.isAIGenerated) {
            console.log(`[GmailAgent] Using pre-generated AI email content (matches preview)`);
            // Remove the flag before sending - it's not needed by the API
            delete params.isAIGenerated;
            delete params.userName;
          } else {
            // Only regenerate if not already AI-generated (legacy path or fallback)
            console.log(`[GmailAgent] Generating professional email content with AI...`);
            
            // Extract recipient's first name for personalized greeting
            const recipientEmail = params.to;
            const recipientName = recipientEmail.split('@')[0].split('.')[0];
            const capitalizedRecipient = recipientName.charAt(0).toUpperCase() + recipientName.slice(1);
            
            const generationResponse = await this.openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages: [
                {
                  role: "system",
                  content: `You are a professional email writing assistant. Generate polished, well-structured emails.

REQUIRED FORMAT:
1. Personalized greeting: "Hi [First Name]," (use the recipient's first name provided)
2. Opening line: "I hope this message finds you well." or similar
3. Main purpose paragraph (2-3 sentences explaining why you're writing)
4. Details or action items (if applicable)
5. Closing line: "Please feel free to reach out if you have any questions."
6. Professional sign-off: "Best regards," followed by sender name

CRITICAL RULES:
- NEVER use placeholders like "[Your Name]"
- Use proper line breaks between paragraphs
- Be warm but professional
- Keep it concise but complete

Only output the email body text. Do not include "Subject:" line.`
                },
                {
                  role: "user",
                  content: `Write a professional email:
To: ${params.to}
Recipient Name: ${capitalizedRecipient}
Subject: ${params.subject}
Purpose/Context: ${params.body || query}
Sender's Name: ${params.userName || 'Best regards'}

Write a complete, professional email that looks like it was written by a real person.`
                }
              ],
              max_tokens: 600,
              temperature: 0.7
            });
            
            params.body = generationResponse.choices[0].message.content;
            
            // Also generate a better subject if it's generic
            if (params.subject === 'New Message' || params.subject === 'Meeting' || !params.subject || params.subject.length < 5) {
              const subjectResponse = await this.openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                  {
                    role: "system",
                    content: "Generate a professional, descriptive email subject line (max 60 chars). NEVER use just a filename or single word. Include context about the purpose. Only output the subject text, nothing else."
                  },
                  {
                    role: "user",
                    content: `Generate a professional subject line for this email context: ${params.body || query}`
                  }
                ],
                max_tokens: 60,
                temperature: 0.7
              });
              params.subject = subjectResponse.choices[0].message.content.replace(/^["']|["']$/g, '').trim();
            }
            
            console.log(`[GmailAgent] Generated subject: ${params.subject}`);
            console.log(`[GmailAgent] Generated body preview: ${params.body.substring(0, 100)}...`);
          }
        }
        
        console.log(`[GmailAgent] Force executing tool: ${toolName}`);
        console.log(`[GmailAgent] With params:`, JSON.stringify(params, null, 2));
        
        const functionToCall = this.functionMap[toolName];
        if (!functionToCall) {
          throw new Error(`Unknown function: ${toolName}`);
        }

        const result = await functionToCall(userId, params);
        
        let responseText = result.success ? `Successfully executed ${toolName}` : result.error;
        if (toolName === 'sendEmail' && result.success) {
          responseText = `Your email has been sent successfully to ${params.to}!`;
        }
        
        return {
          success: true,
          response: responseText,
          query: query,
          tools_used: [{
            name: toolName,
            arguments: params
          }],
          raw_results: [result],
          timestamp: new Date().toISOString()
        };
      }

      // Build messages array with conversation history if provided
      const messages = [
        {
          role: "system",
          content: this.systemPrompt
        }
      ];

      // Add conversation history if provided (for context continuity)
      if (options.conversationHistory && Array.isArray(options.conversationHistory)) {
        messages.push(...options.conversationHistory);
      }

      // Add current query
      messages.push({
        role: "user",
        content: query
      });

      // Call OpenAI with function calling enabled
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messages,
        tools: this.tools,
        tool_choice: "auto",
        max_tokens: 2000,
        temperature: 0.3
      });

      const message = response.choices[0].message;

      // Check if OpenAI wants to call any functions
      if (message.tool_calls && message.tool_calls.length > 0) {
        return await this.handleToolCalls(message.tool_calls, userId, query, messages);
      } else {
        // No tools needed, return direct response
        return {
          success: true,
          response: message.content,
          query: query,
          tools_used: [],
          timestamp: new Date().toISOString()
        };
      }

    } catch (error) {
      console.error('[GmailAgent] Error processing query:', error);
      return this.handleError(error, query);
    }
  }

  /**
   * Execute tool calls requested by OpenAI
   */
  async handleToolCalls(toolCalls, userId, originalQuery, conversationHistory) {
    try {
      console.log(`[GmailAgent] Executing ${toolCalls.length} tool call(s)`);

      const toolResults = [];
      const toolsUsed = [];

      // Execute each tool call
      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        console.log(`[GmailAgent] Calling function: ${functionName}`, functionArgs);

        toolsUsed.push({
          name: functionName,
          arguments: functionArgs
        });

        // Get the function from our map
        const functionToCall = this.functionMap[functionName];

        if (!functionToCall) {
          throw new Error(`Function ${functionName} not found`);
        }

        // Call the function with userId as first parameter
        let result;
        try {
          result = await functionToCall(userId, functionArgs);
        } catch (funcError) {
          console.error(`[GmailAgent] Error in ${functionName}:`, funcError);
          result = { error: funcError.message };
        }

        toolResults.push({
          tool_call_id: toolCall.id,
          role: "tool",
          name: functionName,
          content: JSON.stringify(result)
        });
      }

      // Send tool results back to OpenAI for final response
      const finalMessages = [
        ...conversationHistory,
        {
          role: "assistant",
          content: null,
          tool_calls: toolCalls
        },
        ...toolResults
      ];

      const finalResponse = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: finalMessages,
        max_tokens: 2000,
        temperature: 0.3
      });

      return {
        success: true,
        response: finalResponse.choices[0].message.content,
        query: originalQuery,
        tools_used: toolsUsed,
        raw_results: toolResults.map(r => JSON.parse(r.content)),
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('[GmailAgent] Error handling tool calls:', error);
      return this.handleError(error, originalQuery);
    }
  }

  /**
   * Handle errors gracefully
   */
  handleError(error, query) {
    const errorMessage = error.message || 'An unknown error occurred';
    
    let userFriendlyMessage = 'I encountered an error while processing your request. ';
    
    if (errorMessage.includes('tokens not found') || errorMessage.includes('User tokens not found')) {
      userFriendlyMessage += 'Please make sure you have connected your Gmail account.';
    } else if (errorMessage.includes('not found') || errorMessage.includes('404')) {
      userFriendlyMessage += 'The email or resource you requested could not be found.';
    } else if (errorMessage.includes('permission') || errorMessage.includes('403')) {
      userFriendlyMessage += 'You do not have permission to perform this action.';
    } else if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      userFriendlyMessage += 'Too many requests. Please try again in a moment.';
    } else if (errorMessage.includes('invalid') || errorMessage.includes('400')) {
      userFriendlyMessage += 'Invalid request. Please check your input and try again.';
    } else {
      userFriendlyMessage += 'Please try again.';
    }

    return {
      success: false,
      response: userFriendlyMessage,
      query: query,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = GmailAgent;
