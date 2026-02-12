/**
 * Timeline Events System
 * 
 * Provides real-time step-by-step progress updates during AI assistant execution.
 * Events are streamed to the frontend via SSE to show a visual timeline.
 */

/**
 * Timeline Event Types
 */
const TimelineEventType = {
  // Processing phase events (real-time backend operations)
  MEMORY_SEARCHING: 'timeline_memory_searching',
  MEMORY_RETRIEVED: 'timeline_memory_retrieved',
  MEMORY_STORED: 'timeline_memory_stored',
  
  ARTIFACT_SCANNING: 'timeline_artifact_scanning',
  ARTIFACT_RESOLVED: 'timeline_artifact_resolved',
  
  ANALYZING_QUERY: 'timeline_analyzing_query',
  ANALYSIS_COMPLETE: 'timeline_analysis_complete',
  
  // Initial planning phase
  PLAN: 'timeline_plan',
  
  // Agent lifecycle events
  AGENT_ADDED: 'timeline_agent_added',
  AGENT_EXECUTING: 'timeline_agent_executing',
  AGENT_COMPLETED: 'timeline_agent_completed',
  AGENT_FAILED: 'timeline_agent_failed',
  
  // Narrative updates (for custom messages)
  NARRATIVE: 'timeline_narrative',
  
  // Tool execution events
  TOOL_STARTED: 'timeline_tool_started',
  TOOL_COMPLETED: 'timeline_tool_completed',
  TOOL_FAILED: 'timeline_tool_failed',
  
  // Confirmation events
  CONFIRMATION_REQUIRED: 'timeline_confirmation_required',
  CONFIRMATION_RECEIVED: 'timeline_confirmation_received',
  
  // Response generation
  GENERATING_RESPONSE: 'timeline_generating_response',
  
  // Completion events
  TASK_COMPLETED: 'timeline_task_completed',
  TASK_FAILED: 'timeline_task_failed'
};

/**
 * Agent icon mapping
 */
const AGENT_ICONS = {
  calendar: '/icons/calendar.svg',
  docs: '/icons/docs.svg',
  forms: '/icons/forms.svg',
  github: '/icons/github.svg',
  gmail: '/icons/gmail.svg',
  meet: '/icons/meet.svg',
  sheets: '/icons/sheets.svg',
  flights: '/icons/flights.svg',
  maps: '/icons/maps.svg',
  microsoft: '/icons/microsoft.svg'
};

/**
 * Agent display names
 */
const AGENT_NAMES = {
  calendar: 'Google Calendar',
  docs: 'Google Docs',
  forms: 'Google Forms',
  github: 'GitHub',
  gmail: 'Gmail',
  meet: 'Google Meet',
  sheets: 'Google Sheets',
  flights: 'Flights',
  maps: 'Google Maps',
  microsoft: 'Microsoft 365'
};

/**
 * Tool display names
 */
const TOOL_NAMES = {
  // Calendar
  createEvent: 'Create Calendar Event',
  updateEvent: 'Update Calendar Event',
  deleteEvent: 'Delete Calendar Event',
  listEvents: 'List Calendar Events',
  
  // Meet
  createMeetingSpace: 'Create Meeting Space',
  getMeetingSpace: 'Get Meeting Details',
  
  // Gmail
  sendEmail: 'Send Email',
  readEmails: 'Read Emails',
  searchEmails: 'Search Emails',
  replyToEmail: 'Reply to Email',
  
  // Docs
  createDocument: 'Create Document',
  getDocument: 'Get Document',
  updateDocument: 'Update Document',
  
  // Forms
  createForm: 'Create Form',
  addQuestion: 'Add Question',
  getFormResponses: 'Get Responses',
  
  // Sheets
  createSpreadsheet: 'Create Spreadsheet',
  readData: 'Read Data',
  writeData: 'Write Data',
  
  // GitHub
  getProfile: 'Get Profile',
  listRepos: 'List Repositories',
  searchCode: 'Search Code',
  
  // Maps
  searchPlaces: 'Search Places',
  getDirections: 'Get Directions',
  findNearby: 'Find Nearby Places',
  
  // Flights
  searchFlights: 'Search Flights',
  getFlightsPriceInsights: 'Get Price Insights',
  
  // Microsoft
  microsoft_sendEmail: 'Send Outlook Email',
  microsoft_listEmails: 'List Outlook Emails',
  microsoft_createEvent: 'Create Calendar Event',
  microsoft_listFiles: 'List OneDrive Files'
};

