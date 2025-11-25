# Google Meet Setup Checklist

## ✅ Pre-Setup (Already Done)

- [x] Backend files created (9 files)
- [x] Frontend files created (2 files)
- [x] Environment variables configured
- [x] Routes registered in index.js
- [x] All tools implemented (7 tools)
- [x] TypeScript types defined
- [x] UI components created
- [x] Documentation written

## 📋 Setup Steps (Do These Now)

### Step 1: Database Setup
```bash
# In Supabase SQL Editor:
```

1. **Create the table:**
   - Navigate to Supabase SQL Editor
   - Copy and run: `FYP/meet/create_meet_tokens_table.sql`
   - Verify table exists: Check "meet_tokens" in table list

2. **Disable RLS:**
   - Copy and run: `FYP/meet/disable_meet_rls.sql`
   - Verify: Should show `rowsecurity = false`

### Step 2: Google Cloud Console (Verify)
```bash
# Make sure these are configured:
```

1. Navigate to: https://console.cloud.google.com
2. Go to: APIs & Services → OAuth consent screen
3. Verify scopes include:
   - `https://www.googleapis.com/auth/meetings.space.created`
   - `https://www.googleapis.com/auth/drive.readonly`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`

4. Go to: Credentials
5. Find OAuth 2.0 Client (ends in rap9)
6. Verify Authorized redirect URI:
   - `http://localhost:3000/api/auth/meet/callback`

### Step 3: Start Backend
```bash
cd "C:\Users\bhumi\Downloads\FYP 2\FYP\FYP"
npm start
```

Expected output:
```
Server running on port 3000
✓ Gmail routes loaded
✓ Forms routes loaded
✓ Calendar routes loaded
✓ Sheets routes loaded
✓ Docs routes loaded
✓ Meet routes loaded  ← Should see this!
✓ GitHub routes loaded
```

### Step 4: Start Frontend
```bash
cd "C:\Users\bhumi\Downloads\FYP 2\FYP\frontend"
npm run dev
```

Expected output:
```
- ready started server on 0.0.0.0:3001
- Local:        http://localhost:3001
```

## 🧪 Testing Steps

### Test 1: Access Page
1. Open browser: `http://localhost:3001/meet`
2. Should see "Connect Google Meet" screen
3. ✅ Pass if page loads without errors

### Test 2: OAuth Connection
1. Click "Connect Google Meet" button
2. Redirects to Google OAuth
3. Select your Google account
4. Grant permissions
5. Redirects back to meet page
6. ✅ Pass if "Connected" badge appears

### Test 3: Create Meeting
1. In chat input, type: "Create a new meeting"
2. Press Send
3. AI responds with meeting link
4. ✅ Pass if meeting link appears with copy/join buttons

### Test 4: Copy Link
1. Click "Copy" button on meeting link
2. Paste somewhere (notepad, etc.)
3. ✅ Pass if link is copied correctly

### Test 5: Join Meeting
1. Click "Join Meeting" button
2. Opens Google Meet in new tab
3. ✅ Pass if meeting loads

### Test 6: Other Queries
Try these:
- "Show me meeting history"
- "List recordings"
- "Get meeting details"
- ✅ Pass if AI responds appropriately

## 🐛 Troubleshooting

### Issue: Backend won't start
- **Check:** Port 3000 not already in use
- **Fix:** Close other apps using port 3000

### Issue: "User tokens not found"
- **Check:** Did you complete OAuth flow?
- **Fix:** Click "Connect Google Meet" again

### Issue: "Failed to create meeting"
- **Check:** Are scopes correct in Google Cloud?
- **Fix:** Add missing scopes and reconnect

### Issue: SQL errors
- **Check:** Did both SQL scripts run successfully?
- **Fix:** Re-run the scripts in order

### Issue: Frontend errors
- **Check:** Is NEXT_PUBLIC_API_URL set?
- **Fix:** Should be `http://localhost:3000`

## 📊 Verification Checklist

After setup, verify:

- [ ] `meet_tokens` table exists in Supabase
- [ ] RLS is disabled on `meet_tokens`
- [ ] Backend starts without errors
- [ ] Frontend starts without errors
- [ ] `/meet` page loads
- [ ] Can connect Google Meet account
- [ ] Can create meetings
- [ ] Meeting links work
- [ ] Copy button works
- [ ] Join button opens Google Meet
- [ ] AI responds to queries
- [ ] No console errors

## 🎉 Success Criteria

You're done when:
1. ✅ All checkboxes above are checked
2. ✅ Can create meeting links via chat
3. ✅ Links work and open Google Meet
4. ✅ No errors in browser console
5. ✅ No errors in terminal logs

## 📞 Quick Test Command

After setup, test the agent directly:

```bash
# In terminal with backend running:
curl -X POST http://localhost:3000/api/meet/agent/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"query": "create a new meeting"}'
```

Should return JSON with meeting link!

## 🚀 You're Ready!

Once all steps are complete, Google Meet is fully integrated and ready to use just like Google Forms!

---

**Need Help?**
- Check logs in terminal
- Check browser console (F12)
- Review README.md for details
- Check IMPLEMENTATION_SUMMARY.md for architecture
