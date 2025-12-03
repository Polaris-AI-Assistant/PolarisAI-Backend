/**
 * Artifact Context Middleware
 * 
 * This middleware detects ambiguous references in user queries and resolves them
 * to specific artifacts from the conversation's artifact memory.
 * 
 * It detects references like:
 * - "add an address field to it"
 * - "send it"
 * - "modify the sheet"
 * - "update that form"
 * - "continue"
 * - "the previous document"
 * 
 * And maps these to the most relevant artifact from Redis.
 */

const {
    getArtifacts,
    getLastArtifact,
    getLastArtifactByType,
    formatArtifactsForPrompt,
    ARTIFACT_TYPES
} = require('../utils/artifactMemory');

// Patterns that indicate a reference to a previous artifact
const REFERENCE_PATTERNS = [
    // Direct pronouns
    /\b(it|that|this|these|those)\b/i,
    // Previous/last references
    /\b(previous|last|recent|earlier|above|same)\b/i,
    // "The X we created/made"
    /\bthe\s+(form|doc|document|sheet|spreadsheet|email|event|meeting|calendar|repo|repository)\s*(we|i|you)?\s*(created|made|just|earlier|before)?\b/i,
    // "Continue" or "go on"
    /\b(continue|go\s+on|proceed|keep\s+going)\b/i,
    // "Update/modify/change the X"
    /\b(update|modify|change|edit|add\s+to)\s+(the|that|this|my)?\s*(form|doc|document|sheet|spreadsheet|email|event|meeting)?\b/i,
    // "Send/publish/share it"
    /\b(send|publish|share|forward)\s+(it|that|this|the\s+\w+)\b/i
];

// Type detection patterns - maps keywords to artifact types
const TYPE_DETECTION_MAP = {
    // Forms
    'form': ARTIFACT_TYPES.FORM,
    'survey': ARTIFACT_TYPES.FORM,
    'questionnaire': ARTIFACT_TYPES.FORM,
    'quiz': ARTIFACT_TYPES.FORM,
    
    // Documents
    'doc': ARTIFACT_TYPES.DOC,
    'document': ARTIFACT_TYPES.DOC,
    'file': ARTIFACT_TYPES.DOC,
    
    // Sheets
    'sheet': ARTIFACT_TYPES.SHEET,
    'spreadsheet': ARTIFACT_TYPES.SHEET,
    'excel': ARTIFACT_TYPES.SHEET,
    'table': ARTIFACT_TYPES.SHEET,
    
    // Email
    'email': ARTIFACT_TYPES.EMAIL,
    'mail': ARTIFACT_TYPES.EMAIL,
    'message': ARTIFACT_TYPES.EMAIL,
    
    // Calendar
    'event': ARTIFACT_TYPES.EVENT,
    'meeting': ARTIFACT_TYPES.EVENT,
    'appointment': ARTIFACT_TYPES.EVENT,
    'schedule': ARTIFACT_TYPES.EVENT,
    
    // Meet
    'meet': ARTIFACT_TYPES.MEET,
    'video call': ARTIFACT_TYPES.MEET,
    'conference': ARTIFACT_TYPES.MEET,
    
    // GitHub
    'repo': ARTIFACT_TYPES.REPO,
    'repository': ARTIFACT_TYPES.REPO,
    'issue': ARTIFACT_TYPES.ISSUE,
    'pull request': ARTIFACT_TYPES.PR,
    'pr': ARTIFACT_TYPES.PR
};

// Action keywords that indicate intent to modify/use an artifact
const ACTION_KEYWORDS = {
    modify: ['update', 'modify', 'change', 'edit', 'alter', 'revise'],
    add: ['add', 'insert', 'append', 'include', 'put'],
    remove: ['remove', 'delete', 'drop', 'take out', 'clear'],
    send: ['send', 'submit', 'publish', 'share', 'forward', 'dispatch'],
    view: ['view', 'show', 'display', 'open', 'see', 'check']
};

/**
 * Check if query contains a reference to a previous artifact
 * 
 * @param {string} query - User query
 * @returns {boolean} - True if query contains an artifact reference
 */
const containsArtifactReference = (query) => {
    const lowercased = query.toLowerCase();
    
    return REFERENCE_PATTERNS.some(pattern => pattern.test(lowercased));
};

/**
 * Detect the likely artifact type from the query
 * 
 * @param {string} query - User query
 * @returns {string|null} - Detected artifact type or null
 */
