# Google Calendar Agent Architecture

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Calendar   │  │  Chat with   │  │   Calendar   │          │
│  │  Connection  │  │  AI Agent    │  │  Dashboard   │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
└─────────┼──────────────────┼──────────────────┼─────────────────┘
          │                  │                  │
          │ HTTP Requests    │                  │
          │ (Bearer Token)   │                  │
          │                  │                  │
┌─────────▼──────────────────▼──────────────────▼─────────────────┐
│                      Backend (Express.js)                         │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              Authentication Middleware                      │ │
│  │                (authenticateToken)                          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌───────────────────┐  ┌───────────────────┐                  │
│  │  calendarAuth.js  │  │ calendarData.js   │                  │
│  │  (OAuth Routes)   │  │ (Direct API)      │                  │
│  └─────────┬─────────┘  └─────────┬─────────┘                  │
│            │                       │                             │
│  ┌─────────▼───────────────────────▼─────────┐                 │
│  │     calendarAgentController.js             │                 │
│  │        (AI Agent Endpoints)                 │                 │
│  └─────────────────┬───────────────────────────┘                │
│                    │                                             │
│         ┌──────────▼──────────┐                                 │
│         │  calendarAgent.js   │                                 │
│         │   (AI Logic + OpenAI)│                                 │
│         └──────────┬───────────┘                                │
│                    │                                             │
│         ┌──────────▼──────────┐                                 │
│         │ calendarService.js  │                                 │
│         │ (Calendar API Layer)│                                 │
│         └──────────┬───────────┘                                │
└────────────────────┼──────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
┌───────▼──────┐ ┌──▼───────┐ ┌─▼────────────┐
│   Supabase   │ │  Google  │ │    OpenAI    │
│  (calendar_  │ │ Calendar │ │   GPT-4      │
│   tokens)    │ │   API    │ │              │
└──────────────┘ └──────────┘ └──────────────┘
```

## Request Flow

### 1. OAuth Authentication Flow

```
User → Frontend → Backend → Google OAuth
                              ↓
                         Consent Screen
                              ↓
                    User Authorizes
                              ↓
Backend ← Callback with code ← Google
   ↓
Exchange code for tokens
   ↓
Store in Supabase (calendar_tokens)
   ↓
Redirect to Frontend with success
```

### 2. AI Agent Query Flow

```
User: "Schedule a meeting tomorrow at 2pm"
  ↓
Frontend → POST /api/calendar/agent/query
  ↓
calendarAgentController.js
  ↓
calendarAgent.js (OpenAI)
  ↓
AI decides to use: createEvent tool
  ↓
calendarService.js → createEvent()
  ↓
Get tokens from Supabase
  ↓
Call Google Calendar API
  ↓
Event created
  ↓
Return to AI Agent
  ↓
AI formats response
  ↓
Frontend ← "I've scheduled your meeting..."
```

### 3. Direct API Flow

```
Frontend → POST /api/calendar/events
  ↓
Authenticate user
  ↓
calendarData.js
  ↓
calendarService.js
  ↓
Get tokens from Supabase
  ↓
Google Calendar API
  ↓
Return response
  ↓
Frontend
```

## Component Responsibilities

### calendarAuth.js
- OAuth URL generation
- OAuth callback handling
- Token storage/retrieval
- Connection status
- Disconnect/refresh

### calendarService.js
- Google Calendar API wrapper
- Token management
- Auto token refresh
- 10 Calendar operations
- Error handling

### calendarAgent.js
- OpenAI integration
- Tool definitions (10 tools)
- Natural language processing
- Multi-turn conversations
- Function execution

### calendarAgentController.js
- HTTP endpoints for AI agent
- Request validation
- Response formatting
- Conversation history handling

### calendarData.js
- RESTful API endpoints
- Direct Calendar operations
- No AI processing
- Traditional CRUD

## Data Flow

```
┌──────────────┐
│     User     │
└──────┬───────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│   Backend    │
└──────────────┘     └──────┬───────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
              ▼             ▼             ▼
       ┌──────────┐  ┌──────────┐  ┌──────────┐
       │ Supabase │  │  Google  │  │  OpenAI  │
       │          │  │ Calendar │  │          │
       │ calendar_│  │   API    │  │  GPT-4   │
       │  tokens  │  │          │  │          │
       └──────────┘  └──────────┘  └──────────┘
```

## Database Schema

```sql
calendar_tokens
├── id (UUID, PK)
├── user_id (UUID, FK → auth.users)
├── access_token (TEXT)
├── refresh_token (TEXT)
├── token_type (TEXT)
├── expiry_date (BIGINT)
├── scope (TEXT)
├── email (TEXT)
├── name (TEXT)
├── picture (TEXT)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)

Indexes:
- idx_calendar_tokens_user_id
- idx_calendar_tokens_email

RLS Policies:
- Users can only access their own tokens
```

## Tool Architecture

```
CalendarAgent
├── createEvent
├── getEvents
├── updateEvent
├── deleteEvent
├── getCalendars
├── getCalendar
├── createCalendar
├── updateCalendar
├── deleteCalendar
└── respondToEvent

Each tool:
1. Defined in defineTools()
2. Mapped in createFunctionMap()
3. Calls calendarService function
4. Returns structured result
```

## Error Handling Flow

```
Error occurs
  ↓
Caught in service layer
  ↓
Formatted error object
  ↓
Returned to agent/controller
  ↓
Agent formats user-friendly message
  ↓
Returned to frontend
  ↓
Displayed to user
```

## Security Layers

```
1. Authentication
   - Bearer token required
   - JWT validation

2. Row Level Security
   - Users can only access own tokens
   - Enforced at database level

3. OAuth Scopes
   - Limited to required permissions
   - User consent required

4. Token Encryption
   - Stored securely in Supabase
   - Auto-refresh mechanism
```

## Integration Points

```
┌─────────────┐
│   Calendar  │
└──────┬──────┘
       │
   ┌───┴────┐
   │        │
   ▼        ▼
┌──────┐ ┌──────┐
│Forms │ │Gmail │
└──────┘ └──────┘

Shared:
- Auth system
- User database
- Token pattern
- Agent architecture
```

## Deployment Architecture

```
Development:
localhost:3000 (Backend)
localhost:3001 (Frontend)

Production:
backend.example.com
frontend.example.com

Both need:
- Environment variables
- Database access
- API keys
- OAuth configuration
```

## Scalability Considerations

```
Horizontal Scaling:
- Stateless API
- Token-based auth
- Database connection pooling

Vertical Scaling:
- OpenAI rate limits
- Google API quotas
- Database queries

Caching:
- Token caching
- Event caching
- Calendar list caching
```

## Monitoring Points

```
1. OAuth Success Rate
2. Token Refresh Rate
3. API Error Rate
4. Agent Query Success
5. Tool Usage Statistics
6. Response Times
7. User Activity
```

This architecture diagram shows the complete system flow and how all components interact!
