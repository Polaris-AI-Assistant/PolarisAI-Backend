/**
 * Main Coordinator Agent
 * 
 * This is the central agent that coordinates all app-specific agents.
 * It analyzes user requests, determines which specialized agents are needed,
 * routes queries to appropriate agents, and combines their responses into
 * a coherent final output.
 * 
 * Features:
 * - Natural language query analysis and intent detection
 * - Multi-agent coordination and routing
 * - Response aggregation and deduplication
 * - Intelligent context management
 * - Comprehensive error handling
 * - Support for single and multi-app queries
 * 
 * Available Agents:
 * - CalendarAgent: Google Calendar operations
 * - DocsAgent: Google Docs operations
 * - FormsAgent: Google Forms operations
 * - GitHubAgent: GitHub operations
 * - MeetAgent: Google Meet operations
 * - SheetsAgent: Google Sheets operations
 * 
 * Usage:
 * const mainAgent = new MainAgent();
 * const result = await mainAgent.processQuery("schedule a meeting and create a document", userId);
 */

const OpenAI = require('openai');
const CalendarAgent = require('../calendar/calendarAgent');
const docsAgent = require('../docs/docsAgent'); // Note: This exports functions, not a class
const FormsAgent = require('../forms/formsAgent');
const GitHubAgent = require('../github/githubAgent');
const MeetAgent = require('../meet/meetAgent');
const SheetsAgent = require('../sheets/sheetsAgent');
const confirmationStore = require('./confirmationStore');
const confirmationUtils = require('./confirmationUtils');

class MainAgent {
  constructor() {
    // Initialize OpenAI client
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Initialize all specialized agents
    // Note: docsAgent exports functions, not a class, so we wrap it
    this.agents = {
      calendar: new CalendarAgent(),
      docs: {
        processQuery: (query, userId) => docsAgent.processQuery(query, userId)
      },
      forms: new FormsAgent(),
      github: new GitHubAgent(),
      meet: new MeetAgent(),
      sheets: new SheetsAgent()
    };

    // System prompt for the main coordinator
    this.systemPrompt = this.createSystemPrompt();
  }

  /**
   * Check if a tool call requires confirmation and handle accordingly
   * This intercepts tool calls from specialized agents when confirmation is needed
   * 
   * @param {string} agentName - The specialized agent name
   * @param {string} toolName - The tool being called
   * @param {object} params - Tool parameters
   * @param {string} userId - User ID
   * @param {string} query - Original user query
   * @param {array} conversationHistory - Conversation context
   * @returns {object|null} - Confirmation request object if needed, null otherwise
   */
  checkForConfirmationRequired(agentName, toolName, params, userId, query, conversationHistory = []) {
    if (!confirmationUtils.requiresConfirmation(agentName, toolName)) {
      return null;
    }

    console.log(`[MainAgent] Tool ${toolName} requires confirmation`);

    const previewContent = confirmationUtils.generatePreview(agentName, toolName, params);
    const requestId = confirmationStore.storePendingAction(
      userId,
      toolName,
      agentName,
      params,
      previewContent,
      query,
      conversationHistory
    );

    return {
      type: 'confirmation_request',
      requestId: requestId,
      toolName: toolName,
      agentName: agentName,
      actionType: confirmationUtils.getActionType(agentName, toolName),
      description: confirmationUtils.getActionDescription(agentName, toolName),
      params: params,
      previewContent: previewContent
    };
  }

