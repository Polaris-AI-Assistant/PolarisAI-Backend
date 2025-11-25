# Google Forms Integration

This module provides integration with Google Forms API, allowing users to connect their Google account and access their forms, responses, and related data.

## Features

- **OAuth 2.0 Authentication**: Secure authentication with Google using OAuth 2.0
- **Forms Access**: List and view all forms accessible to the user
- **Form Responses**: Fetch responses for specific forms
- **Multi-Service Scopes**: Supports Gmail, Calendar, Forms, and Sheets scopes
- **Token Management**: Automatic token refresh and storage in Supabase

## OAuth Scopes

The integration requests the following scopes:
- `https://www.googleapis.com/auth/userinfo.email` - User email
- `https://www.googleapis.com/auth/userinfo.profile` - User profile
- `https://www.googleapis.com/auth/gmail.readonly` - Read-only Gmail access
- `https://www.googleapis.com/auth/calendar` - Full calendar access
- `https://www.googleapis.com/auth/forms.body` - Read and manage forms
- `https://www.googleapis.com/auth/forms.responses.readonly` - Read form responses
- `https://www.googleapis.com/auth/spreadsheets` - Read and manage spreadsheets

## Setup

### 1. Google Cloud Console Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Google Forms API
   - Google Drive API (for listing forms)
   - Google Sheets API (if using spreadsheets)
   - Gmail API (if needed)
   - Google Calendar API (if needed)
4. Create OAuth 2.0 credentials:
   - Go to "Credentials" → "Create Credentials" → "OAuth client ID"
   - Application type: Web application
   - Add authorized redirect URI: `http://localhost:3000/api/auth/forms/callback`
   - Save the Client ID and Client Secret

### 2. Environment Variables

Add the following to your `.env` file:

```env
GOOGLE_FORMS_CLIENT_ID=your_client_id_here
GOOGLE_FORMS_CLIENT_SECRET=your_client_secret_here
GOOGLE_FORMS_REDIRECT_URI=http://localhost:3000/api/auth/forms/callback
```

### 3. Database Setup

Run the SQL script to create necessary tables:

```bash
# Run the SQL file in your Supabase project
psql -f create_forms_tables.sql
```

Or execute the SQL directly in Supabase SQL Editor:
- `forms_tokens` - Stores OAuth tokens
- `forms_data` - Stores form metadata
- `forms_responses` - Stores form responses (optional)

## API Endpoints

### Backend (Express)

#### Authentication
- `GET /api/auth/forms/url/authenticated` - Get OAuth URL (requires auth)
- `GET /api/auth/forms/callback` - OAuth callback handler
- `GET /api/forms/status` - Check connection status (requires auth)
- `POST /api/forms/disconnect` - Disconnect Forms (requires auth)

#### Forms Data
- `GET /api/forms/list` - List all user forms (requires auth)
- `GET /api/forms/:formId` - Get specific form (requires auth)
- `GET /api/forms/:formId/responses` - Get form responses (requires auth)
- `POST /api/forms/fetch` - Fetch and store forms (requires auth)

### Frontend (Next.js)

#### Pages
- `/forms` - Main forms management page
- `/auth/forms/callback` - OAuth callback page

#### Library Functions
```typescript
import { 
  getFormsAuthUrl, 
  checkFormsStatus, 
  getUserForms,
  getFormById,
  getFormResponses,
  fetchAndStoreForms,
  disconnectForms 
} from '@/lib/forms';
```

## Usage

### Connect Google Forms

1. User clicks "Connect Google Forms" button
2. User is redirected to Google OAuth consent screen
3. After authorization, user is redirected back to the app
4. OAuth tokens are stored in Supabase

### Fetch Forms

```javascript
// Backend
const { getUserForms } = require('./forms/formsService');
const result = await getUserForms(user_id);

// Frontend
import { getUserForms } from '@/lib/forms';
const result = await getUserForms();
```

### Get Form Responses

```javascript
// Backend
const { getFormResponses } = require('./forms/formsService');
const result = await getFormResponses(user_id, formId);

// Frontend
import { getFormResponses } from '@/lib/forms';
const result = await getFormResponses(formId);
```

## File Structure

```
FYP/
  forms/
    formsAuth.js       # OAuth routes and authentication
    formsService.js    # Google Forms API service
    formsData.js       # Data routes (list, get, fetch)
  create_forms_tables.sql # Database schema

frontend/
  lib/
    forms.ts           # Frontend Forms service
  app/
    forms/
      page.tsx         # Forms management page
    auth/
      forms/
        callback/
          page.tsx     # OAuth callback handler
```

## Security

- **Row Level Security (RLS)**: Enabled on all tables
- **Authentication Required**: All endpoints require valid JWT token
- **Token Encryption**: Tokens stored securely in Supabase
- **Automatic Refresh**: Access tokens automatically refreshed when expired

## Notes

- Google Forms API doesn't have a direct "list" endpoint - forms are listed via Google Drive API
- The integration supports multiple Google services with shared credentials
- Refresh tokens are preserved across token updates
- Forms are accessed by their unique Form ID

## Troubleshooting

### "User tokens not found"
- User needs to connect their Google account first
- Check if tokens exist in `forms_tokens` table

### "Failed to fetch forms"
- Verify Google Forms API is enabled in Google Cloud Console
- Check OAuth scopes include required permissions
- Ensure access token is valid and not expired

### "Invalid redirect URI"
- Verify redirect URI in Google Cloud Console matches `.env` file
- Check for trailing slashes or http vs https mismatch

## Future Enhancements

- Form response embeddings for semantic search
- Form creation and editing capabilities
- Webhook support for real-time response notifications
- Integration with Google Sheets for response data
- Analytics and insights from form responses