const detectArtifactType = (query) => {
    const lowercased = query.toLowerCase();
    
    for (const [keyword, type] of Object.entries(TYPE_DETECTION_MAP)) {
        if (lowercased.includes(keyword)) {
            return type;
        }
    }
    
    return null;
};

/**
 * Detect the user's intent/action from the query
 * 
 * @param {string} query - User query
 * @returns {string|null} - Detected action category or null
 */
const detectAction = (query) => {
    const lowercased = query.toLowerCase();
    
    for (const [action, keywords] of Object.entries(ACTION_KEYWORDS)) {
        if (keywords.some(kw => lowercased.includes(kw))) {
            return action;
        }
    }
    
    return null;
};

/**
 * Resolve artifact reference from query
 * 
 * @param {string} conversationId - Conversation ID
 * @param {string} query - User query
 * @returns {object|null} - Resolved artifact context or null
 */
const resolveArtifactFromQuery = async (conversationId, query) => {
    if (!conversationId) {
        return null;
    }
    
    // Check if query contains a reference
    if (!containsArtifactReference(query)) {
        return null;
    }
    
    // Detect artifact type from query
    const detectedType = detectArtifactType(query);
    
    let artifact = null;
    
    if (detectedType) {
        // Get most recent artifact of the detected type
        artifact = await getLastArtifactByType(conversationId, detectedType);
    } else {
        // If no type detected, get the most recent artifact
        artifact = await getLastArtifact(conversationId);
    }
    
    if (!artifact) {
        return null;
    }
    
    return {
        artifact,
        detectedType,
        action: detectAction(query),
        originalQuery: query
    };
};

/**
 * Build enhanced context object for AI processing
 * 
 * @param {string} conversationId - Conversation ID
 * @param {string} query - User query
 * @returns {object} - Enhanced context with artifacts
 */
const buildArtifactContext = async (conversationId, query) => {
    console.log(`\n[ArtifactContext] 🔧 Building context for conversation: ${conversationId}`);
    console.log(`[ArtifactContext]   Query: "${query}"`);
    
    const context = {
        hasArtifactReference: false,
        resolvedArtifact: null,
        allArtifacts: [],
        artifactsPrompt: '',
        enhancedQuery: query
    };
    
    if (!conversationId) {
        console.log(`[ArtifactContext]   ⚠️ No conversationId provided`);
        return context;
    }
    
    // Get all artifacts for the conversation
    context.allArtifacts = await getArtifacts(conversationId);
    console.log(`[ArtifactContext]   📦 Retrieved ${context.allArtifacts.length} artifacts from Redis`);
    
    if (context.allArtifacts.length > 0) {
        context.allArtifacts.forEach((a, i) => {
            console.log(`[ArtifactContext]     ${i + 1}. [${a.type}] "${a.title}" (ID: ${a.id})`);
        });
        
        // Generate artifacts prompt for system context
        context.artifactsPrompt = await formatArtifactsForPrompt(conversationId);
    }
    
    // Check if query contains artifact reference
    const hasReference = containsArtifactReference(query);
    console.log(`[ArtifactContext]   🔍 Contains artifact reference: ${hasReference}`);
    
    // Try to resolve any artifact references in the query
    const resolved = await resolveArtifactFromQuery(conversationId, query);
    
    if (resolved) {
        context.hasArtifactReference = true;
        context.resolvedArtifact = resolved.artifact;
        
        // Enhance the query with resolved artifact info
        const typeNames = {
            form: 'form',
            doc: 'document',
            sheet: 'spreadsheet',
            email: 'email',
            draft: 'draft',
            event: 'event',
            meet: 'meeting',
            calendar: 'calendar',
            repo: 'repository',
            issue: 'issue',
            pull_request: 'pull request'
        };
        
        const typeName = typeNames[resolved.artifact.type] || resolved.artifact.type;
        const idFieldName = getIdFieldName(resolved.artifact.type);
        
        // Add context about resolved artifact to the query
        context.enhancedQuery = `${query}\n\n[Context: User is referring to the ${typeName} "${resolved.artifact.title}" (${idFieldName}=${resolved.artifact.id})]`;
        
        console.log(`[ArtifactContext]   ✅ RESOLVED artifact reference:`);
        console.log(`[ArtifactContext]     Type: ${typeName}`);
        console.log(`[ArtifactContext]     Title: ${resolved.artifact.title}`);
        console.log(`[ArtifactContext]     ID: ${resolved.artifact.id}`);
        console.log(`[ArtifactContext]   📝 Enhanced query: ${context.enhancedQuery}`);
    } else if (hasReference && context.allArtifacts.length > 0) {
        console.log(`[ArtifactContext]   ⚠️ Query has reference but no specific artifact resolved`);
        console.log(`[ArtifactContext]   ℹ️ Will use most recent artifact as fallback`);
        
        // Fallback: use most recent artifact
        const lastArtifact = context.allArtifacts[context.allArtifacts.length - 1];
        if (lastArtifact) {
            context.hasArtifactReference = true;
            context.resolvedArtifact = lastArtifact;
            
            const typeNames = {
                form: 'form',
                doc: 'document',
                sheet: 'spreadsheet',
                email: 'email',
                draft: 'draft',
                event: 'event',
                meet: 'meeting',
                calendar: 'calendar',
                repo: 'repository',
                issue: 'issue',
                pull_request: 'pull request'
            };
            
            const typeName = typeNames[lastArtifact.type] || lastArtifact.type;
            const idFieldName = getIdFieldName(lastArtifact.type);
            
            context.enhancedQuery = `${query}\n\n[Context: User is referring to the ${typeName} "${lastArtifact.title}" (${idFieldName}=${lastArtifact.id})]`;
            
            console.log(`[ArtifactContext]   ✅ Using fallback artifact: ${typeName} "${lastArtifact.title}"`);
        }
    } else {
        console.log(`[ArtifactContext]   ℹ️ No artifact reference to resolve`);
    }
    
    return context;
};

