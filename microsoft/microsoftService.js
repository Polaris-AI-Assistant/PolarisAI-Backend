/**
 * Microsoft Graph API Service
 * 
 * Provides functions for interacting with Microsoft 365 APIs via Microsoft Graph
 * Includes token refresh, Outlook, Calendar, OneDrive, and Excel operations
 */

const axios = require('axios');
const supabase = require('../supabase/supabaseConnect');
const { refreshAccessToken, MICROSOFT_GRAPH_URL } = require('./microsoftAuth');
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');

/**
 * Get valid access token for user, refreshing if needed
 * @param {string} userId - User ID
 * @returns {object} Token data with access_token and email
 */
async function getValidTokens(userId) {
  const { data: tokenRow, error } = await supabase
    .from('microsoft_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !tokenRow) {
    throw new Error('Microsoft not connected. Please connect Microsoft apps first.');
  }

  // Check if token is expired or about to expire (within 5 minutes)
  const expiresAt = new Date(tokenRow.expires_at);
  const now = new Date();
  const fiveMinutes = 5 * 60 * 1000;

  if (expiresAt.getTime() - now.getTime() < fiveMinutes) {
    console.log('[Microsoft] Token expired or expiring soon, refreshing...');
    
    try {
      const newTokens = await refreshAccessToken(tokenRow.refresh_token);
      const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();

      await supabase
        .from('microsoft_tokens')
        .update({
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token || tokenRow.refresh_token,
          expires_at: newExpiresAt,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      return {
        access_token: newTokens.access_token,
        email: tokenRow.email,
        granted_scopes: tokenRow.granted_scopes || [],
        connected_apps: tokenRow.connected_apps || {}
      };
    } catch (refreshError) {
      console.error('[Microsoft] Token refresh failed:', refreshError);
      throw new Error('Failed to refresh Microsoft token. Please reconnect.');
    }
  }

  return {
    access_token: tokenRow.access_token,
    email: tokenRow.email,
    granted_scopes: tokenRow.granted_scopes || [],
    connected_apps: tokenRow.connected_apps || {}
  };
}

/**
 * Make authenticated request to Microsoft Graph API
 * @param {string} userId - User ID
 * @param {string} endpoint - Graph API endpoint (e.g., '/me/messages')
 * @param {string} method - HTTP method
 * @param {object} data - Request body (for POST/PATCH)
 * @param {object} params - Query parameters
 * @returns {object} Response data
 */
async function graphRequest(userId, endpoint, method = 'GET', data = null, params = {}, customHeaders = {}) {
  const tokens = await getValidTokens(userId);
  
  const config = {
    method: method,
    url: `${MICROSOFT_GRAPH_URL}${endpoint}`,
    headers: {
      'Authorization': `Bearer ${tokens.access_token}`,
      'Content-Type': 'application/json',
      ...customHeaders
    },
    params: params
  };

  if (data && ['POST', 'PATCH', 'PUT'].includes(method.toUpperCase())) {
    config.data = data;
  }

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`[Microsoft Graph] Error ${method} ${endpoint}:`, error.response?.data || error.message);
    throw error;
  }
}

// ==================== OUTLOOK MAIL ====================

/**
 * List emails from user's inbox
 * @param {string} userId - User ID
 * @param {object} options - Query options
 * @returns {array} List of emails
 */
async function listEmails(userId, options = {}) {
  const { 
    folder = 'inbox',
    top = 20, 
    skip = 0,
    filter = null,
    search = null,
    orderBy = 'receivedDateTime desc'
  } = options;

  let endpoint = `/me/mailFolders/${folder}/messages`;
  const params = {
    '$top': top,
    '$skip': skip,
    '$orderby': orderBy,
    '$select': 'id,subject,from,toRecipients,receivedDateTime,bodyPreview,isRead,hasAttachments,importance'
  };

  if (filter) params['$filter'] = filter;
  if (search) params['$search'] = `"${search}"`;

  const response = await graphRequest(userId, endpoint, 'GET', null, params);
  return response.value || [];
}

/**
 * Get a specific email by ID
 * @param {string} userId - User ID
 * @param {string} messageId - Email message ID
 * @returns {object} Email details
 */
async function getEmail(userId, messageId) {
  const response = await graphRequest(userId, `/me/messages/${messageId}`, 'GET', null, {
    '$select': 'id,subject,from,toRecipients,ccRecipients,bccRecipients,receivedDateTime,body,isRead,hasAttachments,importance,internetMessageHeaders'
  });
  return response;
}

/**
 * Send an email
 * @param {string} userId - User ID
 * @param {object} email - Email details
 * @returns {object} Send result
 */
async function sendEmail(userId, email) {
  const { to, subject, body, cc = [], bcc = [], isHtml = true, attachments = [] } = email;

  // Build recipients arrays
  const toRecipients = (Array.isArray(to) ? to : [to]).map(addr => ({
    emailAddress: { address: addr }
  }));

  const ccRecipients = (Array.isArray(cc) ? cc : cc ? [cc] : []).map(addr => ({
    emailAddress: { address: addr }
  }));

  const bccRecipients = (Array.isArray(bcc) ? bcc : bcc ? [bcc] : []).map(addr => ({
    emailAddress: { address: addr }
  }));

  // Convert newlines to HTML line breaks if sending as HTML
  let emailBody = body;
  if (isHtml && body) {
    // Convert \n to <br> for HTML emails, but preserve existing HTML
    if (!body.includes('<br>') && !body.includes('<p>') && !body.includes('<div>')) {
      emailBody = body.replace(/\n/g, '<br>');
    }
  }

  const messagePayload = {
    message: {
      subject: subject,
      body: {
        contentType: isHtml ? 'HTML' : 'Text',
        content: emailBody
      },
      toRecipients: toRecipients,
      ccRecipients: ccRecipients,
      bccRecipients: bccRecipients
    },
    saveToSentItems: true
  };

  // Add attachments if any
  if (attachments.length > 0) {
    messagePayload.message.attachments = attachments.map(att => ({
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: att.name,
      contentType: att.contentType || 'application/octet-stream',
      contentBytes: att.contentBytes // Base64 encoded
    }));
  }

  await graphRequest(userId, '/me/sendMail', 'POST', messagePayload);
  return { success: true, message: 'Email sent successfully' };
}

/**
 * Reply to an email
 * @param {string} userId - User ID
 * @param {string} messageId - Original message ID
 * @param {string} comment - Reply body
 * @returns {object} Reply result
 */
async function replyToEmail(userId, messageId, comment) {
  await graphRequest(userId, `/me/messages/${messageId}/reply`, 'POST', {
    comment: comment
  });
  return { success: true, message: 'Reply sent successfully' };
}

