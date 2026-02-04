const { google } = require('googleapis');
const supabase = require('../supabase/supabaseConnect');
const OpenAI = require('openai');

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

    // Convert newlines to HTML line breaks if sending as HTML
    let emailBody = body;
    if (isHtml && body) {
      // Convert \n to <br> for HTML emails, but preserve existing HTML
      if (!body.includes('<br>') && !body.includes('<p>') && !body.includes('<div>')) {
        emailBody = body.replace(/\n/g, '<br>');
      }
    }

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
    
    // Add body (use emailBody which has HTML formatting if needed)
    messageParts.push(emailBody);
    
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

// ============================================================
// HELPER FUNCTION: Get authenticated Gmail client for user
// ============================================================

/**
 * Get an authenticated Gmail API client for a user
 * @param {string} userId - User ID or email
 * @returns {Promise<{gmail: object, userEmail: string}>}
 */
async function getGmailClient(userId) {
  // Get tokens from Supabase
  let query = supabase.from("gmail_tokens").select("access_token, refresh_token, email, user_id, expiry_date");
  
  if (userId.includes('@')) {
    query = query.eq("email", userId);
  } else {
    query = query.eq("user_id", userId);
  }
  
  const { data: tokenRow, error } = await query.single();

  if (error || !tokenRow) {
    throw new Error("User tokens not found. Please connect Gmail first.");
  }

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
  if (tokenRow.expiry_date && Date.now() > tokenRow.expiry_date * 1000) {
    try {
      const { credentials } = await oAuth2Client.refreshAccessToken();
      
      const expiryTimestamp = credentials.expiry_date ? Math.floor(credentials.expiry_date / 1000) : null;
      
      await supabase
        .from("gmail_tokens")
        .update({
          access_token: credentials.access_token,
          refresh_token: credentials.refresh_token || tokenRow.refresh_token,
          expiry_date: expiryTimestamp
        })
        .eq("user_id", tokenRow.user_id);
        
      oAuth2Client.setCredentials({
        access_token: credentials.access_token,
        refresh_token: credentials.refresh_token || tokenRow.refresh_token
      });
    } catch (refreshError) {
      throw new Error("Token refresh failed: " + refreshError.message);
    }
  }

  const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
  return { gmail, userEmail: tokenRow.email };
}

/**
 * Parse email headers to get common fields
 */
function parseEmailHeaders(headers) {
  const getHeader = (name) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
  
  return {
    from: getHeader("From"),
    to: getHeader("To"),
    cc: getHeader("Cc"),
    bcc: getHeader("Bcc"),
    subject: getHeader("Subject"),
    date: getHeader("Date"),
    messageId: getHeader("Message-ID"),
    inReplyTo: getHeader("In-Reply-To"),
    references: getHeader("References")
  };
}

/**
 * Format email for response
 */
function formatEmail(message) {
  const headers = parseEmailHeaders(message.payload?.headers || []);
  const body = getMessageBody(message.payload);
  
  return {
    id: message.id,
    threadId: message.threadId,
    labelIds: message.labelIds || [],
    snippet: message.snippet,
    from: headers.from,
    to: headers.to,
    cc: headers.cc,
    subject: headers.subject,
    date: headers.date,
    body: body,
    isUnread: (message.labelIds || []).includes('UNREAD'),
    isStarred: (message.labelIds || []).includes('STARRED')
  };
}

// ============================================================
// EMAIL SENDING FUNCTIONS
// ============================================================

/**
 * Send email - wrapper for agent usage
 */
async function sendEmailForAgent(userId, params) {
  const { to, subject, body, cc, bcc, isHtml } = params;
  
  if (!to || !subject || !body) {
    throw new Error("Missing required fields: to, subject, and body are required");
  }
  
  const result = await sendEmailForUser(userId, to, subject, body, { cc, bcc, isHtml });
  return result;
}

/**
 * Reply to an existing email
 */
