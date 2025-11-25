const express = require('express');
const { google } = require("googleapis");
const supabase = require('../supabase/supabaseConnect');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Define OAuth scopes for Google Calendar
const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'openid'
];

// Google OAuth client for Calendar
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CALENDAR_CLIENT_ID,
  process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
  process.env.GOOGLE_CALENDAR_REDIRECT_URI
);

// Generate the consent screen URL
function getAuthUrl(state = null) {
  const authConfig = {
    access_type: 'offline',   // ensures refresh_token is returned
    prompt: 'consent',        // forces Google to re-ask for permissions
    response_type: 'code',    // required parameter for authorization code flow
    scope: SCOPES.join(' ')   // convert array to space-separated string
  };
  
  if (state) {
    authConfig.state = state;
  }
  
  return oauth2Client.generateAuthUrl(authConfig);
}

// Step 1: Generate OAuth URL and redirect (REQUIRES AUTHENTICATION)
router.get('/auth/calendar/connect', authenticateToken, (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ 
        error: "Authentication required", 
        message: "You must be signed in to connect Google Calendar" 
      });
    }

    const state = Buffer.from(JSON.stringify({ 
      user_id: req.user.id,
      timestamp: Date.now(),
      service: 'calendar'
    })).toString('base64');
    
    const url = getAuthUrl(state);
    res.redirect(url);
  } catch (err) {
    console.error("Calendar OAuth URL generation error:", err);
    res.status(500).json({ error: "Failed to generate Calendar OAuth URL" });
  }
});

// Get OAuth URL without redirecting (REQUIRES AUTHENTICATION)
router.get('/auth/calendar/url', authenticateToken, (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ 
        error: "Authentication required", 
        message: "You must be signed in to connect Google Calendar" 
      });
    }

    const state = Buffer.from(JSON.stringify({ 
      user_id: req.user.id,
      timestamp: Date.now(),
      service: 'calendar'
    })).toString('base64');
    
    const url = getAuthUrl(state);
    res.json({ 
      authUrl: url,
      user_id: req.user.id,
      scopes: SCOPES,
      message: "Google Calendar OAuth URL generated for authenticated user"
    });
  } catch (err) {
    console.error("Calendar OAuth URL generation error:", err);
    res.status(500).json({ error: "Failed to generate Calendar OAuth URL" });
  }
});

// Protected route: Get OAuth URL for authenticated users
router.get('/auth/calendar/url/authenticated', authenticateToken, (req, res) => {
  try {
    const state = Buffer.from(JSON.stringify({ 
      user_id: req.user.id,
      timestamp: Date.now(),
      service: 'calendar'
    })).toString('base64');
    
    const url = getAuthUrl(state);
    res.json({ 
      authUrl: url,
      user_id: req.user.id,
      scopes: SCOPES,
      message: "OAuth URL for authenticated user",
      redirectUri: process.env.GOOGLE_CALENDAR_REDIRECT_URI
    });
  } catch (err) {
    console.error("Calendar OAuth URL generation error:", err);
    res.status(500).json({ error: "Failed to generate Calendar OAuth URL" });
  }
});

// Step 2: Handle OAuth Callback
router.get('/auth/calendar/callback', async (req, res) => {
  const { code, state, error: oauthError } = req.query;

  // Handle OAuth errors
  if (oauthError) {
    console.error("OAuth error:", oauthError);
    return res.redirect(`${process.env.FRONTEND_URL}/calendar?error=${encodeURIComponent(oauthError)}`);
  }

  if (!code) {
    return res.status(400).json({ error: "Authorization code missing" });
  }

  try {
    // Decode state to get user_id
    let userId = null;
    if (state) {
      try {
        const decodedState = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
        userId = decodedState.user_id;
      } catch (e) {
        console.error("Error decoding state:", e);
      }
    }

    if (!userId) {
      return res.status(400).json({ error: "User ID not found in state" });
    }

    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    // Store tokens in Supabase calendar_tokens table
    const { data: existingToken, error: fetchError } = await supabase
      .from("calendar_tokens")
      .select("*")
      .eq("user_id", userId)
      .single();

    const tokenData = {
      user_id: userId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || (existingToken ? existingToken.refresh_token : null),
      token_type: tokens.token_type,
      expiry_date: tokens.expiry_date,
      scope: tokens.scope,
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      updated_at: new Date().toISOString()
    };

    if (existingToken) {
      // Update existing token
      await supabase
        .from("calendar_tokens")
        .update(tokenData)
        .eq("user_id", userId);
    } else {
      // Insert new token
      tokenData.created_at = new Date().toISOString();
      await supabase
        .from("calendar_tokens")
        .insert([tokenData]);
    }

    console.log(`Calendar tokens saved for user ${userId} (${userInfo.email})`);

    // Redirect to frontend callback with success
    res.redirect(`${process.env.FRONTEND_URL}/auth/calendar/callback?success=true&email=${encodeURIComponent(userInfo.email)}`);

  } catch (err) {
    console.error("Error in Calendar OAuth callback:", err);
    res.redirect(`${process.env.FRONTEND_URL}/auth/calendar/callback?error=${encodeURIComponent(err.message)}`);
  }
});

