/**
 * Supabase Admin Client
 * Uses SERVICE_ROLE key to bypass RLS policies for backend operations
 * DO NOT use this client for user-facing operations - only for trusted backend services
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://onztclcwwbquobbbrnkl.supabase.co';
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceRole) {
  console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY not found in .env - file uploads will fail!');
  console.warn('Get your service role key from: Supabase Dashboard → Settings → API → service_role');
}

// Create admin client with service role key (bypasses RLS)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

module.exports = supabaseAdmin;
