# Chat History System - Backend Implementation

## Overview

The chat history system stores all Main Agent conversations in Supabase database with a clean separation between frontend and backend. All database operations are handled by backend APIs.

## Architecture

```
Frontend (Next.js)
    ↓ HTTP Requests
Backend API (Express.js)
    ↓ Supabase Client
Database (PostgreSQL/Supabase)
```

## Database Schema

### Tables Created

1. **chat_sessions**
   - `id` (UUID, Primary Key)
   - `user_id` (UUID, Foreign Key to auth.users)
   - `title` (TEXT)
   - `created_at` (TIMESTAMPTZ)
   - `updated_at` (TIMESTAMPTZ)
   - `message_count` (INTEGER)

2. **chat_messages**
   - `id` (UUID, Primary Key)
   - `chat_session_id` (UUID, Foreign Key to chat_sessions)
   - `role` (TEXT: 'user' or 'assistant')
   - `content` (TEXT)
   - `agents_used` (TEXT[])
   - `processing_time` (TEXT)
   - `is_error` (BOOLEAN)
   - `created_at` (TIMESTAMPTZ)

### Features
- **Row Level Security (RLS)** enabled on both tables
- **Cascade delete** - deleting a session deletes all its messages
- **Auto-update triggers** for timestamps and message counts
- **Indexes** for optimized queries

## Backend Files

### 1. `/FYP/chat/chatData.js`
Data layer for Supabase operations:
- `getAllChatSessions(userId)` - Get all sessions for a user
- `getChatSession(chatId, userId)` - Get specific session
- `createChatSession(userId)` - Create new session
- `addMessagesToSession(chatId, userId, messages)` - Add messages
- `deleteChatSession(chatId, userId)` - Delete session
- `renameChatSession(chatId, userId, newTitle)` - Rename session
- `clearAllChatSessions(userId)` - Clear all sessions

### 2. `/FYP/chat/chatController.js`
Express router with API endpoints:
- `GET /api/chat/sessions` - Get all sessions
- `GET /api/chat/sessions/:chatId` - Get specific session
- `POST /api/chat/sessions` - Create new session
- `PUT /api/chat/sessions/:chatId/messages` - Add messages
- `DELETE /api/chat/sessions/:chatId` - Delete session
- `PUT /api/chat/sessions/:chatId/rename` - Rename session
- `DELETE /api/chat/sessions` - Clear all sessions

### 3. `/FYP/index.js`
Updated to include chat routes:
```javascript
const chatRoutes = require('./chat/chatController');
app.use('/api/chat', chatRoutes);
```

## Frontend Files

### `/frontend/lib/chatHistory.ts`
Frontend API client:
- All functions make HTTP requests to backend
- No direct database access
- Returns TypeScript-typed data
- Handles date conversion and error handling

### `/frontend/app/agent/page.tsx`
Updated to use async/await for all chat operations:
- Async initialization
- Async chat loading
- Async chat creation/update/delete

## API Endpoints

### Authentication
All endpoints require:
- `Authorization` header with Bearer token
- `x-user-id` header with user ID

### GET /api/chat/sessions
Get all chat sessions for the current user.

**Response:**
```json
{
  "success": true,
  "sessions": [
    {
      "id": "uuid",
      "title": "Chat title",
      "createdAt": "2025-10-31T...",
      "updatedAt": "2025-10-31T...",
      "messageCount": 5,
      "messages": [...]
    }
  ]
}
```

### GET /api/chat/sessions/:chatId
Get a specific chat session.

**Response:**
```json
{
  "success": true,
  "session": {
    "id": "uuid",
    "title": "Chat title",
    "createdAt": "2025-10-31T...",
    "updatedAt": "2025-10-31T...",
    "messageCount": 5,
    "messages": [
      {
        "id": "msg_uuid",
        "role": "user",
        "content": "Hello",
        "timestamp": "2025-10-31T...",
        "agentsUsed": [],
        "processingTime": "1.5s",
        "isError": false
      }
    ]
  }
}
```

