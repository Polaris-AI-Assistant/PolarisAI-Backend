/**
 * Artifact Memory Module
 * 
 * Provides high-level artifact memory operations for the Polaris AI system.
 * Artifacts are records of created/modified resources (Forms, Docs, Sheets, Emails, Events, etc.)
 * that allow the AI to remember and operate on previously created items within a conversation.
 * 
 * Schema in Redis:
 * artifact:{conversationId} = {
 *   artifacts: [
 *     {
 *       id: string,           // Resource ID (formId, documentId, spreadsheetId, eventId, etc.)
 *       type: string,         // "form" | "doc" | "sheet" | "email" | "event" | "meet" | "repo" | "issue"
 *       title: string,        // Human-readable name
 *       data: any,            // Additional metadata (url, settings, etc.)
 *       createdAt: number     // Timestamp
 *     }
 *   ]
 * }
 */

const {
    pushArtifact,
    getArtifacts,
    getLastArtifact,
    getArtifactByType,
    getLastArtifactByType,
    listArtifacts,
    clearArtifacts
} = require('./redisClient');

// Supported artifact types
const ARTIFACT_TYPES = {
    FORM: 'form',
    DOC: 'doc',
    SHEET: 'sheet',
    EMAIL: 'email',
    DRAFT: 'draft',
    EVENT: 'event',
    MEET: 'meet',
    CALENDAR: 'calendar',
    REPO: 'repo',
    ISSUE: 'issue',
    PR: 'pull_request',
    LABEL: 'label',
    FILTER: 'filter'
};

// Type display names for human-readable output
const TYPE_DISPLAY_NAMES = {
    form: 'Form',
    doc: 'Document',
    sheet: 'Spreadsheet',
    email: 'Email',
    draft: 'Draft',
    event: 'Event',
    meet: 'Meeting',
    calendar: 'Calendar',
    repo: 'Repository',
    issue: 'Issue',
    pull_request: 'Pull Request',
    label: 'Label',
    filter: 'Filter'
};

/**
 * Add a new artifact to conversation memory
 * 
 * @param {string} conversationId - Unique conversation/chat ID
 * @param {object} artifact - Artifact details
 * @param {string} artifact.id - Resource ID
 * @param {string} artifact.type - Artifact type (use ARTIFACT_TYPES)
 * @param {string} artifact.title - Human-readable title
 * @param {object} artifact.data - Additional metadata
 * @returns {object} - Stored artifact with createdAt
 */
const addArtifact = async (conversationId, artifact) => {
    if (!conversationId || !artifact.id || !artifact.type) {
        console.error('[ArtifactMemory] ❌ Missing required fields:', { conversationId, artifact });
        throw new Error('conversationId, artifact.id, and artifact.type are required');
    }

    console.log(`\n[ArtifactMemory] 💾 STORING ARTIFACT:`);
    console.log(`[ArtifactMemory]   Conversation: ${conversationId}`);
    console.log(`[ArtifactMemory]   Type: ${artifact.type}`);
    console.log(`[ArtifactMemory]   ID: ${artifact.id}`);
    console.log(`[ArtifactMemory]   Title: ${artifact.title || 'Untitled'}`);

    const storedArtifact = await pushArtifact(conversationId, {
        id: artifact.id,
        type: artifact.type,
        title: artifact.title || 'Untitled',
        data: artifact.data || {}
    });

    console.log(`[ArtifactMemory] ✅ Artifact stored successfully`);
    return storedArtifact;
};

/**
 * Extract and store artifact from tool execution result
 * Call this after any tool that creates/modifies a resource
 * 
 * @param {string} conversationId - Unique conversation/chat ID
 * @param {string} agentType - Agent that produced the result (forms, docs, sheets, etc.)
 * @param {string} toolName - Name of the tool that was executed
 * @param {object} result - Result from tool execution
 * @returns {object|null} - Stored artifact or null if no artifact to store
 */
