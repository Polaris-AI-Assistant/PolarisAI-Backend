# Google Sheets Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                   USER                                       │
│                          (Browser / Frontend)                                │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   │ HTTP Requests
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            FRONTEND (Next.js)                                │
│                          http://localhost:3001                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────────────────┐     ┌──────────────────────┐                    │
│  │   /sheets/page.tsx    │────▶│   lib/sheets.ts      │                    │
│  │                       │     │                      │                    │
│  │  • Chat Interface     │     │  • checkSheetsStatus │                    │
│  │  • Message Display    │     │  • getSheetsAuthUrl  │                    │
│  │  • Connection Status  │     │  • querySheetsAgent  │                    │
│  │  • Example Prompts    │     │  • getUserSpreadsheets│                    │
│  └───────────────────────┘     └──────────────────────┘                    │
│                                                                              │
│  ┌───────────────────────────────────────────────────┐                     │
│  │   /auth/sheets/callback/page.tsx                  │                     │
│  │   • OAuth callback handler                        │                     │
│  │   • Success/error display                         │                     │
│  └───────────────────────────────────────────────────┘                     │
│                                                                              │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   │ API Calls (JWT Auth)
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             BACKEND (Node.js)                                │
│                          http://localhost:3000                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐│
│  │                          index.js (Router)                              ││
│  │  • CORS middleware                                                      ││
│  │  • Route registration                                                   ││
│  │  • Error handling                                                       ││
│  └────────────────────────────────────────────────────────────────────────┘│
│                              │                                               │
│        ┌─────────────────────┼─────────────────────┐                       │
│        ▼                     ▼                     ▼                       │
│  ┌─────────────┐      ┌─────────────┐      ┌──────────────┐              │
│  │ sheetsAuth  │      │ sheetsData  │      │sheetsAgent   │              │
│  │             │      │             │      │Controller    │              │
│  │ /api/auth/  │      │ /api/sheets/│      │              │              │
│  │ sheets/*    │      │ list        │      │/api/sheets/  │              │
│  │             │      │ /:id        │      │agent/*       │              │
│  └──────┬──────┘      └──────┬──────┘      └──────┬───────┘              │
│         │                    │                    │                        │
│         │                    │                    ▼                        │
│         │                    │             ┌──────────────┐                │
│         │                    │             │ sheetsAgent  │                │
│         │                    │             │              │                │
│         │                    │             │ • GPT-4      │                │
│         │                    │             │ • 19 Tools   │                │
│         │                    │             │ • NLP        │                │
│         │                    │             └──────┬───────┘                │
│         │                    │                    │                        │
│         │                    ▼                    │                        │
│         │             ┌──────────────────────────┘                        │
│         │             ▼                                                    │
│         │      ┌──────────────┐                                            │
│         │      │sheetsService │                                            │
│         │      │              │                                            │
│         │      │ 19 Functions:│                                            │
│         │      │ • createSpreadsheet                                       │
│         │      │ • getValues                                               │
│         │      │ • addSheet                                                │
│         │      │ • listSpreadsheets                                        │
│         │      │ • deleteSpreadsheet                                       │
│         │      │ • readRows                                                │
│         │      │ • editRow                                                 │
│         │      │ • insertRow                                               │
│         │      │ • insertColumn                                            │
│         │      │ • renameSheet                                             │
│         │      │ • getSpreadsheet                                          │
│         │      │ • updateValues                                            │
│         │      │ • deleteSheet                                             │
│         │      │ • shareSpreadsheet                                        │
│         │      │ • formatCells                                             │
│         │      │ • readColumns                                             │
│         │      │ • editColumn                                              │
│         │      │ • editCell                                                │
│         │      │ • readHeadings                                            │
│         │      └──────┬───────┘                                            │
│         │             │                                                    │
│         └─────────────┼────────────────────────────────┐                  │
│                       │                                │                  │
└───────────────────────┼────────────────────────────────┼──────────────────┘
                        │                                │
            ┌───────────▼────────────┐      ┌───────────▼────────────┐
            │   Google Sheets API    │      │   Supabase Database    │
            │   (googleapis/sheets)  │      │                        │
            │                        │      │  ┌──────────────────┐  │
            │  • OAuth 2.0           │      │  │ sheets_tokens    │  │
            │  • Spreadsheets API    │      │  │                  │  │
            │  • Drive API           │      │  │ • user_id        │  │
            │                        │      │  │ • email          │  │
            │  Scopes:               │      │  │ • access_token   │  │
            │  • spreadsheets        │      │  │ • refresh_token  │  │
            │  • drive.file          │      │  │ • expiry_date    │  │
            │  • drive.readonly      │      │  │ • scope          │  │
            └────────────────────────┘      │  └──────────────────┘  │
                                           │                        │
                                           │  • RLS enabled         │
                                           │  • User isolation      │
                                           └────────────────────────┘

                        ┌─────────────────────┐
                        │  OpenAI GPT-4 API   │
                        │                     │
                        │  • Function Calling │
                        │  • NLP Processing   │
                        │  • Tool Selection   │
                        └─────────────────────┘
```

## Component Responsibilities

### Frontend Components

**`/sheets/page.tsx`**
- Main chat interface
- Connection status display
- Message history management
- User input handling
- Response formatting

**`/auth/sheets/callback/page.tsx`**
- OAuth callback processing
- Success/error handling
- Redirect management

**`lib/sheets.ts`**
- API client functions
- HTTP request handling
- Response processing
- Error handling

### Backend Components

**`sheetsAuth.js`**
- OAuth URL generation
- Token exchange
- Token storage
- Connection status
- Disconnect handling

**`sheetsService.js`**
- Google Sheets API wrapper
- 19 tool implementations
- Token refresh handling
- Error handling

**`sheetsAgent.js`**
- OpenAI integration
- Natural language processing
- Function calling orchestration
- Multi-tool operations
- System prompt management

**`sheetsAgentController.js`**
- HTTP endpoint routing
- Request validation
- Response formatting
- Agent invocation

**`sheetsData.js`**
- Data access endpoints
- List spreadsheets
- Get spreadsheet details
- Get cell values

### Database

**`sheets_tokens` table**
- User token storage
- OAuth credentials
- Row-level security
- Automatic cleanup

## Data Flow

### 1. OAuth Connection Flow
```
User clicks "Connect" → Frontend requests auth URL → Backend generates OAuth URL
→ User redirects to Google → User authorizes → Google redirects to callback
→ Backend exchanges code for tokens → Tokens stored in database
→ User redirected to frontend → Connection successful
```

### 2. Natural Language Query Flow
```
User types query → Frontend sends to /api/sheets/agent/query
→ Controller validates request → Agent processes with GPT-4
→ GPT-4 selects tools → Agent executes tools via sheetsService
→ sheetsService calls Google Sheets API → Results aggregated
→ GPT-4 generates response → Controller returns to frontend
→ Frontend displays formatted response
```

### 3. Direct API Call Flow
```
Frontend requests spreadsheet list → /api/sheets/list endpoint
→ sheetsData.js → sheetsService.listSpreadsheets()
→ Get user tokens from database → Google Drive API call
→ Results filtered and paginated → Response returned to frontend
```

## Security Layers

1. **Frontend**: JWT validation before API calls
2. **Backend**: authenticateToken middleware on all protected routes
3. **Database**: Row-level security ensures users only access their tokens
4. **Google**: OAuth 2.0 with specific scopes
5. **Tokens**: Automatic refresh, secure storage

## Scaling Considerations

- **Caching**: Token caching reduces database queries
- **Rate Limiting**: Google API limits handled gracefully
- **Pagination**: Large spreadsheet lists paginated
- **Async Operations**: Non-blocking async/await throughout
- **Error Recovery**: Comprehensive error handling and retries

## Integration Points

- **Forms**: Share response data via Sheets
- **Gmail**: Attach spreadsheets to emails
- **Calendar**: Link event data to Sheets
- **GitHub**: Track repository metrics in Sheets
