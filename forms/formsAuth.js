const express = require('express');
const { google } = require("googleapis");
const supabase = require('../supabase/supabaseConnect');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Define OAuth scopes for Google Forms and related services
const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/forms.body',
  'https://www.googleapis.com/auth/forms.responses.readonly',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.readonly',  // Required to list forms via Drive API
  'openid'
];

// Google OAuth client for Forms
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_FORMS_CLIENT_ID,
  process.env.GOOGLE_FORMS_CLIENT_SECRET,
  process.env.GOOGLE_FORMS_REDIRECT_URI
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
router.get('/auth/forms/connect', authenticateToken, (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ 
        error: "Authentication required", 
        message: "You must be signed in to connect Google Forms" 
      });
    }

    const state = Buffer.from(JSON.stringify({ 
      user_id: req.user.id,
      timestamp: Date.now(),
      service: 'forms'
    })).toString('base64');
    
    const url = getAuthUrl(state);
    res.redirect(url);
  } catch (err) {
    console.error("Forms OAuth URL generation error:", err);
    res.status(500).json({ error: "Failed to generate Forms OAuth URL" });
  }
});

// Get OAuth URL without redirecting (REQUIRES AUTHENTICATION)
router.get('/auth/forms/url', authenticateToken, (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ 
        error: "Authentication required", 
        message: "You must be signed in to connect Google Forms" 
      });
    }

    const state = Buffer.from(JSON.stringify({ 
      user_id: req.user.id,
      timestamp: Date.now(),
      service: 'forms'
    })).toString('base64');
    
    const url = getAuthUrl(state);
    res.json({ 
      authUrl: url,
      user_id: req.user.id,
      scopes: SCOPES,
      message: "Google Forms OAuth URL generated for authenticated user"
    });
  } catch (err) {
    console.error("Forms OAuth URL generation error:", err);
    res.status(500).json({ error: "Failed to generate Forms OAuth URL" });
  }
});

// Protected route: Get OAuth URL for authenticated users
router.get('/auth/forms/url/authenticated', authenticateToken, (req, res) => {
  try {
    const state = Buffer.from(JSON.stringify({ 
      user_id: req.user.id,
      timestamp: Date.now(),
      service: 'forms'
    })).toString('base64');
    
    const authUrl = getAuthUrl(state);
    
    res.json({ 
      authUrl,
      user_id: req.user.id,
      scopes: SCOPES
    });
  } catch (err) {
    console.error("Forms OAuth URL generation error:", err);
    res.status(500).json({ error: "Failed to generate Forms OAuth URL" });
  }
});

