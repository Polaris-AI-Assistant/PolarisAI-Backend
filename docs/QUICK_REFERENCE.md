# Google Docs Integration - Quick Reference

## 🚀 Quick Start

### Environment Setup
```env
GOOGLE_DOCS_CLIENT_ID=your_client_id_here
GOOGLE_DOCS_CLIENT_SECRET=your_client_secret_here
GOOGLE_DOCS_REDIRECT_URI=http://localhost:5173/auth/docs/callback
OPENAI_API_KEY=your_openai_key_here
```

### Database Setup
```bash
psql -U postgres -d your_db -f docs/create_docs_tokens_table.sql
```

### Start Servers
```bash
# Backend
cd FYP
node index.js

# Frontend
cd frontend
npm run dev
```

## 📡 API Endpoints

### Auth & Connection
```http
GET  /api/auth/docs/connect          # Start OAuth
GET  /api/auth/docs/callback         # OAuth callback
GET  /api/docs/status                # Check connection
DELETE /api/auth/docs/disconnect     # Remove connection
```

### Data Access
```http
GET  /api/docs/list?pageSize=50         # List documents
GET  /api/docs/:documentId              # Get metadata
GET  /api/docs/:documentId/content      # Read content
```

### AI Agent
```http
POST /api/docs/agent/query           # Natural language query
GET  /api/docs/agent/examples        # Get examples
GET  /api/docs/agent/capabilities    # Get capabilities
```

## 🛠️ 12 Available Tools

### Document Creation & Management
```javascript
// 1. Create Document
createDocument(userId, title)
// Returns: { success, documentId, documentUrl, title }

// 8. List Documents
listDocuments(userId, { pageSize: 50 })
// Returns: { success, documents[], count }

// 9. Get Metadata
getDocumentMetadata(userId, documentId)
// Returns: { success, metadata{} }

// 11. Delete Document
deleteDocument(userId, documentId)
// Returns: { success, message }
```

### Writing & Editing
```javascript
// 2. Insert Text
insertText(userId, documentId, text, index)
// index=1 for beginning

// 3. Append Text
appendText(userId, documentId, text)
// Adds to end of document

// 4. Insert Paragraph Break
insertParagraphBreak(userId, documentId, index)
// Adds new line at position

// 12. Replace Text
replaceText(userId, documentId, searchText, replaceText)
// Find and replace all occurrences
```

### Formatting
```javascript
// 5. Update Text Style
updateTextStyle(userId, documentId, startIndex, endIndex, {
  bold: true,
  italic: false,
  underline: true,
  foregroundColor: { red: 1.0, green: 0, blue: 0 }
})
// RGB values 0-1
```

### Reading & Searching
```javascript
// 6. Read Document
readDocument(userId, documentId)
// Returns: { success, title, content, structure[] }

// 7. Search in Document
searchInDocument(userId, documentId, searchQuery)
// Returns: { success, matches[], matchCount }
```

### Sharing
```javascript
// 10. Share Document
shareDocument(userId, documentId, email, role)
// role: 'reader' | 'writer' | 'commenter'
```

## 💬 Example Queries for AI Agent

### Quick Examples
```
"Create a document called 'Meeting Notes'"
"List all my documents"
"Add this text to document abc123: Hello World"
"Make lines 1-10 bold in document xyz789"
"Search for 'deadline' in document abc123"
"Share document abc123 with user@example.com as reader"
```

### Complex Examples
```
"Create a project plan document and add a header section with the title 'Q4 2025 Project Plan' in bold"

"Read my document titled 'Meeting Notes' and summarize the key action items"

"Search all my documents for mentions of 'budget' and list where it appears"

"Create a memory log document for today and add a summary of our conversation"
```

## 🎨 Frontend Usage

### Check Connection Status
```typescript
import { checkDocsStatus } from '@/lib/docs';

const status = await checkDocsStatus();
// { connected: boolean, email: string | null }
```

### Start OAuth Flow
```typescript
import { getDocsAuthUrl } from '@/lib/docs';

const { authUrl } = await getDocsAuthUrl();
window.location.href = authUrl;
```

### Query AI Agent
```typescript
import { queryDocsAgent } from '@/lib/docs';

const response = await queryDocsAgent(
  "Create a document called 'Notes'",
  conversationHistory
);
// { success, response, toolCalls[], conversationHistory[] }
```

### List Documents
```typescript
import { getUserDocuments } from '@/lib/docs';

const { documents } = await getUserDocuments(50);
// Array of { documentId, title, createdTime, url, ... }
```

