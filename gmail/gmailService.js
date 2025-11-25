const { google } = require('googleapis');
const supabase = require('../supabase/supabaseConnect');
const OpenAI = require('openai');

// Define OAuth scopes
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'openid'
];

async function getGmailMessages(accessToken, refreshToken) {
  const oAuth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  );
  
  oAuth2Client.setCredentials({ 
    access_token: accessToken, 
    refresh_token: refreshToken 
  });

  const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

  const res = await gmail.users.messages.list({
    userId: "me",
    maxResults: 100,
  });

  let messages = [];

  for (const msg of res.data.messages || []) {
    const fullMsg = await gmail.users.messages.get({ userId: "me", id: msg.id });
    const payload = fullMsg.data.payload;
    const headers = payload.headers;

    const getHeader = (name) =>
      headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

    const body = getMessageBody(payload);

    messages.push({
      id: fullMsg.data.id,
      thread_id: fullMsg.data.threadId,
      snippet: fullMsg.data.snippet,
      subject: getHeader("Subject"),
      sender: getHeader("From"),
      recipients: getHeader("To"),
      date: getHeader("Date"),
      body,
      labels: fullMsg.data.labelIds,
    });
  }

  return messages;
}

function getMessageBody(payload) {
  let body = "";
  
  // Handle different message structures
  if (payload.parts) {
    // Multi-part message
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body.data) {
        body = Buffer.from(part.body.data, "base64").toString("utf-8");
        break;
      } else if (part.mimeType === "text/html" && part.body.data && !body) {
        body = Buffer.from(part.body.data, "base64").toString("utf-8");
      }
    }
  } else if (payload.body && payload.body.data) {
    // Single part message
    body = Buffer.from(payload.body.data, "base64").toString("utf-8");
  }
  
  return body;
}

async function storeGmailMessages(userIdentifier) {
  try {
    // Get tokens from Supabase gmail_tokens table
    // userIdentifier can be either email or user_id
    let query = supabase.from("gmail_tokens").select("access_token, refresh_token, email, user_id");
    
    // Check if userIdentifier is an email or user_id
    if (userIdentifier.includes('@')) {
      query = query.eq("email", userIdentifier);
    } else {
      query = query.eq("user_id", userIdentifier);
    }
    
    const { data: tokenRow, error } = await query.single();

    if (error || !tokenRow) {
      return { error: "User tokens not found" };
    }

    // Check if token is expired and refresh if needed
    if (tokenRow.expiry_date && Date.now() > tokenRow.expiry_date) {
      try {
        const newTokens = await refreshGmailToken(tokenRow.refresh_token);
        
        // Update tokens in database
        await supabase
          .from("gmail_tokens")
          .update({
            access_token: newTokens.access_token,
            refresh_token: newTokens.refresh_token,
            expiry_date: newTokens.expiry_date
          })
          .eq("email", tokenRow.email);
          
        tokenRow.access_token = newTokens.access_token;
      } catch (refreshError) {
        return { error: "Token refresh failed: " + refreshError.message };
      }
    }

    const messages = await getGmailMessages(tokenRow.access_token, tokenRow.refresh_token);

    // Insert into Supabase with proper field mapping
    const insertPromises = messages.map(async (msg) => {
      return supabase.from("gmail_messages").upsert({
        id: msg.id,
        thread_id: msg.thread_id,
        user_id: tokenRow.user_id,
        user_email: tokenRow.email,
        snippet: msg.snippet,
        subject: msg.subject,
        sender: msg.sender,
        recipients: msg.recipients,
        body: msg.body,
        date: new Date(msg.date).toISOString(),
        labels: msg.labels,
      });
    });

    await Promise.all(insertPromises);

    return { 
      count: messages.length, 
      messages: messages.slice(0, 5) // Return first 5 for preview
    };
  } catch (error) {
    console.error('Store Gmail messages error:', error);
    return { error: error.message };
  }
}

async function refreshGmailToken(refreshToken) {
  try {
    const oAuth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );

    oAuth2Client.setCredentials({ refresh_token: refreshToken });
    
    const { credentials } = await oAuth2Client.refreshAccessToken();
    
    return {
      access_token: credentials.access_token,
      refresh_token: credentials.refresh_token || refreshToken,
      expiry_date: credentials.expiry_date
    };
  } catch (error) {
    console.error('Token refresh error:', error);
    throw error;
  }
}

