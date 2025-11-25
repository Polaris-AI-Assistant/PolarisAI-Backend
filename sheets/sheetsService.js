const { google } = require('googleapis');
const supabase = require('../supabase/supabaseConnect');

// Define OAuth scopes
const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly'
];

/**
 * Get Sheets API client with user credentials
 */
async function getSheetsClient(userIdentifier) {
  try {
    // Get tokens from Supabase sheets_tokens table
    let query = supabase.from("sheets_tokens").select("access_token, refresh_token, email, user_id");
    
    // Check if userIdentifier is an email or user_id
    if (userIdentifier.includes('@')) {
      query = query.eq("email", userIdentifier);
    } else {
      query = query.eq("user_id", userIdentifier);
    }
    
    const { data: tokenRow, error } = await query.single();

    if (error || !tokenRow) {
      throw new Error("User tokens not found");
    }

    // Create OAuth2 client
    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_SHEETS_CLIENT_ID,
      process.env.GOOGLE_SHEETS_CLIENT_SECRET,
      process.env.GOOGLE_SHEETS_REDIRECT_URI
    );
    
    oAuth2Client.setCredentials({ 
      access_token: tokenRow.access_token, 
      refresh_token: tokenRow.refresh_token 
    });

    // Handle token refresh
    oAuth2Client.on('tokens', async (tokens) => {
      if (tokens.refresh_token) {
        console.log('New refresh token received');
      }
      
      // Update access token in database
      await supabase
        .from("sheets_tokens")
        .update({
          access_token: tokens.access_token,
          expiry_date: tokens.expiry_date || null,
          updated_at: new Date().toISOString()
        })
        .eq("user_id", tokenRow.user_id);
    });

    const sheets = google.sheets({ version: 'v4', auth: oAuth2Client });
    const drive = google.drive({ version: 'v3', auth: oAuth2Client });
    
    return { sheets, drive, oAuth2Client, userId: tokenRow.user_id, email: tokenRow.email };

  } catch (error) {
    console.error('Error getting Sheets client:', error);
    throw error;
  }
}

/**
 * 1. Create a new Google spreadsheet
 */
