/**
 * Google Sheets Agent Controller
 * 
 * HTTP endpoint for interacting with the Google Sheets AI Agent.
 * Handles natural language queries and returns AI-processed responses.
 */

const express = require('express');
const SheetsAgent = require('./sheetsAgent');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Initialize the Sheets AI Agent
const sheetsAgent = new SheetsAgent();

/**
 * POST /sheets/agent/query
 * Process natural language queries about Google Sheets
 * 
 * Request body:
 * {
 *   "query": "create a budget spreadsheet with expense tracking"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "response": "I've created a budget spreadsheet...",
 *   "query": "create a budget spreadsheet...",
 *   "tools_used": [...],
 *   "timestamp": "2025-01-01T00:00:00.000Z"
 * }
 */
router.post('/agent/query', authenticateToken, async (req, res) => {
  try {
    const { query, conversationHistory } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Query is required and must be a non-empty string',
        example: {
          query: "show me my spreadsheets"
        }
      });
    }

    console.log(`[SheetsAgentController] User ${userId} query: "${query}"`);

    // Process the query through the agent with conversation history
    const result = await sheetsAgent.processQuery(query, userId, { conversationHistory });

    // Return the result
    res.json(result);

  } catch (error) {
    console.error('[SheetsAgentController] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process query',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /sheets/agent/examples
 * Get example queries that users can try
 */
router.get('/agent/examples', (req, res) => {
  res.json({
    success: true,
    examples: [
      {
        category: "Listing Spreadsheets",
        queries: [
          "Show me all my spreadsheets",
          "List my Google Sheets",
          "What spreadsheets do I have?",
          "Show me my recent spreadsheets"
        ]
      },
      {
        category: "Creating Spreadsheets",
        queries: [
          "Create a budget spreadsheet",
          "Make a project tracker",
          "Create a spreadsheet for inventory management",
          "New spreadsheet called 'Sales Data'"
        ]
      },
      {
        category: "Reading Data",
        queries: [
          "Show me the values in A1:B10 of [SPREADSHEET_ID]",
          "Read the first row of Sheet1 in [SPREADSHEET_ID]",
          "Get column A from [SPREADSHEET_ID]",
          "Show me rows 5-10 in [SPREADSHEET_ID]"
        ]
      },
      {
        category: "Updating Data",
        queries: [
          "Update cell A1 to 'Total' in [SPREADSHEET_ID]",
          "Change the values in row 3 of [SPREADSHEET_ID]",
          "Set B2 to 100 in [SPREADSHEET_ID]",
          "Update range A1:B5 with [data]"
        ]
      },
      {
        category: "Managing Sheets",
        queries: [
          "Add a new sheet called 'Q2 Data' to [SPREADSHEET_ID]",
          "Rename Sheet1 to 'Summary' in [SPREADSHEET_ID]",
          "Delete the sheet named 'Old Data' from [SPREADSHEET_ID]",
          "Get details about [SPREADSHEET_ID]"
        ]
      },
      {
        category: "Formatting & Sharing",
        queries: [
          "Highlight cells A1:B5 in [SPREADSHEET_ID]",
          "Share [SPREADSHEET_ID] with john@example.com",
          "Make cells A1:A10 bold in [SPREADSHEET_ID]",
          "Format the header row in [SPREADSHEET_ID]"
        ]
      },
      {
        category: "Row & Column Operations",
        queries: [
          "Insert a new row at position 5 in [SPREADSHEET_ID]",
          "Add a column after column B in [SPREADSHEET_ID]",
          "Delete row 10 from [SPREADSHEET_ID]",
          "Read column headers from [SPREADSHEET_ID]"
        ]
      }
    ],
    tips: [
      "Be specific about spreadsheet IDs (found in the URL)",
      "You can ask follow-up questions in the same conversation",
      "The agent can perform multiple operations at once",
      "If you need a spreadsheet ID, first ask to list your spreadsheets",
      "Use sheet names and cell ranges in A1 notation (e.g., 'Sheet1!A1:B10')"
    ]
  });
});

/**
 * GET /sheets/agent/capabilities
 * Get information about agent capabilities
 */
router.get('/agent/capabilities', (req, res) => {
  res.json({
    success: true,
    capabilities: {
      tools: [
        {
          name: "createSpreadsheet",
          description: "Create a new Google spreadsheet",
          parameters: ["title", "sheetTitles"]
        },
        {
          name: "getValues",
          description: "Get values from a spreadsheet range",
          parameters: ["spreadsheetId", "range"]
        },
        {
          name: "addSheet",
          description: "Add a new sheet to a spreadsheet",
          parameters: ["spreadsheetId", "sheetTitle"]
        },
        {
          name: "listSpreadsheets",
          description: "List all accessible spreadsheets",
          parameters: ["pageSize", "pageNumber"]
        },
        {
          name: "deleteSpreadsheet",
          description: "Delete a spreadsheet",
          parameters: ["spreadsheetId"]
        },
        {
          name: "readRows",
          description: "Read specific rows from a sheet",
          parameters: ["spreadsheetId", "sheetName", "startRow", "endRow"]
        },
        {
          name: "editRow",
          description: "Edit an entire row",
          parameters: ["spreadsheetId", "sheetName", "rowNumber", "values"]
        },
        {
          name: "insertRow",
          description: "Insert a new row",
          parameters: ["spreadsheetId", "sheetName", "rowNumber", "values"]
        },
        {
          name: "insertColumn",
          description: "Insert a new column",
          parameters: ["spreadsheetId", "sheetName", "columnIndex", "values"]
        },
        {
          name: "renameSheet",
          description: "Rename a sheet",
          parameters: ["spreadsheetId", "oldSheetName", "newSheetName"]
        },
        {
          name: "getSpreadsheet",
          description: "Get spreadsheet metadata",
          parameters: ["spreadsheetId"]
        },
        {
          name: "updateValues",
          description: "Update values in a range",
          parameters: ["spreadsheetId", "range", "values"]
        },
        {
          name: "deleteSheet",
          description: "Delete a sheet from a spreadsheet",
          parameters: ["spreadsheetId", "sheetName"]
        },
        {
          name: "shareSpreadsheet",
          description: "Share a spreadsheet with others",
          parameters: ["spreadsheetId", "email", "role"]
        },
        {
          name: "formatCells",
          description: "Format and highlight cells",
          parameters: ["spreadsheetId", "sheetName", "range", "formatting"]
        },
        {
          name: "readColumns",
          description: "Read specific columns",
          parameters: ["spreadsheetId", "sheetName", "startColumn", "endColumn"]
        },
        {
          name: "editColumn",
          description: "Edit an entire column",
          parameters: ["spreadsheetId", "sheetName", "columnLetter", "values"]
        },
        {
          name: "editCell",
          description: "Edit a single cell",
          parameters: ["spreadsheetId", "sheetName", "cell", "value"]
        },
        {
          name: "readHeadings",
          description: "Read header row from a sheet",
          parameters: ["spreadsheetId", "sheetName"]
        }
      ],
      features: [
        "Natural language understanding",
        "Multi-step operations",
        "Conversation context awareness",
        "Error handling and recovery",
        "Automatic authentication handling"
      ]
    }
  });
});

module.exports = router;
