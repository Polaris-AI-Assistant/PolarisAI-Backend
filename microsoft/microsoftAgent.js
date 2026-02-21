/**
 * Microsoft 365 AI Agent using OpenAI
 * 
 * This agent provides intelligent interaction with Microsoft 365 apps using natural language.
 * It dynamically selects and executes appropriate Microsoft Graph API functions based on user intent.
 * 
 * Features:
 * - Natural language query processing
 * - Dynamic tool selection based on user intent
 * - Outlook email operations (send, read, reply, forward)
 * - Calendar operations (create, list, update events)
 * - OneDrive operations (list, upload, download files)
 * - Excel operations (read, write worksheets)
 * - Multi-tool query support
 * - Comprehensive error handling
 * 
 * Usage:
 * const agent = new MicrosoftAgent();
 * const result = await agent.processQuery("send an email to john@example.com", userId);
 */

const OpenAI = require('openai');
const microsoftService = require('./microsoftService');

class MicrosoftAgent {
  constructor() {
    // Initialize OpenAI client
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Define available tools
    this.tools = this.defineTools();
    
    // Map function names to implementations
    this.functionMap = this.createFunctionMap();

    // System prompt
    this.systemPrompt = this.createSystemPrompt();
  }

  /**
   * Define OpenAI function schemas for Microsoft 365 tools
   */
  defineTools() {
    return [
      // ========== OUTLOOK MAIL ==========
      {
        type: "function",
        function: {
          name: "microsoft_listEmails",
          description: "List emails from Outlook inbox. Use when user wants to see their Microsoft/Outlook emails or check inbox.",
          parameters: {
            type: "object",
            properties: {
              folder: {
                type: "string",
                description: "Email folder (inbox, sentitems, drafts, deleteditems)",
                default: "inbox"
              },
              top: {
                type: "number",
                description: "Number of emails to retrieve (default: 20)",
                default: 20
              },
              search: {
                type: "string",
                description: "Search query to filter emails"
              }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "microsoft_sendEmail",
          description: "Send an email via Outlook/Microsoft. Use when user wants to send, compose, or write an email using Microsoft/Outlook.",
          parameters: {
            type: "object",
            properties: {
              to: {
                type: "string",
                description: "Recipient email address(es), comma-separated for multiple"
              },
              subject: {
                type: "string",
                description: "Email subject line"
              },
              body: {
                type: "string",
                description: "Email body content"
              },
              cc: {
                type: "string",
                description: "CC recipients (comma-separated)"
              },
              bcc: {
                type: "string",
                description: "BCC recipients (comma-separated)"
              },
              isHtml: {
                type: "boolean",
                description: "Whether body is HTML (default: true)",
                default: true
              }
            },
            required: ["to", "subject", "body"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "microsoft_replyToEmail",
          description: "Reply to an Outlook email. Use when user wants to respond to a Microsoft/Outlook email.",
          parameters: {
            type: "object",
            properties: {
              messageId: {
                type: "string",
                description: "The ID of the email to reply to"
              },
              comment: {
                type: "string",
                description: "Reply body content"
              }
            },
            required: ["messageId", "comment"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "microsoft_forwardEmail",
          description: "Forward an Outlook email. Use when user wants to forward a Microsoft email.",
          parameters: {
            type: "object",
            properties: {
              messageId: {
                type: "string",
                description: "The ID of the email to forward"
              },
              toRecipients: {
                type: "array",
                items: { type: "string" },
                description: "Email addresses to forward to"
              },
              comment: {
                type: "string",
                description: "Optional comment to add"
              }
            },
            required: ["messageId", "toRecipients"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "microsoft_getEmail",
          description: "Get details of a specific Outlook email. Use when user wants to read full content of an email.",
          parameters: {
            type: "object",
            properties: {
              messageId: {
                type: "string",
                description: "The ID of the email to retrieve"
              }
            },
            required: ["messageId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "microsoft_markAsRead",
          description: "Mark an Outlook email as read. Use when user wants to mark an email as read.",
          parameters: {
            type: "object",
            properties: {
              messageId: {
                type: "string",
                description: "The ID of the email to mark as read"
              }
            },
            required: ["messageId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "microsoft_markAsUnread",
          description: "Mark an Outlook email as unread. Use when user wants to mark an email as unread.",
          parameters: {
            type: "object",
            properties: {
              messageId: {
                type: "string",
                description: "The ID of the email to mark as unread"
              }
            },
            required: ["messageId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "microsoft_listMailFolders",
          description: "List all mail folders in Outlook. Use when user wants to see their email folders.",
          parameters: {
            type: "object",
            properties: {}
          }
        }
      },
      {
        type: "function",
        function: {
          name: "microsoft_deleteEmail",
          description: "Delete an Outlook email. Use when user wants to delete an email.",
          parameters: {
            type: "object",
            properties: {
              messageId: {
                type: "string",
                description: "The ID of the email to delete"
              }
            },
            required: ["messageId"]
          }
        }
      },

      // ========== CALENDAR ==========
      {
        type: "function",
        function: {
          name: "microsoft_listCalendarEvents",
          description: "List events from Microsoft/Outlook Calendar. Use when user asks about their Microsoft calendar, schedule, or meetings.",
          parameters: {
            type: "object",
            properties: {
              startDateTime: {
                type: "string",
                description: "Start of time range in ISO 8601 format"
              },
              endDateTime: {
                type: "string",
                description: "End of time range in ISO 8601 format"
              },
              top: {
                type: "number",
                description: "Maximum number of events to return",
                default: 20
              }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "microsoft_createCalendarEvent",
          description: "Create a new event in Microsoft/Outlook Calendar. Use when user wants to schedule a meeting or event in Microsoft Calendar.",
          parameters: {
            type: "object",
            properties: {
              subject: {
                type: "string",
                description: "Title of the event"
              },
              body: {
                type: "string",
                description: "Event description"
              },
              start: {
                type: "string",
                description: "Start date/time in ISO 8601 format (e.g., '2025-01-20T10:00:00')"
              },
              end: {
                type: "string",
                description: "End date/time in ISO 8601 format"
              },
              timeZone: {
                type: "string",
                description: "Time zone (e.g., 'UTC', 'America/New_York')",
                default: "UTC"
              },
              location: {
                type: "string",
                description: "Event location"
              },
              attendees: {
                type: "array",
                items: { type: "string" },
                description: "Email addresses of attendees"
              },
              isOnlineMeeting: {
                type: "boolean",
                description: "Whether to create Teams meeting",
                default: false
              }
            },
            required: ["subject", "start", "end"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "microsoft_updateCalendarEvent",
          description: "Update an existing Microsoft Calendar event. Use when user wants to modify a meeting or event.",
          parameters: {
            type: "object",
            properties: {
              eventId: {
                type: "string",
                description: "The ID of the event to update"
              },
              subject: {
                type: "string",
                description: "New title (optional)"
              },
              start: {
                type: "string",
                description: "New start time in ISO 8601"
              },
              end: {
                type: "string",
                description: "New end time in ISO 8601"
              },
              location: {
                type: "string",
                description: "New location"
              }
            },
            required: ["eventId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "microsoft_deleteCalendarEvent",
          description: "Delete a Microsoft Calendar event. Use when user wants to cancel or remove a meeting.",
          parameters: {
            type: "object",
            properties: {
              eventId: {
                type: "string",
                description: "The ID of the event to delete"
              }
            },
            required: ["eventId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "microsoft_listCalendars",
          description: "List all calendars in the user's Microsoft account. Use when user wants to see their calendars.",
          parameters: {
            type: "object",
            properties: {}
          }
        }
      },

      // ========== ONEDRIVE ==========
      {
        type: "function",
        function: {
          name: "microsoft_listFiles",
          description: "List files and folders in OneDrive. Use when user wants to see their Microsoft OneDrive files.",
          parameters: {
            type: "object",
            properties: {
              folderId: {
                type: "string",
                description: "Folder ID to list (default: root)",
                default: "root"
              },
              top: {
                type: "number",
                description: "Number of items to return",
                default: 50
              }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "microsoft_searchFiles",
          description: "Search for files in OneDrive. Use when user wants to find a specific file.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search query"
              }
            },
            required: ["query"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "microsoft_downloadFile",
          description: "Download a file from OneDrive. Returns file content for small files.",
          parameters: {
            type: "object",
            properties: {
              itemId: {
                type: "string",
                description: "The ID of the file to download"
              }
            },
            required: ["itemId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "microsoft_getFileContent",
          description: "Read and get the content of a file from OneDrive. Use when user wants to read, view, or see the contents of a file. Works with text files (txt, json, md, csv) and provides preview links for Office documents (docx, xlsx, pptx).",
          parameters: {
            type: "object",
            properties: {
              fileName: {
                type: "string",
                description: "The name of the file to read (e.g., 'Document.docx', 'notes.txt')"
              }
            },
            required: ["fileName"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "microsoft_uploadFile",
          description: "Upload a file to OneDrive. Use when user wants to save a file to OneDrive.",
          parameters: {
            type: "object",
            properties: {
              fileName: {
                type: "string",
                description: "Name for the uploaded file"
              },
              content: {
                type: "string",
                description: "File content (text or base64)"
              },
              parentFolderId: {
                type: "string",
                description: "Parent folder ID (default: root)",
                default: "root"
              }
            },
            required: ["fileName", "content"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "microsoft_createFolder",
          description: "Create a new folder in OneDrive. Use when user wants to create a folder.",
          parameters: {
            type: "object",
            properties: {
              folderName: {
                type: "string",
                description: "Name of the folder to create"
              },
              parentFolderId: {
                type: "string",
                description: "Parent folder ID (default: root)",
                default: "root"
              }
            },
            required: ["folderName"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "microsoft_deleteFile",
          description: "Delete a file or folder from OneDrive. Use when user wants to delete a file or folder.",
          parameters: {
            type: "object",
            properties: {
              itemId: {
                type: "string",
                description: "The ID of the file or folder to delete"
              }
            },
            required: ["itemId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "microsoft_getFileInfo",
          description: "Get metadata and information about a file in OneDrive. Use when user wants to know details about a file.",
          parameters: {
            type: "object",
            properties: {
              fileId: {
                type: "string",
                description: "The ID of the file to get information about"
              }
            },
            required: ["fileId"]
          }
        }
      },

      // ========== EXCEL ==========
      {
        type: "function",
        function: {
          name: "microsoft_listWorksheets",
          description: "List worksheets in an Excel workbook stored in OneDrive. Use when user wants to see sheets in an Excel file.",
          parameters: {
            type: "object",
            properties: {
              workbookId: {
                type: "string",
                description: "The OneDrive file ID of the Excel workbook"
              }
            },
            required: ["workbookId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "microsoft_getWorksheetData",
          description: "Get data from an Excel worksheet. Use when user wants to read Excel data.",
          parameters: {
            type: "object",
            properties: {
              workbookId: {
                type: "string",
                description: "The OneDrive file ID of the Excel workbook"
              },
              worksheetName: {
                type: "string",
                description: "Name of the worksheet"
              },
              range: {
                type: "string",
                description: "Range to read (e.g., 'A1:C10'). If not specified, reads used range."
              }
            },
            required: ["workbookId", "worksheetName"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "microsoft_updateExcel",
          description: "Update data in an Excel worksheet. Use when user wants to write to Excel.",
          parameters: {
            type: "object",
            properties: {
              workbookId: {
                type: "string",
                description: "The OneDrive file ID of the Excel workbook"
              },
              worksheetName: {
                type: "string",
                description: "Name of the worksheet"
              },
              range: {
                type: "string",
                description: "Range to update (e.g., 'A1:C3')"
              },
              values: {
                type: "array",
                items: {
                  type: "array",
                  items: { type: "string" }
                },
                description: "2D array of values to write"
              }
            },
            required: ["workbookId", "worksheetName", "range", "values"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "microsoft_createExcelWorkbook",
          description: "Create a new Excel workbook in OneDrive. Use when user wants to create a new Excel spreadsheet or workbook. IMPORTANT: If user asks to add sample data, data, or content to the workbook, set addSampleData to true.",
          parameters: {
            type: "object",
            properties: {
              fileName: {
                type: "string",
                description: "Name for the Excel workbook (without .xlsx extension)"
              },
              parentFolderId: {
                type: "string",
                description: "Parent folder ID (default: root)",
                default: "root"
              },
              addSampleData: {
                type: "boolean",
                description: "Set to true if user wants to add sample data, default data, or any data to the workbook. ALWAYS set to true when user mentions 'add sample data', 'add data', 'with sample data', 'with data', etc.",
                default: false
              },
              sampleDataContext: {
                type: "string",
                description: "Context for the sample data to generate. Use the workbook name/purpose to generate relevant data. For example, if fileName is 'students', generate student-related data like name, roll number, marks, etc."
              }
            },
            required: ["fileName"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "microsoft_addWorksheet",
          description: "Add a new worksheet to an existing Excel workbook. Use when user wants to create a new sheet in an Excel file.",
          parameters: {
            type: "object",
            properties: {
              workbookId: {
                type: "string",
                description: "The OneDrive file ID of the Excel workbook"
              },
              sheetName: {
                type: "string",
                description: "Name for the new worksheet"
              }
            },
            required: ["workbookId", "sheetName"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "microsoft_deleteWorksheet",
          description: "Delete a worksheet from an Excel workbook. Use when user wants to remove a sheet from an Excel file.",
          parameters: {
            type: "object",
            properties: {
              workbookId: {
                type: "string",
                description: "The OneDrive file ID of the Excel workbook"
              },
              worksheetName: {
                type: "string",
                description: "Name of the worksheet to delete"
              }
            },
            required: ["workbookId", "worksheetName"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "microsoft_appendRow",
          description: "Append a row of data to an Excel worksheet. Use when user wants to add a new row to an Excel sheet.",
          parameters: {
            type: "object",
            properties: {
              workbookId: {
                type: "string",
                description: "The OneDrive file ID of the Excel workbook"
              },
              worksheetName: {
                type: "string",
                description: "Name of the worksheet"
              },
              values: {
                type: "array",
                items: { type: "string" },
                description: "Array of values for the new row"
              }
            },
            required: ["workbookId", "worksheetName", "values"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "microsoft_formatRange",
          description: "Format cells in an Excel worksheet (bold, italic, colors, font size). Use when user wants to style Excel cells.",
          parameters: {
            type: "object",
            properties: {
              workbookId: {
                type: "string",
                description: "The OneDrive file ID of the Excel workbook"
              },
              worksheetName: {
                type: "string",
                description: "Name of the worksheet"
              },
              range: {
                type: "string",
                description: "Range to format (e.g., 'A1:C1')"
              },
              bold: {
                type: "boolean",
                description: "Make text bold"
              },
              italic: {
                type: "boolean",
                description: "Make text italic"
              },
              fontSize: {
                type: "number",
                description: "Font size in points"
              },
              color: {
                type: "string",
                description: "Font color (hex code, e.g., '#FF0000')"
              },
              backgroundColor: {
                type: "string",
                description: "Cell background color (hex code)"
              }
            },
            required: ["workbookId", "worksheetName", "range"]
          }
        }
      },

      // ========== USER PROFILE ==========
      {
        type: "function",
        function: {
          name: "microsoft_getUserProfile",
          description: "Get user's Microsoft 365 profile information. Use when user asks about their Microsoft account.",
          parameters: {
            type: "object",
            properties: {}
          }
        }
      },

      // ========== TEAMS ==========
      {
        type: "function",
        function: {
          name: "microsoft_listTeams",
          description: "List Microsoft Teams the user is a member of. Use when user wants to see their teams.",
          parameters: {
            type: "object",
            properties: {}
          }
        }
      },
      {
        type: "function",
        function: {
          name: "microsoft_listChannels",
          description: "List channels in a Microsoft Team. Use when user wants to see channels in a team.",
          parameters: {
            type: "object",
            properties: {
              teamId: {
                type: "string",
                description: "The ID of the team"
              }
            },
            required: ["teamId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "microsoft_listChats",
          description: "List user's Microsoft Teams chats. Use when user wants to see their Teams chats or conversations.",
          parameters: {
            type: "object",
            properties: {
              top: {
                type: "number",
                description: "Maximum number of chats to retrieve (default: 50)",
                default: 50
              }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "microsoft_listChannelMessages",
          description: "List messages in a Microsoft Teams channel. Use when user wants to see channel messages.",
          parameters: {
            type: "object",
            properties: {
              teamId: {
                type: "string",
                description: "The ID of the team"
              },
              channelId: {
                type: "string",
                description: "The ID of the channel"
              },
              top: {
                type: "number",
                description: "Maximum number of messages to retrieve (default: 50)",
                default: 50
              }
            },
            required: ["teamId", "channelId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "microsoft_listChatMessages",
          description: "List messages in a Microsoft Teams chat. Use when user wants to see chat messages.",
          parameters: {
            type: "object",
            properties: {
              chatId: {
                type: "string",
                description: "The ID of the chat"
              },
              top: {
                type: "number",
                description: "Maximum number of messages to retrieve (default: 50)",
                default: 50
              }
            },
            required: ["chatId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "microsoft_sendChatMessage",
          description: "Send a message in a Microsoft Teams chat. Use when user wants to send a Teams chat message.",
          parameters: {
            type: "object",
            properties: {
              chatId: {
                type: "string",
                description: "The ID of the chat"
              },
              content: {
                type: "string",
                description: "Message content (HTML supported)"
              }
            },
            required: ["chatId", "content"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "microsoft_sendChannelMessage",
          description: "Send a message in a Microsoft Teams channel. Use when user wants to post a message in a Teams channel.",
          parameters: {
            type: "object",
            properties: {
              teamId: {
                type: "string",
                description: "The ID of the team"
              },
              channelId: {
                type: "string",
                description: "The ID of the channel"
              },
              content: {
                type: "string",
                description: "Message content (HTML supported)"
              }
            },
            required: ["teamId", "channelId", "content"]
          }
        }
      },

      // ========== WORD ==========
      {
        type: "function",
        function: {
          name: "microsoft_listWordFiles",
          description: "List Word documents in OneDrive. Use when user wants to see their Word documents or .docx files.",
          parameters: {
            type: "object",
            properties: {
              top: {
                type: "number",
                description: "Maximum number of files to retrieve (default: 50)",
                default: 50
              }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "microsoft_getWordDocumentContent",
          description: "Get information and content of a Word document. Use when user wants to read or view a Word document.",
          parameters: {
            type: "object",
            properties: {
              itemId: {
                type: "string",
                description: "The OneDrive file ID of the Word document"
              }
            },
            required: ["itemId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "microsoft_downloadWordDocument",
          description: "Download a Word document from OneDrive. Use when user wants to download a Word file.",
          parameters: {
            type: "object",
            properties: {
              itemId: {
                type: "string",
                description: "The OneDrive file ID of the Word document"
              }
            },
            required: ["itemId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "microsoft_createWordDocument",
          description: "Create a new Word document in OneDrive with optional initial content. Use when user wants to create a new Word document or .docx file. Can include content at creation time.",
          parameters: {
            type: "object",
            properties: {
              fileName: {
                type: "string",
                description: "Name for the Word document (without .docx extension)"
              },
              content: {
                type: "string",
                description: "Optional initial content for the document (plain text or HTML). Include this when user specifies what content to put in the new document."
              },
              parentFolderId: {
                type: "string",
                description: "Parent folder ID (default: root)",
                default: "root"
              }
            },
            required: ["fileName"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "microsoft_updateWordDocument",
          description: "Update a Word document by uploading new content. Use when user wants to replace/update a Word document's content.",
          parameters: {
            type: "object",
            properties: {
              itemId: {
                type: "string",
                description: "The OneDrive file ID of the Word document"
              },
              content: {
                type: "string",
                description: "New document content"
              }
            },
            required: ["itemId", "content"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "microsoft_addContentToWordDocument",
          description: "Add content to an existing Word document. IMPORTANT: If you have the documentId from a recent document creation, always provide it to avoid search delays. Otherwise, the document will be found by name.",
          parameters: {
            type: "object",
            properties: {
              documentId: {
                type: "string",
                description: "The document ID (if known from a previous creation operation). When provided, this is used directly without searching."
              },
              fileName: {
                type: "string",
                description: "The name or title of the Word document to find and update (used only if documentId is not provided)"
              },
              content: {
                type: "string",
                description: "The content to add to the document (will replace existing content)"
              }
            },
            required: ["content"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "microsoft_searchWordDocument",
          description: "Search for a Word document by name. Use to find a specific Word document in OneDrive.",
          parameters: {
            type: "object",
            properties: {
              fileName: {
                type: "string",
                description: "The name or title of the Word document to search for"
              }
            },
            required: ["fileName"]
          }
        }
      }
    ];
  }

  /**
   * Create mapping of function names to implementations
   */
  createFunctionMap() {
    return {
      // Outlook
      microsoft_listEmails: async (params, userId) => {
        return await microsoftService.listEmails(userId, params);
      },
      microsoft_sendEmail: async (params, userId) => {
        return await microsoftService.sendEmail(userId, params);
      },
      microsoft_replyToEmail: async (params, userId) => {
        return await microsoftService.replyToEmail(userId, params.messageId, params.comment);
      },
      microsoft_forwardEmail: async (params, userId) => {
        return await microsoftService.forwardEmail(userId, params.messageId, params.toRecipients, params.comment);
      },
      microsoft_getEmail: async (params, userId) => {
        return await microsoftService.getEmail(userId, params.messageId);
      },
      microsoft_markAsRead: async (params, userId) => {
        return await microsoftService.markEmailRead(userId, params.messageId, true);
      },
      microsoft_markAsUnread: async (params, userId) => {
        return await microsoftService.markEmailUnread(userId, params.messageId);
      },
      microsoft_listMailFolders: async (params, userId) => {
        return await microsoftService.listMailFolders(userId);
      },
      microsoft_deleteEmail: async (params, userId) => {
        return await microsoftService.deleteEmail(userId, params.messageId);
      },

      // Calendar
      microsoft_listCalendarEvents: async (params, userId) => {
        return await microsoftService.listCalendarEvents(userId, params);
      },
      microsoft_createCalendarEvent: async (params, userId) => {
        return await microsoftService.createCalendarEvent(userId, params);
      },
      microsoft_updateCalendarEvent: async (params, userId) => {
        const { eventId, ...updates } = params;
        return await microsoftService.updateCalendarEvent(userId, eventId, updates);
      },
      microsoft_deleteCalendarEvent: async (params, userId) => {
        return await microsoftService.deleteCalendarEvent(userId, params.eventId);
      },
      microsoft_listCalendars: async (params, userId) => {
        return await microsoftService.listCalendars(userId);
      },

      // OneDrive
      microsoft_listFiles: async (params, userId) => {
        return await microsoftService.listFiles(userId, params);
      },
      microsoft_searchFiles: async (params, userId) => {
        return await microsoftService.searchFiles(userId, params.query);
      },
      microsoft_downloadFile: async (params, userId) => {
        const content = await microsoftService.downloadFile(userId, params.itemId);
        return { success: true, content: content.toString('base64'), encoding: 'base64' };
      },
      microsoft_getFileContent: async (params, userId) => {
        return await microsoftService.getFileContent(userId, params.fileName);
      },
      microsoft_uploadFile: async (params, userId) => {
        return await microsoftService.uploadFile(userId, params.fileName, params.content, params.parentFolderId);
      },
      microsoft_createFolder: async (params, userId) => {
        return await microsoftService.createFolder(userId, params.folderName, params.parentFolderId);
      },
      microsoft_deleteFile: async (params, userId) => {
        return await microsoftService.deleteFile(userId, params.itemId);
      },
      microsoft_getFileInfo: async (params, userId) => {
        return await microsoftService.getFileMetadata(userId, params.fileId);
      },

      // Excel
      microsoft_listWorksheets: async (params, userId) => {
        return await microsoftService.listWorksheets(userId, params.workbookId);
      },
      microsoft_getWorksheetData: async (params, userId) => {
        if (params.range) {
          return await microsoftService.getRange(userId, params.workbookId, params.worksheetName, params.range);
        }
        return await microsoftService.getWorksheetRange(userId, params.workbookId, params.worksheetName);
      },
      microsoft_updateExcel: async (params, userId) => {
        return await microsoftService.updateRange(userId, params.workbookId, params.worksheetName, params.range, params.values);
      },
      microsoft_createExcelWorkbook: async (params, userId) => {
        return await microsoftService.createExcelWorkbook(userId, params.fileName, params.parentFolderId || 'root');
      },
      microsoft_addWorksheet: async (params, userId) => {
        return await microsoftService.addWorksheet(userId, params.workbookId, params.sheetName);
      },
      microsoft_deleteWorksheet: async (params, userId) => {
        return await microsoftService.deleteWorksheet(userId, params.workbookId, params.worksheetName);
      },
      microsoft_appendRow: async (params, userId) => {
        return await microsoftService.appendRow(userId, params.workbookId, params.worksheetName, params.values);
      },
      microsoft_formatRange: async (params, userId) => {
        const { workbookId, worksheetName, range, ...format } = params;
        return await microsoftService.formatRange(userId, workbookId, worksheetName, range, format);
      },

      // Teams
      microsoft_listTeams: async (params, userId) => {
        return await microsoftService.listTeams(userId);
      },
      microsoft_listChannels: async (params, userId) => {
        return await microsoftService.listChannels(userId, params.teamId);
      },
      microsoft_listChats: async (params, userId) => {
        return await microsoftService.listChats(userId, params.top || 50);
      },
      microsoft_listChannelMessages: async (params, userId) => {
        return await microsoftService.listChannelMessages(userId, params.teamId, params.channelId, params.top || 50);
      },
      microsoft_listChatMessages: async (params, userId) => {
        return await microsoftService.listChatMessages(userId, params.chatId, params.top || 50);
      },
      microsoft_sendChatMessage: async (params, userId) => {
        return await microsoftService.sendChatMessage(userId, params.chatId, params.content);
      },
      microsoft_sendChannelMessage: async (params, userId) => {
        return await microsoftService.sendChannelMessage(userId, params.teamId, params.channelId, params.content);
      },

      // Word
      microsoft_listWordFiles: async (params, userId) => {
        return await microsoftService.listWordFiles(userId, { top: params.top || 50 });
      },
      microsoft_getWordDocumentContent: async (params, userId) => {
        return await microsoftService.getWordDocumentContent(userId, params.itemId);
      },
      microsoft_downloadWordDocument: async (params, userId) => {
        return await microsoftService.downloadWordDocument(userId, params.itemId);
      },
      microsoft_createWordDocument: async (params, userId) => {
        return await microsoftService.createWordDocument(userId, params.fileName, params.content || '', params.parentFolderId || 'root');
      },
      microsoft_updateWordDocument: async (params, userId) => {
        return await microsoftService.updateWordDocument(userId, params.itemId, params.content);
      },
      microsoft_addContentToWordDocument: async (params, userId) => {
        return await microsoftService.addContentToWordDocument(userId, params.fileName || '', params.content, params.documentId || null);
      },
      microsoft_searchWordDocument: async (params, userId) => {
        return await microsoftService.searchWordDocumentByName(userId, params.fileName);
      },

      // User
      microsoft_getUserProfile: async (params, userId) => {
        return await microsoftService.getUserProfile(userId);
      }
    };
  }

  /**
   * Create system prompt for the agent
   */
  createSystemPrompt() {
    const currentDate = new Date().toISOString().split('T')[0];
    
    return `You are a helpful Microsoft 365 assistant that can manage Outlook emails, Microsoft Calendar, OneDrive files, Excel workbooks, Microsoft Teams, and Word documents.

**CRITICAL LANGUAGE REQUIREMENT:**
- ALWAYS respond in the SAME LANGUAGE as the user's query
- If user writes in English, respond in English
- If user writes in Hindi, respond in Hindi
- If user writes in Spanish, respond in Spanish
- Match the user's language EXACTLY - do not translate or switch languages

Current date: ${currentDate}

Your capabilities include:
- Outlook: List, send, reply, forward, delete emails. Mark as read/unread. List mail folders.
- Calendar: List, create, update, and delete calendar events (with Teams meeting support). List calendars.
- OneDrive: List, search, upload, download, and delete files. Create folders. Get file info.
- Excel: Create new workbooks, add/delete worksheets, read/write data, append rows, format cells.
- Teams: List teams and channels, list and read chats, send messages to chats and channels.
- Word: List, create, search, and manage Word documents in OneDrive. Add content to existing documents.

When users ask about their Microsoft apps, select the appropriate tools to help them.
For calendar operations, always use proper ISO 8601 date formats.
For emails, be helpful in composing professional messages.
For file operations, guide users through finding and managing their files.
For Teams, help users navigate their teams, channels, and chats.
For Word documents, help users manage their Word files in OneDrive.

WORD DOCUMENT HANDLING:
- To create a new Word document (optionally with content), use microsoft_createWordDocument. Include the "content" parameter if user specifies initial content.
- CRITICAL: When adding content to a document that was just created, ALWAYS use the documentId returned from the creation response. This avoids search delays.
- If you created a document and received its documentId, pass that documentId to microsoft_addContentToWordDocument along with the content.
- To add content to an existing document, use microsoft_addContentToWordDocument with either:
  * documentId (preferred - works immediately) 
  * fileName (fallback - uses search, may have delays for new files)
- To find a document by name, use microsoft_searchWordDocument
- CRITICAL WORKFLOW FOR ADDING CONTENT: When user asks to "add content" or "add default content" to a document:
  1. FIRST, search for the document using microsoft_searchWordDocument to get its ID
  2. THEN, call microsoft_addContentToWordDocument with the documentId and generated content
  3. YOU MUST call BOTH tools - searching is NOT enough, you must add the content!
  4. The content will be added directly to the original .docx file - no new files are created
- When user asks to add "default content" based on the document title, YOU generate appropriate content based on the title:
  * For titles like "ML Notes" - generate comprehensive machine learning content
  * For titles like "Sprint Notes" - generate sprint/project planning content
  * For titles like "Meeting Notes" - generate meeting template content
  * For titles like "DSA" or "Data Structures" - generate Data Structures and Algorithms content
  * For titles like "OOPs Concepts" - generate Object-Oriented Programming content
  * For titles like "Operating System Notes" - generate OS-related content
  * For titles like "Computer Networks" - generate networking concepts content
  * Generate AT LEAST 3-5 paragraphs of useful educational content

EXCEL WORKBOOK WITH SAMPLE DATA:
- When user asks to create an Excel workbook AND add sample data/data to it, you MUST set "addSampleData": true
- The sampleDataContext should describe what kind of data to generate based on the workbook name
- Example: "create excel workbook students and add sample data" → fileName: "students", addSampleData: true, sampleDataContext: "Student data with columns like Name, Roll Number, Marks, Grade"
- Example: "create expenses spreadsheet with sample data" → fileName: "expenses", addSampleData: true, sampleDataContext: "Expense tracking data with Date, Category, Description, Amount"
- ALWAYS analyze the workbook name to determine appropriate sample data columns and values

IMPORTANT MULTI-TASK HANDLING:
- When a user asks for multiple things in one request, execute ALL requested tools
- Complete every part of the user's request - don't stop after the first task
- CRITICAL: Parse the ENTIRE query and identify ALL tasks. For example:
  * "create workbook, add data, send link" = 3 tasks (but create+add data is handled by one tool with addSampleData=true)
  * "list emails AND create a spreadsheet" = 2 separate tools needed
- If the user asks to "add content to a document", you MUST call microsoft_addContentToWordDocument (searching alone is not enough!)
- Provide a comprehensive response covering all actions taken

IMPORTANT: 
- When sending emails, compose professional and appropriate content
- When creating calendar events, ensure start time is before end time
- To create a new Excel workbook, use the microsoft_createExcelWorkbook tool
- When working with existing Excel files, validate that the workbook exists in OneDrive first
- For Teams messages, format content appropriately for the context (chat vs channel)

**PROFESSIONAL EMAIL WRITING GUIDELINES (CRITICAL FOR ALL EMAILS):**
When composing ANY email (sending, replying, forwarding), you MUST follow this professional format:

1. **Subject Line Requirements**:
   - NEVER use just a filename or single word as subject
   - BAD: "students", "Document", "File", "Meeting"
   - GOOD: "Sharing Excel Workbook: Student Records", "Document for Review: Project Proposal", "Meeting Request: Q1 Planning Discussion"
   - Always include context: [Action/Purpose]: [Specific Item]

2. **Email Body Structure** (FOLLOW THIS EXACTLY):
   """
   Hi [Recipient's First Name],

   I hope this message finds you well.

   [Purpose paragraph - 2-3 sentences explaining why you're writing and what you're sharing]

   📎 [Item Type]: [Name]
   🔗 Link: [URL]

   [Call to action - what you'd like them to do]

   Please feel free to reach out if you have any questions or need any clarification.

   Best regards,
   [SENDER'S ACTUAL NAME]
   """

3. **CRITICAL RULES**:
   - NEVER use placeholders like "[Your Name]" - get and use the actual sender's name
   - Personalize the greeting with recipient's first name (extract from email)
   - Use proper paragraph breaks for readability
   - Be warm but professional
   - Include clear call to action
   - Format links clearly with labels`;
  }

  /**
   * Process a natural language query
   * @param {string} query - User's query
   * @param {string} userId - User ID
   * @param {object} options - Additional options
   * @returns {object} Query result
   */
  async processQuery(query, userId, options = {}) {
    const { conversationHistory = [], forceToolExecution = null } = options;

    try {
      // Check if Microsoft is connected
      const tokens = await microsoftService.getValidTokens(userId);
      if (!tokens) {
        return {
          success: false,
          error: 'Microsoft not connected',
          message: 'Please connect your Microsoft account first to use Microsoft 365 features.'
        };
      }

      // Handle forced tool execution (for confirmed actions from confirmation flow)
      if (forceToolExecution) {
        const { toolName, params } = forceToolExecution;
        console.log(`[MicrosoftAgent] Force executing tool: ${toolName}`);
        console.log(`[MicrosoftAgent] With params:`, JSON.stringify(params, null, 2));
        
        // For sendEmail, check if we need to generate content with document link from previous action
        if (toolName === 'microsoft_sendEmail') {
          // Get sender's name for professional email signing
          let senderName = null;
          try {
            const userProfile = await microsoftService.getUserProfile(userId);
            if (userProfile && userProfile.displayName) {
              senderName = userProfile.displayName;
              console.log(`[MicrosoftAgent] Got sender name: ${senderName}`);
            }
          } catch (profileError) {
            console.log(`[MicrosoftAgent] Could not fetch user profile:`, profileError.message);
          }
          
          // Check if there are previous results with a document link we need to include
          // BUT only regenerate if the body doesn't already contain proper content (from preview)
          if (params._previousResults && params._previousResults.length > 0) {
            const prevResult = params._previousResults[0];
            let docLink = null;
            let docName = null;
            
            // Extract document link from previous result
            if (prevResult.result && prevResult.result.raw_results) {
              for (const rawResult of prevResult.result.raw_results) {
                if (rawResult.webUrl) {
                  docLink = rawResult.webUrl;
                  docName = rawResult.name || params.subject || 'document';
                  break;
                }
              }
            }
            
            // CRITICAL: Only regenerate if the body doesn't already contain the document link
            // This ensures the preview content matches what gets sent
            const bodyAlreadyHasLink = params.body && docLink && params.body.includes(docLink);
            
            if (docLink && !bodyAlreadyHasLink) {
              console.log(`[MicrosoftAgent] Found document link from previous action: ${docLink}`);
              console.log(`[MicrosoftAgent] Body doesn't contain link yet, generating email content...`);
              // Generate proper email body with the document link and sender name
              const emailContent = await this.generateEmailWithDocumentLink(
                params.to,
                params.subject,
                docName,
                docLink,
                senderName
              );
              params.body = emailContent.body;
              params.subject = emailContent.subject || params.subject;
              console.log(`[MicrosoftAgent] Generated email body with document link`);
            } else if (bodyAlreadyHasLink) {
              console.log(`[MicrosoftAgent] ✅ Email body already contains document link from preview - using as-is`);
            }
            
            // Remove the _previousResults before sending
            delete params._previousResults;
          }
          
          // Handle pre-generated AI content
          if (params.isAIGenerated) {
            console.log(`[MicrosoftAgent] Using pre-generated AI email content (matches preview)`);
            delete params.isAIGenerated;
            delete params.userName;
          }
          
          // Remove any flags
          delete params.pendingDocumentLink;
        }
        
        // For createWordDocument with content instruction, generate actual content using AI
        if (toolName === 'microsoft_createWordDocument' && params.content) {
          const contentLower = params.content.toLowerCase();
          // Check if content is an instruction to generate rather than actual content
          if (contentLower.startsWith('generate content') || contentLower.includes('based on the title')) {
            console.log(`[MicrosoftAgent] Generating AI content for Word document: ${params.fileName}`);
            try {
              const generatedContent = await this.generateDocumentContent(params.fileName);
              params.content = generatedContent;
              console.log(`[MicrosoftAgent] Generated content (${generatedContent.length} chars)`);
            } catch (contentError) {
              console.error(`[MicrosoftAgent] Error generating content:`, contentError);
              // Fallback to basic content
              params.content = `# ${params.fileName}\n\nThis document was created automatically.`;
            }
          }
        }
        
        // For createExcelWorkbook with sample data request, generate and add data after creation
        let shouldAddSampleDataToExcel = false;
        let excelSampleDataContext = null;
        if (toolName === 'microsoft_createExcelWorkbook' && params.addSampleData) {
          shouldAddSampleDataToExcel = true;
          excelSampleDataContext = params.sampleDataContext || `Sample data for ${params.fileName}`;
          console.log(`[MicrosoftAgent] Will add sample data to Excel workbook after creation`);
          // Clean up params before sending to API
          delete params.addSampleData;
          delete params.sampleDataContext;
        }
        
        const result = await this.executeFunction(toolName, params, userId);
        
        // If Excel was created successfully and we need to add sample data
        // Note: result contains workbookId, not id - so check for both
        const excelWorkbookId = result.workbookId || result.id;
        if (shouldAddSampleDataToExcel && result.success && excelWorkbookId) {
          console.log(`[MicrosoftAgent] Excel workbook created (ID: ${excelWorkbookId}), now adding sample data...`);
          try {
            const sampleData = await this.generateExcelSampleData(params.fileName, excelSampleDataContext);
            console.log(`[MicrosoftAgent] Generated ${sampleData.rows.length} rows of sample data`);
            
            // Write ALL rows at once using a single range update (much more reliable)
            if (sampleData.rows && sampleData.rows.length > 0) {
              const numRows = sampleData.rows.length;
              const numCols = sampleData.rows[0].length;
              const endColumn = String.fromCharCode(64 + numCols); // A=65, so 64+1=A, 64+5=E, etc.
              const range = `A1:${endColumn}${numRows}`;
              
              console.log(`[MicrosoftAgent] Writing ${numRows} rows to range ${range}`);
              
              await microsoftService.updateRange(
                userId, 
                excelWorkbookId, 
                'Sheet1', 
                range, 
                sampleData.rows
              );
              
              result.sampleDataAdded = true;
              result.sampleDataRows = numRows;
              console.log(`[MicrosoftAgent] ✅ Sample data added successfully (${numRows} rows)`);
            } else {
              console.log(`[MicrosoftAgent] ⚠️ No sample data rows generated`);
            }
            
            result.sampleDataAdded = true;
            result.sampleDataRows = sampleData.rows.length;
            console.log(`[MicrosoftAgent] ✅ Sample data added successfully`);
          } catch (dataError) {
            console.error(`[MicrosoftAgent] Error adding sample data:`, dataError);
            result.sampleDataError = dataError.message;
          }
        }
        
        // Format response based on tool type
        let responseText = result.success ? `Successfully executed ${toolName}` : result.error;
        
        if (toolName === 'microsoft_sendEmail' && result.success) {
          responseText = `Your email has been sent successfully via Outlook to ${params.to}! 🎉`;
        } else if (toolName === 'microsoft_listFiles' && result.success !== false) {
          // Format OneDrive file list
          const files = Array.isArray(result) ? result : (result.value || result.files || []);
          if (files.length > 0) {
            responseText = `📁 **Your OneDrive Files:**\n\n`;
            files.forEach((file, i) => {
              const icon = file.folder ? '📁' : '📄';
              const size = file.size ? ` (${this.formatFileSize(file.size)})` : '';
              const modified = file.lastModifiedDateTime ? ` - Modified: ${new Date(file.lastModifiedDateTime).toLocaleDateString()}` : '';
              responseText += `${i + 1}. ${icon} **${file.name}**${size}${modified}\n`;
            });
            responseText += `\n_Total: ${files.length} items_`;
          } else {
            responseText = `Your OneDrive root folder appears to be empty or no files were found.`;
          }
        } else if (toolName === 'microsoft_listCalendarEvents' && Array.isArray(result)) {
          // Format calendar events
          if (result.length > 0) {
            responseText = `📅 **Your Upcoming Events:**\n\n`;
            result.forEach((event, i) => {
              const start = event.start?.dateTime ? new Date(event.start.dateTime).toLocaleString() : 'TBD';
              responseText += `${i + 1}. **${event.subject}** - ${start}\n`;
            });
          } else {
            responseText = `No upcoming calendar events found.`;
          }
        } else if (toolName === 'microsoft_listEmails' && Array.isArray(result)) {
          // Format email list
          if (result.length > 0) {
            responseText = `📧 **Your Recent Outlook Emails:**\n\n`;
            result.forEach((email, i) => {
              const from = email.from?.emailAddress?.name || email.from?.emailAddress?.address || 'Unknown';
              const date = email.receivedDateTime ? new Date(email.receivedDateTime).toLocaleDateString() : '';
              const unread = email.isRead ? '' : '🔵 ';
              responseText += `${i + 1}. ${unread}**${email.subject}** - From: ${from} (${date})\n`;
            });
          } else {
            responseText = `No emails found in this folder.`;
          }
        } else if (toolName === 'microsoft_getFileContent' && result.success) {
          // Format file content response
          if (result.type === 'text' && result.content) {
            responseText = `📄 **${result.fileName}**\n\n\`\`\`\n${result.content.substring(0, 3000)}${result.content.length > 3000 ? '\n\n... (content truncated)' : ''}\n\`\`\``;
          } else if (result.type === 'office_document') {
            responseText = `📄 **${result.fileName}**\n\n${result.message}\n\nThis is an Office document that cannot be read as plain text. You can open it directly in your browser:\n🔗 ${result.webUrl}`;
          } else if (result.type === 'image') {
            responseText = `🖼️ **${result.fileName}**\n\nThis is an image file.\n🔗 View: ${result.webUrl}`;
          } else {
            responseText = `📁 **${result.fileName}**\n\n${result.message || 'File information retrieved.'}`;
          }
        } else if (toolName === 'microsoft_getFileContent' && !result.success) {
          responseText = result.error || 'Failed to retrieve file content.';
        } else if (toolName === 'microsoft_createExcelWorkbook' && result.success) {
          responseText = `📊 **Excel Workbook Created Successfully!**\n\n`;
          responseText += `📁 **Name:** ${result.name}\n`;
          if (result.webUrl) {
            responseText += `🔗 **Open in Excel Online:** [Open ${result.name}](${result.webUrl})\n`;
          }
          if (result.sampleDataAdded) {
            responseText += `\n✅ **Sample data added:** ${result.sampleDataRows} rows of data have been added to the workbook.\n`;
          }
          responseText += `\n_You can now open and edit this workbook in your browser or desktop Excel._`;
        } else if (toolName === 'microsoft_createExcelWorkbook' && !result.success) {
          responseText = result.error || 'Failed to create Excel workbook.';
        } else if (toolName === 'microsoft_addWorksheet' && result.name) {
          responseText = `📊 **Worksheet Added!**\n\nNew sheet "${result.name}" has been added to the workbook.`;
        } else if (toolName === 'microsoft_deleteWorksheet' && result.success) {
          responseText = `🗑️ **Worksheet Deleted**\n\n${result.message}`;
        } else if (toolName === 'microsoft_appendRow' && result.success) {
          responseText = `✅ **Row Appended**\n\n${result.message}`;
        } else if (toolName === 'microsoft_formatRange') {
          responseText = `🎨 **Cells Formatted**\n\nThe specified range has been formatted successfully.`;
        } else if (toolName === 'microsoft_listMailFolders' && Array.isArray(result)) {
          responseText = `📁 **Your Mail Folders:**\n\n`;
          result.forEach((folder, i) => {
            const unread = folder.unreadItemCount > 0 ? ` (${folder.unreadItemCount} unread)` : '';
            responseText += `${i + 1}. **${folder.displayName}**${unread} - ${folder.totalItemCount} items\n`;
          });
        } else if (toolName === 'microsoft_markAsRead' && result.success) {
          responseText = `✅ Email marked as read.`;
        } else if (toolName === 'microsoft_markAsUnread' && result.success) {
          responseText = `📨 Email marked as unread.`;
        } else if (toolName === 'microsoft_deleteEmail' && result.success) {
          responseText = `🗑️ Email deleted successfully.`;
        } else if (toolName === 'microsoft_deleteFile' && result.success) {
          responseText = `🗑️ File deleted successfully from OneDrive.`;
        } else if (toolName === 'microsoft_getFileInfo') {
          if (result.name) {
            responseText = `📄 **File Info: ${result.name}**\n\n`;
            responseText += `📦 Size: ${this.formatFileSize(result.size)}\n`;
            responseText += `📅 Created: ${new Date(result.createdDateTime).toLocaleDateString()}\n`;
            responseText += `📅 Modified: ${new Date(result.lastModifiedDateTime).toLocaleDateString()}\n`;
            if (result.webUrl) {
              responseText += `🔗 Open: ${result.webUrl}`;
            }
          } else {
            responseText = result.error || 'Could not retrieve file information.';
          }
        } else if (toolName === 'microsoft_listWorksheets' && Array.isArray(result)) {
          responseText = `📊 **Worksheets in Workbook:**\n\n`;
          result.forEach((sheet, i) => {
            responseText += `${i + 1}. **${sheet.name}**\n`;
          });
        } else if (toolName === 'microsoft_createCalendarEvent' && result.id) {
          responseText = `📅 **Event Created!**\n\n`;
          responseText += `📌 **${result.subject}**\n`;
          if (result.start?.dateTime) {
            responseText += `🕐 ${new Date(result.start.dateTime).toLocaleString()}\n`;
          }
          if (result.webLink) {
            responseText += `🔗 ${result.webLink}`;
          }
        } else if (toolName === 'microsoft_listCalendars' && Array.isArray(result)) {
          responseText = `📅 **Your Calendars:**\n\n`;
          result.forEach((cal, i) => {
            const isDefault = cal.isDefaultCalendar ? ' (Default)' : '';
            responseText += `${i + 1}. **${cal.name}**${isDefault}\n`;
          });
        } else if (toolName === 'microsoft_deleteCalendarEvent' && result.success) {
          responseText = `🗑️ Calendar event deleted successfully.`;
        } else if (toolName === 'microsoft_updateCalendarEvent' && result.id) {
          responseText = `✅ Calendar event updated successfully.`;
        } else if (toolName === 'microsoft_listTeams') {
          // Handle Teams list - check for personal account error
          if (result.success === false && result.accountType === 'personal') {
            responseText = `⚠️ **Microsoft Teams Not Available**\n\n${result.error}\n\nTo use Teams features, you'll need to sign in with a work or school account that has Microsoft 365 with Teams enabled.`;
          } else if (Array.isArray(result) && result.length > 0) {
            responseText = `👥 **Your Microsoft Teams:**\n\n`;
            result.forEach((team, i) => {
              responseText += `${i + 1}. **${team.displayName}**\n`;
              if (team.description) {
                responseText += `   _${team.description}_\n`;
              }
            });
          } else if (Array.isArray(result)) {
            responseText = `No teams found. You may not be a member of any teams.`;
          } else {
            responseText = result.error || 'Unable to retrieve teams.';
          }
        } else if (toolName === 'microsoft_listChannels') {
          // Handle channels list - check for personal account error
          if (result.success === false && result.accountType === 'personal') {
            responseText = `⚠️ **Microsoft Teams Not Available**\n\n${result.error}`;
          } else if (Array.isArray(result) && result.length > 0) {
            responseText = `📢 **Channels:**\n\n`;
            result.forEach((channel, i) => {
              responseText += `${i + 1}. **${channel.displayName}**\n`;
              if (channel.description) {
                responseText += `   _${channel.description}_\n`;
              }
            });
          } else if (Array.isArray(result)) {
            responseText = `No channels found in this team.`;
          } else {
            responseText = result.error || 'Unable to retrieve channels.';
          }
        } else if (toolName === 'microsoft_listChats') {
          // Handle chats list - check for personal account error
          if (result.success === false && result.accountType === 'personal') {
            responseText = `⚠️ **Microsoft Teams Not Available**\n\n${result.error}`;
          } else if (Array.isArray(result) && result.length > 0) {
            responseText = `💬 **Your Teams Chats:**\n\n`;
            result.forEach((chat, i) => {
              const topic = chat.topic || 'Unnamed Chat';
              const type = chat.chatType === 'oneOnOne' ? '(1:1)' : chat.chatType === 'group' ? '(Group)' : '';
              const lastUpdated = chat.lastUpdatedDateTime ? new Date(chat.lastUpdatedDateTime).toLocaleDateString() : '';
              responseText += `${i + 1}. **${topic}** ${type} - ${lastUpdated}\n`;
            });
          } else if (Array.isArray(result)) {
            responseText = `No chats found.`;
          } else {
            responseText = result.error || 'Unable to retrieve chats.';
          }
        } else if ((toolName === 'microsoft_listChannelMessages' || toolName === 'microsoft_listChatMessages') && Array.isArray(result)) {
          // Format messages list
          if (result.length > 0) {
            responseText = `💬 **Recent Messages:**\n\n`;
            result.slice(0, 10).forEach((msg, i) => {
              const from = msg.from?.user?.displayName || 'Unknown';
              const content = msg.body?.content?.replace(/<[^>]*>/g, '').substring(0, 100) || '';
              const date = msg.createdDateTime ? new Date(msg.createdDateTime).toLocaleString() : '';
              responseText += `${i + 1}. **${from}** (${date})\n   ${content}${content.length >= 100 ? '...' : ''}\n\n`;
            });
            if (result.length > 10) {
              responseText += `_...and ${result.length - 10} more messages_`;
            }
          } else {
            responseText = `No messages found.`;
          }
        } else if (toolName === 'microsoft_sendChatMessage' && result.success) {
          responseText = `✅ Message sent to Teams chat successfully!`;
        } else if (toolName === 'microsoft_sendChannelMessage' && result.success) {
          responseText = `✅ Message posted to Teams channel successfully!`;
        } else if (toolName === 'microsoft_listWordFiles' && Array.isArray(result)) {
          // Format Word files list
          if (result.length > 0) {
            responseText = `📝 **Your Word Documents:**\n\n`;
            result.forEach((file, i) => {
              const size = file.size ? ` (${this.formatFileSize(file.size)})` : '';
              const modified = file.lastModifiedDateTime ? ` - ${new Date(file.lastModifiedDateTime).toLocaleDateString()}` : '';
              responseText += `${i + 1}. **${file.name}**${size}${modified}\n`;
            });
            responseText += `\n_Total: ${result.length} documents_`;
          } else {
            responseText = `No Word documents found in your OneDrive.`;
          }
        } else if (toolName === 'microsoft_createWordDocument' && result.success) {
          responseText = `📝 **Word Document Created Successfully!**\n\n`;
          responseText += `📁 **Name:** ${result.name}\n`;
          if (result.webUrl) {
            responseText += `🔗 **Open in Word Online:** ${result.webUrl}\n`;
          }
          responseText += `\n_You can now open and edit this document in your browser or desktop Word._`;
        } else if (toolName === 'microsoft_createWordDocument' && !result.success) {
          responseText = result.error || 'Failed to create Word document.';
        } else if (toolName === 'microsoft_getWordDocumentContent' && result.success) {
          responseText = `📝 **${result.fileName}**\n\n${result.message}\n\n🔗 Open: ${result.webUrl}`;
        } else if (toolName === 'microsoft_downloadWordDocument' && result.success) {
          responseText = `📥 Word document "${result.fileName}" ready for download.`;
        } else if (toolName === 'microsoft_updateWordDocument' && result.success) {
          responseText = `✅ Word document updated successfully!`;
        } else if (toolName === 'microsoft_addContentToWordDocument') {
          if (result.success) {
            responseText = `✅ **Content Added Successfully!**\n\n`;
            responseText += `📝 **Document:** ${result.name}\n\n`;
            responseText += `${result.message}\n\n`;
            responseText += `🔗 **Open Document:** [${result.name}](${result.webUrl})\n\n`;
            if (result.contentAdded) {
              responseText += `**Content Preview:**\n> ${result.contentAdded.replace(/\n/g, '\n> ')}\n\n`;
            }
            responseText += `_You can now open and view the document in your browser or desktop Word._`;
          } else {
            responseText = `⚠️ **Could Not Add Content**\n\n${result.error}\n\n`;
            if (result.availableDocuments && result.availableDocuments.length > 0) {
              responseText += `**Available Word Documents:**\n`;
              result.availableDocuments.forEach((doc, i) => {
                responseText += `${i + 1}. [${doc.name}](${doc.webUrl})\n`;
              });
              responseText += `\n${result.suggestion}`;
            } else {
              responseText += result.suggestion || 'Please try again or create a new document.';
            }
          }
        } else if (toolName === 'microsoft_searchWordDocument') {
          if (result && result.id) {
            responseText = `📝 **Found: ${result.name}**\n\n`;
            responseText += `🔗 **Open:** [${result.name}](${result.webUrl})\n`;
            responseText += `📅 Modified: ${new Date(result.lastModifiedDateTime).toLocaleString()}\n`;
            responseText += `📁 ID: \`${result.id}\``;
          } else {
            responseText = `No document found matching that name.`;
          }
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

      // Build messages array
      const messages = [
        { role: 'system', content: this.systemPrompt },
        ...conversationHistory,
        { role: 'user', content: query }
      ];

      // Call OpenAI with tools - support multi-turn tool calling
      let currentMessages = [...messages];
      let allToolsUsed = [];
      let allToolResults = [];
      let maxIterations = 5; // Prevent infinite loops
      let iteration = 0;

      while (iteration < maxIterations) {
        iteration++;
        console.log(`[MicrosoftAgent] Tool calling iteration ${iteration}`);

        const response = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: currentMessages,
          tools: this.tools,
          tool_choice: 'auto',
          temperature: 0.7
        });

        const assistantMessage = response.choices[0].message;

        // Check if tools were called
        if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
          const toolResults = [];

          for (const toolCall of assistantMessage.tool_calls) {
            const functionName = toolCall.function.name;
            const functionArgs = JSON.parse(toolCall.function.arguments);

            console.log(`[MicrosoftAgent] Executing tool: ${functionName}`, functionArgs);
            allToolsUsed.push({ name: functionName, arguments: functionArgs });

            try {
              const result = await this.executeFunction(functionName, functionArgs, userId);
              const toolResult = {
                tool_call_id: toolCall.id,
                role: 'tool',
                content: JSON.stringify(result)
              };
              toolResults.push(toolResult);
              allToolResults.push(toolResult);
            } catch (error) {
              console.error(`[MicrosoftAgent] Tool error (${functionName}):`, error);
              const toolResult = {
                tool_call_id: toolCall.id,
                role: 'tool',
                content: JSON.stringify({ error: error.message })
              };
              toolResults.push(toolResult);
              allToolResults.push(toolResult);
            }
          }

          // Add assistant message and tool results to the conversation
          currentMessages.push(assistantMessage);
          currentMessages.push(...toolResults);

          // Continue loop to see if more tools are needed
          continue;
        } else {
          // No more tools called, return the final response
          return {
            success: true,
            response: assistantMessage.content,
            message: assistantMessage.content,
            tools_used: allToolsUsed,
            toolsUsed: allToolsUsed.map(t => t.name),
            toolResults: allToolResults,
            raw_results: allToolResults
          };
        }
      }

      // Max iterations reached - get final response without tools
      console.log(`[MicrosoftAgent] Max iterations reached, getting final response`);
      const finalResponse = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: currentMessages,
        temperature: 0.7
      });

      return {
        success: true,
        response: finalResponse.choices[0].message.content,
        message: finalResponse.choices[0].message.content,
        tools_used: allToolsUsed,
        toolsUsed: allToolsUsed.map(t => t.name),
        toolResults: allToolResults,
        raw_results: allToolResults
      };

    } catch (error) {
      console.error('[MicrosoftAgent] Error processing query:', error);
      return {
        success: false,
        error: error.message,
        message: `Failed to process request: ${error.message}`
      };
    }
  }

  /**
   * Execute a specific function
   * @param {string} functionName - Function name
   * @param {object} params - Function parameters
   * @param {string} userId - User ID
   * @returns {object} Function result
   */
  async executeFunction(functionName, params, userId) {
    const handler = this.functionMap[functionName];
    
    if (!handler) {
      throw new Error(`Unknown function: ${functionName}`);
    }

    return await handler(params, userId);
  }

  /**
   * Format file size for human-readable display
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted size string
   */
  formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  }

  /**
   * Generate document content using AI based on the document title/topic
   * @param {string} title - Document title or topic
   * @returns {string} Generated content in markdown format
   */
  async generateDocumentContent(title) {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a professional document writer. Generate well-structured content for a Word document.
            
Use markdown formatting:
- # for main headings
- ## for subheadings  
- ### for section headers
- **bold** for emphasis
- Regular paragraphs for body text

Keep the content:
- Professional and informative
- 300-500 words
- Well-organized with clear sections
- Relevant to the topic/title provided`
          },
          {
            role: 'user',
            content: `Generate content for a Word document titled "${title}". Include relevant sections, information, and professional formatting.`
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });

      const content = response.choices[0]?.message?.content || '';
      console.log(`[MicrosoftAgent] AI generated content for "${title}"`);
      return content;
    } catch (error) {
      console.error(`[MicrosoftAgent] Error generating document content:`, error);
      throw error;
    }
  }

  /**
   * Generate email content that includes a document link
   * @param {string} to - Email recipient
   * @param {string} subject - Email subject
   * @param {string} docName - Document name
   * @param {string} docLink - Document link URL
   * @returns {object} Generated email params with body and subject
   */
  async generateEmailWithDocumentLink(to, subject, docName, docLink, senderName = null) {
    try {
      // Extract recipient's first name for personalized greeting
      const recipientName = to.split('@')[0].split('.')[0];
      const capitalizedRecipient = recipientName.charAt(0).toUpperCase() + recipientName.slice(1);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a professional business email composer. Write polished, well-structured emails.

CRITICAL REQUIREMENTS:
1. Subject line MUST be descriptive and professional:
   - BAD: "students" or "document"
   - GOOD: "Sharing Document: ${docName}" or "${docName} - Shared for Your Review"

2. Email body MUST follow this EXACT structure:
   - Personalized greeting with recipient's name
   - Opening line ("I hope this message finds you well." or similar)
   - Purpose paragraph explaining what you're sharing and why
   - The document link on its own line with a label
   - Call to action (what you'd like them to do)
   - Professional closing line
   - Sign-off with SENDER'S ACTUAL NAME (provided below)

3. Formatting:
   - Use proper line breaks between paragraphs
   - Make the link clearly visible
   - Keep it professional but warm

4. NEVER use placeholders like "[Your Name]" - use the actual sender name provided

Return ONLY a JSON object with:
{
  "subject": "Professional descriptive subject line",
  "body": "Complete professional email body"
}`
          },
          {
            role: 'user',
            content: `Write a professional email to share a document.

Recipient Email: ${to}
Recipient Name: ${capitalizedRecipient}
Document Name: ${docName}
Document Link: ${docLink}
Context/Purpose: ${subject || 'Sharing a document'}
Sender's Name: ${senderName || 'The sender'}

Write a complete, professional email that looks like it was written by a real person, not a template.`
          }
        ],
        temperature: 0.7,
        max_tokens: 600,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);
      
      console.log(`[MicrosoftAgent] Generated professional email with document link`);
      
      // Generate a good default subject if AI didn't provide one
      const defaultSubject = `Sharing Document: ${docName}`;
      
      return {
        subject: parsed.subject || defaultSubject,
        body: parsed.body || `Hi ${capitalizedRecipient},\n\nI hope this message finds you well.\n\nI'm sharing a document with you that I thought you'd find useful.\n\n📎 Document: ${docName}\n🔗 Link: ${docLink}\n\nPlease feel free to review it and let me know if you have any questions.\n\nBest regards,\n${senderName || 'Regards'}`
      };
    } catch (error) {
      console.error(`[MicrosoftAgent] Error generating email content:`, error);
      // Return professional fallback content
      const recipientName = to.split('@')[0].split('.')[0];
      const capitalizedRecipient = recipientName.charAt(0).toUpperCase() + recipientName.slice(1);
      
      return {
        subject: `Sharing Document: ${docName}`,
        body: `Hi ${capitalizedRecipient},\n\nI hope this message finds you well.\n\nI'm sharing a document with you that I thought you'd find useful.\n\n📎 Document: ${docName}\n🔗 Link: ${docLink}\n\nPlease feel free to review it and let me know if you have any questions.\n\nBest regards,\n${senderName || 'Regards'}`
      };
    }
  }

  /**
   * Generate sample data for an Excel workbook based on the file name/context
   * @param {string} fileName - Excel file name (e.g., "employees", "sales", "inventory")
   * @param {string} context - Additional context for data generation
   * @returns {object} Object with rows array containing sample data
   */
  async generateExcelSampleData(fileName, context) {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a data generator for Excel spreadsheets. Generate realistic sample data based on the file name and context.

Return ONLY a JSON object with this structure:
{
  "rows": [
    ["Header1", "Header2", "Header3", ...],
    ["Data1", "Data2", "Data3", ...],
    ...
  ]
}

Guidelines:
- First row should be column headers
- Generate 5-10 rows of realistic sample data
- Use appropriate data types (names, numbers, dates, emails, etc.)
- Make the data contextually relevant to the file name
- Keep values concise and realistic

Examples:
- "employees" → Name, Email, Department, Position, Hire Date
- "sales" → Date, Product, Quantity, Unit Price, Total
- "inventory" → Item, SKU, Quantity, Location, Status
- "contacts" → Name, Email, Phone, Company, Role`
          },
          {
            role: 'user',
            content: `Generate sample data for an Excel spreadsheet named "${fileName}".
${context ? `Additional context: ${context}` : ''}

Return realistic, professional data that would make sense for this type of spreadsheet.`
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);
      
      console.log(`[MicrosoftAgent] Generated ${parsed.rows?.length || 0} rows of sample data for "${fileName}"`);
      
      return {
        rows: parsed.rows || [
          ['Column A', 'Column B', 'Column C'],
          ['Sample 1', 'Data 1', 'Value 1'],
          ['Sample 2', 'Data 2', 'Value 2']
        ]
      };
    } catch (error) {
      console.error(`[MicrosoftAgent] Error generating Excel sample data:`, error);
      // Return fallback data based on common patterns
      const lowerName = fileName.toLowerCase();
      if (lowerName.includes('employee')) {
        return {
          rows: [
            ['Name', 'Email', 'Department', 'Position', 'Hire Date'],
            ['John Smith', 'john.smith@company.com', 'Engineering', 'Software Developer', '2024-01-15'],
            ['Sarah Johnson', 'sarah.j@company.com', 'Marketing', 'Marketing Manager', '2023-06-20'],
            ['Mike Brown', 'mike.b@company.com', 'Sales', 'Sales Representative', '2024-03-10'],
            ['Emily Davis', 'emily.d@company.com', 'HR', 'HR Specialist', '2023-09-05'],
            ['Chris Wilson', 'chris.w@company.com', 'Engineering', 'Senior Developer', '2022-11-18']
          ]
        };
      } else if (lowerName.includes('sales') || lowerName.includes('revenue')) {
        return {
          rows: [
            ['Date', 'Product', 'Quantity', 'Unit Price', 'Total'],
            ['2024-01-15', 'Product A', '10', '$25.00', '$250.00'],
            ['2024-01-16', 'Product B', '5', '$45.00', '$225.00'],
            ['2024-01-17', 'Product C', '15', '$12.00', '$180.00']
          ]
        };
      } else {
        return {
          rows: [
            ['ID', 'Name', 'Description', 'Status', 'Date'],
            ['001', 'Item 1', 'Description of item 1', 'Active', '2024-01-15'],
            ['002', 'Item 2', 'Description of item 2', 'Pending', '2024-01-16'],
            ['003', 'Item 3', 'Description of item 3', 'Complete', '2024-01-17']
          ]
        };
      }
    }
  }
}

module.exports = MicrosoftAgent;
