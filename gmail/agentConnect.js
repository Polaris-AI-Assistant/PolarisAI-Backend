const express = require('express');
const { google } = require("googleapis");
const supabase = require('../supabase/supabaseConnect');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Define OAuth scopes - Extended for full Gmail agent functionality
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.insert',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/gmail.settings.basic',
  'https://www.googleapis.com/auth/gmail.settings.sharing',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'openid'
];

// Google OAuth client
const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI
);

// Generate the consent screen URL
function getAuthUrl() {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',   // ensures refresh_token is returned
    prompt: 'consent',        // forces Google to re-ask for permissions
    scope: SCOPES
  });
}

// Step 1: Generate OAuth URL
router.get('/auth/gmail', (req, res) => {
  try {
    const url = getAuthUrl();
    res.redirect(url);
  } catch (err) {
    console.error("OAuth URL generation error:", err);
    res.status(500).json({ error: "Failed to generate OAuth URL" });
  }
});

// Get OAuth URL without redirecting (for frontend use)
router.get('/auth/gmail/url', (req, res) => {
  try {
    const url = getAuthUrl();
    res.json({ authUrl: url });
  } catch (err) {
    console.error("OAuth URL generation error:", err);
    res.status(500).json({ error: "Failed to generate OAuth URL" });
  }
});

// Protected route: Get OAuth URL for authenticated users
router.get('/auth/gmail/url/authenticated', authenticateToken, (req, res) => {
  try {
    const state = Buffer.from(JSON.stringify({ 
      user_id: req.user.id,
      timestamp: Date.now()
    })).toString('base64');
    
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: SCOPES,
      state: state
    });
    
    res.json({ 
      authUrl: url,
      user_id: req.user.id,
      message: "Gmail OAuth URL generated for authenticated user"
    });
  } catch (err) {
    console.error("OAuth URL generation error:", err);
    res.status(500).json({ error: "Failed to generate OAuth URL" });
  }
});

// Step 2: Handle Callback
router.get('/auth/gmail/callback', async (req, res) => {
  const { code, error: oauthError, error_description, state } = req.query;

  // Get frontend URL from environment variable
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';

  // Handle OAuth errors
  if (oauthError) {
    // Redirect to frontend callback with error
    const errorUrl = `${frontendUrl}/auth/gmail/callback?error=${encodeURIComponent(oauthError)}&error_description=${encodeURIComponent(error_description || 'Authorization failed')}`;
    return res.redirect(errorUrl);
  }

  if (!code) {
    const errorUrl = `${frontendUrl}/auth/gmail/callback?error=${encodeURIComponent('authorization_code_missing')}&error_description=${encodeURIComponent('Authorization code not provided')}`;
    return res.redirect(errorUrl);
  }

  // Extract user_id from state parameter if provided
  let authenticated_user_id = null;
  if (state) {
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      authenticated_user_id = stateData.user_id;
    } catch (parseError) {
      console.warn('Could not parse state parameter:', parseError);
    }
  }

  try {
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Validate tokens
    if (!tokens.access_token) {
      throw new Error('No access token received from Google');
    }

    // Get user info from Google API
    const oauth2 = google.oauth2({
      auth: oauth2Client,
      version: "v2",
    });

    const userInfo = await oauth2.userinfo.get();
    const userEmail = userInfo.data.email;
    const userName = userInfo.data.name;
    const userPicture = userInfo.data.picture;

    if (!userEmail) {
      throw new Error('Could not retrieve user email from Google');
    }

    // Save or update tokens in Supabase
    // Use the authenticated user_id if available, otherwise store as null
    let user_id_to_store = authenticated_user_id || null;
    
    // Convert expiry_date to Unix timestamp (bigint) if it exists
    const expiryTimestamp = tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : null;
    
    console.log('Saving Gmail tokens:', {
      email: userEmail,
      name: userName,
      user_id: user_id_to_store,
      expiry_date: tokens.expiry_date,
      expiry_timestamp: expiryTimestamp
    });
    
    const { data, error } = await supabase
      .from("gmail_tokens")
      .upsert([
        {
          email: userEmail,
          name: userName, // Store user's display name from Google
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expiry_date: expiryTimestamp,
          user_id: user_id_to_store // Link to authenticated user if exists
        },
      ], 
      { 
        onConflict: 'email',
        returning: 'minimal'
      });

    if (error) {
      console.error("Supabase upsert error:", error);
      throw error;
    }

    console.log('Gmail tokens saved successfully');

    // Redirect to frontend callback with success
    const successUrl = `${frontendUrl}/auth/gmail/callback?success=true&email=${encodeURIComponent(userEmail)}`;
    res.redirect(successUrl);

  } catch (err) {
    console.error("OAuth Error:", err);
    const errorUrl = `${frontendUrl}/auth/gmail/callback?error=${encodeURIComponent('authentication_failed')}&error_description=${encodeURIComponent(err.message || 'OAuth process failed')}`;
    res.redirect(errorUrl);
  }
});