const extractAndStoreArtifact = async (conversationId, agentType, toolName, result) => {
    console.log(`\n[ArtifactMemory] 🔍 Extracting artifact from ${agentType}/${toolName}`);
    console.log(`[ArtifactMemory]   ConversationId: ${conversationId || 'NOT PROVIDED'}`);
    
    // Debug: Log the received result structure
    if (result) {
        console.log(`[ArtifactMemory]   📊 Result keys: ${Object.keys(result).join(', ')}`);
        if (result.raw_results) {
            console.log(`[ArtifactMemory]   📊 raw_results length: ${result.raw_results.length}`);
            result.raw_results.forEach((r, i) => {
                console.log(`[ArtifactMemory]   📊 raw_results[${i}] keys: ${Object.keys(r).join(', ')}`);
            });
        }
    }
    
    if (!conversationId || !result) {
        console.log(`[ArtifactMemory]   ⚠️ Missing conversationId or result, skipping`);
        return null;
    }

    let artifact = null;

    // Extract artifact based on agent type and tool
    switch (agentType) {
        case 'forms':
            artifact = extractFormsArtifact(toolName, result);
            break;
        case 'docs':
            artifact = extractDocsArtifact(toolName, result);
            break;
        case 'sheets':
            artifact = extractSheetsArtifact(toolName, result);
            break;
        case 'gmail':
            artifact = extractGmailArtifact(toolName, result);
            break;
        case 'calendar':
            artifact = extractCalendarArtifact(toolName, result);
            break;
        case 'meet':
            artifact = extractMeetArtifact(toolName, result);
            break;
        case 'github':
            artifact = extractGitHubArtifact(toolName, result);
            break;
        default:
            console.log(`[ArtifactMemory]   ⚠️ Unknown agent type: ${agentType}`);
            return null;
    }

    if (artifact) {
        console.log(`[ArtifactMemory]   ✅ Extracted artifact: ${artifact.type} - ${artifact.title} (${artifact.id})`);
        return await addArtifact(conversationId, artifact);
    } else {
        console.log(`[ArtifactMemory]   ℹ️ No artifact extracted from ${toolName}`);
    }

    return null;
};

// ========== Artifact Extractors for Each Agent ==========

/**
 * Helper to unwrap agent results
 * Agents wrap tool outputs in raw_results array, this extracts the actual tool result
 */
const unwrapAgentResult = (result, ...idFields) => {
    if (!result) return null;
    
    // If raw_results exists, find the first successful result with one of the expected ID fields
    if (result.raw_results && Array.isArray(result.raw_results) && result.raw_results.length > 0) {
        for (const rawResult of result.raw_results) {
            if (rawResult.success) {
                for (const field of idFields) {
                    if (rawResult[field]) {
                        console.log(`[ArtifactMemory]   📦 Found data in raw_results.${field}: ${rawResult[field]}`);
                        return rawResult;
                    }
                }
            }
        }
    }
    
    // Return original result if no raw_results or no matching fields
    return result;
};

/**
 * Extract artifact from Forms tool result
 * Handles both direct tool results and agent-wrapped results (with raw_results)
 */
const extractFormsArtifact = (toolName, result) => {
    if (!result || !result.success) return null;

    // Unwrap agent result to get actual tool output
    const toolResult = unwrapAgentResult(result, 'formId', 'form');

    switch (toolName) {
        case 'createForm':
            if (toolResult.form || toolResult.formId) {
                return {
                    id: toolResult.formId || toolResult.form?.formId,
                    type: ARTIFACT_TYPES.FORM,
                    title: toolResult.form?.info?.title || toolResult.title || 'New Form',
                    data: {
                        responderUri: toolResult.form?.responderUri || toolResult.responderUri,
                        editUrl: toolResult.editUrl,
                        questionsCount: toolResult.questionsAdded || 0
                    }
                };
            }
            break;
        case 'updateForm':
            if (toolResult.form || toolResult.formId) {
                return {
                    id: toolResult.formId || toolResult.form?.formId,
                    type: ARTIFACT_TYPES.FORM,
                    title: toolResult.form?.info?.title || toolResult.title || 'Updated Form',
                    data: {
                        responderUri: toolResult.form?.responderUri,
                        updated: true
                    }
                };
            }
            break;
    }

    return null;
};

/**
 * Extract artifact from Docs tool result
 * Handles both direct tool results and agent-wrapped results (with raw_results)
 */
const extractDocsArtifact = (toolName, result) => {
    if (!result || !result.success) return null;

    // Unwrap agent result to get actual tool output
    const toolResult = unwrapAgentResult(result, 'documentId');

    switch (toolName) {
        case 'createDocument':
            if (toolResult.documentId) {
                return {
                    id: toolResult.documentId,
                    type: ARTIFACT_TYPES.DOC,
                    title: toolResult.title || 'New Document',
                    data: {
                        url: toolResult.url || `https://docs.google.com/document/d/${toolResult.documentId}/edit`
                    }
                };
            }
            break;
        case 'insertText':
        case 'appendText':
        case 'replaceText':
        case 'updateTextStyle':
            if (toolResult.documentId) {
                return {
                    id: toolResult.documentId,
                    type: ARTIFACT_TYPES.DOC,
                    title: toolResult.title || 'Document',
                    data: {
                        url: `https://docs.google.com/document/d/${toolResult.documentId}/edit`,
                        modified: true
                    }
                };
            }
            break;
    }

    return null;
};

