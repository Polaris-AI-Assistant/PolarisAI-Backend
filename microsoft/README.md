# Microsoft 365 Integration

This module provides comprehensive Microsoft 365 integration for Polaris AI, enabling users to interact with Outlook Mail, Microsoft Calendar, OneDrive, and Excel through natural language queries.

## Overview

The Microsoft 365 integration uses OAuth 2.0 with Microsoft Identity Platform (Azure AD) to authenticate users and access Microsoft Graph API. It supports incremental consent, allowing users to connect individual apps without re-authenticating for everything.

## Architecture

```
microsoft/
├── microsoftAuth.js          # OAuth 2.0 authentication routes
├── microsoftService.js       # Microsoft Graph API operations
├── microsoftAgent.js         # AI Agent with OpenAI function calling
├── microsoftAgentController.js # Express routes for agent endpoints
├── create_microsoft_tokens_table.sql # Supabase table schema
└── README.md                 # This file
```

## Supported Apps

| App | Scopes | Capabilities |
|-----|--------|--------------|
| **Outlook Mail** | `Mail.Read`, `Mail.Send`, `Mail.ReadWrite` | List emails, send emails, reply, forward, search |
| **Microsoft Calendar** | `Calendars.Read`, `Calendars.ReadWrite` | List events, create events, update events, delete events |
| **OneDrive** | `Files.Read`, `Files.ReadWrite` | List files, upload files, download files, create folders |
| **Excel** | `Files.Read`, `Files.ReadWrite` | List worksheets, read ranges, update cells, add rows |

## Environment Variables

Add these to your `.env` file:

```env
# Microsoft 365 OAuth Configuration
MICROSOFT_CLIENT_ID=your_azure_app_client_id
MICROSOFT_CLIENT_SECRET=your_client_secret_value
MICROSOFT_REDIRECT_URI=http://localhost:3000/api/auth/microsoft/callback
```

## Azure AD App Registration

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** > **App registrations**
3. Click **New registration**
4. Set:
   - Name: "Polaris AI"
   - Supported account types: "Accounts in any organizational directory and personal Microsoft accounts"
   - Redirect URI: Web - `http://localhost:3000/api/auth/microsoft/callback`
5. Note the **Application (client) ID**
6. Go to **Certificates & secrets** > **New client secret**
7. Copy the secret **Value** (not the ID)
8. Go to **API permissions** > **Add a permission** > **Microsoft Graph** > **Delegated permissions**
9. Add:
   - `User.Read`
   - `Mail.Read`, `Mail.Send`, `Mail.ReadWrite`
   - `Calendars.Read`, `Calendars.ReadWrite`
   - `Files.Read`, `Files.ReadWrite`
   - `offline_access`

## Database Setup

Run this SQL in your Supabase SQL Editor:

```sql
-- See create_microsoft_tokens_table.sql for full schema
CREATE TABLE microsoft_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  granted_scopes TEXT[] DEFAULT '{}',
  connected_apps JSONB DEFAULT '{}',
  email TEXT,
  name TEXT,
  microsoft_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);
```

## API Endpoints

### Authentication Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/microsoft/:app/start` | Start OAuth flow for specific app |
| GET | `/api/auth/microsoft/:app/url` | Get OAuth URL without redirect |
| GET | `/api/auth/microsoft/callback` | OAuth callback handler |
| GET | `/api/auth/microsoft/status` | Get connection status for all apps |
| POST | `/api/auth/microsoft/disconnect` | Disconnect all Microsoft apps |
| POST | `/api/auth/microsoft/disconnect/:app` | Disconnect specific app |
| POST | `/api/auth/microsoft/refresh` | Refresh access token |

### Agent Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/microsoft/agent` | Process natural language query |
| POST | `/api/microsoft/execute` | Execute specific tool directly |

## OAuth Flow

```
┌─────────────┐      ┌──────────────┐      ┌────────────────┐
│   Frontend  │      │   Backend    │      │  Microsoft     │
│  Dashboard  │      │   Server     │      │  Identity      │
└──────┬──────┘      └──────┬───────┘      └───────┬────────┘
       │                    │                      │
       │ 1. Connect Outlook │                      │
       │───────────────────>│                      │
       │                    │                      │
       │ 2. Redirect to     │                      │
       │<───────────────────│                      │
       │    OAuth URL       │                      │
       │                    │                      │
       │ 3. User authenticates                     │
       │──────────────────────────────────────────>│
       │                    │                      │
       │ 4. Redirect with code                     │
       │<──────────────────────────────────────────│
       │                    │                      │
       │ 5. Forward to callback                    │
       │───────────────────>│                      │
       │                    │                      │
       │                    │ 6. Exchange code     │
       │                    │─────────────────────>│
       │                    │                      │
       │                    │ 7. Access + Refresh  │
       │                    │<─────────────────────│
       │                    │                      │
       │                    │ 8. Store in Supabase │
       │                    │                      │
       │ 9. Redirect to     │                      │
       │<───────────────────│                      │
       │    dashboard       │                      │
       │                    │                      │
```