// Check Gmail connection status for authenticated user
router.get('/gmail/status', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    console.log('Checking Gmail status for user:', user_id);
    
    const { data, error } = await supabase
      .from('gmail_tokens')
      .select('email, expiry_date, access_token, refresh_token')
      .eq('user_id', user_id)
      .single();
    
    console.log('Gmail tokens query result:', { data: data ? { email: data.email, expiry_date: data.expiry_date } : null, error });
    
    if (error || !data) {
      console.log('No Gmail tokens found for user');
      return res.json({ connected: false });
    }
    
    // Check if token is still valid (not expired)
    // expiry_date is stored as Unix timestamp (seconds), convert to milliseconds
    const isTokenExpired = data.expiry_date && (data.expiry_date * 1000) <= Date.now();
    console.log('Token validation:', { 
      isTokenExpired, 
      expiry_timestamp: data.expiry_date,
      expiry_date: data.expiry_date ? new Date(data.expiry_date * 1000) : null,
      current_time: new Date()
    });
    
    // If token is expired, try to refresh it
    if (isTokenExpired && data.refresh_token) {
      console.log('Token expired, attempting refresh...');
      try {
        const { refreshGmailToken } = require('./gmailService');
        const newTokens = await refreshGmailToken(data.refresh_token);
        
        // Update tokens in database
        const expiryTimestamp = newTokens.expiry_date ? Math.floor(newTokens.expiry_date / 1000) : null;
        const { error: updateError } = await supabase
          .from("gmail_tokens")
          .update({
            access_token: newTokens.access_token,
            refresh_token: newTokens.refresh_token || data.refresh_token,
            expiry_date: expiryTimestamp
          })
          .eq("user_id", user_id);
          
        if (updateError) {
          console.error('Token update error:', updateError);
          return res.json({ 
            connected: false, 
            email: data.email, 
            expiry: data.expiry_date,
            error: 'Token refresh failed'
          });
        }
        
        console.log('Token refreshed successfully, new expiry:', new Date(newTokens.expiry_date));
        
        const response = { 
          connected: true,
          email: data.email,
          expiry: expiryTimestamp,
          refreshed: true
        };
        console.log('Sending Gmail status response (after refresh):', response);
        
        return res.json(response);
        
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        return res.json({ 
          connected: false, 
          email: data.email, 
          expiry: data.expiry_date,
          error: 'Token refresh failed: ' + refreshError.message
        });
      }
    }
    
    const isTokenValid = !isTokenExpired;
    const response = { 
      connected: isTokenValid,
      email: data.email,
      expiry: data.expiry_date 
    };
    console.log('Sending Gmail status response:', response);
    
    res.json(response);
  } catch (error) {
    console.error('Gmail status check error:', error);
    res.status(500).json({ error: 'Failed to check Gmail status' });
  }
});

// Admin route to fix NULL user_ids (for development/debugging)
router.post('/fix-user-ids', authenticateToken, async (req, res) => {
  try {
    const { fixUserIds } = require('../scripts/fix-user-ids');
    await fixUserIds();
    
    res.json({
      message: '✅ User ID fix process completed',
      note: 'Check server logs for details'
    });
  } catch (error) {
    console.error('Fix user IDs error:', error);
    res.status(500).json({ 
      error: 'Failed to fix user IDs', 
      details: error.message 
    });
  }
});