/**
 * Forward an email
 * @param {string} userId - User ID
 * @param {string} messageId - Message ID
 * @param {string[]} toRecipients - Recipients to forward to
 * @param {string} comment - Optional comment
 * @returns {object} Forward result
 */
async function forwardEmail(userId, messageId, toRecipients, comment = '') {
  await graphRequest(userId, `/me/messages/${messageId}/forward`, 'POST', {
    comment: comment,
    toRecipients: toRecipients.map(addr => ({
      emailAddress: { address: addr }
    }))
  });
  return { success: true, message: 'Email forwarded successfully' };
}

/**
 * Mark email as read/unread
 * @param {string} userId - User ID
 * @param {string} messageId - Message ID
 * @param {boolean} isRead - Read status
 * @returns {object} Result
 */
async function markEmailRead(userId, messageId, isRead = true) {
  await graphRequest(userId, `/me/messages/${messageId}`, 'PATCH', {
    isRead: isRead
  });
  return { success: true, message: `Email marked as ${isRead ? 'read' : 'unread'}` };
}

/**
 * Mark email as unread
 * @param {string} userId - User ID
 * @param {string} messageId - Message ID
 * @returns {object} Result
 */
async function markEmailUnread(userId, messageId) {
  return markEmailRead(userId, messageId, false);
}

/**
 * List mail folders
 * @param {string} userId - User ID
 * @returns {array} List of mail folders
 */
async function listMailFolders(userId) {
  const response = await graphRequest(userId, '/me/mailFolders', 'GET', null, {
    '$select': 'id,displayName,parentFolderId,childFolderCount,unreadItemCount,totalItemCount'
  });
  return response.value || [];
}

/**
 * Delete an email
 * @param {string} userId - User ID
 * @param {string} messageId - Message ID
 * @returns {object} Delete result
 */
async function deleteEmail(userId, messageId) {
  await graphRequest(userId, `/me/messages/${messageId}`, 'DELETE');
  return { success: true, message: 'Email deleted successfully' };
}

// ==================== CALENDAR ====================

/**
 * List calendar events
 * @param {string} userId - User ID
 * @param {object} options - Query options
 * @returns {array} List of events
 */
async function listCalendarEvents(userId, options = {}) {
  const {
    startDateTime = new Date().toISOString(),
    endDateTime = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ahead
    top = 50,
    calendarId = null
  } = options;

  const endpoint = calendarId 
    ? `/me/calendars/${calendarId}/events`
    : '/me/calendar/events';

  const params = {
    '$top': top,
    '$orderby': 'start/dateTime',
    '$select': 'id,subject,body,start,end,location,organizer,attendees,isOnlineMeeting,onlineMeetingUrl,recurrence',
    '$filter': `start/dateTime ge '${startDateTime}' and end/dateTime le '${endDateTime}'`
  };

  const response = await graphRequest(userId, endpoint, 'GET', null, params);
  return response.value || [];
}

/**
 * Get a specific calendar event
 * @param {string} userId - User ID
 * @param {string} eventId - Event ID
 * @returns {object} Event details
 */
async function getCalendarEvent(userId, eventId) {
  return await graphRequest(userId, `/me/events/${eventId}`);
}

/**
 * Create a calendar event
 * @param {string} userId - User ID
 * @param {object} event - Event details
 * @returns {object} Created event
 */
async function createCalendarEvent(userId, event) {
  const {
    subject,
    body = '',
    start,
    end,
    timeZone = 'UTC',
    location = '',
    attendees = [],
    isOnlineMeeting = false,
    onlineMeetingProvider = 'teamsForBusiness'
  } = event;

  const eventPayload = {
    subject: subject,
    body: {
      contentType: 'HTML',
      content: body
    },
    start: {
      dateTime: start,
      timeZone: timeZone
    },
    end: {
      dateTime: end,
      timeZone: timeZone
    },
    location: {
      displayName: location
    },
    attendees: attendees.map(email => ({
      emailAddress: { address: email },
      type: 'required'
    }))
  };

  // Add Teams meeting if requested
  if (isOnlineMeeting) {
    eventPayload.isOnlineMeeting = true;
    eventPayload.onlineMeetingProvider = onlineMeetingProvider;
  }

  const response = await graphRequest(userId, '/me/events', 'POST', eventPayload);
  return response;
}

/**
 * Update a calendar event
 * @param {string} userId - User ID
 * @param {string} eventId - Event ID
 * @param {object} updates - Event updates
 * @returns {object} Updated event
 */
async function updateCalendarEvent(userId, eventId, updates) {
  const response = await graphRequest(userId, `/me/events/${eventId}`, 'PATCH', updates);
  return response;
}

/**
 * Delete a calendar event
 * @param {string} userId - User ID
 * @param {string} eventId - Event ID
 * @returns {object} Delete result
 */
async function deleteCalendarEvent(userId, eventId) {
  await graphRequest(userId, `/me/events/${eventId}`, 'DELETE');
  return { success: true, message: 'Event deleted successfully' };
}

/**
 * List user's calendars
 * @param {string} userId - User ID
 * @returns {array} List of calendars
 */
async function listCalendars(userId) {
  const response = await graphRequest(userId, '/me/calendars', 'GET', null, {
    '$select': 'id,name,color,isDefaultCalendar,owner'
  });
  return response.value || [];
}

// ==================== ONEDRIVE ====================

/**
 * List files in OneDrive root or folder
 * @param {string} userId - User ID
 * @param {object} options - Query options
 * @returns {array} List of files/folders
 */
async function listFiles(userId, options = {}) {
  const { 
    folderId = 'root',
    top = 50,
    orderBy = 'name'
  } = options;

  const endpoint = folderId === 'root' 
    ? '/me/drive/root/children'
    : `/me/drive/items/${folderId}/children`;

  const params = {
    '$top': top,
    '$orderby': orderBy,
    '$select': 'id,name,size,createdDateTime,lastModifiedDateTime,webUrl,file,folder,parentReference'
  };

  const response = await graphRequest(userId, endpoint, 'GET', null, params);
  return response.value || [];
}

/**
 * Search files in OneDrive
 * @param {string} userId - User ID
 * @param {string} query - Search query
 * @returns {array} Search results
 */
async function searchFiles(userId, query) {
  const response = await graphRequest(userId, `/me/drive/root/search(q='${encodeURIComponent(query)}')`, 'GET', null, {
    '$top': 50,
    '$select': 'id,name,size,createdDateTime,lastModifiedDateTime,webUrl,file,folder'
  });
  return response.value || [];
}

