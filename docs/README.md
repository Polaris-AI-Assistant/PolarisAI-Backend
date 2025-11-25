# Google Docs Integration 📄

AI-powered Google Docs assistant with natural language interface. Create, edit, format, and manage documents using conversational commands.

## ✨ Features

### 🤖 AI Assistant
- **Natural Language Processing** - Talk to your documents in plain English
- **Multi-Step Tasks** - Complex operations handled automatically
- **Context Aware** - Remembers conversation history
- **Smart Responses** - Formatted, helpful replies

### 📝 Document Operations
- **Create** - Make new documents with titles
- **Write** - Insert, append, or replace text
- **Format** - Bold, italic, underline, colors
- **Read** - Get content and structure
- **Search** - Find text within documents
- **Manage** - List, share, delete documents

### 🎯 Use Cases
- **Meeting Notes** - Create and organize meeting summaries
- **Memory Storage** - Store cross-app AI context
- **Knowledge Base** - Build searchable document libraries
- **Content Generation** - AI-assisted writing and editing
- **Collaboration** - Share documents with team members

## 🚀 Quick Start

### 1. Environment Setup

Add to `.env`:
```env
GOOGLE_DOCS_CLIENT_ID=your_client_id
GOOGLE_DOCS_CLIENT_SECRET=your_client_secret
GOOGLE_DOCS_REDIRECT_URI=http://localhost:5173/auth/docs/callback
OPENAI_API_KEY=your_openai_key
```

### 2. Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project or select existing
3. Enable APIs:
   - Google Docs API
   - Google Drive API
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URI: `http://localhost:5173/auth/docs/callback`
5. Copy Client ID and Secret to `.env`

### 3. Database Setup

```bash
psql -U postgres -d your_database -f docs/create_docs_tokens_table.sql
```

This creates the `docs_tokens` table with RLS disabled.

### 4. Install Dependencies

```bash
# Backend
cd FYP
npm install googleapis

# Frontend
cd frontend
npm install
```

### 5. Start Servers

```bash
# Terminal 1 - Backend
cd FYP
node index.js

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### 6. Connect and Use

1. Navigate to `http://localhost:5173/dashboard`
2. Click on "Google Docs" in the app list
3. Click "Connect Google Docs"
4. Complete OAuth flow
5. Start chatting with your Docs AI assistant!

## 💬 Example Commands

### Document Creation
```
"Create a document called 'Project Plan 2025'"
"Make a new doc titled 'Meeting Notes - Oct 29'"
"Create a memory log for today's conversation"
```

### Writing & Editing
```
"Add 'Project deadline: Nov 15' to document abc123"
"Append these meeting notes to the end of my doc"
"Replace 'old version' with 'new version' in document xyz"
```

### Formatting
```
"Make the first paragraph bold in document abc123"
"Highlight 'Important Notice' in red"
"Make lines 10-20 italic"
```

### Reading & Searching
```
"What's in my document titled 'Meeting Notes'?"
"Read document abc123 and summarize it"
"Search for 'deadline' in all my docs"
```

### Management
```
"List all my documents"
"Share document abc123 with user@example.com as editor"
"Delete the document titled 'Old Draft'"
```

## 🛠️ API Tools

| Tool | Purpose | API Used |
|------|---------|----------|
| `createDocument` | Create new documents | documents.create |
| `insertText` | Insert text at position | documents.batchUpdate |
| `appendText` | Add to document end | documents.batchUpdate |
| `insertParagraphBreak` | Add line breaks | documents.batchUpdate |
| `updateTextStyle` | Format text | documents.batchUpdate |
| `readDocument` | Read full content | documents.get |
| `searchInDocument` | Find text | documents.get + parsing |
| `listDocuments` | View all docs | drive.files.list |
| `getDocumentMetadata` | Get doc info | drive.files.get |
| `shareDocument` | Share with others | drive.permissions.create |
| `deleteDocument` | Remove docs | drive.files.delete |
| `replaceText` | Find & replace | documents.batchUpdate |