async function replyToEmail(userId, params) {
  const { messageId, body, replyAll = false } = params;
  
  if (!messageId || !body) {
    throw new Error("Missing required fields: messageId and body are required");
  }
  
  try {
    const { gmail, userEmail } = await getGmailClient(userId);
    
    // Get the original message
    const originalMessage = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full'
    });
    
    const headers = parseEmailHeaders(originalMessage.data.payload.headers);
    
    // Determine recipients
    let to = headers.from;
    let cc = '';
    
    if (replyAll) {
      // Include all original recipients except ourselves
      const originalTo = headers.to.split(',').map(e => e.trim()).filter(e => !e.includes(userEmail));
      const originalCc = headers.cc ? headers.cc.split(',').map(e => e.trim()).filter(e => !e.includes(userEmail)) : [];
      cc = [...originalTo, ...originalCc].join(', ');
    }
    
    // Build reply subject
    let subject = headers.subject;
    if (!subject.toLowerCase().startsWith('re:')) {
      subject = 'Re: ' + subject;
    }
    
    // Build reply headers
    const messageParts = [];
    messageParts.push(`To: ${to}`);
    if (cc) messageParts.push(`Cc: ${cc}`);
    messageParts.push(`Subject: ${subject}`);
    messageParts.push(`In-Reply-To: ${headers.messageId}`);
    messageParts.push(`References: ${headers.references ? headers.references + ' ' : ''}${headers.messageId}`);
    messageParts.push('MIME-Version: 1.0');
    messageParts.push('Content-Type: text/plain; charset=utf-8');
    messageParts.push('');
    messageParts.push(body);
    messageParts.push('');
    messageParts.push(`On ${headers.date}, ${headers.from} wrote:`);
    messageParts.push('> ' + (originalMessage.data.snippet || '').replace(/\n/g, '\n> '));
    
    const rawMessage = messageParts.join('\r\n');
    const encodedMessage = Buffer.from(rawMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
        threadId: originalMessage.data.threadId
      }
    });
    
    return {
      success: true,
      messageId: response.data.id,
      threadId: response.data.threadId,
      to: to,
      subject: subject,
      message: 'Reply sent successfully'
    };
    
  } catch (error) {
    console.error('Reply to email error:', error);
    throw new Error(`Failed to reply: ${error.message}`);
  }
}

/**
 * Forward an email
 */
async function forwardEmail(userId, params) {
  const { messageId, to, additionalMessage = '' } = params;
  
  if (!messageId || !to) {
    throw new Error("Missing required fields: messageId and to are required");
  }
  
  try {
    const { gmail } = await getGmailClient(userId);
    
    // Get the original message
    const originalMessage = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full'
    });
    
    const headers = parseEmailHeaders(originalMessage.data.payload.headers);
    const originalBody = getMessageBody(originalMessage.data.payload);
    
    // Build forward subject
    let subject = headers.subject;
    if (!subject.toLowerCase().startsWith('fwd:')) {
      subject = 'Fwd: ' + subject;
    }
    
    // Build forward body
    let forwardBody = additionalMessage ? additionalMessage + '\n\n' : '';
    forwardBody += '---------- Forwarded message ---------\n';
    forwardBody += `From: ${headers.from}\n`;
    forwardBody += `Date: ${headers.date}\n`;
    forwardBody += `Subject: ${headers.subject}\n`;
    forwardBody += `To: ${headers.to}\n`;
    if (headers.cc) forwardBody += `Cc: ${headers.cc}\n`;
    forwardBody += '\n' + originalBody;
    
    // Build message
    const messageParts = [];
    messageParts.push(`To: ${to}`);
    messageParts.push(`Subject: ${subject}`);
    messageParts.push('MIME-Version: 1.0');
    messageParts.push('Content-Type: text/plain; charset=utf-8');
    messageParts.push('');
    messageParts.push(forwardBody);
    
    const rawMessage = messageParts.join('\r\n');
    const encodedMessage = Buffer.from(rawMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    });
    
    return {
      success: true,
      messageId: response.data.id,
      threadId: response.data.threadId,
      to: to,
      subject: subject,
      message: 'Email forwarded successfully'
    };
    
  } catch (error) {
    console.error('Forward email error:', error);
    throw new Error(`Failed to forward: ${error.message}`);
  }
}

