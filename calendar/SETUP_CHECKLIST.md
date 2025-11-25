# Google Calendar Agent - Setup Checklist

Use this checklist to complete the setup and get your Calendar agent working.

## ✅ Phase 1: Backend Setup

### 1.1 Environment Variables
- [ ] Open your `.env` file in the FYP folder
- [ ] Add the following variables (you mentioned you already have Calendar credentials):
  ```env
  GOOGLE_CALENDAR_CLIENT_ID=your_client_id_here
  GOOGLE_CALENDAR_CLIENT_SECRET=your_client_secret_here
  GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:3000/api/auth/calendar/callback
  OPENAI_API_KEY=your_openai_key (already have this)
  FRONTEND_URL=http://localhost:3001
  ```
- [ ] Save the `.env` file

### 1.2 Google Cloud Console Configuration
- [ ] Go to https://console.cloud.google.com/
- [ ] Select your project (or create a new one)
- [ ] Enable Google Calendar API:
  - Go to "APIs & Services" > "Library"
  - Search for "Google Calendar API"
  - Click "Enable"
- [ ] Configure OAuth consent screen (if not already done):
  - Go to "APIs & Services" > "OAuth consent screen"
  - Add required scopes
- [ ] Create OAuth 2.0 credentials (if not already done):
  - Go to "APIs & Services" > "Credentials"
  - Click "Create Credentials" > "OAuth client ID"
  - Application type: "Web application"
  - Add authorized redirect URI: `http://localhost:3000/api/auth/calendar/callback`
  - Copy Client ID and Client Secret to `.env`

### 1.3 Database Setup
- [ ] Log in to your Supabase dashboard
- [ ] Go to the SQL Editor
- [ ] Open `calendar/create_calendar_tokens_table.sql`
- [ ] Copy the entire SQL script
- [ ] Paste and run it in Supabase SQL Editor
- [ ] Verify the `calendar_tokens` table was created:
  - Go to "Table Editor"
  - Look for `calendar_tokens` table
  - Check that it has the correct columns

### 1.4 Verify Backend Files
- [ ] Confirm all Calendar files are in place:
  - [ ] `FYP/calendar/calendarAuth.js`
  - [ ] `FYP/calendar/calendarService.js`
  - [ ] `FYP/calendar/calendarAgent.js`
  - [ ] `FYP/calendar/calendarAgentController.js`
  - [ ] `FYP/calendar/calendarData.js`
- [ ] Verify `FYP/index.js` was updated with Calendar routes
  - Look for `const calendarAuthRoutes = require('./calendar/calendarAuth');`
  - Look for `app.use('/api/calendar', calendarAgentRoutes);`

### 1.5 Install Dependencies (if needed)
- [ ] Navigate to FYP folder: `cd FYP`
- [ ] Check if all dependencies are installed: `npm list`
- [ ] If missing, install: `npm install`
  - Required packages should already be in package.json:
    - express
    - googleapis
    - openai
    - @supabase/supabase-js

### 1.6 Start the Backend Server
- [ ] Make sure you're in the FYP folder
- [ ] Start the server: `npm start` or `node index.js`
- [ ] Look for success message:
  ```
  🚀 Server running on http://localhost:3000
  📚 API documentation available at http://localhost:3000/api
  ❤️  Health check available at http://localhost:3000/health
  ```
- [ ] No error messages about missing files or modules

## ✅ Phase 2: Backend Testing

### 2.1 Health Check
- [ ] Open browser or use curl
- [ ] Test: `http://localhost:3000/health`
- [ ] Should return: `{"status":"healthy",...}`

### 2.2 Test Calendar Routes
- [ ] Test OAuth URL endpoint:
  ```bash
  curl http://localhost:3000/api/auth/calendar/url \
    -H "Authorization: Bearer YOUR_TOKEN"
  ```
- [ ] Should return an OAuth URL

### 2.3 Test with Test Script (Optional)
- [ ] Open `calendar/testCalendar.js`
- [ ] Update test email/password if needed
- [ ] Run: `node calendar/testCalendar.js`
- [ ] Follow the prompts

### 2.4 OAuth Connection Test
- [ ] Sign in to your app to get an auth token
- [ ] Visit: `http://localhost:3000/api/auth/calendar/connect`
  - Or get URL from: `http://localhost:3000/api/auth/calendar/url`
- [ ] Authorize with your Google account
- [ ] Should redirect back with success
- [ ] Check Supabase `calendar_tokens` table
- [ ] Should see your token entry

### 2.5 Test AI Agent
- [ ] Once connected, test the agent:
  ```bash
  curl -X POST http://localhost:3000/api/calendar/agent/query \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"query": "show me my events for today"}'
  ```
- [ ] Should return AI-generated response with events

## ✅ Phase 3: Frontend Integration

### 3.1 Create Calendar Page
- [ ] Create `frontend/app/calendar/page.tsx` (similar to forms page)
- [ ] Add:
  - Connection status display
  - Connect/disconnect button
  - OAuth flow handling
  - Basic event list (optional)

