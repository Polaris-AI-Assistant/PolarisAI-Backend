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
          
          // ✅ VALIDATION: Prevent createDocument from being called when documentId is provided
          if (params.documentId || params.id) {
            throw new Error(
              '❌ Cannot create document when documentId is provided. A document with this ID already exists. ' +
              'Use updateWordDocumentContent({ documentId: "' + (params.documentId || params.id) + '", content: "..." }) to update the existing document instead.'
            );
          }
          
          try {
            const doc = await microsoftService.createDocument(context.userId, params);
            
            // ✅ CRITICAL FIX: Check if the service returned an error
            if (!doc.success || !doc.documentId) {
              console.error(`[MicrosoftAgent] ❌ Error creating document: ${doc.error || 'Unknown error'}`);
              throw new Error(doc.error || 'Failed to create document');
            }
            
            console.log(`[MicrosoftAgent] ✅ Document created: ${doc.documentId}`);
            return {
              success: true,
              documentId: doc.documentId,
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

      updateWordDocumentContent: {
        definition: {
          type: 'function',
          function: {
            name: 'updateWordDocumentContent',
            description: 'Update content in an existing Word document by appending or replacing. CRITICAL: Only use this when documentId is provided.',
            parameters: {
              type: 'object',
              properties: {
                documentId: { type: 'string', description: 'The ID of the Word document to update (REQUIRED)' },
                content: { type: 'string', description: 'New content to add to or replace in the document' },
                mode: { 
                  type: 'string', 
                  description: 'Update mode: "append" to add content below existing content, "replace" to replace entire content',
                  enum: ['append', 'replace'],
                  default: 'append'
                }
              },
              required: ['documentId', 'content']
            }
          }
        },
        execute: async (params, context) => {
          const { documentId, content, mode = 'append' } = params;
          
          // ✅ VALIDATION: Prevent createDocument from being called when documentId is provided
          if (!documentId) {
            throw new Error('documentId is required for updateWordDocumentContent. If you want to create a new document, use createDocument instead.');
          }
          
          console.log(`[MicrosoftAgent] 📝 Updating document (${mode} mode): ${documentId}`);
          try {
            const result = await microsoftService.updateWordDocumentContent(
              context.userId, 
              documentId, 
              content, 
              mode
            );
            
            if (!result.success) {
              console.error(`[MicrosoftAgent] ❌ Error updating document: ${result.error}`);
              throw new Error(result.error || 'Failed to update document');
            }
            
            console.log(`[MicrosoftAgent] ✅ Document updated: ${result.documentId}`);
            return {
              success: true,
              documentId: result.documentId,
              title: result.name,
              url: result.webUrl,
              mode: mode,
              updatedAt: new Date().toISOString(),
              message: result.message
            };
          } catch (error) {
            console.error(`[MicrosoftAgent] ❌ Error updating document:`, error.message);
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
            const workbook = await microsoftService.createExcelWorkbook(context.userId, params.title, params.parentFolderId);
            
            if (!workbook || (!workbook.id && !workbook.workbookId)) {
              throw new Error('Workbook creation failed - no ID returned');
            }
            
            const workbookId = workbook.workbookId || workbook.id;
            console.log(`[MicrosoftAgent] ✅ Workbook created: ${workbookId}`);
            
            return { 
              success: true, 
              workbookId: workbookId,
              id: workbookId, // Also return as 'id' for consistency
              title: workbook.name, 
              url: workbook.webUrl 
            };
          } catch (error) {
            console.error(`[MicrosoftAgent] ❌ Error creating workbook:`, error.message);
            throw error;
          }
        }
      },

      addDataToExcel: {
        definition: {
          type: 'function',
          function: {
            name: 'addDataToExcel',
            description: 'Add data to an Excel workbook. Can add sample data or specific data provided. CRITICAL: Must be called AFTER createExcelWorkbook. You MUST use the actual workbookId from the previous step result, NOT the workbook title. IMPORTANT: Pass the workbook title to generate contextually appropriate sample data.',
            parameters: {
              type: 'object',
              properties: {
                workbookId: { 
                  type: 'string', 
                  description: 'The ACTUAL workbook ID (a long string like "01ABCD...") from the createExcelWorkbook result. NEVER use the workbook title here - always use the ID field from the previous step.'
                },
                title: {
                  type: 'string',
                  description: 'The workbook title/name to generate contextually appropriate sample data (e.g., "students", "products", "employees"). Pass the title from createExcelWorkbook result.'
                },
                worksheetName: { type: 'string', description: 'Worksheet name (default: Sheet1)', default: 'Sheet1' },
                data: { 
                  type: 'array', 
                  description: 'Array of arrays representing rows and columns. If not provided, sample data will be generated based on workbook title.',
                  items: {
                    type: 'array',
                    items: { type: 'string' }
                  }
                },
                range: { type: 'string', description: 'Excel range (e.g., "A1:C10"). If not provided, will auto-calculate based on data size.' }
              },
              required: ['workbookId']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[MicrosoftAgent] 📊 Adding data to Excel workbook: ${params.workbookId}`);
          try {
            if (!params.workbookId) {
              throw new Error('workbookId is required to add data to Excel. Please provide the workbook ID from the previous createExcelWorkbook step.');
            }
            
            const worksheetName = params.worksheetName || 'Sheet1';
            let data = params.data;
            
            // If no data provided, generate sample data based on workbook title
            if (!data || data.length === 0) {
              console.log(`[MicrosoftAgent] 📝 Generating contextual sample data for "${params.title || 'workbook'}"...`);
              
              // Generate contextually appropriate sample data based on title
              const title = (params.title || '').toLowerCase();
              
              if (title.includes('student') || title.includes('class') || title.includes('grade')) {
                data = [
                  ['Student Name', 'Age', 'Grade', 'Email'],
                  ['John Smith', '20', 'A', 'john.smith@school.edu'],
                  ['Emma Johnson', '21', 'B+', 'emma.j@school.edu'],
                  ['Michael Brown', '19', 'A-', 'michael.b@school.edu'],
                  ['Sophia Davis', '22', 'A', 'sophia.d@school.edu'],
                  ['William Wilson', '20', 'B', 'william.w@school.edu'],
                  ['Olivia Martinez', '21', 'A-', 'olivia.m@school.edu'],
                  ['James Anderson', '19', 'B+', 'james.a@school.edu'],
                  ['Ava Taylor', '20', 'A', 'ava.t@school.edu'],
                  ['Robert Thomas', '22', 'B', 'robert.t@school.edu'],
                  ['Isabella Garcia', '21', 'A-', 'isabella.g@school.edu']
                ];
              } else if (title.includes('employee') || title.includes('staff') || title.includes('team')) {
                data = [
                  ['Employee Name', 'Department', 'Position', 'Salary'],
                  ['Alice Cooper', 'Engineering', 'Senior Developer', '$95,000'],
                  ['Bob Williams', 'Marketing', 'Marketing Manager', '$75,000'],
                  ['Carol Martinez', 'HR', 'HR Specialist', '$65,000'],
                  ['David Lee', 'Engineering', 'Tech Lead', '$110,000'],
                  ['Emily Chen', 'Sales', 'Sales Representative', '$60,000'],
                  ['Frank Johnson', 'Finance', 'Accountant', '$70,000'],
                  ['Grace Kim', 'Engineering', 'Junior Developer', '$65,000'],
                  ['Henry Brown', 'Operations', 'Operations Manager', '$85,000'],
                  ['Irene Davis', 'Marketing', 'Content Strategist', '$68,000'],
                  ['Jack Wilson', 'Sales', 'Sales Manager', '$90,000']
                ];
              } else if (title.includes('product') || title.includes('inventory') || title.includes('stock')) {
                data = [
                  ['Product Name', 'Category', 'Price', 'Stock'],
                  ['Laptop', 'Electronics', '$999', '50'],
                  ['Mouse', 'Electronics', '$25', '150'],
                  ['Keyboard', 'Electronics', '$75', '100'],
                  ['Monitor', 'Electronics', '$299', '75'],
                  ['Desk Chair', 'Furniture', '$199', '30'],
                  ['Desk Lamp', 'Furniture', '$45', '80'],
                  ['Notebook', 'Stationery', '$5', '200'],
                  ['Pen Set', 'Stationery', '$15', '120'],
                  ['Water Bottle', 'Accessories', '$20', '90'],
                  ['Backpack', 'Accessories', '$65', '60']
                ];
              } else if (title.includes('sale') || title.includes('revenue') || title.includes('transaction')) {
                data = [
                  ['Date', 'Product', 'Quantity', 'Revenue'],
                  ['2026-01-15', 'Laptop', '5', '$4,995'],
                  ['2026-01-16', 'Mouse', '25', '$625'],
                  ['2026-01-17', 'Keyboard', '12', '$900'],
                  ['2026-01-18', 'Monitor', '8', '$2,392'],
                  ['2026-01-19', 'Desk Chair', '3', '$597'],
                  ['2026-01-20', 'Desk Lamp', '15', '$675'],
                  ['2026-01-21', 'Notebook', '100', '$500'],
                  ['2026-01-22', 'Pen Set', '40', '$600'],
                  ['2026-01-23', 'Water Bottle', '30', '$600'],
                  ['2026-01-24', 'Backpack', '10', '$650']
                ];
              } else {
                // Default generic data
                data = [
                  ['Item', 'Description', 'Value', 'Status'],
                  ['Item 1', 'Sample description 1', '100', 'Active'],
                  ['Item 2', 'Sample description 2', '200', 'Active'],
                  ['Item 3', 'Sample description 3', '150', 'Pending'],
                  ['Item 4', 'Sample description 4', '300', 'Active'],
                  ['Item 5', 'Sample description 5', '250', 'Active'],
                  ['Item 6', 'Sample description 6', '180', 'Pending'],
                  ['Item 7', 'Sample description 7', '220', 'Active'],
                  ['Item 8', 'Sample description 8', '190', 'Active'],
                  ['Item 9', 'Sample description 9', '280', 'Pending'],
                  ['Item 10', 'Sample description 10', '320', 'Active']
                ];
              }
            }
            
            // Auto-calculate range if not provided
            let range = params.range;
            if (!range) {
              const numRows = data.length;
              const numCols = data[0].length;
              const endCol = String.fromCharCode(64 + numCols); // A=65, so 64+1=65=A
              range = `A1:${endCol}${numRows}`;
            }
            
            console.log(`[MicrosoftAgent] 📝 Writing ${data.length} rows to range ${range}`);
            console.log(`[MicrosoftAgent] 🔑 Using workbookId: ${params.workbookId}`);
            
            // Add a small delay to ensure file is unlocked
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const result = await microsoftService.updateRange(
              context.userId,
              params.workbookId,
              worksheetName,
              range,
              data
            );
            
            console.log(`[MicrosoftAgent] ✅ Data added successfully`);
            return { 
              success: true, 
              rowsAdded: data.length,
              range: range,
              worksheetName: worksheetName
            };
          } catch (error) {
            console.error(`[MicrosoftAgent] ❌ Error adding data:`, error.message);
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
      },

      listEmails: {
        definition: {
          type: 'function',
          function: {
            name: 'listEmails',
            description: 'List emails from Outlook inbox. Can filter by unread status, date range, or sender.',
            parameters: {
              type: 'object',
              properties: {
                unreadOnly: { type: 'boolean', description: 'If true, only show unread emails', default: false },
                folder: { type: 'string', description: 'Folder name (inbox, drafts, sent, deleted, etc.)', default: 'inbox' },
                top: { type: 'number', description: 'Maximum number of emails to return', default: 10 }
              }
            }
          }
        },
        execute: async (params, context) => {
          const folder = params.folder || 'inbox';
          const unreadOnly = params.unreadOnly === true;
          const top = params.top || 10;
          
          console.log(`[MicrosoftAgent] 📧 Listing emails from ${folder}${unreadOnly ? ' (unread only)' : ''}...`);
          try {
            const result = await microsoftService.listEmails(context.userId, {
              folder,
              unreadOnly,
              top: Math.min(top, 100)
            });
            
            if (!result.success) {
              throw new Error(result.error || 'Failed to list emails');
            }
            
            console.log(`[MicrosoftAgent] ✅ Found ${result.count} emails`);
            return {
              success: true,
              emails: result.emails,
              count: result.count,
              folder: result.folder,
              unreadOnly: result.unreadOnly,
              summary: `Found ${result.count} ${result.unreadOnly ? 'unread ' : ''}emails in ${result.folder}`
            };
          } catch (error) {
            console.error(`[MicrosoftAgent] ❌ Error listing emails:`, error.message);
            return {
              success: false,
              error: error.message,
              emails: [],
              count: 0
            };
          }
        }
      },

      searchEmails: {
        definition: {
          type: 'function',
          function: {
            name: 'searchEmails',
            description: 'Search for emails by subject, sender, or keywords. Use this to find a specific email before deleting, replying, or forwarding it.',
            parameters: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query (can be subject line, sender name, keywords, file names, etc.)' },
                folder: { type: 'string', description: 'Folder to search in (inbox, sent, drafts, deleted, etc.)', default: 'inbox' },
                top: { type: 'number', description: 'Maximum number of results to return', default: 20 }
              },
              required: ['query']
            }
          }
        },
        execute: async (params, context) => {
          const query = params.query;
          const folder = params.folder || 'inbox';
          const top = params.top || 20;
          
          console.log(`[MicrosoftAgent] 🔍 Searching for emails: "${query}"`);
          try {
            const result = await microsoftService.searchEmails(context.userId, query, {
              folder,
              top: Math.min(top, 100)
            });
            
            if (!result.success) {
              throw new Error(result.error || 'Failed to search emails');
            }
            
            console.log(`[MicrosoftAgent] ✅ Found ${result.count} matching emails`);
            return {
              success: true,
              query: query,
              emails: result.emails,
              count: result.count,
              folder: result.folder,
              summary: `Found ${result.count} email(s) matching "${query}"`
            };
          } catch (error) {
            console.error(`[MicrosoftAgent] ❌ Error searching emails:`, error.message);
            return {
              success: false,
              error: error.message,
              query: query,
              emails: [],
              count: 0
            };
          }
        }
      },

      readEmail: {
        definition: {
          type: 'function',
          function: {
            name: 'readEmail',
            description: 'Read the full content of a specific email',
            parameters: {
              type: 'object',
              properties: {
                messageId: { type: 'string', description: 'The ID of the email to read' }
              },
              required: ['messageId']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[MicrosoftAgent] 📖 Reading email: ${params.messageId}`);
          try {
            const email = await microsoftService.getEmail(context.userId, params.messageId);
            console.log(`[MicrosoftAgent] ✅ Email read successfully`);
            return { success: true, email };
          } catch (error) {
            console.error(`[MicrosoftAgent] ❌ Error reading email:`, error.message);
            throw error;
          }
        }
      },

      listMailFolders: {
        definition: {
          type: 'function',
          function: {
            name: 'listMailFolders',
            description: 'List all mail folders in Outlook (inbox, drafts, sent, deleted, junk, archive, custom folders)',
            parameters: {
              type: 'object',
              properties: {
                includeUnreadCount: { type: 'boolean', description: 'Include unread email count for each folder', default: true }
              }
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[MicrosoftAgent] 📁 Listing mail folders...`);
          try {
            const result = await microsoftService.listMailFolders(context.userId, params);
            
            if (!result.success) {
              throw new Error(result.error || 'Failed to list folders');
            }
            
            console.log(`[MicrosoftAgent] ✅ Retrieved ${result.count} folders`);
            return {
              success: true,
              folders: result.folders,
              count: result.count,
              summary: `Retrieved ${result.count} mail folders`
            };
          } catch (error) {
            console.error(`[MicrosoftAgent] ❌ Error listing folders:`, error.message);
            return {
              success: false,
              error: error.message,
              folders: [],
              count: 0
            };
          }
        }
      },

      markEmailAsRead: {
        definition: {
          type: 'function',
          function: {
            name: 'markEmailAsRead',
            description: 'Mark an email as read',
            parameters: {
              type: 'object',
              properties: {
                messageId: { type: 'string', description: 'The ID of the email to mark as read' }
              },
              required: ['messageId']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[MicrosoftAgent] ✔️ Marking email as read: ${params.messageId}`);
          try {
            const result = await microsoftService.markEmailRead(context.userId, params.messageId);
            console.log(`[MicrosoftAgent] ✅ Email marked as read`);
            return result;
          } catch (error) {
            console.error(`[MicrosoftAgent] ❌ Error marking email as read:`, error.message);
            throw error;
          }
        }
      },

      markEmailAsUnread: {
        definition: {
          type: 'function',
          function: {
            name: 'markEmailAsUnread',
            description: 'Mark an email as unread',
            parameters: {
              type: 'object',
              properties: {
                messageId: { type: 'string', description: 'The ID of the email to mark as unread' }
              },
              required: ['messageId']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[MicrosoftAgent] 📍 Marking email as unread: ${params.messageId}`);
          try {
            const result = await microsoftService.markEmailUnread(context.userId, params.messageId);
            console.log(`[MicrosoftAgent] ✅ Email marked as unread`);
            return result;
          } catch (error) {
            console.error(`[MicrosoftAgent] ❌ Error marking email as unread:`, error.message);
            throw error;
          }
        }
      },

      replyToEmail: {
        definition: {
          type: 'function',
          function: {
            name: 'replyToEmail',
            description: 'Reply to an email',
            parameters: {
              type: 'object',
              properties: {
                messageId: { type: 'string', description: 'The ID of the email to reply to' },
                body: { type: 'string', description: 'Reply message body' }
              },
              required: ['messageId', 'body']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[MicrosoftAgent] 💬 Replying to email: ${params.messageId}`);
          try {
            const result = await microsoftService.replyToEmail(context.userId, params.messageId, params.body);
            console.log(`[MicrosoftAgent] ✅ Reply sent successfully`);
            return result;
          } catch (error) {
            console.error(`[MicrosoftAgent] ❌ Error replying to email:`, error.message);
            throw error;
          }
        }
      },

      forwardEmail: {
        definition: {
          type: 'function',
          function: {
            name: 'forwardEmail',
            description: 'Forward an email to recipients',
            parameters: {
              type: 'object',
              properties: {
                messageId: { type: 'string', description: 'The ID of the email to forward' },
                toRecipients: { type: 'array', items: { type: 'string' }, description: 'Email addresses to forward to' },
                comment: { type: 'string', description: 'Optional comment/message to add' }
              },
              required: ['messageId', 'toRecipients']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[MicrosoftAgent] ➡️ Forwarding email: ${params.messageId}`);
          try {
            const result = await microsoftService.forwardEmail(context.userId, params);
            console.log(`[MicrosoftAgent] ✅ Email forwarded successfully`);
            return result;
          } catch (error) {
            console.error(`[MicrosoftAgent] ❌ Error forwarding email:`, error.message);
            throw error;
          }
        }
      },

      deleteEmail: {
        definition: {
          type: 'function',
          function: {
            name: 'deleteEmail',
            description: 'Delete an email (moves to deleted items)',
            parameters: {
              type: 'object',
              properties: {
                messageId: { type: 'string', description: 'The ID of the email to delete' }
              },
              required: ['messageId']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[MicrosoftAgent] 🗑️ Deleting email: ${params.messageId}`);
          try {
            const result = await microsoftService.deleteEmail(context.userId, params.messageId);
            console.log(`[MicrosoftAgent] ✅ Email deleted successfully`);
            return result;
          } catch (error) {
            console.error(`[MicrosoftAgent] ❌ Error deleting email:`, error.message);
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

⚠️ **CRITICAL: CREATE vs UPDATE RULES** ⚠️
   These rules MUST be followed to avoid errors:
   
   1. **IF A DOCUMENT ID IS PROVIDED** (e.g., "id=XYZ" or "documentId=ABC"):
      ✅ MUST use updateWordDocumentContent
      ❌ NEVER use createDocument
      → Example: "add content to doc (id=abc123)" → Use updateWordDocumentContent({ documentId: 'abc123', content: '...' })
   
   2. **IF NO DOCUMENT ID IS PROVIDED**:
      ✅ MUST use createDocument to create a new document first
      ❌ NEVER use updateWordDocumentContent without a documentId
      → Example: "create a word document with title XYZ" → Use createDocument({ title: 'XYZ', content: '...' })
   
   3. **SAFETY GUARDS**:
      ❌ NEVER call createDocument when documentId is already known/provided
      ❌ NEVER call addDataToExcel on a Word document (.docx file)
      ❌ NEVER call Excel tools if file is identified as Word format
      ❌ NEVER ignore file extensions - they determine the correct tool
   
   4. **FILE TYPE DETECTION**:
      - .docx or .doc extension → Use Word tools ONLY (createDocument, updateWordDocumentContent)
      - .xlsx or .xls extension → Use Excel tools ONLY (createExcelWorkbook, addDataToExcel)
      - Don't mix tools between document types

🎯 **CRITICAL: COMPLETE ALL TASKS IN THE USER'S QUERY**
   - If the user asks to "create X and do Y", you MUST complete BOTH tasks sequentially
   - Do NOT stop after completing just the first task
   - Example: "create a workbook and add data" requires TWO actions:
     1. createExcelWorkbook
     2. addDataToExcel (using the workbookId from step 1)
   - ALWAYS check if there are multiple tasks in the query before stopping

1. **Word Document Operations** - NEW ENHANCED WORKFLOW
   
   **Creating New Documents**:
   - Use createDocument({ title: "Document Name", content: "optional content" })
   - Creates a new .docx file in OneDrive
   - Returns { documentId: "...", title: "...", url: "..." }
   
   **Updating Existing Documents**:
   - Use updateWordDocumentContent({ documentId: "...", content: "...", mode: "append|replace" })
   - mode="append" → Adds content below existing content with separator
   - mode="replace" → Replaces entire document content
   - ⚠️ CRITICAL: ALWAYS require documentId parameter
   - ⚠️ NEVER create duplicate if document already exists
   
   **Multi-Step Document Workflow**:
   Example: "Create a Word document titled 'Final Report' and add details about our project"
   Step 1: createDocument({ title: "Final Report", content: "Initial section" })
   Result: { documentId: "xyz789", title: "Final Report.docx", url: "..." }
   Step 2: updateWordDocumentContent({ documentId: "xyz789", content: "More details about project...", mode: "append" })
   Result: { documentId: "xyz789", message: "Document updated successfully" }

2. **Email Management (Outlook) - CRITICAL MULTI-STEP WORKFLOW**
   
   ⚠️ **IMPORTANT - Finding Emails by Subject/Sender:**
   When user asks to "delete/reply to/forward email [subject line]", you MUST:
   1. FIRST use searchEmails({ query: "[subject line]" }) to find the email
   2. Get the email ID from the search results
   3. THEN use deleteEmail/replyToEmail/forwardEmail with that ID
   Example: "delete the mail Re: Agile Methodology.docx"
   Step 1: searchEmails({ query: "Re: Agile Methodology" })
   Result: { emails: [{ id: "real-message-id-123", subject: "Re: Agile Methodology.docx" }] }
   Step 2: deleteEmail({ messageId: "real-message-id-123" })
   ✅ CRITICAL: ALWAYS search first to get the real ID!
   ❌ NEVER make up or guess message IDs - they must come from search results!
   
   ⚠️ **OPERATIONS:**
   - **View Emails**: Use listEmails to show inbox emails, with unreadOnly=true for unread emails
   - **Search Emails**: Use searchEmails({ query: "keywords/subject" }) to find specific emails
   - **Read Email**: Use readEmail to get full content of a specific email
   - **Send Email**: Use createEmail to send emails
   - **Reply**: Use replyToEmail (AFTER searching for the email to get its ID)
   - **Forward**: Use forwardEmail (AFTER searching for the email to get its ID)
   - **Delete**: Use deleteEmail (AFTER searching for the email to get its ID)
   - **Mark as Read/Unread**: Use markEmailAsRead or markEmailAsUnread
   - **View Folders**: Use listMailFolders to show all mail folders with unread counts

3. **Document Creation**
   - Create Word documents for text content
   - Create Excel workbooks for data
   - Include title and optional initial content
   - **EXCEL SPECIFIC**: If asked to add data/sample data, use addDataToExcel AFTER creating the workbook

4. **Multi-Step Examples**
   
   Example 1: "Create a Word document and send it via email"
   Step 1: createDocument({ title: "Report" })
   Result: { documentId: "abc123", url: "..." }
   Step 2: createEmail({ to: "john@example.com", subject: "Report", body: "..." })
   Result: { success: true }
   
   Example 2: "Create an Excel workbook titled 'Sales' and add sample data"
   Step 1: createExcelWorkbook({ title: "Sales" })
   Result: { workbookId: "01ABCDEF1234567890", id: "01ABCDEF1234567890", title: "Sales.xlsx", url: "..." }
   
   Step 2: addDataToExcel({ workbookId: "01ABCDEF1234567890", title: "Sales" })
   ⚠️ CRITICAL: Use the ACTUAL workbookId from Step 1 result (the long ID string)
   ⚠️ NEVER use the title ("Sales" or "Sales.xlsx") as the workbookId
   ⚠️ IMPORTANT: Pass the title from Step 1 to generate contextually appropriate sample data
   Result: { success: true, rowsAdded: 10 }

4. **Communication**
   - Send emails via Outlook (use createEmail)
   - Send Teams messages
   - Create calendar events
   
   **CRITICAL - Email Address Extraction:**
   - If the query mentions a person's name but NO email address, you MUST check the conversation history
   - Look for messages that mention the person's email address (e.g., "John's email is john@example.com")
   - Search for patterns like: "email is", "email:", "contact:", "@gmail.com", "@outlook.com", etc.
   - NEVER make up or guess email addresses (like "name@example.com")
   - If you cannot find the email address in the query OR conversation history, ask the user for it
   - Examples of references: "send to this email", "share with that person", "email them"

5. **Storage**
   - Create OneDrive folders
   - Organize files and documents`;
  }

  /**
   * Validate tool usage to prevent CREATE/UPDATE confusion
   * @param {string} toolName - Name of the tool being used
   * @param {object} params - Tool parameters
   * @returns {object} Validation result { valid: boolean, error?: string }
   */
  validateToolUsage(toolName, params = {}) {
    // Rule 1: If documentId is provided, only updateWordDocumentContent is allowed
    if (params.documentId && toolName === 'createDocument') {
      return {
        valid: false,
        error: 'Cannot use createDocument when documentId is provided. Use updateWordDocumentContent instead.'
      };
    }
    
    // Rule 2: If trying to update a document, documentId must be provided
    if (toolName === 'updateWordDocumentContent' && !params.documentId) {
      return {
        valid: false,
        error: 'updateWordDocumentContent requires a documentId parameter.'
      };
    }
    
    // Rule 3: Don't mix Excel tools on Word documents
    if (toolName === 'addDataToExcel' && params.fileName && params.fileName.endsWith('.docx')) {
      return {
        valid: false,
        error: 'Cannot use Excel tools on a Word document (.docx). Use updateWordDocumentContent instead.'
      };
    }
    
    return { valid: true };
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