// ============================================================
// EMAIL READING FUNCTIONS
// ============================================================

/**
 * Read a specific email by ID
 */
async function readEmail(userId, params) {
  const { messageId } = params;
  
  if (!messageId) {
    throw new Error("Missing required field: messageId");
  }
  
  try {
    const { gmail } = await getGmailClient(userId);
    
    const message = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full'
    });
    
    return {
      success: true,
      email: formatEmail(message.data)
    };
    
  } catch (error) {
    console.error('Read email error:', error);
    throw new Error(`Failed to read email: ${error.message}`);
  }
}

/**
 * Get latest emails
 */
async function getLatestEmails(userId, params = {}) {
  const { maxResults = 10, labelIds = ['INBOX'] } = params;
  
  try {
    const { gmail } = await getGmailClient(userId);
    
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: Math.min(maxResults, 50),
      labelIds: labelIds
    });
    
    const emails = [];
    for (const msg of response.data.messages || []) {
      const fullMsg = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'full'
      });
      emails.push(formatEmail(fullMsg.data));
    }
    
    return {
      success: true,
      count: emails.length,
      emails: emails
    };
    
  } catch (error) {
    console.error('Get latest emails error:', error);
    throw new Error(`Failed to get emails: ${error.message}`);
  }
}

/**
 * Get unread emails
 */
async function getUnreadEmails(userId, params = {}) {
  const { maxResults = 10 } = params;
  
  try {
    const { gmail } = await getGmailClient(userId);
    
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: Math.min(maxResults, 50),
      labelIds: ['INBOX', 'UNREAD']
    });
    
    const emails = [];
    for (const msg of response.data.messages || []) {
      const fullMsg = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'full'
      });
      emails.push(formatEmail(fullMsg.data));
    }
    
    return {
      success: true,
      count: emails.length,
      emails: emails
    };
    
  } catch (error) {
    console.error('Get unread emails error:', error);
    throw new Error(`Failed to get unread emails: ${error.message}`);
  }
}

// ============================================================
// EMAIL SEARCH FUNCTIONS
// ============================================================

/**
 * Search emails using Gmail search syntax
 */
async function searchEmails(userId, params) {
  const { query, maxResults = 20 } = params;
  
  if (!query) {
    throw new Error("Missing required field: query");
  }
  
  try {
    const { gmail } = await getGmailClient(userId);
    
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: Math.min(maxResults, 100)
    });
    
    const emails = [];
    for (const msg of response.data.messages || []) {
      const fullMsg = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'full'
      });
      emails.push(formatEmail(fullMsg.data));
    }
    
    return {
      success: true,
      query: query,
      count: emails.length,
      emails: emails
    };
    
  } catch (error) {
    console.error('Search emails error:', error);
    throw new Error(`Failed to search emails: ${error.message}`);
  }
}

/**
 * Get all emails in a thread
 */
async function getEmailsByThread(userId, params) {
  const { threadId } = params;
  
  if (!threadId) {
    throw new Error("Missing required field: threadId");
  }
  
  try {
    const { gmail } = await getGmailClient(userId);
    
    const thread = await gmail.users.threads.get({
      userId: 'me',
      id: threadId,
      format: 'full'
    });
    
    const emails = (thread.data.messages || []).map(msg => formatEmail(msg));
    
    return {
      success: true,
      threadId: threadId,
      count: emails.length,
      emails: emails
    };
    
  } catch (error) {
    console.error('Get thread error:', error);
    throw new Error(`Failed to get thread: ${error.message}`);
  }
}

/**
 * Get emails from a specific sender
 */
async function getEmailsBySender(userId, params) {
  const { senderEmail, maxResults = 20 } = params;
  
  if (!senderEmail) {
    throw new Error("Missing required field: senderEmail");
  }
  
  return searchEmails(userId, { query: `from:${senderEmail}`, maxResults });
}

