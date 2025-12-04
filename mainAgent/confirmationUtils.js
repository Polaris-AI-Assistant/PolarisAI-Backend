/**
 * Confirmation Utilities
 * 
 * Utilities for determining which tools require confirmation and
 * generating human-readable preview content for confirmation dialogs.
 * 
 * This module defines the confirmation policy for sensitive operations
 * across all specialized agents.
 */

/**
 * Helper function to get emoji for question type
 */
function getQuestionTypeEmoji(type) {
  const typeEmojis = {
    'text': '📝',
    'paragraph': '📄',
    'radio': '🔘',
    'checkbox': '☑️',
    'dropdown': '📋',
    'scale': '⭐',
    'date': '📅',
    'time': '🕐'
  };
  return typeEmojis[type] || '❓';
}

/**
 * Map of tools that require user confirmation before execution
 * Organized by agent name for easy maintenance
 * 
 * Structure:
 * {
 *   agentName: {
 *     toolName: {
 *       confirmationRequired: boolean,
 *       previewGenerator: function(params) => string
 *     }
 *   }
 * }
 */
const confirmationConfig = {
  // Calendar Agent - Create/Update/Delete events need confirmation
  calendar: {
    createEvent: {
      confirmationRequired: true,
      actionType: 'create_event',
      description: 'Create a calendar event',
      generatePreview: (params) => {
        const lines = ['📅 **Create Calendar Event**\n'];
        lines.push(`**Title:** ${params.summary || 'Untitled Event'}`);
        
        if (params.startDateTime) {
          const start = new Date(params.startDateTime);
          lines.push(`**Start:** ${start.toLocaleString()}`);
        }
        if (params.endDateTime) {
          const end = new Date(params.endDateTime);
          lines.push(`**End:** ${end.toLocaleString()}`);
        }
        if (params.location) {
          lines.push(`**Location:** ${params.location}`);
        }
        if (params.description) {
          lines.push(`**Description:** ${params.description}`);
        }
        if (params.attendees && params.attendees.length > 0) {
          lines.push(`**Attendees:** ${params.attendees.join(', ')}`);
        }
        if (params.addGoogleMeet) {
          lines.push('**Google Meet:** A video call link will be added');
        }
        
        return lines.join('\n');
      }
    },
    updateEvent: {
      confirmationRequired: true,
      actionType: 'update_event',
      description: 'Update a calendar event',
      generatePreview: (params) => {
        const lines = ['📅 **Update Calendar Event**\n'];
        lines.push(`**Event ID:** ${params.eventId}`);
        
        if (params.summary) lines.push(`**New Title:** ${params.summary}`);
        if (params.startDateTime) {
          const start = new Date(params.startDateTime);
          lines.push(`**New Start:** ${start.toLocaleString()}`);
        }
        if (params.endDateTime) {
          const end = new Date(params.endDateTime);
          lines.push(`**New End:** ${end.toLocaleString()}`);
        }
        if (params.location) lines.push(`**New Location:** ${params.location}`);
        if (params.description) lines.push(`**New Description:** ${params.description}`);
        if (params.attendees) lines.push(`**Updated Attendees:** ${params.attendees.join(', ')}`);
        
        return lines.join('\n');
      }
    },
    deleteEvent: {
      confirmationRequired: true,
      actionType: 'delete_event',
      description: 'Delete a calendar event',
      generatePreview: (params) => {
        const lines = ['🗑️ **Delete Calendar Event**\n'];
        lines.push(`**Event ID:** ${params.eventId}`);
        lines.push(`**Calendar:** ${params.calendarId || 'primary'}`);
        lines.push('\n⚠️ This action cannot be undone.');
        return lines.join('\n');
      }
    },
    deleteCalendar: {
      confirmationRequired: true,
      actionType: 'delete_calendar',
      description: 'Delete a calendar',
      generatePreview: (params) => {
        const lines = ['🗑️ **Delete Calendar**\n'];
        lines.push(`**Calendar ID:** ${params.calendarId}`);
        lines.push('\n⚠️ This will permanently delete the calendar and all its events.');
        return lines.join('\n');
      }
    }
  },
  
  // Docs Agent - Create/Delete docs need confirmation
  docs: {
    createDocument: {
      confirmationRequired: true,
      actionType: 'create_document',
      description: 'Create a Google Doc',
      generatePreview: (params) => {
        const lines = ['📄 **Create Google Document**\n'];
        lines.push(`**Title:** ${params.title || 'Untitled Document'}`);
        if (params.content) {
          const preview = params.content.substring(0, 200);
          lines.push(`**Initial Content:** ${preview}${params.content.length > 200 ? '...' : ''}`);
        }
        return lines.join('\n');
      }
    },
    deleteDocument: {
      confirmationRequired: true,
      actionType: 'delete_document',
      description: 'Delete a Google Doc',
      generatePreview: (params) => {
        const lines = ['🗑️ **Delete Google Document**\n'];
        lines.push(`**Document ID:** ${params.documentId}`);
        lines.push('\n⚠️ This action cannot be undone.');
        return lines.join('\n');
      }
    },
    shareDocument: {
      confirmationRequired: true,
      actionType: 'share_document',
      description: 'Share a Google Doc',
      generatePreview: (params) => {
        const lines = ['🔗 **Share Google Document**\n'];
        lines.push(`**Document ID:** ${params.documentId}`);
        lines.push(`**Share with:** ${params.emailAddress}`);
        lines.push(`**Permission:** ${params.role || 'reader'}`);
        return lines.join('\n');
      }
    }
  },
  
  // Forms Agent - Create/Delete forms need confirmation
  forms: {
    createForm: {
      confirmationRequired: true,
      actionType: 'create_form',
      description: 'Create a Google Form',
      generatePreview: (params) => {
        const lines = ['📝 **Create Google Form**\n'];
        lines.push(`**Title:** ${params.title || 'Untitled Form'}`);
        if (params.description) {
          lines.push(`**Description:** ${params.description}`);
        }
        
        // Display generated questions
        if (params.questions && params.questions.length > 0) {
          lines.push('\n**Questions:**');
          params.questions.forEach((q, index) => {
            const requiredMark = q.required ? ' *(required)*' : '';
            const typeEmoji = getQuestionTypeEmoji(q.type);
            lines.push(`${index + 1}. ${typeEmoji} ${q.title}${requiredMark}`);
            
            // Show options for choice-based questions
            if (q.options && q.options.length > 0 && ['radio', 'checkbox', 'dropdown'].includes(q.type)) {
              q.options.forEach(opt => {
                lines.push(`   • ${opt}`);
              });
            }
            
            // Show scale info
            if (q.type === 'scale') {
              lines.push(`   _(Scale: 1-5)_`);
            }
          });
        }
        
        return lines.join('\n');
      }
    },
    deleteForm: {
      confirmationRequired: true,
      actionType: 'delete_form',
      description: 'Delete a Google Form',
      generatePreview: (params) => {
        const lines = ['🗑️ **Delete Google Form**\n'];
        lines.push(`**Form ID:** ${params.formId}`);
        lines.push('\n⚠️ This will permanently delete the form and all responses.');
        return lines.join('\n');
      }
    }
  },
  
  // Meet Agent - Create meetings need confirmation
  meet: {
    createMeetingSpace: {
      confirmationRequired: true,
      actionType: 'create_meeting',
      description: 'Create a Google Meet',
      generatePreview: (params) => {
        const lines = ['📹 **Create Google Meet**\n'];
        if (params.displayName) {
          lines.push(`**Meeting Name:** ${params.displayName}`);
        }
        lines.push('A new Google Meet link will be generated.');
        return lines.join('\n');
      }
    }
  },
  
  // Sheets Agent - Create/Delete sheets need confirmation
  sheets: {
    createSpreadsheet: {
      confirmationRequired: true,
      actionType: 'create_spreadsheet',
      description: 'Create a Google Sheet',
      generatePreview: (params) => {
        const lines = ['📊 **Create Google Spreadsheet**\n'];
        lines.push(`**Title:** ${params.title || 'Untitled Spreadsheet'}`);
        return lines.join('\n');
      }
    },
    deleteSpreadsheet: {
      confirmationRequired: true,
      actionType: 'delete_spreadsheet',
      description: 'Delete a Google Sheet',
      generatePreview: (params) => {
        const lines = ['🗑️ **Delete Google Spreadsheet**\n'];
        lines.push(`**Spreadsheet ID:** ${params.spreadsheetId}`);
        lines.push('\n⚠️ This action cannot be undone.');
        return lines.join('\n');
      }
    },
    shareSpreadsheet: {
      confirmationRequired: true,
      actionType: 'share_spreadsheet',
      description: 'Share a Google Sheet',
      generatePreview: (params) => {
        const lines = ['🔗 **Share Google Spreadsheet**\n'];
        lines.push(`**Spreadsheet ID:** ${params.spreadsheetId}`);
        lines.push(`**Share with:** ${params.emailAddress}`);
        lines.push(`**Permission:** ${params.role || 'reader'}`);
        return lines.join('\n');
      }
    }
  },
  
  // GitHub Agent - Create/Delete operations need confirmation
  github: {
    createRepository: {
      confirmationRequired: true,
      actionType: 'create_repository',
      description: 'Create a GitHub repository',
      generatePreview: (params) => {
        const lines = ['⚡ **Create GitHub Repository**\n'];
        lines.push(`**Name:** ${params.name}`);
        if (params.description) {
          lines.push(`**Description:** ${params.description}`);
        }
        lines.push(`**Visibility:** ${params.private ? 'Private' : 'Public'}`);
        return lines.join('\n');
      }
    },
    deleteRepository: {
      confirmationRequired: true,
      actionType: 'delete_repository',
      description: 'Delete a GitHub repository',
      generatePreview: (params) => {
        const lines = ['🗑️ **Delete GitHub Repository**\n'];
        lines.push(`**Repository:** ${params.owner}/${params.repo}`);
        lines.push('\n⚠️ This will permanently delete the repository and all its contents!');
        return lines.join('\n');
      }
    },
    createIssue: {
      confirmationRequired: true,
      actionType: 'create_issue',
      description: 'Create a GitHub issue',
      generatePreview: (params) => {
        const lines = ['📋 **Create GitHub Issue**\n'];
        lines.push(`**Repository:** ${params.owner}/${params.repo}`);
        lines.push(`**Title:** ${params.title}`);
        if (params.body) {
          const preview = params.body.substring(0, 200);
          lines.push(`**Body:** ${preview}${params.body.length > 200 ? '...' : ''}`);
        }
        return lines.join('\n');
      }
    },
    createPullRequest: {
      confirmationRequired: true,
      actionType: 'create_pull_request',
      description: 'Create a GitHub pull request',
      generatePreview: (params) => {
        const lines = ['🔀 **Create GitHub Pull Request**\n'];
        lines.push(`**Repository:** ${params.owner}/${params.repo}`);
        lines.push(`**Title:** ${params.title}`);
        lines.push(`**Base:** ${params.base}`);
        lines.push(`**Head:** ${params.head}`);
        return lines.join('\n');
      }
    }
  },
  
  // Gmail - Send email always needs confirmation
  gmail: {
    sendEmail: {
      confirmationRequired: true,
      actionType: 'send_email',
      description: 'Send an email',
      generatePreview: (params) => {
        const lines = ['✉️ **Send Email**\n'];
        lines.push(`**To:** ${params.to}`);
        if (params.cc) lines.push(`**CC:** ${params.cc}`);
        if (params.bcc) lines.push(`**BCC:** ${params.bcc}`);
        lines.push(`**Subject:** ${params.subject}`);
        lines.push('\n**Content:**');
        
        // If AI has already generated the content, show it
        if (params.isAIGenerated && params.body) {
          lines.push(params.body);
        } else if (params.body && params.body.trim()) {
          lines.push(params.body);
          lines.push('\n_✨ AI will compose a proper email based on this intent_');
        } else {
          lines.push('_(AI will generate appropriate email content)_');
        }
        return lines.join('\n');
      }
    },
    replyToEmail: {
      confirmationRequired: true,
      actionType: 'reply_email',
      description: 'Reply to an email',
      generatePreview: (params) => {
        const lines = ['↩️ **Reply to Email**\n'];
        lines.push(`**Original Message ID:** ${params.messageId}`);
        lines.push(`**Reply All:** ${params.replyAll ? 'Yes' : 'No'}`);
        lines.push('\n**Reply Body:**');
        if (params.body) {
          const preview = params.body.substring(0, 500);
          lines.push(preview + (params.body.length > 500 ? '...' : ''));
        }
        return lines.join('\n');
      }
    },
    forwardEmail: {
      confirmationRequired: true,
      actionType: 'forward_email',
      description: 'Forward an email',
      generatePreview: (params) => {
        const lines = ['➡️ **Forward Email**\n'];
        lines.push(`**Original Message ID:** ${params.messageId}`);
        lines.push(`**Forward To:** ${params.to}`);
        if (params.additionalMessage) {
          lines.push('\n**Additional Message:**');
          lines.push(params.additionalMessage);
        }
        return lines.join('\n');
      }
    },
    trashEmail: {
      confirmationRequired: true,
      actionType: 'trash_email',
      description: 'Move email to trash',
      generatePreview: (params) => {
        const lines = ['🗑️ **Move to Trash**\n'];
        lines.push(`**Message ID:** ${params.messageId}`);
        lines.push('\n⚠️ The email will be moved to trash.');
        return lines.join('\n');
      }
    },
    createFilter: {
      confirmationRequired: true,
      actionType: 'create_filter',
      description: 'Create an email filter',
      generatePreview: (params) => {
        const lines = ['🔧 **Create Email Filter**\n'];
        lines.push('**Criteria:**');
        if (params.criteria) {
          if (params.criteria.from) lines.push(`  • From: ${params.criteria.from}`);
          if (params.criteria.to) lines.push(`  • To: ${params.criteria.to}`);
          if (params.criteria.subject) lines.push(`  • Subject contains: ${params.criteria.subject}`);
          if (params.criteria.query) lines.push(`  • Query: ${params.criteria.query}`);
          if (params.criteria.hasAttachment) lines.push(`  • Has attachment: Yes`);
        }
        lines.push('\n**Actions:**');
        if (params.action) {
          if (params.action.addLabelIds) lines.push(`  • Add labels: ${params.action.addLabelIds.join(', ')}`);
          if (params.action.removeLabelIds) lines.push(`  • Remove labels: ${params.action.removeLabelIds.join(', ')}`);
          if (params.action.forward) lines.push(`  • Forward to: ${params.action.forward}`);
          if (params.action.markAsRead) lines.push(`  • Mark as read`);
          if (params.action.star) lines.push(`  • Star`);
          if (params.action.archive) lines.push(`  • Archive`);
          if (params.action.trash) lines.push(`  • Move to trash`);
        }
        return lines.join('\n');
      }
    },
    sendEmailWithPrompt: {
      confirmationRequired: true,
      actionType: 'send_email',
      description: 'Send an AI-generated email',
      generatePreview: (params) => {
        const lines = ['✉️ **Send AI-Generated Email**\n'];
        lines.push(`**To:** ${params.recipientEmail || params.to}`);
        lines.push(`**Prompt:** ${params.userPrompt || params.prompt}`);
        if (params.generatedSubject) {
          lines.push(`\n**Generated Subject:** ${params.generatedSubject}`);
        }
        if (params.generatedBody) {
          lines.push('\n**Generated Body:**');
          const preview = params.generatedBody.substring(0, 500);
          lines.push(preview + (params.generatedBody.length > 500 ? '...' : ''));
        }
        return lines.join('\n');
      }
    }
  }
};

