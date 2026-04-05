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
const CalendarAgentMultiStep = require('../calendar/calendarAgentMultiStep');
const DocsAgentMultiStep = require('../docs/docsAgentMultiStep');
const FormsAgentMultiStep = require('../forms/formsAgentMultiStep');
const GitHubAgentMultiStep = require('../github/githubAgentMultiStep');
const GmailAgentMultiStep = require('../gmail/gmailAgentMultiStep');
const MeetAgentMultiStep = require('../meet/meetAgentMultiStep');
const SheetsAgentMultiStep = require('../sheets/sheetsAgentMultiStep');
const FlightsAgentMultiStep = require('../flights/flightsAgentMultiStep');
const MapsAgentMultiStep = require('../maps/mapsAgentMultiStep');
const WebSearchAgentMultiStep = require('../websearch/webSearchAgentMultiStep');
const ResearchAgent = require('../research/researchAgent');
const MicrosoftAgentMultiStep = require('../microsoft/microsoftAgentMultiStep');
const WeatherAgentMultiStep = require('../weather/weatherAgentMultiStep');
const SchedulesAgentMultiStep = require('../schedules/schedulesAgentMultiStep');
const ConversationalAgent = require('../agents/conversationalAgent');
const confirmationStore = require('./confirmationStore');
const confirmationUtils = require('./confirmationUtils');
const { TimelineEmitter, TimelineEventType, AGENT_NAMES } = require('./timelineEvents');
const IntentClassifier = require('./intentClassifier');

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

// Timezone detection
const { getUserTimezone } = require('../utils/timezoneDetection');

// Supabase client import (needed for file operations in confirmation flow)
const supabase = require('../supabase/supabaseConnect');

class MainAgent {
  constructor() {
    // Initialize OpenAI client
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Initialize all specialized agents with multi-step execution
    this.agents = {
      calendar: new CalendarAgentMultiStep(),
      docs: new DocsAgentMultiStep(),
      forms: new FormsAgentMultiStep(),
      github: new GitHubAgentMultiStep(),
      gmail: new GmailAgentMultiStep(),
      meet: new MeetAgentMultiStep(),
      sheets: new SheetsAgentMultiStep(),
      flights: new FlightsAgentMultiStep(),
      maps: new MapsAgentMultiStep(),
      websearch: new WebSearchAgentMultiStep(),
      research: new ResearchAgent(),
      microsoft: new MicrosoftAgentMultiStep(),
      weather: new WeatherAgentMultiStep(this.openai),
      schedules: new SchedulesAgentMultiStep(this.openai),
      conversational: new ConversationalAgent()
    };

    // System prompt for the main coordinator
    this.systemPrompt = this.createSystemPrompt();
  }

  // ==================== Research Content Extraction from Conversation History ====================

  /**
   * Detects if user query references previous research content and extracts it
   * Looks for patterns like "this whole deep research report", "add this research", "the report we just got"
   * @param {string} query - User query
   * @param {Array} conversationHistory - Chat history
   * @returns {Object|null} - researchContent object or null if no research found
   */
  extractResearchContentFromHistory(query, conversationHistory) {
    // Check if query references previous research
    const researchPatterns = [
      /this whole.*research/i,
      /this whole.*report/i,
      /add this.*research/i,
      /add.*whole.*research/i,
      /the report we just/i,
      /the deep research/i,
      /research.*we.*generated/i,
      /research.*we.*just/i,
      /this entire research/i,
      /complete.*research/i,
      /full.*research/i,
      /whole.*deep.*research/i,
      /add that too/i,
      /add the rest/i,
      /add before that/i,
      /include the missing/i,
      /add sections/i
    ];

    const hasResearchReference = researchPatterns.some(pattern => pattern.test(query));
    
    if (!hasResearchReference) {
      return null;
    }

    console.log('[MainAgent] 🔍 Query references previous research content');

    // Search conversation history backwards to find most recent research result
    if (!conversationHistory || conversationHistory.length === 0) {
      console.log('[MainAgent] ⚠️ No conversation history available to extract research');
      return null;
    }

    // Look through history for research agent results - try multiple locations
    for (let i = conversationHistory.length - 1; i >= 0; i--) {
      const msg = conversationHistory[i];
      
      if (!msg) continue;

      // Attempt 1: Check message metadata for agentResults
      if (msg.metadata && msg.metadata.agentResults && msg.metadata.agentResults.research && msg.metadata.agentResults.research.success) {
        const researchResult = msg.metadata.agentResults.research;
        
        console.log('[MainAgent] ✅ Found research in msg.metadata.agentResults');
        console.log('[MainAgent] 📊 Research content: ' + 
          `${researchResult.answer?.length || 0} chars, ` +
          `${researchResult.sources?.length || 0} sources`);
        
        return {
          type: 'research_result',
          content: researchResult.answer || '',
          sources: researchResult.sources || [],
          contentProvided: true  // Signal to agent: render mode, don't regenerate
        };
      }

      // Attempt 2: Check direct response object for research
      if (msg.response && typeof msg.response === 'object' && msg.response.research) {
        const researchResult = msg.response.research;
        
        if (researchResult.answer || researchResult.success) {
          console.log('[MainAgent] ✅ Found research in msg.response.research');
          
          return {
            type: 'research_result',
            content: researchResult.answer || '',
            sources: researchResult.sources || [],
            contentProvided: true
          };
        }
      }

      // Attempt 3: Check for research result nested in content
      if (msg.content && typeof msg.content === 'object') {
        if (msg.content.research && msg.content.research.answer) {
          console.log('[MainAgent] ✅ Found research in msg.content.research');
          
          return {
            type: 'research_result',
            content: msg.content.research.answer || '',
            sources: msg.content.research.sources || [],
            contentProvided: true
          };
        }
      }

      // Attempt 4: Check if entire message IS a research result
      if (msg.answer && msg.sources && !msg.role) {
        console.log('[MainAgent] ✅ Found research message structure');
        
        return {
          type: 'research_result',
          content: msg.answer || '',
          sources: msg.sources || [],
          contentProvided: true
        };
      }

      // Attempt 5: Check agentsUsed field to verify research was performed
      if (msg.metadata && msg.metadata.agentsUsed && msg.metadata.agentsUsed.includes('research')) {
        // This message has research, look for the result in various places
        console.log('[MainAgent] 🔍 Found message where research agent was used, searching for result...');
        
        // Try to find research data in common locations
        const locations = [
          msg.research,
          msg.agentResults?.research,
          msg.results?.research,
          msg.executedActions?.find(a => a.agent === 'research' || a.tool === 'conductResearch')?.result
        ];
        
        for (const location of locations) {
          if (location && location.answer) {
            console.log('[MainAgent] ✅ Found research result in agent-specific location');
            
            return {
              type: 'research_result',
              content: location.answer || '',
              sources: location.sources || [],
              contentProvided: true
            };
          }
        }
      }
    }

    console.log('[MainAgent] ⚠️ No research content found in conversation history');
    return null;
  }

  // ==================== LLM Parameter Extraction (GitHub) ====================

