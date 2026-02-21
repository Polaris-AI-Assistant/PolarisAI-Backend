/**
 * Google Docs Agent V2 - Multi-Step Execution
 * 
 * Extends BaseAgent to support sequential multi-step operations.
 * Handles queries like:
 * - "Create a doc titled 'Plan' and add an introduction section"
 * - "Create a document, add content, and share it with john@example.com"
 * - "Make a doc, add a title, add sections, and format it"
 */

const BaseAgent = require('../base/BaseAgent');
const docsService = require('./docsService');
const OpenAI = require('openai');

class DocsAgentV2 extends BaseAgent {
  constructor(llmClient, userAccessToken) {
    // Define tools with definition + execute pattern
    const tools = {
      createDocument: {
        definition: {
          type: 'function',
          function: {
            name: 'createDocument',
            description: 'Create a new Google Document with a specific title',
            parameters: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  description: 'The title for the new document'
                },
                initialContent: {
                  type: 'string',
                  description: 'Optional initial content to add to the document'
                }
              },
              required: ['title']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[DocsAgentV2] 📝 Creating document: "${params.title}"`);
          
          const doc = await docsService.createDocument(
            userAccessToken,
            params.title,
            params.initialContent || ''
          );

          console.log(`[DocsAgentV2] ✅ Document created: ${doc.documentId}`);
          
          return {
            documentId: doc.documentId,
            url: doc.url,
            title: doc.title,
            createdAt: new Date().toISOString()
          };
        }
      },

      appendText: {
        definition: {
          type: 'function',
          function: {
            name: 'appendText',
            description: 'Append text to the end of a document',
            parameters: {
              type: 'object',
              properties: {
                documentId: {
                  type: 'string',
                  description: 'The ID of the document to append to'
                },
                text: {
                  type: 'string',
                  description: 'The text to append'
                }
              },
              required: ['documentId', 'text']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[DocsAgentV2] 📝 Appending text to document: ${params.documentId}`);
          
          await docsService.appendText(
            userAccessToken,
            params.documentId,
            params.text
          );

          console.log(`[DocsAgentV2] ✅ Text appended successfully`);
          
          return {
            success: true,
            documentId: params.documentId,
            message: 'Text appended successfully'
          };
        }
      },