// Check Gmail connection status by email (for testing - no auth required)
router.get('/gmail/status/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    if (!email) {
      return res.status(400).json({ error: 'Email parameter required' });
    }
    
    console.log('Checking Gmail status for email:', email);
    
    const { data, error } = await supabase
      .from('gmail_tokens')
      .select('email, expiry_date, user_id, access_token, refresh_token')
      .eq('email', email)
      .single();
    
    console.log('Gmail tokens query result:', { data: data ? { email: data.email, expiry_date: data.expiry_date, user_id: data.user_id } : null, error });
    
    if (error || !data) {
      console.log('No Gmail tokens found for email');
      return res.json({ connected: false });
    }
    
    // Check if token is still valid (not expired)
    // expiry_date is stored as Unix timestamp (seconds), convert to milliseconds
    const isTokenExpired = data.expiry_date && (data.expiry_date * 1000) <= Date.now();
    console.log('Token validation:', { 
      isTokenExpired, 
      expiry_timestamp: data.expiry_date,
      expiry_date: data.expiry_date ? new Date(data.expiry_date * 1000) : null,
      current_time: new Date()
    });
    
    // If token is expired, try to refresh it
    if (isTokenExpired && data.refresh_token) {
      console.log('Token expired, attempting refresh...');
      try {
        const { refreshGmailToken } = require('./gmailService');
        const newTokens = await refreshGmailToken(data.refresh_token);
        
        // Update tokens in database
        const expiryTimestamp = newTokens.expiry_date ? Math.floor(newTokens.expiry_date / 1000) : null;
        const { error: updateError } = await supabase
          .from("gmail_tokens")
          .update({
            access_token: newTokens.access_token,
            refresh_token: newTokens.refresh_token || data.refresh_token,
            expiry_date: expiryTimestamp
          })
          .eq("email", email);
          
        if (updateError) {
          console.error('Token update error:', updateError);
          return res.json({ 
            connected: false, 
            email: data.email, 
            expiry: data.expiry_date,
            user_id: data.user_id,
            error: 'Token refresh failed'
          });
        }
        
        console.log('Token refreshed successfully, new expiry:', new Date(newTokens.expiry_date));
        
        const response = { 
          connected: true,
          email: data.email,
          expiry: expiryTimestamp,
          user_id: data.user_id,
          refreshed: true
        };
        console.log('Sending Gmail status response (after refresh):', response);
        
        return res.json(response);
        
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        return res.json({ 
          connected: false, 
          email: data.email, 
          expiry: data.expiry_date,
          user_id: data.user_id,
          error: 'Token refresh failed: ' + refreshError.message
        });
      }
    }
    
    const isTokenValid = !isTokenExpired;
    const response = { 
      connected: isTokenValid,
      email: data.email,
      expiry: data.expiry_date,
      user_id: data.user_id 
    };
    console.log('Sending Gmail status response:', response);
    
    res.json(response);
  } catch (error) {
    console.error('Gmail status check error:', error);
    res.status(500).json({ error: 'Failed to check Gmail status' });
  }
});

// Endpoint to get Gmail statistics for authenticated user
router.get('/gmail/stats', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    console.log('Getting Gmail stats for user:', user_id);
    
    // Get all Gmail messages for this user
    const { data: allMessages, error: messagesError } = await supabase
      .from('gmail_messages')
      .select('id')
      .eq('user_id', user_id);

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }

    // Get all existing embeddings for this user
    const { data: existingEmbeddings, error: embeddingsError } = await supabase
      .from('gmail_message_embeddings')
      .select('message_id')
      .eq('user_id', user_id);

    if (embeddingsError) {
      console.error('Error fetching embeddings:', embeddingsError);
      return res.status(500).json({ error: 'Failed to fetch embeddings' });
    }

    const totalMessages = allMessages?.length || 0;
    const embeddedMessages = existingEmbeddings?.length || 0;
    const missingEmbeddings = Math.max(0, totalMessages - embeddedMessages);

    res.json({
      total_messages: totalMessages,
      embedded_messages: embeddedMessages,
      missing_embeddings: missingEmbeddings
    });

  } catch (error) {
    console.error('Error getting Gmail stats:', error);
    res.status(500).json({ 
      error: 'Failed to get Gmail statistics',
      details: error.message
    });
  }
});

// Disconnect Gmail for authenticated user
router.post('/auth/gmail/disconnect', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    console.log('Disconnecting Gmail for user:', user_id);
    
    // Delete all Gmail-related data for this user
    // 1. Delete Gmail embeddings (correct table name: gmail_message_embeddings)
    const { error: embeddingsError } = await supabase
      .from('gmail_message_embeddings')
      .delete()
      .eq('user_id', user_id);
    
    if (embeddingsError) {
      console.error('Error deleting Gmail embeddings:', embeddingsError);
    } else {
      console.log('Gmail embeddings deleted for user:', user_id);
    }
    
    // 2. Delete Gmail messages
    const { error: messagesError } = await supabase
      .from('gmail_messages')
      .delete()
      .eq('user_id', user_id);
    
    if (messagesError) {
      console.error('Error deleting Gmail messages:', messagesError);
    } else {
      console.log('Gmail messages deleted for user:', user_id);
    }
    
    // 3. Delete tokens from database
    const { error: tokensError } = await supabase
      .from('gmail_tokens')
      .delete()
      .eq('user_id', user_id);
    
    if (tokensError) {
      console.error('Gmail tokens disconnect error:', tokensError);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to disconnect Gmail' 
      });
    }
    
    console.log('Gmail tokens deleted for user:', user_id);
    console.log('Gmail fully disconnected for user:', user_id);
    
    res.json({
      success: true,
      message: 'Gmail disconnected successfully. All data has been removed.'
    });
    
  } catch (error) {
    console.error('Gmail disconnect error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to disconnect Gmail',
      details: error.message 
    });
  }
});

