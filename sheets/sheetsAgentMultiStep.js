/**
 * Google Sheets Agent - Multi-Step Execution Version
 * Extends BaseAgent to support sequential multi-step operations.
 */

const BaseAgent = require('../base/BaseAgent');
const sheetsService = require('./sheetsService');
const OpenAI = require('openai');

class SheetsAgentMultiStep extends BaseAgent {
  constructor(llmClient) {
    const tools = {
      createSpreadsheet: {
        definition: {
          type: 'function',
          function: {
            name: 'createSpreadsheet',
            description: 'Create a new Google Spreadsheet with a title',
            parameters: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'Title of the spreadsheet' },
                locale: { type: 'string', description: 'Locale for the spreadsheet', default: 'en_US' }
              },
              required: ['title']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[SheetsAgent] 📊 Creating spreadsheet: "${params.title}"`);
          try {
            const sheet = await sheetsService.createSpreadsheet(context.userId, params.title, params.locale);
            console.log(`[SheetsAgent] ✅ Spreadsheet created: ${sheet.spreadsheetId}`);
            return {
              success: true,
              spreadsheetId: sheet.spreadsheetId,
              title: sheet.properties.title,
              url: sheet.spreadsheetUrl,
              createdAt: new Date().toISOString()
            };
          } catch (error) {
            console.error(`[SheetsAgent] ❌ Error creating spreadsheet:`, error.message);
            throw error;
          }
        }
      },

      addSheet: {
        definition: {
          type: 'function',
          function: {
            name: 'addSheet',
            description: 'Add a new sheet to a spreadsheet',
            parameters: {
              type: 'object',
              properties: {
                spreadsheetId: { type: 'string', description: 'Spreadsheet ID' },
                sheetTitle: { type: 'string', description: 'Title of the new sheet' }
              },
              required: ['spreadsheetId', 'sheetTitle']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[SheetsAgent] 📄 Adding sheet: "${params.sheetTitle}"`);
          try {
            const sheet = await sheetsService.addSheet(context.userId, params.spreadsheetId, params.sheetTitle);
            console.log(`[SheetsAgent] ✅ Sheet added successfully`);
            return { success: true, sheetId: sheet.properties.sheetId, title: sheet.properties.title };
          } catch (error) {
            console.error(`[SheetsAgent] ❌ Error adding sheet:`, error.message);
            throw error;
          }
        }
      },

      addData: {
        definition: {
          type: 'function',
          function: {
            name: 'addData',
            description: 'Add data to a spreadsheet',
            parameters: {
              type: 'object',
              properties: {
                spreadsheetId: { type: 'string', description: 'Spreadsheet ID' },
                range: { type: 'string', description: 'Range (e.g., "Sheet1!A1:C3")', default: 'Sheet1!A1' },
                values: { type: 'array', description: 'Array of rows with data' }
              },
              required: ['spreadsheetId', 'values']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[SheetsAgent] 📝 Adding data to spreadsheet`);
          try {
            await sheetsService.addData(context.userId, params.spreadsheetId, params.range, params.values);
            console.log(`[SheetsAgent] ✅ Data added successfully`);
            return { success: true, spreadsheetId: params.spreadsheetId, rowsAdded: params.values.length };
          } catch (error) {
            console.error(`[SheetsAgent] ❌ Error adding data:`, error.message);
            throw error;
          }
        }
      },

      updateData: {
        definition: {
          type: 'function',
          function: {
            name: 'updateData',
            description: 'Update existing data in a spreadsheet',
            parameters: {
              type: 'object',
              properties: {
                spreadsheetId: { type: 'string', description: 'Spreadsheet ID' },
                range: { type: 'string', description: 'Range to update' },
                values: { type: 'array', description: 'New values' }
              },
              required: ['spreadsheetId', 'range', 'values']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[SheetsAgent] 🔄 Updating data in spreadsheet`);
          try {
            await sheetsService.updateData(context.userId, params.spreadsheetId, params.range, params.values);
            console.log(`[SheetsAgent] ✅ Data updated successfully`);
            return { success: true, spreadsheetId: params.spreadsheetId };
          } catch (error) {
            console.error(`[SheetsAgent] ❌ Error updating data:`, error.message);
            throw error;
          }
        }
      },

      deleteData: {
        definition: {
          type: 'function',
          function: {
            name: 'deleteData',
            description: 'Delete data from a spreadsheet',
            parameters: {
              type: 'object',
              properties: {
                spreadsheetId: { type: 'string', description: 'Spreadsheet ID' },
                range: { type: 'string', description: 'Range to delete' }
              },
              required: ['spreadsheetId', 'range']
            }
          }
        },
        execute: async (params, context) => {
          console.log(`[SheetsAgent] 🗑️ Deleting data from spreadsheet`);
          try {
            await sheetsService.deleteData(context.userId, params.spreadsheetId, params.range);
            console.log(`[SheetsAgent] ✅ Data deleted successfully`);
            return { success: true, spreadsheetId: params.spreadsheetId };
          } catch (error) {
            console.error(`[SheetsAgent] ❌ Error deleting data:`, error.message);
            throw error;
          }
        }
      }
    };

    super('SheetsAgent', tools, llmClient || new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));
  }

  getSystemPrompt() {
    const basePrompt = super.getSystemPrompt();
    return `${basePrompt}

GOOGLE SHEETS SPECIFIC GUIDELINES:

1. **Spreadsheet Creation**
   - Create spreadsheet first if user wants to create one
   - Include title in creation

2. **Multi-Step Example**
   User: "Create a spreadsheet titled 'Sales' and add headers"
   
   Step 1: createSpreadsheet({ title: "Sales" })
   Result: { spreadsheetId: "abc123", url: "..." }
   
   Step 2: addData({ spreadsheetId: "abc123", values: [["Name", "Amount", "Date"]] })
   Result: { success: true }

3. **Data Management**
   - Use addData to insert new data
   - Use updateData to modify existing data
   - Use deleteData to remove data`;
  }

  async processQuery(query, userIdOrContext, options = {}) {
    console.log(`[SheetsAgent] 🚀 Processing query (multi-step): "${query}"`);
    
    // Detect which signature is being used
    let context;
    if (typeof userIdOrContext === 'string') {
      // Old signature: (query, userId, options)
      context = {
        userId: userIdOrContext,
        conversationId: options.conversationId,
        maxIterations: options.maxIterations || 15,
        forceToolExecution: options.forceToolExecution,
        conversationHistory: options.conversationHistory
      };
    } else if (typeof userIdOrContext === 'object') {
      // New signature: (query, context)
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

module.exports = SheetsAgentMultiStep;