/**
 * Timeline Event Queue - manages events for a single user session
 */
class TimelineEventQueue {
  constructor(userId, conversationId) {
    this.userId = userId;
    this.conversationId = conversationId;
    this.events = [];
    this.onEventCallback = null;
    this.eventIdCounter = 0;
  }

  /**
   * Subscribe to new events
   */
  subscribe(callback) {
    this.onEventCallback = callback;
  }

  /**
   * Generate unique event ID
   */
  generateEventId() {
    this.eventIdCounter++;
    return `evt_${this.conversationId}_${this.eventIdCounter}`;
  }

  /**
   * Add a new event and notify subscriber
   */
  addEvent(eventData) {
    const event = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      ...eventData
    };
    
    this.events.push(event);
    
    if (this.onEventCallback) {
      this.onEventCallback(event);
    }
    
    return event;
  }

  /**
   * Get all events
   */
  getEvents() {
    return [...this.events];
  }

  /**
   * Clear all events
   */
  clear() {
    this.events = [];
    this.eventIdCounter = 0;
  }
}

/**
 * Timeline Event Emitter - helper class to emit timeline events
 * Wraps the onChunk callback to send properly formatted timeline events
 */
class TimelineEmitter {
  constructor(onChunk, userId, conversationId) {
    this.onChunk = onChunk;
    this.eventQueue = new TimelineEventQueue(userId, conversationId);
    this.eventQueue.subscribe((event) => {
      this.onChunk(event);
    });
  }

  /**
   * Emit the initial plan/analysis
   */
  emitPlan(message, agents = []) {
    return this.eventQueue.addEvent({
      type: TimelineEventType.PLAN,
      message,
      agents,
      status: 'completed'
    });
  }

  /**
   * Emit a narrative update (AI explaining what it's doing)
   */
  emitNarrative(message) {
    return this.eventQueue.addEvent({
      type: TimelineEventType.NARRATIVE,
      message,
      status: 'completed'
    });
  }

  /**
   * Emit agent added event
   */
  emitAgentAdded(agentKey) {
    return this.eventQueue.addEvent({
      type: TimelineEventType.AGENT_ADDED,
      agentKey,
      agentName: AGENT_NAMES[agentKey] || agentKey,
      agentIcon: AGENT_ICONS[agentKey] || null,
      status: 'completed'
    });
  }

  /**
   * Emit agent executing event
   */
  emitAgentExecuting(agentKey, query) {
    return this.eventQueue.addEvent({
      type: TimelineEventType.AGENT_EXECUTING,
      agentKey,
      agentName: AGENT_NAMES[agentKey] || agentKey,
      agentIcon: AGENT_ICONS[agentKey] || null,
      query,
      status: 'in_progress'
    });
  }

  /**
   * Emit agent completed event
   * Now checks if the response is actually completed vs needs clarification or failed
   */
  emitAgentCompleted(agentKey, result) {
    // Check if the result indicates a failure
    if (result?.success === false) {
      return this.eventQueue.addEvent({
        type: TimelineEventType.AGENT_FAILED,
        agentKey,
        agentName: AGENT_NAMES[agentKey] || agentKey,
        error: result?.error || result?.response?.substring(0, 200) || 'Operation failed',
        status: 'failed'
      });
    }
    
    // Check if the response is asking for clarification (not actually completed)
    const response = result?.response || '';
    const needsClarification = this.detectClarificationRequest(response);
    
    if (needsClarification) {
      return this.eventQueue.addEvent({
        type: TimelineEventType.AGENT_COMPLETED,
        agentKey,
        agentName: AGENT_NAMES[agentKey] || agentKey,
        summary: 'Awaiting clarification',
        status: 'needs_input',
        needsClarification: true
      });
    }
    
    return this.eventQueue.addEvent({
      type: TimelineEventType.AGENT_COMPLETED,
      agentKey,
      agentName: AGENT_NAMES[agentKey] || agentKey,
      summary: result?.response?.substring(0, 200) || 'Completed successfully',
      status: 'completed'
    });
  }
  
