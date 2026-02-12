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
        name: 'appendFormattedText',
        description: 'Append formatted content to a document with proper headings, bullet points, and styling. Use markdown syntax: # for H1, ## for H2, ### for H3, - for bullets, 1. for numbered lists, **text** for bold. This is the PREFERRED method for adding content.',
        parameters: {
          type: 'object',
          properties: {
            documentId: {
              type: 'string',
              description: 'The ID of the document'
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
    appendFormattedText: async (args) => {
      return await docsService.appendFormattedText(userId, args.documentId, args.content);
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
    // If forceToolExecution is set, directly execute the tool without LLM
    if (options.forceToolExecution && options.forceToolExecution.toolName && options.forceToolExecution.params) {
      console.log(`[DocsAgent] Force executing tool: ${options.forceToolExecution.toolName}`);
      console.log(`[DocsAgent] With exact params:`, JSON.stringify(options.forceToolExecution.params, null, 2));
      
      const functionMap = createFunctionMap(userId);
      const functionToCall = functionMap[options.forceToolExecution.toolName];
      if (!functionToCall) {
        throw new Error(`Unknown function: ${options.forceToolExecution.toolName}`);
      }

      const result = await functionToCall(options.forceToolExecution.params);
      
      let responseText = result.success ? `Successfully executed ${options.forceToolExecution.toolName}` : result.error;
      if (options.forceToolExecution.toolName === 'createDocument' && result.success) {
        responseText = `Your document "${options.forceToolExecution.params.title}" has been created! ${result.documentUrl ? `View it here: ${result.documentUrl}` : ''}`;
      }
      
      return {
        success: true,
        response: responseText,
        toolCalls: [{
          function: options.forceToolExecution.toolName,
          arguments: options.forceToolExecution.params,
          result: result
        }],
        raw_results: [result],
        conversationHistory: []
      };
    }

    const messages = [
      {
        role: 'system',
        content: `You are an AI assistant specialized in managing Google Docs. You help users create, edit, read, search, and organize documents using natural language.

**Your Capabilities:**
1. **Create Documents** - Make new docs with specific titles
2. **Write & Edit** - Insert, append, or replace text in documents
3. **Format Text** - Apply professional formatting with headings, bullets, bold
4. **Read Content** - Extract and summarize document content
5. **Search** - Find specific text within documents
6. **Organize** - List, share, and manage documents

**CRITICAL - USE appendFormattedText FOR ALL CONTENT:**
When adding content to documents, ALWAYS use \`appendFormattedText\` (NOT appendText).
This tool automatically converts markdown to proper Google Docs formatting.

**MARKDOWN FORMATTING RULES:**
Use these markdown patterns in the \`content\` parameter of appendFormattedText:

1. **Headings:**
   - \`# HEADING\` → Heading 1 (main sections)
   - \`## Heading\` → Heading 2 (subsections)
   - \`### Heading\` → Heading 3 (sub-subsections)

2. **Bullet Points:**
   - \`- Point one\` → Bullet point
   - \`- Point two\` → Bullet point

3. **Numbered Lists:**
   - \`1. First item\` → Numbered list
   - \`2. Second item\` → Numbered list

4. **Bold Text:**
   - \`**important text**\` → Bold formatting

5. **Paragraphs:**
   - Use blank lines between paragraphs

**CONTENT GENERATION WORKFLOW:**
When user says "create a document about X" or "add content about X":

1. Call createDocument with appropriate title
2. Generate comprehensive, well-structured content using YOUR KNOWLEDGE
3. Call appendFormattedText with markdown-formatted content

**EXAMPLE - Creating a document about Indian Government:**

Step 1: createDocument({ title: "Indian Government Structure" })

Step 2: appendFormattedText({ 
  documentId: "<id from step 1>",
  content: "# INTRODUCTION\\n\\nThe Indian government operates as a federal parliamentary democratic republic, which means it is based on a system of elected representatives and an elected head of state.\\n\\n## KEY COMPONENTS\\n\\nThe structure of the Indian government is defined by the Constitution of India.\\n\\n### Three Branches:\\n\\n- **Executive Branch** - Led by the President of India\\n- **Legislative Branch** - Parliament of India (Lok Sabha and Rajya Sabha)\\n- **Judicial Branch** - Supreme Court and High Courts\\n\\n## EXECUTIVE BRANCH\\n\\nThe President of India serves as the ceremonial head of state.\\n\\n### Roles and Responsibilities:\\n\\n1. Appoints the Prime Minister\\n2. Commander-in-chief of Armed Forces\\n3. Grants pardons and reprieves\\n\\n## LEGISLATIVE BRANCH\\n\\nParliament is responsible for making laws.\\n\\n### Structure:\\n\\n- **Lok Sabha** - Lower house, directly elected\\n- **Rajya Sabha** - Upper house, elected by state legislatures\\n\\n## CONCLUSION\\n\\nIndia's democratic system ensures representation and separation of powers."
})

**UPDATING EXISTING DOCUMENTS:**
When user says "update first document" or "add to the document":
- Use appendFormattedText on the specified document
- NEVER create a new document when updating!

Example: User listed 2 docs, then says "update first with fundamental rights"
→ Call appendFormattedText(documentId1, "# FUNDAMENTAL RIGHTS\\n\\n...")

**Best Practices:**
- ALWAYS use appendFormattedText for content (never plain appendText)
- Use # for main headings, ## for subsections, ### for sub-subsections
- Use - for bullet points
- Use **text** for bold emphasis
- Add blank lines between sections
- Generate comprehensive, educational content

**Examples:**
- "Create a document called 'Notes'" → createDocument only
- "Create a document about X" → createDocument + appendFormattedText
- "Update first document with Y" → appendFormattedText to first doc
- "Add this to my doc: [text]" → appendFormattedText

Current date: ${new Date().toLocaleDateString()}
When content is requested, ALWAYS generate PROFESSIONALLY FORMATTED content using appendFormattedText with proper markdown.`
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
      tools_used: toolCalls.map(tc => tc.function),  // Include tool names for artifact extraction
      raw_results: toolCalls.map(tc => tc.result),  // Include raw results for artifact extraction
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