// ============================================================
// DRAFT MANAGEMENT FUNCTIONS
// ============================================================

/**
 * Create a draft
 */
async function createDraft(userId, params) {
  const { to, subject, body, cc, bcc } = params;
  
  if (!to || !subject || !body) {
    throw new Error("Missing required fields: to, subject, and body are required");
  }
  
  try {
    const { gmail } = await getGmailClient(userId);
    
    const messageParts = [];
    messageParts.push(`To: ${to}`);
    if (cc) messageParts.push(`Cc: ${cc}`);
    if (bcc) messageParts.push(`Bcc: ${bcc}`);
    messageParts.push(`Subject: ${subject}`);
    messageParts.push('MIME-Version: 1.0');
    messageParts.push('Content-Type: text/plain; charset=utf-8');
    messageParts.push('');
    messageParts.push(body);
    
    const rawMessage = messageParts.join('\r\n');
    const encodedMessage = Buffer.from(rawMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    
    const response = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: {
        message: {
          raw: encodedMessage
        }
      }
    });
    
    return {
      success: true,
      draftId: response.data.id,
      messageId: response.data.message.id,
      to: to,
      subject: subject,
      message: 'Draft created successfully'
    };
    
  } catch (error) {
    console.error('Create draft error:', error);
    throw new Error(`Failed to create draft: ${error.message}`);
  }
}

/**
 * List all drafts
 */
async function listDrafts(userId, params = {}) {
  const { maxResults = 20 } = params;
  
  try {
    const { gmail } = await getGmailClient(userId);
    
    const response = await gmail.users.drafts.list({
      userId: 'me',
      maxResults: Math.min(maxResults, 100)
    });
    
    const drafts = [];
    for (const draft of response.data.drafts || []) {
      const fullDraft = await gmail.users.drafts.get({
        userId: 'me',
        id: draft.id,
        format: 'full'
      });
      
      const headers = parseEmailHeaders(fullDraft.data.message.payload?.headers || []);
      drafts.push({
        id: draft.id,
        messageId: fullDraft.data.message.id,
        to: headers.to,
        subject: headers.subject,
        snippet: fullDraft.data.message.snippet
      });
    }
    
    return {
      success: true,
      count: drafts.length,
      drafts: drafts
    };
    
  } catch (error) {
    console.error('List drafts error:', error);
    throw new Error(`Failed to list drafts: ${error.message}`);
  }
}

/**
 * Update a draft
 */