/**
 * Get the ID field name for a given artifact type
 */
const getIdFieldName = (type) => {
    const idFields = {
        form: 'formId',
        doc: 'documentId',
        sheet: 'spreadsheetId',
        email: 'messageId',
        draft: 'draftId',
        event: 'eventId',
        meet: 'meetingId',
        calendar: 'calendarId',
        repo: 'repoId',
        issue: 'issueId',
        pull_request: 'prId'
    };
    return idFields[type] || 'id';
};

/**
 * Express middleware for artifact context
 * Attaches artifact context to the request object
 */
const artifactContextMiddleware = async (req, res, next) => {
    try {
        // Get conversation ID from request (could be in body, params, or headers)
        const conversationId = req.body?.conversationId || 
                               req.params?.conversationId || 
                               req.headers['x-conversation-id'];
        
        // Get query from request
        const query = req.body?.query || req.body?.message || '';
        
        if (conversationId && query) {
            // Build artifact context
            const artifactContext = await buildArtifactContext(conversationId, query);
            
            // Attach to request
            req.artifactContext = artifactContext;
            
            // If we resolved an artifact, update the query in the body
            if (artifactContext.hasArtifactReference) {
                // Keep original query but add resolved artifact info
                req.body.originalQuery = query;
                req.body.resolvedArtifact = artifactContext.resolvedArtifact;
            }
        }
        
        next();
    } catch (error) {
        console.error('[ArtifactContextMiddleware] Error:', error);
        // Don't block request on error, just continue
        next();
    }
};

/**
 * Generate artifact context prompt enhancement for system prompts
 * 
 * @param {string} conversationId - Conversation ID
 * @returns {string} - Prompt enhancement text
 */
const generateArtifactPromptEnhancement = async (conversationId) => {
    if (!conversationId) {
        return '';
    }
    
    const artifactsPrompt = await formatArtifactsForPrompt(conversationId);
    
    if (!artifactsPrompt) {
        return '';
    }
    
    return `
--- ARTIFACT MEMORY ---
You have access to conversation artifact memory.
${artifactsPrompt}

IMPORTANT:
- If user refers to "it", "the previous form/doc/sheet", or uses pronouns, resolve using the artifacts above.
- Always choose the most recently created artifact of the relevant type if multiple exist.
- When you modify something, use the existing artifact ID and update the artifact memory after tools finish.
- Include the artifact ID in your responses for user reference.
--- END ARTIFACT MEMORY ---
`;
};

module.exports = {
    // Middleware
    artifactContextMiddleware,
    
    // Utilities
    containsArtifactReference,
    detectArtifactType,
    detectAction,
    resolveArtifactFromQuery,
    buildArtifactContext,
    generateArtifactPromptEnhancement,
    
    // Constants
    ARTIFACT_TYPES,
    TYPE_DETECTION_MAP,
    ACTION_KEYWORDS
};