  /**
   * Use the LLM to extract parameters for GitHub tools (preferred over regex).
   * Falls back to existing regex extractors if LLM extraction fails.
   * @param {string} toolName
   * @param {string} query
   * @param {string|null} userId
   * @param {Array<{role:string,content:string}>} conversationHistory
   * @returns {Promise<object>}
   */
  async extractGithubParamsWithLLM(toolName, query, userId = null, conversationHistory = []) {
    const supabase = require('../supabase/supabaseConnect');

    const schemas = {
      upsertReadme: `{\n  \"owner\"?: string,\n  \"repo\": string\n}`,
      createRepository: `{\n  \"name\": string,\n  \"description\"?: string,\n  \"private\"?: boolean\n}`,
      deleteRepository: `{\n  \"owner\"?: string,\n  \"repo\": string\n}`,
      createIssue: `{\n  \"owner\"?: string,\n  \"repo\": string,\n  \"title\": string,\n  \"body\"?: string,\n  \"labels\"?: string[],\n  \"assignees\"?: string[]\n}`,
      createPullRequest: `{\n  \"owner\"?: string,\n  \"repo\": string,\n  \"title\": string,\n  \"head\": string,\n  \"base\": string,\n  \"body\"?: string,\n  \"draft\"?: boolean\n}`,
      createFile: `{\n  \"owner\"?: string,\n  \"repo\": string,\n  \"path\": string,\n  \"content\": string,\n  \"message\"?: string,\n  \"branch\"?: string\n}`,
      upsertFile: `{\n  \"owner\"?: string,\n  \"repo\": string,\n  \"path\": string,\n  \"content\": string,\n  \"message\"?: string,\n  \"branch\"?: string\n}`,
      safeUpdateFile: `{\n  \"owner\"?: string,\n  \"repo\": string,\n  \"path\": string,\n  \"content\": string,\n  \"message\"?: string,\n  \"branch\"?: string\n}`,
      safeDeleteFile: `{\n  \"owner\"?: string,\n  \"repo\": string,\n  \"path\": string,\n  \"message\"?: string,\n  \"branch\"?: string\n}`,
    };

    const schema = schemas[toolName] || `{} // unknown tool`;

    // Pull connected GitHub username (helps with \"this repo\" requests)
    let connectedUsername = null;
    if (userId) {
      try {
        const { data } = await supabase
          .from('github_tokens')
          .select('github_username')
          .eq('user_id', userId)
          .single();
        connectedUsername = data?.github_username || null;
      } catch (_) {
        connectedUsername = null;
      }
    }

    const history = Array.isArray(conversationHistory) ? conversationHistory.slice(-8) : [];
    const historyText = history
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${String(m.content || '').slice(0, 400)}`)
      .join('\n');

    const stopwords = [
      'and', 'then', 'it', 'this', 'that', 'repo', 'repository', 'github', 'my', 'the', 'a', 'an', 'to', 'in', 'for', 'of'
    ];

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
`You extract structured parameters for GitHub tool execution.\n\n` +
`Tool: ${toolName}\n` +
`Return ONLY a JSON object matching this schema:\n${schema}\n\n` +
`Rules:\n` +
`- Prefer repository names explicitly mentioned earlier in the sentence (e.g., \"PolarisAI repository\").\n` +
`- Never set repo/name/path to conjunctions or filler words like: ${stopwords.join(', ')}.\n` +
`- If user says \"this repo\" and the repo name is present in conversation history, use it.\n` +
`- If owner is missing, omit it (GitHub agent will infer from connected account).\n` +
`- repo should be the repo name only (no URL). If user provides owner/repo, set repo to repo part and (optionally) owner.\n` +
`- For README intents, repo must be the repository they mentioned (NOT the word after \"repo\").\n` +
`- For file tools, path must be a valid path like \"README.md\" or \"src/index.js\".\n` +
`- For file content: if user didn't provide content and tool requires content, set content to an empty string.\n`
          },
          {
            role: 'user',
            content:
`User query:\n${query}\n\n` +
`${historyText ? `Recent conversation:\n${historyText}\n\n` : ''}` +
`${connectedUsername ? `Connected GitHub username: ${connectedUsername}\n\n` : ''}` +
`Return ONLY the JSON object.`
          }
        ],
      });

      const extracted = JSON.parse(response.choices[0].message.content);

      // Minimal sanity checks to avoid obvious failures like repo=\"and\"
      if (extracted && typeof extracted === 'object') {
        if (typeof extracted.repo === 'string' && stopwords.includes(extracted.repo.toLowerCase())) {
          extracted.repo = 'pending';
        }
        if (typeof extracted.name === 'string' && stopwords.includes(extracted.name.toLowerCase())) {
          extracted.name = 'new-repository';
        }
        if (typeof extracted.path === 'string' && stopwords.includes(extracted.path.toLowerCase())) {
          extracted.path = 'pending';
        }
        return extracted;
      }
    } catch (err) {
      console.warn(`[MainAgent] GitHub LLM param extraction failed for ${toolName}:`, err.message);
    }

    // Fallbacks (regex/heuristics) to keep system functional if LLM extraction fails
    if (toolName === 'createRepository') return this.extractGitHubRepoParams(query);
    if (toolName === 'upsertReadme') return this.extractGitHubReadmeParams(query, userId);
    if (toolName === 'createIssue') return this.extractGitHubIssueParams(query);
    if (['createFile', 'upsertFile', 'safeUpdateFile', 'safeDeleteFile'].includes(toolName)) {
      return this.extractGitHubFileParams(query, userId);
    }

    return {};
  }

  // ==================== Integration Preflight & Error Sanitization ====================

  _integrationConfig(agentName) {
    const configs = {
      gmail: { table: 'gmail_tokens', label: 'Gmail', connectHint: 'Dashboard → Apps → Connect Gmail' },
      calendar: { table: 'calendar_tokens', label: 'Google Calendar', connectHint: 'Dashboard → Apps → Connect Google Calendar' },
      docs: { table: 'docs_tokens', label: 'Google Docs', connectHint: 'Dashboard → Apps → Connect Google Docs' },
      sheets: { table: 'sheets_tokens', label: 'Google Sheets', connectHint: 'Dashboard → Apps → Connect Google Sheets' },
      forms: { table: 'forms_tokens', label: 'Google Forms', connectHint: 'Dashboard → Apps → Connect Google Forms' },
      meet: { table: 'meet_tokens', label: 'Google Meet', connectHint: 'Dashboard → Apps → Connect Google Meet' },
      github: { table: 'github_tokens', label: 'GitHub', connectHint: 'Dashboard → Apps → Connect GitHub' },
      microsoft: { table: 'microsoft_tokens', label: 'Microsoft 365', connectHint: 'Dashboard → Apps → Connect Microsoft 365' },
    };
    return configs[agentName] || null;
  }

  async _isIntegrationConnected(agentName, userId) {
    const cfg = this._integrationConfig(agentName);
    if (!cfg) return true; // agent doesn't require connection (or unknown)

    const supabase = require('../supabase/supabaseConnect');
    try {
      const { data, error } = await supabase
        .from(cfg.table)
        .select('user_id')
        .eq('user_id', userId)
        .limit(1)
        .single();
      return !error && !!data;
    } catch {
      return false;
    }
  }

  _friendlyIntegrationError(agentName) {
    const cfg = this._integrationConfig(agentName);
    if (!cfg) return 'This integration is not connected. Please connect it from the Dashboard and try again.';
    return `${cfg.label} is not connected. Please connect it first (${cfg.connectHint}) and try again.`;
  }

  _detectUserTimezone(userLocation = null) {
    // Try to detect timezone from user location or use a sensible default
    const timezone = getUserTimezone({
      userLocation: userLocation,
      defaultTimezone: 'Asia/Kolkata' // Default to IST since your users seem to be in India
    });
    console.log(`[MainAgent] 🌍 Detected user timezone: ${timezone}`);
    return timezone;
  }

  /**
   * Validate agents before execution
   * Checks for validation errors that should stop execution immediately
   * @param {object} analysis - Agent analysis result
   * @param {string} query - Original user query
   * @returns {object} - { hasErrors: boolean, errorMessage: string }
   */
  async _validateAgentsBeforeExecution(analysis, query) {
    const { validateScheduleReminder, formatScheduleValidationErrors } = require('../utils/validation');
    
    // Check each agent for validation requirements
    for (const agentName of analysis.agents) {
      const agentQuery = analysis.queries[agentName];
      
      // ============================================================
      // ✅ VALIDATE SCHEDULES/REMINDERS
      // ============================================================
      if (agentName === 'schedules') {
        console.log('[MainAgent] 🔍 Pre-validating schedule/reminder parameters...');
        
        // Extract content from query (simple heuristic)
        const reminderMatch = agentQuery.match(/remind(?:\s+me)?\s+(?:to\s+)?(.+?)(?:\s+(?:at|on|in|for|tomorrow|today|yesterday))/i);
        const content = reminderMatch ? reminderMatch[1].trim() : agentQuery;
        
        const validation = validateScheduleReminder({
          content: content,
          datetime: agentQuery,
          query: agentQuery
        });
        
        console.log('[MainAgent] 📊 Schedule validation result:', JSON.stringify(validation, null, 2));
        
        if (!validation.isValid) {
          console.log('[MainAgent] ❌ Schedule validation failed:', validation.errors);
          
          const errorMessage = formatScheduleValidationErrors(validation.errors);
          
          return {
            hasErrors: true,
            errorMessage: errorMessage,
            agentName: agentName
          };
        }
        
        console.log('[MainAgent] ✅ Schedule validation passed');
      }
    }
    
    // No validation errors found
    return {
      hasErrors: false,
      errorMessage: null
    };
  }

  _sanitizeErrorForUser(agentName, rawMessage) {
    const msg = String(rawMessage || '');
    const lower = msg.toLowerCase();

    // ✅ CRITICAL: Preserve validation error messages (they are user-friendly)
    if (msg.includes('I noticed you mentioned') || 
        msg.includes('That time has already passed') ||
        msg.includes('Did you mean:') ||
        msg.includes('Which option would you prefer?') ||
        msg.includes('Which time would you prefer?')) {
      console.log('[MainAgent] 📝 Preserving validation error message');
      return msg;
    }

    if (lower.includes('tokens not found') || lower.includes('user tokens not found')) {
      return this._friendlyIntegrationError(agentName);
    }

    if (lower.includes('invalid or expired token')) {
      return `Your ${this._integrationConfig(agentName)?.label || 'integration'} session seems expired. Please reconnect it from the Dashboard → Apps and try again.`;
    }

    // Default: don't leak internal details
    return 'Something went wrong while processing your request. Please try again.';
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

    // ============================================================
    // ✅ VALIDATE PARAMETERS BEFORE SHOWING CONFIRMATION
    // ============================================================
    if (agentName === 'calendar' && (toolName === 'createEvent' || toolName === 'updateEvent')) {
      const { validateCalendarEvent, formatCalendarValidationErrors } = require('../utils/validation');
      
      console.log('[MainAgent] 🔍 Validating calendar event parameters...');
      console.log('[MainAgent] 📝 Parameters:', JSON.stringify(params, null, 2));
      
      const validation = validateCalendarEvent({
        summary: params.summary,
        startDateTime: params.startDateTime,
        endDateTime: params.endDateTime,
        query: query
      });
      
      console.log('[MainAgent] 📊 Validation result:', JSON.stringify(validation, null, 2));
      
      if (!validation.isValid) {
        console.log('[MainAgent] ❌ Calendar event validation failed:', validation.errors);
        
        const errorMessage = formatCalendarValidationErrors(validation.errors);
        
        console.log('[MainAgent] 📤 Returning validation error to user');
        
        // Return validation error instead of confirmation
        return {
          type: 'validation_error',
          agentName,
          toolName,
          message: errorMessage,
          validationErrors: validation.errors
        };
      }
      
      console.log('[MainAgent] ✅ Calendar event validation passed');
    }

    // Preflight: don't even show confirmation if integration isn't connected
    // (prevents misleading previews when tokens are missing)
    // Note: This function is sync, so we only do a lightweight message here.
    // The full async check is done in executeAgentQueriesWithConfirmation.
    const cfg = this._integrationConfig(agentName);
    if (cfg) {
      const previewBlocked = `${cfg.label} is not connected. Please connect it first (${cfg.connectHint}) and try again.`;
      return {
        type: 'integration_not_connected',
        agentName,
        toolName,
        message: previewBlocked,
      };
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
      conversationHistory,
      null,  // conversationId - not always available here
      undefined,  // ttlMs - use default
      [],  // timelineEvents - not available here
      null,  // originalAnalysis - not available here
      {},  // initialResults - not available here
      this.lastFileIds || []  // ✅ NEW: Pass fileIds for attachment support
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
   * ALSO handles sequential execution of non-confirmation agents after confirmation
   * 
   * @param {string} requestId - The pending action request ID
   * @param {string} userId - User ID for validation
   * @returns {object} - Result of the tool execution, plus nextConfirmation if part of chain
   */
  async executeConfirmedAction(requestId, userId, timeline = null) {
    const pendingAction = confirmationStore.getPendingAction(requestId, userId);
    
    if (!pendingAction) {
      return {
        success: false,
        error: 'Action not found, expired, or unauthorized'
      };
    }

    try {
      const { agentName, toolName, params, query, conversationHistory, conversationId, chainId, chainIndex, totalInChain, originalAnalysis, initialResults } = pendingAction;
      
      console.log(`\n[MainAgent] 🚀 Executing confirmed action: ${toolName} on ${agentName}`);
      console.log(`[MainAgent]   ConversationId: ${conversationId || 'NOT SET'}`);
      if (chainId) {
        console.log(`[MainAgent]   Chain: ${chainId} (step ${chainIndex + 1}/${totalInChain})`);
      }
      if (initialResults && Object.keys(initialResults).length > 0) {
        console.log(`[MainAgent]   Initial results available from: ${Object.keys(initialResults).join(', ')}`);
      }
      
      // ✅ CRITICAL FIX: Check if this is a sequential multi-agent task
      // If originalAnalysis exists and requiresSequential is true, we need to execute ALL agents in sequence
      // not just the confirmed one
      if (originalAnalysis && originalAnalysis.requiresSequential && originalAnalysis.agents && originalAnalysis.agents.length > 1) {
        console.log(`[MainAgent] 🔄 Sequential multi-agent task detected`);
        console.log(`[MainAgent]   Agents: ${originalAnalysis.agents.join(', ')}`);
        console.log(`[MainAgent]   Current agent: ${agentName}`);
        console.log(`[MainAgent]   userId type: ${typeof userId}, value: ${JSON.stringify(userId).substring(0, 100)}`);
        
        // Execute all agents in sequence, starting with the confirmed one
        const results = {};
        const errors = {};
        const storedArtifacts = [];
        
        // ✅ CRITICAL: Use initial results from non-confirmation agents that were already executed
        if (initialResults && Object.keys(initialResults).length > 0) {
          console.log(`[MainAgent] 📦 Using initial results from: ${Object.keys(initialResults).join(', ')}`);
          Object.assign(results, initialResults);
          
          // Also extract artifacts from initial results
          for (const [agentName, agentResult] of Object.entries(initialResults)) {
            if (agentResult.success) {
              // ✅ NEW FORMAT: Handle BaseAgent executedActions format
              if (agentResult.executedActions && Array.isArray(agentResult.executedActions)) {
                console.log(`[MainAgent] 📦 Processing ${agentResult.executedActions.length} executed actions for ${agentName} (initial results)`);
                for (const action of agentResult.executedActions) {
                  try {
                    const toolName = action.tool;
                    const toolResult = action.result;
                    console.log(`[MainAgent] 🔍 Attempting to store artifact for ${agentName}/${toolName} (initial)`);
                    const artifact = await extractAndStoreArtifact(
                      conversationId,
                      agentName,
                      toolName,
                      toolResult
                    );
                    if (artifact) {
                      storedArtifacts.push(artifact);
                      console.log(`[MainAgent] ✅ Artifact from initial results: ${artifact.type} - ${artifact.title} (${artifact.id})`);
                    }
                  } catch (artifactError) {
                    console.error(`[MainAgent] ⚠️ Error extracting artifact from initial results:`, artifactError);
                  }
                }
              }
              // ✅ OLD FORMAT: Handle legacy tools_used format
              else if (agentResult.tools_used) {
                for (let i = 0; i < agentResult.tools_used.length; i++) {
                  const tool = agentResult.tools_used[i];
                  try {
                    const rawResult = agentResult.raw_results?.[i] || agentResult.raw_results?.find(r => r.success !== false) || agentResult;
                    const artifact = await extractAndStoreArtifact(
                      conversationId,
                      agentName,
                      tool.name || tool,
                      rawResult
                    );
                    if (artifact) {
                      storedArtifacts.push(artifact);
                      console.log(`[MainAgent] ✅ Artifact from initial results: ${artifact.type} - ${artifact.title} (${artifact.id})`);
                    }
                  } catch (artifactError) {
                    console.error(`[MainAgent] ⚠️ Error extracting artifact from initial results:`, artifactError);
                  }
                }
              }
            }
          }
        }
        
        // ✅ CRITICAL: Get chain actions if this is part of a chain
        let chainActions = null;
        if (chainId) {
          const chain = confirmationStore.getActionChain(chainId);
          if (chain && chain.actions) {
            chainActions = chain.actions;
            console.log(`[MainAgent] 🔗 Found chain with ${chainActions.length} actions`);
          }
        }
        
        for (const currentAgentName of originalAnalysis.agents) {
          // ✅ CRITICAL: Skip agents that were already executed in initial phase
          if (initialResults && initialResults[currentAgentName]) {
            console.log(`[MainAgent] ⏭️ Skipping ${currentAgentName} - already executed in initial phase`);
            continue;
          }
          
          // ✅ CRITICAL: If this is a chain and we're past the confirmed agent, STOP and prepare next confirmation
          if (chainId && currentAgentName !== agentName) {
            const currentIndex = originalAnalysis.agents.indexOf(currentAgentName);
            const confirmedIndex = originalAnalysis.agents.indexOf(agentName);
            
            if (currentIndex > confirmedIndex) {
              console.log(`[MainAgent] 🛑 Stopping sequential execution - next agent (${currentAgentName}) requires user confirmation`);
              break;  // Exit the loop - don't execute agents beyond the confirmed one
            }
          }
          
          try {
            let agentQuery = originalAnalysis.queries[currentAgentName];
            console.log(`[MainAgent] 🔄 Executing ${currentAgentName} sequentially with query: "${agentQuery}"`);
            
            // Emit timeline event for agent execution
            if (timeline) {
              timeline.emitAgentExecuting(currentAgentName, agentQuery);
            }
            
            // Get the specialized agent
            const agent = this.agents[currentAgentName];
            if (!agent) {
              throw new Error(`Agent '${currentAgentName}' not found`);
            }
            
            // Build options for the agent
            const agentOptions = {
              userId: userId,  // Explicitly use the userId parameter
              conversationHistory: conversationHistory,
              conversationId: conversationId,
              ...(currentAgentName === 'maps' && pendingAction.userLocation ? { userLocation: pendingAction.userLocation } : {}),
              // Add timezone for schedules agent
              ...(currentAgentName === 'schedules' ? { 
                timezone: pendingAction.userTimezone || this._detectUserTimezone(pendingAction.userLocation) 
              } : {})
            };
            
            // Enrich query with previous results (for sequential execution)
            if (Object.keys(results).length > 0) {
              const enrichmentResult = await this._enrichQueryWithPreviousResults(agentQuery, currentAgentName, results, userId);
              
              // ✅ CRITICAL FIX: Check if enrichment returned structured data
              if (typeof enrichmentResult === 'object' && enrichmentResult.researchContent) {
                console.log(`[MainAgent] 📦 Passing structured research content to ${currentAgentName}`);
                agentQuery = enrichmentResult.query;
                agentOptions.researchContent = enrichmentResult.researchContent;
              } else if (typeof enrichmentResult === 'string') {
                // String enrichment (old behavior for email agents)
                agentQuery = enrichmentResult;
              } else {
                // Fallback: use original query
                console.warn(`[MainAgent] ⚠️ Unexpected enrichment result type:`, typeof enrichmentResult);
              }
            }
            
            // ✅ CRITICAL FIX: Only force execution for the CONFIRMED agent, not chain actions
            // Chain actions should be prepared but not executed - they need user confirmation
            if (currentAgentName === agentName) {
              // Determine which tool and params to use
              const toolToExecute = toolName;
              const paramsToUse = params;
              
              console.log(`[MainAgent] 🔧 Forcing execution of ${toolToExecute} for ${currentAgentName}`);
              
              // Normal forced execution
              agentOptions.forceToolExecution = {
                toolName: toolToExecute,
                params: paramsToUse
              };
            }
            
            console.log(`[MainAgent] 🔍 agentOptions for ${currentAgentName}:`, { 
              userId: typeof agentOptions.userId, 
              conversationId: agentOptions.conversationId,
              hasForceToolExecution: !!agentOptions.forceToolExecution,
              hasResearchContent: !!agentOptions.researchContent
            });
            
            const result = await agent.processQuery(agentQuery, agentOptions);
            results[currentAgentName] = result;
            
            // Emit timeline event for agent completion
            if (timeline) {
              timeline.emitAgentCompleted(currentAgentName, result);
            }
            
            // Store artifacts from successful tool executions
            if (conversationId && result.success) {
              // ✅ NEW FORMAT: Handle BaseAgent executedActions format
              if (result.executedActions && Array.isArray(result.executedActions)) {
                console.log(`[MainAgent] 📦 Processing ${result.executedActions.length} executed actions for ${currentAgentName}`);
                for (const action of result.executedActions) {
                  try {
                    const toolName = action.tool;
                    const toolResult = action.result;
                    console.log(`[MainAgent] 🔍 Attempting to store artifact for ${currentAgentName}/${toolName}`);
                    const artifact = await extractAndStoreArtifact(
                      conversationId,
                      currentAgentName,
                      toolName,
                      toolResult
                    );
                    if (artifact) {
                      storedArtifacts.push(artifact);
                      console.log(`[MainAgent] ✅ Artifact stored: ${artifact.type} - ${artifact.title} (${artifact.id})`);
                    }
                  } catch (artifactError) {
                    console.error(`[MainAgent] ⚠️ Error storing artifact:`, artifactError);
                  }
                }
              }
              // ✅ OLD FORMAT: Handle legacy tools_used format
              else if (result.tools_used) {
                for (let i = 0; i < result.tools_used.length; i++) {
                  const tool = result.tools_used[i];
                  try {
                    const rawResult = result.raw_results?.[i] || result.raw_results?.find(r => r.success !== false) || result;
                    const artifact = await extractAndStoreArtifact(
                      conversationId,
                      currentAgentName,
                      tool.name || tool,
                      rawResult
                    );
                    if (artifact) {
                      storedArtifacts.push(artifact);
                      console.log(`[MainAgent] ✅ Artifact stored: ${artifact.type} - ${artifact.title} (${artifact.id})`);
                    }
                  } catch (artifactError) {
                    console.error(`[MainAgent] ⚠️ Error storing artifact:`, artifactError);
                  }
                }
              }
            }
            
          } catch (error) {
            console.error(`[MainAgent] Error executing ${currentAgentName}:`, error);
            const friendly = this._sanitizeErrorForUser(currentAgentName, error.message);
            errors[currentAgentName] = {
              error: friendly,
              query: originalAnalysis.queries[currentAgentName]
            };
            // Emit failed event
            if (timeline) {
              timeline.emitAgentFailed(currentAgentName, friendly);
            }
          }
        }
        
        // Remove the pending action after successful execution
        confirmationStore.removePendingAction(requestId);
        
        // ✅ CRITICAL: Check if this is part of a chain and prepare next action for confirmation
        let nextConfirmation = null;
        if (chainId) {
          console.log(`[MainAgent] 🔗 Checking for next action in chain: ${chainId}`);
          
          // ✅ CRITICAL FIX: Stop chain if current action failed
          if (errors[agentName]) {
            console.log(`[MainAgent] 🛑 Chain execution stopped - ${agentName} failed: ${errors[agentName].error}`);
            return {
              success: false,
              results: results,
              errors: errors,
              query: query,
              toolName: toolName,
              agentName: agentName,
              storedArtifacts: storedArtifacts,
              conversationId: conversationId,
              chainStopped: true,
              chainError: `Cannot proceed with next step - ${agentName} action failed: ${errors[agentName].error}`
            };
          }
          
          // Build a result object to pass to the next action
          const completedResult = {
            agentName,
            toolName,
            result: results[agentName],
            artifact: storedArtifacts.length > 0 ? storedArtifacts[storedArtifacts.length - 1] : null
          };
          
          // Get timeline events from current step to accumulate in chain
          const currentTimelineEvents = timeline ? timeline.getEvents() : [];
          
          const nextChainAction = confirmationStore.getNextChainAction(chainId, userId, completedResult, currentTimelineEvents);
          
          if (nextChainAction && !nextChainAction.chainComplete) {
            console.log(`[MainAgent] 🔗 Next action in chain: ${nextChainAction.nextAction.toolName}`);
            
            // Enhance the next action's params with results from this action
            let enhancedNextAction = nextChainAction.nextAction;
            
            // If the next action is an email, enhance it with the form/doc link
            if (enhancedNextAction.toolName === 'sendEmail' || enhancedNextAction.toolName === 'microsoft_sendEmail') {
              console.log(`[MainAgent] 📧 Enhancing email action with previous results...`);
              enhancedNextAction = await this.enhanceEmailWithPreviousResult(enhancedNextAction, completedResult, userId);
              
              // ✅ CRITICAL: Update the pending action in the store with enhanced params
              console.log(`[MainAgent] 💾 Updating pending action with enhanced params`);
              confirmationStore.updatePendingActionParams(enhancedNextAction.requestId, enhancedNextAction.params, enhancedNextAction.previewContent);
            }
            
            // Return the next action for user confirmation
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
            
            console.log(`[MainAgent] ✅ Prepared next confirmation for user: ${enhancedNextAction.toolName}`);
          } else if (nextChainAction && nextChainAction.chainComplete) {
            console.log(`[MainAgent] ✅ Action chain complete: ${chainId}`);
          }
        }
        
        // Return combined results from all agents
        return {
          success: Object.keys(errors).length === 0,
          results: results,
          errors: errors,
          query: query,
          toolName: toolName,
          agentName: agentName,
          storedArtifacts: storedArtifacts,
          conversationId: conversationId,
          nextConfirmation: nextConfirmation  // ✅ Return next action if it exists
        };
      }
      
      // Original single-agent confirmation flow
      // Emit timeline event for agent execution
      if (timeline) {
        timeline.emitAgentExecuting(agentName, `Executing ${toolName}...`);
      }
      
      // Get the specialized agent
      const agent = this.agents[agentName];
      if (!agent) {
        throw new Error(`Agent '${agentName}' not found`);
      }

      // ✅ CRITICAL FIX: Pass the ORIGINAL user query, not a rewritten version
      // The original query contains ALL requested actions, not just the first one
      // This is essential for multi-step execution to work properly
      if (!query) {
        throw new Error('Original query is required for multi-step execution');
      }
      
      console.log(`[MainAgent] 📝 Passing original query to ${agentName}: "${query}"`);
      
      // 🔴 CRITICAL FIX: Fetch file metadata from Supabase BEFORE passing to agent
      let attachedFiles = [];
      if (pendingAction.fileIds && pendingAction.fileIds.length > 0) {
        console.log(`[MainAgent] 📎 Fetching ${pendingAction.fileIds.length} file(s) from database...`);
        
        try {
          const { data: files, error } = await supabase
            .from('files')
            .select('id, original_filename, filename, mime_type, size, storage_path, file_type')
            .in('id', pendingAction.fileIds)
            .eq('user_id', userId);
          
          if (!error && files && files.length > 0) {
            attachedFiles = files;
            console.log(`[MainAgent] ✅ Loaded ${files.length} file(s):`, 
              files.map(f => `${f.original_filename || f.filename} (${f.id.substring(0, 8)}...)`).join(', '));
          } else if (error) {
            console.error(`[MainAgent] ❌ Failed to load files from database:`, error.message);
          }
        } catch (fileError) {
          console.error(`[MainAgent] ❌ Error fetching files:`, fileError.message);
        }
      }
      
      // ✅ CRITICAL FIX: Merge fetched fileIds into params before forcing execution
      // The params from confirmation store may have empty fileIds, but we just fetched them
      const enhancedParams = {
        ...params,
        fileIds: pendingAction.fileIds || [],  // ✅ Use fetched fileIds, not the empty ones from confirmation
        attachedFiles: attachedFiles  // ✅ Also include metadata
      };
      
      console.log(`[MainAgent] 📋 Merged params for forceToolExecution:`, {
        toolName,
        hasFileIds: enhancedParams.fileIds && enhancedParams.fileIds.length > 0,
        fileIdCount: enhancedParams.fileIds ? enhancedParams.fileIds.length : 0,
        originalFileIdCount: params.fileIds ? params.fileIds.length : 0
      });
      
      const result = await agent.processQuery(query, { 
        userId,
        conversationHistory,
        conversationId,  // ✅ CRITICAL: Pass conversationId for context
        fileIds: pendingAction.fileIds || [],  // ✅ Pass fileIds array
        attachedFiles: attachedFiles,  // ✅ CRITICAL FIX: Pass file metadata
        forceToolExecution: {
          toolName,
          params: enhancedParams  // ✅ Use merged params with fileIds
        }
      });

      // Emit timeline event for agent completion
      if (timeline) {
        timeline.emitAgentCompleted(agentName, result);
      }

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
        
        // Get timeline events from current step to accumulate in chain
        const currentTimelineEvents = timeline ? timeline.getEvents() : [];
        
        const nextChainAction = confirmationStore.getNextChainAction(chainId, userId, completedResult, currentTimelineEvents);
        
        if (nextChainAction && !nextChainAction.chainComplete) {
          console.log(`[MainAgent] 🔗 Next action in chain: ${nextChainAction.nextAction.toolName}`);
          
          // Enhance the next action's params with results from this action
          // For example, if form was created, email can now include the form link
          let enhancedNextAction = nextChainAction.nextAction;
          
          // If the next action is an email, try to enhance it with the form/doc link
          // Try to enhance even if artifact is null - we can extract link from raw result
          if (enhancedNextAction.toolName === 'sendEmail' || enhancedNextAction.toolName === 'microsoft_sendEmail') {
            console.log(`[MainAgent] 📧 Enhancing email action with previous results...`);
            enhancedNextAction = await this.enhanceEmailWithPreviousResult(enhancedNextAction, completedResult, userId);
            
            // ✅ CRITICAL FIX: Update the pending action in the store with enhanced params
            console.log(`[MainAgent] 💾 Updating pending action with enhanced params`);
            confirmationStore.updatePendingActionParams(enhancedNextAction.requestId, enhancedNextAction.params, enhancedNextAction.previewContent);
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
        initialResults: initialResults || {},  // ✅ NEW: Include results from non-confirmation agents
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
      
      // Emit error event if timeline is available
      if (timeline) {
        timeline.emitError(error.message);
      }
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Enhance email params with results from previous actions in the chain
   * For example, include the form link in the email body
   * Supports both Gmail and Microsoft Outlook emails
   */
  async enhanceEmailWithPreviousResult(emailAction, previousResult, userId) {
    try {
      const { artifact, result } = previousResult;
      
      console.log(`[MainAgent] 📧 Enhancing email with previous result:`, { artifact, hasResult: !!result });
      
      // ✅ CRITICAL: Check if this email was deferred and needs complete regeneration
      if (emailAction.params._deferredGeneration) {
        console.log(`[MainAgent] 🔄 Email was deferred - REGENERATING completely with actual details`);
        
        // Extract meeting/form/doc details from result
        let itemDetails = null;
        let itemType = null;
        
        if (artifact) {
          const artifactType = artifact.type?.toLowerCase();
          
          if (artifactType === 'event' || artifactType === 'calendar_event') {
            itemType = 'meeting';
            // Extract from raw_results since artifact.data might be incomplete
            if (result.raw_results && result.raw_results[0]) {
              const eventData = result.raw_results[0];
              itemDetails = {
                eventId: eventData.eventId,
                eventLink: eventData.eventLink,
                meetLink: eventData.meetLink,
                summary: eventData.summary,
                startTime: eventData.startTime?.dateTime,
                endTime: eventData.endTime?.dateTime
              };
            }
          } else if (artifactType === 'form') {
            itemType = 'form';
            itemDetails = {
              formId: artifact.id,
              formLink: `https://docs.google.com/forms/d/${artifact.id}/viewform`,
              title: artifact.title
            };
          } else if (artifactType === 'doc' || artifactType === 'document') {
            itemType = 'document';
            itemDetails = {
              docId: artifact.id,
              docLink: `https://docs.google.com/document/d/${artifact.id}/edit`,
              title: artifact.title
            };
          }
        }
        
        if (itemDetails && itemType) {
          console.log(`[MainAgent] 📧 Regenerating ${itemType} email with details:`, itemDetails);
          
          const regeneratedEmail = await this.generateEmailFromScratch(
            emailAction.params.to,
            itemType,
            itemDetails,
            emailAction.params._originalQuery,
            userId
          );
          
          console.log(`[MainAgent] ✅ Email regenerated:`, {
            subject: regeneratedEmail.subject,
            bodyPreview: regeneratedEmail.body.substring(0, 100)
          });
          
          emailAction.params = regeneratedEmail;
          emailAction.previewContent = confirmationUtils.generatePreview(
            emailAction.agentName || 'gmail',
            emailAction.toolName || 'sendEmail',
            regeneratedEmail
          );
          
          return emailAction;
        }
      }
      
      // Original enhancement logic for non-deferred emails
      let linkToInclude = null;
      let itemDescription = '';
      let senderName = null;

      // Try to get the sender's name based on which service is being used
      try {
        if (emailAction.agentName === 'microsoft') {
          const microsoftService = require('../microsoft/microsoftService');
          const userProfile = await microsoftService.getUserProfile(userId);
          if (userProfile && userProfile.displayName) {
            senderName = userProfile.displayName;
            console.log(`[MainAgent] 📧 Got Microsoft sender name: ${senderName}`);
          }
        } else {
          // For Gmail, try to get from stored user data or use a default
          // Gmail API doesn't have a simple profile endpoint, so we'll use what's available
          senderName = null; // Will be handled by the agent
        }
      } catch (profileError) {
        console.log(`[MainAgent] ⚠️ Could not fetch sender profile:`, profileError.message);
      }

      // First try to extract from artifact if available
      if (artifact) {
        // Extract link based on artifact type (lowercase - matching ARTIFACT_TYPES)
        const artifactType = artifact.type?.toLowerCase();
        console.log(`[MainAgent] 📧 Artifact type: ${artifactType}, ID: ${artifact.id}`);
        
        // Google types
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
      // Microsoft types
      else if ((artifactType === 'word_document' || artifactType === 'word' || artifactType === 'microsoft_doc') && artifact.data?.webUrl) {
        linkToInclude = artifact.data.webUrl;
        itemDescription = `the Microsoft Word document "${artifact.title}"`;
        console.log(`[MainAgent] 📧 Found Word document link: ${linkToInclude}`);
      } else if ((artifactType === 'excel' || artifactType === 'excel_workbook') && artifact.data?.webUrl) {
        linkToInclude = artifact.data.webUrl;
        itemDescription = `the Excel spreadsheet "${artifact.title}"`;
        console.log(`[MainAgent] 📧 Found Excel workbook link: ${linkToInclude}`);
      }
      }
      
      // If no link found from artifact, try to extract from raw result
      if (!linkToInclude && result) {
        console.log(`[MainAgent] 📧 Trying to extract link from raw result...`);
        
        // Check raw_results array (common format from agents)
        if (result.raw_results && Array.isArray(result.raw_results)) {
          for (const rawResult of result.raw_results) {
            if (rawResult.webUrl) {
              linkToInclude = rawResult.webUrl;
              itemDescription = `the document "${rawResult.name || 'Document'}"`;
              console.log(`[MainAgent] 📧 Found webUrl in raw_results: ${linkToInclude}`);
              break;
            }
          }
        }
        
        // Also check result.response for embedded links
        if (!linkToInclude && result.response && typeof result.response === 'string') {
          const urlMatch = result.response.match(/https:\/\/[^\s\)]+/);
          if (urlMatch) {
            linkToInclude = urlMatch[0];
            // Try to extract document name from response
            const nameMatch = result.response.match(/\*\*Name:\*\*\s*([^\n]+)/);
            itemDescription = `the document "${nameMatch ? nameMatch[1].trim() : 'Document'}"`;
            console.log(`[MainAgent] 📧 Extracted link from response: ${linkToInclude}`);
          }
        }
      }

      if (linkToInclude && emailAction.params) {
        // Use AI to regenerate the email body with the actual link
        console.log(`[MainAgent] 📧 Enhancing email with link: ${linkToInclude}`);
        
        const enhancedParams = await this.regenerateEmailWithLink(
          emailAction.params,
          linkToInclude,
          itemDescription,
          userId,
          senderName
        );
        
        emailAction.params = enhancedParams;
        
        // Use correct preview generator based on agent
        const agentForPreview = emailAction.agentName || 'gmail';
        const toolForPreview = emailAction.toolName || 'sendEmail';
        emailAction.previewContent = confirmationUtils.generatePreview(
          agentForPreview,
          toolForPreview,
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
   * Generate email from scratch with actual details from previous action
   * Used when email generation was deferred until dependency completed
   */
  async generateEmailFromScratch(recipientEmail, itemType, itemDetails, originalQuery, userId) {
    try {
      // ✅ CRITICAL: Detect language from the original query using LLM
      const languageDetection = require('../utils/languageDetection');
      const detectedLanguage = await languageDetection.detectLanguage(originalQuery);
      const languageInstruction = languageDetection.getLanguageInstruction(detectedLanguage);
      const languageName = languageDetection.getLanguageName(detectedLanguage);
      console.log(`[MainAgent] 🌐 generateEmailFromScratch using language: ${languageName} (${detectedLanguage})`);
      
      const recipientName = recipientEmail.split('@')[0].replace(/[0-9]/g, '');
      const capitalizedRecipient = recipientName.charAt(0).toUpperCase() + recipientName.slice(1);
      
      // Get sender name
      let senderName = 'the sender';
      try {
        const supabase = require('../supabase/supabaseConnect');
        const { data: calendarData } = await supabase
          .from('calendar_tokens')
          .select('name')
          .eq('user_id', userId)
          .single();
        if (calendarData?.name) {
          senderName = calendarData.name;
        }
      } catch (err) {
        // Use default
      }
      
      let prompt;
      if (itemType === 'meeting') {
        const startDate = new Date(itemDetails.startTime);
        const endDate = new Date(itemDetails.endTime);
        const formattedDate = startDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        const formattedTime = `${startDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })} - ${endDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })}`;
        
        prompt = `Write a professional meeting invitation email.

Recipient: ${capitalizedRecipient} (${recipientEmail})
Meeting Title: ${itemDetails.summary}
Date: ${formattedDate}
Time: ${formattedTime}
Google Meet Link: ${itemDetails.meetLink}
Calendar Link: ${itemDetails.eventLink}
Sender: ${senderName}

Requirements:
1. Subject MUST say "Meeting Invitation" NOT "Document"
2. Body MUST invite to a meeting, NOT share a document
3. Include both the Google Meet link and calendar link
4. Professional and friendly tone
5. Use actual sender name (${senderName}), not placeholders

Return ONLY valid JSON:
{
  "subject": "Meeting Invitation: [brief title]",
  "body": "Professional meeting invitation with both links"
}`;
      } else if (itemType === 'form') {
        prompt = `Write a professional email to share a Google Form.

Recipient: ${capitalizedRecipient} (${recipientEmail})
Form Title: ${itemDetails.title}
Form Link: ${itemDetails.formLink}
Sender: ${senderName}

Return ONLY valid JSON:
{
  "subject": "Form Shared: ${itemDetails.title}",
  "body": "Professional email with form link"
}`;
      } else {
        prompt = `Write a professional email to share a document.

Recipient: ${capitalizedRecipient} (${recipientEmail})
Document Title: ${itemDetails.title}
Document Link: ${itemDetails.docLink}
Sender: ${senderName}

Return ONLY valid JSON:
{
  "subject": "Document Shared: ${itemDetails.title}",
  "body": "Professional email with document link"
}`;
      }
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a professional email writer. Return only valid JSON. Use actual names, not placeholders.\n\n' + languageInstruction },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      });
      
      const emailContent = JSON.parse(response.choices[0].message.content);
      
      return {
        to: recipientEmail,
        subject: emailContent.subject,
        body: emailContent.body,
        isAIGenerated: true,
        userName: senderName
      };
    } catch (error) {
      console.error('[MainAgent] Error generating email from scratch:', error);
      // Fallback
      return this.getMeetingInvitationFallback(recipientEmail, itemDetails.meetLink || itemDetails.formLink || itemDetails.docLink, itemDetails.summary || itemDetails.title, 'the sender');
    }
  }

  /**
   * Regenerate email body to include the actual link from the previous action
   */
  async regenerateEmailWithLink(emailParams, link, itemDescription, userId, senderName = null) {
    try {
      // Extract recipient's first name for personalized greeting
      const recipientEmail = emailParams.to;
      const recipientName = recipientEmail.split('@')[0].split('.')[0];
      const capitalizedRecipient = recipientName.charAt(0).toUpperCase() + recipientName.slice(1);
      
      // ✅ CRITICAL: Detect if this is a meeting invitation
      const isMeetingInvitation = itemDescription.includes('Google Meet') || 
                                  itemDescription.includes('calendar event') ||
                                  link.includes('meet.google.com') ||
                                  link.includes('calendar/event');
      
      console.log(`[MainAgent] 📧 Email type: ${isMeetingInvitation ? 'MEETING INVITATION' : 'DOCUMENT SHARING'}`);
      
      let prompt;
      if (isMeetingInvitation) {
        // ✅ Meeting invitation prompt
        prompt = `Write a PROFESSIONAL meeting invitation email.

Recipient Email: ${emailParams.to}
Recipient Name: ${capitalizedRecipient}
Meeting: ${itemDescription}
Meeting Link: ${link}
Sender's Name: ${senderName || 'the sender'}

CRITICAL REQUIREMENTS:
1. Subject MUST say "Meeting Invitation" NOT "Document Shared":
   - GOOD: "Meeting Invitation: Tomorrow at 5 PM"
   - GOOD: "Invitation to Meeting"
   - BAD: "Document Shared" or "Sharing Document"

2. Email body MUST be about a MEETING, NOT a document:
   - Say "I'd like to invite you to a meeting"
   - Include the meeting link
   - Mention it's a meeting/video call
   - DO NOT say "sharing a document" or "document attached"

3. Email structure:
   - Personalized greeting: "Hi ${capitalizedRecipient},"
   - Opening: "I hope this message finds you well."
   - Meeting invitation (2-3 sentences)
   - The meeting link clearly displayed
   - Call to action to join
   - Professional closing
   - Sign-off with ACTUAL sender name

4. NEVER use placeholders like "[Your Name]" - use the actual sender name

Return ONLY a JSON object:
{
  "to": "${emailParams.to}",
  "subject": "Meeting Invitation: [brief title]",
  "body": "Complete professional meeting invitation email"
}`;
      } else {
        // Document sharing prompt
        prompt = `Write a PROFESSIONAL business email to share ${itemDescription}.

Recipient Email: ${emailParams.to}
Recipient Name: ${capitalizedRecipient}
Item Being Shared: ${itemDescription}
Link to Include: ${link}
Original Context/Purpose: ${emailParams.subject || emailParams.body}
Sender's Name: ${senderName || 'the sender'}

CRITICAL REQUIREMENTS:
1. Subject MUST be professional and descriptive (NOT just a filename):
   - BAD: "students" or "document"
   - GOOD: "Sharing Excel Workbook: Students Data" or "Document Shared: Project Notes"

2. Email body MUST have this structure:
   - Personalized greeting: "Hi ${capitalizedRecipient},"
   - Opening: "I hope this message finds you well."
   - Purpose paragraph (2-3 sentences explaining what and why)
   - The link clearly displayed
   - Call to action
   - Professional closing
   - Sign-off with ACTUAL sender name (not [Your Name])

3. Use proper line breaks between paragraphs
4. NEVER use placeholders like "[Your Name]" - use the actual sender name

Return ONLY a JSON object:
{
  "to": "${emailParams.to}",
  "subject": "Professional descriptive subject",
  "body": "Complete professional email body with proper formatting"
}`;
      }

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: isMeetingInvitation 
              ? 'You are a professional meeting invitation email writer. Write polished meeting invitations. Return only valid JSON. NEVER mention "document" in meeting invitations. NEVER use placeholders like [Your Name].'
              : 'You are a professional business email writer. Write polished, well-structured emails. Return only valid JSON. NEVER use placeholders like [Your Name] - use the actual sender name provided.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      });

      const updatedEmail = JSON.parse(response.choices[0].message.content);
      
      // ✅ Validate meeting invitation doesn't mention "document"
      if (isMeetingInvitation) {
        if (updatedEmail.subject && updatedEmail.subject.toLowerCase().includes('document')) {
          console.log(`[MainAgent] ⚠️ LLM generated subject with "document", fixing...`);
          updatedEmail.subject = `Meeting Invitation: ${itemDescription.replace('the Google Meet "', '').replace('"', '')}`;
        }
        if (updatedEmail.body && updatedEmail.body.toLowerCase().includes('sharing the document')) {
          console.log(`[MainAgent] ⚠️ LLM generated body with "document", regenerating...`);
          // Use fallback template
          return this.getMeetingInvitationFallback(recipientEmail, link, itemDescription, senderName);
        }
      }
      
      return {
        ...emailParams,
        ...updatedEmail
      };
    } catch (error) {
      console.error('[MainAgent] Error regenerating email with link:', error);
      
      // Fallback based on type
      const recipientEmail = emailParams.to;
      const recipientName = recipientEmail.split('@')[0].split('.')[0];
      const capitalizedRecipient = recipientName.charAt(0).toUpperCase() + recipientName.slice(1);
      
      const isMeetingInvitation = itemDescription.includes('Google Meet') || 
                                  itemDescription.includes('calendar event') ||
                                  link.includes('meet.google.com') ||
                                  link.includes('calendar/event');
      
      if (isMeetingInvitation) {
        return this.getMeetingInvitationFallback(recipientEmail, link, itemDescription, senderName);
      } else {
        return {
          ...emailParams,
          subject: `Sharing: ${itemDescription}`,
          body: `Hi ${capitalizedRecipient},\n\nI hope this message finds you well.\n\nI'm sharing ${itemDescription} with you for your review.\n\n📎 Link: ${link}\n\nPlease feel free to reach out if you have any questions.\n\nBest regards,\n${senderName || 'Regards'}`
        };
      }
    }
  }

  /**
   * Fallback template for meeting invitations
   */
  getMeetingInvitationFallback(recipientEmail, meetingLink, itemDescription, senderName) {
    const recipientName = recipientEmail.split('@')[0].split('.')[0];
    const capitalizedRecipient = recipientName.charAt(0).toUpperCase() + recipientName.slice(1);
    
    return {
      to: recipientEmail,
      subject: `Meeting Invitation`,
      body: `Hi ${capitalizedRecipient},\n\nI hope this message finds you well!\n\nI'd like to invite you to a meeting. Please join using the link below:\n\n🔗 Join Meeting: ${meetingLink}\n\nLooking forward to connecting with you!\n\nBest regards,\n${senderName || 'Regards'}`
    };
  }

  /**
   * Enrich a sequential agent's query with concrete data from previous agent results.
   * For example, if calendar created a Google Meet, inject the real meet link
   * into the gmail query so the email contains the actual URL.
   */
  async _enrichQueryWithPreviousResults(agentQuery, agentName, previousResults, userId) {
    try {
      // Enrich queries for agents that can use previous results
      // Email agents: gmail, microsoft
      // Document agents: docs, forms, sheets
      // Calendar agents: calendar
      const enrichableAgents = ['gmail', 'microsoft', 'docs', 'forms', 'sheets', 'calendar'];
      
      if (!enrichableAgents.includes(agentName)) {
        return agentQuery;
      }

      // Collect links and data from all previous results
      const collectedData = [];
      let websearchResults = null;

      for (const [prevAgent, prevResult] of Object.entries(previousResults)) {
        if (!prevResult || !prevResult.success) continue;

        // ✅ CRITICAL FIX: Handle websearch results as STRUCTURED DATA
        if (prevAgent === 'websearch') {
          console.log(`[MainAgent] 📰 Found websearch results for ${agentName}`);
          console.log(`[MainAgent] 🔍 Websearch result structure:`, JSON.stringify(prevResult, null, 2).substring(0, 500));
          
          // ✅ FIX: Check both raw_results (old format) and executedActions (new format)
          let rawResults = prevResult.raw_results || [];
          
          // If raw_results is empty, check executedActions
          if (rawResults.length === 0 && prevResult.executedActions && Array.isArray(prevResult.executedActions)) {
            console.log(`[MainAgent] � raw_results empty, checking executedActions...`);
            rawResults = prevResult.executedActions.map(action => action.result);
          }
          
          console.log(`[MainAgent] 📦 Raw results count: ${rawResults.length}`);
          
          for (const rawResult of rawResults) {
            console.log(`[MainAgent] 🔍 Checking raw result keys:`, Object.keys(rawResult));
            
            // Check if this is synthesized research content
            if (rawResult.synthesizedContent) {
              console.log(`[MainAgent] 🧠 Found synthesized research content (${rawResult.synthesizedContent.length} chars)`);
              websearchResults = {
                type: 'research_result',
                content: rawResult.synthesizedContent,
                sources: rawResult.sources || [],
                sourcesUsed: rawResult.sourcesUsed || 0
              };
              break;
            }
            // Fallback: check for topResults (old format)
            else if (rawResult.topResults) {
              console.log(`[MainAgent] 📋 Found search results (old format)`);
              websearchResults = {
                type: 'search_results',
                results: rawResult.topResults.slice(0, 5)
              };
            }
          }
          
          console.log(`[MainAgent] 🎯 Websearch results extracted:`, websearchResults ? 'YES' : 'NO');
          
          // ✅ CRITICAL: For docs/forms/sheets, pass STRUCTURED DATA not text instructions
          if (['docs', 'forms', 'sheets'].includes(agentName) && websearchResults) {
            if (websearchResults.type === 'research_result') {
              // Pass synthesized content as structured data
              console.log(`[MainAgent] 📄 Passing synthesized research to ${agentName} as structured data`);
              console.log(`[MainAgent] 📄 Content length: ${websearchResults.content.length} chars`);
              console.log(`[MainAgent] 📄 Content preview: ${websearchResults.content.substring(0, 200)}...`);
              return {
                query: agentQuery,
                researchContent: {
                  type: 'research_result',
                  content: websearchResults.content,
                  sources: websearchResults.sources,
                  contentProvided: true  // Signal to agent: render mode, don't regenerate
                }
              };
            }
          }
          
          continue; // Don't try to extract links from websearch
        }

        // Extract links from raw_results
        if (prevResult.raw_results && Array.isArray(prevResult.raw_results)) {
          for (const raw of prevResult.raw_results) {
            // Google Meet / Calendar
            if (raw.hangoutLink) {
              collectedData.push({ type: 'Google Meet', link: raw.hangoutLink, title: raw.event?.summary || 'Meeting' });
            }
            if (raw.htmlLink && !raw.hangoutLink) {
              collectedData.push({ type: 'Calendar Event', link: raw.htmlLink, title: raw.event?.summary || 'Event' });
            }
            // Google Forms (support both url and formUrl fields)
            if (raw.url && raw.formId) {
              collectedData.push({ type: 'Google Form', link: raw.url, title: raw.title || 'Form' });
            } else if (raw.formUrl) {
              collectedData.push({ type: 'Google Form', link: raw.formUrl, title: raw.formTitle || 'Form' });
            }
            // Google Docs
            if (raw.documentUrl) {
              collectedData.push({ type: 'Google Doc', link: raw.documentUrl, title: raw.title || 'Document' });
            }
            // Google Sheets
            if (raw.spreadsheetUrl) {
              collectedData.push({ type: 'Google Sheet', link: raw.spreadsheetUrl, title: raw.title || 'Spreadsheet' });
            }
            // Microsoft
            if (raw.webUrl) {
              collectedData.push({ type: 'Document', link: raw.webUrl, title: raw.name || 'Document' });
            }
          }
        }

        // Also try extracting URLs from the response text as fallback
        if (collectedData.length === 0 && prevResult.response && typeof prevResult.response === 'string') {
          const urlMatches = prevResult.response.match(/https:\/\/[^\s\)\]]+/g);
          if (urlMatches) {
            for (const url of urlMatches) {
              if (url.includes('meet.google.com')) {
                collectedData.push({ type: 'Google Meet', link: url, title: 'Meeting' });
              } else if (url.includes('docs.google.com/forms')) {
                collectedData.push({ type: 'Google Form', link: url });
              } else if (url.includes('docs.google.com/document')) {
                collectedData.push({ type: 'Google Doc', link: url });
              } else if (url.includes('docs.google.com/spreadsheets')) {
                collectedData.push({ type: 'Google Sheet', link: url });
              } else if (url.includes('google.com/calendar')) {
                collectedData.push({ type: 'Calendar Event', link: url });
              }
            }
          }
        }
      }

      // If no links and no websearch results, return original query
      if (collectedData.length === 0 && !websearchResults) {
        return agentQuery;
      }

      // Get sender's display name
      let senderName = '';
      try {
        const supabase = require('../supabase/supabaseConnect');
        const { data: calendarData } = await supabase
          .from('calendar_tokens')
          .select('name')
          .eq('user_id', userId)
          .single();
        if (calendarData?.name) {
          senderName = calendarData.name;
        }
        if (!senderName) {
          const { data: userData } = await supabase.auth.admin.getUserById(userId);
          if (userData?.user) {
            senderName = userData.user.user_metadata?.full_name ||
                         userData.user.user_metadata?.name || '';
          }
        }
      } catch (e) {
        console.log(`[MainAgent] Could not fetch sender name: ${e.message}`);
      }

      // Build enrichment context for email agents
      let enrichmentText = '';
      
      // Add links if any
      if (collectedData.length > 0) {
        const linksText = collectedData.map(d => `- ${d.type}: ${d.link}${d.title ? ` (${d.title})` : ''}`).join('\n');
        enrichmentText += `The following items were just created and their links MUST be included in the email:\n${linksText}\n\n`;
      }
      
      // Add websearch results for email agents (not docs)
      if (websearchResults && ['gmail', 'microsoft'].includes(agentName)) {
        enrichmentText += `WEB SEARCH RESULTS TO INCLUDE IN EMAIL:\n`;
        
        if (websearchResults.type === 'research_result') {
          enrichmentText += `Summary: ${websearchResults.content}\n\n`;
          if (websearchResults.sources && websearchResults.sources.length > 0) {
            enrichmentText += `Sources:\n`;
            websearchResults.sources.forEach((source, index) => {
              enrichmentText += `${index + 1}. ${source.title} - ${source.url}\n`;
            });
          }
        } else if (websearchResults.results) {
          enrichmentText += `Top Results:\n`;
          websearchResults.results.forEach((result, index) => {
            enrichmentText += `${index + 1}. ${result.title}\n`;
            if (result.snippet) enrichmentText += `   ${result.snippet}\n`;
            if (result.link) enrichmentText += `   Link: ${result.link}\n`;
            enrichmentText += `\n`;
          });
        }
      }

      const enrichedQuery = `${agentQuery}

IMPORTANT CONTEXT FROM PREVIOUS ACTION:
${enrichmentText}
Include the information above in the email body with proper formatting.
${collectedData.length > 0 ? 'Include the actual link(s) — do NOT use placeholders like "[Link]".' : ''}
${senderName ? `The sender's name is "${senderName}" — use it in the sign-off instead of "[Your Name]".` : ''}`;

      console.log(`[MainAgent] ✅ Enriched ${agentName} query with ${collectedData.length} link(s) and ${websearchResults ? 'websearch results' : 'no websearch results'}`);
      return enrichedQuery;

    } catch (error) {
      console.error(`[MainAgent] Error enriching query:`, error);
      return agentQuery;
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
          const updatedParams = await this.extractEmailParamsWithAI(query, userId, conversationHistory);
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

**WebSearchAgent**: Web search operations (via Serper API)
- Search the web for information, websites, and articles
- Search for recent news articles and current events
- Search for images and visual content
- Get answer boxes and knowledge graphs
- Find related searches and "People Also Ask" questions
- Support for localized and multi-language searches

**MicrosoftAgent**: Microsoft 365 operations (Outlook, Calendar, OneDrive, Excel)
- Outlook: Send, read, reply to, and forward emails via Microsoft/Outlook
- Microsoft Calendar: Create, list, update, and delete calendar events with Teams meeting support
- OneDrive: List, search, upload, and download files
- Excel: Read and write to Excel workbooks stored in OneDrive
- User profile: Get Microsoft 365 account information

Use MicrosoftAgent when user specifically mentions Microsoft, Outlook, OneDrive, Excel, Teams, or Microsoft Calendar.
Distinguish between Google services (Gmail, Google Calendar, Google Sheets) and Microsoft services (Outlook, Microsoft Calendar, OneDrive, Excel).

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

**RESPONSE FORMATTING**:
Your responses are rendered with full Markdown support. Use rich formatting to make your answers clear and visually appealing:

1. Use headings (## and ###) to create clear sections and visual hierarchy
2. Use **bold** for emphasis on key terms, names, or important details
3. Use bullet points (-) and numbered lists (1.) for structured information
4. Use \`inline code\` for technical terms, file names, commands, and variable names
5. Use fenced code blocks (\`\`\`language) with the language specified for code snippets
6. Use tables (| col1 | col2 |) when comparing items or showing structured data
7. Use blockquotes (>) for important callouts or notes
8. Use emoji/icons to enhance readability:
   - ✅ for success, completion, or working items
   - ❌ for errors, failures, or issues
   - ⚠️ for warnings or important cautions
   - 📄 for documents or files
   - 🖼️ for images
   - 💡 for tips or suggestions
   - 🔧 for tools, settings, or configuration
   - 📊 for data or statistics
   - 🚀 for performance or launch
   - 🔒 for security or privacy
   - ⏱️ for time or duration
9. Keep paragraphs concise; use blank lines between sections
10. Never mention that you are using markdown formatting — just use it naturally

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

Remember: Artifacts are preserved within a conversation thread. Use this context to provide seamless multi-step interactions.

**MULTI-LANGUAGE SUPPORT**:
You support ALL languages. Always detect the EXACT language of the user's message and respond in the SAME language.

Language Detection Rules:
1. CAREFULLY distinguish between similar languages. Do NOT default to Hindi for all Indian languages:
   - Marathi: words like "kara", "navane", "mhanje", "aahe", "karayche", "zala", "tya" → respond in Marathi
   - Hindi: words like "karo", "naam", "hai", "karna", "hua", "uska" → respond in Hindi
   - Tamil, Telugu, Gujarati, Bengali, etc. each have distinct vocabulary — identify them accurately
   - Similarly: distinguish Portuguese vs Spanish, Czech vs Slovak, etc.
2. MATCH THE SCRIPT the user used:
   - If user writes in Romanized/Latin script (e.g., "google docs taiyarr kara"), respond in the SAME Romanized/Latin script of that language (e.g., "Tumcha document tayaar zala ahe!")
   - If user writes in native script (e.g., Devanagari "गूगल डॉक्स बनवा"), respond in native script
   - NEVER convert Romanized input to a native script — always mirror the user's script choice
3. Technical terms, product names (Google Docs, Gmail, etc.), URLs, and identifiers can remain in English
4. Markdown formatting should still be used regardless of language
5. Keep the same helpful, friendly tone in whatever language the user uses`;
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
  async analyzeQuery(query, conversationHistory = [], artifactContext = null, memoryContext = '', fileContext = null, detectedLanguage = 'en') {
    try {
      const lowerQuery = query.toLowerCase();
      
      // Get language instruction for LLM
      const languageDetection = require('../utils/languageDetection');
      const languageInstruction = languageDetection.getLanguageInstruction(detectedLanguage);
      const languageName = languageDetection.getLanguageName(detectedLanguage);
      console.log(`[MainAgent] 🌐 analyzeQuery using language: ${languageName} (${detectedLanguage})`);
      
      // Use LLM-based intent classifier instead of regex
      const intentClassifier = new IntentClassifier();
      const intentClassification = await intentClassifier.classify(query, conversationHistory);
      
      console.log(`[MainAgent] 🎯 Intent Classification:`, JSON.stringify(intentClassification, null, 2));

      // ============================================================
      // ✅ VALIDATE URLs IN QUERY (BEFORE AGENT ROUTING)
      // ============================================================
      const URLValidator = require('../utils/urlValidation');
      const urlValidation = URLValidator.validateURLsInQuery(query);
      
      if (urlValidation.hasURLs && !urlValidation.isValid) {
        console.log('[MainAgent] ❌ URL validation failed:', urlValidation.invalidURLs);
        
        const errorMessage = URLValidator.formatValidationErrors(urlValidation.invalidURLs);
        
        // Return error immediately (don't proceed to agent routing)
        return {
          agents: [],
          reasoning: 'URL validation failed - invalid or malformed URL detected',
          error: errorMessage,
          validationError: true
        };
      }
      
      if (urlValidation.hasURLs && urlValidation.isValid) {
        console.log('[MainAgent] ✅ URL validation passed:', urlValidation.urls.map(u => u.originalURL));
      }

      // Handle web search queries - BUT check if it's part of a multi-step request
      if (intentClassification.type === 'web_search' || intentClassification.requiresWebSearch) {
        // Check if query also contains other actions (e.g., "search for X and email it")
        const hasAdditionalActions = /\b(and|then)\s+(send|email|share|create|schedule|add|make|put)/i.test(query);
        
        if (hasAdditionalActions) {
          console.log('[MainAgent] 🔗 Web search query with additional actions - using full LLM analysis');
          // Don't return early - let LLM analyze the full multi-step query below
        } else {
          console.log('[MainAgent] 🌐 Detected standalone web search query - routing to websearch agent:', query);
          return {
            agents: ['websearch'],
            reasoning: "User is asking for current/real-time information that requires web search",
            queries: {
              websearch: query
            }
          };
        }
      }

      // Handle deep research queries
      if (intentClassification.type === 'deep_research' || intentClassification.requiresDeepResearch) {
        console.log('[MainAgent] 🔬 Detected deep research query - routing to research agent:', query);
        return {
          agents: ['research'],
          reasoning: "User is asking for comprehensive, in-depth research with analysis",
          queries: {
            research: query
          }
        };
      }

      // Handle conversational queries
      if (intentClassification.type === 'conversational') {
        console.log('[MainAgent] 🎯 Detected conversational query - skipping agents:', query);
        return {
          agents: [],
          reasoning: "User is asking about past conversation or information - no agents needed"
        };
      }

      // Handle file generation requests
      if (intentClassification.type === 'file_generation') {
        console.log('[MainAgent] 📄 Detected file generation request - skipping agents, will generate content and convert to file:', query);
        return {
          agents: [],
          reasoning: "User requested file generation (PDF/TXT). The AI-generated content will be automatically converted to the requested file format.",
          skipAgents: true
        };
      }

      // Handle advisory queries (general knowledge, guidance, planning)
      // ✅ CRITICAL: Route to conversational agent for high-quality LLM responses
      if (intentClassification.type === 'advisory' || intentClassification.isConversational === true) {
        console.log('[MainAgent] 💡 Detected advisory/planning query - routing to conversational agent:', query);
        return {
          agents: ['conversational'],
          queries: {
            conversational: query
          },
          reasoning: "User is asking for advice, guidance, or planning help - routing to conversational agent for high-quality LLM response",
          requiresSequential: false
        };
      }

      // Handle file-related queries with attached files
      if (fileContext && fileContext.filesProcessed > 0) {
        // Check if this is a query about the attached files
        const fileQueryPatterns = [
          /\b(read|summarize|summarise|analyze|analyse|explain|describe|review|look at|check|examine|inspect|parse|interpret|translate)\b.*\b(this|the|my|attached|uploaded)\b.*\b(file|document|pdf|image|photo|picture|attachment|code|text|content|data)/i,
          /\b(what|tell|show)\b.*\b(this|the|my|attached|uploaded)\b.*\b(file|document|pdf|image|photo|picture|attachment|code)\b.*\b(contain|about|say|have|include)/i,
          /\b(what)\b.*\b(in|inside|contain|about)\b.*\b(this|the|my)\b.*\b(file|document|pdf|image|photo|picture|attachment)/i,
          /\b(read|summarize|summarise|analyze|analyse|explain|review)\b.*\b(this|it|the file|the document|the pdf)/i,
          /\b(what does|what's in|what is in)\b.*\b(this|the|it)/i,
          /\b(tell me|what)\b.*\b(it contains|it says|it includes|file contains|document contains)/i,
          /\b(extract|pull out|get|find)\b.*\b(from|in)\b.*\b(this|the|my)\b.*\b(file|document|pdf)/i,
          /^(read this|summarize this|analyze this|explain this|what is this|describe this)/i,
          /^(read it|summarize it|analyze it|explain it|what does it contain)/i
        ];

        const isFileQuery = fileQueryPatterns.some(pattern => pattern.test(query));
        
        if (isFileQuery) {
          console.log('[MainAgent] 📎 Detected file-related query with attached files - skipping agents, using file context');
          return {
            agents: [],
            reasoning: `User is asking about attached file(s). ${fileContext.filesProcessed} file(s) are attached and their content is available in context - no agents needed, will answer directly from file content.`
          };
        }
      }

      // If we reach here, it's an actionable query - proceed with agent routing using LLM-based routing
      if (intentClassification.type !== 'actionable') {
        console.log('[MainAgent] ⚠️ Intent type:', intentClassification.type);
        // Still proceed - let LLM routing handle edge cases
      }

      // ========================================================================
      // PURE LLM-BASED AGENT ROUTING (NO PATTERN MATCHING)
      // ========================================================================
      // Use a SIMPLE, CLEAN prompt that leverages the IntentClassification result
      // Eliminates all the heuristics and pattern matching - just reasoning
      
      let artifactSection = '';
      if (artifactContext && artifactContext.allArtifacts && artifactContext.allArtifacts.length > 0) {
        artifactSection = `\n\nCONVERSATION ARTIFACTS:
${artifactContext.allArtifacts.map(a => `- [${a.type.toUpperCase()}] "${a.title}" (ID: ${a.id})`).join('\n')}`;
      }

      let memorySection = '';
      if (memoryContext && memoryContext.length > 0) {
        memorySection = `\n\nLONG-TERM USER MEMORIES:\n${memoryContext}`;
      }

      let conversationSection = '';
      if (conversationHistory && conversationHistory.length > 0) {
        const recentHistory = conversationHistory.slice(-4);
        const historyText = recentHistory.map(msg => 
          `${msg.role === 'user' ? 'User' : 'Assistant'}: ${String(msg.content).substring(0, 300)}`
        ).join('\n');
        conversationSection = `\n\nRECENT CONTEXT:\n${historyText}`;
      }

      const routingPrompt = `You are an expert at routing user queries to specialized agents based on their intent.

User Query: "${query}"
Intent Classification: ${JSON.stringify(intentClassification)}
${conversationSection}
${artifactSection}
${memorySection}

AVAILABLE AGENTS AND THEIR CAPABILITIES:

- **calendar**: Google Calendar operations (events, meetings, schedules)
  * Use for: "create event", "schedule meeting", "add to calendar", "show my events"
  * IMPORTANT: Calendar agent can create events WITH Google Meet video conferencing attached
  
- **docs**: Google Docs operations (create/edit documents, text formatting)
  * Use for: "create document", "write doc", "add to doc", "list my docs", "show my documents"
  
- **forms**: Google Forms operations (create forms, manage questions, view responses)
  * Use for: "create form", "create survey", "make questionnaire", "add form question"
  
- **github**: GitHub operations (repos, commits, issues, PRs, profile)
  * Use for: "create repo", "commit code", "create issue", "show repos", "pull request"
  
- **gmail**: Gmail operations (send/read/search emails, drafts, labels, filters)
  * Use for: "send email" (default), "check gmail", "read email", "list my emails", "search emails"
  * Use for: Sending emails with links (documents, forms, meetings, etc.)
  * Use ONLY when user explicitly mentions "Gmail" or wants to use Google email services
  * Special: When user asks "send google meet link to X" → This triggers gmail agents after meet is created
  
- **meet**: Google Meet operations (create standalone meeting spaces, recordings, participants, meeting history)
  * Use for: "create google meet", "create meeting room", "show meetings", "list past meetings", "view recordings", "who joined meeting", "retrieve meeting history"
  * IMPORTANT: Use for creating STANDALONE Google Meet rooms (no scheduled time)
  * IMPORTANT: Use for retrieving past Google Meet conference records (via Meet API)
  * IMPORTANT: "create google meet" (no time) → meet agent (creates standalone meeting space)
  * IMPORTANT: "list my past Google Meet meetings" → meet agent (gets actual conference records)
  * IMPORTANT: "show meeting history" or "who attended my meetings" → meet agent
  * Do NOT use for scheduled meetings WITH TIME - use calendar agent instead
  * Special: When user asks "create google meet and send link to X" → meet + gmail agents (multi-step action chain)
  
- **sheets**: Google Sheets operations (create/edit spreadsheets, data management)
  * Use for: "create spreadsheet", "create sheet", "add data to sheet", "list sheets"
  
- **flights**: Flight search operations
  * Use for: "find flights", "compare prices", "search flights", "cheapest flights"
  
- **maps**: Google Maps operations (places, directions, distance, geocoding, nearby search)
  * Use for: "find restaurants", "directions to", "distance between", "nearby hotels", "coordinates"
  
- **websearch**: Web search operations (quick searches, current information, news)
  * Use for: "what's latest", "search for", "find information about", "current news"
  * Use for QUICK searches and basic information lookup
  * Use ONLY for CURRENT/REAL-TIME/UP-TO-DATE information, NOT for user's personal data
  * CRITICAL: Never use websearch for "my docs", "my emails", "my calendar" - use specific agent

- **research**: Deep research operations (comprehensive multi-step research with synthesis)
  * Use for: "do deep research on", "comprehensive research", "detailed analysis", "research and analyze"
  * Use for: "what are the best", "compare and analyze", "in-depth information about"
  * Triggers: "deep research", "comprehensive", "detailed", "analyze", "compare multiple", "best options"
  * This performs Perplexity-style multi-step research with source citations
  * Use when user needs thorough, well-researched answers with multiple sources
  
- **microsoft**: Microsoft 365 operations (Outlook Mail, Calendar, OneDrive, Excel, Teams, Word)
  * Use for: "send via outlook", "outlook email", "microsoft calendar", "onedrive files", "teams chat", "word document"
  * Use when user mentions: "Outlook", "Microsoft", "OneDrive", "Excel", "Teams", "Word"
  
- **weather**: Weather and air quality operations
  * Use for: "what's weather", "temperature in", "will it rain", "air quality"
  
- **schedules**: Reminders and scheduled actions
  * Use for: "remind me to", "set reminder", "schedule reminder"
  * IMPORTANT: Use for REMINDERS (notifications), use calendar for MEETINGS/EVENTS

CRITICAL ROUTING RULES:

RULE 1: USER PERSONAL DATA QUERIES
- "list my docs", "show my emails", "my calendar events" → Use docs/gmail/calendar/microsoft agent
- "my most recent X", "my latest X" where X is user's data → Use specific agent, NEVER websearch
- These are fetches from user's account, not web searches

RULE 2: WEB SEARCH vs PERSONAL DATA
- "what's latest AI news" → websearch (external info)
- "show my recent docs" → docs agent (user's data)
- NEVER confuse these - they route to completely different places

RULE 3: WEATHER QUERIES
- "what's weather", "temperature", "rain", "air quality" → weather agent, NOT websearch
- Weather has dedicated agent - don't route to web search

RULE 4: EMAIL ROUTING BY SERVICE
- "send email via outlook" + "outlook" mentioned → microsoft agent
- "send email via gmail" + "gmail" mentioned → gmail agent
- "send email" (no service specified) → gmail agent (default)

RULE 5: GOOGLE MEET ROUTING
- "create google meet tomorrow at 3pm" → calendar agent (scheduled meeting)
- "create google meet and send link to X@email.com" → meet + gmail agents (multi-step action chain)
- "create meeting room" (no time) → meet agent (standalone space)
- "list my past Google Meet meetings" → meet agent (retrieve conference records)
- "show meeting history" or "who joined my meeting" → meet agent (meeting data retrieval)
- Scheduled meetings with time → ALWAYS calendar (adds Meet automatically)
- Standalone meet creation + email sending → BOTH meet and gmail agents with action chain
- Past meeting history/recordings → ALWAYS meet agent (conference records from Meet API)

RULE 6: MULTI-INTENT QUERIES (Sequential Execution)
- "search for X and email it" → websearch + gmail agents, sequential
- "find X and add to calendar" → websearch + calendar agents, sequential
- "create form and send link" → forms + gmail agents, sequential
- Pattern: [action1] X [and/then] [action2] → Use both agents with requiresSequential: true

RULE 7: SCHEDULE vs CALENDAR
- "remind me to check price tomorrow at 2pm" → schedules agent (reminder)
- "schedule meeting tomorrow at 2pm" → calendar agent (calendar event)
- Reminders ≠ Calendar events - they use different agents

RULE 8: ARTIFACT-QUERY MATCHING (CRITICAL)
- When user has previously created a document and asks to modify/add to it:
  * If artifact type is "word_document" or "onedrive_file" → ALWAYS use "microsoft" agent
  * If artifact type is "doc" → ALWAYS use "docs" agent
  * If artifact type is "sheet" → ALWAYS use "sheets" agent
  * DO NOT route to Docs agent for Microsoft documents
  * DO NOT route to Microsoft agent for Google Docs documents
  * MATCH THE ORIGINAL SERVICE THAT CREATED THE ARTIFACT
- Example: User creates Word doc "final year project review", then asks "add content" → microsoft agent (NOT docs agent)
- Example: User creates Google Doc "report", then asks "add information" → docs agent (NOT microsoft agent)

EXAMPLES:

User Data Fetch (use specific agent):
- "list my docs" → {"agents": ["docs"], ...}
- "show my recent emails" → {"agents": ["gmail"], ...}
- "my calendar events" → {"agents": ["calendar"], ...}

Web Search (use websearch):
- "what's latest Tesla news" → {"agents": ["websearch"], ...}
- "tell me about recent AI summits" → {"agents": ["websearch"], ...}
- "do you know about Bitcoin prices" → {"agents": ["websearch"], ...}

Creation/Action:
- "create a document" → {"agents": ["docs"], ...}
- "send an email" → {"agents": ["gmail"], ...}
- "create a meeting" → {"agents": ["calendar"], ...}

External Data:
- "weather in Delhi" → {"agents": ["weather"], ...}
- "restaurants near me" → {"agents": ["maps"], ...}

Return ONLY valid JSON:
{
  "agents": ["agent1", "agent2"],
  "reasoning": "Why these agents were chosen",
  "queries": {"agent1": "specific query", "agent2": "specific query"},
  "requiresSequential": false,
  "dependencies": {}
}`;

      const routingMessages = [
        { 
          role: 'system', 
          content: `You are an expert agent router. Always respond with valid JSON only, no other text.

CORE RULES:
1. User's personal data (my docs, my emails, my calendar, my files) → ALWAYS route to specific agent (docs, gmail, calendar, microsoft), NEVER websearch
2. External real-time info (news, weather, events) → websearch or weather agent
3. App actions (create, send, schedule, add) → appropriate agent
4. Trust the IntentClassification result - it's usually correct
5. When in doubt, prefer specific agent over websearch for user data queries` 
        },
        { role: 'user', content: routingPrompt }
      ];

      const routingResponse = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: routingMessages,
        temperature: 0.2,
        response_format: { type: "json_object" }
      });

      const analysis = JSON.parse(routingResponse.choices[0].message.content);
      
      console.log('[MainAgent] 🤖 LLM Agent Routing Result:', JSON.stringify(analysis, null, 2));

      // README.md (or other repo file) requests should use GitHub agent, not Docs.
      const mentionsRepoContext = /\b(repo|repository|github)\b/i.test(query);
      const mentionsReadme = /\breadme(\.md)?\b/i.test(query);
      const mentionsFileExt = /\b[\w\-\/]+\.(js|ts|tsx|jsx|py|java|cpp|c|rb|go|rs|php|html|css|json|md|txt|xml|yml|yaml)\b/i.test(query);

      if ((mentionsReadme || mentionsFileExt) && mentionsRepoContext) {
        analysis.agents = ['github'];
        analysis.queries = { github: query };
        analysis.reasoning = `User is requesting repository file operations (README/files) in a GitHub repository; route to github agent.`;
      }
      
      return analysis;

    } catch (error) {
      console.error('[MainAgent] Error analyzing query:', error);
      throw new Error(`Failed to analyze query: ${error.message}`);
    }
  }

  /**
   * Execute queries on the specified agents
   * Now includes artifact storage after successful operations
   * Now passes conversationHistory to agents for context
   */
  async executeAgentQueries(analysis, userId, conversationId = null, userLocation = null, timeline = null, conversationHistory = [], query = '') {
    const results = {};
    const errors = {};
    const storedArtifacts = [];

    try {
      if (analysis.requiresSequential) {
        // Execute agents sequentially based on dependencies
        for (const agentName of analysis.agents) {
          try {
            let agentQuery = analysis.queries[agentName];
            console.log(`[MainAgent] Executing ${agentName} sequentially with query: "${agentQuery}"`);

            // Preflight integration connection (avoid leaking token errors later)
            const isConnected = await this._isIntegrationConnected(agentName, userId);
            if (!isConnected) {
              throw new Error(this._friendlyIntegrationError(agentName));
            }

            // ====== ENRICH QUERY WITH PREVIOUS RESULTS ======
            // When executing sequentially, inject concrete data from prior agents
            // into the current agent's query (e.g. real Meet link, doc URL, form link).
            if (Object.keys(results).length > 0) {
              const enrichmentResult = await this._enrichQueryWithPreviousResults(agentQuery, agentName, results, userId);
              
              // ✅ CRITICAL FIX: Check if enrichment returned structured data
              if (typeof enrichmentResult === 'object' && enrichmentResult.researchContent) {
                console.log(`[MainAgent] 📦 Passing structured research content to ${agentName} (direct execution)`);
                agentQuery = enrichmentResult.query;
                // Will be added to agentOptions below
              } else if (typeof enrichmentResult === 'string') {
                // String enrichment (old behavior for email agents)
                agentQuery = enrichmentResult;
              } else {
                // Fallback: use original query
                console.warn(`[MainAgent] ⚠️ Unexpected enrichment result type:`, typeof enrichmentResult);
              }
            }
            
            // Emit executing event BEFORE agent starts
            if (timeline) {
              timeline.emitAgentExecuting(agentName, agentQuery);
            }
            
            const agent = this.agents[agentName];
            if (!agent) {
              throw new Error(`Agent '${agentName}' not found`);
            }

            // Build options for the agent (sequential execution)
            const agentOptions = {
              userId,
              conversationId: conversationId,  // ✅ CRITICAL: Pass conversationId to agents
              conversationHistory: conversationHistory,
              ...(agentName === 'maps' && userLocation ? { userLocation } : {}),
              // Add timezone for schedules agent
              ...(agentName === 'schedules' ? { timezone: this._detectUserTimezone(userLocation) } : {}),
              // ✅ NEW: Pass fileIds for attachment support (gmail agent)
              ...(this.lastFileIds ? { fileIds: this.lastFileIds } : {}),
              // ✅ NEW: Pass onProgress callback for research agent
              ...(agentName === 'research' && timeline ? { 
                onProgress: (update) => {
                  // Forward research progress events to timeline
                  if (update.type === 'timeline_research_step') {
                    timeline.emit(update);
                  }
                }
              } : {})
            };
            
            // ✅ CRITICAL FIX: Add researchContent to options if it was returned
            if (Object.keys(results).length > 0) {
              const enrichmentResult = await this._enrichQueryWithPreviousResults(analysis.queries[agentName], agentName, results, userId);
              if (typeof enrichmentResult === 'object' && enrichmentResult.researchContent) {
                agentOptions.researchContent = enrichmentResult.researchContent;
                console.log(`[MainAgent] 🔍 agentOptions for ${agentName}:`, { 
                  userId: typeof agentOptions.userId, 
                  conversationId: agentOptions.conversationId,
                  hasResearchContent: true
                });
              }
            }

            const result = await agent.processQuery(agentQuery, agentOptions);
            results[agentName] = result;
            
            // Emit completed event AFTER agent finishes
            if (timeline) {
              timeline.emitAgentCompleted(agentName, result);
            }

            // Store artifacts from successful tool executions (SEQUENTIAL)
            if (conversationId && result.success) {
              // ✅ NEW FORMAT: Handle BaseAgent executedActions format
              if (result.executedActions && Array.isArray(result.executedActions)) {
                console.log(`[MainAgent] 📦 Processing ${result.executedActions.length} executed actions for ${agentName} (sequential)`);
                for (const action of result.executedActions) {
                  try {
                    const toolName = action.tool;
                    const toolResult = action.result;
                    console.log(`[MainAgent] 🔍 Attempting to store artifact for ${agentName}/${toolName} (sequential)`);
                    const artifact = await extractAndStoreArtifact(
                      conversationId,
                      agentName,
                      toolName,
                      toolResult
                    );
                    if (artifact) {
                      storedArtifacts.push(artifact);
                      console.log(`[MainAgent] ✅ Artifact stored (sequential): ${artifact.type} - ${artifact.title}`);
                    }
                  } catch (artifactError) {
                    console.error(`[MainAgent] ⚠️ Error storing artifact (sequential):`, artifactError);
                  }
                }
              }
              // ✅ OLD FORMAT: Handle legacy tools_used format
              else if (result.tools_used) {
                for (let i = 0; i < result.tools_used.length; i++) {
                  const tool = result.tools_used[i];
                  try {
                    // Match the tool with its corresponding result by index
                    const rawResult = result.raw_results?.[i] || result.raw_results?.find(r => r.success !== false) || result;
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

          } catch (error) {
            console.error(`[MainAgent] Error executing ${agentName}:`, error);
            const friendly = this._sanitizeErrorForUser(agentName, error.message);
            errors[agentName] = {
              error: friendly,
              query: analysis.queries[agentName]
            };
            // Emit failed event
            if (timeline) {
              timeline.emitAgentFailed(agentName, friendly);
            }
          }
        }
      } else {
        // Execute agents in parallel for better performance
        const agentPromises = analysis.agents.map(async (agentName) => {
          try {
            const agentQuery = analysis.queries[agentName];
            console.log(`[MainAgent] Executing ${agentName} in parallel with query: "${agentQuery}"`);

            // Preflight integration connection
            const isConnected = await this._isIntegrationConnected(agentName, userId);
            if (!isConnected) {
              throw new Error(this._friendlyIntegrationError(agentName));
            }
            
            // Emit executing event BEFORE agent starts
            if (timeline) {
              timeline.emitAgentExecuting(agentName, agentQuery);
            }
            
            const agent = this.agents[agentName];
            if (!agent) {
              throw new Error(`Agent '${agentName}' not found`);
            }

            // Build options for the agent (parallel execution)
            const agentOptions = {
              userId,
              conversationId: conversationId,  // ✅ CRITICAL: Pass conversationId to agents
              conversationHistory: conversationHistory,
              ...(agentName === 'maps' && userLocation ? { userLocation } : {}),
              // Add timezone for schedules agent
              ...(agentName === 'schedules' ? { timezone: this._detectUserTimezone(userLocation) } : {}),
              // ✅ NEW: Pass fileIds for attachment support (gmail agent)
              ...(this.lastFileIds ? { fileIds: this.lastFileIds } : {}),
              // ✅ NEW: Pass onProgress callback for research agent
              ...(agentName === 'research' && timeline ? { 
                onProgress: (update) => {
                  console.log('[MainAgent] 📡 Research progress update received:', update.type);
                  // Forward research progress events to timeline
                  if (update.type === 'timeline_research_step') {
                    console.log('[MainAgent] ✅ Forwarding research step to timeline');
                    timeline.emit(update);
                  }
                }
              } : {})
            };

            const result = await agent.processQuery(agentQuery, agentOptions);
            
            // Emit completed event AFTER agent finishes
            if (timeline) {
              timeline.emitAgentCompleted(agentName, result);
            }
            
            return { agentName, result };

          } catch (error) {
            console.error(`[MainAgent] Error executing ${agentName}:`, error);
            const friendly = this._sanitizeErrorForUser(agentName, error.message);
            
            // Emit failed event
            if (timeline) {
              timeline.emitAgentFailed(agentName, friendly);
            }
            
            return { 
              agentName, 
              error: {
                error: friendly,
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

            // Store artifacts from successful tool executions (PARALLEL)
            if (conversationId && result.success) {
              // ✅ NEW FORMAT: Handle BaseAgent executedActions format
              if (result.executedActions && Array.isArray(result.executedActions)) {
                console.log(`[MainAgent] 📦 Processing ${result.executedActions.length} executed actions for ${agentName}`);
                for (const action of result.executedActions) {
                  try {
                    const toolName = action.tool;
                    const toolResult = action.result;
                    console.log(`[MainAgent] 🔍 Attempting to store artifact for ${agentName}/${toolName}`);
                    const artifact = await extractAndStoreArtifact(
                      conversationId,
                      agentName,
                      toolName,
                      toolResult
                    );
                    if (artifact) {
                      storedArtifacts.push(artifact);
                      console.log(`[MainAgent] ✅ Stored artifact: ${artifact.type} - ${artifact.title}`);
                    }
                  } catch (artifactError) {
                    console.error(`[MainAgent] ⚠️ Error storing artifact from executedActions:`, artifactError);
                  }
                }
              }
              // ✅ OLD FORMAT: Handle legacy tools_used format
              else if (result.tools_used) {
                for (let i = 0; i < result.tools_used.length; i++) {
                  const tool = result.tools_used[i];
                  try {
                    // Match the tool with its corresponding result by index
                    const rawResult = result.raw_results?.[i] || result.raw_results?.find(r => r.success !== false) || result;
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
  async combineResponses(query, analysis, results, errors, detectedLanguage = 'en') {
    try {
      // Get language instruction for LLM
      const languageDetection = require('../utils/languageDetection');
      const languageInstruction = languageDetection.getLanguageInstruction(detectedLanguage);
      const languageName = languageDetection.getLanguageName(detectedLanguage);
      console.log(`[MainAgent] 🌐 combineResponses using language: ${languageName} (${detectedLanguage})`);
      
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
Instead, present the information as if you're directly reporting the results.

**CRITICAL - LANGUAGE MATCHING**:
Detect the EXACT language of the user's query above and respond ENTIRELY in that SAME language.
- CAREFULLY distinguish between similar languages: Marathi vs Hindi ("kara/navane/zala" = Marathi, "karo/naam/hua" = Hindi), Portuguese vs Spanish, etc. Do NOT default to Hindi for all Indian languages.
- MATCH THE SCRIPT: If the user typed in Romanized/Latin script (e.g., "taiyarr kara"), respond in the same Romanized script (e.g., "Tumcha document tayaar zala!"). If they used native script (Devanagari, Arabic, CJK), respond in native script. NEVER convert Romanized input into a different script.
- Technical terms, product names (Google Docs), URLs, and identifiers can remain in English
- Markdown formatting should still be used`;

      const messages = [
        { role: 'system', content: this.systemPrompt + '\n\n' + languageInstruction },
        { role: 'user', content: combinePrompt }
      ];

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini', // Using same model for consistency
        messages: messages,
        temperature: 0.1 // ✅ LOW: Response combining should be deterministic
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
   * Now includes confirmation flow for sensitive operations, artifact memory, long-term memory, and timeline events
   */
  async processQueryWithStreaming(query, userId, options = {}, onChunk) {
    const startTime = Date.now();
    const conversationId = options.conversationId;
    
    // ✅ NEW: Extract and store fileIds from options for passing to agents
    if (options.fileIds && options.fileIds.length > 0) {
      this.lastFileIds = options.fileIds;
      console.log(`[MainAgent] 📎 Storing fileIds for agent use: ${options.fileIds.length} file(s) - ${options.fileIds.join(', ')}`);
    } else if (options.fileContext && options.fileContext.fileIds && options.fileContext.fileIds.length > 0) {
      // Fallback: extract fileIds from fileContext if available
      this.lastFileIds = options.fileContext.fileIds;
      console.log(`[MainAgent] 📎 Extracted fileIds from fileContext: ${options.fileContext.fileIds.length} file(s)`);
    } else {
      this.lastFileIds = null;
    }
    
    // ✅ CRITICAL: Detect language at the VERY START using LLM before any processing
    const languageDetection = require('../utils/languageDetection');
    const detectedLanguage = await languageDetection.detectLanguage(query);
    const languageName = languageDetection.getLanguageName(detectedLanguage);
    console.log(`[MainAgent] 🌐 Detected language at START: ${languageName} (${detectedLanguage})`);
    
    // Initialize timeline emitter for step-by-step progress updates
    const timeline = new TimelineEmitter(onChunk, userId, conversationId);
    
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
          // Return with flag indicating flow is not complete - don't save timeline yet
          return { timelineEvents: timeline.getEvents(), pendingConfirmation: true };
        } else {
          console.log(`[PendingModification] ℹ️ Query is not a modification - proceeding normally`);
        }
      }

      // ========== LONG-TERM MEMORY RETRIEVAL ==========
      // Retrieve relevant memories before processing to provide context
      let relevantMemories = [];
      let memoryContext = '';
      
      // Emit real-time event: memory search starting
      onChunk({ type: 'status', message: 'Searching memory...' });
      timeline.emitMemorySearching();
      
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
          
          // Emit memory retrieved event
          timeline.emitMemoryRetrieved(relevantMemories.length, relevantMemories[0]?.memoryType);
        } else {
          console.log(`[LongTermMemory] ℹ️ No relevant memories found`);
        }
      } catch (memoryError) {
        console.error(`[LongTermMemory] ⚠️ Error retrieving memories:`, memoryError.message);
        // Continue without memories - don't block the main flow
        timeline.emitMemoryRetrieved(0, null);
      }

      // Build artifact context if conversationId is provided
      let artifactContext = null;
      let enhancedQuery = query;
      
      if (conversationId) {
        // Emit real-time event: artifact scanning
        onChunk({ type: 'status', message: 'Scanning conversation artifacts...' });
        timeline.emitArtifactScanning(conversationId);
        
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
          
          // Emit real-time event: artifact resolved
          timeline.emitArtifactResolved(artifactContext.resolvedArtifact?.title, artifactContext.resolvedArtifact?.type);
        } else {
          console.log(`[ArtifactMemory] ⚠️ No artifact reference detected in query`);
          timeline.emitArtifactResolved(null, null);
        }
      } else {
        console.log(`\n[ArtifactMemory] ⚠️ No conversationId provided - artifact memory disabled`);
      }

      // Emit file context processing event if files are attached
      if (options.fileContext && options.fileContext.filesProcessed > 0) {
        const fileNames = options.fileContext.textContexts 
          ? options.fileContext.textContexts.map(f => f.filename).join(', ') 
          : `${options.fileContext.filesProcessed} file(s)`;
        timeline.emitNarrative(`Processing attached files: ${fileNames}`);
      }

      // Step 1: Analyze the query to determine which agents are needed
      // Emit real-time event: analyzing query with AI
      onChunk({ type: 'status', message: 'Analyzing with AI...' });
      timeline.emitAnalyzingQuery();
      
      // Pass artifact context, memory context, file context, and detected language to analysis for better routing
      const analysis = await this.analyzeQuery(enhancedQuery, options.conversationHistory, artifactContext, memoryContext, options.fileContext, detectedLanguage);
      
      // ✅ CRITICAL: Check if analysis returned a validation error
      if (analysis.validationError && analysis.error) {
        console.log('[MainAgent] ⚠️ Validation error detected in streaming mode');
        console.log('[MainAgent] 📝 Error message:', analysis.error);
        
        // Stop thinking indicator
        console.log('[MainAgent] 🛑 Sending thinking stop signal');
        onChunk({ type: 'thinking', status: 'stop' });
        
        // Emit validation error event
        timeline.emitNarrative('❌ URL validation failed');
        
        // Send error message to user
        console.log('[MainAgent] 📤 Sending error content to user');
        onChunk({
          type: 'content',
          text: analysis.error  // Use 'text' not 'content' for streaming
        });
        
        // Send done signal
        console.log('[MainAgent] ✅ Sending done signal');
        onChunk({ type: 'done' });
        
        console.log('[MainAgent] 🏁 Validation error handling complete');
        
        // Return with validation error flag
        return { 
          timelineEvents: timeline.getEvents(), 
          validationError: true,
          error: analysis.error
        };
      }
      
      console.log(`\n[MainAgent] 🤖 Query Analysis Result:`);
      console.log(`[MainAgent]   Agents: ${analysis.agents.join(', ')}`);
      console.log(`[MainAgent]   Reasoning: ${analysis.reasoning}`);
      console.log(`[MainAgent]   Queries:`, JSON.stringify(analysis.queries, null, 2));
      
      // Emit real-time event: analysis complete with actual reasoning
      timeline.emitAnalysisComplete(analysis.agents, analysis.reasoning);
      
      // Send analysis result
      onChunk({ 
        type: 'analysis', 
        agents: analysis.agents,
        reasoning: analysis.reasoning 
      });
      
      // Emit agent added events (real-time: which agents will be used)
      if (analysis.agents.length > 0) {
        for (const agentKey of analysis.agents) {
          timeline.emitAgentAdded(agentKey);
        }
      }

      // Send status for agent execution
      if (analysis.agents.length === 1) {
        onChunk({ type: 'status', message: `Connecting to ${analysis.agents[0]} agent...` });
      } else if (analysis.agents.length > 1) {
        onChunk({ type: 'status', message: `Coordinating ${analysis.agents.length} agents...` });
      }

      // ============================================================
      // ✅ PRE-EXECUTION VALIDATION FOR ALL AGENTS
      // Check for validation errors BEFORE executing agents
      // ============================================================
      const preExecutionValidation = await this._validateAgentsBeforeExecution(analysis, enhancedQuery);
      
      if (preExecutionValidation.hasErrors) {
        console.log('[MainAgent] ❌ Pre-execution validation failed');
        
        // Stop thinking indicator
        onChunk({ type: 'thinking', status: 'stop' });
        
        // Emit validation error event
        timeline.emitNarrative('❌ Validation failed');
        
        // Send error message to user
        onChunk({
          type: 'content',
          text: preExecutionValidation.errorMessage
        });
        
        // Send done signal
        onChunk({ type: 'done' });
        
        // Return with validation error flag
        return {
          timelineEvents: timeline.getEvents(),
          validationError: true,
          error: preExecutionValidation.errorMessage
        };
      }

      // Step 2: Check if any agent actions require confirmation
      // For now, we execute queries and check if any tool in the result needs confirmation
      // This will be enhanced when specialized agents report their intended tools
      
      // ✅ NEW: Extract research content from conversation history if user references it
      // This enables docs/forms/sheets to add complete research content without regenerating
      let extractedResearchContent = null;
      if (analysis.agents.includes('docs') || analysis.agents.includes('forms') || analysis.agents.includes('sheets')) {
        extractedResearchContent = this.extractResearchContentFromHistory(enhancedQuery, options.conversationHistory || []);
        
        if (extractedResearchContent) {
          console.log('[MainAgent] 📚 Extracted research content from conversation history');
          console.log(`[MainAgent] 📊 Research: ${extractedResearchContent.content.length} chars, ${extractedResearchContent.sources.length} sources`);
          
          // Attach to options for passing to agents
          options.researchContent = extractedResearchContent;
        }
      }
      
      const { results, errors, confirmationRequest, storedArtifacts } = await this.executeAgentQueriesWithConfirmationAndTimeline(
        analysis, 
        userId, 
        enhancedQuery, 
        options.conversationHistory || [],
        conversationId,
        options.userLocation,  // Pass userLocation for Maps agent
        timeline  // Pass timeline emitter
      );

      // If a confirmation is required, send confirmation_request and stop
      if (confirmationRequest) {
        // ✅ CRITICAL: Check if this is a validation error instead of confirmation
        if (confirmationRequest.type === 'validation_error') {
          console.log('[MainAgent] ⚠️ Validation error detected, sending error to user');
          
          // Stop thinking indicator
          onChunk({ type: 'thinking', status: 'stop' });
          
          // Emit validation error event
          timeline.emitNarrative('❌ Validation failed');
          
          // Send error message to user
          onChunk({
            type: 'content',
            text: confirmationRequest.message
          });
          
          // Send done signal
          onChunk({ type: 'done' });
          
          // Return with validation error flag
          return {
            timelineEvents: timeline.getEvents(),
            validationError: true,
            error: confirmationRequest.message
          };
        }
        
        onChunk({ type: 'thinking', status: 'stop' });
        
        // Emit confirmation required event
        timeline.emitConfirmationRequired(
          confirmationRequest.toolName,
          confirmationRequest.agentName,
          confirmationRequest.previewContent
        );
        
        // If there are completed operations (e.g., document created before email confirmation),
        // send their results first so the user sees them
        if (confirmationRequest.completedOperations && confirmationRequest.completedOperations.length > 0) {
          // Generate a summary of completed operations
          let completedMessage = '✅ **Completed Operations:**\n\n';
          for (const op of confirmationRequest.completedOperations) {
            if (op.type === 'document_created_with_content' || op.type === 'document_created') {
              if (op.contentAdded) {
                completedMessage += `📝 Created document with content: **${op.name}**\n`;
              } else {
                completedMessage += `📝 Created document: **${op.name}**\n`;
              }
              if (op.link) {
                completedMessage += `🔗 [Open Document](${op.link})\n\n`;
              }
            }
          }
          
          // Also include the microsoft agent response if available
          if (results.microsoft && results.microsoft.response) {
            completedMessage += results.microsoft.response + '\n\n';
          }
          
          completedMessage += '---\n\n**Now confirming email to share the document:**\n';
          
          onChunk({
            type: 'content',
            text: completedMessage  // Use 'text' not 'content' for streaming
          });
        }
        
        onChunk({ 
          type: 'confirmation_request',
          ...confirmationRequest
        });
        // Return with flag indicating flow is not complete - don't save timeline yet
        return { timelineEvents: timeline.getEvents(), pendingConfirmation: true };
      }

      // Send status for response generation (real-time event)
      onChunk({ type: 'status', message: 'Generating response...' });
      timeline.emitGeneratingResponse();

      // Step 3: Stream the final response generation
      // Pass memory context, conversation history, file context, detected language, and response language for inclusion in the response generation
      await this.streamCombinedResponse(
        enhancedQuery, 
        analysis, 
        results, 
        errors, 
        onChunk, 
        conversationId, 
        memoryContext,
        options.conversationHistory || [],
        options.fileContext,  // Pass file context for LLM
        detectedLanguage  // Pass detected language instead of responseLanguage
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
      
      // Check if any agent result is asking for clarification
      const needsClarification = Object.values(results).some(result => {
        if (!result?.response) return false;
        return timeline.detectClarificationRequest(result.response);
      });
      
      // Emit timeline task completed/failed at the very end
      if (Object.keys(errors).length === 0) {
        // Complete for both agent results AND empty-agent queries (conversational/file-context)
        if (Object.keys(results).length > 0) {
          timeline.emitTaskCompleted('Request completed successfully', needsClarification);
        } else if (analysis.agents.length === 0) {
          // No agents were used (conversational query or file-context query)
          timeline.emitTaskCompleted('Request completed successfully', false);
        }
      } else {
        // Emit task failed if we have any errors and no task_failed has been emitted yet
        const alreadyFailed = timeline.getEvents().some(e => e.type === 'timeline_task_failed');
        if (!alreadyFailed) {
          const firstErrorKey = Object.keys(errors)[0];
          const firstError = errors[firstErrorKey];
          const friendly = (firstError && (firstError.error || firstError.message)) || 'Something went wrong.';
          timeline.emitTaskFailed(new Error(friendly));
        }
      }
      
      // Return timeline events for storage
      return {
        timelineEvents: timeline.getEvents()
      };

    } catch (error) {
      console.error('[MainAgent] Error processing streaming query:', error);
      onChunk({ 
        type: 'error', 
        error: 'Failed to process query',
        message: error.message 
      });
      
      // Return timeline events even on error
      return {
        timelineEvents: timeline.getEvents()
      };
    }
  }

  /**
   * Execute agent queries with confirmation checking AND timeline events
   * Wraps executeAgentQueriesWithConfirmation with timeline emitter support
   */
  async executeAgentQueriesWithConfirmationAndTimeline(analysis, userId, query, conversationHistory, conversationId = null, userLocation = null, timeline = null) {
    // Pass timeline through to executeAgentQueriesWithConfirmation
    // Timeline events are now emitted in real-time from within executeAgentQueries
    const result = await this.executeAgentQueriesWithConfirmation(
      analysis, userId, query, conversationHistory, conversationId, userLocation, timeline
    );

    // If confirmation is required, we'll handle it in the caller
    if (result.confirmationRequest) {
      return result;
    }

    // Task completion is now emitted at the very end after response generation
    // (moved to processQueryWithStreaming for correct timeline order)

    return result;
  }

  /**
   * Execute agent queries with confirmation checking
   * Checks if the analysis indicates a confirmation-required action
   * Now supports multiple confirmation actions (action chains) for multi-agent queries
   * Now includes artifact storage via conversationId
   * Now handles multi-step operations (create document + send email) properly using action chains
   */
  async executeAgentQueriesWithConfirmation(analysis, userId, query, conversationHistory, conversationId = null, userLocation = null, timeline = null) {
    const lowerQuery = query.toLowerCase();
    
    // Check for multi-step operations that need special handling:
    // Pattern: Create document/file + send email with link (Microsoft)
    const isMicrosoftCreateAndSendPattern = (
      analysis.agents.includes('microsoft') &&
      (lowerQuery.includes('create') || lowerQuery.includes('new') || lowerQuery.includes('make')) &&
      (lowerQuery.includes('document') || lowerQuery.includes('doc') || lowerQuery.includes('word') || 
       lowerQuery.includes('sheet') || lowerQuery.includes('excel') || lowerQuery.includes('file') ||
       lowerQuery.includes('workbook') || lowerQuery.includes('spreadsheet')) &&
      (lowerQuery.includes('send') || lowerQuery.includes('email') || lowerQuery.includes('mail')) &&
      (lowerQuery.includes('outlook') || lowerQuery.includes('microsoft') || 
       lowerQuery.includes('@outlook') || lowerQuery.includes('@hotmail') || lowerQuery.includes('@live'))
    );
    
    // Determine if this is Excel or Word
    const isExcelRequest = lowerQuery.includes('excel') || lowerQuery.includes('spreadsheet') || 
                           lowerQuery.includes('workbook') || lowerQuery.includes('sheet');
    
    // If this is Microsoft "create document/file + send email" pattern, use action chain like Google
    if (isMicrosoftCreateAndSendPattern) {
      const fileType = isExcelRequest ? 'Excel workbook' : 'Word document';
      console.log(`[Confirmation] Detected Microsoft multi-step pattern: create ${fileType} + send email`);
      console.log(`[Confirmation] Creating action chain like Google flow`);
      
      // Extract file/document title - improved pattern matching
      // Patterns to try in order:
      // 1. "named as employees" or "named employees"
      // 2. "titled 'something'" or "title 'something'"
      // 3. "file/document/workbook 'name'"
      // 4. "create excel named something and send"
      let title = null;
      
      // Pattern 1: "named as X" or "named X" (before "and", "send", ",", "add", "then")
      const namedAsMatch = query.match(/named?\s*(?:as\s+)?['"]?([a-zA-Z0-9_\-]+)['"]?\s*(?:,|\s+and\s+|\s+send|\s+then|\s+add|$)/i);
      if (namedAsMatch) {
        title = namedAsMatch[1].trim();
        console.log(`[Confirmation] Extracted title from 'named as' pattern: ${title}`);
      }
      
      // Pattern 2: "titled 'X'" or "title: X"
      if (!title) {
        const titledMatch = query.match(/titled?\s*[:\s]?\s*['"]([^'"]+)['"]/i);
        if (titledMatch) {
          title = titledMatch[1].trim();
          console.log(`[Confirmation] Extracted title from 'titled' pattern: ${title}`);
        }
      }
      
      // Pattern 3: "file/document/workbook 'X'"
      if (!title) {
        const fileMatch = query.match(/(?:file|document|workbook|spreadsheet)\s+['"]([^'"]+)['"]/i);
        if (fileMatch) {
          title = fileMatch[1].trim();
          console.log(`[Confirmation] Extracted title from quoted pattern: ${title}`);
        }
      }
      
      // Pattern 4: "called X"
      if (!title) {
        const calledMatch = query.match(/called\s+['"]?([a-zA-Z0-9_\-]+)['"]?/i);
        if (calledMatch) {
          title = calledMatch[1].trim();
          console.log(`[Confirmation] Extracted title from 'called' pattern: ${title}`);
        }
      }
      
      // Default fallback
      if (!title) {
        title = isExcelRequest ? 'New Workbook' : 'New Document';
        console.log(`[Confirmation] Using default title: ${title}`);
      }
      
      // Extract email recipient
      const emailMatch = query.match(/(?:to|email|mail)\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
      const emailTo = emailMatch ? emailMatch[1] : null;
      
      // Check if we should add content/data
      const shouldAddContent = lowerQuery.includes('add') && (lowerQuery.includes('content') || lowerQuery.includes('data') || lowerQuery.includes('sample'));
      const shouldAddSampleData = lowerQuery.includes('sample') || (lowerQuery.includes('add') && lowerQuery.includes('data'));
      
      console.log(`[Confirmation] Title: ${title}, Email: ${emailTo}, AddContent: ${shouldAddContent}, SampleData: ${shouldAddSampleData}`);
      
      // Build action chain based on file type
      const confirmationActions = [];
      
      if (isExcelRequest) {
        // Action 1: Create Excel workbook (with sample data flag)
        const createExcelParams = {
          fileName: title,
          addSampleData: shouldAddSampleData || shouldAddContent,
          sampleDataContext: shouldAddSampleData ? `Generate sample employee data for a spreadsheet named "${title}"` : null
        };
        
        const createExcelPreview = `📊 **Create Microsoft Excel Workbook**\n\n**Title:** ${title}${shouldAddSampleData ? '\n**Data:** Will add sample data based on the file name' : ''}`;
        
        confirmationActions.push({
          agentName: 'microsoft',
          agentQuery: shouldAddSampleData 
            ? `create a Microsoft Excel workbook named '${title}' and add sample data to it`
            : `create a Microsoft Excel workbook named '${title}'`,
          toolName: 'microsoft_createExcelWorkbook',
          params: createExcelParams,
          previewContent: createExcelPreview,
          captureOutput: true,
          outputKey: 'documentLink'
        });
      } else {
        // Action 1: Create Word document
        const createDocParams = {
          fileName: title,
          content: shouldAddContent ? `Generate content about ${title}` : ''
        };
        
        const createDocPreview = `📝 **Create Microsoft Word Document**\n\n**Title:** ${title}${shouldAddContent ? '\n**Content:** Will add content based on the title' : ''}`;
        
        confirmationActions.push({
          agentName: 'microsoft',
          agentQuery: shouldAddContent 
            ? `create a Microsoft Word document titled '${title}' and add content to it based on the title`
            : `create a Microsoft Word document titled '${title}'`,
          toolName: 'microsoft_createWordDocument',
          params: createDocParams,
          previewContent: createDocPreview,
          captureOutput: true,
          outputKey: 'documentLink'
        });
      }
      
      // Action 2: Send email (will use document link from action 1)
      if (emailTo) {
        const emailPreview = `📧 **Send Email via Outlook**\n\n**To:** ${emailTo}\n**Subject:** ${title}\n**Content:** Will include the ${isExcelRequest ? 'workbook' : 'document'} link after it is created`;
        
        confirmationActions.push({
          agentName: 'microsoft',
          agentQuery: `send email to ${emailTo} with the ${isExcelRequest ? 'workbook' : 'document'} link`,
          toolName: 'microsoft_sendEmail',
          params: {
            to: emailTo,
            subject: title,
            body: `[Will be generated after ${isExcelRequest ? 'workbook' : 'document'} is created]`,
            pendingDocumentLink: true
          },
          previewContent: emailPreview,
          requiresInput: true,
          inputKey: 'documentLink'
        });
      }
      
      // Store as action chain
      if (confirmationActions.length > 1) {
        console.log(`[Confirmation] Creating action chain with ${confirmationActions.length} actions`);
        
        const chainResult = confirmationStore.storeActionChain(
          userId,
          confirmationActions,
          query,
          conversationHistory,
          conversationId,
          undefined,  // ttlMs - use default
          timeline ? timeline.getEvents() : [],  // Pass timeline events from initial query
          analysis  // Pass original analysis for sequential multi-agent execution
        );
        
        if (chainResult) {
          const firstAction = confirmationActions[0];
          return {
            results: {},
            errors: {},
            storedArtifacts: [],
            confirmationRequest: {
              requestId: chainResult.firstRequestId,
              toolName: firstAction.toolName,
              agentName: firstAction.agentName,
              actionType: isExcelRequest ? 'create_spreadsheet' : 'create_document',
              description: isExcelRequest ? 'Create a Microsoft Excel workbook' : 'Create a Microsoft Word document',
              params: firstAction.params,
              previewContent: firstAction.previewContent,
              originalQuery: query,
              chainInfo: {
                chainId: chainResult.chainId,
                currentStep: 1,
                totalSteps: chainResult.totalActions
              }
            }
          };
        }
      } else if (confirmationActions.length === 1) {
        // Single action - just document/workbook creation without email
        const action = confirmationActions[0];
        const requestId = confirmationStore.storePendingAction(
          userId,
          action.toolName,
          action.agentName,
          action.params,
          action.previewContent,
          query,
          conversationHistory,
          conversationId,
          undefined,  // ttlMs - use default
          timeline ? timeline.getEvents() : [],  // Pass timeline events from initial query
          analysis,  // Pass original analysis for sequential multi-agent execution
          {},  // initialResults - empty for single action
          this.lastFileIds || []  // ✅ NEW: Pass fileIds for attachment support
        );
        
        return {
          results: {},
          errors: {},
          storedArtifacts: [],
          confirmationRequest: {
            requestId: requestId,
            toolName: action.toolName,
            agentName: action.agentName,
            actionType: isExcelRequest ? 'create_spreadsheet' : 'create_document',
            description: isExcelRequest ? 'Create a Microsoft Excel workbook' : 'Create a Microsoft Word document',
            params: action.params,
            previewContent: action.previewContent,
            originalQuery: query
          }
        };
      }
    }

    // ============================================================
    // ✅ Google Meet + Gmail Multi-Step Pattern Detection (NEW)
    // ============================================================
    const isGoogleMeetGmailPattern = (
      analysis.agents.includes('meet') &&
      analysis.agents.includes('gmail') &&
      (lowerQuery.includes('meet') || lowerQuery.includes('google meet')) &&
      (lowerQuery.includes('create') || lowerQuery.includes('new')) &&
      (lowerQuery.includes('send') || lowerQuery.includes('email') || lowerQuery.includes('mail'))
    );

    if (isGoogleMeetGmailPattern) {
      console.log(`[Confirmation] 🎯 Detected Google Meet + Gmail multi-step pattern`);
      
      // Extract meeting title from query
      // Patterns: "named X", "create google meet called X", "meet titled X"
      let meetingTitle = 'Team Meeting';
      
      const namedMatch = query.match(/(?:named|called|titled)\s+(?:as\s+)?['"]?([a-zA-Z0-9_\-\s]+?)['"]?\s*(?:,|\s+and\s+|\s+send|\s+to|$)/i);
      if (namedMatch) {
        meetingTitle = namedMatch[1].trim();
        console.log(`[Confirmation] 📹 Extracted meeting title: ${meetingTitle}`);
      }
      
      // Extract email recipient
      const emailMatch = query.match(/(?:to|send\s+to|email)\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
      const emailTo = emailMatch ? emailMatch[1] : null;
      
      if (!emailTo) {
        console.error(`[Confirmation] ❌ No email recipient found in query`);
        // Proceed without creating action chain - will handle as standard flow
      } else {
        console.log(`[Confirmation] 📧 Email recipient: ${emailTo}`);
        
        // Build action chain
        const confirmationActions = [];
        
        // Action 1: Create Google Meet
        confirmationActions.push({
          agentName: 'meet',
          agentQuery: `create a google meet titled "${meetingTitle}"`,
          toolName: 'createMeeting',
          params: {
            title: meetingTitle
          },
          previewContent: `📹 **Create Google Meet**\n\n**Title:** ${meetingTitle}`,
          captureOutput: true,
          outputKey: 'meetLink'
        });
        
        // Action 2: Send Email with Meet Link
        confirmationActions.push({
          agentName: 'gmail',
          agentQuery: `send email to ${emailTo} with the google meet link`,
          toolName: 'sendEmail',
          params: {
            to: emailTo,
            subject: `Join: ${meetingTitle}`,
            body: `[Will include the Google Meet link after it is created]`,
            pendingMeetingLink: true
          },
          previewContent: `📧 **Send Email via Gmail**\n\n**To:** ${emailTo}\n**Subject:** Join: ${meetingTitle}\n**Content:** Will include the meeting link after Meet is created`,
          requiresInput: true,
          inputKey: 'meetLink'
        });
        
        // Store as action chain
        if (confirmationActions.length > 1) {
          console.log(`[Confirmation] 🔗 Creating action chain with ${confirmationActions.length} actions`);
          
          const chainResult = confirmationStore.storeActionChain(
            userId,
            confirmationActions,
            query,
            conversationHistory,
            conversationId,
            undefined,  // ttlMs - use default
            timeline ? timeline.getEvents() : [],  // Pass timeline events from initial query
            analysis  // Pass original analysis for sequential multi-agent execution
          );
          
          if (chainResult) {
            const firstAction = confirmationActions[0];
            return {
              results: {},
              errors: {},
              storedArtifacts: [],
              confirmationRequest: {
                requestId: chainResult.firstRequestId,
                toolName: firstAction.toolName,
                agentName: firstAction.agentName,
                actionType: 'create_meeting',
                description: 'Create a Google Meet',
                params: firstAction.params,
                previewContent: firstAction.previewContent,
                originalQuery: query,
                chainInfo: {
                  chainId: chainResult.chainId,
                  currentStep: 1,
                  totalSteps: chainResult.totalActions
                }
              }
            };
          }
        }
      }
    }
    
    // Standard flow: Collect ALL confirmation-required actions from all agents
    const confirmationRequiredActions = [];
    const nonConfirmationAgents = [];
    
    for (const agentName of analysis.agents) {
      const agentQuery = analysis.queries[agentName];
      console.log(`[Confirmation] Checking agent: ${agentName}, query: ${agentQuery}`);

      // Preflight integration connection BEFORE generating previews or confirmations
      const isConnected = await this._isIntegrationConnected(agentName, userId);
      if (!isConnected) {
        const friendly = this._friendlyIntegrationError(agentName);
        console.warn(`[Confirmation] Integration not connected for ${agentName}: ${friendly}`);
        if (timeline) {
          timeline.emitTaskFailed(new Error(friendly));
        }
        return {
          results: {},
          errors: {
            [agentName]: { error: friendly, query: agentQuery }
          },
          storedArtifacts: [],
          confirmationRequest: null
        };
      }

      const detectedAction = await this.detectConfirmationRequiredAction(agentName, agentQuery, userId, conversationHistory);
      
      // ✅ CRITICAL: Check if detection returned an error (e.g., invalid email, missing content)
      if (detectedAction && detectedAction.error) {
        console.error(`[Confirmation] ❌ Error detecting action for ${agentName}:`, detectedAction.message);
        
        // Return as validation_error type so it's sent directly to user
        return {
          results: {},
          errors: {},
          storedArtifacts: [],
          confirmationRequest: {
            type: 'validation_error',
            agentName,
            toolName: detectedAction.toolName,
            message: detectedAction.message
          }
        };
      }
      
      if (detectedAction) {
        console.log(`[Confirmation] Detected action for ${agentName}:`, JSON.stringify(detectedAction, null, 2));
        
        // ✅ CRITICAL FIX: If this is an email with deferred generation, generate actual content NOW
        // BEFORE showing the preview to the user
        let params = detectedAction.inferredParams;
        if ((detectedAction.toolName === 'sendEmail' || detectedAction.toolName === 'microsoft_sendEmail') && 
            params._deferredGeneration) {
          console.log(`[Confirmation] 🔄 Email has deferred generation - regenerating with actual content NOW`);
          
          // Get ALL artifacts from conversation context
          let artifacts = [];
          let artifactContext = null;
          
          if (conversationId) {
            try {
              artifactContext = await buildArtifactContext(conversationId, query);
              artifacts = artifactContext.allArtifacts || [];
              console.log(`[Confirmation] 📦 Retrieved ${artifacts.length} artifact(s) from conversation`);
              artifacts.forEach((a, i) => {
                console.log(`[Confirmation]   ${i + 1}. [${a.type}] "${a.title}" (ID: ${a.id})`);
              });
            } catch (err) {
              console.error(`[Confirmation] ❌ Error fetching artifact context:`, err.message);
            }
          }
          
          // Detect if user wants to send multiple artifacts
          const multipleArtifactPattern = /\b(both|all|these|those|two|multiple)\b/i;
          const wantsMultiple = multipleArtifactPattern.test(query) && artifacts.length > 1;
          
          if (wantsMultiple) {
            console.log(`[Confirmation] 📧 User wants to send MULTIPLE artifacts (${artifacts.length})`);
            
            // Generate email with ALL artifacts
            const allLinks = artifacts.map(artifact => {
              const artifactType = artifact.type?.toLowerCase();
              let link = '';
              let typeName = '';
              
              if (artifactType === 'doc' || artifactType === 'document') {
                link = `https://docs.google.com/document/d/${artifact.id}/edit`;
                typeName = 'Document';
              } else if (artifactType === 'form') {
                link = `https://docs.google.com/forms/d/${artifact.id}/viewform`;
                typeName = 'Form';
              } else if (artifactType === 'sheet' || artifactType === 'spreadsheet') {
                link = `https://docs.google.com/spreadsheets/d/${artifact.id}/edit`;
                typeName = 'Spreadsheet';
              } else if (artifactType === 'event' || artifactType === 'calendar_event') {
                link = artifact.eventLink || artifact.meetLink || '';
                typeName = 'Event';
              }
              
              return { title: artifact.title, link, typeName };
            }).filter(item => item.link);
            
            // Generate professional email with all links
            const subject = `Sharing ${allLinks.length} Resources`;
            let body = `Hello,\n\nI'm sharing the following resources with you:\n\n`;
            
            allLinks.forEach((item, index) => {
              body += `${index + 1}. **${item.typeName}: ${item.title}**\n   ${item.link}\n\n`;
            });
            
            body += `Feel free to access these at your convenience.\n\nBest regards`;
            
            params = {
              to: params.to,
              subject,
              body,
              isAIGenerated: true  // Mark as AI-generated so preview shows the full body
            };
            
            console.log(`[Confirmation] ✅ Generated email for ${allLinks.length} artifacts`);
            console.log(`[Confirmation]   Subject: ${subject}`);
            console.log(`[Confirmation]   Body length: ${body.length} chars`);
            
          } else if (artifacts.length > 0) {
            // Single artifact - use the most relevant one
            const artifact = artifactContext.resolvedArtifact || artifacts[artifacts.length - 1];
            console.log(`[Confirmation] 📧 User wants to send SINGLE artifact: ${artifact.type} - ${artifact.title}`);
            
            let itemType = null;
            let itemDetails = null;
            
            const artifactType = artifact.type?.toLowerCase();
            if (artifactType === 'doc' || artifactType === 'document') {
              itemType = 'document';
              itemDetails = {
                docId: artifact.id,
                docLink: `https://docs.google.com/document/d/${artifact.id}/edit`,
                title: artifact.title
              };
            } else if (artifactType === 'form') {
              itemType = 'form';
              itemDetails = {
                formId: artifact.id,
                formLink: `https://docs.google.com/forms/d/${artifact.id}/viewform`,
                title: artifact.title
              };
            } else if (artifactType === 'sheet' || artifactType === 'spreadsheet') {
              itemType = 'spreadsheet';
              itemDetails = {
                sheetId: artifact.id,
                sheetLink: `https://docs.google.com/spreadsheets/d/${artifact.id}/edit`,
                title: artifact.title
              };
            } else if (artifactType === 'event' || artifactType === 'calendar_event') {
              itemType = 'meeting';
              itemDetails = {
                eventId: artifact.id,
                eventLink: artifact.eventLink,
                meetLink: artifact.meetLink,
                summary: artifact.title,
                startTime: artifact.startTime,
                endTime: artifact.endTime
              };
            }
            
            if (itemType && itemDetails) {
              console.log(`[Confirmation] 🎨 Generating ${itemType} email with actual details`);
              
              const regeneratedEmail = await this.generateEmailFromScratch(
                params.to,
                itemType,
                itemDetails,
                params._originalQuery || query,
                userId
              );
              
              console.log(`[Confirmation] ✅ Email regenerated with actual content:`, {
                subject: regeneratedEmail.subject,
                bodyLength: regeneratedEmail.body.length
              });
              
              // Replace placeholder params with actual content
              params = {
                ...regeneratedEmail,
                isAIGenerated: true  // Mark as AI-generated so preview shows the full body
              };
            } else {
              console.error(`[Confirmation] ❌ Could not determine item type from artifact: ${artifactType}`);
              // Generate generic email as fallback
              params = {
                to: params.to,
                subject: `Sharing: ${artifact.title}`,
                body: `Hello,\n\nI wanted to share this with you: ${artifact.title}\n\nBest regards`,
                isAIGenerated: true  // Mark as AI-generated so preview shows the full body
              };
            }
          } else {
            console.error(`[Confirmation] ❌ NO ARTIFACTS FOUND - This should NEVER happen!`);
            console.error(`[Confirmation] ❌ Conversation ID: ${conversationId}`);
            console.error(`[Confirmation] ❌ Query: ${query}`);
            // Generate generic email to avoid showing placeholder
            params = {
              to: params.to,
              subject: 'Sharing Information',
              body: `Hello,\n\nI wanted to share some information with you.\n\nBest regards`,
              isAIGenerated: true  // Mark as AI-generated so preview shows the full body
            };
          }
        }
        
        // Generate a preview for this action (now with actual content if it was regenerated)
        const previewContent = confirmationUtils.generatePreview(
          agentName, 
          detectedAction.toolName, 
          params
        );
        
        confirmationRequiredActions.push({
          agentName,
          agentQuery,
          toolName: detectedAction.toolName,
          params: params,  // Use potentially regenerated params
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
      
      // ✅ CRITICAL FIX: Execute non-confirmation agents BEFORE storing confirmation chain
      let nonConfirmationResults = {};
      let nonConfirmationErrors = {};
      let nonConfirmationArtifacts = [];
      
      if (nonConfirmationAgents.length > 0) {
        console.log(`[Confirmation] 🚀 Executing ${nonConfirmationAgents.length} non-confirmation agents in parallel: ${nonConfirmationAgents.join(', ')}`);
        
        // Create a modified analysis with only non-confirmation agents
        const nonConfirmationAnalysis = {
          ...analysis,
          agents: nonConfirmationAgents,
          queries: Object.fromEntries(
            nonConfirmationAgents.map(agent => [agent, analysis.queries[agent]])
          )
        };
        
        // Execute non-confirmation agents
        const executionResult = await this.executeAgentQueries(
          nonConfirmationAnalysis, 
          userId, 
          conversationId, 
          userLocation, 
          timeline, 
          conversationHistory,
          query
        );
        
        nonConfirmationResults = executionResult.results;
        nonConfirmationErrors = executionResult.errors;
        nonConfirmationArtifacts = executionResult.storedArtifacts;
        
        console.log(`[Confirmation] ✅ Non-confirmation agents completed. Results: ${Object.keys(nonConfirmationResults).length}, Errors: ${Object.keys(nonConfirmationErrors).length}`);
      }
      
      // Debug: Log timeline events being stored
      const timelineEventsToStore = timeline ? timeline.getEvents() : [];
      console.log(`[Confirmation] 📊 Storing ${timelineEventsToStore.length} initial timeline events with action chain`);
      if (timelineEventsToStore.length > 0) {
        console.log(`[Confirmation] 📊 First event type: ${timelineEventsToStore[0]?.type}, Last event type: ${timelineEventsToStore[timelineEventsToStore.length - 1]?.type}`);
      }
      
      const chainResult = confirmationStore.storeActionChain(
        userId,
        confirmationRequiredActions,
        query,
        conversationHistory,
        conversationId,
        undefined,  // ttlMs - use default
        timelineEventsToStore,  // Pass timeline events from initial query
        analysis  // Pass original analysis for sequential multi-agent execution
      );

      if (chainResult) {
        const firstAction = confirmationRequiredActions[0];
        return {
          results: nonConfirmationResults,  // ✅ Include results from non-confirmation agents
          errors: nonConfirmationErrors,    // ✅ Include errors from non-confirmation agents
          storedArtifacts: nonConfirmationArtifacts,  // ✅ Include artifacts from non-confirmation agents
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
      
      // ✅ CRITICAL FIX: Execute non-confirmation agents BEFORE storing confirmation
      let nonConfirmationResults = {};
      let nonConfirmationErrors = {};
      let nonConfirmationArtifacts = [];
      
      if (nonConfirmationAgents.length > 0) {
        console.log(`[Confirmation] 🚀 Executing ${nonConfirmationAgents.length} non-confirmation agents in parallel: ${nonConfirmationAgents.join(', ')}`);
        
        // Create a modified analysis with only non-confirmation agents
        const nonConfirmationAnalysis = {
          ...analysis,
          agents: nonConfirmationAgents,
          queries: Object.fromEntries(
            nonConfirmationAgents.map(agent => [agent, analysis.queries[agent]])
          )
        };
        
        // Execute non-confirmation agents
        const executionResult = await this.executeAgentQueries(
          nonConfirmationAnalysis, 
          userId, 
          conversationId, 
          userLocation, 
          timeline, 
          conversationHistory,
          query
        );
        
        nonConfirmationResults = executionResult.results;
        nonConfirmationErrors = executionResult.errors;
        nonConfirmationArtifacts = executionResult.storedArtifacts;
        
        console.log(`[Confirmation] ✅ Non-confirmation agents completed. Results: ${Object.keys(nonConfirmationResults).length}, Errors: ${Object.keys(nonConfirmationErrors).length}`);
      }
      
      const requestId = confirmationStore.storePendingAction(
        userId,
        action.toolName,
        action.agentName,
        action.params,
        action.previewContent,
        query,
        conversationHistory,
        conversationId,
        undefined,  // ttlMs - use default
        timeline ? timeline.getEvents() : [],  // Pass timeline events from initial query
        analysis,  // Pass original analysis for sequential multi-agent execution
        nonConfirmationResults,  // Pass results from non-confirmation agents
        this.lastFileIds || []  // ✅ NEW: Pass fileIds for attachment support
      );

      return {
        results: nonConfirmationResults,  // ✅ Include results from non-confirmation agents
        errors: nonConfirmationErrors,    // ✅ Include errors from non-confirmation agents
        storedArtifacts: nonConfirmationArtifacts,  // ✅ Include artifacts from non-confirmation agents
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
    // Pass conversationId for artifact storage, userLocation for Maps agent, and conversationHistory for context
    const { results, errors, storedArtifacts } = await this.executeAgentQueries(analysis, userId, conversationId, userLocation, timeline, conversationHistory, query);
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
  async detectConfirmationRequiredAction(agentName, agentQuery, userId = null, conversationHistory = []) {
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
          isAsync: false,
          // Skip confirmation if query involves content generation or updating - let docs agent LLM handle the full flow
          excludePatterns: ['add content', 'with content', 'write content', 'accordingly', 'about', 'generate', 'populate', 'update', 'append', 'add to', 'add this', 'add the', 'add my', 'add that', 'add it', 'put this', 'put the', 'put my', 'into a new', 'summary', 'modify', 'edit', 'change', 'first', 'second', 'both']
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
          // README.md create/update (single action that safely handles both cases)
          patterns: ['create', 'update', 'make', 'write', 'generate'],
          keywords: ['readme', 'readme.md'],
          toolName: 'upsertReadme',
          extractParams: (q, userId, history) => this.extractGithubParamsWithLLM('upsertReadme', q, userId, history),
          isAsync: true,
          // Avoid firing when user is explicitly creating a new repository named README, etc.
          excludePatterns: ['new repository', 'new repo', 'create repository', 'create repo']
        },
        {
          // Create or update a file when user explicitly asks for both (prevents 422 / missing sha)
          patterns: ['if exists', 'already exists', 'create or update', 'update it if', 'if already exists'],
          keywords: ['file', '.js', '.ts', '.py', '.java', '.cpp', '.c', '.rb', '.go', '.rs', '.php', '.html', '.css', '.json', '.md', '.txt', '.xml', '.yml', '.yaml', 'index.js', 'package.json', 'readme', '.jsx', '.tsx'],
          toolName: 'upsertFile',
          extractParams: (q, userId, history) => this.extractGithubParamsWithLLM('upsertFile', q, userId, history),
          isAsync: true
        },
        {
          // File creation - check FIRST (order matters!)
          patterns: ['create', 'add', 'new', 'make'],
          keywords: ['file', '.js', '.ts', '.py', '.java', '.cpp', '.c', '.rb', '.go', '.rs', '.php', '.html', '.css', '.json', '.md', '.txt', '.xml', '.yml', '.yaml', 'index.js', 'package.json', 'readme', '.jsx', '.tsx'],
          toolName: 'createFile',
          extractParams: (q, userId, history) => this.extractGithubParamsWithLLM('createFile', q, userId, history),
          isAsync: true, // Need async to fetch GitHub username
          // Exclude if it's clearly about creating a repository
          excludePatterns: ['new repository', 'new repo', 'create repository', 'create repo']
        },
        {
          patterns: ['update', 'modify', 'edit', 'change'],
          keywords: ['file', '.js', '.ts', '.py', '.java', '.cpp', '.c', '.rb', '.go', '.rs', '.php', '.html', '.css', '.json', '.md', '.txt', '.xml', '.yml', '.yaml'],
          toolName: 'safeUpdateFile',
          extractParams: (q, userId, history) => this.extractGithubParamsWithLLM('safeUpdateFile', q, userId, history),
          isAsync: true
        },
        {
          patterns: ['delete', 'remove'],
          keywords: ['file', '.js', '.ts', '.py', '.java', '.cpp', '.c', '.rb', '.go', '.rs', '.php', '.html', '.css', '.json', '.md', '.txt', '.xml', '.yml', '.yaml'],
          toolName: 'safeDeleteFile',
          extractParams: (q, userId, history) => this.extractGithubParamsWithLLM('safeDeleteFile', q, userId, history),
          isAsync: true
        },
        {
          patterns: ['create', 'new'],
          keywords: ['repository', 'repo'],
          toolName: 'createRepository',
          extractParams: (q, userId, history) => this.extractGithubParamsWithLLM('createRepository', q, userId, history),
          isAsync: true,
          // Exclude if query mentions file paths or file extensions (likely file creation)
          excludePatterns: ['.js', '.ts', '.py', '.java', '.cpp', '.c', '.rb', '.go', '.rs', '.php', '.html', '.css', '.json', '.md', '.txt', '.xml', '.yml', '.yaml', ' with ', ' in ', 'index.js', 'package.json', 'readme']
        },
        {
          patterns: ['delete', 'remove'],
          keywords: ['repository', 'repo'],
          toolName: 'deleteRepository',
          extractParams: (q, userId, history) => this.extractGithubParamsWithLLM('deleteRepository', q, userId, history),
          isAsync: true
        },
        {
          patterns: ['create', 'open', 'file', 'new'],
          keywords: ['issue', 'bug', 'feature request'],
          toolName: 'createIssue',
          extractParams: (q, userId, history) => this.extractGithubParamsWithLLM('createIssue', q, userId, history),
          isAsync: true
        },
        {
          patterns: ['create', 'open', 'new'],
          keywords: ['pull request', 'pr'],
          toolName: 'createPullRequest',
          extractParams: (q, userId, history) => this.extractGithubParamsWithLLM('createPullRequest', q, userId, history),
          isAsync: true
        }
      ],
      gmail: [
        {
          // 🔴 PRIORITY 1: sendEmailWithAttachment - matches ONLY when user wants to attach files
          // Must be BEFORE sendEmail pattern so it takes precedence
          patterns: ['send', 'compose', 'email to', 'mail to', 'mail', 'send email'],
          keywords: ['email', 'mail', '@'],
          hasContext: ['attach', 'attachment', 'pdf', 'file', 'document', 'with file', 'include file'],  // CRITICAL: Must have attachment keywords
          toolName: 'sendEmailWithAttachment',
          extractParams: async (q, userId, conversationHistory) => {
            // ✅ Use the same email parameter extraction as sendEmail
            // This will generate AI subject/body and extract user name from Gmail account
            console.log(`[sendEmailWithAttachment] 📎 Generating email parameters with AI and user profile...`);
            
            // Call the standard email extraction with AI generation
            const emailParams = await this.extractEmailParamsWithAI(q, userId, conversationHistory);
            
            // Add attachment context
            return {
              ...emailParams,
              fileIds: [],  // Will be populated from context
              _originalQuery: q
            };
          },
          isAsync: true,
          excludePatterns: ['read', 'show', 'get', 'find', 'search', 'check', 'what', 'list']
        },
        {
          // 🔴 PRIORITY 2: sendEmail - matches ONLY when user wants to send WITHOUT attachments
          // Only match when user explicitly wants to SEND an email (no attachments)
          // Exclude read/search/get/show/check/find/what patterns
          patterns: ['send', 'compose', 'write to', 'email to', 'mail to', 'send email'],
          keywords: ['email', 'mail', 'message', '@'],  // Added @ to catch email addresses
          toolName: 'sendEmail',
          extractParams: async (q, userId, conversationHistory) => {
            // ✅ FIRST: Try to extract email address (valid or invalid)
            const { validateEmailAddress } = require('../utils/toolParameterValidator');
            
            // Try strict regex first (valid emails)
            let emailMatch = q.match(/(?:to|send.*to|email.*to|mail.*to)\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
            let recipientEmail = emailMatch ? emailMatch[1] : null;
            
            // If no valid email found, try to capture invalid attempts
            if (!recipientEmail) {
              const invalidEmailMatch = q.match(/(?:to|send.*to|email.*to|mail.*to)\s+([^\s,]+@[^\s,]*)/i);
              if (invalidEmailMatch) {
                recipientEmail = invalidEmailMatch[1];
              } else {
                // Try even more lenient - anything after "to" that looks email-ish
                const looseMatch = q.match(/(?:to|send.*to|email.*to|mail.*to)\s+([a-zA-Z0-9._%+-]+(?:@[a-zA-Z0-9.-]*)?)/i);
                if (looseMatch) {
                  recipientEmail = looseMatch[1];
                } else {
                  // Try without "to" - just look for email-like patterns
                  const anyEmailMatch = q.match(/\b([a-zA-Z0-9][a-zA-Z0-9._-]*(?:@[a-zA-Z0-9.-]*)?)\b/i);
                  if (anyEmailMatch && (anyEmailMatch[1].includes('@') || anyEmailMatch[1].includes('-'))) {
                    recipientEmail = anyEmailMatch[1];
                  }
                }
              }
            }
            
            // ✅ CRITICAL: Validate email IMMEDIATELY if found
            if (recipientEmail && recipientEmail !== 'pending') {
              try {
                recipientEmail = validateEmailAddress(recipientEmail);
                console.log(`[Confirmation] ✅ Email validated: ${recipientEmail}`);
              } catch (error) {
                console.error(`[Confirmation] ❌ Invalid email: ${recipientEmail}`);
                // Throw error immediately - this will be caught and returned as error object
                throw new Error(
                  `Invalid email address: "${recipientEmail}".\n\n` +
                  (recipientEmail.includes('@') 
                    ? (recipientEmail.endsWith('@')
                      ? `The email is incomplete. Missing domain after @\n\nDid you mean:\n• ${recipientEmail.slice(0, -1)}@gmail.com\n• ${recipientEmail.slice(0, -1)}@outlook.com\n• ${recipientEmail.slice(0, -1)}@company.com`
                      : !recipientEmail.includes('.')
                      ? `Email domain is missing extension (.com, .org, etc.)\n\nDid you mean:\n• ${recipientEmail}.com\n• ${recipientEmail}.org\n• ${recipientEmail}.net`
                      : `Please provide a valid email address in the format: name@domain.com`)
                    : `Email addresses must contain an @ symbol.\n\nDid you mean:\n• ${recipientEmail}@gmail.com\n• ${recipientEmail}@outlook.com\n• ${recipientEmail}@company.com`)
                );
              }
            }
            
            // ✅ Check if this email depends on another action (like calendar event)
            // BUT only defer if user hasn't provided complete subject AND body
            const hasDependency = q.includes('meeting') || q.includes('event') || q.includes('calendar') || 
                                 q.includes('form') || q.includes('document') || q.includes('sheet') ||
                                 q.includes('link') || q.includes('with its') || q.includes('with the');
            
            // ✅ CRITICAL: Check if user provided explicit subject and body
            const hasExplicitSubject = q.match(/(?:with\s+)?subject\s+['""]?(.+?)['""]?(?:\s+and|\s+message|\s*$)/i);
            const hasExplicitBody = q.match(/(?:and\s+)?message\s+['""]?(.+?)['""]?(?:\s+to|\s*$)/i) ||
                                   q.match(/saying\s+['""]?(.+?)['""]?(?:\s+to|\s*$)/i);
            
            // Only defer if has dependency AND user didn't provide complete content
            if (hasDependency && (!hasExplicitSubject || !hasExplicitBody)) {
              // ✅ DON'T generate email yet - we don't have the dependency results!
              console.log(`[Confirmation] 📧 Email has dependency - deferring generation`);
              
              // ✅ Check conversation history for email if not found in query
              if (!recipientEmail && conversationHistory && conversationHistory.length > 0) {
                const recentMessages = conversationHistory.slice(-10);
                for (const msg of recentMessages.reverse()) {
                  const historyEmailMatch = msg.content?.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
                  if (historyEmailMatch) {
                    try {
                      recipientEmail = validateEmailAddress(historyEmailMatch[1]);
                      console.log(`[Confirmation] ✅ Found and validated email in conversation history: ${recipientEmail}`);
                      break;
                    } catch (error) {
                      console.log(`[Confirmation] ⚠️ Found invalid email in history: ${historyEmailMatch[1]}`);
                      continue;
                    }
                  }
                }
              }
              
              // ✅ FINAL CHECK: If still no valid email, throw error
              if (!recipientEmail) {
                throw new Error(
                  'No valid email address found.\n\nPlease specify a recipient email address.\n\nExamples:\n• Send email to john@gmail.com about the meeting\n• Email contact@company.com with project update'
                );
              }
              
              return {
                to: recipientEmail,
                subject: '⏳ Will be generated after previous action completes',
                body: 'Email content will be generated with actual details from the previous action.',
                _deferredGeneration: true,  // ✅ Mark for later generation
                _originalQuery: q
              };
            } else {
              // No dependency - generate email now
              return await this.extractEmailParamsWithAI(q, userId, conversationHistory);
            }
          },
          isAsync: true,  // Changed to async for AI generation
          excludePatterns: ['read', 'show', 'get', 'find', 'search', 'check', 'what', 'list', 'unread', 'recent', 'latest', 'inbox', 'attach', 'attachment', 'pdf', 'file', 'document', 'with file', 'include file']  // Exclude attachment keywords - they should use sendEmailWithAttachment
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
      ],
      microsoft: [
        {
          // Match Outlook/Microsoft email sending
          patterns: ['send', 'compose', 'write to', 'email to', 'mail to'],
          keywords: ['outlook', 'microsoft', 'hotmail', 'email', 'mail', 'message'],
          toolName: 'microsoft_sendEmail',
          extractParams: (q, userId, conversationHistory) => this.extractMicrosoftEmailParamsWithAI(q, userId, conversationHistory),
          isAsync: true,
          excludePatterns: ['read', 'show', 'get', 'find', 'search', 'check', 'what', 'list', 'unread', 'recent', 'latest', 'inbox']
        },
        {
          patterns: ['reply', 'respond'],
          keywords: ['outlook', 'microsoft', 'email', 'mail'],
          toolName: 'microsoft_replyToEmail',
          extractParams: () => ({ messageId: 'pending', body: 'pending' }),
          isAsync: false
        },
        {
          patterns: ['forward'],
          keywords: ['outlook', 'microsoft', 'email', 'mail'],
          toolName: 'microsoft_forwardEmail',
          extractParams: () => ({ messageId: 'pending', to: 'pending' }),
          isAsync: false
        },
        {
          patterns: ['create', 'schedule', 'add', 'book', 'set up'],
          keywords: ['microsoft calendar', 'outlook calendar', 'teams meeting', 'event'],
          toolName: 'microsoft_createCalendarEvent',
          extractParams: (q) => this.extractMicrosoftCalendarEventParams(q),
          isAsync: false
        },
        {
          patterns: ['list', 'show', 'get', 'check'],
          keywords: ['onedrive', 'files', 'documents'],
          toolName: 'microsoft_listFiles',
          extractParams: () => ({}),
          isAsync: false
        },
        {
          patterns: ['upload'],
          keywords: ['onedrive', 'file'],
          toolName: 'microsoft_uploadFile',
          extractParams: () => ({ fileName: 'pending', content: 'pending' }),
          isAsync: false
        },
        {
          patterns: ['create', 'make', 'new'],
          keywords: ['word', 'document', 'doc'],
          toolName: 'microsoft_createWordDocument',
          extractParams: (q) => this.extractWordDocumentParams(q),
          isAsync: false
        }
      ]
    };

    const agentPatterns = patterns[agentName];
    if (!agentPatterns) return null;

    console.log(`[detectConfirmationRequiredAction] 🔍 Checking ${agentName} with query: "${agentQuery}"`);
    console.log(`[detectConfirmationRequiredAction] 📋 Found ${agentPatterns.length} patterns to check`);

    for (const pattern of agentPatterns) {
      const hasAction = pattern.patterns.some(p => query.includes(p));
      const hasTarget = pattern.keywords.some(k => query.includes(k));
      
      // Check for context patterns (e.g., attachment keywords for sendEmailWithAttachment)
      const hasContext = pattern.hasContext 
        ? pattern.hasContext.some(c => query.includes(c))
        : true;  // If no hasContext requirement, always pass
      
      // Check for exclusion patterns - if any exclusion pattern is found, skip this pattern
      // Use word boundaries to avoid false positives (e.g., "budget" shouldn't match "get")
      const hasExclusion = pattern.excludePatterns 
        ? pattern.excludePatterns.some(p => {
            // Create regex with word boundaries to match whole words only
            const regex = new RegExp(`\\b${p}\\b`, 'i');
            const matches = regex.test(query);
            if (matches) {
              console.log(`[detectConfirmationRequiredAction]       ⚠️ Exclusion pattern matched: "${p}"`);
            }
            return matches;
          })
        : false;
      
      console.log(`[detectConfirmationRequiredAction]   Tool: ${pattern.toolName}`);
      console.log(`[detectConfirmationRequiredAction]     hasAction: ${hasAction} (patterns: ${pattern.patterns.join(', ')})`);
      console.log(`[detectConfirmationRequiredAction]     hasTarget: ${hasTarget} (keywords: ${pattern.keywords.join(', ')})`);
      if (pattern.hasContext) {
        console.log(`[detectConfirmationRequiredAction]     hasContext: ${hasContext} (context: ${pattern.hasContext.join(', ')})`);
      }
      console.log(`[detectConfirmationRequiredAction]     hasExclusion: ${hasExclusion}`);
      
      if (hasAction && hasTarget && hasContext && !hasExclusion) {
        console.log(`[detectConfirmationRequiredAction]   ✅ MATCH! Extracting params for ${pattern.toolName}`);
        // Handle async extractors (like forms with AI-generated questions, gmail with AI content)
        // Pass userId for extractors that need it (like gmail for user signature)
        try {
          const inferredParams = pattern.isAsync 
            ? await pattern.extractParams(agentQuery, userId, conversationHistory)
            : pattern.extractParams(agentQuery, userId, conversationHistory);
            
          console.log(`[detectConfirmationRequiredAction]   ✅ Params extracted successfully`);
          return {
            toolName: pattern.toolName,
            inferredParams
          };
        } catch (error) {
          // ✅ CRITICAL: Catch validation errors and return them as error objects
          console.error(`[detectConfirmationRequiredAction] ❌ Parameter extraction failed for ${pattern.toolName}:`, error.message);
          return {
            error: true,
            message: error.message || 'Failed to extract parameters',
            toolName: pattern.toolName
          };
        }
      }
    }

    console.log(`[detectConfirmationRequiredAction] ❌ No matching pattern found for ${agentName}`);
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
    
    // ✅ CRITICAL: Check for "yesterday" FIRST (before other date checks)
    if (lowerQuery.includes('yesterday')) {
      startDate.setDate(startDate.getDate() - 1);
    }
    // Check for "tomorrow"
    else if (lowerQuery.includes('tomorrow')) {
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
   * Extract Microsoft Word document parameters from query
   */
  extractWordDocumentParams(query) {
    const params = { fileName: 'Untitled Document' };
    const titleMatch = query.match(/["']([^"']+)["']/) ||
                       query.match(/called\s+([^,\.\n]+)/) ||
                       query.match(/titled\s+([^,\.\n]+)/) ||
                       query.match(/document\s+(?:about|for|on)\s+([^,\.\n]+)/i);
    if (titleMatch) {
      params.fileName = titleMatch[1].trim();
    }
    // Check if content should be added
    if (query.toLowerCase().includes('add') && query.toLowerCase().includes('content')) {
      params.content = `Generate content about ${params.fileName}`;
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
   * Extract GitHub README parameters from query.
   * Used for \"create/update README.md\" intents; execution generates content with AI in GitHub agent.
   */
  async extractGitHubReadmeParams(query, userId = null) {
    const base = await this.extractGitHubFileParams(query, userId);
    return {
      owner: base.owner,
      repo: base.repo,
      path: 'README.md',
      // Optional hint for agent; default branch is resolved there.
      ref: base.ref
    };
  }

  /**
   * Extract GitHub file creation/update parameters from query
   * Handles: "Create index.js with console.log('Hello') in my-project repository"
   */
  async extractGitHubFileParams(query, userId = null) {
    const params = { 
      owner: 'pending', 
      repo: 'pending', 
      path: 'pending', 
      content: 'pending', 
      message: 'Create file'
    };
    
    // Extract file path/name (look for file extensions or common file names)
    const filePathPatterns = [
      /(?:create|add|make|update|edit|delete|remove)\s+([^\s]+\.(js|ts|py|java|cpp|c|rb|go|rs|php|html|css|json|md|txt|xml|yml|yaml|jsx|tsx))/i,
      /(?:create|add|make|update|edit|delete|remove)\s+([^\s]+)\s+(?:with|containing|in)/i,
      /(?:file|path)\s+["']?([^"'\s]+)["']?/i,
      /index\.js|package\.json|readme|readme\.md/i
    ];
    
    for (const pattern of filePathPatterns) {
      const match = query.match(pattern);
      if (match) {
        params.path = match[1] || match[0];
        break;
      }
    }
    
    // Extract repository name (favor "<name> repository" and "in <name> repo")
    const repoPatterns = [
      /([^\s]+)\s+repository/i,
      /([^\s]+)\s+repo/i,
      /in\s+([^\s]+)\s+repository/i,
      /in\s+([^\s]+)\s+repo/i
    ];
    
    for (const pattern of repoPatterns) {
      const match = query.match(pattern);
      if (match && match[1] && !match[1].includes('.')) { // Exclude file paths
        params.repo = match[1].trim();
        break;
      }
    }
    
    // Extract file content (look for "with <content>" or "containing <content>")
    const contentPatterns = [
      /with\s+["']([^"']+)["']/i,
      /with\s+([^"']+?)(?:\s+in|\s+repository|\s+repo|$)/i,
      /containing\s+["']([^"']+)["']/i,
      /containing\s+([^"']+?)(?:\s+in|\s+repository|\s+repo|$)/i,
      /console\.log\([^)]+\)/i,
      /["']([^"']+)["']/i
    ];
    
    for (const pattern of contentPatterns) {
      const match = query.match(pattern);
      if (match && match[1] && !match[1].includes('repository') && !match[1].includes('repo')) {
        params.content = match[1].trim();
        break;
      }
    }
    
    // Generate commit message
    if (query.toLowerCase().includes('create') || query.toLowerCase().includes('add')) {
      params.message = `Create ${params.path || 'file'}`;
    } else if (query.toLowerCase().includes('update') || query.toLowerCase().includes('modify')) {
      params.message = `Update ${params.path || 'file'}`;
    } else if (query.toLowerCase().includes('delete') || query.toLowerCase().includes('remove')) {
      params.message = `Delete ${params.path || 'file'}`;
    }
    
    // Try to get GitHub username if userId is provided
    if (userId && params.owner === 'pending') {
      try {
        const supabase = require('../supabase/supabaseConnect');
        const { data } = await supabase
          .from('github_tokens')
          .select('github_username')
          .eq('user_id', userId)
          .single();
        if (data && data.github_username) {
          params.owner = data.github_username;
        }
      } catch (error) {
        console.warn('[MainAgent] Could not fetch GitHub username:', error.message);
        // Keep owner as 'pending' - GitHub agent will need to handle it
      }
    }
    
    return params;
  }

  /**
   * Extract email parameters from query
   */
  extractEmailParams(query) {
    const params = { to: '', subject: '', body: '' };
    const lowerQuery = query.toLowerCase();
    
    // Extract email address - try strict regex first
    const emailMatch = query.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
      params.to = emailMatch[1];
    } else {
      // ✅ CRITICAL: Try to capture INVALID email attempts too
      // Look for patterns like "to john@", "to invalid-email", "email to xyz@", etc.
      const invalidEmailMatch = query.match(/(?:to|send.*to|email.*to|mail.*to)\s+([^\s,]+@[^\s,]*)/i);
      if (invalidEmailMatch) {
        // Capture the invalid email so we can show user what they typed wrong
        params.to = invalidEmailMatch[1];
        console.log(`[extractEmailParams] ⚠️ Captured potentially invalid email: ${params.to}`);
      } else {
        // Try even more lenient pattern - anything after "to" that looks email-ish
        const looseMatch = query.match(/(?:to|send.*to|email.*to|mail.*to)\s+([a-zA-Z0-9._%+-]+(?:@[a-zA-Z0-9.-]*)?)/i);
        if (looseMatch) {
          params.to = looseMatch[1];
          console.log(`[extractEmailParams] ⚠️ Captured loose email pattern: ${params.to}`);
        }
      }
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
  async extractEmailParamsWithAI(query, userId, conversationHistory = []) {
    // First extract basic params using the existing method
    const basicParams = this.extractEmailParams(query);
    
    // ✅ CRITICAL: Validate email IMMEDIATELY after extraction
    const { validateEmailAddress } = require('../utils/toolParameterValidator');
    
    if (basicParams.to && basicParams.to !== 'pending' && basicParams.to !== '') {
      try {
        basicParams.to = validateEmailAddress(basicParams.to);
        console.log(`[MainAgent] ✅ Email validated: ${basicParams.to}`);
      } catch (error) {
        console.error(`[MainAgent] ❌ Invalid email in query: ${basicParams.to}`);
        
        // ✅ Provide helpful error message with suggestions
        let errorMessage = `Invalid email address: "${basicParams.to}".`;
        
        // Check common mistakes and provide suggestions
        if (!basicParams.to.includes('@')) {
          errorMessage += `\n\nEmail addresses must contain an @ symbol.\n\nDid you mean:\n• ${basicParams.to}@gmail.com\n• ${basicParams.to}@outlook.com\n• ${basicParams.to}@company.com\n\nWhat's the complete email address?`;
        } else if (basicParams.to.endsWith('@')) {
          // Extract username before @
          const username = basicParams.to.slice(0, -1);
          errorMessage += `\n\nThe email is incomplete. Missing domain after @\n\nDid you mean:\n• ${username}@gmail.com\n• ${username}@outlook.com\n• ${username}@company.com\n\nWhat's the full email address?`;
        } else if (!basicParams.to.includes('.')) {
          // Has @ but no domain extension
          const parts = basicParams.to.split('@');
          if (parts.length === 2) {
            errorMessage += `\n\nEmail domain is missing extension (.com, .org, etc.)\n\nDid you mean:\n• ${parts[0]}@${parts[1]}.com\n• ${parts[0]}@${parts[1]}.org\n• ${parts[0]}@${parts[1]}.net\n\nWhat's the complete domain?`;
          } else {
            errorMessage += `\n\nEmail addresses must have a domain extension like .com, .org, etc.\n\nPlease provide a valid email address (e.g., name@domain.com)`;
          }
        } else if (basicParams.to.includes(' ')) {
          const fixed = basicParams.to.replace(/\s+/g, '');
          errorMessage += `\n\nEmail addresses cannot contain spaces.\n\nDid you mean: ${fixed}?`;
        } else {
          errorMessage += `\n\nPlease provide a valid email address in the format: name@domain.com\n\nExamples:\n• john@gmail.com\n• contact@company.com\n• support@example.org`;
        }
        
        throw new Error(errorMessage);
      }
    }
    
    // ✅ CRITICAL: Check conversation history for email addresses if not found in query
    if (basicParams.to === 'pending' || basicParams.to === '') {
      console.log(`[MainAgent] 📧 Email address not found in query, checking conversation history...`);
      
      // Look for email addresses in recent conversation
      const recentMessages = conversationHistory.slice(-10); // Last 10 messages
      for (const msg of recentMessages.reverse()) {
        const emailMatch = msg.content?.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        if (emailMatch) {
          // Validate the email found in history
          try {
            basicParams.to = validateEmailAddress(emailMatch[1]);
            console.log(`[MainAgent] ✅ Found and validated email in conversation history: ${basicParams.to}`);
            break;
          } catch (error) {
            console.log(`[MainAgent] ⚠️ Found invalid email in history: ${emailMatch[1]}, continuing search...`);
            continue;
          }
        }
      }
      
      // Also check for references like "this email", "this mail id", "that email"
      if (basicParams.to === 'pending' || basicParams.to === '') {
        const lowerQuery = query.toLowerCase();
        if (lowerQuery.includes('this email') || lowerQuery.includes('this mail') || 
            lowerQuery.includes('that email') || lowerQuery.includes('that mail') ||
            lowerQuery.includes('above email') || lowerQuery.includes('above mail')) {
          // Look for the most recent email mentioned
          for (const msg of recentMessages.reverse()) {
            const emailMatch = msg.content?.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
            if (emailMatch) {
              try {
                basicParams.to = validateEmailAddress(emailMatch[1]);
                console.log(`[MainAgent] ✅ Resolved reference to email: ${basicParams.to}`);
                break;
              } catch (error) {
                console.log(`[MainAgent] ⚠️ Found invalid email reference: ${emailMatch[1]}, continuing search...`);
                continue;
              }
            }
          }
        }
      }
    }
    
    // ✅ FINAL CHECK: If still no valid email, throw error immediately
    if (!basicParams.to || basicParams.to === 'pending' || basicParams.to === '') {
      console.error(`[MainAgent] ❌ No valid email address found`);
      throw new Error(
        'No valid email address found.\n\nPlease specify a recipient email address.\n\nExamples:\n• Send email to john@gmail.com about the meeting\n• Email contact@company.com with project update\n• Send message to support@example.org'
      );
    }
    
    // ✅ NEW: Check for ambiguous content references
    const lowerQuery = query.toLowerCase();
    const hasAmbiguousReference = lowerQuery.match(/email\s+(this|that|it)\s+to/i) || 
                                  lowerQuery.match(/send\s+(this|that|it)\s+to/i);
    
    if (hasAmbiguousReference) {
      const reference = hasAmbiguousReference[1];
      console.warn(`[MainAgent] ⚠️ Ambiguous content reference: "${reference}"`);
      
      // Check if there's any context about what "this" refers to
      const hasSubject = query.match(/about|subject|regarding/i);
      const hasContent = query.match(/message|content|body|text/i);
      
      if (!hasSubject && !hasContent) {
        throw new Error(
          `What should I email?\n\n"${reference}" is unclear. I need to know what content to send.\n\nPlease specify:\n• The email subject (e.g., "about the meeting")\n• The message content (e.g., "with project update")\n• Or reference a specific document/message\n\nExample:\n• Email this to john@gmail.com about the quarterly report\n• Send this to contact@company.com with meeting notes`
        );
      }
    }
    
    // ============================================================
    // ✅ VALIDATE EMAIL CONTENT BEFORE AI GENERATION
    // Check if user provided subject and body explicitly
    // ============================================================
    const { validateEmailContent, formatEmailValidationErrors } = require('../utils/validation');
    
    // ✅ CRITICAL: Extract explicit subject and body from query
    const explicitSubjectMatch = query.match(/(?:with\s+)?subject\s+['""]?([^'"]+?)['""]?(?:\s+and|\s+message|\s*$)/i);
    const explicitBodyMatch = query.match(/(?:and\s+)?message\s+['""]?([^'"]+?)['""]?(?:\s*$)/i) ||
                             query.match(/saying\s+['""]?([^'"]+?)['""]?(?:\s*$)/i);
    
    const hasExplicitSubject = explicitSubjectMatch && explicitSubjectMatch[1].trim() !== '';
    const hasExplicitBody = explicitBodyMatch && explicitBodyMatch[1].trim() !== '';
    
    // If user provided BOTH subject and body explicitly, use them directly
    if (hasExplicitSubject && hasExplicitBody) {
      console.log('[MainAgent] ✅ User provided complete email content - using exact values');
      console.log(`[MainAgent]   Subject: "${explicitSubjectMatch[1]}"`);
      console.log(`[MainAgent]   Body: "${explicitBodyMatch[1]}"`);
      
      // Return the exact values user provided
      return {
        to: basicParams.to,
        subject: explicitSubjectMatch[1].trim(),
        body: explicitBodyMatch[1].trim(),
        isAIGenerated: false
      };
    }
    
    // Validate email content
    console.log('[MainAgent] 🔍 Validating email content completeness...');
    
    const validation = validateEmailContent({
      to: basicParams.to,
      subject: hasExplicitSubject ? explicitSubjectMatch[1] : '',
      body: hasExplicitBody ? explicitBodyMatch[1] : '',
      query: query
    });
    
    console.log('[MainAgent] 📊 Email validation result:', JSON.stringify(validation, null, 2));
    
    // Only reject if validation failed AND AI can't generate content
    if (!validation.isValid && !validation.canGenerateAI) {
      console.log('[MainAgent] ❌ Email content validation failed - no topic/intent found');
      
      const errorMessage = formatEmailValidationErrors(validation.errors, validation.warnings);
      throw new Error(errorMessage);
    }
    
    // If validation passed or AI can generate, continue
    if (validation.canGenerateAI && validation.topic) {
      console.log(`[MainAgent] ✅ Email topic detected: "${validation.topic}" - AI will generate content`);
    } else {
      console.log('[MainAgent] ✅ Email content validation passed - using provided content');
    }
    
    try {
      console.log(`[MainAgent] Generating AI email content for preview...`);
      
      // Detect if this is a meeting invitation email
      const lowerQuery = query.toLowerCase();
      const isMeetingEmail = lowerQuery.includes('meeting') || 
                            lowerQuery.includes('meet') || 
                            lowerQuery.includes('calendar') || 
                            lowerQuery.includes('event') ||
                            lowerQuery.includes('schedule') ||
                            lowerQuery.includes('appointment');
      
      console.log(`[MainAgent] Email type detected: ${isMeetingEmail ? 'MEETING INVITATION' : 'GENERAL EMAIL'}`);
      
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
      
      // Generate the AI email body with context-aware instructions
      const systemPrompt = isMeetingEmail 
        ? `You are an email writing assistant specializing in MEETING INVITATIONS. Generate a complete, well-formatted meeting invitation email with:
1. A warm, appropriate greeting (e.g., "Hi [name]," or "Dear [name],")
2. The main message body explaining the meeting purpose and inviting them to attend
3. A note that the meeting link/details will be included (use placeholder like "[Meeting Link]" or "The meeting link is included below")
4. A proper sign-off with the sender's name

CRITICAL: This is a MEETING INVITATION email. Focus on:
- Inviting the recipient to a meeting/event
- Mentioning that meeting details/link will be provided
- DO NOT talk about documents, files, or forms being shared
- Keep it professional and clear about the meeting purpose

IMPORTANT - EMOJI CONSTRAINT:
⚠️ NEVER use ANY emojis, emoji characters, or special Unicode symbols in the email.
Use ONLY standard English text, numbers, and common punctuation marks (. , ! ? - etc.)
Do NOT include: 🎓 📧 🔗 ✓ ✅ 📋 📎 or any other emoji characters.

Only output the email body text. Do not include "Subject:" line.
Make the email feel natural and personal, not robotic.
${userName ? `The sender's name is "${userName}" - include this after "Best regards" or similar sign-off.` : 'End with "Best regards" as the sign-off.'}`
        : `You are an email writing assistant. Generate a complete, well-formatted email with:
1. A warm, appropriate greeting (e.g., "Hi [name]," or "Dear [name],")
2. The main message body (friendly, professional tone as appropriate)
3. A proper sign-off with the sender's name

IMPORTANT - EMOJI CONSTRAINT:
⚠️ NEVER use ANY emojis, emoji characters, or special Unicode symbols in the email.
Use ONLY standard English text, numbers, and common punctuation marks (. , ! ? - etc.)
Do NOT include: 🎓 📧 🔗 ✓ ✅ 📋 📎 or any other emoji characters.

Only output the email body text. Do not include "Subject:" line.
Make the email feel natural and personal, not robotic.
${userName ? `The sender's name is "${userName}" - include this after "Best regards" or similar sign-off.` : 'End with "Best regards" as the sign-off.'}`;
      
      const userPrompt = isMeetingEmail
        ? `Write a MEETING INVITATION email for:
To: ${basicParams.to}
Subject: ${basicParams.subject}
Context/Intent from user: "${query}"

This is a meeting invitation. Focus on inviting them to the meeting and mention that the meeting link will be included.
Make it ${query.toLowerCase().includes('lovely') || query.toLowerCase().includes('exciting') || query.toLowerCase().includes('friendly') || query.toLowerCase().includes('party') || query.toLowerCase().includes('birthday') ? 'warm, lovely, and exciting' : 'professional and friendly'}.`
        : `Write an email for:
To: ${basicParams.to}
Subject: ${basicParams.subject}
Context/Intent from user: "${query}"

Make it ${query.toLowerCase().includes('lovely') || query.toLowerCase().includes('exciting') || query.toLowerCase().includes('friendly') || query.toLowerCase().includes('party') || query.toLowerCase().includes('birthday') ? 'warm, lovely, and exciting' : 'professional and friendly'}.`;
      
      // Generate the AI email body
      const generationResponse = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userPrompt
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
              content: "Generate a short, catchy email subject line (max 60 chars). Only output the subject text, nothing else. Do not use quotes. CRITICAL: NEVER use any emojis, emoji characters, or special Unicode symbols. Use only standard English text and common punctuation."
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
   * Extract Microsoft Outlook email parameters with AI-generated content
   * Similar to extractEmailParamsWithAI but uses Microsoft profile data
   */
  async extractMicrosoftEmailParamsWithAI(query, userId, conversationHistory = []) {
    // First extract basic params using the existing method
    const basicParams = this.extractEmailParams(query);
    
    // ✅ CRITICAL: Check conversation history for email addresses if not found in query
    if (basicParams.to === 'pending' || basicParams.to === '') {
      console.log(`[MainAgent] 📧 Email address not found in query, checking conversation history...`);
      
      // Look for email addresses in recent conversation
      const recentMessages = conversationHistory.slice(-10); // Last 10 messages
      for (const msg of recentMessages.reverse()) {
        const emailMatch = msg.content?.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        if (emailMatch) {
          basicParams.to = emailMatch[1];
          console.log(`[MainAgent] ✅ Found email in conversation history: ${basicParams.to}`);
          break;
        }
      }
      
      // Also check for references like "this email", "this mail id", "that email"
      if (basicParams.to === 'pending' || basicParams.to === '') {
        const lowerQuery = query.toLowerCase();
        if (lowerQuery.includes('this email') || lowerQuery.includes('this mail') || 
            lowerQuery.includes('that email') || lowerQuery.includes('that mail') ||
            lowerQuery.includes('above email') || lowerQuery.includes('above mail')) {
          // Look for the most recent email mentioned
          for (const msg of recentMessages.reverse()) {
            const emailMatch = msg.content?.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
            if (emailMatch) {
              basicParams.to = emailMatch[1];
              console.log(`[MainAgent] ✅ Resolved reference to email: ${basicParams.to}`);
              break;
            }
          }
        }
      }
    }
    
    try {
      console.log(`[MainAgent] Generating AI email content for Microsoft Outlook...`);
      
      // Detect if this is a meeting invitation email
      const lowerQuery = query.toLowerCase();
      const isMeetingEmail = lowerQuery.includes('meeting') || 
                            lowerQuery.includes('meet') || 
                            lowerQuery.includes('calendar') || 
                            lowerQuery.includes('event') ||
                            lowerQuery.includes('schedule') ||
                            lowerQuery.includes('appointment');
      
      console.log(`[MainAgent] Microsoft email type detected: ${isMeetingEmail ? 'MEETING INVITATION' : 'GENERAL EMAIL'}`);
      
      // Try to get user's display name from Microsoft tokens
      let userName = '';
      try {
        const supabase = require('../supabase/supabaseConnect');
        
        // First try: Get from microsoft_tokens (has name from Microsoft profile)
        const { data: microsoftData, error: microsoftError } = await supabase
          .from('microsoft_tokens')
          .select('name, email')
          .eq('user_id', userId)
          .single();
        
        if (!microsoftError && microsoftData?.name) {
          userName = microsoftData.name;
          console.log(`[MainAgent] Got user display name from microsoft_tokens: "${userName}"`);
        }
        
        // Second try: Get from Supabase Auth profile
        if (!userName) {
          const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
          
          if (!userError && userData?.user) {
            userName = userData.user.user_metadata?.full_name || 
                       userData.user.user_metadata?.name ||
                       userData.user.user_metadata?.display_name || '';
            if (userName) {
              console.log(`[MainAgent] Got user display name from auth: "${userName}"`);
            }
          }
        }
        
        if (!userName) {
          console.log(`[MainAgent] No display name found for Microsoft user`);
        }
      } catch (dbError) {
        console.log(`[MainAgent] Could not get Microsoft user name: ${dbError.message}`);
      }
      
      // Generate the AI email body with context-aware instructions
      const systemPrompt = isMeetingEmail 
        ? `You are an email writing assistant specializing in MEETING INVITATIONS. Generate a complete, well-formatted meeting invitation email with:
1. A warm, appropriate greeting (e.g., "Hi [name]," or "Dear [name],")
2. The main message body explaining the meeting purpose and inviting them to attend
3. A note that the meeting link/details will be included (use placeholder like "[Meeting Link]" or "The meeting link is included below")
4. A proper sign-off with the sender's name

CRITICAL: This is a MEETING INVITATION email. Focus on:
- Inviting the recipient to a meeting/event
- Mentioning that meeting details/link will be provided
- DO NOT talk about documents, files, or forms being shared
- Keep it professional and clear about the meeting purpose

IMPORTANT - EMOJI CONSTRAINT:
⚠️ NEVER use ANY emojis, emoji characters, or special Unicode symbols in the email.
Use ONLY standard English text, numbers, and common punctuation marks (. , ! ? - etc.)
Do NOT include: 🎓 📧 🔗 ✓ ✅ 📋 📎 or any other emoji characters.

Only output the email body text. Do not include "Subject:" line.
Make the email feel natural and personal, not robotic.
${userName ? `The sender's name is "${userName}" - include this after "Best regards" or similar sign-off.` : 'End with "Best regards" as the sign-off.'}`
        : `You are an email writing assistant. Generate a complete, well-formatted email with:
1. A warm, appropriate greeting (e.g., "Hi [name]," or "Dear [name],")
2. The main message body (friendly, professional tone as appropriate)
3. A proper sign-off with the sender's name

IMPORTANT - EMOJI CONSTRAINT:
⚠️ NEVER use ANY emojis, emoji characters, or special Unicode symbols in the email.
Use ONLY standard English text, numbers, and common punctuation marks (. , ! ? - etc.)
Do NOT include: 🎓 📧 🔗 ✓ ✅ 📋 📎 or any other emoji characters.

Only output the email body text. Do not include "Subject:" line.
Make the email feel natural and personal, not robotic.
${userName ? `The sender's name is "${userName}" - include this after "Best regards" or similar sign-off.` : 'End with "Best regards" as the sign-off.'}`;
      
      const userPrompt = isMeetingEmail
        ? `Write a MEETING INVITATION email for:
To: ${basicParams.to}
Subject: ${basicParams.subject}
Context/Intent from user: "${query}"

This is a meeting invitation. Focus on inviting them to the meeting and mention that the meeting link will be included.
Make it ${query.toLowerCase().includes('lovely') || query.toLowerCase().includes('exciting') || query.toLowerCase().includes('friendly') || query.toLowerCase().includes('party') || query.toLowerCase().includes('birthday') ? 'warm, lovely, and exciting' : 'professional and friendly'}.`
        : `Write an email for:
To: ${basicParams.to}
Subject: ${basicParams.subject}
Context/Intent from user: "${query}"

Make it ${query.toLowerCase().includes('lovely') || query.toLowerCase().includes('exciting') || query.toLowerCase().includes('friendly') || query.toLowerCase().includes('party') || query.toLowerCase().includes('birthday') ? 'warm, lovely, and exciting' : 'professional and friendly'}.`;
      
      // Generate the AI email body
      const generationResponse = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userPrompt
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
              content: "Generate a short, catchy email subject line (max 60 chars). Only output the subject text, nothing else. Do not use quotes. CRITICAL: NEVER use any emojis, emoji characters, or special Unicode symbols. Use only standard English text and common punctuation."
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
      
      console.log(`[MainAgent] AI generated Microsoft email subject: ${finalSubject}`);
      console.log(`[MainAgent] AI generated Microsoft email body preview: ${aiGeneratedBody.substring(0, 100)}...`);
      
      return {
        to: basicParams.to,
        subject: finalSubject,
        body: aiGeneratedBody,
        isAIGenerated: true,  // Flag to prevent re-generation in microsoftAgent
        userName: userName || null
      };
      
    } catch (error) {
      console.error(`[MainAgent] Error generating AI Microsoft email content:`, error);
      // Fall back to basic params if AI generation fails
      return basicParams;
    }
  }

  /**
   * Extract Microsoft Calendar event parameters from query
   */
  extractMicrosoftCalendarEventParams(query) {
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();
    
    const lowerQuery = query.toLowerCase();
    
    // Parse date
    if (lowerQuery.includes('tomorrow')) {
      startDate.setDate(startDate.getDate() + 1);
    } else if (lowerQuery.includes('today')) {
      // Keep current date
    }
    
    // Parse time
    const timeMatch = query.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      const ampm = timeMatch[3]?.toLowerCase();
      
      if (ampm === 'pm' && hours < 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;
      
      startDate.setHours(hours, minutes, 0, 0);
      endDate = new Date(startDate);
      endDate.setHours(endDate.getHours() + 1);
    } else {
      startDate.setHours(10, 0, 0, 0);
      endDate.setHours(11, 0, 0, 0);
    }
    
    // Extract title
    let subject = 'Meeting';
    const titleMatch = query.match(/(?:titled?|called?|named?|about|for)\s+["']?([^"']+)["']?/i);
    if (titleMatch) {
      subject = titleMatch[1].trim();
    }
    
    // Check for Teams meeting
    const isOnlineMeeting = lowerQuery.includes('teams') || lowerQuery.includes('video') || lowerQuery.includes('online');
    
    return {
      subject: subject,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      isOnlineMeeting: isOnlineMeeting
    };
  }

  /**
   * Stream response after a confirmed action is executed
   * This provides a smooth word-by-word streaming experience like ChatGPT
   * Now includes context about next actions in chain
   */
  async streamConfirmedActionResponse(executionResult, onChunk, timeline = null) {
    try {
      onChunk({ type: 'status', message: 'Processing your confirmed action...' });
      if (timeline) timeline.emitGeneratingResponse();

      const { result, results, initialResults, query, toolName, agentName, nextConfirmation } = executionResult;

      // ✅ CRITICAL: Detect language from the original query using LLM
      const languageDetection = require('../utils/languageDetection');
      const detectedLanguage = await languageDetection.detectLanguage(query);
      const languageInstruction = languageDetection.getLanguageInstruction(detectedLanguage);
      const languageName = languageDetection.getLanguageName(detectedLanguage);
      console.log(`[MainAgent] 🌐 streamConfirmedActionResponse using language: ${languageName} (${detectedLanguage})`);
      
      // ✅ CRITICAL: Combine initialResults with execution results
      // For sequential multi-agent tasks, use 'results' (all agents)
      // For single agent tasks, use 'result' (one agent)
      let allResults;
      if (results && typeof results === 'object' && Object.keys(results).length > 0) {
        // Sequential multi-agent execution: results contains all agents
        allResults = {
          ...initialResults,  // Results from non-confirmation agents executed in parallel
          ...results  // Results from all agents in sequential execution
        };
      } else {
        // Single agent execution
        allResults = {
          ...initialResults,  // Results from non-confirmation agents
          [agentName]: result  // Result from confirmed agent
        };
      }
      
      console.log(`[MainAgent] 📊 Combined results from agents: ${Object.keys(allResults).join(', ')}`);

      // Build context about chain status
      let chainContext = '';
      const multipleAgentsCompleted = Object.keys(allResults).length > 1;
      
      console.log(`[MainAgent] 📝 Response generation context:`, {
        multipleAgentsCompleted,
        hasNextConfirmation: !!nextConfirmation,
        nextAction: nextConfirmation?.toolName || 'none'
      });
      
      if (nextConfirmation) {
        // There's a next action waiting for confirmation
        chainContext = `\n\nIMPORTANT: This is step ${nextConfirmation.chainInfo.currentStep - 1} of ${nextConfirmation.chainInfo.totalSteps} in the user's request.
The next step is: ${nextConfirmation.toolName} (${nextConfirmation.agentName})
After confirming this action was successful, mention that you'll now proceed with the next action (${nextConfirmation.description}).
Do NOT say "let me know if you need anything else" - there's still more to do.`;
      } else if (multipleAgentsCompleted) {
        // All actions in chain are complete - make this VERY clear to the LLM
        console.log(`[MainAgent] ✅ All ${Object.keys(allResults).length} actions completed - enforcing past tense in response`);
        chainContext = `\n\n✅ CRITICAL: ALL requested actions have been COMPLETED successfully.
This was a multi-step task and EVERY step is now DONE.
- Do NOT use future tense like "I will now..." or "I will proceed..."
- Do NOT say you're going to do something - everything is ALREADY done
- Clearly state that ALL tasks have been completed
- Present the results from all actions cohesively
- Use past tense: "I have created...", "Both the form and spreadsheet have been created..."`;
      }

      // Safely stringify result, handling circular references
      let resultString;
      try {
        // ✅ CRITICAL: Handle sequential multi-agent execution results
        if (results && typeof results === 'object' && !result) {
          // Sequential multi-agent execution: results = { websearch: {...}, docs: {...}, sheets: {...}, ... }
          const safeResults = {};
          for (const [agentKey, agentResult] of Object.entries(results)) {
            const rawResult = agentResult?.raw_results?.[0] || {};
            safeResults[agentKey] = {
              success: agentResult?.success,
              response: agentResult?.response,
              summary: agentResult?.summary,
              // Extract URLs and IDs from each agent
              documentId: rawResult.documentId || agentResult?.documentId,
              documentUrl: rawResult.url || agentResult?.url,
              formId: rawResult.formId || agentResult?.formId,
              eventId: rawResult.eventId || agentResult?.eventId,
              messageId: rawResult.messageId || agentResult?.messageId,
              // Sheets-specific fields
              spreadsheetId: rawResult.spreadsheetId || agentResult?.spreadsheetId,
              spreadsheetUrl: rawResult.url || agentResult?.url,
              rowsAdded: rawResult.rowsAdded || agentResult?.rowsAdded,
              // Schedules-specific fields
              scheduleId: rawResult.scheduleId || agentResult?.scheduleId,
              nextExecution: rawResult.nextExecutionLocal || rawResult.nextExecution,
            };
          }
          resultString = JSON.stringify(safeResults, null, 2);
        } else {
          // Single agent execution
          const rawResult = result?.raw_results?.[0] || {};
          const safeResult = {
            success: result?.success,
            response: result?.response,
            message: result?.message,
            // For forms
            formId: rawResult.formId || result?.formId,
            formTitle: rawResult.form?.info?.title || result?.form?.info?.title,
            formUrl: rawResult.formId ? 
              `https://docs.google.com/forms/d/${rawResult.formId}/viewform` : null,
            // For emails (Google)
            emailSent: rawResult.success && (toolName === 'sendEmail' || toolName === 'microsoft_sendEmail'),
            messageId: rawResult.messageId,
            // For Google docs
            documentId: rawResult.documentId || result?.documentId,
            documentUrl: rawResult.documentId && agentName !== 'microsoft' ? 
              `https://docs.google.com/document/d/${rawResult.documentId}/edit` : null,
            // For events
            eventId: rawResult.eventId || result?.eventId,
            // Microsoft-specific fields
            msDocumentId: rawResult.documentId || rawResult.id || rawResult.itemId,
            msDocumentName: rawResult.name,
            msWebUrl: rawResult.webUrl,
            msWorkbookId: rawResult.workbookId,
            // Excel sample data
            sampleDataAdded: rawResult.sampleDataAdded || result?.sampleDataAdded,
            sampleDataRows: rawResult.sampleDataRows || result?.sampleDataRows,
            // Generic error
            error: result?.error
          };
          
          // Build a more informative result string for Microsoft
          if (agentName === 'microsoft' && rawResult.webUrl) {
            safeResult.microsoftLink = rawResult.webUrl;
            safeResult.microsoftFileName = rawResult.name;
          }
          
          resultString = JSON.stringify(safeResult, null, 2);
        }
      } catch (e) {
        console.error('[MainAgent] Error stringifying result:', e.message);
        resultString = `Action completed: ${result?.success || executionResult?.success ? 'Successfully' : 'With issues'}. ${result?.response || result?.message || ''}`;
      }

      const responsePrompt = `The user's original request was: "${query}"

Multiple actions were performed:

${Object.entries(allResults).map(([agent, agentResult]) => {
  const rawResult = agentResult?.raw_results?.[0] || agentResult || {};
  
  // Extract websearch synthesized content if available
  let websearchContent = null;
  if (agent === 'websearch' && agentResult?.executedActions) {
    const researchAction = agentResult.executedActions.find(
      action => action.tool === 'researchAndSynthesize' || action.tool === 'fetchAndSynthesize'
    );
    if (researchAction?.result?.synthesizedContent) {
      websearchContent = researchAction.result.synthesizedContent;
    }
  }
  
  return `${agent.toUpperCase()} Agent:
${JSON.stringify({
  success: agentResult?.success,
  response: agentResult?.response,
  summary: agentResult?.summary,
  // Websearch-specific
  synthesizedContent: websearchContent,
  sourcesUsed: rawResult.sourcesUsed,
  // Weather-specific
  temperature: rawResult.current_weather?.temperature,
  weather_description: rawResult.current_weather?.description,
  location: rawResult.location?.found,
  // Calendar-specific
  eventId: rawResult.eventId,
  eventLink: rawResult.eventLink,
  // Schedules-specific
  scheduleId: rawResult.scheduleId,
  nextExecution: rawResult.nextExecutionLocal || rawResult.nextExecution,
  // Sheets-specific
  spreadsheetId: rawResult.spreadsheetId,
  spreadsheetUrl: rawResult.url,
  rowsAdded: rawResult.rowsAdded,
  // Other fields
  documentId: rawResult.documentId,
  formId: rawResult.formId,
  messageId: rawResult.messageId
}, null, 2)}`;
}).join('\n\n')}
${chainContext}

${multipleAgentsCompleted && !nextConfirmation ? `\nCOMPLETED ACTIONS SUMMARY (all done):
${Object.entries(allResults).map(([agent, result], index) => {
  const rawResult = result?.raw_results?.[0] || result || {};
  const title = rawResult.title || rawResult.name || rawResult.documentTitle || 'Item';
  const id = rawResult.formId || rawResult.spreadsheetId || rawResult.documentId || rawResult.eventId || 'created';
  return `${index + 1}. ${agent.toUpperCase()}: "${title}" (${id}) - ✅ COMPLETED`;
}).join('\n')}

REMINDER: All of the above have been CREATED and COMPLETED. Do not use future tense.` : ''}

Please provide a natural, conversational response that:
1. Addresses ALL parts of the user's original request
2. Presents information from ALL agents that executed
3. For websearch: Present the synthesizedContent (which contains the complete research findings)
4. For weather: Include temperature, conditions, and location
5. For calendar: Confirm event creation with details (title, date, time) and link
6. For schedules: Confirm reminder/scheduled action with the scheduled time
7. For sheets: Confirm spreadsheet creation with link and data added
8. For other actions: Include relevant details and links
9. Is friendly and helpful in tone
10. Combines all information naturally without repetition
${nextConfirmation ? '11. Briefly mention that you will now proceed with the next action' : multipleAgentsCompleted ? '11. Clearly state that ALL requested tasks have been completed (use past tense only)' : ''}

IMPORTANT: 
- Present ALL information from all agents in a cohesive response
${multipleAgentsCompleted && !nextConfirmation ? '- ALL actions are COMPLETE - never use future tense, always use past tense' : ''}
- For websearch: The synthesizedContent field contains complete markdown-formatted research - present it naturally
- For sheets: If spreadsheetId and spreadsheetUrl are present, the spreadsheet WAS created successfully - include the link
- Don't just focus on the confirmed action - include websearch results, weather, maps, schedules, or other data too
- If success=true, the action DID complete successfully
- Include clickable links where available

**CRITICAL - LANGUAGE MATCHING**:
Detect the EXACT language of the "Original Query" above and respond ENTIRELY in that SAME language.
- CAREFULLY distinguish between similar languages: Marathi vs Hindi ("kara/navane" = Marathi, "karo/naam" = Hindi), Portuguese vs Spanish, etc.
- MATCH THE SCRIPT: If the user typed in Romanized/Latin script (e.g., "taiyarr kara"), respond in Romanized script too (e.g., "Tumcha document tayaar zala!"). If they used native script (Devanagari, Arabic, CJK), respond in native script.
- NEVER convert Romanized input into a different script — always mirror the user's script choice
- All explanations, confirmations, and conversational text must be in the user's detected language
- Technical terms, product names (Google Docs, Google Meet), URLs, and identifiers can remain in English
- Markdown formatting should still be used
- Keep the same helpful, friendly tone`;

      const messages = [
        { role: 'system', content: this.systemPrompt + '\n\n' + languageInstruction },
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
   * Now includes artifact context, long-term memory, file context, full conversation history, and multi-language support
   */
  async streamCombinedResponse(query, analysis, results, errors, onChunk, conversationId = null, memoryContext = '', conversationHistory = [], fileContext = null, detectedLanguage = 'en') {
    try {
      // Get language instruction for LLM
      const languageDetection = require('../utils/languageDetection');
      const languageInstruction = languageDetection.getLanguageInstruction(detectedLanguage);
      const languageName = languageDetection.getLanguageName(detectedLanguage);
      console.log(`[MainAgent] 🌐 streamCombinedResponse using language: ${languageName} (${detectedLanguage})`);
      
      // ✅ CRITICAL FIX: For deep research queries, stream the research answer directly without LLM post-processing
      const isDeepResearch = analysis.agents && analysis.agents.includes('research') && 
                            results.research && results.research.success;
      
      if (isDeepResearch && results.research.answer) {
        console.log('[MainAgent] 📚 Deep research query detected - streaming detailed research answer directly (NO LLM summarization)');
        
        // Stream the detailed research answer as-is
        const answer = results.research.answer;
        
        // Split into chunks for smooth streaming (every ~500 chars)
        const chunkSize = 500;
        for (let i = 0; i < answer.length; i += chunkSize) {
          const chunk = answer.substring(i, i + chunkSize);
          onChunk({ type: 'content', text: chunk });
        }
        
        // Done - return without calling LLM
        console.log('[MainAgent] ✅ Deep research answer streamed successfully');
        return;
      }
      
      // ✅ NEW: For conversational agent queries, stream the response in real-time
      const isConversational = analysis.agents && analysis.agents.includes('conversational') && 
                              results.conversational && results.conversational.success;
      
      if (isConversational && results.conversational.isStreaming && results.conversational.stream) {
        console.log('[MainAgent] 💬 Conversational query detected - streaming response in real-time');
        
        // Stream the response directly from the conversational agent's stream
        const stream = results.conversational.stream;
        
        try {
          for await (const chunk of stream) {
            if (chunk.choices[0].delta.content) {
              const text = chunk.choices[0].delta.content;
              onChunk({ type: 'content', text: text });
            }
          }
          
          console.log('[MainAgent] ✅ Conversational response streamed successfully');
          return;
        } catch (streamError) {
          console.error('[MainAgent] ❌ Error streaming conversational response:', streamError);
          // Fall through to error handling
          onChunk({ 
            type: 'content', 
            text: '\n\nI encountered an error while streaming the response. Please try again.' 
          });
          return;
        }
      }
      
      // For non-deep-research queries, continue with LLM processing
      // Build context for the LLM
      const agentResults = Object.entries(results).map(([agent, result]) => {
        return `${agent.toUpperCase()} Agent Result:\n${JSON.stringify(result, null, 2)}`;
      }).join('\n\n');

      const agentErrors = Object.entries(errors).map(([agent, error]) => {
        // ✅ FIX: Extract actual error message, not [object Object]
        let errorMessage = '';
        
        if (typeof error === 'string') {
          errorMessage = error;
        } else if (error && error.error) {
          // Error object with 'error' property
          errorMessage = error.error;
        } else if (error && error.message) {
          // Error object with 'message' property
          errorMessage = error.message;
        } else if (error && typeof error === 'object') {
          // Try to stringify if it's an object
          errorMessage = JSON.stringify(error);
        } else {
          errorMessage = 'Unknown error occurred';
        }
        
        // ✅ FIX: For validation errors, don't mention "Agent Error"
        // These are user input errors, not agent execution errors
        if (errorMessage.includes('Invalid email') || 
            errorMessage.includes('No valid email') ||
            errorMessage.includes('Missing required field') ||
            errorMessage.includes('validation')) {
          return `Input Validation Error: ${errorMessage}`;
        }
        
        return `${agent.toUpperCase()} Agent Error: ${errorMessage}`;
      }).join('\n');

      // Build artifact context for the prompt
      // ONLY include artifacts if agents were actually used (not for conversational queries)
      let artifactContext = '';
      const isConversationalQuery = !analysis.agents || analysis.agents.length === 0;
      if (conversationId && !isConversationalQuery) {
        artifactContext = await formatArtifactsForPrompt(conversationId);
      }

      // Build file context section for the prompt
      let fileContextSection = '';
      if (fileContext && (fileContext.textContent || (fileContext.visionContent && fileContext.visionContent.length > 0))) {
        const hasFiles = true;
        const fileCount = fileContext.filesProcessed || 0;
        fileContextSection = `\n--- Attached Files (${fileCount} file${fileCount > 1 ? 's' : ''}) ---\nThe user has attached files to this message. Their content is provided in the system context and/or as images.\nAnalyze the attached file(s) and respond based on their content.\n---\n`;
      }

      const responsePrompt = `The user asked: "${query}"

Query Analysis:
${JSON.stringify(analysis, null, 2)}

Agent Results:
${agentResults}

${agentErrors ? `Errors encountered:\n${agentErrors}\n` : ''}

${artifactContext ? `\n--- Conversation Artifacts ---\n${artifactContext}\n---\n` : ''}

${memoryContext ? `\n--- Long-Term Memories ---\n${memoryContext}\n(Use these memories only if directly relevant. Do not explicitly mention "from your memories" unless appropriate.)\n---\n` : ''}

${fileContextSection}

CRITICAL INSTRUCTION - Response Style:
${agentErrors && agentErrors.includes('Input Validation Error') ? `
⚠️ This is a VALIDATION ERROR (user input issue, NOT an agent execution error).
- DO NOT say "I encountered an error with the [agent name] agent"
- DO NOT say "the agent failed" or "agent error occurred"
- DO NOT mention technical details or agent names
- The error message already contains user-friendly suggestions
- Simply present the error message clearly and ask the user to provide correct information
- Keep it SHORT and HELPFUL
- Example: "I noticed the email address 'john@' is incomplete. [suggestions from error message]"
` : fileContext && fileContext.filesProcessed > 0 ? `
📎 The user has attached files. Focus on ANALYZING and RESPONDING to the file content.
- Read and understand the file content provided in the system context
- For documents: summarize, extract key points, answer questions about the content
- For images: describe what you see, analyze the visual content
- For code: review, explain, or debug the code
- Always reference the file by name when discussing it
- Provide thorough analysis based on what the user asked
` : analysis.agents && analysis.agents.length === 0 ? `
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
${!fileContext?.filesProcessed && analysis.agents && analysis.agents.length === 0 ? 'Remember: Just answer the question directly without extra context or recaps!' : ''}

**CRITICAL - LANGUAGE MATCHING** (Detect from current query ONLY):
ALWAYS detect the EXACT language of the user's LATEST query above, regardless of any previous queries or user preferences.
Respond ENTIRELY in the language of the current query - if they asked in English, answer in English. If they asked in Marathi, answer in Marathi.
- CAREFULLY distinguish between similar languages: Marathi vs Hindi ("kara/navane/zala" = Marathi, "karo/naam/hua" = Hindi), Portuguese vs Spanish, etc. Do NOT default to Hindi for all Indian languages.
- MATCH THE SCRIPT: If the user typed in Romanized/Latin script (e.g., "taiyarr kara"), respond in the same Romanized script (e.g., "Tumcha document tayaar zala!"). If they used native script (e.g., Devanagari "डॉक्स बनवा"), respond in native script. NEVER convert Romanized input into a different script.
- All explanations, summaries, confirmations must be in the user's language and script
- Technical terms, product names (Google Docs), URLs, and identifiers can remain in English
- Markdown formatting should still be used
- IGNORE any stored language preferences - ONLY respond in the language of this current query
`;

      // Get dynamic system prompt with artifact context
      const systemPrompt = conversationId 
        ? await this.createDynamicSystemPrompt(conversationId)
        : this.systemPrompt;

      // Build messages array with conversation history for context
      const messages = [
        { role: 'system', content: systemPrompt + '\n\n' + languageInstruction },
      ];

      // Add file context if provided
      // For vision files (images), we'll add them along with the user message
      // For text content, add to system context
      if (fileContext && fileContext.textContent) {
        console.log(`[MainAgent] 📎 Adding file context to system: ${fileContext.filesProcessed} files, ~${fileContext.tokensUsed} tokens`);
        messages.push({
          role: 'system',
          content: fileContext.textContent
        });
      }

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

      // If there are vision files (images), add them as multimodal content
      if (fileContext && fileContext.visionContent && fileContext.visionContent.length > 0) {
        console.log(`[MainAgent] 🖼️ Adding ${fileContext.visionContent.length} vision files (images)`);
        
        // Remove the last text-only user message and combine with vision content
        messages.pop();
       
        // Build multimodal content array
        const multimodalContent = [
          {
            type: 'text',
            text: responsePrompt
          }
        ];

        // Add each vision file
        for (const visionFile of fileContext.visionContent) {
          if (visionFile.type === 'image') {
            // Add the image content items (text + image_url)
            for (const contentItem of visionFile.content) {
              if (contentItem.type === 'image_url' || contentItem.type === 'text') {
                multimodalContent.push(contentItem);
              }
            }
          }
        }

        // Add multimodal message
        messages.push({
          role: 'user',
          content: multimodalContent
        });
      }

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

      // ✅ CRITICAL: Detect language at the VERY START using LLM
      const languageDetection = require('../utils/languageDetection');
      const detectedLanguage = await languageDetection.detectLanguage(query);
      const languageName = languageDetection.getLanguageName(detectedLanguage);
      console.log(`[MainAgent] 🌐 Detected language: ${languageName} (${detectedLanguage})`);

      // Step 1: Analyze the query to determine which agents are needed
      const analysis = await this.analyzeQuery(query, options.conversationHistory, null, '', null, detectedLanguage);

      // ✅ CRITICAL: Check if analysis returned a validation error
      if (analysis.validationError && analysis.error) {
        console.log('[MainAgent] ⚠️ Validation error detected, returning error response');
        return {
          success: false,
          query: query,
          error: analysis.error,
          validationError: true,
          timestamp: new Date().toISOString()
        };
      }

      // Step 2: Execute queries on the appropriate agents
      // Pass conversationHistory so agents receive context (e.g. scheduled action instructions)
      const { results, errors } = await this.executeAgentQueries(
        analysis, userId, null, null, null, options.conversationHistory || [], query
      );

      // Step 3: Combine responses into a coherent final response
      const finalResponse = await this.combineResponses(query, analysis, results, errors, detectedLanguage);

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