  /**
   * Execute a confirmed action
   * This is called after user confirms the pending action
   * 
   * @param {string} requestId - The pending action request ID
   * @param {string} userId - User ID for validation
   * @returns {object} - Result of the tool execution
   */
  async executeConfirmedAction(requestId, userId) {
    const pendingAction = confirmationStore.getPendingAction(requestId, userId);
    
    if (!pendingAction) {
      return {
        success: false,
        error: 'Action not found, expired, or unauthorized'
      };
    }

    try {
      const { agentName, toolName, params, query, conversationHistory } = pendingAction;
      
      console.log(`[MainAgent] Executing confirmed action: ${toolName} on ${agentName}`);
      
      // Get the specialized agent
      const agent = this.agents[agentName];
      if (!agent) {
        throw new Error(`Agent '${agentName}' not found`);
      }

      // Execute the tool through the agent's processQuery with a directive to execute
      // We create a special query that forces the agent to execute the specific tool
      const executionQuery = `Execute the following action: ${toolName} with parameters: ${JSON.stringify(params)}`;
      
      const result = await agent.processQuery(executionQuery, userId, { 
        conversationHistory,
        forceToolExecution: {
          toolName,
          params
        }
      });

      // Remove the pending action after successful execution
      confirmationStore.removePendingAction(requestId);

      return {
        success: true,
        result: result,
        query: query,
        toolName: toolName,
        agentName: agentName
      };

    } catch (error) {
      console.error(`[MainAgent] Error executing confirmed action:`, error);
      // Remove the pending action even on failure to prevent retries
      confirmationStore.removePendingAction(requestId);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Cancel a pending action
   * 
   * @param {string} requestId - The pending action request ID
   * @param {string} userId - User ID for validation
   * @returns {object} - Cancellation result
   */
  cancelPendingAction(requestId, userId) {
    const pendingAction = confirmationStore.getPendingAction(requestId, userId);
    
    if (!pendingAction) {
      return {
        success: false,
        error: 'Action not found, expired, or unauthorized'
      };
    }

    confirmationStore.removePendingAction(requestId);

    return {
      success: true,
      message: 'Action canceled. Let me know if you want to make any changes or try something different.',
      canceledAction: {
        toolName: pendingAction.toolName,
        agentName: pendingAction.agentName
      }
    };
  }

  /**
   * Create the system prompt that defines the main agent's behavior
   */
  createSystemPrompt() {
    return `You are an intelligent Main Coordinator Agent that manages multiple specialized agents for different services.

Your responsibilities:
1. Analyze user requests to understand their intent
2. Determine which specialized agent(s) are needed to fulfill the request
3. Route queries to the appropriate agent(s)
4. Combine and structure responses from multiple agents when needed
5. Ensure responses are coherent, non-repetitive, and user-friendly
6. Provide helpful, conversational responses

Available specialized agents and their capabilities:

**CalendarAgent**: Google Calendar operations
- Create, update, delete calendar events
- List events by date range or search criteria
- Manage calendars
- Handle recurring events

**DocsAgent**: Google Docs operations
- Create new documents
- Insert, append, replace, and delete text
- Format text (bold, italic, underline, etc.)
- Add headings, lists, and links
- Share and manage document permissions

**FormsAgent**: Google Forms operations
- Create new forms
- Add and manage questions
- Update form settings
- Retrieve form responses
- List all forms

**GitHubAgent**: GitHub operations
- View profile and repositories
- List commits, issues, pull requests
- Search code and repositories
- View repository statistics
- Filter by language, date, etc.

**MeetAgent**: Google Meet operations
- Create meeting spaces
- Get meeting details
- List conference history
- Manage recordings
- Track participants

**SheetsAgent**: Google Sheets operations
- Create spreadsheets
- Read and write data to cells
- Add/delete rows and columns
- Format cells and ranges
- Share and manage permissions

Guidelines:
- If a request involves multiple services, coordinate the agents appropriately
- Be conversational and friendly in your responses
- If a request is ambiguous, ask clarifying questions
- Always provide context about what actions were taken
- Handle errors gracefully and provide helpful error messages
- Combine related information to avoid redundancy
- Maintain conversation context across multiple queries`;
  }

  /**
   * Analyze the query and determine which agents are needed
   * Uses OpenAI to intelligently route the request
   */
  async analyzeQuery(query, conversationHistory = []) {
    try {
      const analysisPrompt = `Analyze the following user query and determine which specialized agent(s) are needed to fulfill it.

User Query: "${query}"

Available agents:
- calendar: Google Calendar operations (events, meetings, schedules)
- docs: Google Docs operations (create/edit documents, text formatting)
- forms: Google Forms operations (create forms, manage questions, view responses)
- github: GitHub operations (repos, commits, issues, PRs, profile)
- meet: Google Meet operations (create meetings, view history, recordings)
- sheets: Google Sheets operations (create/edit spreadsheets, data management)

Respond with a JSON object containing:
{
  "agents": ["agent1", "agent2"],  // Array of agent names needed (can be one or multiple)
  "reasoning": "Why these agents were chosen",
  "queries": {  // Specific queries to send to each agent
    "agent1": "query for agent1",
    "agent2": "query for agent2"
  },
  "requiresSequential": false,  // true if agents must run in sequence, false if parallel
  "dependencies": {}  // Optional: if sequential, specify dependencies like {"agent2": "agent1"}
}

Examples:
- "schedule a meeting tomorrow" -> {"agents": ["calendar"], ...}
- "create a document and add it to my calendar" -> {"agents": ["docs", "calendar"], "requiresSequential": true, ...}
- "show me my GitHub repos" -> {"agents": ["github"], ...}
- "create a form about customer feedback and a spreadsheet to track responses" -> {"agents": ["forms", "sheets"], ...}

Important:
- Only include agents that are actually needed
- Break down complex multi-step requests appropriately
- Be specific in the queries for each agent
- Consider if operations need to be sequential (e.g., create then link) or can be parallel`;

      const messages = [
        { role: 'system', content: 'You are an expert at analyzing user requests and routing them to appropriate specialized agents. Always respond with valid JSON only, no other text.' },
        { role: 'user', content: analysisPrompt }
      ];

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini', // Using gpt-4o-mini which supports JSON mode and is cost-effective
        messages: messages,
        temperature: 0.3,
        response_format: { type: "json_object" }
      });

      const analysis = JSON.parse(response.choices[0].message.content);
      
      console.log('[MainAgent] Query analysis:', JSON.stringify(analysis, null, 2));
      
      return analysis;

    } catch (error) {
      console.error('[MainAgent] Error analyzing query:', error);
      throw new Error(`Failed to analyze query: ${error.message}`);
    }
  }