  /**
   * Detect if a response is asking for clarification rather than completing the task
   */
  detectClarificationRequest(response) {
    if (!response) return false;
    
    const lowerResponse = response.toLowerCase();
    
    // Phrases that indicate the agent is asking for clarification
    const clarificationPhrases = [
      'could you please',
      'could you provide',
      'please clarify',
      'please confirm',
      'please specify',
      'please verify',
      'which one',
      'which document',
      'which file',
      'can you confirm',
      'can you specify',
      'can you provide',
      'do you mean',
      'did you mean',
      'i need more information',
      'provide more details',
      'looking forward to your clarification',
      'could not find',
      'couldn\'t find',
      'unable to locate',
      'issue locating',
      'couldn\'t locate',
      'does not exist',
      'doesn\'t exist'
    ];
    
    for (const phrase of clarificationPhrases) {
      if (lowerResponse.includes(phrase)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Emit agent failed event
   */
  emitAgentFailed(agentKey, error) {
    return this.eventQueue.addEvent({
      type: TimelineEventType.AGENT_FAILED,
      agentKey,
      agentName: AGENT_NAMES[agentKey] || agentKey,
      error: error.message || String(error),
      status: 'failed'
    });
  }

  /**
   * Emit tool started event
   */
  emitToolStarted(toolName, agentKey, params = {}) {
    return this.eventQueue.addEvent({
      type: TimelineEventType.TOOL_STARTED,
      toolName,
      toolDisplayName: TOOL_NAMES[toolName] || toolName,
      agentKey,
      agentName: AGENT_NAMES[agentKey] || agentKey,
      params: this.sanitizeParams(params),
      status: 'in_progress',
      expandable: true
    });
  }

  /**
   * Emit tool completed event
   */
  emitToolCompleted(toolName, agentKey, result = {}) {
    return this.eventQueue.addEvent({
      type: TimelineEventType.TOOL_COMPLETED,
      toolName,
      toolDisplayName: TOOL_NAMES[toolName] || toolName,
      agentKey,
      agentName: AGENT_NAMES[agentKey] || agentKey,
      result: this.sanitizeResult(result),
      status: 'completed',
      expandable: true
    });
  }

  /**
   * Emit tool failed event
   */
  emitToolFailed(toolName, agentKey, error) {
    return this.eventQueue.addEvent({
      type: TimelineEventType.TOOL_FAILED,
      toolName,
      toolDisplayName: TOOL_NAMES[toolName] || toolName,
      agentKey,
      agentName: AGENT_NAMES[agentKey] || agentKey,
      error: error.message || String(error),
      status: 'failed',
      expandable: true
    });
  }

  /**
   * Emit confirmation required event
   */
  emitConfirmationRequired(toolName, agentKey, previewContent) {
    return this.eventQueue.addEvent({
      type: TimelineEventType.CONFIRMATION_REQUIRED,
      toolName,
      toolDisplayName: TOOL_NAMES[toolName] || toolName,
      agentKey,
      agentName: AGENT_NAMES[agentKey] || agentKey,
      previewContent,
      status: 'pending'
    });
  }

  /**
   * Emit confirmation received event
   */
  emitConfirmationReceived(toolName, agentKey, confirmed) {
    return this.eventQueue.addEvent({
      type: TimelineEventType.CONFIRMATION_RECEIVED,
      toolName,
      toolDisplayName: TOOL_NAMES[toolName] || toolName,
      agentKey,
      agentName: AGENT_NAMES[agentKey] || agentKey,
      confirmed,
      status: confirmed ? 'completed' : 'cancelled'
    });
  }

  /**
   * Emit memory searching event (before retrieval starts)
   */
  emitMemorySearching() {
    return this.eventQueue.addEvent({
      type: TimelineEventType.MEMORY_SEARCHING,
      message: 'Searching long-term memory...',
      status: 'in_progress'
    });
  }

  /**
   * Emit memory retrieved event
   */
  emitMemoryRetrieved(memoriesCount, topMemoryType = null) {
    return this.eventQueue.addEvent({
      type: TimelineEventType.MEMORY_RETRIEVED,
      memoriesCount,
      topMemoryType,
      message: memoriesCount > 0 
        ? `Retrieved ${memoriesCount} relevant memories`
        : 'No relevant memories found',
      status: 'completed'
    });
  }

  /**
   * Emit artifact scanning event
   */
  emitArtifactScanning(conversationId) {
    return this.eventQueue.addEvent({
      type: TimelineEventType.ARTIFACT_SCANNING,
      conversationId,
      message: 'Scanning conversation artifacts...',
      status: 'in_progress'
    });
  }

  /**
   * Emit artifact resolved event
   */
  emitArtifactResolved(artifactTitle, artifactType) {
    return this.eventQueue.addEvent({
      type: TimelineEventType.ARTIFACT_RESOLVED,
      artifactTitle,
      artifactType,
      message: artifactTitle 
        ? `Resolved artifact: ${artifactTitle}`
        : 'No artifact references found',
      status: 'completed'
    });
  }

  /**
   * Emit analyzing query event (before AI analysis)
   */
  emitAnalyzingQuery() {
    return this.eventQueue.addEvent({
      type: TimelineEventType.ANALYZING_QUERY,
      message: 'Analyzing request with AI...',
      status: 'in_progress'
    });
  }

  /**
   * Emit analysis complete event
   */
  emitAnalysisComplete(agents, reasoning) {
    return this.eventQueue.addEvent({
      type: TimelineEventType.ANALYSIS_COMPLETE,
      agents,
      reasoning,
      message: reasoning,
      status: 'completed'
    });
  }

  /**
   * Emit generating response event
   */
  emitGeneratingResponse() {
    return this.eventQueue.addEvent({
      type: TimelineEventType.GENERATING_RESPONSE,
      message: 'Generating response...',
      status: 'in_progress'
    });
  }

  /**
   * Emit memory stored event
   */
  emitMemoryStored(memoryType, summary) {
    return this.eventQueue.addEvent({
      type: TimelineEventType.MEMORY_STORED,
      memoryType,
      summary,
      message: `Stored memory: ${summary}`,
      status: 'completed'
    });
  }

  /**
   * Emit task completed event
   * @param {string} summary - Summary message
   * @param {boolean} needsClarification - If true, task is awaiting user input
   */
  emitTaskCompleted(summary, needsClarification = false) {
    if (needsClarification) {
      return this.eventQueue.addEvent({
        type: TimelineEventType.TASK_COMPLETED,
        message: 'Awaiting your response',
        status: 'needs_input'
      });
    }
    
    return this.eventQueue.addEvent({
      type: TimelineEventType.TASK_COMPLETED,
      message: summary || 'Task completed successfully',
      status: 'completed'
    });
  }

  /**
   * Emit task failed event
   */
  emitTaskFailed(error) {
    return this.eventQueue.addEvent({
      type: TimelineEventType.TASK_FAILED,
      message: error.message || String(error),
      status: 'failed'
    });
  }

  /**
   * Sanitize params to remove sensitive data
   */
  sanitizeParams(params) {
    const sanitized = { ...params };
    // Remove potentially sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'accessToken', 'refreshToken'];
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '***';
      }
    }
    return sanitized;
  }

  /**
   * Sanitize result to limit size and remove sensitive data
   */
  sanitizeResult(result) {
    if (!result) return {};
    
    const sanitized = {};
    
    // Only include key fields
    if (result.success !== undefined) sanitized.success = result.success;
    if (result.response) sanitized.response = result.response.substring(0, 500);
    if (result.id) sanitized.id = result.id;
    if (result.link) sanitized.link = result.link;
    if (result.url) sanitized.url = result.url;
    if (result.meetingLink) sanitized.meetingLink = result.meetingLink;
    if (result.meetingCode) sanitized.meetingCode = result.meetingCode;
    
    return sanitized;
  }

  /**
   * Get all events in the queue
   */
  getEvents() {
    return this.eventQueue.getEvents();
  }
}

module.exports = {
  TimelineEventType,
  TimelineEventQueue,
  TimelineEmitter,
  AGENT_ICONS,
  AGENT_NAMES,
  TOOL_NAMES
};
