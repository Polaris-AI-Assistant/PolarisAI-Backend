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
              url: doc.documentUrl,  // Fixed: was doc.url, should be doc.documentUrl
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
      },

      listDocuments: {
        definition: {
          type: 'function',
          function: {
            name: 'listDocuments',
            description: 'List all Google Documents for the user, optionally filtered by sorting options',
            parameters: {
              type: 'object',
              properties: {
                sortBy: {
                  type: 'string',
                  enum: ['name', 'time', 'starred'],
                  description: 'Sort results by name, modification time, or starred status. Default: time (most recent first)'
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of documents to return. Default: 10'
                }
              }
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[DocsAgent] 📋 Listing documents (sortBy: ${params.sortBy || 'time'}, limit: ${params.limit || 10})`);
          
          try {
            const result = await docsService.listDocuments(context.userId, {
              sortBy: params.sortBy || 'modifiedTime',
              limit: params.limit || 10
            });

            if (!result.success) {
              console.error(`[DocsAgent] ❌ Failed to list documents:`, result.error);
              throw new Error(result.error || 'Failed to list documents');
            }

            const documents = result.documents || [];
            console.log(`[DocsAgent] ✅ Retrieved ${documents.length} documents`);
            
            return {
              success: true,
              count: documents.length,
              documents: documents.map(doc => ({
                id: doc.documentId || doc.id,
                name: doc.title || doc.name,
                url: doc.url || `https://docs.google.com/document/d/${doc.documentId || doc.id}/edit`,
                createdTime: doc.createdTime,
                modifiedTime: doc.modifiedTime,
                owners: doc.owners ? doc.owners.map(o => o.displayName || o.emailAddress) : []
              }))
            };
          } catch (error) {
            console.error(`[DocsAgent] ❌ Error listing documents:`, error.message);
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

3. **CRITICAL: Auto-Generate Content When Requested**
   **IF the user asks to:**
   - "add content according to its title"
   - "add content to it" (after creating a document)
   - "create a doc about X and add content"
   - "create a doc titled Y and populate it"
   
   **THEN YOU MUST:**
   - Generate comprehensive, well-structured content based on the document title/topic
   - Use your knowledge to create professional, informative content (2-3 paragraphs minimum)
   - Format it properly using markdown (# for headings, ## for subheadings, **text** for bold, - for bullets)
   - Call appendFormattedText with the generated content
   - DO NOT ask the user what content to add - generate it yourself!
   
   **Example:**
   Document title: "Pattern Recognition"
   You should generate comprehensive content like:
   
   # Pattern Recognition
   
   ## Introduction
   
   Pattern recognition is a fundamental aspect of machine learning and artificial intelligence focused on identifying patterns and regularities in data. It involves the automated recognition of patterns and regularities in data through the use of algorithms and statistical techniques.
   
   ## Key Concepts
   
   - **Classification**: Assigning input data to predefined categories
   - **Feature Extraction**: Identifying relevant characteristics of the data
   - **Training Data**: Using labeled examples to teach recognition models
   - **Neural Networks**: Advanced architectures for complex pattern detection
   
   ## Applications
   
   Pattern recognition is widely used in:
   - Image and facial recognition systems
   - Speech recognition and natural language processing
   - Medical diagnosis and bioinformatics
   - Fraud detection and cybersecurity


4. **Formatting**
   - Use formatText to apply formatting (bold, italic, underline, etc.)
   - Formatting requires the exact text to format

5. **Sharing**
   - Use shareDocument to share with others
   - Specify the role: 'reader' (view only), 'writer' (can edit), 'commenter' (can comment)

6. **Multi-Step Example**
   User: "Create a doc titled 'Plan' and add an introduction section"
   
   Step 1: createDocument({ title: "Plan" })
   Result: { documentId: "abc123", url: "https://..." }
   
   Step 2: appendFormattedText({ documentId: "abc123", content: "# Introduction\\n\\nThis is the introduction." })
   Result: { success: true }
   
   Step 3: No more tools needed
   Execution complete

7. **Always Return Document URLs**
   - Users need to access their documents
   - Include URLs in results when available

8. **For Introduction Sections**
   - Use markdown formatting with # for heading
   - Example: "# Introduction\\n\\nThis document outlines..."

9. **CRITICAL: Smart Content Formatting Based on Search Results**
   
   When you receive search results from a previous action, AUTOMATICALLY detect the content type and format appropriately:
   
   **For ACADEMIC PAPERS** (when URLs contain arxiv.org, semanticscholar.org, scholar.google.com, doi.org, etc.):
   - Title: Use a descriptive title like "Machine Learning Research Papers" or "Top Papers on [Topic]"
   - Format each result as:
     ## [Number]. [Paper Title]
     **Link:** [URL]
     **Summary:** [Snippet/Description]
     ---
   
   **For NEWS ARTICLES** (when URLs contain news sites, dates are recent):
   - Title: "Latest News: [Topic]" or "News Summary: [Topic]"
   - Format: Headline, Date, Source, Summary
   
   **For GENERAL RESULTS** (mixed content):
   - Title: "Search Results: [Topic]" or "[Topic] Resources"
   - Format: Title, Description, Link
   
   **IMPORTANT:**
   - Detect the content type from the URLs and snippets automatically
   - Use appropriate formatting without asking the user
   - Include all relevant information from search results
   - Make the document well-structured and easy to read
   - Use markdown formatting (headers, bold, links, etc.)
   - This is a DOCUMENT, not an email - do NOT add email signatures, greetings, or "Best Regards"
   - Focus on clean, professional document formatting`;
  }

  /**
   * Wrapper to maintain compatibility with old processQuery interface
   * Supports both old (query, userId, options) and new (query, context) signatures
   * 
   * ✅ RENDER-ONLY MODE: If context.researchContent is provided with contentProvided: true,
   * this will skip LLM generation and directly render the content into a document.
   */
  async processQuery(query, userIdOrContext, options = {}) {
    console.log(`[DocsAgent] 🚀 Processing query (multi-step): "${query}"`);
    
    // Detect which signature is being used
    let context;
    if (typeof userIdOrContext === 'string') {
      // Old signature: (query, userId, options)
      context = {
        userId: userIdOrContext,
        conversationId: options.conversationId,
        maxIterations: options.maxIterations || 15,
        forceToolExecution: options.forceToolExecution,
        conversationHistory: options.conversationHistory,
        researchContent: options.researchContent  // ✅ Pass through research content
      };
    } else if (typeof userIdOrContext === 'object') {
      // New signature: (query, context)
      context = userIdOrContext;
    } else {
      throw new Error(`Invalid processQuery signature: second parameter must be string (userId) or object (context)`);
    }
    
    // ✅ DEBUG: Log context to see if researchContent is present
    console.log(`[DocsAgent] 🔍 Context keys:`, Object.keys(context));
    console.log(`[DocsAgent] 🔍 Has researchContent:`, !!context.researchContent);
    if (context.researchContent) {
      console.log(`[DocsAgent] 🔍 researchContent.contentProvided:`, context.researchContent.contentProvided);
      console.log(`[DocsAgent] 🔍 researchContent.content length:`, context.researchContent.content?.length);
    }
    
    // ✅ RENDER-ONLY MODE: Check if research content is provided
    if (context.researchContent && context.researchContent.contentProvided) {
      console.log(`[DocsAgent] 📄 RENDER-ONLY MODE: Research content provided, skipping LLM generation`);
      return await this.renderResearchContent(query, context);
    }
    
    console.log(`[DocsAgent] 🤖 GENERATE MODE: Using LLM to generate content`);
    
    // Normal mode: Call BaseAgent's multi-step execution with proper context
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

  /**
   * RENDER-ONLY MODE: Directly render research content into a document
   * without LLM generation. This prevents content degradation.
   * 
   * @param {string} query - Original user query (for extracting title)
   * @param {object} context - Execution context with researchContent
   * @returns {Promise<object>} - Result in old format
   */
  async renderResearchContent(query, context) {
    console.log(`[DocsAgent] 🎨 Rendering research content directly...`);
    
    try {
      const { researchContent, userId, conversationId } = context;
      
      // Extract document title from query
      let docTitle = 'Research Results';
      const titleMatch = query.match(/(?:create|make|generate).*?(?:doc|document).*?(?:titled|called|named)\s+["']([^"']+)["']/i);
      if (titleMatch) {
        docTitle = titleMatch[1];
      } else {
        // Try to extract topic from query
        const topicMatch = query.match(/(?:about|on|for)\s+["']?([^"']+?)["']?(?:\s+and|\s*$)/i);
        if (topicMatch) {
          docTitle = topicMatch[1];
        }
      }
      
      console.log(`[DocsAgent] 📝 Creating document: "${docTitle}"`);
      
      // Step 1: Create document
      const doc = await docsService.createDocument(userId, docTitle, '');
      
      console.log(`[DocsAgent] ✅ Document created: ${doc.documentId}`);
      
      // Step 2: Add research content
      let contentToAdd = researchContent.content;
      
      // Add sources at the end if provided
      if (researchContent.sources && researchContent.sources.length > 0) {
        contentToAdd += '\n\n---\n\n## Sources\n\n';
        researchContent.sources.forEach((source, index) => {
          contentToAdd += `${index + 1}. [${source.title}](${source.url})\n`;
        });
      }
      
      console.log(`[DocsAgent] 📄 Adding content (${contentToAdd.length} chars)...`);
      
      await docsService.appendFormattedText(userId, doc.documentId, contentToAdd);
      
      console.log(`[DocsAgent] ✅ Content added successfully`);
      
      // Return in old format for compatibility
      return {
        success: true,
        response: `Document "${docTitle}" created successfully with research content. URL: ${doc.documentUrl}`,
        tools_used: [
          { name: 'createDocument' },
          { name: 'appendFormattedText' }
        ],
        raw_results: [
          {
            success: true,
            documentId: doc.documentId,
            url: doc.documentUrl,
            title: doc.title,
            createdAt: new Date().toISOString()
          },
          {
            success: true,
            documentId: doc.documentId,
            message: 'Formatted content appended successfully'
          }
        ],
        conversationHistory: context.conversationHistory || [],
        totalSteps: 2,
        errors: [],
        renderMode: true  // Flag to indicate this was render-only mode
      };
      
    } catch (error) {
      console.error(`[DocsAgent] ❌ Error in render-only mode:`, error.message);
      return {
        success: false,
        response: `Failed to create document: ${error.message}`,
        tools_used: [],
        raw_results: [],
        conversationHistory: context.conversationHistory || [],
        totalSteps: 0,
        errors: [{ error: error.message }]
      };
    }
  }
}

module.exports = DocsAgentMultiStep;
