# Google Sheets Integration

This module provides a complete Google Sheets integration with AI-powered natural language interface.

## Features

### 19 Tools Available

1. **createSpreadsheet** - Create a new Google spreadsheet
2. **getValues** - Get values from a spreadsheet range
3. **addSheet** - Add a new sheet to a spreadsheet
4. **listSpreadsheets** - List all accessible spreadsheets
5. **deleteSpreadsheet** - Delete a spreadsheet
6. **readRows** - Read specific rows from a sheet
7. **editRow** - Edit an entire row
8. **insertRow** - Insert a new row
9. **insertColumn** - Insert a new column
10. **renameSheet** - Rename a sheet
11. **getSpreadsheet** - Get spreadsheet metadata
12. **updateValues** - Update values in a range
13. **deleteSheet** - Delete a sheet from a spreadsheet
14. **shareSpreadsheet** - Share a spreadsheet with others
15. **formatCells** - Format and highlight cells with colors, text formatting, borders, and alignment
16. **readColumns** - Read specific columns
17. **editColumn** - Edit an entire column
18. **editCell** - Edit a single cell
19. **readHeadings** - Read header row from a sheet

## Architecture

The implementation follows the same pattern as Google Forms:

### Backend
- `sheetsAuth.js` - OAuth authentication & connection management
- `sheetsService.js` - Google Sheets API wrapper functions
- `sheetsAgent.js` - OpenAI-powered AI agent with function calling
- `sheetsAgentController.js` - HTTP endpoints for agent queries
- `sheetsData.js` - Data access routes
- `create_sheets_tokens_table.sql` - Database schema

### Frontend
- `app/sheets/page.tsx` - Main Sheets interface with chat UI
- `app/auth/sheets/callback/page.tsx` - OAuth callback handler
- `lib/sheets.ts` - API service functions

## Setup

### 1. Database Setup

Run the SQL file to create the `sheets_tokens` table:

```sql
-- Located at: sheets/create_sheets_tokens_table.sql
```

### 2. Environment Variables

Already configured in `.env`:

```
GOOGLE_SHEETS_CLIENT_ID=762252885981-al1blbtpfgo1hgkaurrhm2p9bog03tqm.apps.googleusercontent.com
GOOGLE_SHEETS_CLIENT_SECRET=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
GOOGLE_SHEETS_REDIRECT_URI=http://localhost:3000/api/auth/sheets/callback
```

### 3. OAuth Scopes

The following scopes are requested:

- `https://www.googleapis.com/auth/spreadsheets` - Full spreadsheet access
- `https://www.googleapis.com/auth/drive.file` - Access to created files
- `https://www.googleapis.com/auth/drive.readonly` - Read-only Drive access

### 4. Start Backend Server

```bash
cd FYP
node index.js
```

Backend runs on `http://localhost:3000`

### 5. Start Frontend

```bash
cd frontend
npm run dev
```

Frontend runs on `http://localhost:3001`

## API Endpoints

### Authentication
- `GET /api/auth/sheets/connect` - Redirect to OAuth consent screen
- `GET /api/auth/sheets/url/authenticated` - Get OAuth URL for authenticated users
- `GET /api/auth/sheets/callback` - OAuth callback handler
- `GET /api/sheets/status` - Check connection status
- `POST /api/auth/sheets/disconnect` - Disconnect Sheets

### Data Access
- `GET /api/sheets/list` - List user's spreadsheets
- `GET /api/sheets/:spreadsheetId` - Get spreadsheet details
- `GET /api/sheets/:spreadsheetId/values?range=Sheet1!A1:B10` - Get values from range

### AI Agent
- `POST /api/sheets/agent/query` - Process natural language queries
- `GET /api/sheets/agent/examples` - Get example queries
- `GET /api/sheets/agent/capabilities` - Get agent capabilities

## Usage Examples

### Natural Language Queries

```javascript
// List spreadsheets
"Show me all my spreadsheets"
"What spreadsheets do I have?"

// Create spreadsheet
"Create a budget tracker"
"Make a new spreadsheet called 'Project Planning'"

// Read data
"Show me the values in A1:B10 of [spreadsheet_id]"
"Read the first row of Sheet1"
"Get column A from [spreadsheet_id]"

// Update data
"Update cell A1 to 'Total' in [spreadsheet_id]"
"Change the values in row 3"
"Set B2 to 100"

// Manage sheets
"Add a new sheet called 'Q2 Data'"
"Rename Sheet1 to 'Summary'"
"Delete the sheet named 'Old Data'"

// Format & Share
"Highlight cells A1:B5 in yellow"
"Share [spreadsheet_id] with john@example.com"
"Make cells A1:A10 bold"
```

### Programmatic Usage

```javascript
// Backend
const sheetsService = require('./sheets/sheetsService');

// List spreadsheets
const result = await sheetsService.listSpreadsheets(userId);

// Create spreadsheet
const newSheet = await sheetsService.createSpreadsheet(
  userId, 
  'My Spreadsheet',
  ['Sheet1', 'Sheet2']
);

// Get values
const values = await sheetsService.getValues(
  userId,
  spreadsheetId,
  'Sheet1!A1:B10'
);

// Update values
const updated = await sheetsService.updateValues(
  userId,
  spreadsheetId,
  'Sheet1!A1:B5',
  [
    ['Name', 'Age'],
    ['John', '30'],
    ['Jane', '25']
  ]
);
```

```typescript
// Frontend
import { querySheetsAgent, getUserSpreadsheets } from '@/lib/sheets';

// Query AI agent
const response = await querySheetsAgent(
  "Create a budget tracker with expense categories"
);

// List spreadsheets
const spreadsheets = await getUserSpreadsheets();
```

## Agent System Prompt

The AI agent is configured with comprehensive knowledge about:
- Spreadsheet creation and management
- Data manipulation (CRUD operations)
- Formatting and styling
- Sharing and permissions
- A1 notation and range specifications
- Multi-step operations

## Error Handling

All functions return standardized responses:

```javascript
{
  success: true/false,
  data: {...},        // On success
  error: "message"    // On failure
}
```

## Security

- OAuth 2.0 authentication
- Row-Level Security (RLS) on database
- Token refresh handled automatically
- User-specific data isolation
- Secure token storage in Supabase

## Testing

### Test Connection
1. Navigate to `http://localhost:3001/sheets`
2. Click "Connect Google Sheets"
3. Authorize the application
4. Try example queries

### Test Backend Directly

```bash
# Check status
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/sheets/status

# List spreadsheets
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/sheets/list

# Query agent
curl -X POST http://localhost:3000/api/sheets/agent/query \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "Show me my spreadsheets"}'
```

## Troubleshooting

### Connection Issues
- Verify OAuth credentials in `.env`
- Check redirect URI matches Google Cloud Console
- Ensure scopes are correct

### Database Issues
- Run `create_sheets_tokens_table.sql` in Supabase
- Verify RLS policies are active
- Check user authentication

### Agent Issues
- Verify `OPENAI_API_KEY` is set
- Check function mappings in `sheetsAgent.js`
- Review console logs for errors

## Future Enhancements

Potential additions:
- Batch operations
- Chart creation
- Conditional formatting
- Data validation rules
- Protected ranges
- Named ranges
- Pivot tables
- Filtering and sorting
- Cell comments
- Version history

## Integration with Other Services

The Sheets integration can work alongside:
- **Forms** - Export form responses to Sheets
- **Gmail** - Attach spreadsheets to emails
- **Calendar** - Link event data to Sheets
- **GitHub** - Track issues/PRs in Sheets

## License

Same as parent project.