async function createSpreadsheet(userIdentifier, title, sheetTitles = ['Sheet1']) {
  try {
    const { sheets } = await getSheetsClient(userIdentifier);
    
    const resource = {
      properties: {
        title: title
      },
      sheets: sheetTitles.map(sheetTitle => ({
        properties: {
          title: sheetTitle
        }
      }))
    };

    const response = await sheets.spreadsheets.create({
      resource,
      fields: 'spreadsheetId,spreadsheetUrl,properties,sheets'
    });

    return {
      success: true,
      spreadsheet: response.data
    };

  } catch (error) {
    console.error('Error creating spreadsheet:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 2. Get values from a Google spreadsheet
 */
async function getValues(userIdentifier, spreadsheetId, range) {
  try {
    const { sheets } = await getSheetsClient(userIdentifier);
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range
    });

    return {
      success: true,
      values: response.data.values || [],
      range: response.data.range
    };

  } catch (error) {
    console.error('Error getting values:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 3. Add a new sheet to an existing spreadsheet
 */
async function addSheet(userIdentifier, spreadsheetId, sheetTitle) {
  try {
    const { sheets } = await getSheetsClient(userIdentifier);
    
    const response = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [{
          addSheet: {
            properties: {
              title: sheetTitle
            }
          }
        }]
      }
    });

    return {
      success: true,
      sheet: response.data.replies[0].addSheet
    };

  } catch (error) {
    console.error('Error adding sheet:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 4. List Google spreadsheets
 */
async function listSpreadsheets(userIdentifier, pageSize = 20, pageNumber = 1) {
  try {
    const { drive, email } = await getSheetsClient(userIdentifier);
    
    const actualPageSize = Math.min(pageSize, 100);
    
    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
      fields: 'files(id, name, createdTime, modifiedTime, webViewLink, description, owners)',
      pageSize: actualPageSize * pageNumber,
      orderBy: 'modifiedTime desc'
    });

    const allSpreadsheets = response.data.files || [];
    
    // Manual pagination
    const startIndex = (pageNumber - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedSpreadsheets = allSpreadsheets.slice(startIndex, endIndex);
    
    return {
      success: true,
      spreadsheets: paginatedSpreadsheets,
      count: paginatedSpreadsheets.length,
      totalCount: allSpreadsheets.length,
      page: pageNumber,
      pageSize: pageSize,
      hasMore: endIndex < allSpreadsheets.length,
      email
    };

  } catch (error) {
    console.error('Error listing spreadsheets:', error);
    return {
      success: false,
      error: error.message,
      spreadsheets: []
    };
  }
}

/**
 * 5. Delete a Google spreadsheet
 */
async function deleteSpreadsheet(userIdentifier, spreadsheetId) {
  try {
    const { drive } = await getSheetsClient(userIdentifier);
    
    await drive.files.delete({
      fileId: spreadsheetId
    });

    return {
      success: true,
      message: 'Spreadsheet deleted successfully'
    };

  } catch (error) {
    console.error('Error deleting spreadsheet:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 6. Read specific rows from a sheet
 */
async function readRows(userIdentifier, spreadsheetId, sheetName, startRow, endRow) {
  try {
    const { sheets } = await getSheetsClient(userIdentifier);
    
    const range = `${sheetName}!A${startRow}:${endRow}`;
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range
    });

    return {
      success: true,
      rows: response.data.values || [],
      range: response.data.range
    };

  } catch (error) {
    console.error('Error reading rows:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 7. Edit an entire row in a spreadsheet
 */
async function editRow(userIdentifier, spreadsheetId, sheetName, rowNumber, values) {
  try {
    const { sheets } = await getSheetsClient(userIdentifier);
    
    const range = `${sheetName}!A${rowNumber}:${rowNumber}`;
    
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [values]
      }
    });

    return {
      success: true,
      updatedCells: response.data.updatedCells,
      updatedRange: response.data.updatedRange
    };

  } catch (error) {
    console.error('Error editing row:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 8. Insert a new row in a spreadsheet
 */
async function insertRow(userIdentifier, spreadsheetId, sheetName, rowNumber, values) {
  try {
    const { sheets } = await getSheetsClient(userIdentifier);
    
    // First, get the sheet ID
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
    
    if (!sheet) {
      throw new Error(`Sheet '${sheetName}' not found`);
    }
    
    const sheetId = sheet.properties.sheetId;
    
    // Insert empty rows
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [{
          insertDimension: {
            range: {
              sheetId: sheetId,
              dimension: 'ROWS',
              startIndex: rowNumber - 1,
              endIndex: rowNumber
            }
          }
        }]
      }
    });
    
    // Update the inserted row with values
    const range = `${sheetName}!A${rowNumber}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [values]
      }
    });

    return {
      success: true,
      message: 'Row inserted successfully'
    };

  } catch (error) {
    console.error('Error inserting row:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 9. Insert a new column in a spreadsheet
 */
async function insertColumn(userIdentifier, spreadsheetId, sheetName, columnIndex, values) {
  try {
    const { sheets } = await getSheetsClient(userIdentifier);
    
    // Get the sheet ID
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
    
    if (!sheet) {
      throw new Error(`Sheet '${sheetName}' not found`);
    }
    
    const sheetId = sheet.properties.sheetId;
    
    // Insert empty column
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [{
          insertDimension: {
            range: {
              sheetId: sheetId,
              dimension: 'COLUMNS',
              startIndex: columnIndex,
              endIndex: columnIndex + 1
            }
          }
        }]
      }
    });
    
    // Convert columnIndex to letter (0 = A, 1 = B, etc.)
    const columnLetter = String.fromCharCode(65 + columnIndex);
    
    // Update the inserted column with values
    if (values && values.length > 0) {
      const range = `${sheetName}!${columnLetter}1`;
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: values.map(v => [v])
        }
      });
    }

    return {
      success: true,
      message: 'Column inserted successfully'
    };

  } catch (error) {
    console.error('Error inserting column:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 10. Rename a sheet in a spreadsheet
 */
async function renameSheet(userIdentifier, spreadsheetId, oldSheetName, newSheetName) {
  try {
    const { sheets } = await getSheetsClient(userIdentifier);
    
    // Get the sheet ID
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = spreadsheet.data.sheets.find(s => s.properties.title === oldSheetName);
    
    if (!sheet) {
      throw new Error(`Sheet '${oldSheetName}' not found`);
    }
    
    const sheetId = sheet.properties.sheetId;
    
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [{
          updateSheetProperties: {
            properties: {
              sheetId: sheetId,
              title: newSheetName
            },
            fields: 'title'
          }
        }]
      }
    });

    return {
      success: true,
      message: 'Sheet renamed successfully'
    };

  } catch (error) {
    console.error('Error renaming sheet:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 11. Get metadata about a Google spreadsheet
 */
async function getSpreadsheet(userIdentifier, spreadsheetId) {
  try {
    const { sheets } = await getSheetsClient(userIdentifier);
    
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
      includeGridData: false
    });

    return {
      success: true,
      spreadsheet: response.data
    };

  } catch (error) {
    console.error('Error getting spreadsheet:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 12. Update values in a spreadsheet
 */
async function updateValues(userIdentifier, spreadsheetId, range, values) {
  try {
    const { sheets } = await getSheetsClient(userIdentifier);
    
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values
      }
    });

    return {
      success: true,
      updatedCells: response.data.updatedCells,
      updatedRange: response.data.updatedRange
    };

  } catch (error) {
    console.error('Error updating values:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 13. Delete a sheet from a spreadsheet
 */
async function deleteSheet(userIdentifier, spreadsheetId, sheetName) {
  try {
    const { sheets } = await getSheetsClient(userIdentifier);
    
    // Get the sheet ID
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
    
    if (!sheet) {
      throw new Error(`Sheet '${sheetName}' not found`);
    }
    
    const sheetId = sheet.properties.sheetId;
    
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [{
          deleteSheet: {
            sheetId: sheetId
          }
        }]
      }
    });

    return {
      success: true,
      message: 'Sheet deleted successfully'
    };

  } catch (error) {
    console.error('Error deleting sheet:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 14. Share a Google spreadsheet with others
 */
async function shareSpreadsheet(userIdentifier, spreadsheetId, email, role = 'reader') {
  try {
    const { drive } = await getSheetsClient(userIdentifier);
    
    const response = await drive.permissions.create({
      fileId: spreadsheetId,
      requestBody: {
        type: 'user',
        role: role, // 'reader', 'writer', or 'owner'
        emailAddress: email
      },
      sendNotificationEmail: true
    });

    return {
      success: true,
      permission: response.data
    };

  } catch (error) {
    console.error('Error sharing spreadsheet:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 15. Format and highlight cells
 */
async function formatCells(userIdentifier, spreadsheetId, sheetName, range, formatting) {
  try {
    const { sheets } = await getSheetsClient(userIdentifier);
    
    // Get the sheet ID
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
    
    if (!sheet) {
      throw new Error(`Sheet '${sheetName}' not found`);
    }
    
    const sheetId = sheet.properties.sheetId;
    
    // Parse range (e.g., "A1:B10")
    const rangeMatch = range.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
    if (!rangeMatch) {
      throw new Error('Invalid range format');
    }
    
    const startCol = rangeMatch[1].charCodeAt(0) - 65;
    const startRow = parseInt(rangeMatch[2]) - 1;
    const endCol = rangeMatch[3].charCodeAt(0) - 64;
    const endRow = parseInt(rangeMatch[4]);
    
    const requests = [{
      repeatCell: {
        range: {
          sheetId: sheetId,
          startRowIndex: startRow,
          endRowIndex: endRow,
          startColumnIndex: startCol,
          endColumnIndex: endCol
        },
        cell: {
          userEnteredFormat: formatting
        },
        fields: 'userEnteredFormat'
      }
    }];
    
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: { requests }
    });

    return {
      success: true,
      message: 'Cells formatted successfully'
    };

  } catch (error) {
    console.error('Error formatting cells:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 16. Read specific columns from a sheet
 */
async function readColumns(userIdentifier, spreadsheetId, sheetName, startColumn, endColumn) {
  try {
    const { sheets } = await getSheetsClient(userIdentifier);
    
    const range = `${sheetName}!${startColumn}:${endColumn}`;
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range
    });

    return {
      success: true,
      columns: response.data.values || [],
      range: response.data.range
    };

  } catch (error) {
    console.error('Error reading columns:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 17. Edit an entire column in a spreadsheet
 */
async function editColumn(userIdentifier, spreadsheetId, sheetName, columnLetter, values) {
  try {
    const { sheets } = await getSheetsClient(userIdentifier);
    
    const range = `${sheetName}!${columnLetter}:${columnLetter}`;
    
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: values.map(v => [v])
      }
    });

    return {
      success: true,
      updatedCells: response.data.updatedCells,
      updatedRange: response.data.updatedRange
    };

  } catch (error) {
    console.error('Error editing column:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 18. Edit a single cell in a spreadsheet
 */
async function editCell(userIdentifier, spreadsheetId, sheetName, cell, value) {
  try {
    const { sheets } = await getSheetsClient(userIdentifier);
    
    const range = `${sheetName}!${cell}`;
    
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[value]]
      }
    });

    return {
      success: true,
      updatedCells: response.data.updatedCells,
      updatedRange: response.data.updatedRange
    };

  } catch (error) {
    console.error('Error editing cell:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 19. Read the header row (first row) from a specific sheet
 */
async function readHeadings(userIdentifier, spreadsheetId, sheetName) {
  try {
    const { sheets } = await getSheetsClient(userIdentifier);
    
    const range = `${sheetName}!1:1`;
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range
    });

    return {
      success: true,
      headings: response.data.values ? response.data.values[0] : [],
      range: response.data.range
    };

  } catch (error) {
    console.error('Error reading headings:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  getSheetsClient,
  createSpreadsheet,
  getValues,
  addSheet,
  listSpreadsheets,
  deleteSpreadsheet,
  readRows,
  editRow,
  insertRow,
  insertColumn,
  renameSheet,
  getSpreadsheet,
  updateValues,
  deleteSheet,
  shareSpreadsheet,
  formatCells,
  readColumns,
  editColumn,
  editCell,
  readHeadings
};
