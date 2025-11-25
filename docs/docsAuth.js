const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const supabase = require('../supabase/supabaseConnect');
const { authenticateToken } = require('../middleware/auth');

// OAuth2 scopes for Google Docs
const SCOPES = [
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

// Create OAuth2 client
function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_DOCS_CLIENT_ID,
    process.env.GOOGLE_DOCS_CLIENT_SECRET,
    process.env.GOOGLE_DOCS_REDIRECT_URI
  );
}

// Generate authentication URL
function getAuthUrl(state) {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state: state,
    prompt: 'consent'
  });
}

/**
 * @route   GET /auth/docs/connect
 * @desc    Initiate OAuth flow for Google Docs
 * @access  Protected
 */
router.get('/auth/docs/connect', authenticateToken, (req, res) => {
  try {
    const state = JSON.stringify({
      user_id: req.user.id,
      timestamp: Date.now(),
      service: 'docs'
    });

    const authUrl = getAuthUrl(state);
    res.json({ authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ error: 'Failed to generate authentication URL' });
  }
});

/**
 * @route   GET /auth/docs/callback
 * @desc    Handle OAuth callback from Google
 * @access  Public
 */
router.get('/auth/docs/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    console.error('OAuth error:', error);
    return res.redirect(`${process.env.FRONTEND_URL}/docs?error=access_denied`);
  }

  if (!code || !state) {
    return res.redirect(`${process.env.FRONTEND_URL}/docs?error=missing_params`);
  }

  try {
    // Parse state to get user ID
    const stateData = JSON.parse(state);
    const userId = stateData.user_id;

    if (!userId) {
      console.error('No user_id in state');
      return res.redirect(`${process.env.FRONTEND_URL}/docs?error=missing_user_id`);
    }

    // Exchange code for tokens
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info from Google
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const userEmail = userInfo.data.email;

    // Store tokens in database
    const { data: existingToken, error: fetchError } = await supabase
      .from('docs_tokens')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (existingToken) {
      // Update existing tokens
      const { error: updateError } = await supabase
        .from('docs_tokens')
        .update({
          tokens: tokens,
          email: userEmail,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (updateError) {
        throw updateError;
      }
    } else {
      // Insert new tokens
      const { error: insertError } = await supabase
        .from('docs_tokens')
        .insert({
          user_id: userId,
          email: userEmail,
          tokens: tokens
        });

      if (insertError) {
        throw insertError;
      }
    }

    // Redirect to callback page with success
    res.redirect(`${process.env.FRONTEND_URL}/auth/docs/callback?success=true&email=${encodeURIComponent(userEmail)}`);
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    const errorMessage = error.message || 'oauth_failed';
    res.redirect(`${process.env.FRONTEND_URL}/auth/docs/callback?error=${encodeURIComponent(errorMessage)}`);
  }
});

/**
 * @route   GET /docs/status
 * @desc    Check if user has connected Google Docs
 * @access  Protected
 */
router.get('/docs/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('docs_tokens')
      .select('email, created_at')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return res.json({ connected: false });
    }

    res.json({
      connected: true,
      email: data.email,
      connectedAt: data.created_at
    });
  } catch (error) {
    console.error('Error checking Docs status:', error);
    res.status(500).json({ error: 'Failed to check connection status' });
  }
});

/**
 * @route   DELETE /auth/docs/disconnect
 * @desc    Disconnect Google Docs (remove tokens)
 * @access  Protected
 */
router.delete('/auth/docs/disconnect', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get tokens before deleting to revoke them
    const { data: tokenData } = await supabase
      .from('docs_tokens')
      .select('tokens')
      .eq('user_id', userId)
      .single();

    // Revoke tokens with Google
    if (tokenData && tokenData.tokens && tokenData.tokens.access_token) {
      try {
        const oauth2Client = getOAuth2Client();
        oauth2Client.setCredentials(tokenData.tokens);
        await oauth2Client.revokeCredentials();
      } catch (revokeError) {
        console.error('Error revoking tokens:', revokeError);
        // Continue with deletion even if revocation fails
      }
    }

    // Delete tokens from database
    const { error } = await supabase
      .from('docs_tokens')
      .delete()
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    res.json({ success: true, message: 'Successfully disconnected Google Docs' });
  } catch (error) {
    console.error('Error disconnecting Docs:', error);
    res.status(500).json({ error: 'Failed to disconnect Google Docs' });
  }
});

/**
 * Get OAuth2 client with user's tokens
 * Used by other modules
 */
async function getAuthenticatedClient(userId) {
  try {
    const { data, error } = await supabase
      .from('docs_tokens')
      .select('tokens')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      throw new Error('No Google Docs connection found for this user');
    }

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials(data.tokens);

    // Set up automatic token refresh
    oauth2Client.on('tokens', async (tokens) => {
      if (tokens.refresh_token) {
        // Store the new refresh token
        await supabase
          .from('docs_tokens')
          .update({ tokens: tokens })
          .eq('user_id', userId);
      }
    });

    return oauth2Client;
  } catch (error) {
    console.error('Error getting authenticated client:', error);
    throw error;
  }
}

module.exports = {
  router,
  getAuthenticatedClient,
  getOAuth2Client
};
