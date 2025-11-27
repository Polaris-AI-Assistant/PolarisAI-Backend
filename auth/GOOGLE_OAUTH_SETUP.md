# Google OAuth Authentication Setup

## Overview
This document describes the Google OAuth authentication implementation for sign-in and sign-up functionality using Supabase Auth.

## Architecture

### Flow Diagram
```
User clicks "Continue with Google"
    ↓
Frontend calls: GET /api/auth/google
    ↓
Backend calls Supabase signInWithOAuth()
    ↓
Returns Google OAuth URL
    ↓
User redirected to Google consent screen
    ↓
User approves and Google redirects to: /auth/callback?code=...
    ↓
Frontend calls: GET /api/auth/callback?code=...
    ↓
Backend exchanges code for session
    ↓
Frontend stores tokens and redirects to /dashboard
```

## Backend Implementation

### API Endpoints

#### 1. Initiate Google OAuth
**Endpoint:** `GET /api/auth/google`

**Description:** Initiates the Google OAuth flow and returns the authorization URL.

**Response:**
```json
{
  "url": "https://accounts.google.com/o/oauth2/v2/auth?...",
  "provider": "google"
}
```

**Error Response:**
```json
{
  "error": "Error message"
}
```

#### 2. Handle OAuth Callback
**Endpoint:** `GET /api/auth/callback`

**Query Parameters:**
- `code`: Authorization code from Google

**Description:** Exchanges the authorization code for a Supabase session.

**Response:**
```json
{
  "message": "Authentication successful",
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "user_metadata": { ... }
  },
  "session": {
    "access_token": "...",
    "refresh_token": "...",
    "expires_at": 1234567890
  }
}
```

## Frontend Implementation

### Sign In Page
Location: `/Users/atharvajoshi/Desktop/fyp/PolarisAI-Frontend/app/signin/page.tsx`

**Google Sign In Handler:**
```typescript
const handleGoogleSignIn = async () => {
  // 1. Request OAuth URL from backend
  const response = await fetch('/api/auth/google');
  const data = await response.json();
  
  // 2. Redirect to Google OAuth
  window.location.href = data.url;
};
```

### Sign Up Page
Location: `/Users/atharvajoshi/Desktop/fyp/PolarisAI-Frontend/app/signup/page.tsx`

Same implementation as sign-in - Google OAuth handles both registration and login automatically.

### OAuth Callback Page
Location: `/Users/atharvajoshi/Desktop/fyp/PolarisAI-Frontend/app/auth/callback/page.tsx`

**Responsibilities:**
1. Extract authorization code from URL
2. Call backend callback endpoint
3. Store session tokens
4. Set authentication cookies
5. Redirect to dashboard

## Security Features

### Backend Security
- **CORS Configuration**: Proper CORS headers set in `index.js`
- **Error Handling**: Comprehensive error handling for OAuth failures
- **Token Security**: Uses Supabase's secure token exchange mechanism
- **Environment Variables**: Sensitive data stored in `.env` file

### Frontend Security
- **HTTPS Only**: OAuth redirects require HTTPS in production
- **Token Storage**: 
  - Access tokens stored in localStorage
  - Refresh tokens stored securely
  - HttpOnly cookies set for middleware access
- **CSRF Protection**: State parameter validation (handled by Supabase)
- **Error Recovery**: Graceful error handling with user feedback

### Session Management
- **Access Token**: Short-lived (1 hour)
- **Refresh Token**: Long-lived (30 days)
- **Auto-refresh**: Tokens automatically refreshed before expiration
- **Secure Cookies**: SameSite=Lax, 30-day expiration

## Supabase Configuration

### Required Settings in Supabase Dashboard

1. **Enable Google Provider**
   - Navigate to: Authentication → Providers
   - Enable Google provider
   - Configure redirect URLs

2. **Redirect URLs**
   - Development: `http://localhost:3001/auth/callback`
   - Production: `https://yourdomain.com/auth/callback`

3. **Site URL**
   - Set to your frontend URL
   - Development: `http://localhost:3001`
   - Production: `https://yourdomain.com`

4. **Additional Redirect URLs** (if needed)
   - Add any additional callback URLs for staging, etc.

## Environment Variables

### Backend (.env)
```bash
SUPABASE_URL=https://onztclcwwbquobbbrnkl.supabase.co
SUPABASE_API_KEY=your_supabase_anon_key
NEXT_PUBLIC_APP_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3001
```

### Frontend (.env.local)
```bash
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

## Testing

### Manual Testing Steps

1. **Sign In with Google**
   - Navigate to `/signin`
   - Click "Continue with Google"
   - Verify redirect to Google consent screen
   - Approve permissions
   - Verify redirect to dashboard
   - Verify user is authenticated

2. **Sign Up with Google**
   - Navigate to `/signup`
   - Click "Continue with Google"
   - Same flow as sign-in
   - Verify new user is created in Supabase

3. **Error Handling**
   - Test network failures
   - Test user canceling OAuth
   - Test invalid tokens
   - Verify error messages are user-friendly

### Automated Testing
```bash
# Backend
cd PolarisAI-Backend
npm test

# Frontend
cd PolarisAI-Frontend
npm test
```

## Common Issues & Solutions

### Issue: "Invalid redirect URL"
**Solution:** Ensure the callback URL in Supabase matches exactly: `http://localhost:3001/auth/callback`

### Issue: "CORS error"
**Solution:** Verify CORS middleware is configured correctly in `index.js`

### Issue: "Token not found"
**Solution:** Check that tokens are being stored correctly in localStorage and cookies

### Issue: "Session expired"
**Solution:** Implement token refresh logic using the refresh token

## Production Deployment

### Checklist
- [ ] Update environment variables with production URLs
- [ ] Configure Supabase redirect URLs for production domain
- [ ] Enable HTTPS
- [ ] Test OAuth flow in production environment
- [ ] Set up monitoring for OAuth failures
- [ ] Configure rate limiting for auth endpoints
- [ ] Review and update CORS settings for production domain

### Production URLs
```bash
# Backend
FRONTEND_URL=https://your-domain.com
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Frontend
NEXT_PUBLIC_API_URL=https://api.your-domain.com
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

## Monitoring & Logging

### Key Metrics to Monitor
- OAuth success rate
- Time to complete authentication
- Error rates by type
- User drop-off points

### Logging Points
- OAuth URL generation
- Authorization code exchange
- Token storage
- Session creation
- Error conditions

## Support & Troubleshooting

### Debug Mode
Enable detailed logging in development:
```javascript
// Backend
console.log('OAuth URL:', data.url);
console.log('Session data:', data.session);

// Frontend
console.log('Auth code:', code);
console.log('Stored token:', localStorage.getItem('auth_token'));
```

### Useful Commands
```bash
# Check backend logs
tail -f logs/app.log

# Test auth endpoint
curl http://localhost:3000/api/auth/google

# Verify Supabase connection
curl http://localhost:3000/health
```

## Additional Resources
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Next.js Authentication Best Practices](https://nextjs.org/docs/authentication)