/**
 * Send an email using the Gmail API
 * @param {google.auth.OAuth2} auth - Configured OAuth2 client
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} body - Email body (plain text or HTML)
 * @param {string} [from] - Sender email (optional, uses authenticated user's email by default)
 * @param {string} [cc] - CC recipients (optional)
 * @param {string} [bcc] - BCC recipients (optional)
 * @param {boolean} [isHtml=false] - Whether the body is HTML
 * @returns {Promise<Object>} Gmail API response
 */
async function sendEmail(auth, to, subject, body, options = {}) {
  try {
    const gmail = google.gmail({ version: 'v1', auth });
    
    const {
      from,
      cc,
      bcc,
      isHtml = false,
      replyTo
    } = options;

    // Get the authenticated user's email if 'from' is not provided
    let fromAddress = from;
    if (!fromAddress) {
      try {
        const profile = await gmail.users.getProfile({ userId: 'me' });
        fromAddress = profile.data.emailAddress;
      } catch (error) {
        console.warn('Could not get user profile, using default from address');
        fromAddress = 'me'; // Gmail will use the authenticated user's email
      }
    }

    // Construct the email message in RFC 2822 format
    const messageParts = [];
    
    // Add headers
    messageParts.push(`To: ${to}`);
    if (fromAddress && fromAddress !== 'me') {
      messageParts.push(`From: ${fromAddress}`);
    }
    if (cc) {
      messageParts.push(`Cc: ${cc}`);
    }
    if (bcc) {
      messageParts.push(`Bcc: ${bcc}`);
    }
    if (replyTo) {
      messageParts.push(`Reply-To: ${replyTo}`);
    }
    
    messageParts.push(`Subject: ${subject}`);
    messageParts.push('MIME-Version: 1.0');
    
    if (isHtml) {
      messageParts.push('Content-Type: text/html; charset=utf-8');
    } else {
      messageParts.push('Content-Type: text/plain; charset=utf-8');
    }
    
    // Add empty line to separate headers from body (RFC 2822)
    messageParts.push('');
    
    // Add body
    messageParts.push(body);
    
    // Join all parts with CRLF (as per RFC 2822)
    const rawMessage = messageParts.join('\r\n');
    
    // Encode as base64url (base64 with URL-safe characters)
    const encodedMessage = Buffer.from(rawMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, ''); // Remove padding
    
    // Send the email
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    });
    
    console.log('Email sent successfully:', response.data.id);
    return response.data;
    
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

/**
 * Send an email using user identifier (email or user_id) to get auth tokens
 * @param {string} userIdentifier - User email or user_id
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} body - Email body
 * @param {Object} [options] - Additional options (from, cc, bcc, isHtml, replyTo)
 * @returns {Promise<Object>} Result object with success/error status
 */