/**
 * Extract artifact from Sheets tool result
 * Handles both direct tool results and agent-wrapped results (with raw_results)
 */
const extractSheetsArtifact = (toolName, result) => {
    if (!result || !result.success) return null;

    // Unwrap agent result to get actual tool output
    const toolResult = unwrapAgentResult(result, 'spreadsheetId');

    switch (toolName) {
        case 'createSpreadsheet':
            if (toolResult.spreadsheetId) {
                return {
                    id: toolResult.spreadsheetId,
                    type: ARTIFACT_TYPES.SHEET,
                    title: toolResult.title || toolResult.properties?.title || 'New Spreadsheet',
                    data: {
                        url: toolResult.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${toolResult.spreadsheetId}/edit`
                    }
                };
            }
            break;
        case 'updateCells':
        case 'appendData':
        case 'formatCells':
            if (toolResult.spreadsheetId) {
                return {
                    id: toolResult.spreadsheetId,
                    type: ARTIFACT_TYPES.SHEET,
                    title: toolResult.title || 'Spreadsheet',
                    data: {
                        url: `https://docs.google.com/spreadsheets/d/${toolResult.spreadsheetId}/edit`,
                        modified: true
                    }
                };
            }
            break;
    }

    return null;
};

/**
 * Extract artifact from Gmail tool result
 * Handles both direct tool results and agent-wrapped results (with raw_results)
 */
const extractGmailArtifact = (toolName, result) => {
    if (!result || !result.success) return null;

    // Unwrap agent result to get actual tool output
    const toolResult = unwrapAgentResult(result, 'messageId', 'draftId', 'labelId', 'filterId');

    switch (toolName) {
        case 'sendEmail':
            if (toolResult.messageId) {
                return {
                    id: toolResult.messageId,
                    type: ARTIFACT_TYPES.EMAIL,
                    title: toolResult.subject || 'Sent Email',
                    data: {
                        threadId: toolResult.threadId,
                        to: toolResult.to,
                        labelIds: toolResult.labelIds
                    }
                };
            }
            break;
        case 'createDraft':
            if (toolResult.draftId) {
                return {
                    id: toolResult.draftId,
                    type: ARTIFACT_TYPES.DRAFT,
                    title: toolResult.subject || 'Draft',
                    data: {
                        messageId: toolResult.messageId,
                        to: toolResult.to
                    }
                };
            }
            break;
        case 'createLabel':
            if (toolResult.labelId || toolResult.id) {
                return {
                    id: toolResult.labelId || toolResult.id,
                    type: ARTIFACT_TYPES.LABEL,
                    title: toolResult.name || 'Label',
                    data: {}
                };
            }
            break;
        case 'createFilter':
            if (toolResult.filterId || toolResult.id) {
                return {
                    id: toolResult.filterId || toolResult.id,
                    type: ARTIFACT_TYPES.FILTER,
                    title: 'Email Filter',
                    data: {
                        criteria: toolResult.criteria
                    }
                };
            }
            break;
    }

    return null;
};

/**
 * Extract artifact from Calendar tool result
 * Handles both direct tool results and agent-wrapped results (with raw_results)
 */