async function updateDraft(userId, params) {
  const { draftId, to, subject, body, cc, bcc } = params;
  
  if (!draftId) {
    throw new Error("Missing required field: draftId");
  }
  
  try {
    const { gmail } = await getGmailClient(userId);
    
    // Get existing draft to preserve fields not being updated
    const existingDraft = await gmail.users.drafts.get({
      userId: 'me',
      id: draftId,
      format: 'full'
    });
    
    const existingHeaders = parseEmailHeaders(existingDraft.data.message.payload?.headers || []);
    const existingBody = getMessageBody(existingDraft.data.message.payload);
    
    const messageParts = [];
    messageParts.push(`To: ${to || existingHeaders.to}`);
    if (cc || existingHeaders.cc) messageParts.push(`Cc: ${cc || existingHeaders.cc}`);
    if (bcc) messageParts.push(`Bcc: ${bcc}`);
    messageParts.push(`Subject: ${subject || existingHeaders.subject}`);
    messageParts.push('MIME-Version: 1.0');
    messageParts.push('Content-Type: text/plain; charset=utf-8');
    messageParts.push('');
    messageParts.push(body || existingBody);
    
    const rawMessage = messageParts.join('\r\n');
    const encodedMessage = Buffer.from(rawMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    
    const response = await gmail.users.drafts.update({
      userId: 'me',
      id: draftId,
      requestBody: {
        message: {
          raw: encodedMessage
        }
      }
    });
    
    return {
      success: true,
      draftId: response.data.id,
      message: 'Draft updated successfully'
    };
    
  } catch (error) {
    console.error('Update draft error:', error);
    throw new Error(`Failed to update draft: ${error.message}`);
  }
}

/**
 * Delete a draft
 */
async function deleteDraft(userId, params) {
  const { draftId } = params;
  
  if (!draftId) {
    throw new Error("Missing required field: draftId");
  }
  
  try {
    const { gmail } = await getGmailClient(userId);
    
    await gmail.users.drafts.delete({
      userId: 'me',
      id: draftId
    });
    
    return {
      success: true,
      draftId: draftId,
      message: 'Draft deleted successfully'
    };
    
  } catch (error) {
    console.error('Delete draft error:', error);
    throw new Error(`Failed to delete draft: ${error.message}`);
  }
}

/**
 * Send a draft
 */
async function sendDraft(userId, params) {
  const { draftId } = params;
  
  if (!draftId) {
    throw new Error("Missing required field: draftId");
  }
  
  try {
    const { gmail } = await getGmailClient(userId);
    
    const response = await gmail.users.drafts.send({
      userId: 'me',
      requestBody: {
        id: draftId
      }
    });
    
    return {
      success: true,
      messageId: response.data.id,
      threadId: response.data.threadId,
      message: 'Draft sent successfully'
    };
    
  } catch (error) {
    console.error('Send draft error:', error);
    throw new Error(`Failed to send draft: ${error.message}`);
  }
}

// ============================================================
// LABEL MANAGEMENT FUNCTIONS
// ============================================================

/**
 * List all labels
 */
async function listLabels(userId, params = {}) {
  try {
    const { gmail } = await getGmailClient(userId);
    
    const response = await gmail.users.labels.list({
      userId: 'me'
    });
    
    const labels = (response.data.labels || []).map(label => ({
      id: label.id,
      name: label.name,
      type: label.type,
      messagesTotal: label.messagesTotal,
      messagesUnread: label.messagesUnread
    }));
    
    return {
      success: true,
      count: labels.length,
      labels: labels
    };
    
  } catch (error) {
    console.error('List labels error:', error);
    throw new Error(`Failed to list labels: ${error.message}`);
  }
}

/**
 * Create a new label
 */
async function createLabel(userId, params) {
  const { name, labelListVisibility = 'labelShow', messageListVisibility = 'show' } = params;
  
  if (!name) {
    throw new Error("Missing required field: name");
  }
  
  try {
    const { gmail } = await getGmailClient(userId);
    
    const response = await gmail.users.labels.create({
      userId: 'me',
      requestBody: {
        name: name,
        labelListVisibility: labelListVisibility,
        messageListVisibility: messageListVisibility
      }
    });
    
    return {
      success: true,
      labelId: response.data.id,
      name: response.data.name,
      message: 'Label created successfully'
    };
    
  } catch (error) {
    console.error('Create label error:', error);
    throw new Error(`Failed to create label: ${error.message}`);
  }
}

/**
 * Apply labels to an email
 */
async function applyLabels(userId, params) {
  const { messageId, labelIds } = params;
  
  if (!messageId || !labelIds || !labelIds.length) {
    throw new Error("Missing required fields: messageId and labelIds are required");
  }
  
  try {
    const { gmail } = await getGmailClient(userId);
    
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        addLabelIds: labelIds
      }
    });
    
    return {
      success: true,
      messageId: messageId,
      labelsApplied: labelIds,
      message: 'Labels applied successfully'
    };
    
  } catch (error) {
    console.error('Apply labels error:', error);
    throw new Error(`Failed to apply labels: ${error.message}`);
  }
}

/**
 * Remove labels from an email
 */
async function removeLabels(userId, params) {
  const { messageId, labelIds } = params;
  
  if (!messageId || !labelIds || !labelIds.length) {
    throw new Error("Missing required fields: messageId and labelIds are required");
  }
  
  try {
    const { gmail } = await getGmailClient(userId);
    
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        removeLabelIds: labelIds
      }
    });
    
    return {
      success: true,
      messageId: messageId,
      labelsRemoved: labelIds,
      message: 'Labels removed successfully'
    };
    
  } catch (error) {
    console.error('Remove labels error:', error);
    throw new Error(`Failed to remove labels: ${error.message}`);
  }
}

