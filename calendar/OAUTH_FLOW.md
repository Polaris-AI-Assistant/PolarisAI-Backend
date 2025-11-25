# Google Calendar OAuth Flow Documentation

## Complete OAuth Flow Diagram

```
User clicks "Connect Google Calendar" on Dashboard
                    ↓
    Frontend checks if already connected
                    ↓
        [NOT CONNECTED PATH]
                    ↓
    handleCalendarConnect() triggered
                    ↓
    Redirects to: http://localhost:3000/api/auth/calendar/connect
                    ↓
    Backend (calendarAuth.js) receives request
                    ↓
    Extracts user_id from JWT token
                    ↓
    Creates state parameter with user_id
                    ↓
    Generates Google OAuth URL with scopes
                    ↓
    Redirects user to Google Consent Screen
                    ↓
    User grants permissions to app
                    ↓
    Google redirects to: http://localhost:3000/api/auth/calendar/callback?code=XXX&state=YYY
                    ↓
    Backend /auth/calendar/callback receives:
        - Authorization code
        - State with user_id
                    ↓
    Backend exchanges code for tokens:
        - access_token
        - refresh_token
        - expiry_date
                    ↓
    Backend fetches user profile from Google
                    ↓
    Backend stores tokens in Supabase calendar_tokens table
                    ↓
    Backend redirects to: http://localhost:3001/auth/calendar/callback?success=true&email=user@example.com
                    ↓
    Frontend callback page (page.tsx) displays:
        ✓ Success message
        ✓ Connected email
                    ↓
    After 3 seconds, redirects to /dashboard
                    ↓
    Dashboard refreshes and shows Calendar as connected
                    ↓
        [CONNECTED PATH]
                    ↓
    User clicks "✓ Connected - Open Assistant"
                    ↓
    Navigates to /calendar page
                    ↓
    Calendar page checks connection status
                    ↓
    If connected: Shows chat interface
    If not connected: Shows connection required message
```

## Key Components

### 1. Frontend Dashboard Button
**File**: `frontend/app/dashboard/page.tsx`
**Function**: `handleCalendarConnect()`

```typescript
const handleCalendarConnect = async () => {
  if (calendarStatus.connected) {
    // Already connected, navigate to chat page
    router.push('/calendar')
    return
  }

  // Not connected, initiate OAuth flow
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
  window.location.href = `${API_URL}/api/auth/calendar/connect`
}
```

### 2. Backend OAuth Initiation
**File**: `FYP/calendar/calendarAuth.js`
**Route**: `GET /api/auth/calendar/connect`

```javascript
router.get('/auth/calendar/connect', authenticateToken, (req, res) => {
  const state = Buffer.from(JSON.stringify({ 
    user_id: req.user.id,
    timestamp: Date.now(),
    service: 'calendar'
  })).toString('base64');
  
  const url = getAuthUrl(state);
  res.redirect(url); // Redirects to Google OAuth
});
```

### 3. Backend OAuth Callback
**File**: `FYP/calendar/calendarAuth.js`
**Route**: `GET /api/auth/calendar/callback`

```javascript
router.get('/auth/calendar/callback', async (req, res) => {
  const { code, state } = req.query;
  
  // Decode user_id from state
  const { user_id } = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
  
  // Exchange code for tokens
  const { tokens } = await oauth2Client.getToken(code);
  
  // Get user info
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const { data: userInfo } = await oauth2.userinfo.get();
  
  // Store tokens in database
  await supabase.from("calendar_tokens").insert([tokenData]);
  
  // Redirect to frontend callback
  res.redirect(`${process.env.FRONTEND_URL}/auth/calendar/callback?success=true&email=${userInfo.email}`);
});
```

### 4. Frontend OAuth Callback Page
**File**: `frontend/app/auth/calendar/callback/page.tsx`

```typescript
export default function CalendarCallback() {
  const searchParams = useSearchParams();
  const success = searchParams.get('success');
  const email = searchParams.get('email');
  
  // Show success message with email
  // After 3 seconds, redirect to dashboard
  setTimeout(() => {
    router.push('/dashboard');
  }, 3000);
}
```

### 5. Calendar Chat Page
**File**: `frontend/app/calendar/page.tsx`

```typescript
useEffect(() => {
  const initializeConnection = async () => {
    const status = await checkCalendarStatus();
    
    if (!status.connected) {
      // Show "Connection Required" message
    } else {
      // Show "Connected Successfully" message
      // Enable chat interface
    }
  };
  
  initializeConnection();
}, []);
```

## Environment Variables Required