/**
 * Get file metadata
 * @param {string} userId - User ID
 * @param {string} itemId - File/folder ID
 * @returns {object} File metadata
 */
async function getFileMetadata(userId, itemId) {
  return await graphRequest(userId, `/me/drive/items/${itemId}`);
}

/**
 * Download file content
 * @param {string} userId - User ID
 * @param {string} itemId - File ID
 * @returns {Buffer} File content
 */
async function downloadFile(userId, itemId) {
  const tokens = await getValidTokens(userId);
  
  const response = await axios({
    method: 'GET',
    url: `${MICROSOFT_GRAPH_URL}/me/drive/items/${itemId}/content`,
    headers: {
      'Authorization': `Bearer ${tokens.access_token}`
    },
    responseType: 'arraybuffer'
  });

  return response.data;
}

/**
 * Get file content as text (for readable files) or preview URL
 * @param {string} userId - User ID
 * @param {string} itemId - File ID or file name to search
 * @returns {object} File content or preview information
 */
async function getFileContent(userId, itemIdOrName) {
  const tokens = await getValidTokens(userId);
  
  let fileMetadata;
  let itemId = itemIdOrName;
  
  // If it looks like a filename, search for it first
  if (itemIdOrName.includes('.')) {
    const searchResults = await searchFiles(userId, itemIdOrName);
    const matchingFile = searchResults.find(f => 
      f.name.toLowerCase() === itemIdOrName.toLowerCase()
    );
    if (matchingFile) {
      itemId = matchingFile.id;
      fileMetadata = matchingFile;
    } else if (searchResults.length > 0) {
      // Use first result if exact match not found
      itemId = searchResults[0].id;
      fileMetadata = searchResults[0];
    } else {
      return { success: false, error: `File "${itemIdOrName}" not found in OneDrive` };
    }
  }
  
  // Get file metadata if not already fetched
  if (!fileMetadata) {
    fileMetadata = await getFileMetadata(userId, itemId);
  }
  
  const fileName = fileMetadata.name || '';
  const extension = fileName.split('.').pop()?.toLowerCase();
  const mimeType = fileMetadata.file?.mimeType || '';
  
  // Text-based files that can be read directly
  const textExtensions = ['txt', 'md', 'json', 'js', 'ts', 'py', 'html', 'css', 'xml', 'csv', 'log', 'yaml', 'yml'];
  
  if (textExtensions.includes(extension)) {
    try {
      const content = await downloadFile(userId, itemId);
      return {
        success: true,
        fileName: fileName,
        content: content.toString('utf-8'),
        mimeType: mimeType,
        type: 'text'
      };
    } catch (error) {
      return { success: false, error: `Failed to read file: ${error.message}` };
    }
  }
  
  // For Office documents, try to get a preview or conversion
  const officeExtensions = ['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt'];
  
  if (officeExtensions.includes(extension)) {
    // Get preview URL and web URL for Office files
    try {
      const previewResponse = await graphRequest(userId, `/me/drive/items/${itemId}/preview`, 'POST', {});
      return {
        success: true,
        fileName: fileName,
        type: 'office_document',
        previewUrl: previewResponse.getUrl,
        webUrl: fileMetadata.webUrl,
        message: `This is a ${extension.toUpperCase()} file. You can view it at: ${fileMetadata.webUrl}`,
        size: fileMetadata.size,
        lastModified: fileMetadata.lastModifiedDateTime
      };
    } catch (previewError) {
      // Fallback to just providing the web URL
      return {
        success: true,
        fileName: fileName,
        type: 'office_document',
        webUrl: fileMetadata.webUrl,
        message: `This is a ${extension.toUpperCase()} file. You can view it at: ${fileMetadata.webUrl}`,
        size: fileMetadata.size,
        lastModified: fileMetadata.lastModifiedDateTime
      };
    }
  }
  
  // For images, provide thumbnail and download URL
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'];
  
  if (imageExtensions.includes(extension)) {
    return {
      success: true,
      fileName: fileName,
      type: 'image',
      webUrl: fileMetadata.webUrl,
      downloadUrl: fileMetadata['@microsoft.graph.downloadUrl'],
      thumbnailUrl: fileMetadata.thumbnails?.[0]?.large?.url,
      size: fileMetadata.size
    };
  }
  
  // For other files, provide download URL
  return {
    success: true,
    fileName: fileName,
    type: 'binary',
    webUrl: fileMetadata.webUrl,
    downloadUrl: fileMetadata['@microsoft.graph.downloadUrl'],
    message: `This file can be downloaded from: ${fileMetadata.webUrl}`,
    size: fileMetadata.size,
    mimeType: mimeType
  };
}

/**
 * Upload file to OneDrive
 * @param {string} userId - User ID
 * @param {string} fileName - File name
 * @param {Buffer|string} content - File content
 * @param {string} parentFolderId - Parent folder ID (default: root)
 * @returns {object} Uploaded file metadata
 */
async function uploadFile(userId, fileName, content, parentFolderId = 'root') {
  const tokens = await getValidTokens(userId);
  
  const endpoint = parentFolderId === 'root'
    ? `/me/drive/root:/${encodeURIComponent(fileName)}:/content`
    : `/me/drive/items/${parentFolderId}:/${encodeURIComponent(fileName)}:/content`;

  const response = await axios({
    method: 'PUT',
    url: `${MICROSOFT_GRAPH_URL}${endpoint}`,
    headers: {
      'Authorization': `Bearer ${tokens.access_token}`,
      'Content-Type': 'application/octet-stream'
    },
    data: content
  });

  return response.data;
}

/**
 * Create folder in OneDrive
 * @param {string} userId - User ID
 * @param {string} folderName - Folder name
 * @param {string} parentFolderId - Parent folder ID (default: root)
 * @returns {object} Created folder metadata
 */
async function createFolder(userId, folderName, parentFolderId = 'root') {
  const endpoint = parentFolderId === 'root'
    ? '/me/drive/root/children'
    : `/me/drive/items/${parentFolderId}/children`;

  return await graphRequest(userId, endpoint, 'POST', {
    name: folderName,
    folder: {},
    '@microsoft.graph.conflictBehavior': 'rename'
  });
}

/**
 * Delete file or folder
 * @param {string} userId - User ID
 * @param {string} itemId - File/folder ID
 * @returns {object} Delete result
 */
async function deleteFile(userId, itemId) {
  await graphRequest(userId, `/me/drive/items/${itemId}`, 'DELETE');
  return { success: true, message: 'Item deleted successfully' };
}

// ==================== EXCEL ====================

/**
 * List worksheets in Excel workbook
 * @param {string} userId - User ID
 * @param {string} workbookId - Workbook file ID in OneDrive
 * @returns {array} List of worksheets
 */