/**
 * Delete a label
 */
async function deleteLabel(userId, params) {
  const { labelId } = params;
  
  if (!labelId) {
    throw new Error("Missing required field: labelId");
  }
  
  try {
    const { gmail } = await getGmailClient(userId);
    
    await gmail.users.labels.delete({
      userId: 'me',
      id: labelId
    });
    
    return {
      success: true,
      labelId: labelId,
      message: 'Label deleted successfully'
    };
    
  } catch (error) {
    console.error('Delete label error:', error);
    throw new Error(`Failed to delete label: ${error.message}`);
  }
}

// ============================================================
// FILTER MANAGEMENT FUNCTIONS
// ============================================================

/**
 * List all filters
 */
async function listFilters(userId, params = {}) {
  try {
    const { gmail } = await getGmailClient(userId);
    
    const response = await gmail.users.settings.filters.list({
      userId: 'me'
    });
    
    const filters = (response.data.filter || []).map(filter => ({
      id: filter.id,
      criteria: filter.criteria,
      action: filter.action
    }));
    
    return {
      success: true,
      count: filters.length,
      filters: filters
    };
    
  } catch (error) {
    console.error('List filters error:', error);
    throw new Error(`Failed to list filters: ${error.message}`);
  }
}

/**
 * Create a filter
 */
async function createFilter(userId, params) {
  const { criteria, action } = params;
  
  if (!criteria || !action) {
    throw new Error("Missing required fields: criteria and action are required");
  }
  
  try {
    const { gmail } = await getGmailClient(userId);
    
    // Build filter action
    const filterAction = {};
    if (action.addLabelIds) filterAction.addLabelIds = action.addLabelIds;
    if (action.removeLabelIds) filterAction.removeLabelIds = action.removeLabelIds;
    if (action.forward) filterAction.forward = action.forward;
    if (action.markAsRead) filterAction.removeLabelIds = [...(filterAction.removeLabelIds || []), 'UNREAD'];
    if (action.star) filterAction.addLabelIds = [...(filterAction.addLabelIds || []), 'STARRED'];
    if (action.archive) filterAction.removeLabelIds = [...(filterAction.removeLabelIds || []), 'INBOX'];
    if (action.trash) filterAction.addLabelIds = [...(filterAction.addLabelIds || []), 'TRASH'];
    
    const response = await gmail.users.settings.filters.create({
      userId: 'me',
      requestBody: {
        criteria: criteria,
        action: filterAction
      }
    });
    
    return {
      success: true,
      filterId: response.data.id,
      criteria: response.data.criteria,
      action: response.data.action,
      message: 'Filter created successfully'
    };
    
  } catch (error) {
    console.error('Create filter error:', error);
    throw new Error(`Failed to create filter: ${error.message}`);
  }
}

/**
 * Delete a filter
 */
async function deleteFilter(userId, params) {
  const { filterId } = params;
  
  if (!filterId) {
    throw new Error("Missing required field: filterId");
  }
  
  try {
    const { gmail } = await getGmailClient(userId);
    
    await gmail.users.settings.filters.delete({
      userId: 'me',
      id: filterId
    });
    
    return {
      success: true,
      filterId: filterId,
      message: 'Filter deleted successfully'
    };
    
  } catch (error) {
    console.error('Delete filter error:', error);
    throw new Error(`Failed to delete filter: ${error.message}`);
  }
}

// ============================================================
// EMAIL ACTION FUNCTIONS
// ============================================================

/**
 * Mark email as read
 */
