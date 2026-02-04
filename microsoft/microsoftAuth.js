/**
 * Microsoft 365 OAuth Authentication
 * 
 * Handles OAuth2 flow for Microsoft 365 apps (Outlook, Calendar, OneDrive, Excel)
 * Similar to Google OAuth flow but using Microsoft Identity Platform
 * 
 * Each app has specific scopes:
 * - Outlook: Mail.Read, Mail.ReadWrite, Mail.Send
 * - Calendar: Calendars.Read, Calendars.ReadWrite
 * - OneDrive: Files.Read, Files.ReadWrite
 * - Excel: Files.ReadWrite (via OneDrive APIs)
 */

const express = require('express');
const axios = require('axios');
const supabase = require('../supabase/supabaseConnect');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Microsoft OAuth Configuration
const MICROSOFT_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const MICROSOFT_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const MICROSOFT_GRAPH_URL = 'https://graph.microsoft.com/v1.0';

// Scopes per app - following Microsoft Graph permission model
const APP_SCOPES = {
  outlook: [
    'Mail.Read',
    'Mail.ReadWrite', 
    'Mail.Send',
    'User.Read',
    'offline_access',
    'openid',
    'profile'
  ],
  calendar: [
    'Calendars.Read',
    'Calendars.ReadWrite',
    'User.Read',
    'offline_access',
    'openid',
    'profile'
  ],
  onedrive: [
    'Files.Read',
    'Files.ReadWrite',
    'User.Read',
    'offline_access',
    'openid',
    'profile'
  ],
  excel: [
    'Files.ReadWrite',
    'User.Read',
    'offline_access',
    'openid',
    'profile'
  ],
  teams: [
    'Chat.Read',
    'Chat.ReadWrite',
    'ChannelMessage.Read.All',
    'Team.ReadBasic.All',
    'User.Read',
    'offline_access',
    'openid',
    'profile'
  ],
  word: [
    'Files.ReadWrite',
    'User.Read',
    'offline_access',
    'openid',
    'profile'
  ]
};

// All possible Microsoft scopes (union of all apps)
const ALL_SCOPES = [
  'Mail.Read',
  'Mail.ReadWrite',
  'Mail.Send',
  'Calendars.Read',
  'Calendars.ReadWrite',
  'Files.Read',
  'Files.ReadWrite',
  'Chat.Read',
  'Chat.ReadWrite',
  'ChannelMessage.Read.All',
  'Team.ReadBasic.All',
  'User.Read',
  'offline_access',
  'openid',
  'profile'
];

/**
 * Generate Microsoft OAuth URL for a specific app
 * @param {string} app - The app to connect (outlook, calendar, onedrive, excel)
 * @param {string} state - Base64 encoded state with user_id
 * @returns {string} OAuth authorization URL
 */
