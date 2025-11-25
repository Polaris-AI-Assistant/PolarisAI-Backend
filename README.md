# FYP Gmail Integration API

A Node.js Express API for integrating Gmail with user authentication using Supabase.

## Features

- 🔐 User authentication with Supabase (signup, signin, password reset)
- 📧 Gmail OAuth integration
- 📨 Gmail message fetching and storage
- 🔍 Gmail message search functionality
- 📊 Gmail statistics and analytics
- 🛡️ JWT token-based authentication
- 🔄 Automatic token refresh handling

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Gmail API**: Google APIs
- **Environment**: dotenv

## Setup

### Prerequisites

- Node.js (v14 or higher)
- Supabase account
- Google Cloud Console account (for Gmail API)

### Installation

1. Clone the repository and install dependencies:
```bash
npm install
```

2. Set up environment variables:
Create a `.env` file with the following variables:

```env
# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_API_KEY=your_supabase_anon_key

# Gmail OAuth Configuration
GMAIL_CLIENT_ID=your_gmail_client_id
GMAIL_CLIENT_SECRET=your_gmail_client_secret
GMAIL_REDIRECT_URI=http://localhost:3000/api/auth/gmail/callback

# App Configuration
PORT=3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

3. Set up Supabase database:
Run the SQL schema from `supabase/db.sql` in your Supabase SQL editor.

4. Configure Google OAuth:
- Go to [Google Cloud Console](https://console.cloud.google.com)
- Create a new project or select existing
- Enable Gmail API
- Create OAuth 2.0 credentials
- Add authorized redirect URI: `http://localhost:3000/api/auth/gmail/callback`

### Running the Application

```bash
# Development mode with nodemon
npm start

# Or directly with node
node index.js
```

The API will be available at `http://localhost:3000`

### Testing

Run the comprehensive test suite:
```bash
npm test
```

This will test all API endpoints and provide a detailed report.

## API Documentation

### Base URL
```
http://localhost:3000
```

### Authentication Endpoints

#### Sign Up
```http
POST /api/auth/signup
```
```json
{
  "email": "user@example.com",
  "password": "StrongPassword123",
  "firstName": "John",
  "lastName": "Doe"
}
```

#### Sign In
```http
POST /api/auth/signin
```
```json
{
  "email": "user@example.com",
  "password": "StrongPassword123"
}
```

#### Get Current User
```http
GET /api/auth/user
Authorization: Bearer your_jwt_token
```

#### Sign Out
```http
POST /api/auth/signout
```

#### Reset Password
```http
POST /api/auth/reset-password
```
```json
{
  "email": "user@example.com"
}
```

### Gmail Integration Endpoints

#### Start Gmail OAuth Flow
```http
GET /api/auth/gmail
```
Redirects to Google OAuth consent screen.

#### Get Gmail OAuth URL
```http
GET /api/auth/gmail/url
```
Returns the OAuth URL for frontend applications.

#### OAuth Callback (handled automatically)
```http
GET /api/auth/gmail/callback?code=oauth_code
```

#### Check Gmail Connection Status
```http
GET /api/gmail/connection/:userIdentifier
```

#### Fetch and Store Gmail Messages
```http
GET /api/gmail/:userIdentifier
```

#### Get Stored Gmail Messages
```http
GET /api/gmail/:userIdentifier/messages?limit=20&offset=0
```

#### Search Gmail Messages
```http
GET /api/gmail/:userIdentifier/search?query=search_term&sender=sender_email&subject=subject_text
```

#### Get Gmail Statistics
```http
GET /api/gmail/:userIdentifier/stats
```

### Utility Endpoints

#### Health Check
```http
GET /health
```

#### API Documentation
```http
GET /api
```

#### Database Test
```http
GET /test-db
```

## User Identifier

Most Gmail endpoints accept `userIdentifier` which can be either:
- User email address: `user@example.com`
- User UUID: `123e4567-e89b-12d3-a456-426614174000`

## Database Schema

### gmail_tokens
- `id`: Primary key
- `email`: User email (unique)
- `access_token`: Gmail access token
- `refresh_token`: Gmail refresh token
- `expiry_date`: Token expiration timestamp
- `user_id`: Reference to Supabase auth user
- `created_at`, `updated_at`: Timestamps

### gmail_messages
- `id`: Gmail message ID (primary key)
- `thread_id`: Gmail thread ID
- `user_id`: Reference to Supabase auth user
- `user_email`: User email for easier querying
- `snippet`: Message preview
- `subject`: Email subject
- `sender`: Sender email
- `recipients`: Recipient emails
- `body`: Full message body
- `date`: Message date
- `labels`: Gmail labels array
- `created_at`, `updated_at`: Timestamps

## Error Handling

The API returns consistent error responses:

```json
{
  "error": "Error message",
  "details": "Additional details (in development mode)"
}
```

Common HTTP status codes:
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `404`: Not Found
- `500`: Internal Server Error

## Security Features

- ✅ Input validation and sanitization
- ✅ JWT token authentication
- ✅ Password strength requirements
- ✅ Email format validation
- ✅ CORS headers configured
- ✅ Environment variable protection
- ✅ Error message sanitization in production

## Development

### Project Structure
```
FYP/
├── auth/              # Authentication routes
│   └── auth.js
├── gmail/             # Gmail integration
│   ├── agentConnect.js    # OAuth flow
│   ├── gmailData.js       # Data routes
│   └── gmailService.js    # Gmail API service
├── middleware/        # Custom middleware
│   └── auth.js
├── supabase/         # Database
│   ├── db.sql
│   └── supabaseConnect.js
├── utils/            # Utilities
│   └── validation.js
├── index.js          # Main application
├── test-api.js       # Test suite
└── package.json
```

### Adding New Features

1. Create new route files in appropriate folders
2. Add validation in `utils/validation.js`
3. Update database schema in `supabase/db.sql`
4. Add tests in `test-api.js`
5. Update this README

## Troubleshooting

### Common Issues

1. **Gmail OAuth not working**
   - Check if Gmail API is enabled in Google Cloud Console
   - Verify redirect URI matches exactly
   - Ensure client ID and secret are correct

2. **Database connection issues**
   - Verify Supabase URL and API key
   - Check if tables exist (run db.sql schema)
   - Ensure network connectivity

3. **Token expiration**
   - The API automatically handles token refresh
   - If refresh fails, user needs to re-authenticate

4. **CORS errors**
   - CORS is configured for all origins in development
   - For production, update CORS configuration

### Debug Mode

Set `NODE_ENV=development` for detailed error messages and debugging information.

## License

This project is part of a Final Year Project (FYP) and is for educational purposes.

## Support

For issues and questions, check the console logs and ensure all environment variables are correctly configured.