// Step 2: Handle OAuth callback
router.get('/auth/forms/callback', async (req, res) => {
  const { code, state, error } = req.query;
  
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';

  // Handle OAuth errors
  if (error) {
    console.error("Forms OAuth error:", error);
    return res.redirect(`${frontendUrl}/auth/forms/callback?error=${error}`);
  }

  if (!code) {
    console.error("No authorization code received");
    return res.redirect(`${frontendUrl}/auth/forms/callback?error=no_code`);
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
        return res.redirect(`${frontendUrl}/auth/forms/callback?error=invalid_state`);
      }
    }

    if (!user_id) {
      return res.redirect(`${frontendUrl}/auth/forms/callback?error=missing_user_id`);
    }

    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens.access_token) {
      console.error("No access token received");
      return res.redirect(`${frontendUrl}/auth/forms/callback?error=no_access_token`);
    }

    console.log("Forms tokens received:", {
      has_access_token: !!tokens.access_token,
      has_refresh_token: !!tokens.refresh_token,
      expiry_date: tokens.expiry_date
    });

    // Set credentials to get user info
    oauth2Client.setCredentials(tokens);
    
    // Get user info
    const oauth2 = google.oauth2({
      auth: oauth2Client,
      version: 'v2'
    });
    
    const { data: userInfo } = await oauth2.userinfo.get();
    const userEmail = userInfo.email;

    console.log("Forms user authenticated:", userEmail);

    // Check if token already exists for this user
    const { data: existingToken, error: checkError } = await supabase
      .from("forms_tokens")
      .select("*")
      .eq("user_id", user_id)
      .single();

    // Ignore error if no rows found (expected for first connection)
    if (checkError && checkError.code !== 'PGRST116') {
      console.error("Error checking existing token:", checkError);
    }

    const tokenData = {
      user_id,
      email: userEmail,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || existingToken?.refresh_token,
      expiry_date: tokens.expiry_date || null,
      scopes: SCOPES.join(',')
    };

    if (existingToken) {
      // Update existing token
      const { error: updateError } = await supabase
        .from("forms_tokens")
        .update(tokenData)
        .eq("user_id", user_id);

      if (updateError) {
        console.error("Error updating Forms tokens:", updateError);
        console.error("Update error details:", JSON.stringify(updateError, null, 2));
        return res.redirect(`${frontendUrl}/auth/forms/callback?error=token_update_failed&details=${encodeURIComponent(updateError.message || 'Unknown error')}`);
      }
      
      console.log("Forms tokens updated successfully for user:", user_id);
    } else {
      // Insert new token
      const { data: insertData, error: insertError } = await supabase
        .from("forms_tokens")
        .insert([tokenData])
        .select();

      if (insertError) {
        console.error("Error inserting Forms tokens:", insertError);
        console.error("Insert error details:", JSON.stringify(insertError, null, 2));
        console.error("Token data being inserted:", JSON.stringify({
          ...tokenData,
          access_token: '***',
          refresh_token: '***'
        }, null, 2));
        return res.redirect(`${frontendUrl}/auth/forms/callback?error=token_insert_failed&details=${encodeURIComponent(insertError.message || 'Unknown error')}`);
      }
      
      console.log("Forms tokens stored successfully for user:", user_id);
      console.log("Inserted data:", insertData);
    }

    // Redirect to frontend callback with success
    res.redirect(`${frontendUrl}/auth/forms/callback?success=true&email=${encodeURIComponent(userEmail)}`);
    
  } catch (err) {
    console.error("Forms OAuth callback error:", err);
    res.redirect(`${frontendUrl}/auth/forms/callback?error=oauth_failed&error_description=${encodeURIComponent(err.message)}`);
  }
});

// Check Forms connection status
router.get('/forms/status', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;

    const { data: tokenData, error } = await supabase
      .from("forms_tokens")
      .select("email, expiry_date, scopes")
      .eq("user_id", user_id)
      .single();

    if (error || !tokenData) {
      return res.json({ 
        connected: false,
        message: "Google Forms not connected" 
      });
    }

    // Check if token is expired
    const isExpired = tokenData.expiry_date && tokenData.expiry_date < Date.now();

    res.json({
      connected: true,
      email: tokenData.email,
      expiry: tokenData.expiry_date,
      expired: isExpired,
      scopes: tokenData.scopes ? tokenData.scopes.split(',') : []
    });

  } catch (err) {
    console.error("Error checking Forms status:", err);
    res.status(500).json({ 
      error: "Failed to check Forms connection status",
      details: err.message 
    });
  }
});

// Disconnect Forms
router.post('/forms/disconnect', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;

    // Delete tokens from database
    const { error } = await supabase
      .from("forms_tokens")
      .delete()
      .eq("user_id", user_id);

    if (error) {
      console.error("Error disconnecting Forms:", error);
      return res.status(500).json({ 
        error: "Failed to disconnect Forms",
        details: error.message 
      });
    }

    res.json({ 
      success: true,
      message: "Google Forms disconnected successfully" 
    });

  } catch (err) {
    console.error("Error disconnecting Forms:", err);
    res.status(500).json({ 
      error: "Failed to disconnect Forms",
      details: err.message 
    });
  }
});

module.exports = router;