async function sendEmailForUser(userIdentifier, to, subject, body, options = {}) {
  try {
    // Get tokens from Supabase gmail_tokens table
    let query = supabase.from("gmail_tokens").select("access_token, refresh_token, email, user_id");
    
    // Check if userIdentifier is an email or user_id
    if (userIdentifier.includes('@')) {
      query = query.eq("email", userIdentifier);
    } else {
      query = query.eq("user_id", userIdentifier);
    }
    
    const { data: tokenRow, error } = await query.single();

    if (error || !tokenRow) {
      throw new Error("User tokens not found. Please connect Gmail first.");
    }

    // Create OAuth2 client and set credentials
    const oAuth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );
    
    oAuth2Client.setCredentials({
      access_token: tokenRow.access_token,
      refresh_token: tokenRow.refresh_token
    });

    // Check if token is expired and refresh if needed
    if (tokenRow.expiry_date && Date.now() > tokenRow.expiry_date) {
      try {
        const { credentials } = await oAuth2Client.refreshAccessToken();
        
        // Update tokens in database
        await supabase
          .from("gmail_tokens")
          .update({
            access_token: credentials.access_token,
            refresh_token: credentials.refresh_token || tokenRow.refresh_token,
            expiry_date: credentials.expiry_date
          })
          .eq("email", tokenRow.email);
          
        // Update the OAuth client with new tokens
        oAuth2Client.setCredentials({
          access_token: credentials.access_token,
          refresh_token: credentials.refresh_token || tokenRow.refresh_token
        });
      } catch (refreshError) {
        throw new Error("Token refresh failed: " + refreshError.message);
      }
    }

    // Send the email
    const result = await sendEmail(oAuth2Client, to, subject, body, options);
    
    return {
      success: true,
      messageId: result.id,
      threadId: result.threadId,
      message: 'Email sent successfully'
    };
    
  } catch (error) {
    console.error('Send email for user error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Handle natural language email prompt using OpenAI
 * @param {Object} auth - OAuth2 client or user identifier
 * @param {string} userPrompt - Natural language request for email content
 * @param {string} recipientEmail - Email address of the recipient
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - Success/failure response with email details
 */
async function handleEmailPrompt(auth, userPrompt, recipientEmail, options = {}) {
  try {
    // Validate inputs
    if (!userPrompt || typeof userPrompt !== 'string') {
      throw new Error('userPrompt is required and must be a string');
    }
    
    if (!recipientEmail || typeof recipientEmail !== 'string') {
      throw new Error('recipientEmail is required and must be a valid email address');
    }

    // Email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      throw new Error('Invalid email address format');
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not found in environment variables');
    }

    // Create system prompt for email generation
    const systemPrompt = `You are an AI assistant that helps compose professional emails. 
    
Given a natural language request, generate an appropriate email subject and body.

Rules:
1. Keep the subject concise and descriptive (max 60 characters)
2. Make the body professional but friendly
3. Use proper greeting and closing
4. Keep it concise but complete
5. Maintain appropriate tone for business communication
6. Do not include recipient's name unless specified in the prompt
7. Use "Hi" as default greeting unless context suggests otherwise

Return ONLY a JSON object with this exact structure:
{
  "email_subject": "Your subject here",
  "email_body": "Your complete email body here"
}`;

    const userMessage = `Generate an email for this request: "${userPrompt}"
    
The recipient email is: ${recipientEmail}
${options.context ? `Additional context: ${options.context}` : ''}`;

    // Call OpenAI API with structured output
    console.log('🤖 Generating email content with OpenAI...');
    
    const completion = await openai.chat.completions.create({
      model: options.model || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userMessage
        }
      ],
      response_format: { type: "json_object" },
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 500,
    });

    const aiResponse = completion.choices[0]?.message?.content;
    
    if (!aiResponse) {
      throw new Error('No response received from OpenAI');
    }

    // Parse JSON response safely
    let emailContent;
    try {
      emailContent = JSON.parse(aiResponse);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', aiResponse);
      throw new Error('Invalid JSON response from OpenAI: ' + parseError.message);
    }

    // Validate response structure
    if (!emailContent.email_subject || !emailContent.email_body) {
      throw new Error('OpenAI response missing required fields (email_subject, email_body)');
    }

    // Validate content lengths
    if (emailContent.email_subject.length > 100) {
      emailContent.email_subject = emailContent.email_subject.substring(0, 97) + '...';
    }

    if (emailContent.email_body.length > 10000) {
      throw new Error('Generated email body is too long (max 10,000 characters)');
    }

    console.log('✅ Email content generated successfully');
    console.log('📧 Subject:', emailContent.email_subject);
    console.log('📝 Body length:', emailContent.email_body.length, 'characters');

    // Send the email using existing sendEmailForUser function
    let sendResult;
    
    if (typeof auth === 'string') {
      // If auth is a user identifier (email or user_id)
      sendResult = await sendEmailForUser(
        auth,
        recipientEmail,
        emailContent.email_subject,
        emailContent.email_body,
        { isHtml: options.isHtml || false }
      );
    } else {
      // If auth is an OAuth2 client
      sendResult = await sendEmail(
        auth,
        recipientEmail,
        emailContent.email_subject,
        emailContent.email_body,
        { isHtml: options.isHtml || false }
      );
    }

    if (sendResult.success) {
      return {
        success: true,
        messageId: sendResult.messageId,
        threadId: sendResult.threadId,
        generatedContent: {
          subject: emailContent.email_subject,
          body: emailContent.email_body
        },
        recipient: recipientEmail,
        prompt: userPrompt,
        message: 'Email generated and sent successfully'
      };
    } else {
      throw new Error('Failed to send email: ' + sendResult.error);
    }

  } catch (error) {
    console.error('handleEmailPrompt error:', error);
    
    return {
      success: false,
      error: error.message,
      recipient: recipientEmail,
      prompt: userPrompt,
      stage: error.message.includes('OpenAI') ? 'generation' : 
             error.message.includes('send') ? 'sending' : 'validation'
    };
  }
}

module.exports = {
  getGmailMessages,
  storeGmailMessages,
  refreshGmailToken,
  sendEmail,
  sendEmailForUser,
  handleEmailPrompt,
  SCOPES
};