  /**
   * Execute queries on the specified agents
   */
  async executeAgentQueries(analysis, userId) {
    const results = {};
    const errors = {};

    try {
      if (analysis.requiresSequential) {
        // Execute agents sequentially based on dependencies
        for (const agentName of analysis.agents) {
          try {
            const agentQuery = analysis.queries[agentName];
            console.log(`[MainAgent] Executing ${agentName} sequentially with query: "${agentQuery}"`);
            
            const agent = this.agents[agentName];
            if (!agent) {
              throw new Error(`Agent '${agentName}' not found`);
            }

            const result = await agent.processQuery(agentQuery, userId);
            results[agentName] = result;

          } catch (error) {
            console.error(`[MainAgent] Error executing ${agentName}:`, error);
            errors[agentName] = {
              error: error.message,
              query: analysis.queries[agentName]
            };
          }
        }
      } else {
        // Execute agents in parallel for better performance
        const agentPromises = analysis.agents.map(async (agentName) => {
          try {
            const agentQuery = analysis.queries[agentName];
            console.log(`[MainAgent] Executing ${agentName} in parallel with query: "${agentQuery}"`);
            
            const agent = this.agents[agentName];
            if (!agent) {
              throw new Error(`Agent '${agentName}' not found`);
            }

            const result = await agent.processQuery(agentQuery, userId);
            return { agentName, result };

          } catch (error) {
            console.error(`[MainAgent] Error executing ${agentName}:`, error);
            return { 
              agentName, 
              error: {
                error: error.message,
                query: analysis.queries[agentName]
              }
            };
          }
        });

        const agentResults = await Promise.all(agentPromises);
        
        // Organize results and errors
        agentResults.forEach(({ agentName, result, error }) => {
          if (error) {
            errors[agentName] = error;
          } else {
            results[agentName] = result;
          }
        });
      }

      return { results, errors };

    } catch (error) {
      console.error('[MainAgent] Error executing agent queries:', error);
      throw error;
    }
  }