## Incremental Consent

When a user connects a new app, the system:

1. Gets current granted scopes from database
2. Merges new app scopes with existing
3. Requests OAuth with combined scopes
4. Microsoft prompts only for NEW scopes
5. Updates database with merged scope set

This means users don't need to re-approve already-granted permissions.

## Agent Capabilities

### Outlook Tools
- `list_outlook_emails` - List emails from inbox with optional limit
- `search_outlook_emails` - Search emails by keyword
- `send_outlook_email` - Send new email
- `reply_to_outlook_email` - Reply to existing email
- `forward_outlook_email` - Forward email to another recipient

### Calendar Tools
- `list_calendar_events` - List events within date range
- `create_calendar_event` - Create new event with attendees
- `update_calendar_event` - Update existing event
- `delete_calendar_event` - Delete event

### OneDrive Tools
- `list_onedrive_files` - List files and folders
- `upload_onedrive_file` - Upload file content
- `download_onedrive_file` - Get file content
- `create_onedrive_folder` - Create new folder

### Excel Tools
- `list_excel_worksheets` - List worksheets in workbook
- `get_excel_range` - Read cell range
- `update_excel_range` - Update cell values

## Usage Examples

### Natural Language Queries

```javascript
// Send to POST /api/microsoft/agent
{
  "query": "Show me my emails from today"
}

// Response
{
  "success": true,
  "response": "Here are your 5 emails from today:\n1. Meeting reminder from boss@company.com...",
  "toolsUsed": ["list_outlook_emails"]
}
```

### Direct Tool Execution

```javascript
// Send to POST /api/microsoft/execute
{
  "tool": "send_outlook_email",
  "params": {
    "to": "colleague@company.com",
    "subject": "Project Update",
    "body": "The project is on track..."
  }
}
```

## Frontend Integration

```typescript
import { 
  checkMicrosoftStatus, 
  connectMicrosoftApp,
  disconnectMicrosoftApp 
} from '@/lib/microsoft';

// Check which apps are connected
const status = await checkMicrosoftStatus();
// { outlook: true, calendar: false, onedrive: true, excel: false }

// Connect a specific app
await connectMicrosoftApp('calendar');
// Redirects to Microsoft OAuth

// Disconnect a specific app
await disconnectMicrosoftApp('outlook');
// Note: This clears all tokens currently (scope removal not supported by Microsoft)
```

## Error Handling

All endpoints return consistent error format:

```json
{
  "success": false,
  "error": "Error message here",
  "details": "Optional additional details"
}
```

Common errors:
- `401` - Not authenticated or token expired
- `403` - Missing required scopes for the operation
- `404` - Resource not found (email, event, file)
- `500` - Internal server error

## Token Refresh

Access tokens expire after ~1 hour. The system automatically:
1. Checks token expiry before API calls
2. Refreshes using refresh_token if expired
3. Updates stored tokens in database
4. Retries the original request

## Security Considerations

1. **Token Storage**: Tokens stored encrypted in Supabase with RLS
2. **Scope Validation**: Each tool validates required scopes before execution
3. **User Isolation**: RLS policies ensure users only access their own tokens
4. **HTTPS**: Use HTTPS in production for OAuth redirect
5. **Secret Management**: Never expose client secret to frontend

## Troubleshooting

### "Invalid client" error
- Verify `MICROSOFT_CLIENT_ID` matches Azure AD app
- Check redirect URI matches exactly (including trailing slashes)

### "AADSTS50011" error
- Redirect URI not registered in Azure AD
- Add `http://localhost:3000/api/auth/microsoft/callback` to app registration

### "insufficient_scope" error
- User hasn't granted required permissions
- Trigger re-authentication for the specific app

### Token refresh fails
- Refresh token may be expired (>90 days inactive)
- User must re-authenticate

## Related Files

- [Main Agent](../mainAgent/mainAgent.js) - Routes queries to Microsoft agent
- [Frontend Microsoft Library](../../PolarisAI-Frontend/lib/microsoft.ts)
- [Dashboard Page](../../PolarisAI-Frontend/app/dashboard/page.tsx)
- [Apps Integration Component](../../PolarisAI-Frontend/components/apps-integrations.tsx)
