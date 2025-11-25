# Google Meet Integration

Complete implementation of Google Meet integration with AI agent capabilities.

## 📁 Files Created

### Backend (FYP/)
- `meet/meetAuth.js` - OAuth authentication handling
- `meet/meetService.js` - Core Google Meet API interactions
- `meet/meetData.js` - REST API endpoints
- `meet/meetAgent.js` - AI agent with OpenAI integration
- `meet/meetAgentController.js` - Agent HTTP controller
- `meet/create_meet_tokens_table.sql` - Database schema
- `meet/disable_meet_rls.sql` - RLS configuration

### Frontend (frontend/)
- `app/meet/page.tsx` - React UI component
- `lib/meet.ts` - API client functions

### Configuration
- Updated `FYP/index.js` to register Meet routes
- Environment variables already configured in `.env`

## 🔧 Setup Instructions

### 1. Database Setup

Run the SQL scripts in Supabase:

```sql
-- Create the meet_tokens table
-- Run: meet/create_meet_tokens_table.sql

-- Disable RLS
-- Run: meet/disable_meet_rls.sql
```

### 2. Environment Variables

Already configured in `.env`:
```env
GOOGLE_MEET_CLIENT_ID=762252885981-593fehku5q0rmq355i77ikjll4l9rap9.apps.googleusercontent.com
GOOGLE_MEET_CLIENT_SECRET=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
GOOGLE_MEET_REDIRECT_URI=http://localhost:3000/api/auth/meet/callback
```

### 3. Google Cloud Console

Ensure these scopes are enabled in your OAuth consent screen:
- `https://www.googleapis.com/auth/meetings.space.created`
- `https://www.googleapis.com/auth/drive.readonly`
- `https://www.googleapis.com/auth/userinfo.email`
- `https://www.googleapis.com/auth/userinfo.profile`
- `openid`

### 4. Start the Application

```bash
# Backend
cd FYP
npm start

# Frontend (in another terminal)
cd frontend
npm run dev
```

## 🎯 Features

### API Endpoints

#### Authentication
- `GET /api/auth/meet/connect` - Initiate OAuth flow
- `GET /api/auth/meet/url` - Get OAuth URL
- `GET /api/auth/meet/callback` - OAuth callback handler
- `GET /api/auth/meet/status` - Check connection status
- `POST /api/auth/meet/disconnect` - Disconnect account

#### Meeting Management
- `POST /api/meet/create` - Create new meeting space
- `GET /api/meet/space/:spaceName` - Get meeting space details
- `GET /api/meet/space/:spaceName/conferences` - List conferences
- `GET /api/meet/conference/:conferenceName` - Get conference details
- `GET /api/meet/conference/:conferenceName/recordings` - List recordings
- `GET /api/meet/recording/:recordingName` - Get recording details

#### AI Agent
- `POST /api/meet/agent/query` - Send natural language query
- `GET /api/meet/agent/examples` - Get example queries
- `GET /api/meet/agent/capabilities` - Get agent capabilities

### Available Tools (Agent Functions)

1. **createMeetingSpace** - Create instant meeting links
2. **getMeetingSpace** - Get meeting space details
3. **listConferences** - View meeting history
4. **getConference** - Get specific meeting info
5. **listRecordings** - Access meeting recordings
6. **getRecording** - Get recording details
7. **listParticipants** - Track meeting participants

## 💬 Example Queries

### Creating Meetings
- "Create a new meeting"
- "Generate a meeting link"
- "Start a new Google Meet"

### Meeting History
- "Show me past meetings in space [SPACE_ID]"
- "List conference history"
- "What meetings happened in this space?"

### Recordings
- "List recordings for conference [CONFERENCE_ID]"
- "Show me meeting recordings"
- "Get recording details"

### Participants
- "Who attended conference [CONFERENCE_ID]?"
- "Show me who joined the meeting"
- "List participants from the last meeting"

## 🔒 Security

- All endpoints require authentication via JWT tokens
- OAuth tokens stored securely in Supabase
- Automatic token refresh handling
- RLS disabled to match other service patterns

## 📊 Database Schema

```sql
CREATE TABLE meet_tokens (
  id bigint PRIMARY KEY,
  email text UNIQUE NOT NULL,
  access_token text,
  refresh_token text,
  expiry_date bigint,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

## 🎨 Frontend Features

- Beautiful gradient UI matching the app theme
- Real-time chat interface with AI assistant
- Instant meeting link generation with copy button
- One-click join meeting functionality
- Conversation history support
- Loading states and error handling
- Responsive design for all screen sizes

## 🚀 Usage Flow

1. User navigates to `/meet`
2. If not connected, displays connection screen
3. User clicks "Connect Google Meet"
4. OAuth flow completes, redirects back
5. Chat interface loads
6. User can ask natural language questions
7. AI agent processes queries and executes Meet API functions
8. Results displayed in chat format

## 🔄 Architecture

```
Frontend (Next.js)
    ↓
lib/meet.ts (API Client)
    ↓
Backend Express Server
    ↓
meetAgentController.js → meetAgent.js (OpenAI)
    ↓
meetService.js (Google Meet API)
    ↓
Supabase (Token Storage)
```

## 🛠️ Troubleshooting

### "User tokens not found"
- User needs to connect their Google Meet account first
- Check if tokens exist in `meet_tokens` table

### OAuth errors
- Verify redirect URI matches exactly in Google Cloud Console
- Ensure all required scopes are enabled
- Check client ID and secret are correct

### "Failed to create meeting"
- Verify scopes include `meetings.space.created`
- Check token hasn't expired
- Review Google Cloud Console quota limits

## 📝 Notes

- Meeting spaces persist and can be reused
- Recordings require `drive.readonly` scope
- Conference records contain historical data
- Participant info includes join/leave timestamps
- All times are in ISO 8601 format

## ✅ Testing

1. Connect Google Meet account
2. Create a new meeting: "Create a meeting"
3. Copy and test the meeting link
4. Try other queries from examples
5. Test error handling with invalid requests

## 🎯 Similar to Google Forms Pattern

This implementation follows the exact same architecture as the Google Forms integration:
- Same OAuth flow structure
- Same agent architecture with OpenAI
- Same database token storage pattern
- Same frontend UI patterns
- Same error handling approaches
- Same endpoint naming conventions