  /**
   * Combine and structure responses from multiple agents
   */
  async combineResponses(query, analysis, results, errors) {
    try {
      // If only one agent and no errors, return its response directly
      if (Object.keys(results).length === 1 && Object.keys(errors).length === 0) {
        const agentName = Object.keys(results)[0];
        return {
          response: results[agentName].response,
          agentUsed: agentName,
          toolsUsed: results[agentName].tools_used || [],
          singleAgent: true
        };
      }

      // For multiple agents or errors, use AI to create a coherent response
      const combinePrompt = `The user asked: "${query}"

The following agents were used to process this request:
${JSON.stringify(analysis.agents)}

Agent Results:
${JSON.stringify(results, null, 2)}

${Object.keys(errors).length > 0 ? `Errors encountered:\n${JSON.stringify(errors, null, 2)}` : ''}

Please create a single, coherent, user-friendly response that:
1. Combines information from all agent responses
2. Eliminates any redundancy or repetition
3. Presents the information in a natural, conversational way
4. Mentions any errors in a helpful manner
5. Provides clear next steps or confirmation of actions taken
6. Uses a friendly, helpful tone

Do not use phrases like "Agent X said" or "According to the Calendar Agent". 
Instead, present the information as if you're directly reporting the results.`;

      const messages = [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: combinePrompt }
      ];

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini', // Using same model for consistency
        messages: messages,
        temperature: 0.7
      });

      const combinedResponse = response.choices[0].message.content;

      // Collect all tools used across agents
      const allToolsUsed = [];
      Object.entries(results).forEach(([agentName, result]) => {
        if (result.tools_used) {
          result.tools_used.forEach(tool => {
            allToolsUsed.push({
              agent: agentName,
              tool: tool
            });
          });
        }
      });

      return {
        response: combinedResponse,
        agentsUsed: Object.keys(results),
        toolsUsed: allToolsUsed,
        multiAgent: true,
        errors: Object.keys(errors).length > 0 ? errors : undefined
      };

    } catch (error) {
      console.error('[MainAgent] Error combining responses:', error);
      throw new Error(`Failed to combine responses: ${error.message}`);
    }
  }

  /**
   * Main method to process user queries with streaming support
   * This orchestrates the entire flow from analysis to final response with SSE streaming
   * Now includes confirmation flow for sensitive operations
   */
  async processQueryWithStreaming(query, userId, options = {}, onChunk) {
    const startTime = Date.now();
    
    try {
      console.log(`[MainAgent] Processing streaming query for user ${userId}: "${query}"`);

      // Send initial status
      onChunk({ type: 'status', message: 'Analyzing your request...' });

      // Step 1: Analyze the query to determine which agents are needed
      const analysis = await this.analyzeQuery(query, options.conversationHistory);
      
      // Send analysis result
      onChunk({ 
        type: 'analysis', 
        agents: analysis.agents,
        reasoning: analysis.reasoning 
      });

      // Send status for agent execution
      if (analysis.agents.length === 1) {
        onChunk({ type: 'status', message: `Connecting to ${analysis.agents[0]} agent...` });
      } else {
        onChunk({ type: 'status', message: `Coordinating ${analysis.agents.length} agents...` });
      }

      // Step 2: Check if any agent actions require confirmation
      // For now, we execute queries and check if any tool in the result needs confirmation
      // This will be enhanced when specialized agents report their intended tools
      const { results, errors, confirmationRequest } = await this.executeAgentQueriesWithConfirmation(
        analysis, 
        userId, 
        query, 
        options.conversationHistory || []
      );

      // If a confirmation is required, send confirmation_request and stop
      if (confirmationRequest) {
        onChunk({ type: 'thinking', status: 'stop' });
        onChunk({ 
          type: 'confirmation_request',
          ...confirmationRequest
        });
        return;
      }

      // Send status for response generation
      onChunk({ type: 'status', message: 'Generating response...' });

      // Step 3: Stream the final response generation
      await this.streamCombinedResponse(query, analysis, results, errors, onChunk);

      const processingTime = Date.now() - startTime;

      // Send metadata
      onChunk({ 
        type: 'metadata',
        agentsUsed: analysis.agents,
        processingTime: `${processingTime}ms`,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[MainAgent] Error processing streaming query:', error);
      onChunk({ 
        type: 'error', 
        error: 'Failed to process query',
        message: error.message 
      });
    }
  }

  /**
   * Execute agent queries with confirmation checking
   * Checks if the analysis indicates a confirmation-required action
   */
  async executeAgentQueriesWithConfirmation(analysis, userId, query, conversationHistory) {
    // First, determine if any agent+query combination will require confirmation
    // We analyze the queries to detect confirmation-required intents
    for (const agentName of analysis.agents) {
      const agentQuery = analysis.queries[agentName];
      console.log(`[Confirmation] Checking agent: ${agentName}, query: ${agentQuery}`);
      const detectedAction = await this.detectConfirmationRequiredAction(agentName, agentQuery);
      
      if (detectedAction) {
        console.log(`[Confirmation] Detected action:`, JSON.stringify(detectedAction, null, 2));
        
        // Generate a preview and return confirmation request
        const previewContent = confirmationUtils.generatePreview(
          agentName, 
          detectedAction.toolName, 
          detectedAction.inferredParams
        );
        
        console.log(`[Confirmation] Generated preview:`, previewContent);
        
        const requestId = confirmationStore.storePendingAction(
          userId,
          detectedAction.toolName,
          agentName,
          detectedAction.inferredParams,
          previewContent,
          query,
          conversationHistory
        );

        return {
          results: {},
          errors: {},
          confirmationRequest: {
            requestId: requestId,
            toolName: detectedAction.toolName,
            agentName: agentName,
            actionType: confirmationUtils.getActionType(agentName, detectedAction.toolName),
            description: confirmationUtils.getActionDescription(agentName, detectedAction.toolName),
            params: detectedAction.inferredParams,
            previewContent: previewContent,
            originalQuery: query
          }
        };
      }
    }

    // No confirmation required, proceed with normal execution
    const { results, errors } = await this.executeAgentQueries(analysis, userId);
    return { results, errors, confirmationRequest: null };
  }

  /**
   * Detect if a query to an agent will trigger a confirmation-required action
   * Returns the detected tool and inferred parameters if confirmation is needed
   */
  /**
   * Detect if the query requires confirmation before execution
   * Returns async because some extractors (like forms) need AI generation
   */
  async detectConfirmationRequiredAction(agentName, agentQuery) {
    const query = agentQuery.toLowerCase();
    
    // Define patterns for each agent's confirmation-required actions
    const patterns = {
      calendar: [
        {
          patterns: ['create', 'schedule', 'add', 'book', 'set up'],
          keywords: ['event', 'meeting', 'appointment', 'call', 'reminder'],
          toolName: 'createEvent',
          extractParams: (q) => this.extractCalendarEventParams(q),
          isAsync: false
        },
        {
          patterns: ['delete', 'remove', 'cancel'],
          keywords: ['event', 'meeting', 'appointment'],
          toolName: 'deleteEvent',
          extractParams: () => ({ eventId: 'pending' }),
          isAsync: false
        },
        {
          patterns: ['update', 'change', 'modify', 'reschedule', 'move'],
          keywords: ['event', 'meeting', 'appointment', 'time', 'date'],
          toolName: 'updateEvent',
          extractParams: () => ({ eventId: 'pending' }),
          isAsync: false
        }
      ],
      docs: [
        {
          patterns: ['create', 'make', 'new'],
          keywords: ['document', 'doc', 'file'],
          toolName: 'createDocument',
          extractParams: (q) => this.extractDocParams(q),
          isAsync: false
        },
        {
          patterns: ['delete', 'remove'],
          keywords: ['document', 'doc'],
          toolName: 'deleteDocument',
          extractParams: () => ({ documentId: 'pending' }),
          isAsync: false
        },
        {
          patterns: ['share'],
          keywords: ['document', 'doc'],
          toolName: 'shareDocument',
          extractParams: () => ({ documentId: 'pending' }),
          isAsync: false
        }
      ],
      forms: [
        {
          patterns: ['create', 'make', 'new'],
          keywords: ['form', 'survey', 'questionnaire', 'quiz'],
          toolName: 'createForm',
          extractParams: (q) => this.extractFormParams(q),
          isAsync: true  // Form extraction uses AI to generate questions
        },
        {
          patterns: ['delete', 'remove'],
          keywords: ['form', 'survey'],
          toolName: 'deleteForm',
          extractParams: () => ({ formId: 'pending' }),
          isAsync: false
        }
      ],
      meet: [
        {
          patterns: ['create', 'start', 'new', 'set up', 'schedule'],
          keywords: ['meet', 'meeting', 'video call', 'video conference', 'google meet'],
          toolName: 'createMeetingSpace',
          extractParams: (q) => this.extractMeetParams(q),
          isAsync: false
        }
      ],
      sheets: [
        {
          patterns: ['create', 'make', 'new'],
          keywords: ['spreadsheet', 'sheet', 'excel'],
          toolName: 'createSpreadsheet',
          extractParams: (q) => this.extractSheetParams(q),
          isAsync: false
        },
        {
          patterns: ['delete', 'remove'],
          keywords: ['spreadsheet', 'sheet'],
          toolName: 'deleteSpreadsheet',
          extractParams: () => ({ spreadsheetId: 'pending' }),
          isAsync: false
        },
        {
          patterns: ['share'],
          keywords: ['spreadsheet', 'sheet'],
          toolName: 'shareSpreadsheet',
          extractParams: () => ({ spreadsheetId: 'pending' }),
          isAsync: false
        }
      ],
      github: [
        {
          patterns: ['create', 'new'],
          keywords: ['repository', 'repo'],
          toolName: 'createRepository',
          extractParams: (q) => this.extractGitHubRepoParams(q),
          isAsync: false
        },
        {
          patterns: ['delete', 'remove'],
          keywords: ['repository', 'repo'],
          toolName: 'deleteRepository',
          extractParams: () => ({ owner: 'pending', repo: 'pending' }),
          isAsync: false
        },
        {
          patterns: ['create', 'open', 'file', 'new'],
          keywords: ['issue', 'bug', 'feature request'],
          toolName: 'createIssue',
          extractParams: (q) => this.extractGitHubIssueParams(q),
          isAsync: false
        },
        {
          patterns: ['create', 'open', 'new'],
          keywords: ['pull request', 'pr'],
          toolName: 'createPullRequest',
          extractParams: () => ({ owner: 'pending', repo: 'pending', title: 'pending' }),
          isAsync: false
        }
      ]
    };

    const agentPatterns = patterns[agentName];
    if (!agentPatterns) return null;

    for (const pattern of agentPatterns) {
      const hasAction = pattern.patterns.some(p => query.includes(p));
      const hasTarget = pattern.keywords.some(k => query.includes(k));
      
      if (hasAction && hasTarget) {
        // Handle async extractors (like forms with AI-generated questions)
        const inferredParams = pattern.isAsync 
          ? await pattern.extractParams(agentQuery)
          : pattern.extractParams(agentQuery);
          
        return {
          toolName: pattern.toolName,
          inferredParams
        };
      }
    }

    return null;
  }

  /**
   * Extract calendar event parameters from query
   * Parses natural language dates and times
   */
  extractCalendarEventParams(query) {
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();
    
    // Parse the date part
    const lowerQuery = query.toLowerCase();
    
    // Check for "tomorrow"
    if (lowerQuery.includes('tomorrow')) {
      startDate.setDate(startDate.getDate() + 1);
    }
    // Check for "today"
    else if (lowerQuery.includes('today')) {
      // Keep current date
    }
    // Check for day of week
    else if (lowerQuery.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i)) {
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayMatch = lowerQuery.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
      if (dayMatch) {
        const targetDay = days.indexOf(dayMatch[1].toLowerCase());
        const currentDay = startDate.getDay();
        let daysUntil = targetDay - currentDay;
        if (daysUntil <= 0) daysUntil += 7; // Next week if today or past
        startDate.setDate(startDate.getDate() + daysUntil);
      }
    }
    // Check for specific date like "December 5" or "Dec 5" or "5th December"
    else if (lowerQuery.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i) ||
             lowerQuery.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?\b/i)) {
      const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      let day, month;
      
      const match1 = lowerQuery.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/i);
      const match2 = lowerQuery.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?/i);
      
      if (match1) {
        day = parseInt(match1[1]);
        month = months.findIndex(m => match1[2].toLowerCase().startsWith(m));
      } else if (match2) {
        month = months.findIndex(m => match2[1].toLowerCase().startsWith(m));
        day = parseInt(match2[2]);
      }
      
      if (day && month >= 0) {
        startDate.setMonth(month);
        startDate.setDate(day);
        // If the date is in the past, assume next year
        if (startDate < now) {
          startDate.setFullYear(startDate.getFullYear() + 1);
        }
      }
    }
    
    // Parse time
    // Match patterns like "11am", "11:30am", "11 am", "at 11", "at 11:30", "11:00", "3pm", "15:00"
    const timeMatch = lowerQuery.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
    
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      const period = timeMatch[3]?.toLowerCase();
      
      // Convert to 24-hour format
      if (period === 'pm' && hours < 12) {
        hours += 12;
      } else if (period === 'am' && hours === 12) {
        hours = 0;
      } else if (!period && hours < 8) {
        // Assume PM for times like "at 3" (likely means 3pm)
        hours += 12;
      }
      
      startDate.setHours(hours, minutes, 0, 0);
    } else {
      // Default to 9 AM if no time specified
      startDate.setHours(9, 0, 0, 0);
    }
    
    // Set end time (default 1 hour after start)
    endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    
    // Check for duration
    const durationMatch = lowerQuery.match(/(?:for\s+)?(\d+(?:\.\d+)?)\s*(hour|hr|minute|min)s?/i);
    if (durationMatch) {
      const amount = parseFloat(durationMatch[1]);
      const unit = durationMatch[2].toLowerCase();
      const durationMs = unit.startsWith('hour') || unit.startsWith('hr') 
        ? amount * 60 * 60 * 1000 
        : amount * 60 * 1000;
      endDate = new Date(startDate.getTime() + durationMs);
    }
    
    // Build params
    const params = {
      summary: 'New Event',
      startDateTime: startDate.toISOString(),
      endDateTime: endDate.toISOString()
    };

    // Try to extract title from quotes or after "called" or "titled"
    // Or extract what the event is about
    const titleMatch = query.match(/["']([^"']+)["']/) || 
                       query.match(/called\s+([^,\.\n]+)/) ||
                       query.match(/titled\s+([^,\.\n]+)/) ||
                       query.match(/(?:event|meeting|meet)\s+(?:about|for|on)\s+([^,\.\n]+)/i);
    if (titleMatch) {
      params.summary = titleMatch[1].trim();
    } else {
      // Try to create a meaningful title from the query
      // "create a google meet tomorrow at 11am" -> "Google Meet"
      if (lowerQuery.includes('google meet')) {
        params.summary = 'Google Meet';
      } else if (lowerQuery.includes('meeting')) {
        params.summary = 'Meeting';
      } else if (lowerQuery.includes('call')) {
        params.summary = 'Call';
      }
    }

    // Check for Google Meet
    if (lowerQuery.includes('google meet') || 
        lowerQuery.includes('video call') ||
        lowerQuery.includes('virtual')) {
      params.addGoogleMeet = true;
    }

    // Extract attendees (emails)
    const emailMatches = query.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
    if (emailMatches) {
      params.attendees = emailMatches;
    }

    return params;
  }

  /**
   * Extract document parameters from query
   */
  extractDocParams(query) {
    const params = { title: 'Untitled Document' };
    const titleMatch = query.match(/["']([^"']+)["']/) ||
                       query.match(/called\s+([^,\.\n]+)/) ||
                       query.match(/titled\s+([^,\.\n]+)/) ||
                       query.match(/document\s+(?:about|for|on)\s+([^,\.\n]+)/i);
    if (titleMatch) {
      params.title = titleMatch[1].trim();
    }
    return params;
  }

  /**
   * Extract form parameters from query (basic extraction without questions)
   */
  extractFormParamsBasic(query) {
    const params = { title: 'Untitled Form' };
    const titleMatch = query.match(/["']([^"']+)["']/) ||
                       query.match(/called\s+([^,\.\n]+)/) ||
                       query.match(/titled\s+([^,\.\n]+)/) ||
                       query.match(/form\s+(?:about|for|on)\s+([^,\.\n]+)/i);
    if (titleMatch) {
      params.title = titleMatch[1].trim();
    }
    return params;
  }

  /**
   * Extract form parameters from query with AI-generated questions
   * This generates smart default questions based on the form title/purpose
   */
  async extractFormParams(query) {
    const basicParams = this.extractFormParamsBasic(query);
    console.log('[Forms] Starting question generation for:', basicParams.title);
    
    try {
      // Use OpenAI to generate smart questions based on the form title and query
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a form design expert. Generate appropriate questions for a Google Form based on the user's request.
            
Output a JSON object with:
- title: The form title (use the provided title or infer from context)
- description: A brief description of the form's purpose (1-2 sentences)
- questions: An array of 4-6 relevant questions

Each question should have:
- title: The question text
- type: One of "text", "paragraph", "radio", "checkbox", "dropdown", "scale", "date", "time"
- required: boolean (important questions should be required)
- options: array of strings (only for radio, checkbox, dropdown types)

Form Type Guidelines:
- FEEDBACK forms: Include satisfaction rating (scale 1-5), what they liked (paragraph), suggestions (paragraph), likelihood to recommend (radio)
- REGISTRATION/CONTACT forms: Include name (text, required), email (text, required), phone (text), organization (text), reason for contact (dropdown/radio)
- SURVEY forms: Include demographic questions, topic-specific questions with scales and multiple choice
- EVENT forms: Include name (text, required), email (text, required), attendance confirmation (radio), dietary restrictions (checkbox), additional guests (text)

Respond with ONLY valid JSON, no markdown formatting.`
          },
          {
            role: 'user',
            content: `Generate form questions for this request: "${query}"\n\nExtracted title: "${basicParams.title}"`
          }
        ],
        temperature: 0.7,
        max_tokens: 1500
      });

      const content = response.choices[0].message.content.trim();
      console.log('[Forms] AI response:', content);
      
      // Parse the JSON response, handling potential markdown code blocks
      let jsonContent = content;
      if (content.startsWith('```')) {
        jsonContent = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      }
      
      const generatedForm = JSON.parse(jsonContent);
      
      const result = {
        title: generatedForm.title || basicParams.title,
        description: generatedForm.description || '',
        questions: generatedForm.questions || []
      };
      
      console.log('[Forms] Generated form params:', JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.error('[Forms] Error generating form questions:', error);
      // Fallback to basic default questions if AI generation fails
      return {
        title: basicParams.title,
        description: '',
        questions: [
          { title: 'Name', type: 'text', required: true },
          { title: 'Email', type: 'text', required: true },
          { title: 'Your Response', type: 'paragraph', required: false }
        ]
      };
    }
  }

  /**
   * Extract meet parameters from query
   */
  extractMeetParams(query) {
    const params = {};
    const nameMatch = query.match(/["']([^"']+)["']/) ||
                      query.match(/called\s+([^,\.\n]+)/) ||
                      query.match(/meeting\s+(?:about|for|on)\s+([^,\.\n]+)/i);
    if (nameMatch) {
      params.displayName = nameMatch[1].trim();
    }
    return params;
  }

  /**
   * Extract spreadsheet parameters from query
   */
  extractSheetParams(query) {
    const params = { title: 'Untitled Spreadsheet' };
    const titleMatch = query.match(/["']([^"']+)["']/) ||
                       query.match(/called\s+([^,\.\n]+)/) ||
                       query.match(/titled\s+([^,\.\n]+)/) ||
                       query.match(/spreadsheet\s+(?:about|for|on)\s+([^,\.\n]+)/i);
    if (titleMatch) {
      params.title = titleMatch[1].trim();
    }
    return params;
  }

  /**
   * Extract GitHub repository parameters from query
   */
  extractGitHubRepoParams(query) {
    const params = { name: 'new-repository', private: false };
    const nameMatch = query.match(/["']([^"']+)["']/) ||
                      query.match(/called\s+([^,\.\n]+)/) ||
                      query.match(/named\s+([^,\.\n]+)/);
    if (nameMatch) {
      params.name = nameMatch[1].trim().replace(/\s+/g, '-');
    }
    if (query.toLowerCase().includes('private')) {
      params.private = true;
    }
    return params;
  }

  /**
   * Extract GitHub issue parameters from query
   */
  extractGitHubIssueParams(query) {
    const params = { owner: 'pending', repo: 'pending', title: 'New Issue' };
    const titleMatch = query.match(/["']([^"']+)["']/) ||
                       query.match(/called\s+([^,\.\n]+)/) ||
                       query.match(/titled\s+([^,\.\n]+)/);
    if (titleMatch) {
      params.title = titleMatch[1].trim();
    }
    return params;
  }

  /**
   * Stream response after a confirmed action is executed
   * This provides a smooth word-by-word streaming experience like ChatGPT
   */
  async streamConfirmedActionResponse(executionResult, onChunk) {
    try {
      onChunk({ type: 'status', message: 'Processing your confirmed action...' });

      const { result, query, toolName, agentName } = executionResult;

      const responsePrompt = `The user confirmed and executed the following action:

Action: ${toolName} on ${agentName}
Original Query: "${query}"

Execution Result:
${JSON.stringify(result, null, 2)}

Please provide a natural, conversational confirmation response that:
1. Confirms the action was completed successfully
2. Summarizes what was accomplished with specific details
3. Includes any relevant links or references from the result
4. Is friendly and helpful in tone
5. If there were any issues, mention them helpfully

Format the response clearly. If an event was created, include the event details like title, date, time.
If a document was created, include the title and link if available.`;

      const messages = [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: responsePrompt }
      ];

      // Use OpenAI streaming for smooth word-by-word output
      const stream = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: messages,
        temperature: 0.7,
        stream: true,
      });

      // Stop thinking indicator
      onChunk({ type: 'thinking', status: 'stop' });

      // Stream each token immediately for smooth ChatGPT-like experience
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          // Emit each token immediately - no batching
          onChunk({ type: 'content', text: content });
        }
      }

      // Send metadata
      onChunk({
        type: 'metadata',
        agentsUsed: [agentName],
        toolsUsed: [toolName],
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[MainAgent] Error streaming confirmed action response:', error);
      onChunk({
        type: 'error',
        error: 'Failed to generate response',
        message: error.message
      });
    }
  }

  /**
   * Stream the combined response using OpenAI's streaming API
   */
  async streamCombinedResponse(query, analysis, results, errors, onChunk) {
    try {
      // Build context for the LLM
      const agentResults = Object.entries(results).map(([agent, result]) => {
        return `${agent.toUpperCase()} Agent Result:\n${JSON.stringify(result, null, 2)}`;
      }).join('\n\n');

      const agentErrors = Object.entries(errors).map(([agent, error]) => {
        return `${agent.toUpperCase()} Agent Error: ${error}`;
      }).join('\n');

      const responsePrompt = `The user asked: "${query}"

Query Analysis:
${JSON.stringify(analysis, null, 2)}

Agent Results:
${agentResults}

${agentErrors ? `Errors encountered:\n${agentErrors}\n` : ''}

Please provide a natural, conversational response to the user that:
1. Directly addresses their request
2. Summarizes what was accomplished
3. Includes relevant details from the agent results
4. Mentions any errors or limitations encountered
5. Is friendly and helpful in tone

Format the response in a clear, readable way. Use bullet points or numbered lists where appropriate.
If events were created, include key details like title, date, time, and location.
Do not include raw JSON or technical details unless specifically relevant.`;

      const messages = [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: responsePrompt }
      ];

      // Use OpenAI streaming
      const stream = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: messages,
        temperature: 0.7,
        stream: true,
      });

      // Send thinking indicator off
      onChunk({ type: 'thinking', status: 'stop' });

      // Stream each token
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          onChunk({ type: 'content', text: content });
        }
      }

    } catch (error) {
      console.error('[MainAgent] Error streaming response:', error);
      throw error;
    }
  }

  /**
   * Main method to process user queries
   * This orchestrates the entire flow from analysis to final response
   */
  async processQuery(query, userId, options = {}) {
    const startTime = Date.now();
    
    try {
      console.log(`[MainAgent] Processing query for user ${userId}: "${query}"`);

      // Step 1: Analyze the query to determine which agents are needed
      const analysis = await this.analyzeQuery(query, options.conversationHistory);

      // Step 2: Execute queries on the appropriate agents
      const { results, errors } = await this.executeAgentQueries(analysis, userId);

      // Step 3: Combine responses into a coherent final response
      const finalResponse = await this.combineResponses(query, analysis, results, errors);

      const processingTime = Date.now() - startTime;

      // Return comprehensive result
      return {
        success: true,
        query: query,
        ...finalResponse,
        analysis: {
          reasoning: analysis.reasoning,
          sequential: analysis.requiresSequential || false
        },
        processingTime: `${processingTime}ms`,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('[MainAgent] Error processing query:', error);
      
      return {
        success: false,
        query: query,
        error: 'Failed to process query',
        message: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get information about available agents and their capabilities
   */
  getAgentInfo() {
    return {
      mainAgent: {
        name: 'Main Coordinator Agent',
        description: 'Central agent that coordinates all specialized agents',
        capabilities: [
          'Multi-agent coordination',
          'Query analysis and routing',
          'Response aggregation',
          'Context management'
        ]
      },
      specializedAgents: {
        calendar: {
          name: 'Calendar Agent',
          service: 'Google Calendar',
          capabilities: [
            'Create and manage events',
            'View schedules',
            'Update and delete events',
            'Handle recurring events'
          ]
        },
        docs: {
          name: 'Docs Agent',
          service: 'Google Docs',
          capabilities: [
            'Create and edit documents',
            'Format text',
            'Manage content',
            'Share documents'
          ]
        },
        forms: {
          name: 'Forms Agent',
          service: 'Google Forms',
          capabilities: [
            'Create and manage forms',
            'Add questions',
            'View responses',
            'Update form settings'
          ]
        },
        github: {
          name: 'GitHub Agent',
          service: 'GitHub',
          capabilities: [
            'View repositories and profile',
            'List commits and issues',
            'Search code',
            'View pull requests'
          ]
        },
        meet: {
          name: 'Meet Agent',
          service: 'Google Meet',
          capabilities: [
            'Create meeting spaces',
            'View meeting history',
            'Manage recordings',
            'Track participants'
          ]
        },
        sheets: {
          name: 'Sheets Agent',
          service: 'Google Sheets',
          capabilities: [
            'Create and edit spreadsheets',
            'Manage data',
            'Format cells',
            'Share spreadsheets'
          ]
        }
      }
    };
  }
}

module.exports = MainAgent;