function generateAuthUrl(app, state) {
  const scopes = APP_SCOPES[app] || APP_SCOPES.outlook;
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID,
    response_type: 'code',
    redirect_uri: process.env.MICROSOFT_REDIRECT_URI,
    response_mode: 'query',
    scope: scopes.join(' '),
    state: state,
    prompt: 'consent' // Force consent to get refresh token
  });

  return `${MICROSOFT_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 * @param {string} code - Authorization code from callback
 * @returns {object} Token response
 */
async function exchangeCodeForTokens(code) {
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID,
    client_secret: process.env.MICROSOFT_CLIENT_SECRET,
    code: code,
    redirect_uri: process.env.MICROSOFT_REDIRECT_URI,
    grant_type: 'authorization_code'
  });

  const response = await axios.post(MICROSOFT_TOKEN_URL, params, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });

  return response.data;
}

/**
 * Refresh Microsoft access token
 * @param {string} refreshToken - Refresh token
 * @returns {object} New token response
 */
async function refreshAccessToken(refreshToken) {
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID,
    client_secret: process.env.MICROSOFT_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: ALL_SCOPES.join(' ')
  });

  const response = await axios.post(MICROSOFT_TOKEN_URL, params, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });

  return response.data;
}

/**
 * Get user profile from Microsoft Graph
 * @param {string} accessToken - Access token
 * @returns {object} User profile
 */
async function getUserProfile(accessToken) {
  const response = await axios.get(`${MICROSOFT_GRAPH_URL}/me`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  return response.data;
}

/**
 * Check which apps are connected based on granted scopes
 * @param {string[]} grantedScopes - Array of granted scopes
 * @returns {object} Connected apps status
 */
function getConnectedApps(grantedScopes) {
  const scopeSet = new Set(grantedScopes.map(s => s.toLowerCase()));
  
  // Debug logging to see what scopes are actually granted
  console.log('[Microsoft] Checking connected apps with scopes:', Array.from(scopeSet));
  
  // Check for Teams scopes (case-insensitive)
  const hasTeamsScope = Array.from(scopeSet).some(s => 
    s.includes('chat.read') || s.includes('team.read') || s.includes('channelmessage')
  );
  
  return {
    outlook: scopeSet.has('mail.read') && scopeSet.has('mail.readwrite') && scopeSet.has('mail.send'),
    calendar: scopeSet.has('calendars.read') && scopeSet.has('calendars.readwrite'),
    onedrive: scopeSet.has('files.read') && scopeSet.has('files.readwrite'),
    excel: scopeSet.has('files.readwrite'),
    // Teams: check for any Teams-related scope
    teams: hasTeamsScope,
    word: scopeSet.has('files.readwrite')
  };
}

/**
 * Required scopes for each app (minimum required)
 */
function getRequiredScopes(app) {
  switch (app) {
    case 'outlook':
      return ['Mail.Read', 'Mail.ReadWrite', 'Mail.Send'];
    case 'calendar':
      return ['Calendars.Read', 'Calendars.ReadWrite'];
    case 'onedrive':
      return ['Files.Read', 'Files.ReadWrite'];
    case 'excel':
      return ['Files.ReadWrite'];
    case 'teams':
      return ['Chat.Read', 'Chat.ReadWrite', 'ChannelMessage.Read.All', 'Team.ReadBasic.All'];
    case 'word':
      return ['Files.ReadWrite'];
    default:
      return [];
  }
}

/**
 * Check if specific app scopes are granted
 * @param {string[]} grantedScopes - Array of granted scopes  
 * @param {string} app - App to check
 * @returns {boolean} Whether app is connected
 */
function isAppConnected(grantedScopes, app) {
  const required = getRequiredScopes(app);
  const scopeSet = new Set(grantedScopes.map(s => s.toLowerCase()));
  return required.every(s => scopeSet.has(s.toLowerCase()));
}

// ============ ROUTES ============

/**
 * GET /auth/microsoft/:app/start
 * Start OAuth flow for a specific Microsoft app
 */
router.get('/auth/microsoft/:app/start', authenticateToken, (req, res) => {
  try {
    const { app } = req.params;
    
    // Validate app parameter
    if (!['outlook', 'calendar', 'onedrive', 'excel', 'teams', 'word'].includes(app)) {
      return res.status(400).json({ 
        error: 'Invalid app', 
        message: 'App must be one of: outlook, calendar, onedrive, excel, teams, word' 
      });
    }

    if (!req.user || !req.user.id) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'You must be signed in to connect Microsoft apps'
      });
    }

    // Create state with user info and app
    const state = Buffer.from(JSON.stringify({
      user_id: req.user.id,
      app: app,
      timestamp: Date.now()
    })).toString('base64');

    const authUrl = generateAuthUrl(app, state);
    res.redirect(authUrl);
  } catch (err) {
    console.error('Microsoft OAuth start error:', err);
    res.status(500).json({ error: 'Failed to start Microsoft OAuth' });
  }
});

/**
 * GET /auth/microsoft/:app/url
 * Get OAuth URL without redirecting (for frontend use)
 */
router.get('/auth/microsoft/:app/url', authenticateToken, (req, res) => {
  try {
    const { app } = req.params;
    
    if (!['outlook', 'calendar', 'onedrive', 'excel', 'teams', 'word'].includes(app)) {
      return res.status(400).json({ 
        error: 'Invalid app',
        message: 'App must be one of: outlook, calendar, onedrive, excel, teams, word'
      });
    }

    if (!req.user || !req.user.id) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'You must be signed in to connect Microsoft apps'
      });
    }

    const state = Buffer.from(JSON.stringify({
      user_id: req.user.id,
      app: app,
      timestamp: Date.now()
    })).toString('base64');

    const authUrl = generateAuthUrl(app, state);
    
    res.json({
      authUrl: authUrl,
      app: app,
      scopes: APP_SCOPES[app],
      user_id: req.user.id,
      message: `Microsoft ${app} OAuth URL generated`
    });
  } catch (err) {
    console.error('Microsoft OAuth URL error:', err);
    res.status(500).json({ error: 'Failed to generate Microsoft OAuth URL' });
  }
});

/**
 * GET /auth/microsoft/callback
 * Handle OAuth callback from Microsoft
 */
router.get('/auth/microsoft/callback', async (req, res) => {
  const { code, state, error: oauthError, error_description } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';

  // Handle OAuth errors
  if (oauthError) {
    console.error('Microsoft OAuth error:', oauthError, error_description);
    return res.redirect(
      `${frontendUrl}/auth/microsoft/callback?error=${encodeURIComponent(oauthError)}&error_description=${encodeURIComponent(error_description || '')}`
    );
  }

  if (!code) {
    return res.redirect(
      `${frontendUrl}/auth/microsoft/callback?error=no_code&error_description=${encodeURIComponent('Authorization code not provided')}`
    );
  }

  // Decode state
  let userId = null;
  let app = null;
  
  if (state) {
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
      userId = stateData.user_id;
      app = stateData.app;
    } catch (e) {
      console.error('Error decoding state:', e);
    }
  }

  if (!userId) {
    return res.redirect(
      `${frontendUrl}/auth/microsoft/callback?error=invalid_state&error_description=${encodeURIComponent('User ID not found in state')}`
    );
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await exchangeCodeForTokens(code);
    const { access_token, refresh_token, expires_in, scope } = tokenResponse;

    // Get user profile
    const profile = await getUserProfile(access_token);

    // Parse granted scopes from response
    const returnedScopes = scope ? scope.split(' ') : [];
    
    console.log('[Microsoft OAuth] App being connected:', app);
    console.log('[Microsoft OAuth] Scopes returned by Microsoft:', returnedScopes);
    
    // Get the scopes we requested for this app
    const requestedScopes = APP_SCOPES[app] || [];
    console.log('[Microsoft OAuth] Scopes we requested:', requestedScopes);
    
    // Combine returned scopes with requested scopes
    // Microsoft sometimes doesn't return all granted scopes in the response
    const grantedScopes = [...new Set([...returnedScopes, ...requestedScopes])];
    console.log('[Microsoft OAuth] Combined granted scopes:', grantedScopes);
    
    // Calculate expiry
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    // Check existing tokens for this user
    const { data: existingToken, error: fetchError } = await supabase
      .from('microsoft_tokens')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Merge scopes if user already has some connected
    let mergedScopes = grantedScopes;
    if (existingToken && existingToken.granted_scopes) {
      const existingScopes = existingToken.granted_scopes;
      const scopeSet = new Set([...existingScopes, ...grantedScopes]);
      mergedScopes = Array.from(scopeSet);
      console.log('[Microsoft OAuth] Merged with existing scopes:', mergedScopes);
    }

    // Determine connected apps from merged scopes
    const connectedApps = getConnectedApps(mergedScopes);
    console.log('[Microsoft OAuth] Connected apps result:', connectedApps);

    // Prepare token data
    const tokenData = {
      user_id: userId,
      access_token: access_token,
      refresh_token: refresh_token || (existingToken ? existingToken.refresh_token : null),
      expires_at: expiresAt,
      granted_scopes: mergedScopes,
      email: profile.mail || profile.userPrincipalName,
      name: profile.displayName,
      microsoft_id: profile.id,
      connected_apps: connectedApps,
      updated_at: new Date().toISOString()
    };

    if (existingToken) {
      // Update existing token
      const { error: updateError } = await supabase
        .from('microsoft_tokens')
        .update(tokenData)
        .eq('user_id', userId);

      if (updateError) throw updateError;
    } else {
      // Insert new token
      tokenData.created_at = new Date().toISOString();
      const { error: insertError } = await supabase
        .from('microsoft_tokens')
        .insert([tokenData]);

      if (insertError) throw insertError;
    }

    console.log(`Microsoft tokens saved for user ${userId} (${profile.mail || profile.userPrincipalName})`);
    console.log('Connected apps:', connectedApps);

    // Redirect to frontend with success
    res.redirect(
      `${frontendUrl}/auth/microsoft/callback?success=true&app=${app}&email=${encodeURIComponent(profile.mail || profile.userPrincipalName)}`
    );

  } catch (err) {
    console.error('Microsoft OAuth callback error:', err);
    res.redirect(
      `${frontendUrl}/auth/microsoft/callback?error=callback_failed&error_description=${encodeURIComponent(err.message)}`
    );
  }
});

/**
 * GET /auth/microsoft/status
 * Get Microsoft connection status for all apps
 */
router.get('/auth/microsoft/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: tokenRow, error } = await supabase
      .from('microsoft_tokens')
      .select('email, name, microsoft_id, granted_scopes, connected_apps, created_at, updated_at, expires_at')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No tokens found
        return res.json({
          connected: false,
          apps: {
            outlook: false,
            calendar: false,
            onedrive: false,
            excel: false,
            teams: false,
            word: false
          }
        });
      }
      throw error;
    }

    if (!tokenRow) {
      return res.json({
        connected: false,
        apps: {
          outlook: false,
          calendar: false,
          onedrive: false,
          excel: false,
          teams: false,
          word: false
        }
      });
    }

    // Recalculate connected apps from scopes (in case of updates)
    const connectedApps = getConnectedApps(tokenRow.granted_scopes || []);

    res.json({
      connected: true,
      email: tokenRow.email,
      name: tokenRow.name,
      microsoftId: tokenRow.microsoft_id,
      apps: connectedApps,
      grantedScopes: tokenRow.granted_scopes,
      connectedAt: tokenRow.created_at,
      lastUpdated: tokenRow.updated_at,
      expiresAt: tokenRow.expires_at
    });

  } catch (err) {
    console.error('Error checking Microsoft status:', err);
    res.status(500).json({
      connected: false,
      error: 'Failed to check Microsoft connection status',
      details: err.message
    });
  }
});

/**
 * POST /auth/microsoft/disconnect
 * Disconnect all Microsoft apps
 */
router.post('/auth/microsoft/disconnect', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Delete tokens from database
    const { error } = await supabase
      .from('microsoft_tokens')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Microsoft apps disconnected successfully'
    });

  } catch (err) {
    console.error('Error disconnecting Microsoft:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to disconnect Microsoft apps',
      message: err.message
    });
  }
});

/**
 * POST /auth/microsoft/disconnect/:app
 * Disconnect a specific Microsoft app (remove its scopes)
 */
router.post('/auth/microsoft/disconnect/:app', authenticateToken, async (req, res) => {
  try {
    const { app } = req.params;
    const userId = req.user.id;

    if (!['outlook', 'calendar', 'onedrive', 'excel', 'teams', 'word'].includes(app)) {
      return res.status(400).json({ 
        error: 'Invalid app',
        message: 'App must be one of: outlook, calendar, onedrive, excel, teams, word'
      });
    }

    // Get current tokens
    const { data: tokenRow, error: fetchError } = await supabase
      .from('microsoft_tokens')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (fetchError || !tokenRow) {
      return res.status(404).json({
        success: false,
        error: 'Microsoft not connected'
      });
    }

    // Remove scopes for this app
    const scopesToRemove = getRequiredScopes(app);
    const remainingScopes = (tokenRow.granted_scopes || []).filter(
      s => !scopesToRemove.some(r => r.toLowerCase() === s.toLowerCase())
    );

    // If no scopes remain, delete the entire record
    if (remainingScopes.length === 0 || 
        remainingScopes.every(s => ['user.read', 'offline_access', 'openid', 'profile'].includes(s.toLowerCase()))) {
      const { error: deleteError } = await supabase
        .from('microsoft_tokens')
        .delete()
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      return res.json({
        success: true,
        message: 'All Microsoft apps disconnected',
        apps: {
          outlook: false,
          calendar: false,
          onedrive: false,
          excel: false,
          teams: false,
          word: false
        }
      });
    }

    // Update with remaining scopes
    const connectedApps = getConnectedApps(remainingScopes);

    const { error: updateError } = await supabase
      .from('microsoft_tokens')
      .update({
        granted_scopes: remainingScopes,
        connected_apps: connectedApps,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (updateError) throw updateError;

    res.json({
      success: true,
      message: `Microsoft ${app} disconnected`,
      apps: connectedApps
    });

  } catch (err) {
    console.error('Error disconnecting Microsoft app:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to disconnect Microsoft app',
      message: err.message
    });
  }
});

/**
 * POST /auth/microsoft/refresh
 * Refresh Microsoft access token
 */
router.post('/auth/microsoft/refresh', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: tokenRow, error } = await supabase
      .from('microsoft_tokens')
      .select('refresh_token, granted_scopes')
      .eq('user_id', userId)
      .single();

    if (error || !tokenRow || !tokenRow.refresh_token) {
      return res.status(404).json({
        error: 'No refresh token found. Please reconnect Microsoft apps.'
      });
    }

    // Refresh the token
    const newTokens = await refreshAccessToken(tokenRow.refresh_token);
    const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();

    // Update tokens in database
    await supabase
      .from('microsoft_tokens')
      .update({
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token || tokenRow.refresh_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    res.json({
      success: true,
      message: 'Microsoft tokens refreshed successfully',
      expiresAt: expiresAt
    });

  } catch (err) {
    console.error('Error refreshing Microsoft tokens:', err);
    res.status(500).json({
      error: 'Failed to refresh Microsoft tokens',
      message: err.message
    });
  }
});

// Export router and helper functions
module.exports = {
  router,
  refreshAccessToken,
  getUserProfile,
  getConnectedApps,
  isAppConnected,
  APP_SCOPES,
  ALL_SCOPES,
  MICROSOFT_GRAPH_URL
};
