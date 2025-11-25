# Google Meet Architecture Overview

## 📊 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                             │
│                     http://localhost:3001                        │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  app/meet/page.tsx                                       │   │
│  │  - Chat Interface                                        │   │
│  │  - OAuth Connection Flow                                 │   │
│  │  - Meeting Link Display                                  │   │
│  │  - Message History                                       │   │
│  └──────────────────────┬───────────────────────────────────┘   │
│                         │                                        │
│  ┌──────────────────────▼───────────────────────────────────┐   │
│  │  lib/meet.ts                                             │   │
│  │  - API Client Functions                                  │   │
│  │  - TypeScript Types                                      │   │
│  │  - Auth Token Management                                 │   │
│  └──────────────────────┬───────────────────────────────────┘   │
└─────────────────────────┼───────────────────────────────────────┘
                          │
                          │ HTTP/REST API
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (Express.js)                          │
│                     http://localhost:3000                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  index.js (Main Router)                                  │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │ app.use('/api', meetAuthRoutes)                    │  │   │
│  │  │ app.use('/api', meetDataRoutes)                    │  │   │
│  │  │ app.use('/api/meet', meetAgentRoutes)              │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  └──────────────────────┬───────────────────────────────────┘   │
│                         │                                        │
│  ┌──────────────────────▼───────────────────────────────────┐   │
│  │  meet/meetAuth.js                                        │   │
│  │  - OAuth Flow                                            │   │
│  │  - Token Management                                      │   │
│  │  ┌────────────────────────────────────────────────────┐ │   │
│  │  │ GET  /auth/meet/url                                │ │   │
│  │  │ GET  /auth/meet/callback                           │ │   │
│  │  │ GET  /auth/meet/status                             │ │   │
│  │  │ POST /auth/meet/disconnect                         │ │   │
│  │  └────────────────────────────────────────────────────┘ │   │
│  └──────────────────────┬───────────────────────────────────┘   │
│                         │                                        │
│  ┌──────────────────────▼───────────────────────────────────┐   │
│  │  meet/meetData.js                                        │   │
│  │  - REST API Endpoints                                    │   │
│  │  ┌────────────────────────────────────────────────────┐ │   │
│  │  │ POST /meet/create                                  │ │   │
│  │  │ GET  /meet/space/:spaceName                        │ │   │
│  │  │ GET  /meet/space/:spaceName/conferences            │ │   │
│  │  │ GET  /meet/conference/:conferenceName              │ │   │
│  │  │ GET  /meet/conference/:conferenceName/recordings   │ │   │
│  │  └────────────────────────────────────────────────────┘ │   │
│  └──────────────────────┬───────────────────────────────────┘   │
│                         │                                        │
│  ┌──────────────────────▼───────────────────────────────────┐   │
│  │  meet/meetAgentController.js                             │   │
│  │  - Agent HTTP Interface                                  │   │
│  │  ┌────────────────────────────────────────────────────┐ │   │
│  │  │ POST /meet/agent/query                             │ │   │
│  │  │ GET  /meet/agent/examples                          │ │   │
│  │  │ GET  /meet/agent/capabilities                      │ │   │
│  │  └────────────────────┬───────────────────────────────┘ │   │
│  └────────────────────────┼───────────────────────────────────┘ │
│                           │                                      │
│  ┌────────────────────────▼───────────────────────────────────┐ │
│  │  meet/meetAgent.js (AI Agent)                              │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │ OpenAI GPT-4                                         │ │ │
│  │  │ - Natural Language Understanding                     │ │ │
│  │  │ - Function Calling                                   │ │ │
│  │  │ - Response Generation                                │ │ │
│  │  └──────────────────────┬───────────────────────────────┘ │ │
│  │                         │                                  │ │
│  │  ┌──────────────────────▼───────────────────────────────┐ │ │
│  │  │ Available Tools:                                     │ │ │
│  │  │ 1. createMeetingSpace()                              │ │ │
│  │  │ 2. getMeetingSpace()                                 │ │ │
│  │  │ 3. listConferences()                                 │ │ │
│  │  │ 4. getConference()                                   │ │ │
│  │  │ 5. listRecordings()                                  │ │ │
│  │  │ 6. getRecording()                                    │ │ │
│  │  │ 7. listParticipants()                                │ │ │
│  │  └──────────────────────┬───────────────────────────────┘ │ │
│  └────────────────────────┼───────────────────────────────────┘ │
│                           │                                      │
│  ┌────────────────────────▼───────────────────────────────────┐ │
│  │  meet/meetService.js                                       │ │
│  │  - Google Meet API Client                                  │ │
│  │  - OAuth2 Client Management                                │ │
│  │  - Token Refresh Logic                                     │ │
│  └────────────────────────┬───────────────────────────────────┘ │
└─────────────────────────┼─────────────────────────────────────┘
                          │
                          │ Google APIs
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GOOGLE SERVICES                               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Google Meet API (v2)                                    │   │
│  │  - spaces.create()                                       │   │
│  │  - spaces.get()                                          │   │
│  │  - conferenceRecords.list()                              │   │
│  │  - conferenceRecords.get()                               │   │
│  │  - recordings.list()                                     │   │
│  │  - recordings.get()                                      │   │
│  │  - participants.list()                                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Google OAuth 2.0                                        │   │
│  │  - Authentication                                        │   │
│  │  - Token Generation                                      │   │
│  │  - Token Refresh                                         │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE (Supabase)                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Table: meet_tokens                                      │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │ id              bigint PRIMARY KEY                 │  │   │
│  │  │ email           text UNIQUE NOT NULL               │  │   │
│  │  │ access_token    text                               │  │   │
│  │  │ refresh_token   text                               │  │   │
│  │  │ expiry_date     bigint                             │  │   │
│  │  │ user_id         uuid REFERENCES auth.users(id)     │  │   │
│  │  │ created_at      timestamptz                        │  │   │
│  │  │ updated_at      timestamptz                        │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