const extractCalendarArtifact = (toolName, result) => {
    if (!result || !result.success) return null;

    // Unwrap agent result to get actual tool output
    const toolResult = unwrapAgentResult(result, 'eventId', 'event', 'calendarId', 'id');

    switch (toolName) {
        case 'createEvent':
            if (toolResult.event || toolResult.eventId || toolResult.id) {
                const event = toolResult.event || toolResult;
                return {
                    id: toolResult.eventId || event.id,
                    type: ARTIFACT_TYPES.EVENT,
                    title: event.summary || toolResult.summary || 'New Event',
                    data: {
                        htmlLink: event.htmlLink || toolResult.htmlLink,
                        start: event.start?.dateTime || toolResult.start,
                        end: event.end?.dateTime || toolResult.end,
                        location: event.location || toolResult.location,
                        hangoutLink: event.hangoutLink || toolResult.hangoutLink
                    }
                };
            }
            break;
        case 'updateEvent':
            if (toolResult.event || toolResult.eventId || toolResult.id) {
                const event = toolResult.event || toolResult;
                return {
                    id: toolResult.eventId || event.id,
                    type: ARTIFACT_TYPES.EVENT,
                    title: event.summary || toolResult.summary || 'Updated Event',
                    data: {
                        htmlLink: event.htmlLink,
                        modified: true
                    }
                };
            }
            break;
        case 'createCalendar':
            if (toolResult.calendarId || toolResult.id) {
                return {
                    id: toolResult.calendarId || toolResult.id,
                    type: ARTIFACT_TYPES.CALENDAR,
                    title: toolResult.summary || 'New Calendar',
                    data: {}
                };
            }
            break;
    }

    return null;
};

/**
 * Extract artifact from Meet tool result
 * Handles both direct tool results and agent-wrapped results (with raw_results)
 * Also handles nested 'space' object from meetService
 */
const extractMeetArtifact = (toolName, result) => {
    console.log(`[ArtifactMemory] 🔍 extractMeetArtifact called for tool: ${toolName}`);
    console.log(`[ArtifactMemory]   Result success: ${result?.success}`);
    
    if (!result || !result.success) {
        console.log(`[ArtifactMemory]   ❌ Result is null or not successful`);
        return null;
    }

    // Unwrap agent result to get actual tool output
    let toolResult = unwrapAgentResult(result, 'meetingUri', 'meetingCode', 'name', 'space');
    console.log(`[ArtifactMemory]   After unwrap, toolResult keys: ${Object.keys(toolResult).join(', ')}`);
    
    // meetService returns { space: { name, meetingUri, meetingCode } }
    // So we need to check for nested space object
    if (toolResult.space) {
        console.log(`[ArtifactMemory]   📦 Found nested 'space' object in Meet result`);
        console.log(`[ArtifactMemory]   📦 space keys: ${Object.keys(toolResult.space).join(', ')}`);
        toolResult = toolResult.space;
    }
    
    console.log(`[ArtifactMemory]   Final toolResult: meetingUri=${toolResult.meetingUri}, meetingCode=${toolResult.meetingCode}, name=${toolResult.name}`);

    switch (toolName) {
        case 'createMeetingSpace':
        case 'createMeeting':
            if (toolResult.meetingUri || toolResult.meetingCode || toolResult.name) {
                return {
                    id: toolResult.name || toolResult.meetingCode || toolResult.meetingUri,
                    type: ARTIFACT_TYPES.MEET,
                    title: 'Google Meet',
                    data: {
                        meetingUri: toolResult.meetingUri,
                        meetingCode: toolResult.meetingCode,
                        name: toolResult.name
                    }
                };
            }
            break;
    }

    console.log(`[ArtifactMemory]   ❌ No artifact could be extracted (missing meetingUri/meetingCode/name)`);
    return null;
};

/**
 * Extract artifact from GitHub tool result
 * Handles both direct tool results and agent-wrapped results (with raw_results)
 */
const extractGitHubArtifact = (toolName, result) => {
    if (!result || !result.success) return null;

    // Unwrap agent result to get actual tool output
    const toolResult = unwrapAgentResult(result, 'id', 'full_name', 'number', 'html_url');

    switch (toolName) {
        case 'createRepository':
            if (toolResult.id || toolResult.full_name) {
                return {
                    id: toolResult.id?.toString() || toolResult.full_name,
                    type: ARTIFACT_TYPES.REPO,
                    title: toolResult.name || toolResult.full_name || 'New Repository',
                    data: {
                        url: toolResult.html_url,
                        fullName: toolResult.full_name,
                        private: toolResult.private
                    }
                };
            }
            break;
        case 'createIssue':
            if (toolResult.id || toolResult.number) {
                return {
                    id: toolResult.id?.toString() || toolResult.number?.toString(),
                    type: ARTIFACT_TYPES.ISSUE,
                    title: toolResult.title || 'New Issue',
                    data: {
                        url: toolResult.html_url,
                        number: toolResult.number,
                        state: toolResult.state
                    }
                };
            }
            break;
        case 'createPullRequest':
            if (toolResult.id || toolResult.number) {
                return {
                    id: toolResult.id?.toString() || toolResult.number?.toString(),
                    type: ARTIFACT_TYPES.PR,
                    title: toolResult.title || 'New Pull Request',
                    data: {
                        url: toolResult.html_url,
                        number: toolResult.number,
                        state: toolResult.state
                    }
                };
            }
            break;
    }

    return null;
};

