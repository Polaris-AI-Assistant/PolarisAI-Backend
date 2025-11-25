const OpenAI = require('openai');
const docsService = require('./docsService');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Define tools for OpenAI function calling
 */
function defineTools() {
  return [
    {
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
            }
          },
          required: ['title']
        }
      }
    },
    {
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
              description: 'The position to insert text (default: 1 for beginning)',
              default: 1
            }
          },
          required: ['documentId', 'text']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'appendText',
        description: 'Append text to the end of a document',
        parameters: {
          type: 'object',
          properties: {
            documentId: {
              type: 'string',
              description: 'The ID of the document'
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
    {
      type: 'function',
      function: {
        name: 'insertParagraphBreak',
        description: 'Insert a paragraph break (new line) at a specific position',
        parameters: {
          type: 'object',
          properties: {
            documentId: {
              type: 'string',
              description: 'The ID of the document'
            },
            index: {
              type: 'number',
              description: 'The position to insert the paragraph break'
            }
          },
          required: ['documentId', 'index']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'updateTextStyle',
        description: 'Update text formatting (bold, italic, underline, color)',
        parameters: {
          type: 'object',
          properties: {
            documentId: {
              type: 'string',
              description: 'The ID of the document'
            },
            startIndex: {
              type: 'number',
              description: 'Start position of text to format'
            },
            endIndex: {
              type: 'number',
              description: 'End position of text to format'
            },
            style: {
              type: 'object',
              description: 'Style properties: { bold, italic, underline, foregroundColor }',
              properties: {
                bold: { type: 'boolean' },
                italic: { type: 'boolean' },
                underline: { type: 'boolean' },
                foregroundColor: {
                  type: 'object',
                  description: 'RGB color object: { red, green, blue } with values 0-1'
                }
              }
            }
          },
          required: ['documentId', 'startIndex', 'endIndex', 'style']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'readDocument',
        description: 'Read the full content and structure of a document',
        parameters: {
          type: 'object',
          properties: {
            documentId: {
              type: 'string',
              description: 'The ID of the document to read'
            }
          },
          required: ['documentId']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'searchInDocument',
        description: 'Search for specific text within a document',
        parameters: {
          type: 'object',
          properties: {
            documentId: {
              type: 'string',
              description: 'The ID of the document to search'
            },
            searchQuery: {
              type: 'string',
              description: 'The text to search for'
            }
          },
          required: ['documentId', 'searchQuery']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'listDocuments',
        description: 'List all Google Documents accessible to the user',
        parameters: {
          type: 'object',
          properties: {
            pageSize: {
              type: 'number',
              description: 'Number of documents to return (default: 50)',
              default: 50
            },
            query: {
              type: 'string',
              description: 'Optional Drive API query filter'
            }
          }
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'getDocumentMetadata',
        description: 'Get metadata about a specific document',
        parameters: {
          type: 'object',
          properties: {
            documentId: {
              type: 'string',
              description: 'The ID of the document'
            }
          },
          required: ['documentId']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'shareDocument',
        description: 'Share a document with another user',
        parameters: {
          type: 'object',
          properties: {
            documentId: {
              type: 'string',
              description: 'The ID of the document'
            },
            email: {
              type: 'string',
              description: 'Email address to share with'
            },
            role: {
              type: 'string',
              description: 'Permission role: reader, writer, or commenter',
              enum: ['reader', 'writer', 'commenter'],
              default: 'reader'
            }
          },
          required: ['documentId', 'email']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'deleteDocument',
        description: 'Delete a document permanently',
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
    {
      type: 'function',
      function: {
        name: 'replaceText',
        description: 'Find and replace text throughout a document',
        parameters: {
          type: 'object',
          properties: {
            documentId: {
              type: 'string',
              description: 'The ID of the document'
            },
            searchText: {
              type: 'string',
              description: 'Text to find'
            },
            replaceText: {
              type: 'string',
              description: 'Text to replace with'
            }
          },
          required: ['documentId', 'searchText', 'replaceText']
        }
      }
    }
  ];
}

/**
 * Create function map for tool execution
 */
function createFunctionMap(userId) {
  return {
    createDocument: async (args) => {
      return await docsService.createDocument(userId, args.title);
    },
    insertText: async (args) => {
      return await docsService.insertText(userId, args.documentId, args.text, args.index);
    },
    appendText: async (args) => {
      return await docsService.appendText(userId, args.documentId, args.text);
    },
    insertParagraphBreak: async (args) => {
      return await docsService.insertParagraphBreak(userId, args.documentId, args.index);
    },
    updateTextStyle: async (args) => {
      return await docsService.updateTextStyle(userId, args.documentId, args.startIndex, args.endIndex, args.style);
    },
    readDocument: async (args) => {
      return await docsService.readDocument(userId, args.documentId);
    },
    searchInDocument: async (args) => {
      return await docsService.searchInDocument(userId, args.documentId, args.searchQuery);
    },
    listDocuments: async (args) => {
      return await docsService.listDocuments(userId, args);
    },
    getDocumentMetadata: async (args) => {
      return await docsService.getDocumentMetadata(userId, args.documentId);
    },
    shareDocument: async (args) => {
      return await docsService.shareDocument(userId, args.documentId, args.email, args.role);
    },
    deleteDocument: async (args) => {
      return await docsService.deleteDocument(userId, args.documentId);
    },
    replaceText: async (args) => {
      return await docsService.replaceText(userId, args.documentId, args.searchText, args.replaceText);
    }
  };
}

/**
 * Main agent function - processes natural language queries
 */
async function processQuery(query, userId, options = {}) {
  try {
    const messages = [
      {
        role: 'system',
        content: `You are an AI assistant specialized in managing Google Docs. You help users create, edit, read, search, and organize documents using natural language.

**Your Capabilities:**
1. **Create Documents** - Make new docs with specific titles
2. **Write & Edit** - Insert, append, or replace text in documents
3. **Format Text** - Apply bold, italic, underline, and colors
4. **Read Content** - Extract and summarize document content
5. **Search** - Find specific text within documents
6. **Organize** - List, share, and manage documents
7. **Memory Storage** - Create memory logs for cross-app context

**Best Practices:**
- When creating memory documents, use clear naming like "Memory Log - [Date]"
- For important information, use bold formatting
- Structure content with proper paragraphs
- Always confirm actions before deleting documents
- When searching, provide context around matches
- Use appendText for adding to existing documents
- Read documents first before making edits

**Response Format:**
- Be conversational and helpful
- Explain what you're doing and why
- Provide document IDs and URLs when creating/modifying docs
- Summarize long content concisely
- Ask for clarification when needed

**IMPORTANT: When listing documents, format them EXACTLY like this:**
1. **Document Title**
   - Created by: Owner Name
   - Created on: Date
   - Modified on: Date
   - [Open Document](URL)

**Example document list response:**
"Here are your 5 most recent documents:

1. **Project Plan**
   - Created by: You (User Name)
   - Created on: October 29, 2025
   - Modified on: October 29, 2025
   - [Open Document](https://docs.google.com/document/d/...)

2. **Meeting Notes**
   - Created by: You (User Name)
   - Created on: October 28, 2025
   - Modified on: October 28, 2025
   - [Open Document](https://docs.google.com/document/d/...)"

**Examples:**
- "Create a document called 'Meeting Notes'" → Use createDocument
- "Add this to my doc: [text]" → Use appendText
- "Find 'project deadline' in document X" → Use searchInDocument
- "Make lines 10-20 bold" → Use updateTextStyle
- "What's in document Y?" → Use readDocument

Current date: ${new Date().toLocaleDateString()}
Be proactive, accurate, and user-friendly!`
      },
      {
        role: 'user',
        content: query
      }
    ];

    // Add conversation history if provided
    if (options.conversationHistory && Array.isArray(options.conversationHistory)) {
      messages.splice(1, 0, ...options.conversationHistory);
    }

    const tools = defineTools();
    const functionMap = createFunctionMap(userId);

    let response = await openai.chat.completions.create({
      model: options.model || 'gpt-4o',
      messages: messages,
      tools: tools,
      tool_choice: 'auto',
      temperature: options.temperature || 0.7
    });

    let assistantMessage = response.choices[0].message;
    const toolCalls = [];

    // Handle function calls iteratively
    while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      messages.push(assistantMessage);

      // Execute all tool calls
      for (const toolCall of assistantMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        console.log(`Executing function: ${functionName}`, functionArgs);

        let functionResponse;
        if (functionMap[functionName]) {
          functionResponse = await functionMap[functionName](functionArgs);
        } else {
          functionResponse = { error: `Unknown function: ${functionName}` };
        }

        toolCalls.push({
          function: functionName,
          arguments: functionArgs,
          result: functionResponse
        });

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(functionResponse)
        });
      }

      // Get next response from model
      response = await openai.chat.completions.create({
        model: options.model || 'gpt-4o',
        messages: messages,
        tools: tools,
        tool_choice: 'auto',
        temperature: options.temperature || 0.7
      });

      assistantMessage = response.choices[0].message;
    }

    return {
      success: true,
      response: assistantMessage.content,
      toolCalls: toolCalls,
      conversationHistory: messages
    };
  } catch (error) {
    console.error('Error in Docs agent:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get example queries by category
 */
function getExamples() {
  return {
    creation: [
      'Create a new document called "Project Plan 2025"',
      'Make a doc titled "Meeting Notes - Oct 29"',
      'Create a memory log document for today'
    ],
    writing: [
      'Add "Project deadline: Nov 15" to document [ID]',
      'Write the following in my doc: [text]',
      'Append these notes to the end of document [ID]'
    ],
    formatting: [
      'Make the text from index 10 to 50 bold',
      'Highlight the first paragraph in yellow',
      'Make "Important" italic and red'
    ],
    reading: [
      'What\'s in my document titled "Meeting Notes"?',
      'Read document [ID] and summarize it',
      'Show me the content of my latest doc'
    ],
    searching: [
      'Find "deadline" in document [ID]',
      'Search for "project status" across my docs',
      'Where did I mention "budget" in my notes?'
    ],
    management: [
      'List all my documents',
      'Share document [ID] with user@example.com',
      'Delete the document titled "Draft Notes"',
      'Replace "old text" with "new text" in document [ID]'
    ]
  };
}

/**
 * Get agent capabilities
 */
function getCapabilities() {
  return {
    tools: [
      'createDocument - Create new documents',
      'insertText - Insert text at specific positions',
      'appendText - Add text to document end',
      'insertParagraphBreak - Add line breaks',
      'updateTextStyle - Format text (bold, italic, color)',
      'readDocument - Read full document content',
      'searchInDocument - Search for text',
      'listDocuments - View all documents',
      'getDocumentMetadata - Get document info',
      'shareDocument - Share with others',
      'deleteDocument - Remove documents',
      'replaceText - Find and replace'
    ],
    features: [
      'Natural language understanding',
      'Multi-step task execution',
      'Context-aware responses',
      'Memory storage capabilities',
      'Text formatting and styling',
      'Document organization',
      'Search and retrieval'
    ],
    useCases: [
      'Creating and managing notes',
      'Building knowledge bases',
      'Storing cross-app memories',
      'Collaborative document editing',
      'Content organization',
      'Information retrieval'
    ]
  };
}

module.exports = {
  processQuery,
  getExamples,
  getCapabilities
};
