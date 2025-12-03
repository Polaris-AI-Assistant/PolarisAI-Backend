/**
 * Google Sheets AI Agent using OpenAI
 * 
 * This agent provides intelligent interaction with Google Sheets using natural language queries.
 * It dynamically selects and executes appropriate Sheets API functions based on user intent.
 * 
 * Features:
 * - Natural language query processing
 * - Dynamic tool selection based on user intent
 * - Spreadsheet creation, updating, and management
 * - Data manipulation (rows, columns, cells)
 * - Formatting and sharing
 * - Multi-tool query support
 * - Comprehensive error handling
 * 
 * Usage:
 * const agent = new SheetsAgent();
 * const result = await agent.processQuery("create a budget spreadsheet", userId);
 */

const OpenAI = require('openai');
const sheetsService = require('./sheetsService');

class SheetsAgent {
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
   * Define OpenAI function schemas for each Sheets function
   * These schemas help the AI understand when and how to use each tool
   */
  defineTools() {
    return [
      {
        type: "function",
        function: {
          name: "createSpreadsheet",
          description: "Create a new Google spreadsheet. Use when user wants to create, make, or set up a new spreadsheet.",
          parameters: {
            type: "object",
            properties: {
              title: {
                type: "string",
                description: "The title of the new spreadsheet (required)"
              },
              sheetTitles: {
                type: "array",
                items: { type: "string" },
                description: "Array of sheet names to create in the spreadsheet (default: ['Sheet1'])"
              }
            },
            required: ["title"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getValues",
          description: "Get values from a Google spreadsheet range. Use when user asks to read, view, or retrieve data from cells.",
          parameters: {
            type: "object",
            properties: {
              spreadsheetId: {
                type: "string",
                description: "The ID of the spreadsheet (required)"
              },
              range: {
                type: "string",
                description: "The A1 notation range to retrieve (e.g., 'Sheet1!A1:B10', 'Sheet1!A:A') (required)"
              }
            },
            required: ["spreadsheetId", "range"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "addSheet",
          description: "Add a new sheet to an existing spreadsheet. Use when user wants to add, create, or insert a new sheet/tab.",
          parameters: {
            type: "object",
            properties: {
              spreadsheetId: {
                type: "string",
                description: "The ID of the spreadsheet (required)"
              },
              sheetTitle: {
                type: "string",
                description: "The title of the new sheet (required)"
              }
            },
            required: ["spreadsheetId", "sheetTitle"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "listSpreadsheets",
          description: "List all Google spreadsheets accessible to the user. Use when user asks about their spreadsheets, wants to see spreadsheet list, or asks 'what spreadsheets do I have'.",
          parameters: {
            type: "object",
            properties: {
              pageSize: {
                type: "number",
                description: "Maximum number of spreadsheets to return per page (default: 20, max: 100)"
              },
              pageNumber: {
                type: "number",
                description: "Page number to retrieve, starting from 1 (default: 1)"
              }
            },
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "deleteSpreadsheet",
          description: "Delete a Google spreadsheet. Use when user wants to remove, delete, or trash a spreadsheet.",
          parameters: {
            type: "object",
            properties: {
              spreadsheetId: {
                type: "string",
                description: "The ID of the spreadsheet to delete (required)"
              }
            },
            required: ["spreadsheetId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "readRows",
          description: "Read specific rows from a sheet. Use when user wants to read certain row numbers.",
          parameters: {
            type: "object",
            properties: {
              spreadsheetId: {
                type: "string",
                description: "The ID of the spreadsheet (required)"
              },
              sheetName: {
                type: "string",
                description: "The name of the sheet (required)"
              },
              startRow: {
                type: "number",
                description: "Starting row number (required)"
              },
              endRow: {
                type: "number",
                description: "Ending row number (required)"
              }
            },
            required: ["spreadsheetId", "sheetName", "startRow", "endRow"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "editRow",
          description: "Edit an entire row in a spreadsheet. Use when user wants to update, modify, or change a specific row.",
          parameters: {
            type: "object",
            properties: {
              spreadsheetId: {
                type: "string",
                description: "The ID of the spreadsheet (required)"
              },
              sheetName: {
                type: "string",
                description: "The name of the sheet (required)"
              },
              rowNumber: {
                type: "number",
                description: "The row number to edit (required)"
              },
              values: {
                type: "array",
                items: { type: "string" },
                description: "Array of values for the row (required)"
              }
            },
            required: ["spreadsheetId", "sheetName", "rowNumber", "values"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "insertRow",
          description: "Insert a new row in a spreadsheet. Use when user wants to add or insert a new row at a specific position.",
          parameters: {
            type: "object",
            properties: {
              spreadsheetId: {
                type: "string",
                description: "The ID of the spreadsheet (required)"
              },
              sheetName: {
                type: "string",
                description: "The name of the sheet (required)"
              },
              rowNumber: {
                type: "number",
                description: "Position where to insert the row (required)"
              },
              values: {
                type: "array",
                items: { type: "string" },
                description: "Array of values for the new row (required)"
              }
            },
            required: ["spreadsheetId", "sheetName", "rowNumber", "values"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "insertColumn",
          description: "Insert a new column in a spreadsheet. Use when user wants to add or insert a new column.",
          parameters: {
            type: "object",
            properties: {
              spreadsheetId: {
                type: "string",
                description: "The ID of the spreadsheet (required)"
              },
              sheetName: {
                type: "string",
                description: "The name of the sheet (required)"
              },
              columnIndex: {
                type: "number",
                description: "Column index where to insert (0 = A, 1 = B, etc.) (required)"
              },
              values: {
                type: "array",
                items: { type: "string" },
                description: "Array of values for the new column (optional)"
              }
            },
            required: ["spreadsheetId", "sheetName", "columnIndex"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "renameSheet",
          description: "Rename a sheet in a spreadsheet. Use when user wants to change or rename a sheet/tab name.",
          parameters: {
            type: "object",
            properties: {
              spreadsheetId: {
                type: "string",
                description: "The ID of the spreadsheet (required)"
              },
              oldSheetName: {
                type: "string",
                description: "Current name of the sheet (required)"
              },
              newSheetName: {
                type: "string",
                description: "New name for the sheet (required)"
              }
            },
            required: ["spreadsheetId", "oldSheetName", "newSheetName"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getSpreadsheet",
          description: "Get metadata about a Google spreadsheet. Use when user asks about spreadsheet details, properties, or structure.",
          parameters: {
            type: "object",
            properties: {
              spreadsheetId: {
                type: "string",
                description: "The ID of the spreadsheet (required)"
              }
            },
            required: ["spreadsheetId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "updateValues",
          description: "Update values in a spreadsheet range. Use when user wants to update, write, or set multiple cells.",
          parameters: {
            type: "object",
            properties: {
              spreadsheetId: {
                type: "string",
                description: "The ID of the spreadsheet (required)"
              },
              range: {
                type: "string",
                description: "The A1 notation range to update (e.g., 'Sheet1!A1:B10') (required)"
              },
              values: {
                type: "array",
                description: "2D array of values to update (required)",
                items: {
                  type: "array",
                  items: { type: "string" }
                }
              }
            },
            required: ["spreadsheetId", "range", "values"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "deleteSheet",
          description: "Delete a sheet from a spreadsheet. Use when user wants to remove or delete a sheet/tab.",
          parameters: {
            type: "object",
            properties: {
              spreadsheetId: {
                type: "string",
                description: "The ID of the spreadsheet (required)"
              },
              sheetName: {
                type: "string",
                description: "The name of the sheet to delete (required)"
              }
            },
            required: ["spreadsheetId", "sheetName"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "shareSpreadsheet",
          description: "Share a Google spreadsheet with others. Use when user wants to share or grant access to a spreadsheet.",
          parameters: {
            type: "object",
            properties: {
              spreadsheetId: {
                type: "string",
                description: "The ID of the spreadsheet (required)"
              },
              email: {
                type: "string",
                description: "Email address of the person to share with (required)"
              },
              role: {
                type: "string",
                enum: ["reader", "writer", "owner"],
                description: "Permission role (default: 'reader')"
              }
            },
            required: ["spreadsheetId", "email"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "formatCells",
          description: "Format and highlight cells in a spreadsheet. Use when user wants to apply formatting like colors, bold, alignment, etc.",
          parameters: {
            type: "object",
            properties: {
              spreadsheetId: {
                type: "string",
                description: "The ID of the spreadsheet (required)"
              },
              sheetName: {
                type: "string",
                description: "The name of the sheet (required)"
              },
              range: {
                type: "string",
                description: "The range to format (e.g., 'A1:B10') (required)"
              },
              formatting: {
                type: "object",
                description: "Formatting options object (required)"
              }
            },
            required: ["spreadsheetId", "sheetName", "range", "formatting"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "readColumns",
          description: "Read specific columns from a sheet. Use when user wants to read specific column letters.",
          parameters: {
            type: "object",
            properties: {
              spreadsheetId: {
                type: "string",
                description: "The ID of the spreadsheet (required)"
              },
              sheetName: {
                type: "string",
                description: "The name of the sheet (required)"
              },
              startColumn: {
                type: "string",
                description: "Starting column letter (e.g., 'A') (required)"
              },
              endColumn: {
                type: "string",
                description: "Ending column letter (e.g., 'C') (required)"
              }
            },
            required: ["spreadsheetId", "sheetName", "startColumn", "endColumn"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "editColumn",
          description: "Edit an entire column in a spreadsheet. Use when user wants to update or modify a specific column.",
          parameters: {
            type: "object",
            properties: {
              spreadsheetId: {
                type: "string",
                description: "The ID of the spreadsheet (required)"
              },
              sheetName: {
                type: "string",
                description: "The name of the sheet (required)"
              },
              columnLetter: {
                type: "string",
                description: "The column letter to edit (e.g., 'A', 'B') (required)"
              },
              values: {
                type: "array",
                items: { type: "string" },
                description: "Array of values for the column (required)"
              }
            },
            required: ["spreadsheetId", "sheetName", "columnLetter", "values"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "editCell",
          description: "Edit a single cell in a spreadsheet. Use when user wants to update or change a specific cell.",
          parameters: {
            type: "object",
            properties: {
              spreadsheetId: {
                type: "string",
                description: "The ID of the spreadsheet (required)"
              },
              sheetName: {
                type: "string",
                description: "The name of the sheet (required)"
              },
              cell: {
                type: "string",
                description: "The cell address (e.g., 'A1', 'B5') (required)"
              },
              value: {
                type: "string",
                description: "The new value for the cell (required)"
              }
            },
            required: ["spreadsheetId", "sheetName", "cell", "value"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "readHeadings",
          description: "Read the header row (first row) from a specific sheet. Use when user wants to see column headers or the first row.",
          parameters: {
            type: "object",
            properties: {
              spreadsheetId: {
                type: "string",
                description: "The ID of the spreadsheet (required)"
              },
              sheetName: {
                type: "string",
                description: "The name of the sheet (required)"
              }
            },
            required: ["spreadsheetId", "sheetName"]
          }
        }
      }
    ];
  }

  /**
   * Create function map linking function names to implementations
   */
  createFunctionMap() {
    return {
      createSpreadsheet: sheetsService.createSpreadsheet,
      getValues: sheetsService.getValues,
      addSheet: sheetsService.addSheet,
      listSpreadsheets: sheetsService.listSpreadsheets,
      deleteSpreadsheet: sheetsService.deleteSpreadsheet,
      readRows: sheetsService.readRows,
      editRow: sheetsService.editRow,
      insertRow: sheetsService.insertRow,
      insertColumn: sheetsService.insertColumn,
      renameSheet: sheetsService.renameSheet,
      getSpreadsheet: sheetsService.getSpreadsheet,
      updateValues: sheetsService.updateValues,
      deleteSheet: sheetsService.deleteSheet,
      shareSpreadsheet: sheetsService.shareSpreadsheet,
      formatCells: sheetsService.formatCells,
      readColumns: sheetsService.readColumns,
      editColumn: sheetsService.editColumn,
      editCell: sheetsService.editCell,
      readHeadings: sheetsService.readHeadings
    };
  }

  /**
   * Create system prompt for the AI agent
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
    
    return `You are an intelligent Google Sheets assistant. Your role is to help users manage their Google Spreadsheets through natural language queries.

**IMPORTANT - Current date is ${currentDateStr}**. Use this as reference for any date-related queries.

**Capabilities:**
- Create and manage spreadsheets
- Read, write, and update cell data
- Manipulate rows and columns
- Format cells with colors and styles
- Share spreadsheets with others
- List and organize spreadsheets
- Work with multiple sheets within a spreadsheet

**Guidelines:**
1. Be conversational and friendly
2. Ask for clarification when spreadsheet IDs or sheet names are ambiguous
3. Provide clear explanations of what actions were taken
4. Suggest helpful next steps when appropriate
5. When listing spreadsheets, format them with numbered list and provide link at the end:
   1. **Spreadsheet Title**
      - Spreadsheet ID: [id]
      - Created: [date]
      - [Open Spreadsheet](URL)
6. Always confirm destructive actions (delete, clear data)
7. Handle errors gracefully and explain what went wrong
8. Use spreadsheet IDs from the user's previous context when possible

**Important Notes:**
- Spreadsheet IDs are long alphanumeric strings found in the URL
- Sheet names are the tab names within a spreadsheet
- Range notation uses A1 format (e.g., 'Sheet1!A1:B10')
- Column letters: A=0, B=1, C=2, etc.
- Row numbers start at 1

**Response Format:**
- For listing items: Use clear, numbered lists with relevant details
- For data retrieval: Format data in a readable table-like structure
- For actions: Confirm what was done and provide relevant IDs or links
- For errors: Explain the issue and suggest solutions

Remember to be helpful and guide users through their spreadsheet tasks efficiently!`;
  }

  /**
   * Process a natural language query and execute appropriate functions
   */
  async processQuery(query, userId, options = {}) {
    try {
      const { conversationHistory = [], forceToolExecution } = options;

      // If forceToolExecution is set, directly execute the tool without LLM
      if (forceToolExecution && forceToolExecution.toolName && forceToolExecution.params) {
        console.log(`[SheetsAgent] Force executing tool: ${forceToolExecution.toolName}`);
        console.log(`[SheetsAgent] With exact params:`, JSON.stringify(forceToolExecution.params, null, 2));
        
        const functionToCall = this.functionMap[forceToolExecution.toolName];
        if (!functionToCall) {
          throw new Error(`Unknown function: ${forceToolExecution.toolName}`);
        }

        const result = await functionToCall(userId, ...Object.values(forceToolExecution.params));
        
        let responseText = result.success ? `Successfully executed ${forceToolExecution.toolName}` : result.error;
        if (forceToolExecution.toolName === 'createSpreadsheet' && result.success) {
          responseText = `Your spreadsheet "${forceToolExecution.params.title}" has been created! ${result.spreadsheetUrl ? `View it here: ${result.spreadsheetUrl}` : ''}`;
        }
        
        return {
          success: true,
          response: responseText,
          tools_used: [{
            function: forceToolExecution.toolName,
            arguments: forceToolExecution.params,
            result: result
          }],
          raw_results: [result],
          query: query,
          timestamp: new Date().toISOString()
        };
      }

      // Build conversation messages
      const messages = [
        { role: 'system', content: this.systemPrompt },
        ...conversationHistory,
        { role: 'user', content: query }
      ];

      console.log(`[SheetsAgent] Processing query: "${query}"`);

      // Call OpenAI with function calling
      let response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: messages,
        tools: this.tools,
        tool_choice: 'auto',
        temperature: 0.7
      });

      let assistantMessage = response.choices[0].message;
      const toolsUsed = [];
      let iterationCount = 0;
      const maxIterations = 10;

      // Handle tool calls in a loop (for multi-step operations)
      while (assistantMessage.tool_calls && iterationCount < maxIterations) {
        iterationCount++;
        console.log(`[SheetsAgent] Iteration ${iterationCount}: Processing ${assistantMessage.tool_calls.length} tool calls`);

        messages.push(assistantMessage);

        // Execute all tool calls in parallel
        const toolCallPromises = assistantMessage.tool_calls.map(async (toolCall) => {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);

          console.log(`[SheetsAgent] Calling function: ${functionName}`, functionArgs);

          // Add user_id as first argument
          const functionToCall = this.functionMap[functionName];
          
          if (!functionToCall) {
            return {
              tool_call_id: toolCall.id,
              role: 'tool',
              name: functionName,
              content: JSON.stringify({ 
                success: false, 
                error: `Function ${functionName} not found` 
              })
            };
          }

          try {
            // Call the function with userId and other arguments
            const result = await functionToCall(userId, ...Object.values(functionArgs));
            
            toolsUsed.push({
              function: functionName,
              arguments: functionArgs,
              result: result
            });

            return {
              tool_call_id: toolCall.id,
              role: 'tool',
              name: functionName,
              content: JSON.stringify(result)
            };
          } catch (error) {
            console.error(`[SheetsAgent] Error executing ${functionName}:`, error);
            return {
              tool_call_id: toolCall.id,
              role: 'tool',
              name: functionName,
              content: JSON.stringify({ 
                success: false, 
                error: error.message 
              })
            };
          }
        });

        // Wait for all tool calls to complete
        const toolResults = await Promise.all(toolCallPromises);
        messages.push(...toolResults);

        // Get the next response from OpenAI
        response = await this.openai.chat.completions.create({
          model: 'gpt-4o',
          messages: messages,
          tools: this.tools,
          tool_choice: 'auto',
          temperature: 0.7
        });

        assistantMessage = response.choices[0].message;
      }

      // Extract final response
      const finalResponse = assistantMessage.content || 'I was able to process your request.';

      console.log(`[SheetsAgent] Query processed successfully. Tools used: ${toolsUsed.length}`);

      return {
        success: true,
        response: finalResponse,
        tools_used: toolsUsed,
        raw_results: toolsUsed.map(t => t.result),  // Include raw results for artifact extraction
        query: query,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('[SheetsAgent] Error processing query:', error);
      return {
        success: false,
        error: error.message,
        query: query,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = SheetsAgent;