/**
 * Format artifacts for inclusion in AI system prompt
 * 
 * @param {string} conversationId - Unique conversation/chat ID
 * @returns {string} - Formatted string for system prompt
 */
const formatArtifactsForPrompt = async (conversationId) => {
    console.log(`[ArtifactMemory] 📋 Formatting artifacts for prompt (conversation: ${conversationId})`);
    
    const artifacts = await getArtifacts(conversationId);
    
    if (!artifacts || artifacts.length === 0) {
        console.log(`[ArtifactMemory]   ℹ️ No artifacts found for this conversation`);
        return '';
    }

    console.log(`[ArtifactMemory]   📦 Found ${artifacts.length} artifacts`);

    const lines = ['Available artifacts from this conversation:'];
    
    artifacts.forEach((artifact, index) => {
        const displayType = TYPE_DISPLAY_NAMES[artifact.type] || artifact.type;
        const idField = getIdFieldName(artifact.type);
        const line = `- ${displayType}: "${artifact.title}" (${idField}=${artifact.id})`;
        lines.push(line);
        console.log(`[ArtifactMemory]   ${index + 1}. ${line}`);
    });

    lines.push('');
    lines.push('When user refers to "it", "that", "the previous one", "the form/doc/sheet we created", etc., resolve to the appropriate artifact above.');
    
    return lines.join('\n');
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
        pull_request: 'prId',
        label: 'labelId',
        filter: 'filterId'
    };
    return idFields[type] || 'id';
};

/**
 * Resolve an ambiguous reference to a specific artifact
 * 
 * @param {string} conversationId - Unique conversation/chat ID
 * @param {string} reference - The ambiguous reference (e.g., "it", "the form", "that document")
 * @returns {object|null} - Resolved artifact or null
 */
const resolveArtifactReference = async (conversationId, reference) => {
    const lowercased = reference.toLowerCase();
    
    // Try to detect artifact type from reference
    const typeMap = {
        'form': ARTIFACT_TYPES.FORM,
        'survey': ARTIFACT_TYPES.FORM,
        'questionnaire': ARTIFACT_TYPES.FORM,
        'doc': ARTIFACT_TYPES.DOC,
        'document': ARTIFACT_TYPES.DOC,
        'sheet': ARTIFACT_TYPES.SHEET,
        'spreadsheet': ARTIFACT_TYPES.SHEET,
        'excel': ARTIFACT_TYPES.SHEET,
        'email': ARTIFACT_TYPES.EMAIL,
        'mail': ARTIFACT_TYPES.EMAIL,
        'message': ARTIFACT_TYPES.EMAIL,
        'draft': ARTIFACT_TYPES.DRAFT,
        'event': ARTIFACT_TYPES.EVENT,
        'meeting': ARTIFACT_TYPES.EVENT,
        'appointment': ARTIFACT_TYPES.EVENT,
        'meet': ARTIFACT_TYPES.MEET,
        'video call': ARTIFACT_TYPES.MEET,
        'repo': ARTIFACT_TYPES.REPO,
        'repository': ARTIFACT_TYPES.REPO,
        'issue': ARTIFACT_TYPES.ISSUE,
        'pull request': ARTIFACT_TYPES.PR,
        'pr': ARTIFACT_TYPES.PR
    };

    // Check if reference contains a type hint
    for (const [keyword, type] of Object.entries(typeMap)) {
        if (lowercased.includes(keyword)) {
            return await getLastArtifactByType(conversationId, type);
        }
    }

    // If "it", "that", "this", "previous" without type hint, return most recent artifact
    if (/\b(it|that|this|previous|last)\b/.test(lowercased)) {
        return await getLastArtifact(conversationId);
    }

    return null;
};

module.exports = {
    // Core operations
    addArtifact,
    extractAndStoreArtifact,
    
    // Retrieval
    getArtifacts,
    getLastArtifact,
    getArtifactByType,
    getLastArtifactByType,
    listArtifacts,
    
    // Utilities
    formatArtifactsForPrompt,
    resolveArtifactReference,
    clearArtifacts,
    
    // Constants
    ARTIFACT_TYPES,
    TYPE_DISPLAY_NAMES
};