/**
 * Check if a tool requires confirmation
 * 
 * @param {string} agentName - Name of the specialized agent
 * @param {string} toolName - Name of the tool
 * @returns {boolean} - True if confirmation is required
 */
function requiresConfirmation(agentName, toolName) {
  const agentConfig = confirmationConfig[agentName];
  if (!agentConfig) return false;
  
  const toolConfig = agentConfig[toolName];
  if (!toolConfig) return false;
  
  return toolConfig.confirmationRequired === true;
}

/**
 * Generate preview content for a tool action
 * 
 * @param {string} agentName - Name of the specialized agent
 * @param {string} toolName - Name of the tool
 * @param {object} params - Tool parameters
 * @returns {string} - Human-readable preview content
 */
function generatePreview(agentName, toolName, params) {
  const agentConfig = confirmationConfig[agentName];
  if (!agentConfig) {
    return `Action: ${toolName}\nParameters: ${JSON.stringify(params, null, 2)}`;
  }
  
  const toolConfig = agentConfig[toolName];
  if (!toolConfig || !toolConfig.generatePreview) {
    return `Action: ${toolName}\nParameters: ${JSON.stringify(params, null, 2)}`;
  }
  
  try {
    return toolConfig.generatePreview(params);
  } catch (error) {
    console.error(`[ConfirmationUtils] Error generating preview for ${agentName}.${toolName}:`, error);
    return `Action: ${toolName}\nParameters: ${JSON.stringify(params, null, 2)}`;
  }
}

