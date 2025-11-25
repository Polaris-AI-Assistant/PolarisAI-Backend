const express = require('express');
const { google } = require("googleapis");
const supabase = require('../supabase/supabaseConnect');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Define OAuth scopes for Google Sheets
const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'openid'
];

// Google OAuth client for Sheets
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_SHEETS_CLIENT_ID,
  process.env.GOOGLE_SHEETS_CLIENT_SECRET,
  process.env.GOOGLE_SHEETS_REDIRECT_URI
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
router.get('/auth/sheets/connect', authenticateToken, (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ 
        error: "Authentication required", 
        message: "You must be signed in to connect Google Sheets" 
      });
    }

    const state = Buffer.from(JSON.stringify({ 
      user_id: req.user.id,
      timestamp: Date.now(),
      service: 'sheets'
    })).toString('base64');
    
    const url = getAuthUrl(state);
    res.redirect(url);
  } catch (err) {
    console.error("Sheets OAuth URL generation error:", err);
    res.status(500).json({ error: "Failed to generate Sheets OAuth URL" });
  }
});

// Get OAuth URL without redirecting (REQUIRES AUTHENTICATION)
router.get('/auth/sheets/url', authenticateToken, (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ 
        error: "Authentication required", 
        message: "You must be signed in to connect Google Sheets" 
      });
    }

    const state = Buffer.from(JSON.stringify({ 
      user_id: req.user.id,
      timestamp: Date.now(),
      service: 'sheets'
    })).toString('base64');
    
    const url = getAuthUrl(state);
    res.json({ 
      authUrl: url,
      user_id: req.user.id,
      scopes: SCOPES,
      message: "Google Sheets OAuth URL generated for authenticated user"
    });
  } catch (err) {
    console.error("Sheets OAuth URL generation error:", err);
    res.status(500).json({ error: "Failed to generate Sheets OAuth URL" });
  }
});

// Protected route: Get OAuth URL for authenticated users
router.get('/auth/sheets/url/authenticated', authenticateToken, (req, res) => {
  try {
    const state = Buffer.from(JSON.stringify({ 
      user_id: req.user.id,
      timestamp: Date.now(),
      service: 'sheets'
    })).toString('base64');
    
    const authUrl = getAuthUrl(state);
    
    res.json({ 
      authUrl,
      user_id: req.user.id,
      scopes: SCOPES
    });
  } catch (err) {
    console.error("Sheets OAuth URL generation error:", err);
    res.status(500).json({ error: "Failed to generate Sheets OAuth URL" });
  }
});

// Step 2: Handle OAuth callback
router.get('/auth/sheets/callback', async (req, res) => {
  const { code, state, error } = req.query;
  
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';

  // Handle OAuth errors
  if (error) {
    console.error("Sheets OAuth error:", error);
    return res.redirect(`${frontendUrl}/auth/sheets/callback?error=${error}`);
  }

  if (!code) {
    console.error("No authorization code received");
    return res.redirect(`${frontendUrl}/auth/sheets/callback?error=no_code`);
  }

  try {
    // Decode state to get user_id
    let user_id;
    if (state) {
      try {
        const decodedState = JSON.parse(Buffer.from(state, 'base64').toString());
        user_id = decodedState.user_id;
        console.log("Decoded state - user_id:", user_id);
      } catch (err) {
        console.error("Failed to decode state:", err);
        return res.redirect(`${frontendUrl}/auth/sheets/callback?error=invalid_state`);
      }
    }

    if (!user_id) {
      console.error("No user_id in state");
      return res.redirect(`${frontendUrl}/auth/sheets/callback?error=no_user_id`);
    }

    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    console.log("Received tokens:", { 
      has_access_token: !!tokens.access_token, 
      has_refresh_token: !!tokens.refresh_token,
      expiry_date: tokens.expiry_date 
    });

    if (!tokens.access_token) {
      console.error("No access token received");
      return res.redirect(`${frontendUrl}/auth/sheets/callback?error=no_access_token`);
    }

    // Set credentials to get user info
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const email = userInfo.data.email;

    console.log("User email:", email);

    // Check if user already has Sheets tokens
    const { data: existingToken, error: fetchError } = await supabase
      .from("sheets_tokens")
      .select("*")
      .eq("user_id", user_id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error("Database fetch error:", fetchError);
      return res.redirect(`${frontendUrl}/auth/sheets/callback?error=db_fetch_error`);
    }

    // Prepare token data
    const tokenData = {
      user_id,
      email,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || (existingToken?.refresh_token) || null,
      expiry_date: tokens.expiry_date || null,
      scope: SCOPES.join(' '),
      token_type: tokens.token_type || 'Bearer',
      updated_at: new Date().toISOString()
    };

    let dbOperation;
    if (existingToken) {
      // Update existing token
      dbOperation = await supabase
        .from("sheets_tokens")
        .update(tokenData)
        .eq("user_id", user_id);
    } else {
      // Insert new token
      tokenData.created_at = new Date().toISOString();
      dbOperation = await supabase
        .from("sheets_tokens")
        .insert(tokenData);
    }

    if (dbOperation.error) {
      console.error("Database operation error:", dbOperation.error);
      return res.redirect(`${frontendUrl}/auth/sheets/callback?error=db_save_error`);
    }

    console.log("Sheets tokens saved successfully for user:", user_id);

    // Redirect to frontend with success
    const encodedEmail = encodeURIComponent(email);
    res.redirect(`${frontendUrl}/auth/sheets/callback?success=true&email=${encodedEmail}`);

  } catch (err) {
    console.error("Sheets OAuth callback error:", err);
    res.redirect(`${frontendUrl}/auth/sheets/callback?error=${encodeURIComponent(err.message)}`);
  }
});

// Check Sheets connection status
router.get('/sheets/status', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;

    // Check if user has Sheets tokens
    const { data: tokenRow, error } = await supabase
      .from("sheets_tokens")
      .select("email, expiry_date, scope, created_at")
      .eq("user_id", user_id)
      .single();

    if (error || !tokenRow) {
      return res.json({
        connected: false,
        message: "Google Sheets not connected"
      });
    }

    // Check if token is expired
    const now = Date.now();
    const isExpired = tokenRow.expiry_date && now >= tokenRow.expiry_date;

    res.json({
      connected: true,
      email: tokenRow.email,
      expiry: tokenRow.expiry_date ? new Date(tokenRow.expiry_date).toISOString() : null,
      expired: isExpired,
      scopes: tokenRow.scope?.split(' ') || [],
      connectedAt: tokenRow.created_at
    });

  } catch (err) {
    console.error("Error checking Sheets status:", err);
    res.status(500).json({
      connected: false,
      error: "Failed to check Sheets connection status"
    });
  }
});

// Disconnect Sheets
router.post('/auth/sheets/disconnect', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;

    // Delete user's Sheets tokens
    const { error } = await supabase
      .from("sheets_tokens")
      .delete()
      .eq("user_id", user_id);

    if (error) {
      console.error("Error disconnecting Sheets:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to disconnect Google Sheets"
      });
    }

    res.json({
      success: true,
      message: "Google Sheets disconnected successfully"
    });

  } catch (err) {
    console.error("Error in Sheets disconnect:", err);
    res.status(500).json({
      success: false,
      error: "Failed to disconnect Google Sheets"
    });
  }
});

module.exports = router;