### 3.2 Create Calendar Chat Interface
- [ ] Create `frontend/app/calendar/chat/page.tsx`
- [ ] Add:
  - Chat interface for AI agent
  - Message input
  - Message history display
  - Example queries
  - Loading states

### 3.3 Update Navigation
- [ ] Add Calendar link to navigation menu
- [ ] Update any relevant frontend files

### 3.4 Test Frontend
- [ ] Start frontend server: `cd frontend && npm run dev`
- [ ] Visit: `http://localhost:3001/calendar`
- [ ] Test connection flow
- [ ] Test AI chat interface

## ✅ Phase 4: End-to-End Testing

### 4.1 Complete User Flow
- [ ] Sign in to your app
- [ ] Go to Calendar page
- [ ] Click "Connect Google Calendar"
- [ ] Authorize with Google
- [ ] See connection success
- [ ] Try AI queries:
  - [ ] "Show me my events for today"
  - [ ] "Schedule a meeting tomorrow at 2pm"
  - [ ] "What's on my calendar this week?"
  - [ ] "Create a test event"
- [ ] Verify events in Google Calendar

### 4.2 Test All Features
- [ ] Create event with AI
- [ ] Get events with AI
- [ ] Update event with AI
- [ ] Delete event with AI
- [ ] List calendars
- [ ] Test conversation history
- [ ] Test error handling

### 4.3 Test Direct API (Optional)
- [ ] Use Postman or curl
- [ ] Test direct endpoints:
  - [ ] POST /api/calendar/events
  - [ ] GET /api/calendar/events
  - [ ] PUT /api/calendar/events/:id
  - [ ] DELETE /api/calendar/events/:id
  - [ ] GET /api/calendar/calendars

## ✅ Phase 5: Documentation Review

- [ ] Read through `calendar/README.md`
- [ ] Review `calendar/QUICK_REFERENCE.md`
- [ ] Check `calendar/IMPLEMENTATION_SUMMARY.md`
- [ ] Understand `calendar/ARCHITECTURE.md`

## 🎯 Success Criteria

You're done when:
- [x] Backend server starts without errors
- [ ] OAuth connection works
- [ ] Tokens are stored in Supabase
- [ ] AI agent responds to queries
- [ ] Events are created/retrieved from Google Calendar
- [ ] Frontend can connect and interact with Calendar
- [ ] All tests pass

## 🐛 Troubleshooting Guide

### Issue: "Cannot find module './calendar/calendarAuth'"
**Solution:** 
- Verify all files are in `FYP/calendar/` folder
- Check file names match exactly
- Restart the server

### Issue: "GOOGLE_CALENDAR_CLIENT_ID is not defined"
**Solution:**
- Check `.env` file exists in FYP folder
- Verify variable names match exactly
- Restart the server after updating `.env`

### Issue: "User tokens not found"
**Solution:**
- Complete OAuth flow first
- Check `calendar_tokens` table in Supabase
- Verify user ID matches

### Issue: OAuth callback fails
**Solution:**
- Check redirect URI in Google Console matches `.env`
- Verify Calendar API is enabled
- Check OAuth consent screen is configured

### Issue: "Invalid credentials"
**Solution:**
- Verify Client ID and Secret in `.env`
- Regenerate credentials in Google Console if needed
- Check for typos in `.env` file

### Issue: AI agent doesn't respond
**Solution:**
- Verify `OPENAI_API_KEY` is set
- Check OpenAI API quota
- Look at server logs for errors
- Verify Calendar is connected

### Issue: Events not created
**Solution:**
- Verify date/time format is correct (ISO 8601)
- Check user has calendar write permissions
- Verify tokens are valid (not expired)
- Check Google Calendar API quota

## 📞 Next Steps After Setup

1. **Test thoroughly** with different queries
2. **Add more features** (templates, analytics, etc.)
3. **Integrate with Forms/Gmail** agents
4. **Improve UI/UX** on frontend
5. **Add error notifications** in frontend
6. **Consider rate limiting** for API calls
7. **Add analytics/logging** for monitoring

## 📝 Notes

- Keep your `.env` file secure (never commit to git)
- Monitor Google API quotas
- Monitor OpenAI API usage
- Backup your database regularly
- Test with multiple users
- Consider adding more Calendar features

## ✨ Optional Enhancements

- [ ] Add event templates
- [ ] Add bulk operations
- [ ] Add calendar sharing
- [ ] Add event reminders customization
- [ ] Add timezone conversion helper
- [ ] Add calendar analytics
- [ ] Add event conflict detection
- [ ] Add recurring event templates
- [ ] Add calendar color customization
- [ ] Add event attachments support

---

**Congratulations! Once you complete this checklist, your Google Calendar Agent will be fully operational! 🎉**

For help, refer to:
- `calendar/README.md` - Full documentation
- `calendar/QUICK_REFERENCE.md` - Quick commands
- `calendar/ARCHITECTURE.md` - System design

Happy coding! 🚀