### POST /api/chat/sessions
Create a new chat session.

**Response:**
```json
{
  "success": true,
  "session": {
    "id": "uuid",
    "title": "New Chat",
    "createdAt": "2025-10-31T...",
    "updatedAt": "2025-10-31T...",
    "messageCount": 0,
    "messages": []
  }
}
```

### PUT /api/chat/sessions/:chatId/messages
Add messages to a chat session.

**Request Body:**
```json
{
  "messages": [
    {
      "id": "msg_uuid",
      "role": "user",
      "content": "Hello",
      "timestamp": "2025-10-31T...",
      "agentsUsed": [],
      "processingTime": null,
      "isError": false
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "session": { /* updated session */ }
}
```

### PUT /api/chat/sessions/:chatId/rename
Rename a chat session.

**Request Body:**
```json
{
  "title": "New Title"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Chat session renamed successfully"
}
```

### DELETE /api/chat/sessions/:chatId
Delete a chat session.

**Response:**
```json
{
  "success": true,
  "message": "Chat session deleted successfully"
}
```

### DELETE /api/chat/sessions
Clear all chat sessions.

**Response:**
```json
{
  "success": true,
  "message": "All chat sessions cleared successfully"
}
```

## Setup Instructions

### 1. Database Setup
Run the SQL script to create tables:
```bash
# In Supabase SQL Editor or via psql
psql -U postgres -d your_database -f create_chat_history_table.sql
```

### 2. Backend Setup
No additional setup needed. The routes are automatically loaded in `index.js`.

### 3. Frontend Setup
The frontend automatically uses the API endpoints defined in `chatHistory.ts`.

### 4. Environment Variables
Ensure these are set:
- Backend: `SUPABASE_API_KEY`
- Frontend: `NEXT_PUBLIC_API_URL` (default: http://localhost:3000)

## Security

### Row Level Security (RLS)
- Users can only access their own chat sessions
- All operations verify user_id matches authenticated user
- Cascade deletes ensure data consistency

### Authentication
- All endpoints require valid auth token
- User ID is verified on every request
- Supabase RLS provides additional security layer

## Testing

### Test Chat Creation
```bash
curl -X POST http://localhost:3000/api/chat/sessions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-user-id: USER_ID" \
  -H "Content-Type: application/json"
```

### Test Getting Sessions
```bash
curl -X GET http://localhost:3000/api/chat/sessions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-user-id: USER_ID"
```

### Test Adding Messages
```bash
curl -X PUT http://localhost:3000/api/chat/sessions/CHAT_ID/messages \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-user-id: USER_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "id": "msg_123",
        "role": "user",
        "content": "Hello",
        "timestamp": "2025-10-31T12:00:00Z",
        "agentsUsed": [],
        "isError": false
      }
    ]
  }'
```

## Migration

The system automatically migrates old localStorage data to the database:
- Checks for `mainAgent_conversation` in localStorage
- Creates a new session in the database
- Imports all old messages
- Removes old localStorage data

## Performance Considerations

1. **Indexes** are created on frequently queried columns
2. **Cascade deletes** reduce manual cleanup operations
3. **Message count** is cached in chat_sessions table
4. **Timestamps** are automatically managed by triggers
5. **RLS policies** are optimized for user-based queries

## Troubleshooting

### "Authentication required" error
- Ensure `x-user-id` header is being sent
- Verify auth token is valid
- Check user exists in auth.users table

### Messages not appearing
- Check that chatId matches an existing session
- Verify user_id matches the session owner
- Check browser console for API errors

### Slow query performance
- Verify indexes are created properly
- Check RLS policies are not causing full table scans
- Monitor Supabase dashboard for slow queries

## Future Enhancements

- [ ] Full-text search across chat messages
- [ ] Export chats as JSON/PDF
- [ ] Share chats with other users
- [ ] Chat templates and favorites
- [ ] Advanced filtering and sorting
- [ ] Real-time sync with WebSockets
- [ ] Cloud backup and restore