async function listWorksheets(userId, workbookId) {
  const response = await graphRequest(userId, `/me/drive/items/${workbookId}/workbook/worksheets`);
  return response.value || [];
}

/**
 * Get used range in worksheet
 * @param {string} userId - User ID
 * @param {string} workbookId - Workbook ID
 * @param {string} worksheetName - Worksheet name
 * @returns {object} Range data
 */
async function getWorksheetRange(userId, workbookId, worksheetName) {
  return await graphRequest(
    userId, 
    `/me/drive/items/${workbookId}/workbook/worksheets/${encodeURIComponent(worksheetName)}/usedRange`
  );
}

/**
 * Get specific range in worksheet
 * @param {string} userId - User ID
 * @param {string} workbookId - Workbook ID
 * @param {string} worksheetName - Worksheet name
 * @param {string} range - Range address (e.g., 'A1:C10')
 * @returns {object} Range data
 */
async function getRange(userId, workbookId, worksheetName, range) {
  return await graphRequest(
    userId,
    `/me/drive/items/${workbookId}/workbook/worksheets/${encodeURIComponent(worksheetName)}/range(address='${range}')`
  );
}

/**
 * Update range in worksheet
 * @param {string} userId - User ID
 * @param {string} workbookId - Workbook ID
 * @param {string} worksheetName - Worksheet name
 * @param {string} range - Range address
 * @param {array[]} values - 2D array of values
 * @returns {object} Updated range
 */
async function updateRange(userId, workbookId, worksheetName, range, values) {
  return await graphRequest(
    userId,
    `/me/drive/items/${workbookId}/workbook/worksheets/${encodeURIComponent(worksheetName)}/range(address='${range}')`,
    'PATCH',
    { values: values }
  );
}

/**
 * Add worksheet to workbook
 * @param {string} userId - User ID
 * @param {string} workbookId - Workbook ID
 * @param {string} name - Worksheet name
 * @returns {object} Created worksheet
 */
async function addWorksheet(userId, workbookId, name) {
  return await graphRequest(
    userId,
    `/me/drive/items/${workbookId}/workbook/worksheets`,
    'POST',
    { name: name }
  );
}

/**
 * Create table in worksheet
 * @param {string} userId - User ID
 * @param {string} workbookId - Workbook ID
 * @param {string} worksheetName - Worksheet name
 * @param {string} range - Range for table
 * @param {boolean} hasHeaders - Whether first row has headers
 * @returns {object} Created table
 */
async function createTable(userId, workbookId, worksheetName, range, hasHeaders = true) {
  return await graphRequest(
    userId,
    `/me/drive/items/${workbookId}/workbook/worksheets/${encodeURIComponent(worksheetName)}/tables/add`,
    'POST',
    {
      address: range,
      hasHeaders: hasHeaders
    }
  );
}

/**
 * Delete a worksheet from workbook
 * @param {string} userId - User ID
 * @param {string} workbookId - Workbook ID
 * @param {string} worksheetName - Worksheet name to delete
 * @returns {object} Result
 */
async function deleteWorksheet(userId, workbookId, worksheetName) {
  await graphRequest(
    userId,
    `/me/drive/items/${workbookId}/workbook/worksheets/${encodeURIComponent(worksheetName)}`,
    'DELETE'
  );
  return { success: true, message: `Worksheet "${worksheetName}" deleted successfully` };
}

/**
 * Append row to a table in worksheet
 * Uses the used range to find the next available row
 * @param {string} userId - User ID
 * @param {string} workbookId - Workbook ID
 * @param {string} worksheetName - Worksheet name
 * @param {array} values - Array of values for the row
 * @returns {object} Result
 */
