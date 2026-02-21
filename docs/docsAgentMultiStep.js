/**
 * Google Docs Agent - Multi-Step Execution Version
 * 
 * This is the PRODUCTION version that should replace the old docsAgent.js
 * It extends BaseAgent to support sequential multi-step operations.
 * 
 * Handles queries like:
 * - "Create a doc titled 'Plan' and add an introduction section"
 * - "Create a document, add content, and share it with john@example.com"
 * - "Make a doc, add a title, add sections, and format it"
 */

const BaseAgent = require('../base/BaseAgent');
const docsService = require('./docsService');
const OpenAI = require('openai');

class DocsAgentMultiStep extends BaseAgent {
  constructor(llmClient) {
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
          console.log(`[DocsAgent] 📝 Creating document: "${params.title}"`);
          
          try {
            const doc = await docsService.createDocument(
              context.userId,
              params.title,
              params.initialContent || ''
            );

            console.log(`[DocsAgent] ✅ Document created: ${doc.documentId}`);
            
            return {
              success: true,
              documentId: doc.documentId,
              url: doc.url,
              title: doc.title,
              createdAt: new Date().toISOString()
            };
          } catch (error) {
            console.error(`[DocsAgent] ❌ Error creating document:`, error.message);
            throw error;
          }
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
          console.log(`[DocsAgent] 📝 Appending text to document: ${params.documentId}`);
          
          try {
            await docsService.appendText(
              context.userId,
              params.documentId,
              params.text
            );

            console.log(`[DocsAgent] ✅ Text appended successfully`);
            
            return {
              success: true,
              documentId: params.documentId,
              message: 'Text appended successfully'
            };
          } catch (error) {
            console.error(`[DocsAgent] ❌ Error appending text:`, error.message);
            throw error;
          }
        }
      },

      appendFormattedText: {
        definition: {
          type: 'function',
          function: {
            name: 'appendFormattedText',
            description: 'Append formatted content to a document with proper headings, bullet points, and styling. Use markdown syntax: # for H1, ## for H2, ### for H3, - for bullets, 1. for numbered lists, **text** for bold.',
            parameters: {
              type: 'object',
              properties: {
                documentId: {
                  type: 'string',
                  description: 'The ID of the document to append to'
                },
                content: {
                  type: 'string',
                  description: 'Markdown-formatted content. Use # for headings, - for bullets, **text** for bold'
                }
              },
              required: ['documentId', 'content']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[DocsAgent] 📝 Appending formatted content to document: ${params.documentId}`);
          
          try {
            await docsService.appendFormattedText(
              context.userId,
              params.documentId,
              params.content
            );

            console.log(`[DocsAgent] ✅ Formatted content appended successfully`);
            
            return {
              success: true,
              documentId: params.documentId,
              message: 'Formatted content appended successfully'
            };
          } catch (error) {
            console.error(`[DocsAgent] ❌ Error appending formatted content:`, error.message);
            throw error;
          }
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
          console.log(`[DocsAgent] 📝 Inserting text at position ${params.index || 1}`);
          
          try {
            await docsService.insertText(
              context.userId,
              params.documentId,
              params.text,
              params.index || 1
            );

            console.log(`[DocsAgent] ✅ Text inserted successfully`);
            
            return {
              success: true,
              documentId: params.documentId,
              message: 'Text inserted successfully'
            };
          } catch (error) {
            console.error(`[DocsAgent] ❌ Error inserting text:`, error.message);
            throw error;
          }
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
          console.log(`[DocsAgent] 🔄 Replacing text in document`);
          
          try {
            await docsService.replaceText(
              context.userId,
              params.documentId,
              params.searchText,
              params.replaceText
            );

            console.log(`[DocsAgent] ✅ Text replaced successfully`);
            
            return {
              success: true,
              documentId: params.documentId,
              message: 'Text replaced successfully'
            };
          } catch (error) {
            console.error(`[DocsAgent] ❌ Error replacing text:`, error.message);
            throw error;
          }
        }
      },

      formatText: {
        definition: {
          type: 'function',
          function: {
            name: 'formatText',
            description: 'Format text in a document by applying bold, italic, underline, or other styling. Note: This searches for the text and formats ALL occurrences.',
            parameters: {
              type: 'object',
              properties: {
                documentId: {
                  type: 'string',
                  description: 'The ID of the document'
                },
                searchText: {
                  type: 'string',
                  description: 'The text to format (will format all occurrences)'
                },
                formatting: {
                  type: 'object',
                  description: 'Formatting options',
                  properties: {
                    bold: { type: 'boolean', description: 'Make text bold' },
                    italic: { type: 'boolean', description: 'Make text italic' },
                    underline: { type: 'boolean', description: 'Underline text' },
                    fontSize: { type: 'number', description: 'Font size in points' },
                    fontColor: { type: 'string', description: 'Font color in hex format (e.g., #FF0000)' }
                  }
                }
              },
              required: ['documentId', 'searchText', 'formatting']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[DocsAgent] 🎨 Formatting text in document`);
          
          try {
            // First, read the document to find the text
            const docData = await docsService.readDocument(context.userId, params.documentId);
            
            if (!docData.success) {
              throw new Error('Failed to read document');
            }

            // Search for the text in the document
            const searchResult = await docsService.searchInDocument(
              context.userId,
              params.documentId,
              params.searchText
            );

            if (!searchResult.success || searchResult.matches.length === 0) {
              throw new Error(`Text "${params.searchText}" not found in document`);
            }

            // Format each occurrence
            const formatPromises = searchResult.matches.map(match => {
              return docsService.updateTextStyle(
                context.userId,
                params.documentId,
                match.startIndex,
                match.endIndex,
                params.formatting
              );
            });

            await Promise.all(formatPromises);

            console.log(`[DocsAgent] ✅ Text formatted successfully (${searchResult.matches.length} occurrences)`);
            
            return {
              success: true,
              documentId: params.documentId,
              formattedCount: searchResult.matches.length,
              message: `Formatted ${searchResult.matches.length} occurrence(s) of "${params.searchText}"`
            };
          } catch (error) {
            console.error(`[DocsAgent] ❌ Error formatting text:`, error.message);
            throw error;
          }
        }
      },

      insertTable: {
        definition: {
          type: 'function',
          function: {
            name: 'insertTable',
            description: 'Insert a proper Google Docs table into the document with specified rows and columns',
            parameters: {
              type: 'object',
              properties: {
                documentId: {
                  type: 'string',
                  description: 'The ID of the document'
                },
                rows: {
                  type: 'number',
                  description: 'Number of rows',
                  default: 3
                },
                columns: {
                  type: 'number',
                  description: 'Number of columns',
                  default: 3
                }
              },
              required: ['documentId']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[DocsAgent] 📊 Inserting table into document`);
          
          try {
            const result = await docsService.insertTable(
              context.userId,
              params.documentId,
              params.rows || 3,
              params.columns || 3
            );

            if (!result.success) {
              throw new Error(result.error || 'Failed to insert table');
            }

            console.log(`[DocsAgent] ✅ Table inserted successfully`);
            
            return {
              success: true,
              documentId: params.documentId,
              rows: result.rows,
              columns: result.columns,
              message: result.message
            };
          } catch (error) {
            console.error(`[DocsAgent] ❌ Error inserting table:`, error.message);
            throw error;
          }
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
          console.log(`[DocsAgent] 👥 Sharing document with ${params.email}`);
          
          try {
            await docsService.shareDocument(
              context.userId,
              params.documentId,
              params.email,
              params.role
            );

            console.log(`[DocsAgent] ✅ Document shared successfully`);
            
            return {
              success: true,
              documentId: params.documentId,
              sharedWith: params.email,
              role: params.role
            };
          } catch (error) {
            console.error(`[DocsAgent] ❌ Error sharing document:`, error.message);
            throw error;
          }
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
          console.log(`[DocsAgent] 🗑️ Deleting document: ${params.documentId}`);
          
          try {
            await docsService.deleteDocument(context.userId, params.documentId);

            console.log(`[DocsAgent] ✅ Document deleted successfully`);
            
            return {
              success: true,
              documentId: params.documentId,
              message: 'Document deleted successfully'
            };
          } catch (error) {
            console.error(`[DocsAgent] ❌ Error deleting document:`, error.message);
            throw error;
          }
        }
      }
    };

    // Initialize BaseAgent with tools
    super('DocsAgent', tools, llmClient || new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));
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
   - Use appendFormattedText to add formatted content (PREFERRED for structured content)
   - Use appendText to add plain text to the end of a document
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
   
   Step 2: appendFormattedText({ documentId: "abc123", content: "# Introduction\\n\\nThis is the introduction." })
   Result: { success: true }
   
   Step 3: No more tools needed
   Execution complete

6. **Always Return Document URLs**
   - Users need to access their documents
   - Include URLs in results when available

7. **For Introduction Sections**
   - Use markdown formatting with # for heading
   - Example: "# Introduction\\n\\nThis document outlines..."`;
  }

  /**
   * Wrapper to maintain compatibility with old processQuery interface
   * Converts old interface to new BaseAgent interface
   */
  async processQuery(query, userId, options = {}) {
    console.log(`[DocsAgent] 🚀 Processing query (multi-step): "${query}"`);
    
    // Call BaseAgent's multi-step execution with userId in context
    const result = await super.processQuery(query, {
      userId: userId,
      conversationId: options.conversationId,
      maxIterations: options.maxIterations || 15,
      forceToolExecution: options.forceToolExecution  // ✅ CRITICAL: Pass forceToolExecution to BaseAgent
    });

    // Convert BaseAgent result to old format for backward compatibility
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

module.exports = DocsAgentMultiStep;
