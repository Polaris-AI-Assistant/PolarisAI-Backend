# OTP-Based Signup Flow Documentation

## Overview
This document describes the complete OTP-based signup flow with multi-step form data collection and email verification.

## Architecture Flow

```
Step 1-2: User enters basic info (Name, Email, Password)
    ↓
Frontend: POST /api/auth/signup/send-otp
    ↓
Backend: Create user account + Send OTP email
    ↓
Step 3: User enters 6-digit OTP
    ↓
Frontend: POST /api/auth/signup/verify-otp
    ↓
Backend: Verify OTP + Update user metadata
    ↓
Frontend: Store session tokens
    ↓
Step 4-5: Collect personalization data (Use cases, User type)
    ↓
Step 6: Accept terms & privacy policy
    ↓
Step 7: Welcome screen → Redirect to Dashboard
```

## Backend API Endpoints

### 1. Send OTP (Create User & Send Verification)
**Endpoint:** `POST /api/auth/signup/send-otp`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "fullName": "John Doe"
}
```

**Validations:**
- Email format validation
- Password strength: minimum 8 characters, letters + numbers
- Required fields: email, password, fullName

**Response (Success - 201):**
```json
{
  "message": "OTP sent to your email",
  "email": "user@example.com",
  "userId": "uuid-here"
}
```

**Response (Error - 400):**
```json
{
  "error": "Invalid email format"
}
```

**What it does:**
1. Validates input data
2. Creates user account with `supabase.auth.signUp()`
3. Sends OTP to email with `supabase.auth.signInWithOtp()`
4. Returns success message

---

### 2. Verify OTP & Complete Signup
**Endpoint:** `POST /api/auth/signup/verify-otp`

**Request Body:**
```json
{
  "email": "user@example.com",
  "token": "123456",
  "metadata": {
    "fullName": "John Doe",
    "useCases": ["Manage tasks & projects", "Personal productivity"],
    "userType": "professional"
  }
}
```

**Response (Success - 200):**
```json
{
  "message": "Email verified successfully",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "emailConfirmed": true,
    "metadata": {
      "full_name": "John Doe",
      "use_cases": ["..."],
      "user_type": "professional"
    }
  },
  "session": {
    "access_token": "eyJhbGci...",
    "refresh_token": "LSp8Lgl...",
    "expires_in": 3600,
    "expires_at": 1234567890,
    "token_type": "bearer"
  }
}
```

**Response (Error - 400):**
```json
{
  "error": "Token has expired or is invalid"
}
```

**What it does:**
1. Verifies the 6-digit OTP code
2. Updates user metadata (use cases, user type, etc.)
3. Returns session tokens for authentication
4. Confirms email address

---

### 3. Resend OTP
**Endpoint:** `POST /api/auth/signup/resend-otp`

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (Success - 200):**
```json
{
  "message": "OTP resent successfully",
  "email": "user@example.com"
}
```

**What it does:**
1. Validates email format
2. Sends a new OTP to the email
3. Does not create a new user (shouldCreateUser: false)

---

## Frontend Implementation

### Multi-Step Form (7 Steps)

#### Step 1: Basic Account Details
**Fields:**
- Full Name (text input)
- Email (email input)

**Validation:**
- Both fields required to continue

**Action:** Click "Continue" → Move to Step 2

---

#### Step 2: Password Setup
**Fields:**
- Password (password input with show/hide)
- Confirm Password (password input with show/hide)

**Validation:**
- Both passwords required
- Passwords must match
- Password strength requirements enforced

**Action:** Click "Continue" → Triggers `onSendOtp()` API call
- On success → Move to Step 3
- On error → Show error alert

---

#### Step 3: Email Verification (OTP)
**Fields:**
- 6-digit verification code (text input, max 6 chars)

**Display:**
- Shows email address
- "Resend Code" button
- "Change Email" button (goes back to Step 1)

**Validation:**
- Must be exactly 6 digits

**Action:** Click "Verify & Continue" → Triggers `onVerifyOtp()` API call
- On success → Stores tokens & moves to Step 4
- On error → Show error alert

**Additional Actions:**
- "Resend Code" → Triggers `onResendOtp()` API call
- "Change Email" → Returns to Step 1

---

#### Step 4: Use Cases Selection
**Fields:**
- Multiple choice selection (checkboxes)
- Options:
  - Manage tasks & projects
  - Personal productivity
  - Remembering important things across apps
  - Work organization
  - Notes & knowledge management
  - Research + learning

**Validation:**
- At least one option must be selected

**Action:** Click "Continue" → Move to Step 5

---

#### Step 5: User Type Selection
**Fields:**
- Single choice selection (radio buttons)
- Options:
  - 🎓 Student
  - 💼 Professional
  - 🚀 Founder / Entrepreneur
  - 🔬 Researcher

**Validation:**
- One option must be selected

**Action:** Click "Continue" → Move to Step 6

---

#### Step 6: Terms & Privacy
**Fields:**
- Checkbox: Accept Terms & Conditions
- Checkbox: Accept Privacy Policy
- Checkbox: Data consent for AI features

**Validation:**
- All three must be checked to continue

**Action:** Click "Accept & Continue" → Move to Step 7

---

#### Step 7: Welcome Screen
**Display:**
- Success message
- Welcome to Polaris AI

**Actions:**
- "Go to Dashboard" → Redirect to /dashboard
- "Skip for now" → Redirect to /dashboard

---

## Session Management

### Token Storage (After OTP Verification)
```javascript
// LocalStorage
localStorage.setItem('auth_token', session.access_token);
localStorage.setItem('refresh_token', session.refresh_token);
localStorage.setItem('user_data', JSON.stringify(user));

