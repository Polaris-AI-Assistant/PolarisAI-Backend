# Gmail Sender Name Fix

## Problem
When sending emails via Gmail, the system was using "the sender" as a placeholder in email signatures instead of extracting and using the actual user's name.

## Solution
Implemented a multi-tier fallback system to extract the sender's name from various sources:

### 1. Database Schema Update
Added `name` column to `gmail_tokens` table to store the user's display name from Google profile:

```sql
ALTER TABLE public.gmail_tokens 
ADD COLUMN IF NOT EXISTS name text;
```

Run this migration: `PolarisAI-Backend/gmail/add_name_to_gmail_tokens.sql`

### 2. Gmail Authentication Flow Update
Updated `agentConnect.js` to store the user's name during OAuth:

```javascript
const userInfo = await oauth2.userinfo.get();
const userName = userInfo.data.name; // Extract from Google profile

// Store in database
await supabase.from("gmail_tokens").upsert([{
  email: userEmail,
  name: userName, // ✅ Now storing user's name
  access_token: tokens.access_token,
  // ... other fields
}]);
```

### 3. Sender Name Extraction Helper
Created `getSenderName()` function in `gmailService.js` with fallback chain:

**Priority Order:**
1. **Gmail tokens** - Name from Google profile (stored during OAuth)
2. **Auth users metadata** - `user_metadata.full_name`, `user_metadata.name`, or `user_metadata.display_name`
3. **Email username** - Extract from email address (e.g., "john" from "john@example.com")
4. **Fallback** - "the sender" (only if all above fail)

### 4. Integration Points Updated

#### mainAgent.js
Updated two locations where sender name is extracted:

**Location 1: Around line 1370** (Meeting invitations)
```javascript
// Get sender name with proper fallback chain
let senderName = 'the sender';
try {
  const supabase = require('../supabase/supabaseConnect');
  const supabaseAdmin = require('../supabase/supabaseAdmin');
  
  // Try 1: Gmail tokens
  const { data: gmailData } = await supabase
    .from('gmail_tokens')
    .select('name')
    .eq('user_id', userId)
    .single();
  
  if (gmailData?.name) {
    senderName = gmailData.name;
  } else {
    // Try 2: Auth metadata
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
    // ... fallback logic
  }
} catch (err) {
  // Keep default
}
```

**Location 2: Around line 1230** (General email sending)
```javascript
// For Gmail, extract name from gmail_tokens or auth.users
const { data: gmailData } = await supabase
  .from('gmail_tokens')
  .select('name, email')
  .eq('user_id', userId)
  .single();

if (gmailData?.name) {
  senderName = gmailData.name;
} else {
  // Fallback to auth.users metadata or email username
}
```

## Testing

### 1. Run Database Migration
```bash
psql -h <your-supabase-host> -U postgres -d postgres -f PolarisAI-Backend/gmail/add_name_to_gmail_tokens.sql
```

### 2. Re-authenticate Gmail
Users need to disconnect and reconnect Gmail to populate the `name` field:
1. Go to Settings → Integrations
2. Disconnect Gmail
3. Reconnect Gmail (OAuth will now store the name)

### 3. Test Email Sending
Send a test email and verify the signature uses the actual user's name instead of "the sender".

## Example Output

### Before Fix
```
Best regards,
the sender
```

### After Fix
```
Best regards,
John Doe
```

## Fallback Behavior

If the user's name cannot be determined from any source, the system will:
1. Try Gmail tokens (name from Google)
2. Try auth.users metadata
3. Use email username (e.g., "john" from "john@example.com")
4. Use "the sender" as last resort

## Files Modified
- `PolarisAI-Backend/gmail/add_name_to_gmail_tokens.sql` (NEW)
- `PolarisAI-Backend/gmail/agentConnect.js`
- `PolarisAI-Backend/gmail/gmailService.js`
- `PolarisAI-Backend/mainAgent/mainAgent.js`

## Notes
- The `name` field is populated during OAuth, so existing users need to re-authenticate
- The fallback chain ensures emails always have a reasonable sender name
- Microsoft email integration already had proper name extraction and was not affected
