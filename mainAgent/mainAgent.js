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
 * - FlightsAgent: Flight search operations via SerpAPI
 * - MapsAgent: Google Maps operations (places, directions, geocoding)
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
const GmailAgent = require('../gmail/gmailAgent');
const MeetAgent = require('../meet/meetAgent');
const SheetsAgent = require('../sheets/sheetsAgent');
const FlightsAgent = require('../flights/flightsAgent');
const MapsAgent = require('../maps/mapsAgent');
const confirmationStore = require('./confirmationStore');
const confirmationUtils = require('./confirmationUtils');

// Artifact Memory imports
const { 
    extractAndStoreArtifact, 
    formatArtifactsForPrompt,
    getArtifacts,
    getLastArtifact,
    getLastArtifactByType
} = require('../utils/artifactMemory');
const { 
    buildArtifactContext, 
    generateArtifactPromptEnhancement,
    containsArtifactReference 
} = require('../middleware/artifactContext');

// Long-term Memory imports
const {
    getRelevantMemories,
    formatMemoriesForPrompt,
    MEMORY_CONFIG
} = require('../memory/memoryService');

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
      gmail: new GmailAgent(),
      meet: new MeetAgent(),
      sheets: new SheetsAgent(),
      flights: new FlightsAgent(),
      maps: new MapsAgent()
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
   * Now supports action chains - returns next action if part of a chain
   * 
   * @param {string} requestId - The pending action request ID
   * @param {string} userId - User ID for validation
   * @returns {object} - Result of the tool execution, plus nextConfirmation if part of chain
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
      const { agentName, toolName, params, query, conversationHistory, conversationId, chainId, chainIndex, totalInChain } = pendingAction;
      
      console.log(`\n[MainAgent] 🚀 Executing confirmed action: ${toolName} on ${agentName}`);
      console.log(`[MainAgent]   ConversationId: ${conversationId || 'NOT SET'}`);
      if (chainId) {
        console.log(`[MainAgent]   Chain: ${chainId} (step ${chainIndex + 1}/${totalInChain})`);
      }
      
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

      // CRITICAL: Store artifact after confirmed action execution
      let storedArtifact = null;
      if (conversationId && result.success) {
        console.log(`[MainAgent] 💾 Storing artifact for confirmed action...`);
        try {
          storedArtifact = await extractAndStoreArtifact(
            conversationId,
            agentName,
            toolName,
            result
          );
          if (storedArtifact) {
            console.log(`[MainAgent] ✅ Artifact stored: ${storedArtifact.type} - ${storedArtifact.title} (${storedArtifact.id})`);
          }
        } catch (artifactError) {
          console.error(`[MainAgent] ⚠️ Error storing artifact:`, artifactError);
        }
      } else if (!conversationId) {
        console.log(`[MainAgent] ⚠️ No conversationId - artifact NOT stored`);
      }

      // Remove the pending action after successful execution
      confirmationStore.removePendingAction(requestId);

      // Check if this is part of an action chain and get next action
      let nextConfirmation = null;
      if (chainId) {
        console.log(`[MainAgent] 🔗 Checking for next action in chain: ${chainId}`);
        
        // Build a result object to pass to the next action
        const completedResult = {
          agentName,
          toolName,
          result: result,
          artifact: storedArtifact
        };
        
        const nextChainAction = confirmationStore.getNextChainAction(chainId, userId, completedResult);
        
        if (nextChainAction && !nextChainAction.chainComplete) {
          console.log(`[MainAgent] 🔗 Next action in chain: ${nextChainAction.nextAction.toolName}`);
          
          // Enhance the next action's params with results from this action
          // For example, if form was created, email can now include the form link
          let enhancedNextAction = nextChainAction.nextAction;
          
          // If the next action is an email, try to enhance it with the form/doc link
          if (enhancedNextAction.toolName === 'sendEmail' && storedArtifact) {
            enhancedNextAction = await this.enhanceEmailWithPreviousResult(enhancedNextAction, completedResult, userId);
          }
          
          nextConfirmation = {
            requestId: enhancedNextAction.requestId,
            toolName: enhancedNextAction.toolName,
            agentName: enhancedNextAction.agentName,
            actionType: confirmationUtils.getActionType(enhancedNextAction.agentName, enhancedNextAction.toolName),
            description: confirmationUtils.getActionDescription(enhancedNextAction.agentName, enhancedNextAction.toolName),
            params: enhancedNextAction.params,
            previewContent: enhancedNextAction.previewContent,
            originalQuery: query,
            chainInfo: {
              chainId: chainId,
              currentStep: nextChainAction.currentIndex + 1,
              totalSteps: nextChainAction.totalActions,
              previousResults: nextChainAction.completedResults
            }
          };
        } else if (nextChainAction && nextChainAction.chainComplete) {
          console.log(`[MainAgent] ✅ Action chain complete: ${chainId}`);
        }
      }

      return {
        success: true,
        result: result,
        query: query,
        toolName: toolName,
        agentName: agentName,
        storedArtifact: storedArtifact,
        conversationId: conversationId,
        nextConfirmation: nextConfirmation  // Will be null if no more actions in chain
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
   * Enhance email params with results from previous actions in the chain
   * For example, include the form link in the email body
   */
  async enhanceEmailWithPreviousResult(emailAction, previousResult, userId) {
    try {
      const { artifact, result } = previousResult;
      
      console.log(`[MainAgent] 📧 Enhancing email with previous result:`, { artifact, hasResult: !!result });
      
      if (!artifact) {
        console.log(`[MainAgent] ⚠️ No artifact found in previous result`);
        return emailAction;
      }

      let linkToInclude = null;
      let itemDescription = '';

      // Extract link based on artifact type (lowercase - matching ARTIFACT_TYPES)
      const artifactType = artifact.type?.toLowerCase();
      console.log(`[MainAgent] 📧 Artifact type: ${artifactType}, ID: ${artifact.id}`);
      
      if ((artifactType === 'form') && artifact.id) {
        linkToInclude = `https://docs.google.com/forms/d/${artifact.id}/viewform`;
        itemDescription = `the form "${artifact.title}"`;
      } else if ((artifactType === 'doc' || artifactType === 'document') && artifact.id) {
        linkToInclude = `https://docs.google.com/document/d/${artifact.id}/edit`;
        itemDescription = `the document "${artifact.title}"`;
      } else if ((artifactType === 'sheet' || artifactType === 'spreadsheet') && artifact.id) {
        linkToInclude = `https://docs.google.com/spreadsheets/d/${artifact.id}/edit`;
        itemDescription = `the spreadsheet "${artifact.title}"`;
      } else if ((artifactType === 'event' || artifactType === 'calendar_event') && artifact.data) {
        // For calendar events, extract the Google Meet link or calendar link
        if (artifact.data.hangoutLink) {
          linkToInclude = artifact.data.hangoutLink;
          itemDescription = `the Google Meet "${artifact.title}"`;
          console.log(`[MainAgent] 📧 Found Google Meet link in artifact: ${linkToInclude}`);
        } else if (artifact.data.htmlLink) {
          linkToInclude = artifact.data.htmlLink;
          itemDescription = `the calendar event "${artifact.title}"`;
          console.log(`[MainAgent] 📧 Found calendar link in artifact: ${linkToInclude}`);
        }
      }

      if (linkToInclude && emailAction.params) {
        // Use AI to regenerate the email body with the actual link
        console.log(`[MainAgent] 📧 Enhancing email with link: ${linkToInclude}`);
        
        const enhancedParams = await this.regenerateEmailWithLink(
          emailAction.params,
          linkToInclude,
          itemDescription,
          userId
        );
        
        emailAction.params = enhancedParams;
        emailAction.previewContent = confirmationUtils.generatePreview(
          'gmail',
          'sendEmail',
          enhancedParams
        );
        
        console.log(`[MainAgent] ✅ Email enhanced with actual link`);
      } else {
        console.log(`[MainAgent] ⚠️ Could not enhance email - linkToInclude: ${linkToInclude}, hasParams: ${!!emailAction.params}`);
      }

      return emailAction;
    } catch (error) {
      console.error('[MainAgent] Error enhancing email:', error);
      return emailAction;
    }
  }

  /**
   * Regenerate email body to include the actual link from the previous action
   */
  async regenerateEmailWithLink(emailParams, link, itemDescription, userId) {
    try {
      const prompt = `The user wanted to send an email about ${itemDescription}.
Here was the original email draft:
To: ${emailParams.to}
Subject: ${emailParams.subject}
Body: ${emailParams.body}

The ${itemDescription} has now been created. Update the email body to include this actual link: ${link}

Return ONLY a JSON object with the updated email:
{
  "to": "${emailParams.to}",
  "subject": "updated subject if needed",
  "body": "updated body with the actual link included naturally"
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an email assistant. Return only valid JSON, no markdown or extra text.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      });

      const updatedEmail = JSON.parse(response.choices[0].message.content);
      return {
        ...emailParams,
        ...updatedEmail
      };
    } catch (error) {
      console.error('[MainAgent] Error regenerating email with link:', error);
      // If AI fails, just append the link to the original body
      return {
        ...emailParams,
        body: `${emailParams.body}\n\nLink: ${link}`
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
   * Detect if user's query is a modification request for a pending confirmation
   * and handle it by regenerating the preview with updated parameters
   * 
   * @param {string} query - User's new query
   * @param {object} pendingAction - The current pending action
   * @param {string} userId - User ID
   * @param {function} onChunk - Streaming callback
   * @returns {boolean} - True if this was a modification and was handled, false otherwise
   */
  async detectAndHandleModification(query, pendingAction, userId, onChunk) {
    const lowerQuery = query.toLowerCase();
    
    // Modification indicators
    const modificationPatterns = [
      'instead', 'actually', 'change', 'modify', 'update', 'send to', 'make it',
      'different', 'another', 'other', 'not that', 'wait', 'correction',
      'i meant', 'should be', 'send it to', 'email it to', 'share with'
    ];
    
    const hasModificationIndicator = modificationPatterns.some(pattern => 
      lowerQuery.includes(pattern)
    );
    
    if (!hasModificationIndicator) {
      return false; // Not a modification
    }
    
    console.log(`[PendingModification] 🔄 Detected modification request for ${pendingAction.agentName}.${pendingAction.toolName}`);
    
    try {
      // Extract new parameters based on the agent and tool type
      let newParams = { ...pendingAction.params };
      
      // Handle different agent types
      if (pendingAction.agentName === 'gmail' && pendingAction.toolName === 'sendEmail') {
        // Extract new email recipient if mentioned
        const emailMatch = query.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        if (emailMatch) {
          newParams.to = emailMatch[1];
          console.log(`[PendingModification] Updated email recipient to: ${newParams.to}`);
        }
        
        // Check if subject needs updating
        if (lowerQuery.includes('subject')) {
          const quotedMatch = query.match(/["']([^"']+)["']/);
          if (quotedMatch) {
            newParams.subject = quotedMatch[1];
            console.log(`[PendingModification] Updated subject to: ${newParams.subject}`);
          }
        }
        
        // If body content is mentioned, regenerate with AI
        if (lowerQuery.includes('body') || lowerQuery.includes('message') || lowerQuery.includes('content')) {
          const updatedParams = await this.extractEmailParamsWithAI(query, userId);
          newParams.body = updatedParams.body;
          if (updatedParams.subject && newParams.subject === pendingAction.params.subject) {
            newParams.subject = updatedParams.subject;
          }
          console.log(`[PendingModification] Regenerated email body with AI`);
        }
      } else if (pendingAction.agentName === 'calendar' && pendingAction.toolName === 'createEvent') {
        // Extract new calendar event parameters
        const timeMatch = lowerQuery.match(/(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm)/i);
        if (timeMatch) {
          // Update time
          console.log(`[PendingModification] Time modification detected`);
        }
        
        // Check for date changes
        if (lowerQuery.includes('tomorrow') || lowerQuery.includes('today') || /\\d{1,2}/.test(query)) {
          const updatedParams = this.extractCalendarEventParams(query);
          newParams = { ...newParams, ...updatedParams };
          console.log(`[PendingModification] Updated calendar event parameters`);
        }
      } else if (pendingAction.agentName === 'forms' && pendingAction.toolName === 'createForm') {
        // Handle form modifications
        if (lowerQuery.includes('title') || lowerQuery.includes('name')) {
          const quotedMatch = query.match(/["']([^"']+)["']/);
          if (quotedMatch) {
            newParams.title = quotedMatch[1];
            console.log(`[PendingModification] Updated form title to: ${newParams.title}`);
          }
        }
      }
      
      // Generate new preview content
      const newPreviewContent = confirmationUtils.generatePreview(
        pendingAction.agentName,
        pendingAction.toolName,
        newParams
      );
      
      // Update the pending action
      const updatedAction = confirmationStore.updatePendingAction(
        pendingAction.requestId,
        userId,
        newParams,
        newPreviewContent,
        query
      );
      
      if (!updatedAction) {
        console.error(`[PendingModification] ⚠️ Failed to update pending action`);
        return false;
      }
      
      // Send thinking stop signal
      onChunk({ type: 'thinking', status: 'stop' });
      
      // Prepare confirmation request with chain info if it exists
      const confirmationRequest = {
        type: 'confirmation_request',
        requestId: updatedAction.requestId,
        toolName: updatedAction.toolName,
        agentName: updatedAction.agentName,
        actionType: confirmationUtils.getActionType(updatedAction.agentName, updatedAction.toolName),
        description: confirmationUtils.getActionDescription(updatedAction.agentName, updatedAction.toolName),
        params: updatedAction.params,
        previewContent: updatedAction.previewContent,
        originalQuery: updatedAction.query,
        isModification: true // Flag to indicate this is a modification
      };
      
      // Include chain info if this is part of a chain
      if (updatedAction.chainId) {
        const chainInfo = confirmationStore.getChainInfo(updatedAction.requestId);
        if (chainInfo) {
          confirmationRequest.chainInfo = {
            chainId: chainInfo.chainId,
            currentStep: chainInfo.chainIndex + 1,
            totalSteps: chainInfo.totalInChain
          };
          console.log(`[PendingModification] Including chain info: Step ${chainInfo.chainIndex + 1}/${chainInfo.totalInChain}`);
        }
      }
      
      // Send the updated confirmation request
      onChunk(confirmationRequest);
      
      console.log(`[PendingModification] 📤 Sent confirmation_request:`, JSON.stringify(confirmationRequest, null, 2));
      
      // Send done signal to complete the stream
      onChunk({ type: 'done' });
      
      console.log(`[PendingModification] 📤 Sent done signal`);
      console.log(`[PendingModification] ✅ Successfully regenerated preview with updated parameters`);
      return true;
      
    } catch (error) {
      console.error(`[PendingModification] ⚠️ Error handling modification:`, error);
      return false;
    }
  }

  /**
   * Create the system prompt that defines the main agent's behavior
   */
  createSystemPrompt() {
    const currentDate = new Date();
    const dateString = currentDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const timeString = currentDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
    
    return `You are an intelligent Main Coordinator Agent that manages multiple specialized agents for different services.

**IMPORTANT - CURRENT DATE AND TIME**:
Today's date is: ${dateString}
Current time is: ${timeString}
Always use this date/time as reference for any date-related queries like "today", "tomorrow", "next week", etc.

Your responsibilities:
1. Analyze user requests to understand their intent
2. Determine which specialized agent(s) are needed to fulfill the request
3. Route queries to the appropriate agent(s)
4. Combine and structure responses from multiple agents when needed
5. Ensure responses are coherent, non-repetitive, and user-friendly
6. Provide helpful, conversational responses
7. **IMPORTANT**: Track and use artifact memory for cross-query context

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

**GmailAgent**: Gmail operations
- Send, reply, and forward emails
- Read and search emails
- Manage drafts (create, update, delete, send)
- Label management (create, apply, remove labels)
- Filter management (create email rules)
- Email actions (star, archive, trash, mark read/unread)

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

**FlightsAgent**: Flight search operations (via SerpAPI Google Flights)
- Search for flights between cities/airports
- Compare flight prices and options
- Get price insights and trends
- Support for one-way and round-trip searches
- Multi-currency support

**MapsAgent**: Google Maps operations
- Search for places (restaurants, hotels, cafes, etc.)
- Find nearby places around a location
- Get detailed place information (hours, reviews, contact)
- Calculate distance and travel time between locations
- Geocode addresses to coordinates and vice versa
- Support for multiple travel modes (driving, walking, bicycling, transit)

**FLIGHTS TOOLS INSTRUCTIONS**:
You have access to two flights-related tools:
- **getFlightsList**: Use this when the user wants to find or compare flights between cities/airports on specific dates. Returns available flights with prices, times, and airlines.
- **getFlightsPriceInsights**: Use this when the user wants price trends, cheapest days to fly, or when to book for the best deals.

When the user mentions flights, airlines, ticket prices, or asks to find/compare flights, route to the flights agent and summarize the tool result in a clear, concise human-friendly way.

Flight-related keywords to recognize: "flight", "flights", "airline", "ticket price", "book a flight", "find me a flight", "Mumbai to Delhi flight", "cheap flights", "compare flights", "airfare", "plane ticket"

Guidelines:
- If a request involves multiple services, coordinate the agents appropriately
- Be conversational and friendly in your responses
- If a request is ambiguous, ask clarifying questions
- Always provide context about what actions were taken
- Handle errors gracefully and provide helpful error messages
- Combine related information to avoid redundancy
- Maintain conversation context across multiple queries

**ARTIFACT MEMORY SYSTEM**:
You have access to conversation artifact memory. This allows you to remember and operate on previously created items.

When user refers to:
- "it", "that", "this", "the previous one" → Use the most recently created artifact
- "the form", "the document", "the sheet" → Use the most recent artifact of that type
- "update it", "modify that", "add to it" → Identify the target artifact from memory
- "that flight", "the IndiGo flight", "book flight X" → Use the flight search artifact with stored flight details

**FLIGHT ARTIFACT MEMORY**:
When a user searches for flights, the search results are stored as an artifact. If they later say:
- "I want to book IndiGo Flight 6E 6798" → Look up the flight from the stored search results
- "book the first flight" → Use the first flight from the stored search results
- "I'll take the cheapest one" → Find the cheapest flight from stored results
You have ALL the flight details (airline, flight number, price, times, route, date) from the previous search. DO NOT ask for these details again. Use the stored artifact data.

When you create or modify something:
- Note the artifact ID (formId, documentId, spreadsheetId, eventId, searchId, etc.) in your response
- Use the existing artifact ID for follow-up modifications
- Always confirm successful operations with the artifact details

Remember: Artifacts are preserved within a conversation thread. Use this context to provide seamless multi-step interactions.`;
  }

  /**
   * Create dynamic system prompt with artifact context
   * @param {string} conversationId - Conversation ID for artifact lookup
   */
  async createDynamicSystemPrompt(conversationId) {
    let basePrompt = this.createSystemPrompt();
    
    if (conversationId) {
      const artifactEnhancement = await generateArtifactPromptEnhancement(conversationId);
      if (artifactEnhancement) {
        basePrompt += '\n\n' + artifactEnhancement;
      }
    }
    
    return basePrompt;
  }

  /**
   * Analyze the query and determine which agents are needed
   * Uses OpenAI to intelligently route the request
   * Now includes artifact context and long-term memory for better query understanding
   */
  async analyzeQuery(query, conversationHistory = [], artifactContext = null, memoryContext = '') {
    try {
      // Pre-check: Detect common conversational queries BEFORE calling LLM
      const lowerQuery = query.toLowerCase().trim();
      const conversationalPatterns = [
        /^what\s+(is|was)\s+my\s+name/i,
        /^who\s+am\s+i/i,
        /^what\s+did\s+(i|we)\s+(say|tell|discuss|talk)/i,
        /^what\s+(flights|forms|documents|emails|meetings)\s+did\s+i/i,
        /^remind\s+me/i,
        /^what\s+was\s+that/i,
        /^tell\s+me\s+about\s+(our|the)\s+conversation/i
      ];

      // Check if query matches any conversational pattern
      const isConversational = conversationalPatterns.some(pattern => pattern.test(query));
      
      if (isConversational) {
        console.log('[MainAgent] 🎯 Detected conversational query - skipping agents:', query);
        return {
          agents: [],
          reasoning: "User is asking about past conversation or information - no agents needed"
        };
      }

      // Build artifact context section for the prompt
      let artifactSection = '';
      if (artifactContext && artifactContext.allArtifacts && artifactContext.allArtifacts.length > 0) {
        artifactSection = `\n\nCONVERSATION ARTIFACTS (Previously created items in this conversation):
${artifactContext.allArtifacts.map(a => `- [${a.type.toUpperCase()}] "${a.title}" (ID: ${a.id})`).join('\n')}

IMPORTANT: If the user refers to "it", "the form", "that document", etc., they are referring to one of the artifacts above. 
Include the specific artifact ID in the query you generate for the agent.`;
      }

      // Build long-term memory section for the prompt
      let memorySection = '';
      if (memoryContext && memoryContext.length > 0) {
        memorySection = `\n\nLONG-TERM USER MEMORIES (Relevant past interactions with this user):
${memoryContext}

IMPORTANT: Consider these memories when analyzing the query. They may provide context about:
- User preferences and habits
- Ongoing tasks they may be following up on
- Past interactions with specific services
Use this context to better understand the user's intent and route accordingly.`;
      }

      // Build conversation history section for context
      let conversationSection = '';
      if (conversationHistory && conversationHistory.length > 0) {
        // Get last few messages for context (max 6 messages)
        const recentHistory = conversationHistory.slice(-6);
        const historyText = recentHistory.map(msg => 
          `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content.substring(0, 500)}`
        ).join('\n');
        
        conversationSection = `\n\nRECENT CONVERSATION HISTORY:
${historyText}

IMPORTANT: Consider the conversation context above when analyzing the current query. 
- If the user provides a date/time after asking about flights, they are providing the date FOR THE FLIGHTS, not for a calendar event.
- If the user says just a date like "14 dec" or "tomorrow" after asking about flights, route to flights agent with the full context.
- Short follow-up messages like dates, times, or confirmations should be interpreted in the context of the previous messages.`;
      }

      const analysisPrompt = `STEP 1: First, answer this question:
Is the user asking about PAST information (what they already told you, what happened before, what they searched/created)?

User Query: "${query}"
${conversationSection}

If YES → You MUST return: {"agents": [], "reasoning": "User is asking about past conversation/information"}
If NO → Continue to STEP 2

Common PAST queries (return empty agents):
- "what is my name" / "who am I" 
- "what did I tell you" / "what did we discuss"
- "what flights did I search" / "what forms did I create"
- "remind me" / "tell me about"
- Questions using "was", "were", "did" about past actions

STEP 2: Only if query is NOT about past, determine which agents are needed.
${artifactSection}
${memorySection}

Available agents:
- calendar: Google Calendar operations (events, meetings, schedules). IMPORTANT: Calendar agent can create events WITH Google Meet video conferencing attached. Use ONLY calendar for "create a google meet at [time]" or "schedule a meeting with video call".
- docs: Google Docs operations (create/edit documents, text formatting)
- forms: Google Forms operations (create forms, manage questions, view responses)
- github: GitHub operations (repos, commits, issues, PRs, profile)
- gmail: Gmail operations (send/read/search emails, drafts, labels, filters)
- meet: Google Meet operations (ONLY for standalone meeting spaces without calendar events, viewing meeting history, recordings, participants). Do NOT use meet agent if user wants a scheduled meeting with a time - use calendar instead.
- sheets: Google Sheets operations (create/edit spreadsheets, data management)
- flights: Flight search operations (search flights, compare prices, price insights, airlines, tickets)
- maps: Google Maps operations (search places, directions, distance, geocoding, nearby search)

CRITICAL RULES for Google Meet:
1. "Create a google meet tomorrow at 11am" -> Use ONLY calendar agent with query "create a google meet event tomorrow at 11am with video call"
2. "Schedule a meeting with video call" -> Use ONLY calendar agent
3. "Create a standalone meeting room/space" (no time specified) -> Use meet agent
4. "Show my meeting recordings" -> Use meet agent
5. When user wants a SCHEDULED meeting with a specific time, ALWAYS use calendar agent which will automatically add Google Meet conferencing

CRITICAL RULES:
1. If query asks about PAST (what/who/when/where user already told you) → {"agents": []}
2. Only use agents for NEW actions: CREATE, SEARCH, SEND, SCHEDULE, FIND

Examples showing when to return EMPTY agents array:
- "what is my name" → {"agents": [], "reasoning": "Asking about past information from conversation"}
- "who am I" → {"agents": []}
- "what flights did I search" → {"agents": []}
- "what forms did I create" → {"agents": []}

Examples showing when to use agents:
- "find flights to Mumbai tomorrow" → {"agents": ["flights"], ...}
- "create a form" → {"agents": ["forms"], ...}

Respond with a JSON object containing:
{
  "agents": ["agent1", "agent2"],  // Array of agent names needed (can be one or multiple)
  "reasoning": "Why these agents were chosen",
  "queries": {  // Specific queries to send to each agent - MUST include artifact IDs if referencing existing items
    "agent1": "query for agent1",
    "agent2": "query for agent2"
  },
  "requiresSequential": true,  // true if one action depends on another (e.g., create form THEN send email about it)
  "dependencies": {}  // Optional: if sequential, specify dependencies like {"agent2": "agent1"}
}

Examples:
- "what is my name" -> {"agents": [], "reasoning": "User is asking about information from conversation history, no agents needed"}
- "who am I" -> {"agents": [], "reasoning": "Conversational query about past information"}
- "what did we talk about" -> {"agents": [], "reasoning": "Asking about conversation history"}
- "what flights did I search for" -> {"agents": [], "reasoning": "Asking about past search, answer from conversation history"}
- "remind me what forms I created" -> {"agents": [], "reasoning": "Query about artifact memory, no new action needed"}
- "create a google meet tomorrow at 3pm" -> {"agents": ["calendar"], "queries": {"calendar": "create a google meet event tomorrow at 3pm with video call"}}
- "schedule a video call for monday at 10am" -> {"agents": ["calendar"], "queries": {"calendar": "schedule a video call meeting for monday at 10am with google meet"}}
- "create a meeting room" (no time) -> {"agents": ["meet"], ...}
- "schedule a meeting tomorrow" -> {"agents": ["calendar"], ...}
- "create a document and add it to my calendar" -> {"agents": ["docs", "calendar"], "requiresSequential": true, ...}
- "show me my GitHub repos" -> {"agents": ["github"], ...}
- "send an email to john@example.com" -> {"agents": ["gmail"], ...}
- "check my unread emails" -> {"agents": ["gmail"], ...}
- "create a form about customer feedback and a spreadsheet to track responses" -> {"agents": ["forms", "sheets"], ...}
- "send an email about the meeting I scheduled" -> {"agents": ["gmail", "calendar"], "requiresSequential": true, ...}
- "add a question to it" (with artifact FORM "Survey" formId=abc123) -> {"agents": ["forms"], "queries": {"forms": "add a question to form with formId abc123"}}
- "find flights from Mumbai to Delhi tomorrow" -> {"agents": ["flights"], ...}
- "compare flight prices from BOM to BLR" -> {"agents": ["flights"], ...}
- "what are the cheapest flights to Goa next week" -> {"agents": ["flights"], ...}
- "find cafes near me" -> {"agents": ["maps"], ...}
- "best hotels in Paris" -> {"agents": ["maps"], ...}
- "how far is it from Mumbai to Pune" -> {"agents": ["maps"], ...}
- "restaurants near Times Square" -> {"agents": ["maps"], ...}
- "what are the coordinates of Taj Mahal" -> {"agents": ["maps"], ...}

CRITICAL - Multi-Agent Sequential Examples (when one action depends on another):
- "create a feedback form and send the link to john@example.com" -> {"agents": ["forms", "gmail"], "requiresSequential": true, "queries": {"forms": "create a feedback form", "gmail": "send email to john@example.com with the form link"}}
- "create a student survey and email it to bhumika@gmail.com" -> {"agents": ["forms", "gmail"], "requiresSequential": true, ...}
- "make a registration form and share it with the team via email" -> {"agents": ["forms", "gmail"], "requiresSequential": true, ...}
- "create a document and send it to my manager" -> {"agents": ["docs", "gmail"], "requiresSequential": true, ...}

CRITICAL - Conversation Context Examples:
- User previously asked "show me flights from pune to indore", then says "14 dec" or "tomorrow" -> {"agents": ["flights"], "queries": {"flights": "show me flights from Pune to Indore on 14 December"}} (NOT calendar!)
- User previously asked about flights, then says "the 15th" -> Route to flights with the date context
- User previously asked about calendar, then says "tomorrow" -> Route to calendar
- Short follow-up messages should ALWAYS be interpreted based on the previous conversation topic

Important:
- Only include agents that are actually needed
- Break down complex multi-step requests appropriately
- Be specific in the queries for each agent
- Set requiresSequential to true when one action depends on another (create something, then share/email it)
- Consider if operations need to be sequential (e.g., create then send) or can be parallel
- ALWAYS consider conversation history for context - a date mentioned after flight queries is for flights, NOT calendar`;

      const messages = [
        { role: 'system', content: 'You are an expert at analyzing user requests and routing them to appropriate specialized agents. Always respond with valid JSON only, no other text.\n\nCRITICAL RULE: If the user is asking about PAST conversation or information already discussed, return {"agents": [], "reasoning": "..."}. ONLY route to agents for NEW actions like creating, searching, or performing operations. Questions about "what is my name", "what did we discuss", "what flights did I search" should have EMPTY agents array.' },
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
   * Now includes artifact storage after successful operations
   */
  async executeAgentQueries(analysis, userId, conversationId = null, userLocation = null) {
    const results = {};
    const errors = {};
    const storedArtifacts = [];

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

            // Pass userLocation if this is the maps agent
            const agentOptions = agentName === 'maps' && userLocation 
              ? { userLocation } 
              : {};

            const result = await agent.processQuery(agentQuery, userId, agentOptions);
            results[agentName] = result;

            // Store artifacts from successful tool executions
            if (conversationId && result.success && result.tools_used) {
              for (const tool of result.tools_used) {
                try {
                  const rawResult = result.raw_results?.find(r => r.success !== false) || result;
                  const artifact = await extractAndStoreArtifact(
                    conversationId, 
                    agentName, 
                    tool.name || tool, 
                    rawResult
                  );
                  if (artifact) {
                    storedArtifacts.push(artifact);
                  }
                } catch (artifactError) {
                  console.error(`[MainAgent] Error storing artifact:`, artifactError);
                }
              }
            }

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

            // Pass userLocation if this is the maps agent
            const agentOptions = agentName === 'maps' && userLocation 
              ? { userLocation } 
              : {};

            const result = await agent.processQuery(agentQuery, userId, agentOptions);
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
        for (const { agentName, result, error } of agentResults) {
          if (error) {
            errors[agentName] = error;
          } else {
            results[agentName] = result;

            // Store artifacts from successful tool executions
            if (conversationId && result.success && result.tools_used) {
              for (const tool of result.tools_used) {
                try {
                  const rawResult = result.raw_results?.find(r => r.success !== false) || result;
                  const artifact = await extractAndStoreArtifact(
                    conversationId, 
                    agentName, 
                    tool.name || tool, 
                    rawResult
                  );
                  if (artifact) {
                    storedArtifacts.push(artifact);
                  }
                } catch (artifactError) {
                  console.error(`[MainAgent] Error storing artifact:`, artifactError);
                }
              }
            }
          }
        }
      }

      return { results, errors, storedArtifacts };

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
   * Now includes confirmation flow for sensitive operations, artifact memory, and long-term memory
   */
  async processQueryWithStreaming(query, userId, options = {}, onChunk) {
    const startTime = Date.now();
    const conversationId = options.conversationId;
    
    try {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`[MainAgent] Processing streaming query for user ${userId}`);
      console.log(`[MainAgent] Query: "${query}"`);
      console.log(`[MainAgent] Conversation ID: ${conversationId || 'NOT PROVIDED'}`);
      console.log(`${'='.repeat(60)}`);

      // ========== CHECK FOR PENDING CONFIRMATION MODIFICATION ==========
      // Before processing the query normally, check if user is trying to modify a pending confirmation
      const pendingAction = confirmationStore.getUserMostRecentPendingAction(userId);
      if (pendingAction) {
        console.log(`\n[PendingModification] 🔍 Found pending action: ${pendingAction.toolName} (${pendingAction.agentName})`);
        const modificationResult = await this.detectAndHandleModification(query, pendingAction, userId, onChunk);
        
        if (modificationResult) {
          // User is modifying the pending action - we've handled it
          console.log(`[PendingModification] ✅ Modification detected and handled`);
          return;
        } else {
          console.log(`[PendingModification] ℹ️ Query is not a modification - proceeding normally`);
        }
      }

      // Send initial status
      onChunk({ type: 'status', message: 'Analyzing your request...' });

      // ========== LONG-TERM MEMORY RETRIEVAL ==========
      // Retrieve relevant memories before processing to provide context
      let relevantMemories = [];
      let memoryContext = '';
      
      try {
        console.log(`\n[LongTermMemory] 🧠 Retrieving relevant memories for user ${userId}...`);
        relevantMemories = await getRelevantMemories({
          userId,
          query,
          limit: MEMORY_CONFIG.TOP_K,
          threshold: MEMORY_CONFIG.SIMILARITY_THRESHOLD
        });
        
        if (relevantMemories.length > 0) {
          memoryContext = formatMemoriesForPrompt(relevantMemories);
          console.log(`[LongTermMemory] ✅ Found ${relevantMemories.length} relevant memories`);
          relevantMemories.forEach((m, i) => {
            console.log(`[LongTermMemory]   ${i + 1}. [${m.memoryType}] similarity=${m.similarity.toFixed(3)}`);
          });
        } else {
          console.log(`[LongTermMemory] ℹ️ No relevant memories found`);
        }
      } catch (memoryError) {
        console.error(`[LongTermMemory] ⚠️ Error retrieving memories:`, memoryError.message);
        // Continue without memories - don't block the main flow
      }

      // Build artifact context if conversationId is provided
      let artifactContext = null;
      let enhancedQuery = query;
      
      if (conversationId) {
        console.log(`\n[ArtifactMemory] 🔍 Building artifact context for conversation: ${conversationId}`);
        artifactContext = await buildArtifactContext(conversationId, query);
        
        console.log(`[ArtifactMemory] 📦 All artifacts in conversation: ${artifactContext.allArtifacts.length}`);
        if (artifactContext.allArtifacts.length > 0) {
          artifactContext.allArtifacts.forEach((a, i) => {
            console.log(`[ArtifactMemory]   ${i + 1}. [${a.type}] ${a.title} (ID: ${a.id})`);
          });
        }
        
        console.log(`[ArtifactMemory] 🎯 Has artifact reference: ${artifactContext.hasArtifactReference}`);
        if (artifactContext.hasArtifactReference) {
          enhancedQuery = artifactContext.enhancedQuery;
          console.log(`[ArtifactMemory] ✅ Resolved artifact: ${artifactContext.resolvedArtifact?.title}`);
          console.log(`[ArtifactMemory] ✅ Artifact ID: ${artifactContext.resolvedArtifact?.id}`);
          console.log(`[ArtifactMemory] ✅ Artifact Type: ${artifactContext.resolvedArtifact?.type}`);
          console.log(`[ArtifactMemory] 📝 Enhanced query: ${enhancedQuery}`);
        } else {
          console.log(`[ArtifactMemory] ⚠️ No artifact reference detected in query`);
        }
      } else {
        console.log(`\n[ArtifactMemory] ⚠️ No conversationId provided - artifact memory disabled`);
      }

      // Step 1: Analyze the query to determine which agents are needed
      // Pass artifact context and memory context to analysis for better routing
      const analysis = await this.analyzeQuery(enhancedQuery, options.conversationHistory, artifactContext, memoryContext);
      
      console.log(`\n[MainAgent] 🤖 Query Analysis Result:`);
      console.log(`[MainAgent]   Agents: ${analysis.agents.join(', ')}`);
      console.log(`[MainAgent]   Reasoning: ${analysis.reasoning}`);
      console.log(`[MainAgent]   Queries:`, JSON.stringify(analysis.queries, null, 2));
      
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
      const { results, errors, confirmationRequest, storedArtifacts } = await this.executeAgentQueriesWithConfirmation(
        analysis, 
        userId, 
        enhancedQuery, 
        options.conversationHistory || [],
        conversationId,
        options.userLocation  // Pass userLocation for Maps agent
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
      // Pass memory context and conversation history for inclusion in the response generation
      await this.streamCombinedResponse(
        enhancedQuery, 
        analysis, 
        results, 
        errors, 
        onChunk, 
        conversationId, 
        memoryContext,
        options.conversationHistory || []
      );

      const processingTime = Date.now() - startTime;

      // Send metadata including any stored artifacts and memory usage
      const metadata = {
        type: 'metadata',
        agentsUsed: analysis.agents,
        processingTime: `${processingTime}ms`,
        timestamp: new Date().toISOString()
      };
      
      if (storedArtifacts && storedArtifacts.length > 0) {
        metadata.storedArtifacts = storedArtifacts.map(a => ({
          id: a.id,
          type: a.type,
          title: a.title
        }));
      }
      
      if (relevantMemories.length > 0) {
        metadata.memoriesUsed = relevantMemories.length;
      }
      
      onChunk(metadata);

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
   * Now supports multiple confirmation actions (action chains) for multi-agent queries
   * Now includes artifact storage via conversationId
   */
  async executeAgentQueriesWithConfirmation(analysis, userId, query, conversationHistory, conversationId = null, userLocation = null) {
    // Collect ALL confirmation-required actions from all agents
    const confirmationRequiredActions = [];
    const nonConfirmationAgents = [];
    
    for (const agentName of analysis.agents) {
      const agentQuery = analysis.queries[agentName];
      console.log(`[Confirmation] Checking agent: ${agentName}, query: ${agentQuery}`);
      const detectedAction = await this.detectConfirmationRequiredAction(agentName, agentQuery, userId);
      
      if (detectedAction) {
        console.log(`[Confirmation] Detected action for ${agentName}:`, JSON.stringify(detectedAction, null, 2));
        
        // Generate a preview for this action
        const previewContent = confirmationUtils.generatePreview(
          agentName, 
          detectedAction.toolName, 
          detectedAction.inferredParams
        );
        
        confirmationRequiredActions.push({
          agentName,
          agentQuery,
          toolName: detectedAction.toolName,
          params: detectedAction.inferredParams,
          previewContent
        });
      } else {
        // This agent doesn't require confirmation, can be executed directly
        nonConfirmationAgents.push(agentName);
      }
    }

    // If we have multiple confirmation-required actions, create an action chain
    if (confirmationRequiredActions.length > 1) {
      console.log(`[Confirmation] Creating action chain with ${confirmationRequiredActions.length} actions`);
      
      const chainResult = confirmationStore.storeActionChain(
        userId,
        confirmationRequiredActions,
        query,
        conversationHistory,
        conversationId
      );

      if (chainResult) {
        const firstAction = confirmationRequiredActions[0];
        return {
          results: {},
          errors: {},
          storedArtifacts: [],
          confirmationRequest: {
            requestId: chainResult.firstRequestId,
            toolName: firstAction.toolName,
            agentName: firstAction.agentName,
            actionType: confirmationUtils.getActionType(firstAction.agentName, firstAction.toolName),
            description: confirmationUtils.getActionDescription(firstAction.agentName, firstAction.toolName),
            params: firstAction.params,
            previewContent: firstAction.previewContent,
            originalQuery: query,
            // Chain info to show user there are more actions
            chainInfo: {
              chainId: chainResult.chainId,
              currentStep: 1,
              totalSteps: chainResult.totalActions
            }
          }
        };
      }
    }
    
    // If we have exactly one confirmation-required action
    if (confirmationRequiredActions.length === 1) {
      const action = confirmationRequiredActions[0];
      console.log(`[Confirmation] Single action requires confirmation:`, action.toolName);
      
      const requestId = confirmationStore.storePendingAction(
        userId,
        action.toolName,
        action.agentName,
        action.params,
        action.previewContent,
        query,
        conversationHistory,
        conversationId
      );

      return {
        results: {},
        errors: {},
        storedArtifacts: [],
        confirmationRequest: {
          requestId: requestId,
          toolName: action.toolName,
          agentName: action.agentName,
          actionType: confirmationUtils.getActionType(action.agentName, action.toolName),
          description: confirmationUtils.getActionDescription(action.agentName, action.toolName),
          params: action.params,
          previewContent: action.previewContent,
          originalQuery: query
        }
      };
    }

    // No confirmation required, proceed with normal execution
    // Pass conversationId for artifact storage and userLocation for Maps agent
    const { results, errors, storedArtifacts } = await this.executeAgentQueries(analysis, userId, conversationId, userLocation);
    return { results, errors, storedArtifacts, confirmationRequest: null };
  }

  /**
   * Detect if a query to an agent will trigger a confirmation-required action
   * Returns the detected tool and inferred parameters if confirmation is needed
   */
  /**
   * Detect if the query requires confirmation before execution
   * Returns async because some extractors (like forms, gmail) need AI generation
   */
  async detectConfirmationRequiredAction(agentName, agentQuery, userId = null) {
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
      ],
      gmail: [
        {
          // Only match when user explicitly wants to SEND an email
          // Exclude read/search/get/show/check/find/what patterns
          patterns: ['send', 'compose', 'write to', 'email to', 'mail to'],
          keywords: ['email', 'mail', 'message'],
          toolName: 'sendEmail',
          extractParams: (q, userId) => this.extractEmailParamsWithAI(q, userId),
          isAsync: true,  // Changed to async for AI generation
          excludePatterns: ['read', 'show', 'get', 'find', 'search', 'check', 'what', 'list', 'unread', 'recent', 'latest', 'inbox']
        },
        {
          patterns: ['reply', 'respond'],
          keywords: ['email', 'mail', 'message'],
          toolName: 'replyToEmail',
          extractParams: () => ({ messageId: 'pending', body: 'pending' }),
          isAsync: false
        },
        {
          patterns: ['forward'],
          keywords: ['email', 'mail', 'message'],
          toolName: 'forwardEmail',
          extractParams: () => ({ messageId: 'pending', to: 'pending' }),
          isAsync: false
        },
        {
          patterns: ['delete', 'trash', 'remove'],
          keywords: ['email', 'mail', 'message'],
          toolName: 'trashEmail',
          extractParams: () => ({ messageId: 'pending' }),
          isAsync: false
        },
        {
          patterns: ['create', 'make', 'new', 'set up'],
          keywords: ['filter', 'rule'],
          toolName: 'createFilter',
          extractParams: () => ({ criteria: 'pending', action: 'pending' }),
          isAsync: false
        }
      ]
    };

    const agentPatterns = patterns[agentName];
    if (!agentPatterns) return null;

    for (const pattern of agentPatterns) {
      const hasAction = pattern.patterns.some(p => query.includes(p));
      const hasTarget = pattern.keywords.some(k => query.includes(k));
      
      // Check for exclusion patterns - if any exclusion pattern is found, skip this pattern
      const hasExclusion = pattern.excludePatterns 
        ? pattern.excludePatterns.some(p => query.includes(p))
        : false;
      
      if (hasAction && hasTarget && !hasExclusion) {
        // Handle async extractors (like forms with AI-generated questions, gmail with AI content)
        // Pass userId for extractors that need it (like gmail for user signature)
        const inferredParams = pattern.isAsync 
          ? await pattern.extractParams(agentQuery, userId)
          : pattern.extractParams(agentQuery, userId);
          
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
    // Be careful not to match dates - prioritize patterns with am/pm or "at" keyword
    // First try to match time with am/pm suffix (most reliable)
    let timeMatch = lowerQuery.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
    
    // If no am/pm found, look for "at X" or "at X:XX" pattern
    if (!timeMatch) {
      timeMatch = lowerQuery.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\b/i);
    }
    
    // Also try matching time formats like "15:00" (24-hour format)
    if (!timeMatch) {
      timeMatch = lowerQuery.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    }
    
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      const period = timeMatch[3]?.toLowerCase();
      
      // Convert to 24-hour format
      if (period === 'pm' && hours < 12) {
        hours += 12;
      } else if (period === 'am' && hours === 12) {
        hours = 0;
      } else if (!period && hours <= 12 && hours >= 1) {
        // For "at X" without am/pm, assume PM for typical meeting times (1-7)
        // and AM for early hours (8-12)
        if (hours >= 1 && hours <= 7) {
          hours += 12; // Assume PM for "at 3" means 3pm
        }
        // hours 8-12 without am/pm could be either, default to keeping as-is (AM)
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
      summary: 'Google Meet', // Default title for meetings
      startDateTime: startDate.toISOString(),
      endDateTime: endDate.toISOString()
    };

    // Check for Google Meet / video call first to set addGoogleMeet flag
    const isGoogleMeet = lowerQuery.includes('google meet') || 
                         lowerQuery.includes('video call') ||
                         lowerQuery.includes('virtual meeting') ||
                         lowerQuery.includes('video meeting');
    
    if (isGoogleMeet) {
      params.addGoogleMeet = true;
    }

    // Try to extract explicit title from quotes or after "called" or "titled" or "about/for"
    // Be very careful not to match date/time patterns
    const titleMatch = query.match(/["']([^"']+)["']/) || 
                       query.match(/called\s+["']?([^"',\.\n]+)["']?/i) ||
                       query.match(/titled\s+["']?([^"',\.\n]+)["']?/i) ||
                       query.match(/named\s+["']?([^"',\.\n]+)["']?/i) ||
                       query.match(/(?:meeting|event)\s+(?:about|for|regarding)\s+["']?([^"',\.\n]+)["']?/i);
    
    if (titleMatch) {
      const extractedTitle = titleMatch[1].trim();
      // Only use extracted title if it's meaningful (not just date/time info)
      // Also exclude patterns that look like "on <date>" or contain date-related words
      const isJustDateTime = /^(\d|at|on|tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|video call|with video|\s|st|nd|rd|th|am|pm|:|-|,|\.)+$/i.test(extractedTitle);
      if (!isJustDateTime && extractedTitle.length > 2) {
        params.summary = extractedTitle;
      }
    }
    
    // If no explicit title was found, use smart defaults
    if (params.summary === 'Google Meet' && !isGoogleMeet) {
      if (lowerQuery.includes('meeting')) {
        params.summary = 'Meeting';
      } else if (lowerQuery.includes('call')) {
        params.summary = 'Call';
      } else if (lowerQuery.includes('event')) {
        params.summary = 'Event';
      } else if (lowerQuery.includes('appointment')) {
        params.summary = 'Appointment';
      } else {
        params.summary = 'Meeting'; // Generic fallback
      }
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
   * Extract email parameters from query
   */
  extractEmailParams(query) {
    const params = { to: '', subject: '', body: '' };
    const lowerQuery = query.toLowerCase();
    
    // Extract email address
    const emailMatch = query.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
      params.to = emailMatch[1];
    }
    
    // Parse date/time for better subject formatting
    const now = new Date();
    let dateStr = '';
    let timeStr = '';
    let eventDate = null;
    
    // Check for tomorrow/today
    if (lowerQuery.includes('tomorrow')) {
      eventDate = new Date(now);
      eventDate.setDate(eventDate.getDate() + 1);
      dateStr = eventDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    } else if (lowerQuery.includes('today')) {
      eventDate = new Date(now);
      dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    } else {
      // Check for specific date like "6 December 2025" or "December 6, 2025" or "6th December"
      const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
      const dateMatch1 = lowerQuery.match(/(\d{1,2})(?:st|nd|rd|th)?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(\d{4})?/i);
      const dateMatch2 = lowerQuery.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})?/i);
      
      if (dateMatch1) {
        const day = parseInt(dateMatch1[1]);
        const monthStr = dateMatch1[2].toLowerCase();
        const month = months.findIndex(m => m.startsWith(monthStr));
        const year = dateMatch1[3] ? parseInt(dateMatch1[3]) : now.getFullYear();
        if (month >= 0) {
          eventDate = new Date(year, month, day);
          dateStr = eventDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        }
      } else if (dateMatch2) {
        const monthStr = dateMatch2[1].toLowerCase();
        const month = months.findIndex(m => m.startsWith(monthStr));
        const day = parseInt(dateMatch2[2]);
        const year = dateMatch2[3] ? parseInt(dateMatch2[3]) : now.getFullYear();
        if (month >= 0) {
          eventDate = new Date(year, month, day);
          dateStr = eventDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        }
      }
    }
    
    // Extract time
    const timeMatch = lowerQuery.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = timeMatch[2] ? timeMatch[2] : '00';
      const period = timeMatch[3].toUpperCase();
      timeStr = `${hours}:${minutes} ${period}`;
    }
    
    // Determine the event type and purpose
    let eventType = '';
    let purpose = '';
    
    // Check for specific event types first
    if (lowerQuery.includes('birthday party') || lowerQuery.includes('birthday')) {
      eventType = 'birthday party';
      purpose = 'Birthday Party Invitation';
    } else if (lowerQuery.includes('wedding')) {
      eventType = 'wedding';
      purpose = 'Wedding Invitation';
    } else if (lowerQuery.includes('party') || lowerQuery.includes('celebration')) {
      eventType = 'party';
      purpose = 'Party Invitation';
    } else if (lowerQuery.includes('dinner') || lowerQuery.includes('lunch') || lowerQuery.includes('breakfast')) {
      eventType = lowerQuery.includes('dinner') ? 'dinner' : lowerQuery.includes('lunch') ? 'lunch' : 'breakfast';
      purpose = `${eventType.charAt(0).toUpperCase() + eventType.slice(1)} Invitation`;
    } else if (lowerQuery.includes('project review')) {
      purpose = 'Project Review Meeting';
    } else if (lowerQuery.includes('meeting')) {
      purpose = 'Meeting Request';
    } else if (lowerQuery.includes('follow up') || lowerQuery.includes('follow-up')) {
      purpose = 'Follow Up';
    } else if (lowerQuery.includes('update')) {
      purpose = 'Update';
    } else if (lowerQuery.includes('reminder')) {
      purpose = 'Reminder';
    } else if (lowerQuery.includes('introduction') || lowerQuery.includes('introduce')) {
      purpose = 'Introduction';
    } else if (lowerQuery.includes('inquiry') || lowerQuery.includes('question')) {
      purpose = 'Inquiry';
    } else if (lowerQuery.includes('invitation') || lowerQuery.includes('invite') || lowerQuery.includes('inviting')) {
      purpose = 'Invitation';
    } else if (lowerQuery.includes('thank')) {
      purpose = 'Thank You';
    } else if (lowerQuery.includes('feedback')) {
      purpose = 'Feedback Request';
    } else if (lowerQuery.includes('schedule') || lowerQuery.includes('scheduling')) {
      purpose = 'Schedule Request';
    } else if (lowerQuery.includes('congratulat')) {
      purpose = 'Congratulations';
    } else if (lowerQuery.includes('welcome')) {
      purpose = 'Welcome';
    }
    
    // Build a proper subject line
    if (purpose) {
      if (dateStr) {
        params.subject = `${purpose} - ${dateStr}${timeStr ? ` at ${timeStr}` : ''}`;
      } else if (timeStr) {
        params.subject = `${purpose} at ${timeStr}`;
      } else {
        params.subject = purpose;
      }
    } else {
      // Fallback: extract from quotes or use generic
      const quotedMatch = query.match(/["']([^"']+)["']/);
      if (quotedMatch) {
        params.subject = quotedMatch[1].trim();
      } else {
        params.subject = 'New Message';
      }
    }
    
    // Generate contextual email body
    let bodyLines = [];
    bodyLines.push('Hi,');
    bodyLines.push('');
    bodyLines.push('I hope this email finds you well.');
    bodyLines.push('');
    
    // Generate body based on event type or purpose
    if (eventType === 'birthday party') {
      bodyLines.push(`I am excited to invite you to my birthday party${dateStr ? ` on ${dateStr}` : ''}${timeStr ? ` at ${timeStr}` : ''}!`);
      bodyLines.push('');
      bodyLines.push('It would mean a lot to me if you could join us for this special celebration. We will have food, music, and lots of fun!');
      bodyLines.push('');
      bodyLines.push('Please let me know if you can make it. I really hope to see you there!');
    } else if (eventType === 'wedding') {
      bodyLines.push(`You are cordially invited to our wedding${dateStr ? ` on ${dateStr}` : ''}${timeStr ? ` at ${timeStr}` : ''}.`);
      bodyLines.push('');
      bodyLines.push('We would be honored to have you celebrate this special day with us.');
      bodyLines.push('');
      bodyLines.push('Please RSVP at your earliest convenience.');
    } else if (eventType === 'party' || eventType === 'celebration') {
      bodyLines.push(`You are invited to our ${eventType}${dateStr ? ` on ${dateStr}` : ''}${timeStr ? ` at ${timeStr}` : ''}!`);
      bodyLines.push('');
      bodyLines.push('We would love to have you join us for this special occasion.');
      bodyLines.push('');
      bodyLines.push('Please let me know if you can attend!');
    } else if (eventType === 'dinner' || eventType === 'lunch' || eventType === 'breakfast') {
      bodyLines.push(`I would like to invite you to ${eventType}${dateStr ? ` on ${dateStr}` : ''}${timeStr ? ` at ${timeStr}` : ''}.`);
      bodyLines.push('');
      bodyLines.push('It would be great to catch up and spend some time together.');
      bodyLines.push('');
      bodyLines.push('Please let me know if this works for you!');
    } else if (purpose.includes('Meeting') || purpose.includes('Review')) {
      bodyLines.push(`I would like to schedule a ${purpose.toLowerCase().replace(' meeting', '').replace(' request', '')} meeting with you${dateStr ? ` on ${dateStr}` : ''}${timeStr ? ` at ${timeStr}` : ''}.`);
      bodyLines.push('');
      bodyLines.push("We'll discuss the current project status, progress updates, and next steps. Please let me know if this time works for you or if you need to reschedule.");
    } else if (purpose === 'Follow Up') {
      bodyLines.push('I wanted to follow up on our previous conversation and check if there are any updates.');
      bodyLines.push('');
      bodyLines.push('Please let me know if you need any additional information from my end.');
    } else if (purpose === 'Invitation') {
      bodyLines.push(`You are invited${dateStr ? ` on ${dateStr}` : ''}${timeStr ? ` at ${timeStr}` : ''}.`);
      bodyLines.push('');
      bodyLines.push('I hope you can join us! Please let me know if you can make it.');
    } else if (purpose === 'Thank You') {
      bodyLines.push('I wanted to take a moment to thank you for your time and support.');
      bodyLines.push('');
      bodyLines.push('Your help has been greatly appreciated!');
    } else if (purpose === 'Congratulations') {
      bodyLines.push('Congratulations on your achievement!');
      bodyLines.push('');
      bodyLines.push('Wishing you continued success and happiness!');
    } else {
      bodyLines.push('I wanted to reach out to you regarding an important matter.');
      bodyLines.push('');
      bodyLines.push('Please let me know when you have a moment to discuss.');
    }
    
    bodyLines.push('');
    bodyLines.push('Looking forward to hearing from you!');
    bodyLines.push('');
    bodyLines.push('Best regards');
    
    params.body = bodyLines.join('\n');
    
    return params;
  }

  /**
   * Extract email parameters with AI-generated content
   * This generates the actual email content that will be sent, so preview matches reality
   */
  async extractEmailParamsWithAI(query, userId) {
    // First extract basic params using the existing method
    const basicParams = this.extractEmailParams(query);
    
    try {
      console.log(`[MainAgent] Generating AI email content for preview...`);
      
      // Try to get user's display name from various sources
      let userName = '';
      try {
        const supabase = require('../supabase/supabaseConnect');
        
        // First try: Get from calendar_tokens (has name field from Google profile)
        const { data: calendarData, error: calendarError } = await supabase
          .from('calendar_tokens')
          .select('name')
          .eq('user_id', userId)
          .single();
        
        if (!calendarError && calendarData?.name) {
          userName = calendarData.name;
          console.log(`[MainAgent] Got user display name from calendar_tokens: "${userName}"`);
        }
        
        // Second try: Get from Supabase Auth Admin API
        if (!userName) {
          try {
            const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
            
            if (!userError && userData?.user) {
              userName = userData.user.user_metadata?.full_name || 
                         userData.user.user_metadata?.name ||
                         userData.user.user_metadata?.display_name || '';
              if (userName) {
                console.log(`[MainAgent] Got user display name from auth: "${userName}"`);
              }
            }
          } catch (authError) {
            console.log(`[MainAgent] Auth admin API not available: ${authError.message}`);
          }
        }
        
        if (!userName) {
          console.log(`[MainAgent] No display name found in any source`);
        }
      } catch (dbError) {
        console.log(`[MainAgent] Could not get user name: ${dbError.message}`);
      }
      
      // Generate the AI email body
      const generationResponse = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an email writing assistant. Generate a complete, well-formatted email with:
1. A warm, appropriate greeting (e.g., "Hi [name]," or "Dear [name],")
2. The main message body (friendly, professional tone as appropriate)
3. A proper sign-off with the sender's name

Only output the email body text. Do not include "Subject:" line.
Make the email feel natural and personal, not robotic.
${userName ? `The sender's name is "${userName}" - include this after "Best regards" or similar sign-off.` : 'End with "Best regards" as the sign-off.'}`
          },
          {
            role: "user",
            content: `Write an email for:
To: ${basicParams.to}
Subject: ${basicParams.subject}
Context/Intent from user: "${query}"

Make it ${query.toLowerCase().includes('lovely') || query.toLowerCase().includes('exciting') || query.toLowerCase().includes('friendly') || query.toLowerCase().includes('party') || query.toLowerCase().includes('birthday') ? 'warm, lovely, and exciting' : 'professional and friendly'}.`
          }
        ],
        max_tokens: 600,
        temperature: 0.7
      });
      
      const aiGeneratedBody = generationResponse.choices[0].message.content;
      
      // Generate a better subject if it's too generic
      let finalSubject = basicParams.subject;
      if (basicParams.subject === 'New Message' || basicParams.subject === 'Meeting') {
        const subjectResponse = await this.openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "Generate a short, catchy email subject line (max 60 chars). Only output the subject text, nothing else. Do not use quotes."
            },
            {
              role: "user",
              content: `Generate a subject line for this email context: "${query}"`
            }
          ],
          max_tokens: 50,
          temperature: 0.7
        });
        finalSubject = subjectResponse.choices[0].message.content.replace(/^["']|["']$/g, '').trim();
      }
      
      console.log(`[MainAgent] AI generated subject: ${finalSubject}`);
      console.log(`[MainAgent] AI generated body preview: ${aiGeneratedBody.substring(0, 100)}...`);
      
      return {
        to: basicParams.to,
        subject: finalSubject,
        body: aiGeneratedBody,
        isAIGenerated: true,  // Flag to prevent re-generation in gmailAgent
        userName: userName || null
      };
      
    } catch (error) {
      console.error(`[MainAgent] Error generating AI email content:`, error);
      // Fall back to basic params if AI generation fails
      return basicParams;
    }
  }

  /**
   * Stream response after a confirmed action is executed
   * This provides a smooth word-by-word streaming experience like ChatGPT
   * Now includes context about next actions in chain
   */
  async streamConfirmedActionResponse(executionResult, onChunk) {
    try {
      onChunk({ type: 'status', message: 'Processing your confirmed action...' });

      const { result, query, toolName, agentName, nextConfirmation } = executionResult;

      // Build context about chain status
      let chainContext = '';
      if (nextConfirmation) {
        chainContext = `\n\nIMPORTANT: This is step ${nextConfirmation.chainInfo.currentStep - 1} of ${nextConfirmation.chainInfo.totalSteps} in the user's request.
The next step is: ${nextConfirmation.toolName} (${nextConfirmation.agentName})
After confirming this action was successful, mention that you'll now proceed with the next action (${nextConfirmation.description}).
Do NOT say "let me know if you need anything else" - there's still more to do.`;
      }

      // Safely stringify result, handling circular references
      let resultString;
      try {
        // Extract only the relevant parts to avoid circular references
        const safeResult = {
          success: result?.success,
          response: result?.response,
          message: result?.message,
          // For forms
          formId: result?.raw_results?.[0]?.formId || result?.formId,
          formTitle: result?.raw_results?.[0]?.form?.info?.title || result?.form?.info?.title,
          formUrl: result?.raw_results?.[0]?.formId ? 
            `https://docs.google.com/forms/d/${result.raw_results[0].formId}/viewform` : null,
          // For emails
          emailSent: result?.raw_results?.[0]?.success && toolName === 'sendEmail',
          messageId: result?.raw_results?.[0]?.messageId,
          // For docs
          documentId: result?.raw_results?.[0]?.documentId || result?.documentId,
          documentUrl: result?.raw_results?.[0]?.documentId ? 
            `https://docs.google.com/document/d/${result.raw_results[0].documentId}/edit` : null,
          // For events
          eventId: result?.raw_results?.[0]?.eventId || result?.eventId,
          // Generic error
          error: result?.error
        };
        resultString = JSON.stringify(safeResult, null, 2);
      } catch (e) {
        console.error('[MainAgent] Error stringifying result:', e.message);
        resultString = `Action completed: ${result?.success ? 'Successfully' : 'With issues'}. ${result?.response || result?.message || ''}`;
      }

      const responsePrompt = `The user confirmed and executed the following action:

Action: ${toolName} on ${agentName}
Original Query: "${query}"

Execution Result:
${resultString}
${chainContext}

Please provide a natural, conversational confirmation response that:
1. Confirms the action was completed successfully
2. Summarizes what was accomplished with specific details
3. Includes any relevant links or references from the result
4. Is friendly and helpful in tone
5. If there were any issues, mention them helpfully
${nextConfirmation ? '6. Briefly mention that you will now proceed with the next action' : ''}

Format the response clearly. If an event was created, include the event details like title, date, time.
If a document was created, include the title and link if available.
If a form was created, include the form title and a link to view/edit it.
If an email was sent, confirm it was sent successfully.`;

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
   * Now includes artifact context, long-term memory, and full conversation history
   */
  async streamCombinedResponse(query, analysis, results, errors, onChunk, conversationId = null, memoryContext = '', conversationHistory = []) {
    try {
      // Build context for the LLM
      const agentResults = Object.entries(results).map(([agent, result]) => {
        return `${agent.toUpperCase()} Agent Result:\n${JSON.stringify(result, null, 2)}`;
      }).join('\n\n');

      const agentErrors = Object.entries(errors).map(([agent, error]) => {
        return `${agent.toUpperCase()} Agent Error: ${error}`;
      }).join('\n');

      // Build artifact context for the prompt
      // ONLY include artifacts if agents were actually used (not for conversational queries)
      let artifactContext = '';
      const isConversationalQuery = !analysis.agents || analysis.agents.length === 0;
      if (conversationId && !isConversationalQuery) {
        artifactContext = await formatArtifactsForPrompt(conversationId);
      }

      const responsePrompt = `The user asked: "${query}"

Query Analysis:
${JSON.stringify(analysis, null, 2)}

Agent Results:
${agentResults}

${agentErrors ? `Errors encountered:\n${agentErrors}\n` : ''}

${artifactContext ? `\n--- Conversation Artifacts ---\n${artifactContext}\n---\n` : ''}

${memoryContext ? `\n--- Long-Term Memories ---\n${memoryContext}\n(Use these memories only if directly relevant. Do not explicitly mention "from your memories" unless appropriate.)\n---\n` : ''}

CRITICAL INSTRUCTION - Response Style:
${analysis.agents && analysis.agents.length === 0 ? `
⚠️ This is a CONVERSATIONAL query (no agents were used).
- Answer the question DIRECTLY and CONCISELY
- DO NOT recap or summarize previous actions
- DO NOT mention past events, forms, or other items unless specifically asked about them
- Keep response SHORT (1-2 sentences max)
- Example: If asked "what is my name", just say "Your name is [name]!" - nothing else.
` : `
This query required agent actions. Please provide a response that:
1. Directly addresses their request
2. Summarizes what was accomplished
3. Includes relevant details from the agent results (IDs, links, etc.)
4. Mentions any errors or limitations encountered
5. Is friendly and helpful in tone
`}

Format the response in a clear, readable way.
Do not include raw JSON or technical details unless specifically relevant.
${analysis.agents && analysis.agents.length === 0 ? 'Remember: Just answer the question directly without extra context or recaps!' : ''}`;

      // Get dynamic system prompt with artifact context
      const systemPrompt = conversationId 
        ? await this.createDynamicSystemPrompt(conversationId)
        : this.systemPrompt;

      // Build messages array with conversation history for context
      const messages = [
        { role: 'system', content: systemPrompt },
      ];

      // Add conversation history (limit to last 10 messages to avoid token limits)
      if (conversationHistory && conversationHistory.length > 0) {
        console.log(`[MainAgent] 💬 Adding ${conversationHistory.length} messages from conversation history to LLM context`);
        const recentHistory = conversationHistory.slice(-10);
        console.log(`[MainAgent] 📋 Using last ${recentHistory.length} messages (trimmed from ${conversationHistory.length})`);
        recentHistory.forEach(msg => {
          messages.push({
            role: msg.role,
            content: msg.content
          });
        });
      } else {
        console.log(`[MainAgent] ⚠️ No conversation history provided to response generation`);
      }

      // Add the current response prompt
      messages.push({ role: 'user', content: responsePrompt });

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
        gmail: {
          name: 'Gmail Agent',
          service: 'Gmail',
          capabilities: [
            'Send, reply, and forward emails',
            'Read and search emails',
            'Manage drafts',
            'Label and filter management',
            'Email actions (star, archive, trash)'
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
        },
        flights: {
          name: 'Flights Agent',
          service: 'SerpAPI Google Flights',
          capabilities: [
            'Search for flights between cities/airports',
            'Compare flight prices',
            'Get price insights and trends',
            'One-way and round-trip searches',
            'Multi-currency support'
          ]
        }
      }
    };
  }
}

module.exports = MainAgent;