// Cookies (for middleware)
document.cookie = `auth_token=${session.access_token}; path=/; max-age=${expires_in}; SameSite=Lax`;
document.cookie = `refresh_token=${session.refresh_token}; path=/; max-age=${expires_in}; SameSite=Lax`;
```

### Token Expiration
- Access Token: 1 hour (3600 seconds)
- Refresh Token: 30 days
- Use `/api/auth/refresh` endpoint to refresh tokens

---

## User Metadata Schema

Stored in Supabase `auth.users` table under `user_metadata`:

```json
{
  "full_name": "John Doe",
  "use_cases": [
    "Manage tasks & projects",
    "Personal productivity"
  ],
  "user_type": "professional",
  "onboarding_completed": false
}
```

---

## Email Configuration (Supabase)

### Required Settings
1. **Enable Email Provider** (Supabase Dashboard)
   - Go to: Authentication → Providers → Email
   - Enable "Confirm email"
   - Enable "Secure email change"

2. **Email Templates** (Supabase Dashboard)
   - Go to: Authentication → Email Templates
   - Customize "Confirm signup" template with OTP
   - Template should include `{{ .Token }}` for 6-digit code

3. **Redirect URLs** (Supabase Dashboard)
   - Site URL: `http://localhost:3001`
   - Redirect URLs: `http://localhost:3001/auth/callback`

---

## Security Features

### Backend Security
- **Input Sanitization:** All user inputs sanitized
- **Email Validation:** Regex-based email format check
- **Password Validation:** Minimum 8 chars, letters + numbers required
- **OTP Expiration:** OTP expires after 60 seconds
- **Rate Limiting:** Prevent OTP spam (implement if needed)

### Frontend Security
- **Password Visibility Toggle:** Secure password input
- **Client-side Validation:** Prevent invalid API calls
- **Error Handling:** User-friendly error messages
- **Token Storage:** Secure storage in localStorage + cookies

---

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Invalid email format" | Email doesn't match regex | Check email format |
| "Password must be at least 8 characters..." | Weak password | Use stronger password |
| "Passwords do not match" | Confirmation mismatch | Re-enter passwords |
| "Token has expired or is invalid" | Wrong/expired OTP | Request new OTP |
| "User already registered" | Email exists | Use sign in instead |
| "Email and OTP token are required" | Missing fields | Provide all fields |

---

## Testing Guide

### Manual Testing Flow

1. **Step 1-2: Account Creation**
   ```
   - Enter name: "Test User"
   - Enter email: "test@example.com"
   - Enter password: "TestPass123"
   - Confirm password: "TestPass123"
   - Click "Continue"
   ```

2. **Verify OTP Email**
   ```
   - Check email inbox for OTP
   - Should receive 6-digit code
   - Code expires in 60 seconds
   ```

3. **Step 3: OTP Verification**
   ```
   - Enter 6-digit code
   - Click "Verify & Continue"
   - Should see success message
   ```

4. **Step 4-5: Personalization**
   ```
   - Select use cases (multiple)
   - Select user type (one)
   - Click "Continue" each step
   ```

5. **Step 6: Accept Policies**
   ```
   - Check all three checkboxes
   - Click "Accept & Continue"
   ```

6. **Step 7: Complete**
   ```
   - Click "Go to Dashboard"
   - Should redirect to /dashboard
   - User should be authenticated
   ```

### API Testing (curl)

```bash
# 1. Send OTP
curl -X POST http://localhost:3000/api/auth/signup/send-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123",
    "fullName": "Test User"
  }'

# 2. Verify OTP
curl -X POST http://localhost:3000/api/auth/signup/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "token": "123456",
    "metadata": {
      "fullName": "Test User",
      "useCases": ["Personal productivity"],
      "userType": "professional"
    }
  }'

# 3. Resend OTP
curl -X POST http://localhost:3000/api/auth/signup/resend-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com"
  }'
```

---

## Production Checklist

- [ ] Configure production email provider (SMTP)
- [ ] Set up proper rate limiting for OTP endpoints
- [ ] Update redirect URLs for production domain
- [ ] Implement OTP attempt limits (max 3-5 tries)
- [ ] Add email verification expiry (Supabase default: 24h)
- [ ] Set up monitoring for OTP delivery failures
- [ ] Configure proper CORS for production
- [ ] Add analytics tracking for signup funnel
- [ ] Test email deliverability
- [ ] Review and update email templates

---

## Troubleshooting

### OTP Not Received
1. Check Supabase email settings
2. Verify email provider configuration
3. Check spam/junk folder
4. Try resending OTP
5. Check Supabase logs for delivery errors

### Invalid OTP Error
1. Ensure OTP not expired (60s default)
2. Check for typos in 6-digit code
3. Request new OTP if expired
4. Verify email matches exactly

### Session Not Persisting
1. Check localStorage has tokens
2. Verify cookies are set correctly
3. Check cookie domain settings
4. Ensure middleware reads cookies properly

---

## Additional Notes

- **OTP Expiry:** Default 60 seconds (configurable in Supabase)
- **Max Attempts:** Consider implementing after 3-5 failed attempts
- **Email Rate Limit:** Prevent abuse with rate limiting
- **Metadata Updates:** Can be updated later via profile settings
- **Google OAuth:** Bypasses OTP flow entirely