### Disconnect
```typescript
import { disconnectDocs } from '@/lib/docs';

await disconnectDocs();
// { success: true, message: '...' }
```

## 🗄️ Database Schema

```sql
-- Table: docs_tokens
id          UUID PRIMARY KEY
user_id     UUID FK -> auth.users(id)
email       VARCHAR(255)
tokens      JSONB
created_at  TIMESTAMP
updated_at  TIMESTAMP

-- RLS: DISABLED
-- Indexes: user_id, email
```

## 🔐 OAuth Scopes

```
https://www.googleapis.com/auth/documents         # Read/write docs
https://www.googleapis.com/auth/drive.file        # Create files
https://www.googleapis.com/auth/drive.readonly    # List files
https://www.googleapis.com/auth/userinfo.email    # Get email
https://www.googleapis.com/auth/userinfo.profile  # Get profile
```

## 📁 File Structure

```
FYP/
├── docs/
│   ├── docsAuth.js              # OAuth flow
│   ├── docsService.js           # 12 API wrappers
│   ├── docsAgent.js             # AI agent
│   ├── docsAgentController.js   # HTTP endpoints
│   ├── docsData.js              # Data routes
│   └── create_docs_tokens_table.sql
└── index.js                     # Routes registered

frontend/
├── lib/
│   └── docs.ts                  # API client
├── app/
│   ├── docs/
│   │   └── page.tsx             # Chat interface
│   ├── auth/docs/callback/
│   │   └── page.tsx             # OAuth callback
│   └── dashboard/
│       └── page.tsx             # Integrated
```

## 🔧 Common Tasks

### Add New Tool
1. Add function to `docsService.js`
2. Add tool definition to `docsAgent.js` defineTools()
3. Add to function map in `docsAgent.js` createFunctionMap()
4. Test with AI agent

### Debug OAuth Issues
```javascript
// Check token storage
const { data } = await supabase
  .from('docs_tokens')
  .select('*')
  .eq('user_id', userId);

console.log('Stored tokens:', data);
```

### Test AI Agent Directly
```javascript
const { processQuery } = require('./docs/docsAgent');

const result = await processQuery(
  "List my documents",
  userId
);
console.log(result);
```

## 🐛 Troubleshooting

### "No connection found"
- Check docs_tokens table has entry for user
- Verify OAuth callback completed successfully
- Check token hasn't expired (refresh token should auto-renew)

### "Permission denied"
- Verify all OAuth scopes are enabled in Google Console
- Check API is enabled (Docs API + Drive API)
- Ensure redirect URI matches exactly

### "Tool not working"
- Check service function error logs
- Verify document ID is correct
- Test API call directly with googleapis

### Frontend connection fails
- Verify backend is running on port 3000
- Check CORS is enabled
- Verify auth token is being sent

## 📊 Monitoring

### Check Connection Health
```bash
curl http://localhost:3000/api/docs/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Agent Query
```bash
curl -X POST http://localhost:3000/api/docs/agent/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"query":"List my documents"}'
```

### Check Database
```sql
SELECT user_id, email, created_at 
FROM docs_tokens 
ORDER BY created_at DESC;
```

## 🎯 Integration Points

### Dashboard
- Status check on mount
- Green dot indicator
- Connect/disconnect buttons
- App card with navigation

### Sidebar
- "Google Docs" link
- Direct navigation to /docs
- Consistent styling

### Chat Interface
- Natural language input
- Formatted responses
- Tool execution display
- Conversation history

## ✅ Quick Validation

```bash
# 1. Check backend routes
node -e "const app = require('./index.js'); console.log('Docs routes loaded')"

# 2. Check database table
psql -U postgres -d your_db -c "SELECT COUNT(*) FROM docs_tokens;"

# 3. Check frontend compiles
cd frontend && npm run build

# 4. Test OAuth URL generation
curl http://localhost:3000/api/auth/docs/connect \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🚦 Status Indicators

- ✅ Green dot in dashboard = Connected
- ⚪ No dot = Not connected
- 🟢 "✓ Connected" button = Active connection
- ⚫ "Connect" button = No connection

## 📞 Support

### Google Console Setup
1. https://console.cloud.google.com
2. Enable Docs API + Drive API
3. Create OAuth 2.0 credentials
4. Add redirect URI

### OpenAI Setup
1. https://platform.openai.com
2. Create API key
3. Use GPT-4o model

---

**Ready to use!** All 12 tools implemented, AI agent configured, dashboard integrated.
