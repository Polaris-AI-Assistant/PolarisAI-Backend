/**
 * Gmail Agent Controller
 * 
 * HTTP endpoint for interacting with the Gmail AI Agent.
 * Handles natural language queries and returns AI-processed responses.
 */

const express = require('express');
const GmailAgent = require('./gmailAgent');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Initialize the Gmail AI Agent
const gmailAgent = new GmailAgent();

/**
 * POST /gmail/agent/query
 * Process natural language queries about Gmail
 * 
 * Request body:
 * {
 *   "query": "send an email to john@example.com about the meeting"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "response": "I've sent the email...",
 *   "query": "send an email...",
 *   "tools_used": [...],
 *   "timestamp": "2025-01-01T00:00:00.000Z"
 * }
 */
router.post('/agent/query', authenticateToken, async (req, res) => {
  try {
    const { query, conversationHistory } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Query is required and must be a non-empty string',
        example: {
          query: "show me my unread emails"
        }
      });
    }

    console.log(`[GmailAgentController] User ${userId} query: "${query}"`);

    // Process the query through the agent with conversation history
    const result = await gmailAgent.processQuery(query, userId, { conversationHistory });

    // Return the result
    res.json(result);

  } catch (error) {
    console.error('[GmailAgentController] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process query',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /gmail/agent/examples
 * Get example queries that users can try
 */
router.get('/agent/examples', (req, res) => {
  res.json({
    success: true,
    examples: [
      {
        category: "Sending Emails",
        queries: [
          "Send an email to john@example.com with subject 'Meeting Tomorrow' saying we should meet at 3pm",
          "Reply to the last email from my boss saying I'll have the report ready by Friday",
          "Forward the invoice email to accounting@company.com"
        ]
      },
      {
        category: "Reading Emails",
        queries: [
          "Show me my latest emails",
          "What are my unread emails?",
          "Read the email from john@example.com about the project"
        ]
      },
      {
        category: "Searching Emails",
        queries: [
          "Find all emails with attachments from last week",
          "Search for emails about invoices from finance@company.com",
          "Show me starred emails from this month"
        ]
      },
      {
        category: "Draft Management",
        queries: [
          "Create a draft email to HR about vacation request",
          "Show me my drafts",
          "Send the draft to john@example.com",
          "Delete my old drafts"
        ]
      },
      {
        category: "Label Management",
        queries: [
          "What labels do I have?",
          "Create a label called 'Important Projects'",
          "Add the 'Urgent' label to the last email",
          "Remove the 'To Review' label from email XYZ"
        ]
      },
      {
        category: "Filter Management",
        queries: [
          "Show me my email filters",
          "Create a filter to auto-label emails from newsletter@tech.com as 'Newsletters'",
          "Set up a rule to star all emails from boss@company.com"
        ]
      },
      {
        category: "Email Actions",
        queries: [
          "Mark the last 5 emails as read",
          "Star the email about the project deadline",
          "Archive all emails from newsletters",
          "Move the spam email to trash"
        ]
      }
    ],
    tips: [
      "Be specific about email recipients and subjects",
      "Use natural language - I understand context",
      "You can reference emails by sender, subject, or ID",
      "For search, you can use date ranges and keywords",
      "Ask me to help compose professional emails"
    ]
  });
});

/**
 * GET /gmail/agent/capabilities
 * Get information about agent capabilities
 */
router.get('/agent/capabilities', (req, res) => {
  res.json({
    success: true,
    capabilities: {
      tools: [
        {
          name: "sendEmail",
          description: "Send a new email",
          parameters: ["to (required)", "subject (required)", "body (required)", "cc", "bcc", "isHtml"]
        },
        {
          name: "replyToEmail",
          description: "Reply to an existing email",
          parameters: ["messageId (required)", "body (required)", "replyAll"]
        },
        {
          name: "forwardEmail",
          description: "Forward an email",
          parameters: ["messageId (required)", "to (required)", "additionalMessage"]
        },
        {
          name: "readEmail",
          description: "Read a specific email",
          parameters: ["messageId (required)"]
        },
        {
          name: "getLatestEmails",
          description: "Get recent emails",
          parameters: ["maxResults", "labelIds"]
        },
        {
          name: "getUnreadEmails",
          description: "Get unread emails",
          parameters: ["maxResults"]
        },
        {
          name: "searchEmails",
          description: "Search emails using Gmail syntax",
          parameters: ["query (required)", "maxResults"]
        },
        {
          name: "getEmailsByThread",
          description: "Get all emails in a thread",
          parameters: ["threadId (required)"]
        },
        {
          name: "getEmailsBySender",
          description: "Get emails from a specific sender",
          parameters: ["senderEmail (required)", "maxResults"]
        },
        {
          name: "createDraft",
          description: "Create an email draft",
          parameters: ["to (required)", "subject (required)", "body (required)", "cc", "bcc"]
        },
        {
          name: "listDrafts",
          description: "List all drafts",
          parameters: ["maxResults"]
        },
        {
          name: "updateDraft",
          description: "Update a draft",
          parameters: ["draftId (required)", "to", "subject", "body"]
        },
        {
          name: "deleteDraft",
          description: "Delete a draft",
          parameters: ["draftId (required)"]
        },
        {
          name: "sendDraft",
          description: "Send a draft",
          parameters: ["draftId (required)"]
        },
        {
          name: "listLabels",
          description: "List all labels",
          parameters: []
        },
        {
          name: "createLabel",
          description: "Create a new label",
          parameters: ["name (required)", "labelListVisibility", "messageListVisibility"]
        },
        {
          name: "applyLabels",
          description: "Apply labels to an email",
          parameters: ["messageId (required)", "labelIds (required)"]
        },
        {
          name: "removeLabels",
          description: "Remove labels from an email",
          parameters: ["messageId (required)", "labelIds (required)"]
        },
        {
          name: "deleteLabel",
          description: "Delete a label",
          parameters: ["labelId (required)"]
        },
        {
          name: "listFilters",
          description: "List all email filters",
          parameters: []
        },
        {
          name: "createFilter",
          description: "Create an email filter",
          parameters: ["criteria (required)", "action (required)"]
        },
        {
          name: "deleteFilter",
          description: "Delete a filter",
          parameters: ["filterId (required)"]
        },
        {
          name: "markAsRead",
          description: "Mark email as read",
          parameters: ["messageId (required)"]
        },
        {
          name: "markAsUnread",
          description: "Mark email as unread",
          parameters: ["messageId (required)"]
        },
        {
          name: "starEmail",
          description: "Star/unstar an email",
          parameters: ["messageId (required)", "starred"]
        },
        {
          name: "trashEmail",
          description: "Move email to trash",
          parameters: ["messageId (required)"]
        },
        {
          name: "archiveEmail",
          description: "Archive an email",
          parameters: ["messageId (required)"]
        }
      ],
      searchSyntax: [
        "from:sender@email.com - emails from sender",
        "to:recipient@email.com - emails to recipient",
        "subject:keyword - keyword in subject",
        "has:attachment - emails with attachments",
        "is:unread - unread emails",
        "is:starred - starred emails",
        "after:YYYY/MM/DD - emails after date",
        "before:YYYY/MM/DD - emails before date",
        "larger:10M - emails larger than 10MB",
        "label:labelname - emails with label"
      ],
      features: [
        "Natural language processing",
        "Multi-tool query support",
        "Context-aware responses",
        "Email composition assistance",
        "Intelligent search",
        "Error handling with helpful messages"
      ]
    }
  });
});

module.exports = router;