// Endpoint to manually trigger email fetch and embedding for authenticated user
router.post('/gmail/fetch-and-embed', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    console.log('Manual fetch and embed triggered for user:', user_id);
    
    // Import required services
    const { storeGmailMessages } = require('./gmailService');
    
    // Fetch Gmail messages
    console.log('Fetching Gmail messages for user:', user_id);
    const fetchResult = await storeGmailMessages(user_id);
    
    if (fetchResult.error) {
      return res.status(400).json({ 
        success: false, 
        error: fetchResult.error 
      });
    }
    
    console.log(`Successfully fetched ${fetchResult.count} Gmail messages`);
    
    // Trigger embedding process
    console.log('Starting email embedding process...');
    
    // Make internal API call to embed messages
    const embeddingResponse = await fetch(`http://localhost:${process.env.PORT || 3000}/api/embed-gmail-messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ auto_triggered: true })
    });
    
    if (!embeddingResponse.ok) {
      return res.status(500).json({
        success: false,
        error: 'Embedding process failed',
        messages_fetched: fetchResult.count
      });
    }
    
    const embeddingResult = await embeddingResponse.json();
    console.log('Email embedding completed:', {
      processed: embeddingResult.processed,
      errors: embeddingResult.errors,
      total: embeddingResult.total
    });
    
    res.json({
      success: true,
      message: 'Gmail messages fetched and embedded successfully',
      messages_fetched: fetchResult.count,
      messages_embedded: embeddingResult.processed,
      embedding_errors: embeddingResult.errors,
      total_processed: embeddingResult.total
    });
    
  } catch (error) {
    console.error('Error in manual fetch and embed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch and embed Gmail messages',
      details: error.message
    });
  }
});

// API endpoint for OAuth callback (returns JSON instead of redirecting)
router.post('/auth/gmail/callback/api', async (req, res) => {
  const { code, state } = req.body;

  if (!code) {
    return res.status(400).json({ 
      error: 'authorization_code_missing',
      message: 'Authorization code not provided'
    });
  }

  // Extract user_id from state parameter if provided
  let authenticated_user_id = null;
  if (state) {
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      authenticated_user_id = stateData.user_id;
      console.log('Extracted user_id from state:', authenticated_user_id);
    } catch (parseError) {
      console.warn('Could not parse state parameter:', parseError);
      return res.status(400).json({
        error: 'invalid_state',
        message: 'Invalid state parameter'
      });
    }
  }

  try {
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Validate tokens
    if (!tokens.access_token) {
      throw new Error('No access token received from Google');
    }

    // Get user info from Google API
    const oauth2 = google.oauth2({
      auth: oauth2Client,
      version: "v2",
    });

    const userInfo = await oauth2.userinfo.get();
    const userEmail = userInfo.data.email;

    if (!userEmail) {
      throw new Error('Could not retrieve user email from Google');
    }

    console.log('Saving Gmail tokens for user:', authenticated_user_id, 'email:', userEmail);

    // Convert expiry_date to Unix timestamp (bigint) if it exists
    const expiryTimestamp = tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : null;
    
    console.log('Token expiry conversion:', {
      original: tokens.expiry_date,
      timestamp: expiryTimestamp
    });

    // Save or update tokens in Supabase
    const { data, error } = await supabase
      .from("gmail_tokens")
      .upsert([
        {
          email: userEmail,
          name: userInfo.data.name, // Store user's display name from Google
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expiry_date: expiryTimestamp,
          user_id: authenticated_user_id
        },
      ], 
      { 
        onConflict: 'email',
        returning: 'minimal'
      });

    if (error) {
      console.error("Supabase upsert error:", error);
      throw error;
    }

    console.log('Gmail tokens saved successfully');

    // Return success response
    res.json({
      success: true,
      message: 'Gmail authentication successful',
      email: userEmail,
      user_id: authenticated_user_id
    });

  } catch (err) {
    console.error("OAuth API Error:", err);
    res.status(500).json({
      error: 'authentication_failed',
      message: err.message || 'OAuth process failed'
    });
  }
});

// Send email endpoint for authenticated users
router.post('/gmail/send', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    const { to, subject, body, cc, bcc, isHtml = false, replyTo } = req.body;

    // Validate required fields
    if (!to || !subject || !body) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['to', 'subject', 'body']
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({
        error: 'Invalid recipient email format',
        field: 'to'
      });
    }

    console.log('Sending email for user:', user_id, 'to:', to);

    // Import and use the sendEmailForUser function
    const { sendEmailForUser } = require('./gmailService');
    
    const result = await sendEmailForUser(user_id, to, subject, body, {
      cc,
      bcc,
      isHtml,
      replyTo
    });

    if (result.success) {
      console.log('Email sent successfully:', result.messageId);
      res.json({
        success: true,
        message: 'Email sent successfully',
        messageId: result.messageId,
        threadId: result.threadId
      });
    } else {
      console.error('Email sending failed:', result.error);
      res.status(400).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('Error in send email endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send email',
      details: error.message
    });
  }
});

// Send email endpoint with user identifier (for testing or external use)
router.post('/gmail/send/:userIdentifier', async (req, res) => {
  try {
    const { userIdentifier } = req.params;
    const { to, subject, body, cc, bcc, isHtml = false, replyTo } = req.body;

    // Validate required fields
    if (!to || !subject || !body) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['to', 'subject', 'body']
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({
        error: 'Invalid recipient email format',
        field: 'to'
      });
    }

    console.log('Sending email for user identifier:', userIdentifier, 'to:', to);

    // Import and use the sendEmailForUser function
    const { sendEmailForUser } = require('./gmailService');
    
    const result = await sendEmailForUser(userIdentifier, to, subject, body, {
      cc,
      bcc,
      isHtml,
      replyTo
    });

    if (result.success) {
      console.log('Email sent successfully:', result.messageId);
      res.json({
        success: true,
        message: 'Email sent successfully',
        messageId: result.messageId,
        threadId: result.threadId
      });
    } else {
      console.error('Email sending failed:', result.error);
      res.status(400).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('Error in send email endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send email',
      details: error.message
    });
  }
});

// AI-powered email composition and sending endpoint
router.post('/gmail/compose/:userIdentifier', async (req, res) => {
  try {
    const { userIdentifier } = req.params;
    const { 
      userPrompt, 
      recipientEmail, 
      context, 
      model = 'gpt-4o-mini',
      temperature = 0.7,
      isHtml = false 
    } = req.body;

    // Validate required fields
    if (!userPrompt || !recipientEmail) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        required: ['userPrompt', 'recipientEmail']
      });
    }

    // Validate prompt length
    if (userPrompt.length > 500) {
      return res.status(400).json({
        success: false,
        error: 'User prompt too long (max 500 characters)',
        field: 'userPrompt'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid recipient email format',
        field: 'recipientEmail'
      });
    }

    console.log('AI email composition request:', {
      userIdentifier,
      prompt: userPrompt.substring(0, 50) + '...',
      recipient: recipientEmail
    });

    // Import and use the handleEmailPrompt function
    const { handleEmailPrompt } = require('./gmailService');
    
    const result = await handleEmailPrompt(userIdentifier, userPrompt, recipientEmail, {
      context,
      model,
      temperature,
      isHtml
    });

    if (result.success) {
      console.log('AI email composed and sent successfully:', result.messageId);
      res.json({
        success: true,
        message: 'Email generated and sent successfully',
        messageId: result.messageId,
        threadId: result.threadId,
        generatedContent: result.generatedContent,
        recipient: result.recipient,
        prompt: result.prompt
      });
    } else {
      console.error('AI email composition failed:', result.error);
      
      // Determine appropriate status code based on error stage
      const statusCode = result.stage === 'validation' ? 400 : 
                        result.stage === 'generation' ? 502 : 500;
      
      res.status(statusCode).json({
        success: false,
        error: result.error,
        stage: result.stage,
        recipient: result.recipient,
        prompt: result.prompt
      });
    }

  } catch (error) {
    console.error('Error in AI email composition endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to compose and send email',
      details: error.message
    });
  }
});

module.exports = router;