/**
 * Get action type for a tool (used for categorization)
 * 
 * @param {string} agentName - Name of the specialized agent
 * @param {string} toolName - Name of the tool
 * @returns {string} - Action type identifier
 */
function getActionType(agentName, toolName) {
  const agentConfig = confirmationConfig[agentName];
  if (!agentConfig) return 'unknown';
  
  const toolConfig = agentConfig[toolName];
  if (!toolConfig) return 'unknown';
  
  return toolConfig.actionType || 'unknown';
}

/**
 * Get description for a tool action
 * 
 * @param {string} agentName - Name of the specialized agent
 * @param {string} toolName - Name of the tool
 * @returns {string} - Human-readable description
 */
function getActionDescription(agentName, toolName) {
  const agentConfig = confirmationConfig[agentName];
  if (!agentConfig) return `Execute ${toolName}`;
  
  const toolConfig = agentConfig[toolName];
  if (!toolConfig) return `Execute ${toolName}`;
  
  return toolConfig.description || `Execute ${toolName}`;
}

/**
 * Get all confirmation-required tools for an agent
 * 
 * @param {string} agentName - Name of the specialized agent
 * @returns {string[]} - Array of tool names that require confirmation
 */
function getConfirmationRequiredTools(agentName) {
  const agentConfig = confirmationConfig[agentName];
  if (!agentConfig) return [];
  
  return Object.entries(agentConfig)
    .filter(([, config]) => config.confirmationRequired)
    .map(([toolName]) => toolName);
}

/**
 * Get full confirmation config (for debugging/admin)
 */
function getFullConfig() {
  return confirmationConfig;
}

module.exports = {
  requiresConfirmation,
  generatePreview,
  getActionType,
  getActionDescription,
  getConfirmationRequiredTools,
  getFullConfig
};
