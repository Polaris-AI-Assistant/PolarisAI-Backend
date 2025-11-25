const express = require('express');
const { google } = require("googleapis");
const supabase = require('../supabase/supabaseConnect');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Define OAuth scopes for Google Meet
const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/meetings.space.created',
  'https://www.googleapis.com/auth/drive.readonly',
  'openid'
];

// Google OAuth client for Meet
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_MEET_CLIENT_ID,
  process.env.GOOGLE_MEET_CLIENT_SECRET,
  process.env.GOOGLE_MEET_REDIRECT_URI
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
router.get('/auth/meet/connect', authenticateToken, (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ 
        error: "Authentication required", 
        message: "You must be signed in to connect Google Meet" 
      });
    }

    const state = Buffer.from(JSON.stringify({ 
      user_id: req.user.id,
      timestamp: Date.now(),
      service: 'meet'
    })).toString('base64');
    
    const url = getAuthUrl(state);
    res.redirect(url);
  } catch (err) {
    console.error("Meet OAuth URL generation error:", err);
    res.status(500).json({ error: "Failed to generate Meet OAuth URL" });
  }
});

// Get OAuth URL without redirecting (REQUIRES AUTHENTICATION)
router.get('/auth/meet/url', authenticateToken, (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ 
        error: "Authentication required", 
        message: "You must be signed in to connect Google Meet" 
      });
    }

    const state = Buffer.from(JSON.stringify({ 
      user_id: req.user.id,
      timestamp: Date.now(),
      service: 'meet'
    })).toString('base64');
    
    const url = getAuthUrl(state);
    res.json({ 
      authUrl: url,
      user_id: req.user.id,
      scopes: SCOPES,
      message: "Google Meet OAuth URL generated for authenticated user"
    });
  } catch (err) {
    console.error("Meet OAuth URL generation error:", err);
    res.status(500).json({ error: "Failed to generate Meet OAuth URL" });
  }
});

// Protected route: Get OAuth URL for authenticated users
router.get('/auth/meet/url/authenticated', authenticateToken, (req, res) => {
  try {
    const state = Buffer.from(JSON.stringify({ 
      user_id: req.user.id,
      timestamp: Date.now(),
      service: 'meet'
    })).toString('base64');
    
    const authUrl = getAuthUrl(state);
    
    res.json({ 
      authUrl,
      user_id: req.user.id,
      scopes: SCOPES
    });
  } catch (err) {
    console.error("Meet OAuth URL generation error:", err);
    res.status(500).json({ error: "Failed to generate Meet OAuth URL" });
  }
});

// Step 2: Handle OAuth callback
router.get('/auth/meet/callback', async (req, res) => {
  const { code, state, error } = req.query;
  
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';

  // Handle OAuth errors
  if (error) {
    console.error("Meet OAuth error:", error);
    return res.redirect(`${frontendUrl}/auth/meet/callback?error=${error}`);
  }

  if (!code) {
    console.error("No authorization code received");
    return res.redirect(`${frontendUrl}/auth/meet/callback?error=no_code`);
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
        return res.redirect(`${frontendUrl}/auth/meet/callback?error=invalid_state`);
      }
    }

    if (!user_id) {
      console.error("No user_id in state");
      return res.redirect(`${frontendUrl}/auth/meet/callback?error=no_user_id`);
    }

    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    console.log("Tokens received:", { 
      has_access_token: !!tokens.access_token,
      has_refresh_token: !!tokens.refresh_token 
    });

    // Set credentials
    oauth2Client.setCredentials(tokens);

    // Get user info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const userEmail = userInfo.data.email;

    console.log("User email:", userEmail);

    // Check if token already exists
    const { data: existingToken, error: fetchError } = await supabase
      .from("meet_tokens")
      .select("*")
      .eq("user_id", user_id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error("Error fetching existing token:", fetchError);
      throw fetchError;
    }

    if (existingToken) {
      // Update existing token
      const { error: updateError } = await supabase
        .from("meet_tokens")
        .update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || existingToken.refresh_token,
          expiry_date: tokens.expiry_date || null,
          email: userEmail,
          updated_at: new Date().toISOString()
        })
        .eq("user_id", user_id);

      if (updateError) {
        console.error("Error updating Meet tokens:", updateError);
        throw updateError;
      }
      console.log("Meet tokens updated successfully");
    } else {
      // Insert new token
      const { error: insertError } = await supabase
        .from("meet_tokens")
        .insert({
          user_id: user_id,
          email: userEmail,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expiry_date: tokens.expiry_date || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (insertError) {
        console.error("Error inserting Meet tokens:", insertError);
        throw insertError;
      }
      console.log("Meet tokens inserted successfully");
    }

    // Redirect to success page
    res.redirect(`${frontendUrl}/meet?connected=true`);

  } catch (err) {
    console.error("Error in Meet OAuth callback:", err);
    res.redirect(`${frontendUrl}/meet?error=auth_failed`);
  }
});

// Check connection status (REQUIRES AUTHENTICATION)
router.get('/auth/meet/status', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;

    const { data: tokenRow, error } = await supabase
      .from("meet_tokens")
      .select("email, created_at, updated_at")
      .eq("user_id", user_id)
      .single();

    if (error || !tokenRow) {
      return res.json({
        connected: false,
        message: "Google Meet not connected"
      });
    }

    res.json({
      connected: true,
      email: tokenRow.email,
      connectedAt: tokenRow.created_at,
      lastUpdated: tokenRow.updated_at,
      scopes: SCOPES
    });

  } catch (err) {
    console.error("Error checking Meet status:", err);
    res.status(500).json({
      connected: false,
      error: "Failed to check connection status"
    });
  }
});

// Disconnect Google Meet (REQUIRES AUTHENTICATION)
router.post('/auth/meet/disconnect', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;

    // Get tokens before deleting
    const { data: tokenRow, error: fetchError } = await supabase
      .from("meet_tokens")
      .select("access_token")
      .eq("user_id", user_id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    // Revoke Google OAuth token
    if (tokenRow && tokenRow.access_token) {
      try {
        await oauth2Client.revokeToken(tokenRow.access_token);
        console.log("Google Meet token revoked successfully");
      } catch (revokeError) {
        console.error("Error revoking token (continuing anyway):", revokeError);
      }
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from("meet_tokens")
      .delete()
      .eq("user_id", user_id);

    if (deleteError) {
      throw deleteError;
    }

    res.json({
      success: true,
      message: "Google Meet disconnected successfully"
    });

  } catch (err) {
    console.error("Error disconnecting Meet:", err);
    res.status(500).json({
      success: false,
      error: "Failed to disconnect Google Meet"
    });
  }
});

module.exports = router;