### Backend (.env)
```bash
# Google Calendar OAuth
GOOGLE_CALENDAR_CLIENT_ID=your_client_id
GOOGLE_CALENDAR_CLIENT_SECRET=your_client_secret
GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:3000/api/auth/calendar/callback

# Frontend URL (for OAuth callback redirect)
FRONTEND_URL=http://localhost:3001

# Database
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```

### Frontend (.env.local) - Optional
```bash
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## Database Schema

### Table: `calendar_tokens`
```sql
CREATE TABLE calendar_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT NOT NULL,
  expiry_date BIGINT,
  scope TEXT,
  email TEXT NOT NULL,
  name TEXT,
  picture TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE calendar_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own tokens
CREATE POLICY "Users can access own calendar tokens"
  ON calendar_tokens
  FOR ALL
  USING (auth.uid() = user_id);
```

## OAuth Scopes

The Calendar agent requests the following scopes:
- `https://www.googleapis.com/auth/userinfo.email` - Get user email
- `https://www.googleapis.com/auth/userinfo.profile` - Get user profile
- `https://www.googleapis.com/auth/calendar` - Full calendar access
- `https://www.googleapis.com/auth/calendar.events` - Event management
- `openid` - OpenID Connect

## Google Cloud Console Setup

1. **Enable Google Calendar API**
   - Go to Google Cloud Console
   - Enable "Google Calendar API"

2. **Create OAuth 2.0 Credentials**
   - Create OAuth 2.0 Client ID
   - Application type: Web application
   - Authorized redirect URIs:
     ```
     http://localhost:3000/api/auth/calendar/callback
     ```

3. **Configure OAuth Consent Screen**
   - Add scopes:
     - `../auth/calendar`
     - `../auth/calendar.events`
     - `../auth/userinfo.email`
     - `../auth/userinfo.profile`

4. **Get Credentials**
   - Copy Client ID → `GOOGLE_CALENDAR_CLIENT_ID`
   - Copy Client Secret → `GOOGLE_CALENDAR_CLIENT_SECRET`

## Testing the Flow

### 1. Start Backend Server
```bash
cd FYP
node index.js
# Should see: Server running on http://localhost:3000
```

### 2. Start Frontend Server
```bash
cd frontend
npm run dev
# Should see: Local: http://localhost:3001
```

### 3. Test OAuth Flow
1. Navigate to `http://localhost:3001/dashboard`
2. Click on "Google Calendar" card
3. Click "Connect Google Calendar" button
4. Browser redirects to Google OAuth consent screen
5. Grant permissions
6. Browser redirects back to callback page
7. Success message displays
8. After 3 seconds, redirects to dashboard
9. Calendar shows as connected with green checkmark
10. Click "✓ Connected - Open Assistant"
11. Chat interface loads and shows "Connected Successfully"

### 4. Common Issues

**Issue**: "Authentication required" error
**Solution**: Make sure you're signed in to the application first

**Issue**: "redirect_uri_mismatch" error
**Solution**: Update redirect URI in Google Cloud Console to match exactly:
```
http://localhost:3000/api/auth/calendar/callback
```

**Issue**: OAuth callback shows error
**Solution**: Check browser console and backend logs for details

**Issue**: Dashboard shows "Not Connected" after OAuth
**Solution**: Click the refresh button or reload the page

**Issue**: Chat page shows "Connection Required"
**Solution**: 
- Check if tokens were saved in database
- Check Calendar status endpoint: `http://localhost:3000/api/auth/calendar/status`
- Verify JWT token is valid

## Security Notes

1. **State Parameter**: Contains user_id to link OAuth callback to correct user
2. **JWT Authentication**: All API endpoints require valid JWT token
3. **Row Level Security**: Database policies ensure users can only access their own tokens
4. **Token Refresh**: Access tokens are automatically refreshed when expired
5. **HTTPS Required**: In production, all URLs must use HTTPS

## Comparison with Forms Flow

The Calendar OAuth flow is **identical** to the Forms OAuth flow:

| Component | Forms | Calendar |
|-----------|-------|----------|
| Button Handler | `handleFormsConnect` | `handleCalendarConnect` |
| OAuth Route | `/api/auth/forms/connect` | `/api/auth/calendar/connect` |
| Callback Route | `/api/auth/forms/callback` | `/api/auth/calendar/callback` |
| Frontend Callback | `/auth/forms/callback` | `/auth/calendar/callback` |
| Chat Page | `/forms` | `/calendar` |
| Database Table | `forms_tokens` | `calendar_tokens` |
| Status Check | `checkFormsStatus()` | `checkCalendarStatus()` |

This consistency makes it easy to understand and maintain both integrations.
