# Quick Test Guide - Credit System

## ✅ What Was Fixed

**Problem:** CreditBalance showing "Not authenticated"  
**Root Cause:** Wrong localStorage key (`'token'` instead of `'auth_token'`)  
**Solution:** Fixed both CreditBalance component files  

---

## 🧪 Test the Fix NOW

### Step 1: Restart Frontend (Required)
```bash
cd PolarisAI-Frontend
# Stop the dev server (Ctrl+C)
npm run dev
# or
yarn dev
```

### Step 2: Clear Browser Storage
1. Open browser DevTools (F12)
2. Go to Application tab
3. Click "Clear site data" OR
4. Open Console and run:
```javascript
localStorage.clear()
sessionStorage.clear()
location.reload()
```

### Step 3: Log In Again
1. Navigate to your login page
2. Log in with your credentials
3. You should be redirected to the dashboard

### Step 4: Verify Credit Display
Look at the dashboard sidebar (above the profile dropdown):

✅ **Success looks like:**
```
🪙 1000 credits   ℹ️
```
- Blue background indicator
- Shows "1000 credits" for new users
- Info icon on the right
- No error messages

❌ **Failure looks like:**
```
⚠️ Not authenticated
```
- Red warning icon
- Error message
- No credit count

### Step 5: Test Hover Tooltip
1. Hover over the credit balance
2. You should see a detailed tooltip with:
   - Balance bar (100% full)
   - Current Balance: 1000
   - Total Earned: +1000
   - Total Spent: -0
   - "View Details" button

---

## 🔍 Troubleshooting

### Still showing "Not authenticated"?

**Check 1: Verify you're logged in**
```javascript
// In browser console:
console.log(localStorage.getItem('auth_token'));
// Should show a long JWT token string
```

**Check 2: Verify backend is running**
```bash
cd PolarisAI-Backend
node index.js
# Should show "Server running on port 3000"
```

**Check 3: Check backend URL**
```javascript
// In browser console:
console.log(process.env.NEXT_PUBLIC_BACKEND_URL);
// Should show: http://localhost:3000 (or your backend URL)
```

**Check 4: Test API directly**
```bash
# Get your token from localStorage
TOKEN="your_token_here"

# Test the credits endpoint
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:3000/api/credits/balance
```

Expected response:
```json
{
  "success": true,
  "balance": 1000,
  "totalEarned": 1000,
  "totalSpent": 0,
  "isLow": false,
  "lowBalanceThreshold": 50
}
```

### Network Error?

**Check browser network tab:**
1. Open DevTools (F12)
2. Go to Network tab
3. Refresh the page
4. Look for request to `/api/credits/balance`
5. Check the response

**Common issues:**
- 401 Unauthorized: Token expired or invalid
- 404 Not Found: Backend not running or wrong URL
- 500 Server Error: Check backend console logs
- CORS Error: Check backend CORS configuration

---

## 📊 What to Expect

### Current Functionality ✅
- ✅ View credit balance in dashboard
- ✅ Auto-refresh every 60 seconds
- ✅ Detailed tooltip on hover
- ✅ Low balance warnings (< 50 credits)
- ✅ Click to navigate to billing page
- ✅ Real-time updates via event listener

### Not Yet Implemented ⏳
- ⏳ Credit deduction on queries (needs main agent integration)
- ⏳ Welcome message about free credits
- ⏳ Transaction history page UI
- ⏳ Credit purchase/top-up system
- ⏳ Email notifications for low balance

---

## 🎯 Quick Verification Checklist

Run through this checklist:

- [ ] Frontend dev server restarted
- [ ] Browser cache and localStorage cleared
- [ ] Logged in successfully
- [ ] Dashboard loads without errors
- [ ] Credit balance visible in sidebar
- [ ] Shows "1000 credits" (for new accounts)
- [ ] Blue indicator (not red error)
- [ ] Hover shows detailed tooltip
- [ ] No console errors in browser DevTools
- [ ] No authentication errors in backend logs

If all boxes are checked: **✅ Credit system is working!**

---

## 🚀 Next Steps

### To Enable Credit Deduction:
1. Open `PolarisAI-Backend/mainAgent/mainAgentController.js`
2. Follow instructions in `mainAgentIntegration.example.js`
3. Add imports, middleware, and deduction logic
4. Test with a query
5. Verify credits deduct correctly

### Estimated Time:
- Reading integration guide: 5 minutes
- Making code changes: 10 minutes
- Testing: 5 minutes
- **Total: ~20 minutes**

---

## 📞 Need Help?

**Check these files:**
- `CREDIT_SYSTEM_STATUS.md` - Overall system status
- `FINAL_CHECKLIST.md` - Complete implementation guide
- `ARCHITECTURE.md` - System architecture details
- `mainAgentIntegration.example.js` - Integration instructions

**Check backend logs for:**
- `[CreditController]` - API endpoint logs
- `[CreditService]` - Business logic logs
- `[CreditMiddleware]` - Validation logs

**Check browser console for:**
- `[CreditBalance]` - Component logs
- Network requests to `/api/credits/balance`
- Any authentication errors

---

**Last Updated:** After token authentication fix  
**Status:** ✅ Ready to test  
**Action Required:** Restart frontend and clear browser cache