## 📡 API Endpoints

### Authentication
- `GET /api/auth/docs/connect` - Start OAuth flow
- `GET /api/auth/docs/callback` - OAuth callback handler
- `GET /api/docs/status` - Check connection status
- `DELETE /api/auth/docs/disconnect` - Disconnect account

### Data Access
- `GET /api/docs/list?pageSize=50` - List user's documents
- `GET /api/docs/:documentId` - Get document metadata
- `GET /api/docs/:documentId/content` - Read document content

### AI Agent
- `POST /api/docs/agent/query` - Process natural language query
- `GET /api/docs/agent/examples` - Get example queries
- `GET /api/docs/agent/capabilities` - Get tool capabilities

## 🎨 User Interface

### Chat Interface (`/docs`)
- **Connection Status** - Shows connected email
- **Message Input** - Natural language queries
- **Formatted Responses** - Bold, links, code formatting
- **Sidebar** - Capabilities and example queries
- **Quick Disconnect** - Easy account removal

### Dashboard Integration
- **App Card** - Status, connect/disconnect buttons
- **Green Indicator** - Shows connection status
- **Direct Navigation** - Quick access to chat
- **Sidebar Link** - Always accessible

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│           Frontend (Next.js)                │
│  ┌────────────┐  ┌──────────────┐          │
│  │ /docs page │  │ /dashboard   │          │
│  │  (Chat)    │  │  (Connect)   │          │
│  └─────┬──────┘  └──────┬───────┘          │
│        │                │                    │
│        v                v                    │
│   ┌────────────────────────────┐            │
│   │     lib/docs.ts (API)      │            │
│   └────────────┬───────────────┘            │
└────────────────┼────────────────────────────┘
                 │ HTTP/JSON
┌────────────────┼────────────────────────────┐
│                v                             │
│     Backend (Express.js + Node)             │
│  ┌──────────────────────────────────┐       │
│  │  docsAgentController.js          │       │
│  │  (HTTP Endpoints)                │       │
│  └──────────┬───────────────────────┘       │
│             │                                │
│             v                                │
│  ┌──────────────────────────────────┐       │
│  │  docsAgent.js (OpenAI GPT-4)     │       │
│  │  - Natural language processing   │       │
│  │  - Function calling              │       │
│  └──────────┬───────────────────────┘       │
│             │                                │
│             v                                │
│  ┌──────────────────────────────────┐       │
│  │  docsService.js (12 Tools)       │       │
│  │  - Google Docs API v1            │       │
│  │  - Google Drive API v3           │       │
│  └──────────┬───────────────────────┘       │
│             │                                │
│             v                                │
│  ┌──────────────────────────────────┐       │
│  │  docsAuth.js (OAuth 2.0)         │       │
│  │  - Token management              │       │
│  │  - Auto refresh                  │       │
│  └──────────┬───────────────────────┘       │
└─────────────┼──────────────────────────────┘
              │
              v
┌─────────────────────────────────────────────┐
│      Supabase PostgreSQL Database           │
│  ┌──────────────────────────────────┐       │
│  │  docs_tokens table               │       │
│  │  - user_id, email, tokens        │       │
│  │  - RLS disabled                  │       │
│  └──────────────────────────────────┘       │
└─────────────────────────────────────────────┘
```

## 🔐 Security

### OAuth 2.0
- Secure Google authentication
- Token encryption in database
- Automatic token refresh
- Revocation on disconnect

### Access Control
- User-specific tokens
- Protected API endpoints
- JWT authentication required
- No RLS (per user requirement)

### Scopes
```
documents        - Read/write document content
drive.file       - Create and access created files
drive.readonly   - List and read file metadata
userinfo.email   - Get user email
userinfo.profile - Get user profile
```

## 📊 Database Schema

```sql
CREATE TABLE docs_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  email VARCHAR(255) NOT NULL,
  tokens JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_docs_tokens_user_id ON docs_tokens(user_id);
CREATE INDEX idx_docs_tokens_email ON docs_tokens(email);

