const { google } = require('googleapis');
const supabase = require('../supabase/supabaseConnect');

// Define OAuth scopes
const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/forms.body',
  'https://www.googleapis.com/auth/forms.responses.readonly',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.readonly'
];

/**
 * Get Forms API client with user credentials
 */
async function getFormsClient(userIdentifier) {
  try {
    // Get tokens from Supabase forms_tokens table
    let query = supabase.from("forms_tokens").select("access_token, refresh_token, email, user_id");
    
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
      process.env.GOOGLE_FORMS_CLIENT_ID,
      process.env.GOOGLE_FORMS_CLIENT_SECRET,
      process.env.GOOGLE_FORMS_REDIRECT_URI
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
        .from("forms_tokens")
        .update({
          access_token: tokens.access_token,
          expiry_date: tokens.expiry_date || null,
          updated_at: new Date().toISOString()
        })
        .eq("user_id", tokenRow.user_id);
    });

    const forms = google.forms({ version: 'v1', auth: oAuth2Client });
    const drive = google.drive({ version: 'v3', auth: oAuth2Client });
    
    return { forms, drive, oAuth2Client, userId: tokenRow.user_id, email: tokenRow.email };

  } catch (error) {
    console.error('Error getting Forms client:', error);
    throw error;
  }
}

/**
 * List all Google Forms accessible to the user with pagination
 */
async function listForms(userIdentifier, pageSize = 20, pageNumber = 1) {
  try {
    const { drive, email } = await getFormsClient(userIdentifier);
    
    // Calculate page token for pagination (Drive API uses pageToken, not page numbers)
    // For simplicity, we'll fetch more and slice
    const actualPageSize = Math.min(pageSize, 100); // Max 100 per Google API
    
    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.form' and trashed=false",
      fields: 'files(id, name, createdTime, modifiedTime, webViewLink, description, owners)',
      pageSize: actualPageSize * pageNumber, // Fetch enough to support pagination
      orderBy: 'modifiedTime desc'
    });

    const allForms = response.data.files || [];
    
    // Manual pagination
    const startIndex = (pageNumber - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedForms = allForms.slice(startIndex, endIndex);
    
    return {
      success: true,
      forms: paginatedForms,
      count: paginatedForms.length,
      totalCount: allForms.length,
      page: pageNumber,
      pageSize: pageSize,
      hasMore: endIndex < allForms.length,
      email
    };

  } catch (error) {
    console.error('Error listing forms:', error);
    return {
      success: false,
      error: error.message,
      forms: []
    };
  }
}

/**
 * Create a new Google Form
 */