async function appendRow(userId, workbookId, worksheetName, values) {
  try {
    // First, get the used range to find the last row
    const usedRange = await getWorksheetRange(userId, workbookId, worksheetName);
    
    // Calculate the next row
    const rowCount = usedRange.rowCount || 1;
    const columnCount = values.length;
    
    // Build the range for the new row (e.g., A2:C2 if values has 3 elements)
    const startColumn = 'A';
    const endColumn = String.fromCharCode(64 + columnCount);
    const newRowNumber = rowCount + 1;
    const range = `${startColumn}${newRowNumber}:${endColumn}${newRowNumber}`;
    
    // Write the row
    await updateRange(userId, workbookId, worksheetName, range, [values]);
    
    return { 
      success: true, 
      message: `Row appended at row ${newRowNumber}`,
      row: newRowNumber,
      range: range
    };
  } catch (error) {
    console.error('Error appending row:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Format a range of cells
 * @param {string} userId - User ID
 * @param {string} workbookId - Workbook ID
 * @param {string} worksheetName - Worksheet name
 * @param {string} range - Range to format (e.g., 'A1:C1')
 * @param {object} format - Format properties (bold, italic, color, backgroundColor, fontSize)
 * @returns {object} Result
 */
async function formatRange(userId, workbookId, worksheetName, range, format) {
  const formatPayload = {};
  
  if (format.bold !== undefined || format.italic !== undefined || format.fontSize) {
    formatPayload.font = {};
    if (format.bold !== undefined) formatPayload.font.bold = format.bold;
    if (format.italic !== undefined) formatPayload.font.italic = format.italic;
    if (format.fontSize) formatPayload.font.size = format.fontSize;
    if (format.color) formatPayload.font.color = format.color;
  }
  
  if (format.backgroundColor) {
    formatPayload.fill = {
      color: format.backgroundColor
    };
  }
  
  return await graphRequest(
    userId,
    `/me/drive/items/${workbookId}/workbook/worksheets/${encodeURIComponent(worksheetName)}/range(address='${range}')/format`,
    'PATCH',
    formatPayload
  );
}

/**
 * Create a new Excel workbook in OneDrive
 * @param {string} userId - User ID
 * @param {string} fileName - Workbook name (without .xlsx extension)
 * @param {string} parentFolderId - Parent folder ID (default: root)
 * @returns {object} Created workbook info
 */
async function createExcelWorkbook(userId, fileName, parentFolderId = 'root') {
  try {
    // Ensure the filename has .xlsx extension
    const workbookName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
    
    // Create a minimal valid .xlsx file
    // The simplest approach is to create an empty session and let Microsoft create the file
    // Or we can use the upload endpoint with a template
    
    // First, create an empty file placeholder using special endpoint
    const endpoint = parentFolderId === 'root' 
      ? `/me/drive/root:/${workbookName}:/content`
      : `/me/drive/items/${parentFolderId}:/${workbookName}:/content`;
    
    // For Excel, we need to use the content endpoint with proper mime type
    // Microsoft Graph allows creating Excel files by uploading minimal content
    // However, the proper way is to use the Excel workbook session API
    
    // Alternative: Create via OneDrive with special Excel template
    // First create the file, then create a session
    
    const createResponse = await graphRequest(
      userId,
      endpoint,
      'PUT',
      '', // Empty content - Microsoft will create a valid Excel template
      null,
      {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }
    );
    
    if (createResponse && createResponse.id) {
      // Get the web URL for the workbook
      const webUrl = createResponse.webUrl || `https://onedrive.live.com/edit.aspx?cid=${createResponse.id}`;
      
      return {
        success: true,
        workbookId: createResponse.id,
        name: createResponse.name,
        webUrl: webUrl,
        createdDateTime: createResponse.createdDateTime,
        message: `Excel workbook "${workbookName}" created successfully!`
      };
    }
    
    return {
      success: false,
      error: 'Failed to create Excel workbook'
    };
    
  } catch (error) {
    console.error('Error creating Excel workbook:', error);
    return {
      success: false,
      error: error.message || 'Failed to create Excel workbook'
    };
  }
}

// ==================== TEAMS ====================

/**
 * List teams the user is a member of
 * NOTE: Teams API is only available for work/school Microsoft 365 accounts
 * Personal accounts (@outlook.com, @hotmail.com) do NOT have Teams access
 * @param {string} userId - User ID
 * @returns {array} List of teams or error object
 */
async function listTeams(userId) {
  try {
    const response = await graphRequest(userId, '/me/joinedTeams', 'GET', null, {
      '$select': 'id,displayName,description,createdDateTime,webUrl'
    });
    return response.value || [];
  } catch (error) {
    if (error.response?.status === 403) {
      console.log('[Microsoft Teams] Access denied - likely a personal account');
      return {
        success: false,
        error: 'Microsoft Teams is only available for work/school Microsoft 365 accounts. Personal accounts (@outlook.com, @hotmail.com, @live.com) do not have access to Teams through the API.',
        accountType: 'personal'
      };
    }
    throw error;
  }
}

/**
 * List channels in a team
 * @param {string} userId - User ID
 * @param {string} teamId - Team ID
 * @returns {array} List of channels
 */
async function listChannels(userId, teamId) {
  try {
    const response = await graphRequest(userId, `/teams/${teamId}/channels`, 'GET', null, {
      '$select': 'id,displayName,description,membershipType,webUrl,createdDateTime'
    });
    return response.value || [];
  } catch (error) {
    if (error.response?.status === 403) {
      return {
        success: false,
        error: 'Microsoft Teams is only available for work/school Microsoft 365 accounts.',
        accountType: 'personal'
      };
    }
    throw error;
  }
}

/**
 * List chats the user is part of
 * @param {string} userId - User ID
 * @param {number} top - Maximum number of chats to return
 * @returns {array} List of chats
 */
async function listChats(userId, top = 50) {
  try {
    const response = await graphRequest(userId, '/me/chats', 'GET', null, {
      '$top': top,
      '$orderby': 'lastUpdatedDateTime desc',
      '$expand': 'members',
      '$select': 'id,topic,chatType,createdDateTime,lastUpdatedDateTime,webUrl'
    });
    return response.value || [];
  } catch (error) {
    if (error.response?.status === 403) {
      return {
        success: false,
        error: 'Microsoft Teams chats are only available for work/school Microsoft 365 accounts.',
        accountType: 'personal'
      };
    }
    throw error;
  }
}

/**
 * List messages in a channel
 * @param {string} userId - User ID
 * @param {string} teamId - Team ID
 * @param {string} channelId - Channel ID
 * @param {number} top - Maximum number of messages to return
 * @returns {array} List of messages
 */
async function listChannelMessages(userId, teamId, channelId, top = 50) {
  const response = await graphRequest(
    userId, 
    `/teams/${teamId}/channels/${channelId}/messages`, 
    'GET', 
    null, 
    {
      '$top': top,
      '$orderby': 'createdDateTime desc'
    }
  );
  return response.value || [];
}

/**
 * List messages in a chat
 * @param {string} userId - User ID
 * @param {string} chatId - Chat ID
 * @param {number} top - Maximum number of messages to return
 * @returns {array} List of messages
 */
async function listChatMessages(userId, chatId, top = 50) {
  const response = await graphRequest(userId, `/me/chats/${chatId}/messages`, 'GET', null, {
    '$top': top,
    '$orderby': 'createdDateTime desc'
  });
  return response.value || [];
}

/**
 * Send a message in a chat
 * @param {string} userId - User ID
 * @param {string} chatId - Chat ID
 * @param {string} content - Message content (HTML supported)
 * @returns {object} Sent message
 */
async function sendChatMessage(userId, chatId, content) {
  const response = await graphRequest(userId, `/me/chats/${chatId}/messages`, 'POST', {
    body: {
      content: content,
      contentType: 'html'
    }
  });
  return {
    success: true,
    message: 'Message sent successfully',
    messageId: response.id,
    createdDateTime: response.createdDateTime
  };
}

/**
 * Send a message in a channel
 * @param {string} userId - User ID
 * @param {string} teamId - Team ID
 * @param {string} channelId - Channel ID
 * @param {string} content - Message content (HTML supported)
 * @returns {object} Sent message
 */
async function sendChannelMessage(userId, teamId, channelId, content) {
  const response = await graphRequest(
    userId, 
    `/teams/${teamId}/channels/${channelId}/messages`, 
    'POST', 
    {
      body: {
        content: content,
        contentType: 'html'
      }
    }
  );
  return {
    success: true,
    message: 'Channel message sent successfully',
    messageId: response.id,
    createdDateTime: response.createdDateTime
  };
}

/**
 * Get team details
 * @param {string} userId - User ID
 * @param {string} teamId - Team ID
 * @returns {object} Team details
 */
async function getTeam(userId, teamId) {
  return await graphRequest(userId, `/teams/${teamId}`);
}

// ==================== WORD / DOCUMENTS ====================

/**
 * List Word documents in OneDrive
 * @param {string} userId - User ID
 * @param {object} options - Query options
 * @returns {array} List of Word documents
 */
async function listWordFiles(userId, options = {}) {
  const { 
    folderId = 'root',
    top = 50 
  } = options;
  
  try {
    // Search for Word documents (.docx)
    // Note: Microsoft Graph search doesn't support OR operator in basic format
    const response = await graphRequest(
      userId, 
      `/me/drive/root/search(q='.docx')`,
      'GET',
      null,
      {
        '$top': top,
        '$select': 'id,name,size,createdDateTime,lastModifiedDateTime,webUrl,file,parentReference'
      }
    );
    
    // Filter to only include Word documents
    const wordFiles = (response.value || []).filter(file => {
      const ext = file.name?.split('.').pop()?.toLowerCase();
      return ['docx', 'doc'].includes(ext);
    });
    
    return wordFiles;
  } catch (error) {
    console.error('[Microsoft] Error listing Word files:', error.response?.data || error.message);
    // Return empty array on error instead of throwing
    return [];
  }
}

/**
 * Search for a Word document by name
 * Uses direct file listing instead of search API to avoid indexing delays
 * @param {string} userId - User ID
 * @param {string} fileName - Document name to search for
 * @returns {object} Found document or null
 */
async function searchWordDocumentByName(userId, fileName) {
  try {
    // Clean up the filename for search
    const searchName = fileName.replace('.docx', '').replace('.doc', '').trim();
    
    console.log(`[Microsoft] Searching for Word document: "${searchName}"`);
    
    // Method 1: Try direct path access FIRST (most reliable for known file names)
    // This works immediately for recently created files without indexing delay
    const possibleNames = [
      `${searchName}.docx`,
      `${searchName}.doc`,
      fileName.endsWith('.docx') || fileName.endsWith('.doc') ? fileName : null
    ].filter(Boolean);
    
    for (const name of possibleNames) {
      try {
        console.log(`[Microsoft] Trying direct path access: "${name}"`);
        // Use path-based access instead of item-based
        const response = await graphRequest(
          userId,
          `/me/drive/root:/${encodeURIComponent(name)}`,
          'GET',
          null,
          {
            '$select': 'id,name,size,createdDateTime,lastModifiedDateTime,webUrl,file,parentReference'
          }
        );
        
        if (response && response.id) {
          console.log(`[Microsoft] ✅ Found via direct path: ${response.name} (ID: ${response.id})`);
          return response;
        }
      } catch (directError) {
        // File not found at this path, continue to next attempt
        console.log(`[Microsoft] Direct path not found for "${name}": ${directError.response?.status || directError.message}`);
      }
    }
    
    // Method 2: Direct listing of root folder (for browsing)
    console.log(`[Microsoft] Direct path failed, trying folder listing...`);
    let allFiles = [];
    
    try {
      const rootResponse = await graphRequest(
        userId, 
        `/me/drive/root/children`,
        'GET',
        null,
        {
          '$top': 200,
          '$select': 'id,name,size,createdDateTime,lastModifiedDateTime,webUrl,file,parentReference'
        }
      );
      allFiles = rootResponse.value || [];
      console.log(`[Microsoft] Listed ${allFiles.length} items in root folder`);
    } catch (listError) {
      console.log(`[Microsoft] Root folder listing failed: ${listError.message}`);
    }
    
    // Filter to Word documents
    const wordFiles = allFiles.filter(file => {
      const ext = file.name?.split('.').pop()?.toLowerCase();
      return ['docx', 'doc'].includes(ext);
    });
    
    console.log(`[Microsoft] Found ${wordFiles.length} Word documents in root`);
    if (wordFiles.length > 0) {
      console.log(`[Microsoft] Word files found: ${wordFiles.map(f => f.name).join(', ')}`);
    }
    
    // Look for exact match first (case-insensitive)
    const searchLower = searchName.toLowerCase();
    const exactMatch = wordFiles.find(file => {
      const name = file.name?.toLowerCase().replace('.docx', '').replace('.doc', '');
      return name === searchLower;
    });
    
    if (exactMatch) {
      console.log(`[Microsoft] ✅ Found exact match: ${exactMatch.name} (ID: ${exactMatch.id})`);
      return exactMatch;
    }
    
    // Look for partial match
    const partialMatch = wordFiles.find(file => {
      const name = file.name?.toLowerCase();
      return name.includes(searchLower) || searchLower.includes(name.replace('.docx', '').replace('.doc', ''));
    });
    
    if (partialMatch) {
      console.log(`[Microsoft] ✅ Found partial match: ${partialMatch.name} (ID: ${partialMatch.id})`);
      return partialMatch;
    }
    
    // Method 3: Try search API as fallback (in case file is in subfolder)
    // Note: Search API has indexing delays for recently created files
    console.log(`[Microsoft] No match in root, trying search API (may have delay for new files)...`);
    try {
      const searchResponse = await graphRequest(
        userId, 
        `/me/drive/root/search(q='${encodeURIComponent(searchName)}')`,
        'GET',
        null,
        {
          '$top': 50,
          '$select': 'id,name,size,createdDateTime,lastModifiedDateTime,webUrl,file,parentReference'
        }
      );
      
      const searchFiles = searchResponse.value || [];
      console.log(`[Microsoft] Search API returned ${searchFiles.length} results`);
      
      // Find Word document match from search results
      const searchMatch = searchFiles.find(file => {
        const ext = file.name?.split('.').pop()?.toLowerCase();
        const isWord = ['docx', 'doc'].includes(ext);
        const name = file.name?.toLowerCase().replace('.docx', '').replace('.doc', '');
        return isWord && (name === searchLower || name.includes(searchLower) || searchLower.includes(name));
      });
      
      if (searchMatch) {
        console.log(`[Microsoft] ✅ Found via search: ${searchMatch.name} (ID: ${searchMatch.id})`);
        return searchMatch;
      }
    } catch (searchError) {
      console.log(`[Microsoft] Search API fallback failed:`, searchError.message);
    }
    
    console.log(`[Microsoft] ❌ No matching document found for: "${fileName}"`);
    return null;
  } catch (error) {
    console.error('[Microsoft] Error searching for Word document:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Get Word document content as text
 * Uses the content extract feature for supported formats
 * @param {string} userId - User ID
 * @param {string} itemId - Document ID
 * @returns {object} Document info and text content
 */
async function getWordDocumentContent(userId, itemId) {
  // First get the file metadata
  const metadata = await getFileMetadata(userId, itemId);
  
  // Word documents can be accessed via webUrl or converted to HTML
  try {
    // Try to get the content as HTML for reading
    const tokens = await getValidTokens(userId);
    
    // Get the file content and convert to PDF or HTML for extraction
    // Note: Direct text extraction from docx requires additional processing
    // For now, we return metadata and the preview/web URL
    
    return {
      success: true,
      fileName: metadata.name,
      type: 'word_document',
      webUrl: metadata.webUrl,
      size: metadata.size,
      createdDateTime: metadata.createdDateTime,
      lastModifiedDateTime: metadata.lastModifiedDateTime,
      message: `Word document "${metadata.name}" found. You can view/edit it at: ${metadata.webUrl}`,
      downloadUrl: metadata['@microsoft.graph.downloadUrl']
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to get Word document content'
    };
  }
}

/**
 * Download a Word document
 * @param {string} userId - User ID
 * @param {string} itemId - Document ID
 * @returns {object} Download result with content buffer
 */
async function downloadWordDocument(userId, itemId) {
  try {
    const content = await downloadFile(userId, itemId);
    const metadata = await getFileMetadata(userId, itemId);
    
    return {
      success: true,
      fileName: metadata.name,
      content: content,
      size: metadata.size,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to download Word document'
    };
  }
}

/**
 * Generate HTML content that can be converted to Word format
 * @param {string} title - Document title
 * @param {string} content - Content to add (can be plain text or HTML)
 * @returns {string} HTML string
 */
/**
 * Format content as plain text for Word document
 * Note: Using plain text because HTML-to-DOCX conversion is unreliable
 * and causes corrupted files that can't be opened
 */
function formatWordContent(title, content) {
  // Strip HTML tags if present
  let plainContent = content.replace(/<[^>]+>/g, '');
  
  // Format with title as header
  return `${title}\n${'='.repeat(title.length)}\n\n${plainContent}`;
}

/**
 * Create a new Word document in OneDrive with optional initial content
 * @param {string} userId - User ID
 * @param {string} fileName - Document name (without extension)
 * @param {string} content - Optional initial content (plain text or HTML)
 * @param {string} parentFolderId - Parent folder ID (default: root)
 * @returns {object} Created document info
 */
async function createWordDocument(userId, fileName, content = '', parentFolderId = 'root') {
  try {
    // Clean up the file name - remove any extension
    const baseName = fileName.replace(/\.(docx|doc|txt)$/i, '');
    const docName = `${baseName}.docx`;
    
    // Get tokens for API call
    const tokens = await getValidTokens(userId);
    
    let docxBuffer;
    
    if (content && content.trim()) {
      // When content is provided, create a proper .docx file using docx library
      console.log(`[Microsoft] Creating Word document with content: ${docName}`);
      
      // Parse content into paragraphs
      const contentLines = content.split('\n').filter(line => line.trim());
      
      // Build document sections using docx library
      const children = [];
      
      // Add title as heading
      children.push(
        new Paragraph({
          text: baseName,
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 200 }
        })
      );
      
      // Add each line of content
      for (const line of contentLines) {
        const trimmedLine = line.trim();
        
        // Check if it's a heading (starts with # or ##)
        if (trimmedLine.startsWith('### ')) {
          children.push(
            new Paragraph({
              text: trimmedLine.replace('### ', ''),
              heading: HeadingLevel.HEADING_3,
              spacing: { before: 200, after: 100 }
            })
          );
        } else if (trimmedLine.startsWith('## ')) {
          children.push(
            new Paragraph({
              text: trimmedLine.replace('## ', ''),
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 100 }
            })
          );
        } else if (trimmedLine.startsWith('# ')) {
          children.push(
            new Paragraph({
              text: trimmedLine.replace('# ', ''),
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 200, after: 100 }
            })
          );
        } else {
          // Regular paragraph - handle bold text marked with **
          const textRuns = [];
          const parts = trimmedLine.split(/(\*\*[^*]+\*\*)/g);
          
          for (const part of parts) {
            if (part.startsWith('**') && part.endsWith('**')) {
              textRuns.push(new TextRun({ text: part.slice(2, -2), bold: true }));
            } else if (part) {
              textRuns.push(new TextRun({ text: part }));
            }
          }
          
          children.push(
            new Paragraph({
              children: textRuns,
              spacing: { after: 120 }
            })
          );
        }
      }
      
      // Create the Word document
      const doc = new Document({
        sections: [{
          properties: {},
          children: children
        }]
      });
      
      // Generate the .docx file as a buffer
      docxBuffer = await Packer.toBuffer(doc);
      console.log(`[Microsoft] Generated .docx file (${docxBuffer.length} bytes)`);
      
    } else {
      // Create empty .docx document using docx library
      console.log(`[Microsoft] Creating empty Word document: ${docName}`);
      
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              text: '',
              spacing: { after: 0 }
            })
          ]
        }]
      });
      
      docxBuffer = await Packer.toBuffer(doc);
    }
    
    // Upload to OneDrive
    const endpoint = parentFolderId === 'root' 
      ? `/me/drive/root:/${encodeURIComponent(docName)}:/content`
      : `/me/drive/items/${parentFolderId}:/${encodeURIComponent(docName)}:/content`;
    
    const response = await axios({
      method: 'PUT',
      url: `${MICROSOFT_GRAPH_URL}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      },
      data: docxBuffer
    });
    
    if (response.data && response.data.id) {
      return {
        success: true,
        documentId: response.data.id,
        name: response.data.name,
        webUrl: response.data.webUrl,
        createdDateTime: response.data.createdDateTime,
        message: content 
          ? `Word document "${response.data.name}" created with content successfully!`
          : `Word document "${response.data.name}" created successfully! You can open it to add content.`
      };
    }
    
    return {
      success: false,
      error: 'Failed to create document'
    };
  } catch (error) {
    console.error('Error creating Word document:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message || 'Failed to create Word document'
    };
  }
}

/**
 * Update Word document by uploading new content
 * Note: This replaces the entire document content
 * For editing specific parts, use Microsoft Word online
 * @param {string} userId - User ID
 * @param {string} itemId - Document ID
 * @param {Buffer|string} content - New document content
 * @returns {object} Update result
 */
async function updateWordDocument(userId, itemId, content) {
  try {
    const tokens = await getValidTokens(userId);
    
    const response = await axios({
      method: 'PUT',
      url: `${MICROSOFT_GRAPH_URL}/me/drive/items/${itemId}/content`,
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      },
      data: content
    });
    
    return {
      success: true,
      documentId: response.data.id,
      name: response.data.name,
      webUrl: response.data.webUrl,
      message: `Document "${response.data.name}" updated successfully!`
    };
  } catch (error) {
    console.error('Error updating Word document:', error);
    return {
      success: false,
      error: error.message || 'Failed to update Word document'
    };
  }
}

/**
 * Add content to a Word document
 * Uses the docx library to create proper Word document format
 * Replaces the original document with the new content
 * @param {string} userId - User ID
 * @param {string} fileName - Document name to find
 * @param {string} content - Content to add
 * @param {string} documentId - Optional: Direct document ID (skip search if provided)
 * @returns {object} Result with document info
 */
async function addContentToWordDocument(userId, fileName, content, documentId = null) {
  try {
    let document;
    
    // If documentId is provided, use it directly (no search needed)
    if (documentId) {
      console.log(`[Microsoft] Using provided document ID: ${documentId}`);
      
      try {
        // Get document metadata using the ID directly
        const docInfo = await graphRequest(userId, `/me/drive/items/${documentId}`, 'GET');
        document = {
          id: docInfo.id,
          name: docInfo.name,
          webUrl: docInfo.webUrl
        };
        console.log(`[Microsoft] Found document by ID: ${document.name}`);
      } catch (idError) {
        console.log(`[Microsoft] Document ID ${documentId} not found:`, idError.message);
        return {
          success: false,
          error: `Document with ID "${documentId}" not found.`,
          suggestion: 'The document ID may be invalid. Please provide a valid document ID or file name.'
        };
      }
    } else {
      // Fall back to search by name
      console.log(`[Microsoft] Looking for document "${fileName}" to add content`);
      document = await searchWordDocumentByName(userId, fileName);
      
      if (!document) {
        console.log(`[Microsoft] Document not found, listing all Word files for reference`);
        
        // List all Word files to help user
        const allFiles = await listWordFiles(userId, { top: 10 });
        
        return {
          success: false,
          error: `Document "${fileName}" not found in OneDrive.`,
          availableDocuments: allFiles.map(f => ({ name: f.name, id: f.id, webUrl: f.webUrl })),
          suggestion: allFiles.length > 0 
            ? `Found ${allFiles.length} Word documents. Did you mean one of these?` 
            : 'No Word documents found in OneDrive. The document may not have synced yet. Please try again in a few seconds.'
        };
      }
    }
    
    console.log(`[Microsoft] Found document: ${document.name} (ID: ${document.id})`);
    console.log(`[Microsoft] Adding content (${content.length} chars) to document`);
    
    // Get the document title from file name
    const title = document.name.replace(/\.(docx|doc|txt)$/i, '');
    
    // Parse content into paragraphs
    const contentLines = content.split('\n').filter(line => line.trim());
    
    // Build document sections using docx library
    const children = [];
    
    // Add title as heading
    children.push(
      new Paragraph({
        text: title,
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 200 }
      })
    );
    
    // Add each line of content
    for (const line of contentLines) {
      const trimmedLine = line.trim();
      
      // Check if it's a heading (starts with # or ##)
      if (trimmedLine.startsWith('### ')) {
        children.push(
          new Paragraph({
            text: trimmedLine.replace('### ', ''),
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 200, after: 100 }
          })
        );
      } else if (trimmedLine.startsWith('## ')) {
        children.push(
          new Paragraph({
            text: trimmedLine.replace('## ', ''),
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 }
          })
        );
      } else if (trimmedLine.startsWith('# ')) {
        children.push(
          new Paragraph({
            text: trimmedLine.replace('# ', ''),
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 200, after: 100 }
          })
        );
      } else if (trimmedLine.startsWith('#### ')) {
        children.push(
          new Paragraph({
            text: trimmedLine.replace('#### ', ''),
            heading: HeadingLevel.HEADING_4,
            spacing: { before: 150, after: 75 }
          })
        );
      } else {
        // Regular paragraph - handle bold text marked with **
        const textRuns = [];
        const parts = trimmedLine.split(/(\*\*[^*]+\*\*)/g);
        
        for (const part of parts) {
          if (part.startsWith('**') && part.endsWith('**')) {
            textRuns.push(new TextRun({ text: part.slice(2, -2), bold: true }));
          } else if (part) {
            textRuns.push(new TextRun({ text: part }));
          }
        }
        
        children.push(
          new Paragraph({
            children: textRuns,
            spacing: { after: 120 }
          })
        );
      }
    }
    
    // Create the Word document
    const doc = new Document({
      sections: [{
        properties: {},
        children: children
      }]
    });
    
    // Generate the .docx file as a buffer
    const docxBuffer = await Packer.toBuffer(doc);
    
    console.log(`[Microsoft] Generated .docx file (${docxBuffer.length} bytes)`);
    
    // Get tokens for the API call
    const tokens = await getValidTokens(userId);
    
    // Upload the new content to replace the original document
    // Use the document's ID to update it directly
    const response = await axios({
      method: 'PUT',
      url: `${MICROSOFT_GRAPH_URL}/me/drive/items/${document.id}/content`,
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      },
      data: docxBuffer
    });
    
    if (response.data && response.data.id) {
      console.log(`[Microsoft] ✅ Successfully updated document: ${response.data.name}`);
      
      return {
        success: true,
        documentId: response.data.id,
        name: response.data.name,
        webUrl: response.data.webUrl,
        lastModifiedDateTime: response.data.lastModifiedDateTime,
        message: `Content added successfully to "${response.data.name}"!`,
        contentAdded: content.substring(0, 200) + (content.length > 200 ? '...' : '')
      };
    }
    
    return {
      success: false,
      error: 'Failed to save document content',
      documentId: document.id,
      webUrl: document.webUrl
    };
    
  } catch (error) {
    console.error('[Microsoft] Error adding content to Word document:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message || 'Failed to add content to Word document'
    };
  }
}

// ==================== USER PROFILE ====================

/**
 * Get user profile
 * @param {string} userId - User ID
 * @returns {object} User profile
 */
async function getUserProfile(userId) {
  return await graphRequest(userId, '/me', 'GET', null, {
    '$select': 'id,displayName,mail,userPrincipalName,jobTitle,department,officeLocation,mobilePhone'
  });
}

module.exports = {
  // Token management
  getValidTokens,
  graphRequest,
  
  // Outlook Mail
  listEmails,
  getEmail,
  sendEmail,
  replyToEmail,
  forwardEmail,
  markEmailRead,
  markEmailUnread,
  listMailFolders,
  deleteEmail,
  
  // Calendar
  listCalendarEvents,
  getCalendarEvent,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  listCalendars,
  
  // OneDrive
  listFiles,
  searchFiles,
  getFileMetadata,
  downloadFile,
  getFileContent,
  uploadFile,
  createFolder,
  deleteFile,
  
  // Excel
  listWorksheets,
  getWorksheetRange,
  getRange,
  updateRange,
  addWorksheet,
  deleteWorksheet,
  appendRow,
  formatRange,
  createTable,
  createExcelWorkbook,
  
  // Teams
  listTeams,
  listChannels,
  listChats,
  listChannelMessages,
  listChatMessages,
  sendChatMessage,
  sendChannelMessage,
  getTeam,
  
  // Word
  listWordFiles,
  getWordDocumentContent,
  downloadWordDocument,
  createWordDocument,
  updateWordDocument,
  searchWordDocumentByName,
  addContentToWordDocument,
  
  // User
  getUserProfile
};