// Check Calendar connection status (REQUIRES AUTHENTICATION)
router.get('/auth/calendar/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log('[Calendar Status] Checking status for user:', userId);

    const { data: tokenRow, error } = await supabase
      .from("calendar_tokens")
      .select("email, name, picture, created_at, updated_at, scope")
      .eq("user_id", userId)
      .single();

    console.log('[Calendar Status] Query result:', { tokenRow, error });

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned - not connected
        console.log('[Calendar Status] No tokens found for user');
        return res.json({
          connected: false,
          message: "Calendar not connected"
        });
      }
      
      console.error('[Calendar Status] Database error:', error);
      return res.json({
        connected: false,
        message: "Error checking connection",
        error: error.message
      });
    }

    if (!tokenRow) {
      console.log('[Calendar Status] Token row is null');
      return res.json({
        connected: false,
        message: "Calendar not connected"
      });
    }

    console.log('[Calendar Status] User is connected:', tokenRow.email);
    res.json({
      connected: true,
      email: tokenRow.email,
      name: tokenRow.name,
      picture: tokenRow.picture,
      connectedAt: tokenRow.created_at,
      lastUpdated: tokenRow.updated_at,
      scopes: tokenRow.scope ? tokenRow.scope.split(' ') : SCOPES
    });

  } catch (err) {
    console.error("Error checking Calendar status:", err);
    res.status(500).json({ 
      connected: false,
      error: "Failed to check Calendar connection status",
      details: err.message
    });
  }
});

// Disconnect Calendar (REQUIRES AUTHENTICATION)
router.post('/auth/calendar/disconnect', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get tokens before deleting
    const { data: tokenRow } = await supabase
      .from("calendar_tokens")
      .select("access_token")
      .eq("user_id", userId)
      .single();

    if (tokenRow && tokenRow.access_token) {
      // Revoke the token with Google
      try {
        await oauth2Client.revokeToken(tokenRow.access_token);
      } catch (revokeError) {
        console.error("Error revoking token:", revokeError);
        // Continue with deletion even if revocation fails
      }
    }

    // Delete tokens from database
    const { error } = await supabase
      .from("calendar_tokens")
      .delete()
      .eq("user_id", userId);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: "Calendar disconnected successfully"
    });

  } catch (err) {
    console.error("Error disconnecting Calendar:", err);
    res.status(500).json({ 
      error: "Failed to disconnect Calendar",
      message: err.message
    });
  }
});

// Refresh Calendar tokens (REQUIRES AUTHENTICATION)
router.post('/auth/calendar/refresh', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: tokenRow, error } = await supabase
      .from("calendar_tokens")
      .select("refresh_token")
      .eq("user_id", userId)
      .single();

    if (error || !tokenRow || !tokenRow.refresh_token) {
      return res.status(404).json({ 
        error: "No refresh token found. Please reconnect Calendar." 
      });
    }

    // Set credentials and refresh
    oauth2Client.setCredentials({
      refresh_token: tokenRow.refresh_token
    });

    const { credentials } = await oauth2Client.refreshAccessToken();

    // Update tokens in database
    await supabase
      .from("calendar_tokens")
      .update({
        access_token: credentials.access_token,
        expiry_date: credentials.expiry_date,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", userId);

    res.json({
      success: true,
      message: "Calendar tokens refreshed successfully",
      expiryDate: credentials.expiry_date
    });

  } catch (err) {
    console.error("Error refreshing Calendar tokens:", err);
    res.status(500).json({ 
      error: "Failed to refresh Calendar tokens",
      message: err.message
    });
  }
});

module.exports = router;