async function createForm(userIdentifier, title, description = '', questions = []) {
  try {
    const { forms } = await getFormsClient(userIdentifier);
    
    // Create basic form structure - ONLY title is allowed initially
    const formBody = {
      info: {
        title: title
      }
    };
    
    // Create the form (only with title)
    const response = await forms.forms.create({
      requestBody: formBody
    });
    
    const formId = response.data.formId;
    
    // Prepare batchUpdate requests
    const batchRequests = [];
    
    // Add description if provided (must be done via batchUpdate)
    if (description) {
      batchRequests.push({
        updateFormInfo: {
          info: {
            description: description
          },
          updateMask: 'description'
        }
      });
    }
    
    // If questions are provided, add them via batchUpdate
    if (questions && questions.length > 0) {
      questions.forEach((q, index) => {
        // Build the question item structure correctly
        const questionItem = {
          question: {}
        };
        
        // Normalize type - handle various LLM interpretations
        const questionType = (q.type || 'text').toLowerCase();
        
        // Determine question type and build appropriate structure
        if (questionType === 'text' || questionType === 'short_answer' || questionType === 'short') {
          questionItem.question.textQuestion = {};
        } else if (questionType === 'paragraph' || questionType === 'long_answer' || questionType === 'long') {
          questionItem.question.textQuestion = { paragraph: true };
        } else if (questionType === 'scale' || questionType === 'linear_scale' || questionType === 'rating') {
          // Scale questions use scaleQuestion in Google Forms API
          questionItem.question.scaleQuestion = {
            low: 1,
            high: 5,
            lowLabel: 'Low',
            highLabel: 'High'
          };
        } else if ((questionType === 'multiple_choice' || questionType === 'radio' || questionType === 'mcq') && q.options && q.options.length > 0) {
          questionItem.question.choiceQuestion = {
            type: 'RADIO',
            options: q.options.map(opt => ({ value: opt }))
          };
        } else if ((questionType === 'checkbox' || questionType === 'checkboxes') && q.options && q.options.length > 0) {
          questionItem.question.choiceQuestion = {
            type: 'CHECKBOX',
            options: q.options.map(opt => ({ value: opt }))
          };
        } else if ((questionType === 'dropdown' || questionType === 'select') && q.options && q.options.length > 0) {
          questionItem.question.choiceQuestion = {
            type: 'DROP_DOWN',
            options: q.options.map(opt => ({ value: opt }))
          };
        } else if ((questionType === 'multiple_choice' || questionType === 'radio') && (!q.options || q.options.length === 0)) {
          // Radio/multiple choice without options - default to text
          console.warn(`[FormsService] Question "${q.title}" has type ${questionType} but no options, defaulting to text`);
          questionItem.question.textQuestion = {};
        } else {
          // Default fallback to text question
          console.warn(`[FormsService] Unknown question type "${questionType}", defaulting to text`);
          questionItem.question.textQuestion = {};
        }
        
        // Set required field
        questionItem.question.required = q.required || false;
        
        batchRequests.push({
          createItem: {
            item: {
              title: q.title || q.question,
              questionItem: questionItem
            },
            location: {
              index: index
            }
          }
        });
      });
    }
    
    // Execute batchUpdate if there are any requests
    if (batchRequests.length > 0) {
      await forms.forms.batchUpdate({
        formId: formId,
        requestBody: {
          requests: batchRequests
        }
      });
    }
    
    // Get the updated form
    const finalForm = await forms.forms.get({
      formId: formId
    });
    
    return {
      success: true,
      form: finalForm.data,
      formId: formId,
      message: `Form "${title}" created successfully`
    };

  } catch (error) {
    console.error('Error creating form:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get responses for a specific form with pagination
 */
async function getResponses(userIdentifier, formId, pageSize = 20, pageNumber = 1) {
  try {
    const { forms } = await getFormsClient(userIdentifier);
    
    const response = await forms.forms.responses.list({
      formId: formId
    });

    const allResponses = response.data.responses || [];
    
    // Manual pagination
    const startIndex = (pageNumber - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedResponses = allResponses.slice(startIndex, endIndex);
    
    return {
      success: true,
      responses: paginatedResponses,
      count: paginatedResponses.length,
      totalCount: allResponses.length,
      page: pageNumber,
      pageSize: pageSize,
      hasMore: endIndex < allResponses.length,
      formId: formId
    };

  } catch (error) {
    console.error('Error getting form responses:', error);
    return {
      success: false,
      error: error.message,
      responses: []
    };
  }
}

/**
 * Get a specific form by ID
 */
async function getForm(userIdentifier, formId) {
  try {
    const { forms } = await getFormsClient(userIdentifier);
    
    const response = await forms.forms.get({
      formId: formId
    });

    return {
      success: true,
      form: response.data
    };

  } catch (error) {
    console.error('Error getting form:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Update an existing Google Form
 */
async function updateForm(userIdentifier, formId, title = null, description = null, questions = []) {
  try {
    const { forms } = await getFormsClient(userIdentifier);
    
    const requests = [];
    
    // Update title if provided
    if (title !== null) {
      requests.push({
        updateFormInfo: {
          info: {
            title: title
          },
          updateMask: 'title'
        }
      });
    }
    
    // Update description if provided
    if (description !== null) {
      requests.push({
        updateFormInfo: {
          info: {
            description: description
          },
          updateMask: 'description'
        }
      });
    }
    
    // Add new questions if provided
    if (questions && questions.length > 0) {
      // Get current form to know where to add questions
      const currentForm = await forms.forms.get({ formId: formId });
      const currentItemsCount = currentForm.data.items ? currentForm.data.items.length : 0;
      
      questions.forEach((q, index) => {
        // Build the question item structure correctly (same as createForm)
        const questionItem = {
          question: {}
        };
        
        // Determine question type and build appropriate structure
        if (q.type === 'text' || !q.type) {
          questionItem.question.textQuestion = {};
        } else if (q.type === 'paragraph') {
          questionItem.question.textQuestion = { paragraph: true };
        } else if (q.type === 'multiple_choice' && q.options) {
          questionItem.question.choiceQuestion = {
            type: 'RADIO',
            options: q.options.map(opt => ({ value: opt }))
          };
        } else if (q.type === 'checkbox' && q.options) {
          questionItem.question.choiceQuestion = {
            type: 'CHECKBOX',
            options: q.options.map(opt => ({ value: opt }))
          };
        } else if (q.type === 'dropdown' && q.options) {
          questionItem.question.choiceQuestion = {
            type: 'DROP_DOWN',
            options: q.options.map(opt => ({ value: opt }))
          };
        }
        
        // Set required field
        questionItem.question.required = q.required || false;
        
        requests.push({
          createItem: {
            item: {
              title: q.title || q.question,
              questionItem: questionItem
            },
            location: {
              index: currentItemsCount + index
            }
          }
        });
      });
    }
    
    // Execute batch update if there are requests
    if (requests.length > 0) {
      await forms.forms.batchUpdate({
        formId: formId,
        requestBody: {
          requests: requests
        }
      });
    }
    
    // Get the updated form
    const updatedForm = await forms.forms.get({
      formId: formId
    });
    
    return {
      success: true,
      form: updatedForm.data,
      message: 'Form updated successfully'
    };

  } catch (error) {
    console.error('Error updating form:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Publish or unpublish a Google Form
 */
async function publishForm(userIdentifier, formId, isPublished = true, isAcceptingResponses = true) {
  try {
    const { forms } = await getFormsClient(userIdentifier);
    
    const requests = [];
    
    // Update settings to control form accessibility and response acceptance
    requests.push({
      updateSettings: {
        settings: {
          quizSettings: {
            isQuiz: false
          }
        },
        updateMask: 'quizSettings.isQuiz'
      }
    });
    
    // Note: Google Forms API doesn't have direct "publish/unpublish" endpoints
    // Forms are automatically accessible via their links
    // We can control if the form accepts responses
    
    if (!isAcceptingResponses) {
      // To stop accepting responses, we need to update form info
      requests.push({
        updateFormInfo: {
          info: {
            description: isPublished 
              ? 'This form is no longer accepting responses.' 
              : 'This form is currently closed.'
          },
          updateMask: 'description'
        }
      });
    }
    
    await forms.forms.batchUpdate({
      formId: formId,
      requestBody: {
        requests: requests
      }
    });
    
    // Get the form link
    const formResponse = await forms.forms.get({
      formId: formId
    });
    
    const formLink = formResponse.data.responderUri;
    
    return {
      success: true,
      formId: formId,
      isPublished: isPublished,
      isAcceptingResponses: isAcceptingResponses,
      formLink: formLink,
      message: isPublished && isAcceptingResponses
        ? `Form is published and accepting responses at: ${formLink}`
        : !isAcceptingResponses
        ? 'Form is no longer accepting responses'
        : 'Form visibility updated'
    };

  } catch (error) {
    console.error('Error publishing/unpublishing form:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Add a single question to an existing form
 */
async function addQuestion(userIdentifier, params) {
  try {
    const { forms } = await getFormsClient(userIdentifier);
    const { formId, title, type, options, required } = params;
    
    // Get current form to know where to add the question
    const currentForm = await forms.forms.get({ formId: formId });
    const currentItemsCount = currentForm.data.items ? currentForm.data.items.length : 0;
    
    // Build the question item structure
    const questionItem = {
      question: {}
    };
    
    // Normalize type - support both formats (SHORT_ANSWER and text)
    const questionType = (type || 'SHORT_ANSWER').toUpperCase();
    
    // Determine question type and build appropriate structure
    if (questionType === 'SHORT_ANSWER' || questionType === 'TEXT') {
      questionItem.question.textQuestion = {};
    } else if (questionType === 'PARAGRAPH' || questionType === 'LONG_ANSWER') {
      questionItem.question.textQuestion = { paragraph: true };
    } else if (questionType === 'LINEAR_SCALE' || questionType === 'SCALE') {
      questionItem.question.scaleQuestion = {
        low: 1,
        high: options && options.length > 0 ? parseInt(options[options.length - 1]) : 5,
        lowLabel: 'Low',
        highLabel: 'High'
      };
    } else if (questionType === 'MULTIPLE_CHOICE' || questionType === 'RADIO') {
      if (!options || options.length === 0) {
        throw new Error('Multiple choice questions require options');
      }
      questionItem.question.choiceQuestion = {
        type: 'RADIO',
        options: options.map(opt => ({ value: opt }))
      };
    } else if (questionType === 'CHECKBOX' || questionType === 'CHECKBOXES') {
      if (!options || options.length === 0) {
        throw new Error('Checkbox questions require options');
      }
      questionItem.question.choiceQuestion = {
        type: 'CHECKBOX',
        options: options.map(opt => ({ value: opt }))
      };
    } else if (questionType === 'DROPDOWN' || questionType === 'DROP_DOWN') {
      if (!options || options.length === 0) {
        throw new Error('Dropdown questions require options');
      }
      questionItem.question.choiceQuestion = {
        type: 'DROP_DOWN',
        options: options.map(opt => ({ value: opt }))
      };
    } else if (questionType === 'DATE') {
      questionItem.question.dateQuestion = {
        includeTime: false,
        includeYear: true
      };
    } else if (questionType === 'TIME') {
      questionItem.question.timeQuestion = {
        duration: false
      };
    } else {
      // Default to text question
      questionItem.question.textQuestion = {};
    }
    
    // Set required field
    questionItem.question.required = required || false;
    
    // Add the question via batchUpdate
    const response = await forms.forms.batchUpdate({
      formId: formId,
      requestBody: {
        requests: [{
          createItem: {
            item: {
              title: title,
              questionItem: questionItem
            },
            location: {
              index: currentItemsCount
            }
          }
        }]
      }
    });
    
    // Extract the created question ID from the response
    const questionId = response.data.replies && response.data.replies[0] && response.data.replies[0].createItem
      ? response.data.replies[0].createItem.itemId
      : null;
    
    return {
      success: true,
      formId: formId,
      questionId: questionId,
      message: `Question "${title}" added successfully`
    };
    
  } catch (error) {
    console.error('Error adding question:', error);
    throw error;
  }
}

/**
 * Add a section to an existing form
 */
async function addSection(userIdentifier, params) {
  try {
    const { forms } = await getFormsClient(userIdentifier);
    const { formId, title, description } = params;
    
    // Get current form to know where to add the section
    const currentForm = await forms.forms.get({ formId: formId });
    const currentItemsCount = currentForm.data.items ? currentForm.data.items.length : 0;
    
    // Build the section item
    const pageBreakItem = {
      title: title,
      description: description || '',
      pageBreakItem: {}
    };
    
    // Add the section via batchUpdate
    const response = await forms.forms.batchUpdate({
      formId: formId,
      requestBody: {
        requests: [{
          createItem: {
            item: pageBreakItem,
            location: {
              index: currentItemsCount
            }
          }
        }]
      }
    });
    
    // Extract the created section ID from the response
    const sectionId = response.data.replies && response.data.replies[0] && response.data.replies[0].createItem
      ? response.data.replies[0].createItem.itemId
      : null;
    
    return {
      success: true,
      formId: formId,
      sectionId: sectionId,
      message: `Section "${title}" added successfully`
    };
    
  } catch (error) {
    console.error('Error adding section:', error);
    throw error;
  }
}

module.exports = {
  getFormsClient,
  listForms,
  createForm,
  getResponses,
  getForm,
  updateForm,
  publishForm,
  addQuestion,
  addSection,
  SCOPES
};