## 🔄 Data Flow Examples

### Example 1: Creating a Meeting

1. User types: "Create a new meeting"
2. Frontend → POST /api/meet/agent/query
3. meetAgentController → meetAgent.processQuery()
4. OpenAI analyzes query → decides to call createMeetingSpace()
5. meetAgent → meetService.createMeetingSpace(userId)
6. meetService gets tokens from Supabase
7. meetService → Google Meet API spaces.create()
8. Google returns meeting link
9. Response flows back through chain
10. Frontend displays meeting link with buttons

### Example 2: OAuth Connection

1. User clicks "Connect Google Meet"
2. Frontend → GET /api/auth/meet/url
3. Backend generates OAuth URL with state
4. User redirected to Google
5. User approves permissions
6. Google → GET /api/auth/meet/callback?code=...
7. Backend exchanges code for tokens
8. Tokens saved to meet_tokens table
9. User redirected to /meet?connected=true
10. Frontend shows connected status

## 🔐 Security Flow

```
User Authentication
     ↓
JWT Token (lib/auth.ts)
     ↓
authenticateToken middleware
     ↓
userId extracted from JWT
     ↓
OAuth tokens fetched from DB
     ↓
Google API called with OAuth token
     ↓
Automatic token refresh if expired
     ↓
Response returned to user
```

## 📊 File Organization

```
FYP/
└── meet/
    ├── meetAuth.js              (OAuth routes)
    ├── meetService.js           (API logic)
    ├── meetData.js              (REST endpoints)
    ├── meetAgent.js             (AI agent)
    ├── meetAgentController.js   (Agent routes)
    ├── create_meet_tokens_table.sql
    ├── disable_meet_rls.sql
    ├── README.md
    ├── IMPLEMENTATION_SUMMARY.md
    ├── SETUP_CHECKLIST.md
    └── ARCHITECTURE.md          (this file)

frontend/
├── app/
│   └── meet/
│       └── page.tsx             (UI component)
└── lib/
    └── meet.ts                  (API client)
```

## 🎯 Integration Points

### With Existing Services
- Uses same auth pattern as Forms, Calendar, Docs
- Uses same Supabase connection
- Uses same JWT authentication
- Uses same OpenAI integration

### With External Services
- Google Meet API v2
- Google OAuth 2.0
- OpenAI GPT-4
- Supabase PostgreSQL

## 🔧 Configuration

Environment Variables Required:
- `GOOGLE_MEET_CLIENT_ID` ✅
- `GOOGLE_MEET_CLIENT_SECRET` ✅
- `GOOGLE_MEET_REDIRECT_URI` ✅
- `OPENAI_API_KEY` ✅
- `SUPABASE_URL` ✅
- `SUPABASE_API_KEY` ✅

## 🚀 Deployment Considerations

### Backend
- Port 3000 must be accessible
- Environment variables must be set
- Node.js with Express
- PostgreSQL connection required

### Frontend
- Port 3001 for development
- NEXT_PUBLIC_API_URL must point to backend
- Next.js with React
- Static files served

### Database
- Supabase hosted PostgreSQL
- meet_tokens table must exist
- RLS must be disabled
- Foreign key to auth.users

## 📈 Scalability

- Stateless backend (scales horizontally)
- Database-backed authentication
- Token management in DB
- API rate limits from Google
- OpenAI rate limits apply

## 🎉 Complete!

This architecture provides a complete, production-ready Google Meet integration following industry best practices and matching the existing codebase patterns.