-- RLS disabled per requirement
ALTER TABLE docs_tokens DISABLE ROW LEVEL SECURITY;
```

## 🧪 Testing

### Manual Testing

1. **Connection Test**
   ```bash
   curl http://localhost:3000/api/docs/status \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

2. **Agent Test**
   ```bash
   curl -X POST http://localhost:3000/api/docs/agent/query \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{"query":"List my documents"}'
   ```

3. **OAuth Flow**
   - Visit `/dashboard`
   - Click "Google Docs"
   - Click "Connect"
   - Complete OAuth
   - Verify redirect to `/docs`

### Integration Testing

See `TESTING_GUIDE.md` for comprehensive test cases.

## 📁 File Structure

```
FYP/
└── docs/
    ├── docsAuth.js              # OAuth 2.0 flow (230 lines)
    ├── docsService.js           # 12 API tools (520 lines)
    ├── docsAgent.js             # AI agent (420 lines)
    ├── docsAgentController.js   # HTTP endpoints (75 lines)
    ├── docsData.js              # Data routes (75 lines)
    ├── create_docs_tokens_table.sql
    ├── README.md                # This file
    ├── IMPLEMENTATION_SUMMARY.md
    └── QUICK_REFERENCE.md

frontend/
├── lib/
│   └── docs.ts                  # API client (180 lines)
├── app/
│   ├── docs/
│   │   └── page.tsx             # Chat UI (550 lines)
│   ├── auth/docs/callback/
│   │   └── page.tsx             # OAuth callback (110 lines)
│   └── dashboard/
│       └── page.tsx             # Dashboard integration
```

## 🔄 Updates & Maintenance

### Adding New Tools

1. **Service Layer** (`docsService.js`)
   ```javascript
   async function newTool(userId, params) {
     const docs = await getDocsClient(userId);
     // Implement tool logic
     return { success: true, data };
   }
   ```

2. **Agent Layer** (`docsAgent.js`)
   ```javascript
   // Add to defineTools()
   {
     type: 'function',
     function: {
       name: 'newTool',
       description: 'Tool description',
       parameters: { /* schema */ }
     }
   }
   
   // Add to createFunctionMap()
   newTool: async (args) => docsService.newTool(userId, args)
   ```

### Updating Dependencies

```bash
npm update googleapis
npm update openai
```

### Database Migrations

Store migrations in `docs/migrations/` directory.

## 🐛 Troubleshooting

### Common Issues

**Issue**: "No connection found"
- **Fix**: Complete OAuth flow, check `docs_tokens` table

**Issue**: "Permission denied"
- **Fix**: Verify all scopes enabled in Google Console

**Issue**: "Invalid redirect URI"
- **Fix**: Ensure redirect URI matches exactly in Google Console

**Issue**: "Tool execution failed"
- **Fix**: Check service function logs, verify document ID

### Debug Mode

Enable verbose logging:
```javascript
// In docsService.js
console.log('API call:', { method, params });
console.log('API response:', response.data);
```

### Support

- [Google Docs API Docs](https://developers.google.com/docs/api)
- [Google Drive API Docs](https://developers.google.com/drive/api)
- [OpenAI API Docs](https://platform.openai.com/docs)

## 📈 Performance

- **Token caching** - Reduces API calls
- **Auto refresh** - Prevents expiration
- **Batch operations** - Efficient updates
- **Indexed queries** - Fast database lookups

## 🎯 Future Enhancements

- [ ] Collaborative editing
- [ ] Version history
- [ ] Template library
- [ ] Export to PDF/Word
- [ ] Offline mode
- [ ] Advanced formatting
- [ ] Image insertion
- [ ] Table support
- [ ] Comments & suggestions

## 📄 License

Part of the FYP project. See main project LICENSE.

## 🙏 Acknowledgments

- Google Docs API
- Google Drive API
- OpenAI GPT-4
- Next.js
- Express.js
- Supabase

---

**Ready to use!** 🎉 All 12 tools implemented, AI agent active, dashboard integrated.
