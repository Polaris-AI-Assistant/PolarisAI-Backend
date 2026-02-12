# 🔑 Get Your Supabase Service Role Key

## Quick Steps (2 minutes)

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project: `onztclcwwbquobbbrnkl`

2. **Get Service Role Key**
   - Click **Settings** (⚙️ gear icon in sidebar)
   - Click **API** 
   - Scroll to **Project API keys** section
   - Find the **`service_role`** key (it's secret - don't share it!)
   - Click the **Copy** button

3. **Add to .env File**
   - Open `PolarisAI-Backend/.env`
   - Add this line (replace with your actual key):
   ```
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   ```

4. **Restart Backend**
   ```powershell
   cd PolarisAI-Backend
   npm start
   ```

## Why Do You Need This?

The **anon key** (what you have now) is subject to Row Level Security (RLS) policies.
The **service role key** bypasses RLS - needed for backend file operations.

⚠️ **IMPORTANT**: Never commit the service role key to GitHub! It's already in .gitignore.

## Test It

After adding the key and restarting:
1. Open browser console (F12)
2. Click attach button in chat
3. Select a file
4. Should upload successfully! ✅
