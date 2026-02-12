const { google } = require('googleapis');
const { getAuthenticatedClient } = require('./docsAuth');

/**
 * Get authenticated Docs API client
 */
async function getDocsClient(userId) {
  const auth = await getAuthenticatedClient(userId);
  return google.docs({ version: 'v1', auth });
}

/**
 * Get authenticated Drive API client (for listing and sharing docs)
 */
async function getDriveClient(userId) {
  const auth = await getAuthenticatedClient(userId);
  return google.drive({ version: 'v3', auth });
}

/**
 * Tool 1: Create a new Google Document
 * @param {string} userId - User ID
 * @param {string} title - Document title
 * @returns {Object} - { success, documentId, documentUrl, title }
 */
async function createDocument(userId, title) {
  try {
    const docs = await getDocsClient(userId);

    const response = await docs.documents.create({
      requestBody: {
        title: title
      }
    });

    const documentId = response.data.documentId;
    const documentUrl = `https://docs.google.com/document/d/${documentId}/edit`;

    return {
      success: true,
      documentId,
      documentUrl,
      title: response.data.title
    };
  } catch (error) {
    console.error('Error creating document:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Tool 2: Write/Insert text into a document
 * @param {string} userId - User ID
 * @param {string} documentId - Document ID
 * @param {string} text - Text to insert
 * @param {number} index - Position to insert (default: 1 = beginning)
 * @returns {Object} - { success, message }
 */
async function insertText(userId, documentId, text, index = 1) {
  try {
    const docs = await getDocsClient(userId);

    await docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [
          {
            insertText: {
              text: text,
              location: {
                index: index
              }
            }
          }
        ]
      }
    });

    return {
      success: true,
      message: 'Text inserted successfully'
    };
  } catch (error) {
    console.error('Error inserting text:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Tool 3: Append text to the end of a document
 * @param {string} userId - User ID
 * @param {string} documentId - Document ID
 * @param {string} text - Text to append
 * @returns {Object} - { success, message }
 */
async function appendText(userId, documentId, text) {
  try {
    const docs = await getDocsClient(userId);

    // First get the document to find the end index
    const doc = await docs.documents.get({ documentId });
    const endIndex = doc.data.body.content[doc.data.body.content.length - 1].endIndex;

    await docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [
          {
            insertText: {
              text: text,
              location: {
                index: endIndex - 1
              }
            }
          }
        ]
      }
    });

    return {
      success: true,
      message: 'Text appended successfully'
    };
  } catch (error) {
    console.error('Error appending text:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Tool 4: Insert a paragraph break
 * @param {string} userId - User ID
 * @param {string} documentId - Document ID
 * @param {number} index - Position to insert paragraph break
 * @returns {Object} - { success, message }
 */
async function insertParagraphBreak(userId, documentId, index) {
  try {
    const docs = await getDocsClient(userId);

    await docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [
          {
            insertText: {
              text: '\n',
              location: {
                index: index
              }
            }
          }
        ]
      }
    });

    return {
      success: true,
      message: 'Paragraph break inserted successfully'
    };
  } catch (error) {
    console.error('Error inserting paragraph break:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Tool 5: Update text style (bold, italic, underline, color)
 * @param {string} userId - User ID
 * @param {string} documentId - Document ID
 * @param {number} startIndex - Start position
 * @param {number} endIndex - End position
 * @param {Object} style - Style object { bold, italic, underline, foregroundColor }
 * @returns {Object} - { success, message }
 */
async function updateTextStyle(userId, documentId, startIndex, endIndex, style) {
  try {
    const docs = await getDocsClient(userId);

    const textStyle = {};
    if (style.bold !== undefined) textStyle.bold = style.bold;
    if (style.italic !== undefined) textStyle.italic = style.italic;
    if (style.underline !== undefined) textStyle.underline = style.underline;
    if (style.foregroundColor) {
      textStyle.foregroundColor = {
        color: {
          rgbColor: style.foregroundColor
        }
      };
    }

    const fields = Object.keys(textStyle).join(',');

    await docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [
          {
            updateTextStyle: {
              textStyle: textStyle,
              fields: fields,
              range: {
                startIndex: startIndex,
                endIndex: endIndex
              }
            }
          }
        ]
      }
    });

    return {
      success: true,
      message: 'Text style updated successfully'
    };
  } catch (error) {
    console.error('Error updating text style:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Tool 6: Read document content
 * @param {string} userId - User ID
 * @param {string} documentId - Document ID
 * @returns {Object} - { success, title, content, structure }
 */
async function readDocument(userId, documentId) {
  try {
    const docs = await getDocsClient(userId);

    const response = await docs.documents.get({
      documentId
    });

    const doc = response.data;
    let fullText = '';
    const structure = [];

    // Parse document content
    if (doc.body && doc.body.content) {
      for (const element of doc.body.content) {
        if (element.paragraph) {
          const paragraph = element.paragraph;
          let paragraphText = '';

          if (paragraph.elements) {
            for (const elem of paragraph.elements) {
              if (elem.textRun && elem.textRun.content) {
                paragraphText += elem.textRun.content;
              }
            }
          }

          if (paragraphText.trim()) {
            fullText += paragraphText;
            structure.push({
              type: 'paragraph',
              text: paragraphText.trim(),
              startIndex: element.startIndex,
              endIndex: element.endIndex
            });
          }
        } else if (element.table) {
          structure.push({
            type: 'table',
            rows: element.table.rows,
            startIndex: element.startIndex,
            endIndex: element.endIndex
          });
        }
      }
    }

    return {
      success: true,
      title: doc.title,
      content: fullText,
      structure: structure,
      documentId: doc.documentId
    };
  } catch (error) {
    console.error('Error reading document:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Tool 7: Search text within a document
 * @param {string} userId - User ID
 * @param {string} documentId - Document ID
 * @param {string} searchQuery - Text to search for
 * @returns {Object} - { success, matches }
 */
async function searchInDocument(userId, documentId, searchQuery) {
  try {
    const docData = await readDocument(userId, documentId);

    if (!docData.success) {
      return docData;
    }

    const matches = [];
    const searchLower = searchQuery.toLowerCase();

    // Search in each paragraph
    for (const element of docData.structure) {
      if (element.type === 'paragraph') {
        const textLower = element.text.toLowerCase();
        const index = textLower.indexOf(searchLower);

        if (index !== -1) {
          matches.push({
            text: element.text,
            matchIndex: index,
            context: element.text.substring(Math.max(0, index - 50), Math.min(element.text.length, index + searchQuery.length + 50)),
            startIndex: element.startIndex,
            endIndex: element.endIndex
          });
        }
      }
    }

    return {
      success: true,
      documentId,
      searchQuery,
      matchCount: matches.length,
      matches
    };
  } catch (error) {
    console.error('Error searching document:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Tool 8: List all documents (using Drive API)
 * @param {string} userId - User ID
 * @param {Object} options - { pageSize, query }
 * @returns {Object} - { success, documents }
 */
async function listDocuments(userId, options = {}) {
  try {
    const drive = await getDriveClient(userId);

    const query = options.query || "mimeType='application/vnd.google-apps.document'";
    const pageSize = options.pageSize || 50;

    const response = await drive.files.list({
      q: query,
      pageSize: pageSize,
      fields: 'files(id, name, createdTime, modifiedTime, webViewLink, owners)',
      orderBy: 'modifiedTime desc'
    });

    const documents = response.data.files.map(file => ({
      documentId: file.id,
      title: file.name,
      createdTime: file.createdTime,
      modifiedTime: file.modifiedTime,
      url: file.webViewLink,
      owners: file.owners
    }));

    return {
      success: true,
      documents,
      count: documents.length
    };
  } catch (error) {
    console.error('Error listing documents:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Tool 9: Get document metadata
 * @param {string} userId - User ID
 * @param {string} documentId - Document ID
 * @returns {Object} - { success, metadata }
 */
async function getDocumentMetadata(userId, documentId) {
  try {
    const drive = await getDriveClient(userId);

    const response = await drive.files.get({
      fileId: documentId,
      fields: 'id, name, createdTime, modifiedTime, webViewLink, owners, permissions, shared, size'
    });

    return {
      success: true,
      metadata: {
        documentId: response.data.id,
        title: response.data.name,
        createdTime: response.data.createdTime,
        modifiedTime: response.data.modifiedTime,
        url: response.data.webViewLink,
        owners: response.data.owners,
        shared: response.data.shared,
        size: response.data.size
      }
    };
  } catch (error) {
    console.error('Error getting document metadata:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Tool 10: Share a document (add permissions)
 * @param {string} userId - User ID
 * @param {string} documentId - Document ID
 * @param {string} email - Email to share with
 * @param {string} role - Role (reader, writer, commenter)
 * @returns {Object} - { success, message }
 */
async function shareDocument(userId, documentId, email, role = 'reader') {
  try {
    const drive = await getDriveClient(userId);

    await drive.permissions.create({
      fileId: documentId,
      requestBody: {
        type: 'user',
        role: role,
        emailAddress: email
      },
      sendNotificationEmail: true
    });

    return {
      success: true,
      message: `Document shared with ${email} as ${role}`
    };
  } catch (error) {
    console.error('Error sharing document:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Tool 11: Delete a document
 * @param {string} userId - User ID
 * @param {string} documentId - Document ID
 * @returns {Object} - { success, message }
 */
async function deleteDocument(userId, documentId) {
  try {
    const drive = await getDriveClient(userId);

    await drive.files.delete({
      fileId: documentId
    });

    return {
      success: true,
      message: 'Document deleted successfully'
    };
  } catch (error) {
    console.error('Error deleting document:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Tool 12: Replace text in document
 * @param {string} userId - User ID
 * @param {string} documentId - Document ID
 * @param {string} searchText - Text to find
 * @param {string} replaceText - Text to replace with
 * @returns {Object} - { success, replacedCount }
 */
async function replaceText(userId, documentId, searchText, replaceText) {
  try {
    const docs = await getDocsClient(userId);

    const response = await docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [
          {
            replaceAllText: {
              containsText: {
                text: searchText,
                matchCase: false
              },
              replaceText: replaceText
            }
          }
        ]
      }
    });

    const replacedCount = response.data.replies[0]?.replaceAllText?.occurrencesChanged || 0;

    return {
      success: true,
      replacedCount,
      message: `Replaced ${replacedCount} occurrences`
    };
  } catch (error) {
    console.error('Error replacing text:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Tool 13: Append formatted text with proper Google Docs formatting
 * Converts markdown-style content to NATIVE Google Docs formatting
 * NEVER inserts markdown characters as plain text - uses proper APIs
 * @param {string} userId - User ID
 * @param {string} documentId - Document ID
 * @param {string} content - Markdown-formatted content
 * @returns {Object} - { success, message }
 */
async function appendFormattedText(userId, documentId, content) {
  try {
    const docs = await getDocsClient(userId);

    // Get the document to find the end index
    const doc = await docs.documents.get({ documentId });
    let insertIndex = doc.data.body.content[doc.data.body.content.length - 1].endIndex - 1;

    // Parse content into structured blocks
    const blocks = parseMarkdownToBlocks(content);
    
    // Phase 1: Build text without any markdown characters
    // Track where each block will be positioned for formatting
    let plainText = '';
    const blockPositions = [];
    
    for (const block of blocks) {
      const blockStart = plainText.length;
      
      if (block.type === 'heading') {
        // Parse inline formatting from heading text too
        const { text: cleanText, boldRanges } = parseInlineFormatting(block.text);
        plainText += cleanText + '\n';
        blockPositions.push({
          type: 'heading',
          level: block.level,
          start: blockStart,
          end: blockStart + cleanText.length,
          boldRanges: boldRanges.map(r => ({ start: blockStart + r.start, end: blockStart + r.end }))
        });
      } else if (block.type === 'bullet') {
        // NO bullet character - just the text, we'll apply bullet formatting via API
        const { text: cleanText, boldRanges } = parseInlineFormatting(block.text);
        plainText += cleanText + '\n';
        blockPositions.push({
          type: 'bullet',
          start: blockStart,
          end: blockStart + cleanText.length + 1, // Include newline for paragraph
          boldRanges: boldRanges.map(r => ({ start: blockStart + r.start, end: blockStart + r.end }))
        });
      } else if (block.type === 'numbered') {
        // NO number - just the text, we'll apply numbered list formatting via API
        const { text: cleanText, boldRanges } = parseInlineFormatting(block.text);
        plainText += cleanText + '\n';
        blockPositions.push({
          type: 'numbered',
          start: blockStart,
          end: blockStart + cleanText.length + 1, // Include newline for paragraph
          boldRanges: boldRanges.map(r => ({ start: blockStart + r.start, end: blockStart + r.end }))
        });
      } else if (block.type === 'paragraph') {
        const { text: cleanText, boldRanges } = parseInlineFormatting(block.text);
        plainText += cleanText + '\n';
        blockPositions.push({
          type: 'paragraph',
          start: blockStart,
          end: blockStart + cleanText.length,
          boldRanges: boldRanges.map(r => ({ start: blockStart + r.start, end: blockStart + r.end }))
        });
      } else if (block.type === 'empty') {
        plainText += '\n';
        blockPositions.push({ type: 'empty', start: blockStart, end: blockStart + 1 });
      }
    }

    // Phase 2: Insert all plain text at once
    const requests = [];
    
    if (plainText) {
      requests.push({
        insertText: {
          text: plainText,
          location: { index: insertIndex }
        }
      });
    }

    // Phase 3: Apply formatting using native Google Docs APIs
    // Process in reverse order to maintain correct indices
    for (let i = blockPositions.length - 1; i >= 0; i--) {
      const block = blockPositions[i];
      const absStart = insertIndex + block.start;
      const absEnd = insertIndex + block.end;
      
      if (block.type === 'heading') {
        // Apply heading style using namedStyleType
        const namedStyle = block.level === 1 ? 'HEADING_1' : 
                          block.level === 2 ? 'HEADING_2' : 
                          block.level === 3 ? 'HEADING_3' : 'HEADING_4';
        requests.push({
          updateParagraphStyle: {
            paragraphStyle: { namedStyleType: namedStyle },
            fields: 'namedStyleType',
            range: { startIndex: absStart, endIndex: absEnd + 1 }
          }
        });
      } else if (block.type === 'bullet') {
        // Use createParagraphBullets API for proper bullet lists
        requests.push({
          createParagraphBullets: {
            range: { startIndex: absStart, endIndex: absEnd },
            bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE'
          }
        });
      } else if (block.type === 'numbered') {
        // Use createParagraphBullets API with numbered preset
        requests.push({
          createParagraphBullets: {
            range: { startIndex: absStart, endIndex: absEnd },
            bulletPreset: 'NUMBERED_DECIMAL_NESTED'
          }
        });
      }
      
      // Apply bold formatting for inline **text**
      if (block.boldRanges && block.boldRanges.length > 0) {
        for (const boldRange of block.boldRanges) {
          requests.push({
            updateTextStyle: {
              textStyle: { bold: true },
              fields: 'bold',
              range: { 
                startIndex: insertIndex + boldRange.start, 
                endIndex: insertIndex + boldRange.end 
              }
            }
          });
        }
      }
    }

    // Execute all requests
    if (requests.length > 0) {
      await docs.documents.batchUpdate({
        documentId,
        requestBody: { requests }
      });
    }

    return {
      success: true,
      message: 'Formatted text appended successfully with native Google Docs formatting'
    };
  } catch (error) {
    console.error('Error appending formatted text:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Parse markdown content into structured blocks
 */
function parseMarkdownToBlocks(content) {
  const lines = content.split('\n');
  const blocks = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (!trimmedLine) {
      blocks.push({ type: 'empty' });
      continue;
    }

    // Check for headings (# ## ###)
    const headingMatch = trimmedLine.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2]
      });
      continue;
    }

    // Check for ALL CAPS headings (legacy format)
    if (trimmedLine === trimmedLine.toUpperCase() && 
        trimmedLine.length > 3 && 
        /^[A-Z\s]+$/.test(trimmedLine)) {
      blocks.push({
        type: 'heading',
        level: 1,
        text: trimmedLine
      });
      continue;
    }

    // Check for bullet points (- or • or *)
    const bulletMatch = trimmedLine.match(/^[-•*]\s+(.+)$/);
    if (bulletMatch) {
      blocks.push({
        type: 'bullet',
        text: bulletMatch[1]
      });
      continue;
    }

    // Check for numbered list (1. 2. etc)
    const numberedMatch = trimmedLine.match(/^(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      blocks.push({
        type: 'numbered',
        number: numberedMatch[1],
        text: numberedMatch[2]
      });
      continue;
    }

    // Check for subheading (ends with :)
    if (trimmedLine.endsWith(':') && trimmedLine.length < 60) {
      blocks.push({
        type: 'heading',
        level: 3,
        text: trimmedLine
      });
      continue;
    }

    // Regular paragraph
    blocks.push({
      type: 'paragraph',
      text: trimmedLine
    });
  }

  return blocks;
}

/**
 * Parse inline formatting (bold with ** or __)
 */
function parseInlineFormatting(text) {
  const boldRanges = [];
  let result = text;
  
  // Match **text** or __text__
  const boldPattern = /(\*\*|__)(.+?)\1/g;
  let match;
  let offset = 0;
  
  // Create a copy to work with
  let workingText = text;
  
  while ((match = boldPattern.exec(text)) !== null) {
    const fullMatch = match[0];
    const innerText = match[2];
    const startInOriginal = match.index;
    
    // Calculate position in result string (accounting for removed markers)
    const startInResult = startInOriginal - offset;
    
    boldRanges.push({
      start: startInResult,
      end: startInResult + innerText.length
    });
    
    // Update offset (4 characters removed: ** at start and ** at end)
    offset += 4;
  }
  
  // Remove all bold markers from result
  result = text.replace(/(\*\*|__)(.+?)\1/g, '$2');
  
  return { text: result, boldRanges };
}

module.exports = {
  createDocument,
  insertText,
  appendText,
  appendFormattedText,
  insertParagraphBreak,
  updateTextStyle,
  readDocument,
  searchInDocument,
  listDocuments,
  getDocumentMetadata,
  shareDocument,
  deleteDocument,
  replaceText
};