      insertText: {
        definition: {
          type: 'function',
          function: {
            name: 'insertText',
            description: 'Insert text at a specific position in a document',
            parameters: {
              type: 'object',
              properties: {
                documentId: {
                  type: 'string',
                  description: 'The ID of the document'
                },
                text: {
                  type: 'string',
                  description: 'The text to insert'
                },
                index: {
                  type: 'number',
                  description: 'The position to insert text (default: 1 for beginning)'
                }
              },
              required: ['documentId', 'text']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[DocsAgentV2] 📝 Inserting text at position ${params.index || 1}`);
          
          await docsService.insertText(
            userAccessToken,
            params.documentId,
            params.text,
            params.index || 1
          );

          console.log(`[DocsAgentV2] ✅ Text inserted successfully`);
          
          return {
            success: true,
            documentId: params.documentId,
            message: 'Text inserted successfully'
          };
        }
      },

      replaceText: {
        definition: {
          type: 'function',
          function: {
            name: 'replaceText',
            description: 'Replace text in a document',
            parameters: {
              type: 'object',
              properties: {
                documentId: {
                  type: 'string',
                  description: 'The ID of the document'
                },
                searchText: {
                  type: 'string',
                  description: 'The text to search for'
                },
                replaceText: {
                  type: 'string',
                  description: 'The text to replace it with'
                }
              },
              required: ['documentId', 'searchText', 'replaceText']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[DocsAgentV2] 🔄 Replacing text in document`);
          
          await docsService.replaceText(
            userAccessToken,
            params.documentId,
            params.searchText,
            params.replaceText
          );

          console.log(`[DocsAgentV2] ✅ Text replaced successfully`);
          
          return {
            success: true,
            documentId: params.documentId,
            message: 'Text replaced successfully'
          };
        }
      },

      formatText: {
        definition: {
          type: 'function',
          function: {
            name: 'formatText',
            description: 'Format text in a document (bold, italic, underline, etc.)',
            parameters: {
              type: 'object',
              properties: {
                documentId: {
                  type: 'string',
                  description: 'The ID of the document'
                },
                searchText: {
                  type: 'string',
                  description: 'The text to format'
                },
                formatting: {
                  type: 'object',
                  description: 'Formatting options',
                  properties: {
                    bold: { type: 'boolean' },
                    italic: { type: 'boolean' },
                    underline: { type: 'boolean' },
                    fontSize: { type: 'number' },
                    fontColor: { type: 'string' }
                  }
                }
              },
              required: ['documentId', 'searchText', 'formatting']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[DocsAgentV2] 🎨 Formatting text in document`);
          
          await docsService.formatText(
            userAccessToken,
            params.documentId,
            params.searchText,
            params.formatting
          );

          console.log(`[DocsAgentV2] ✅ Text formatted successfully`);
          
          return {
            success: true,
            documentId: params.documentId,
            message: 'Text formatted successfully'
          };
        }
      },

      shareDocument: {
        definition: {
          type: 'function',
          function: {
            name: 'shareDocument',
            description: 'Share a document with someone',
            parameters: {
              type: 'object',
              properties: {
                documentId: {
                  type: 'string',
                  description: 'The ID of the document to share'
                },
                email: {
                  type: 'string',
                  description: 'Email address to share with'
                },
                role: {
                  type: 'string',
                  enum: ['reader', 'writer', 'commenter'],
                  description: 'Permission level'
                }
              },
              required: ['documentId', 'email', 'role']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[DocsAgentV2] 👥 Sharing document with ${params.email}`);
          
          await docsService.shareDocument(
            userAccessToken,
            params.documentId,
            params.email,
            params.role
          );

          console.log(`[DocsAgentV2] ✅ Document shared successfully`);
          
          return {
            success: true,
            documentId: params.documentId,
            sharedWith: params.email,
            role: params.role
          };
        }
      },

      deleteDocument: {
        definition: {
          type: 'function',
          function: {
            name: 'deleteDocument',
            description: 'Delete a Google Document',
            parameters: {
              type: 'object',
              properties: {
                documentId: {
                  type: 'string',
                  description: 'The ID of the document to delete'
                }
              },
              required: ['documentId']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[DocsAgentV2] 🗑️ Deleting document: ${params.documentId}`);
          
          await docsService.deleteDocument(userAccessToken, params.documentId);

          console.log(`[DocsAgentV2] ✅ Document deleted successfully`);
          
          return {
            success: true,
            documentId: params.documentId,
            message: 'Document deleted successfully'
          };
        }
      }
    };

    // Initialize BaseAgent with tools
    super('DocsAgent', tools, llmClient || new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));
    this.userAccessToken = userAccessToken;
  }

  /**
   * Override system prompt with Google Docs specific instructions
   */
  getSystemPrompt() {
    const basePrompt = super.getSystemPrompt();
    
    return `${basePrompt}

GOOGLE DOCS SPECIFIC GUIDELINES:

1. **Document Creation**
   - Always create a document first if the user wants to create one
   - You can optionally include initial content when creating
   - Document IDs are returned after creation - use them for subsequent operations

2. **Content Operations**
   - Use appendText to add content to the end of a document
   - Use insertText to add content at a specific position
   - Use replaceText to modify existing content
   - Always use the actual documentId from the previous step

3. **Formatting**
   - Use formatText to apply formatting (bold, italic, underline, etc.)
   - Formatting requires the exact text to format

4. **Sharing**
   - Use shareDocument to share with others
   - Specify the role: 'reader' (view only), 'writer' (can edit), 'commenter' (can comment)

5. **Multi-Step Example**
   User: "Create a doc titled 'Plan' and add an introduction section"
   
   Step 1: createDocument({ title: "Plan" })
   Result: { documentId: "abc123", url: "https://..." }
   
   Step 2: appendText({ documentId: "abc123", text: "# Introduction\\n\\nThis is the introduction." })
   Result: { success: true }
   
   Done: No more tools needed

6. **Always Return Document URLs**
   - Users need to access their documents
   - Include URLs in results when available`;
  }
}

module.exports = DocsAgentV2;