async function markAsRead(userId, params) {
  const { messageId } = params;
  
  if (!messageId) {
    throw new Error("Missing required field: messageId");
  }
  
  try {
    const { gmail } = await getGmailClient(userId);
    
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        removeLabelIds: ['UNREAD']
      }
    });
    
    return {
      success: true,
      messageId: messageId,
      message: 'Email marked as read'
    };
    
  } catch (error) {
    console.error('Mark as read error:', error);
    throw new Error(`Failed to mark as read: ${error.message}`);
  }
}

/**
 * Mark email as unread
 */
async function markAsUnread(userId, params) {
  const { messageId } = params;
  
  if (!messageId) {
    throw new Error("Missing required field: messageId");
  }
  
  try {
    const { gmail } = await getGmailClient(userId);
    
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        addLabelIds: ['UNREAD']
      }
    });
    
    return {
      success: true,
      messageId: messageId,
      message: 'Email marked as unread'
    };
    
  } catch (error) {
    console.error('Mark as unread error:', error);
    throw new Error(`Failed to mark as unread: ${error.message}`);
  }
}

/**
 * Star/unstar an email
 */
async function starEmail(userId, params) {
  const { messageId, starred = true } = params;
  
  if (!messageId) {
    throw new Error("Missing required field: messageId");
  }
  
  try {
    const { gmail } = await getGmailClient(userId);
    
    const requestBody = starred 
      ? { addLabelIds: ['STARRED'] }
      : { removeLabelIds: ['STARRED'] };
    
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: requestBody
    });
    
    return {
      success: true,
      messageId: messageId,
      starred: starred,
      message: starred ? 'Email starred' : 'Email unstarred'
    };
    
  } catch (error) {
    console.error('Star email error:', error);
    throw new Error(`Failed to star email: ${error.message}`);
  }
}

/**
 * Move email to trash
 */
async function trashEmail(userId, params) {
  const { messageId } = params;
  
  if (!messageId) {
    throw new Error("Missing required field: messageId");
  }
  
  try {
    const { gmail } = await getGmailClient(userId);
    
    await gmail.users.messages.trash({
      userId: 'me',
      id: messageId
    });
    
    return {
      success: true,
      messageId: messageId,
      message: 'Email moved to trash'
    };
    
  } catch (error) {
    console.error('Trash email error:', error);
    throw new Error(`Failed to trash email: ${error.message}`);
  }
}

/**
 * Archive an email (remove from inbox)
 */
async function archiveEmail(userId, params) {
  const { messageId } = params;
  
  if (!messageId) {
    throw new Error("Missing required field: messageId");
  }
  
  try {
    const { gmail } = await getGmailClient(userId);
    
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        removeLabelIds: ['INBOX']
      }
    });
    
    return {
      success: true,
      messageId: messageId,
      message: 'Email archived'
    };
    
  } catch (error) {
    console.error('Archive email error:', error);
    throw new Error(`Failed to archive email: ${error.message}`);
  }
}

module.exports = {
  // Original functions
  getGmailMessages,
  storeGmailMessages,
  refreshGmailToken,
  sendEmail,
  sendEmailForUser,
  handleEmailPrompt,
  SCOPES,
  
  // Helper functions
  getGmailClient,
  getMessageBody,
  parseEmailHeaders,
  formatEmail,
  
  // Agent tool functions - Email Sending
  sendEmailForAgent,
  replyToEmail,
  forwardEmail,
  
  // Agent tool functions - Email Reading
  readEmail,
  getLatestEmails,
  getUnreadEmails,
  
  // Agent tool functions - Email Search
  searchEmails,
  getEmailsByThread,
  getEmailsBySender,
  
  // Agent tool functions - Draft Management
  createDraft,
  listDrafts,
  updateDraft,
  deleteDraft,
  sendDraft,
  
  // Agent tool functions - Label Management
  listLabels,
  createLabel,
  applyLabels,
  removeLabels,
  deleteLabel,
  
  // Agent tool functions - Filter Management
  listFilters,
  createFilter,
  deleteFilter,
  
  // Agent tool functions - Email Actions
  markAsRead,
  markAsUnread,
  starEmail,
  trashEmail,
  archiveEmail
};
