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
    FILTER: 'filter',
    FLIGHT_SEARCH: 'flight_search',
    WEB_SEARCH: 'web_search',
    // Microsoft-specific types
    OUTLOOK_EMAIL: 'outlook_email',
    OUTLOOK_DRAFT: 'outlook_draft',
    MS_CALENDAR_EVENT: 'ms_calendar_event',
    ONEDRIVE_FILE: 'onedrive_file',
    ONEDRIVE_FOLDER: 'onedrive_folder',
    EXCEL_WORKBOOK: 'excel_workbook'
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
    filter: 'Filter',
    flight_search: 'Flight Search',
    web_search: 'Web Search',
    // Microsoft-specific display names
    outlook_email: 'Outlook Email',
    outlook_draft: 'Outlook Draft',
    ms_calendar_event: 'Microsoft Calendar Event',
    onedrive_file: 'OneDrive File',
    onedrive_folder: 'OneDrive Folder',
    excel_workbook: 'Excel Workbook'
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
        case 'flights':
            artifact = extractFlightsArtifact(toolName, result);
            break;
        case 'websearch':
            artifact = extractWebSearchArtifact(toolName, result);
            break;
        case 'microsoft':
            artifact = extractMicrosoftArtifact(toolName, result);
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
 * Extract artifact from Flights tool result
 * Stores flight search results so user can reference them later (e.g., "book that flight", "the IndiGo flight")
 */
const extractFlightsArtifact = (toolName, result) => {
    console.log(`[ArtifactMemory] 🔍 extractFlightsArtifact called for tool: ${toolName}`);
    console.log(`[ArtifactMemory]   Result success: ${result?.success}`);
    
    if (!result || !result.success) {
        console.log(`[ArtifactMemory]   ❌ Result is null or not successful`);
        return null;
    }

    // Unwrap agent result to get actual tool output
    let toolResult = result;
    if (result.raw_results && Array.isArray(result.raw_results) && result.raw_results.length > 0) {
        const successResult = result.raw_results.find(r => r.success && r.data);
        if (successResult) {
            toolResult = successResult;
        }
    }
    
    console.log(`[ArtifactMemory]   toolResult keys: ${Object.keys(toolResult).join(', ')}`);

    switch (toolName) {
        case 'searchFlights': {
            // Result shape from FlightsAgentMultiStep:
            // { success, flights, count, raw: { search_parameters, best_flights, other_flights, ... } }
            const raw = toolResult.raw || toolResult;
            const sp = raw.search_parameters || {};
            const searchParams = {
                from: sp.departure_id || toolResult.from,
                to: sp.arrival_id || toolResult.to,
                date: sp.outbound_date || toolResult.date,
                returnDate: sp.return_date || null,
                currency: sp.currency || 'INR',
                travelers: sp.adults || 1
            };
            const bestFlights = raw.best_flights || toolResult.flights || [];
            const otherFlights = raw.other_flights || [];

            if (!searchParams.from || !searchParams.to) {
                console.log(`[ArtifactMemory]   ❌ Missing from/to in searchFlights result`);
                return null;
            }

            const searchId2 = `${searchParams.from}-${searchParams.to}-${searchParams.date || Date.now()}`;
            const routeTitle2 = `${searchParams.from} to ${searchParams.to}`;

            const flightsList2 = [...bestFlights, ...otherFlights].slice(0, 10).map(flight => {
                const firstLeg = flight.flights?.[0] || {};
                return {
                    airline: firstLeg.airline || flight.airline,
                    flightNumber: firstLeg.flight_number || flight.flight_number,
                    price: flight.price,
                    departureTime: firstLeg.departure_airport?.time,
                    arrivalTime: flight.flights?.[flight.flights.length - 1]?.arrival_airport?.time,
                    duration: flight.total_duration,
                    stops: (flight.flights?.length || 1) - 1
                };
            });

            console.log(`[ArtifactMemory]   ✅ Extracted ${flightsList2.length} flights for route: ${routeTitle2}`);
            return {
                id: searchId2,
                type: ARTIFACT_TYPES.FLIGHT_SEARCH,
                title: `Flights: ${routeTitle2} on ${searchParams.date || 'unknown date'}`,
                data: {
                    from: searchParams.from,
                    to: searchParams.to,
                    date: searchParams.date,
                    returnDate: searchParams.returnDate,
                    currency: searchParams.currency,
                    travelers: searchParams.travelers,
                    flightsCount: bestFlights.length + otherFlights.length,
                    flights: flightsList2,
                    bestFlights: bestFlights,
                    otherFlights: otherFlights
                }
            };
        }
        case 'getFlightsList':
        case 'getFlightsPriceInsights':
            // Extract search parameters and flight data
            const data = toolResult.data || toolResult;
            const searchParams = data.search_metadata?.search_params || data.search_params || {};
            const bestFlights = data.best_flights || [];
            const otherFlights = data.other_flights || [];
            
            // Generate a unique search ID based on route and date
            const searchId = `${searchParams.from || 'unknown'}-${searchParams.to || 'unknown'}-${searchParams.date || Date.now()}`;
            const routeTitle = `${searchParams.from || '?'} to ${searchParams.to || '?'}`;
            
            // Extract flight details for quick reference
            const flightsList = [...bestFlights, ...otherFlights].slice(0, 10).map(flight => {
                const firstLeg = flight.flights?.[0] || {};
                return {
                    airline: firstLeg.airline || flight.airline,
                    flightNumber: firstLeg.flight_number || flight.flight_number,
                    price: flight.price,
                    departureTime: firstLeg.departure_airport?.time,
                    arrivalTime: firstLeg.arrival_airport?.time || flight.flights?.[flight.flights.length - 1]?.arrival_airport?.time,
                    duration: flight.total_duration,
                    stops: (flight.flights?.length || 1) - 1
                };
            });

            console.log(`[ArtifactMemory]   ✅ Extracted ${flightsList.length} flights for route: ${routeTitle}`);
            
            return {
                id: searchId,
                type: ARTIFACT_TYPES.FLIGHT_SEARCH,
                title: `Flights: ${routeTitle} on ${searchParams.date || 'unknown date'}`,
                data: {
                    from: searchParams.from,
                    to: searchParams.to,
                    date: searchParams.date,
                    returnDate: searchParams.returnDate,
                    currency: searchParams.currency || 'INR',
                    travelers: searchParams.travelers || 1,
                    flightsCount: bestFlights.length + otherFlights.length,
                    flights: flightsList,
                    bestFlights: bestFlights,
                    otherFlights: otherFlights
                }
            };
    }

    console.log(`[ArtifactMemory]   ❌ No artifact could be extracted for tool: ${toolName}`);
    return null;
};

/**
 * Extract artifact from WebSearch tool result
 * Stores web search results for reference in subsequent operations
 */
const extractWebSearchArtifact = (toolName, result) => {
    console.log(`[ArtifactMemory] 🔍 extractWebSearchArtifact called for tool: ${toolName}`);
    console.log(`[ArtifactMemory]   Result success: ${result?.success}`);
    
    if (!result || !result.success) {
        console.log(`[ArtifactMemory]   ❌ Result is null or not successful`);
        return null;
    }

    // Unwrap agent result to get actual tool output
    let toolResult = result;
    if (result.raw_results && Array.isArray(result.raw_results) && result.raw_results.length > 0) {
        const successResult = result.raw_results.find(r => r.success);
        if (successResult) {
            toolResult = successResult;
        }
    }
    
    console.log(`[ArtifactMemory]   toolResult keys: ${Object.keys(toolResult).join(', ')}`);

    switch (toolName) {
        case 'webSearch':
        case 'searchWeb':
        case 'fetchAndSynthesize':
        case 'researchAndSynthesize':
            // Extract synthesizedContent from websearch results
            const synthesizedContent = toolResult.synthesizedContent || toolResult.content;
            const sources = toolResult.sources || [];
            const query = toolResult.query || toolResult.searchQuery || 'Unknown query';
            
            if (!synthesizedContent) {
                console.log(`[ArtifactMemory]   ❌ No synthesizedContent found in websearch result`);
                return null;
            }
            
            // Create a unique search ID based on query and timestamp
            const searchId = `websearch_${Date.now()}_${query.substring(0, 20).replace(/\s+/g, '_')}`;
            
            console.log(`[ArtifactMemory]   ✅ Extracted websearch result for query: "${query}"`);
            console.log(`[ArtifactMemory]   📊 Content length: ${synthesizedContent.length} chars, Sources: ${sources.length}`);
            
            return {
                id: searchId,
                type: ARTIFACT_TYPES.WEB_SEARCH,
                title: `Web Search: ${query}`,
                data: {
                    query: query,
                    synthesizedContent: synthesizedContent,
                    sources: sources.map(s => ({
                        title: s.title,
                        url: s.url,
                        snippet: s.snippet
                    })),
                    searchedAt: new Date().toISOString(),
                    contentLength: synthesizedContent.length,
                    sourcesCount: sources.length
                }
            };
    }

    console.log(`[ArtifactMemory]   ❌ No artifact could be extracted for websearch tool: ${toolName}`);
    return null;
};

/**
 * Extract artifact from Microsoft tool result
 * Handles Outlook email, Calendar, OneDrive, and Excel operations
 */
const extractMicrosoftArtifact = (toolName, result) => {
    console.log(`[ArtifactMemory] 🔍 extractMicrosoftArtifact called for tool: ${toolName}`);
    console.log(`[ArtifactMemory]   Result success: ${result?.success}`);
    
    if (!result || !result.success) {
        console.log(`[ArtifactMemory]   ❌ Result is null or not successful`);
        return null;
    }

    // For Microsoft, try to get data directly from raw_results first
    // raw_results contains the actual tool output with documentId, webUrl, etc.
    let toolResult = null;
    
    if (result.raw_results && Array.isArray(result.raw_results) && result.raw_results.length > 0) {
        // Find the first successful result
        for (const rawResult of result.raw_results) {
            if (rawResult.success) {
                toolResult = rawResult;
                console.log(`[ArtifactMemory]   📦 Using raw_results data: ${Object.keys(rawResult).join(', ')}`);
                break;
            }
        }
    }
    
    // Fallback to unwrap if no raw_results
    if (!toolResult) {
        toolResult = unwrapAgentResult(result, 'messageId', 'id', 'eventId', 'itemId', 'workbookId', 'documentId');
    }
    
    // Handle OpenAI tool result format where content is a JSON string
    if (toolResult.content && typeof toolResult.content === 'string') {
        try {
            const parsed = JSON.parse(toolResult.content);
            toolResult = parsed;
            console.log(`[ArtifactMemory]   📦 Parsed content from OpenAI tool result format`);
        } catch (e) {
            // Not JSON, use as-is
        }
    }
    
    console.log(`[ArtifactMemory]   After unwrap, toolResult keys: ${Object.keys(toolResult).join(', ')}`);

    switch (toolName) {
        case 'createDocument':
        case 'microsoft_createWordDocument':
            // ✅ CRITICAL FIX: Handle Word document creation from Microsoft agent
            // The tool can be called either 'createDocument' (from microsoft agent) or 'microsoft_createWordDocument'
            if (toolResult.documentId || toolResult.id || toolResult.itemId) {
                return {
                    id: toolResult.documentId || toolResult.id || toolResult.itemId,
                    type: 'word_document',
                    title: toolResult.name || toolResult.title || 'Word Document',
                    data: {
                        webUrl: toolResult.webUrl || toolResult.url,
                        createdAt: toolResult.createdDateTime || new Date().toISOString(),
                        size: toolResult.size
                    }
                };
            }
            break;
        // ========== OUTLOOK EMAIL ==========
        case 'microsoft_sendEmail':
            // Microsoft sendEmail returns { success: true, message: 'Email sent successfully' }
            // but we can store details from params that were passed
            if (toolResult.success) {
                return {
                    id: toolResult.messageId || `ms_email_${Date.now()}`,
                    type: ARTIFACT_TYPES.OUTLOOK_EMAIL,
                    title: toolResult.subject || 'Sent via Outlook',
                    data: {
                        to: toolResult.to,
                        subject: toolResult.subject,
                        sentAt: new Date().toISOString()
                    }
                };
            }
            break;

        case 'microsoft_replyToEmail':
            if (toolResult.success) {
                return {
                    id: toolResult.messageId || `ms_reply_${Date.now()}`,
                    type: ARTIFACT_TYPES.OUTLOOK_EMAIL,
                    title: 'Reply via Outlook',
                    data: {
                        originalMessageId: toolResult.messageId,
                        repliedAt: new Date().toISOString()
                    }
                };
            }
            break;

        case 'microsoft_forwardEmail':
            if (toolResult.success) {
                return {
                    id: toolResult.messageId || `ms_forward_${Date.now()}`,
                    type: ARTIFACT_TYPES.OUTLOOK_EMAIL,
                    title: 'Forwarded via Outlook',
                    data: {
                        originalMessageId: toolResult.messageId,
                        forwardedAt: new Date().toISOString()
                    }
                };
            }
            break;

        // ========== MICROSOFT CALENDAR ==========
        case 'microsoft_createCalendarEvent':
            if (toolResult.id || toolResult.eventId) {
                return {
                    id: toolResult.id || toolResult.eventId,
                    type: ARTIFACT_TYPES.MS_CALENDAR_EVENT,
                    title: toolResult.subject || 'Microsoft Calendar Event',
                    data: {
                        webLink: toolResult.webLink,
                        start: toolResult.start?.dateTime,
                        end: toolResult.end?.dateTime,
                        location: toolResult.location?.displayName,
                        onlineMeetingUrl: toolResult.onlineMeetingUrl,
                        isOnlineMeeting: toolResult.isOnlineMeeting
                    }
                };
            }
            break;

        case 'microsoft_updateCalendarEvent':
            if (toolResult.id || toolResult.eventId) {
                return {
                    id: toolResult.id || toolResult.eventId,
                    type: ARTIFACT_TYPES.MS_CALENDAR_EVENT,
                    title: toolResult.subject || 'Updated Microsoft Calendar Event',
                    data: {
                        webLink: toolResult.webLink,
                        modified: true
                    }
                };
            }
            break;

        // ========== ONEDRIVE ==========
        case 'microsoft_uploadFile':
            if (toolResult.id || toolResult.itemId) {
                return {
                    id: toolResult.id || toolResult.itemId,
                    type: ARTIFACT_TYPES.ONEDRIVE_FILE,
                    title: toolResult.name || 'OneDrive File',
                    data: {
                        webUrl: toolResult.webUrl,
                        size: toolResult.size,
                        mimeType: toolResult.file?.mimeType
                    }
                };
            }
            break;

        case 'microsoft_createFolder':
            if (toolResult.id || toolResult.itemId) {
                return {
                    id: toolResult.id || toolResult.itemId,
                    type: ARTIFACT_TYPES.ONEDRIVE_FOLDER,
                    title: toolResult.name || 'OneDrive Folder',
                    data: {
                        webUrl: toolResult.webUrl
                    }
                };
            }
            break;

        // ========== WORD DOCUMENTS ==========
        case 'microsoft_createWordDocument':
            // Handle Word document creation
            // raw_results uses 'documentId', direct results might use 'id' or 'itemId'
            if (toolResult.documentId || toolResult.id || toolResult.itemId) {
                return {
                    id: toolResult.documentId || toolResult.id || toolResult.itemId,
                    type: 'word_document',
                    title: toolResult.name || 'Word Document',
                    data: {
                        webUrl: toolResult.webUrl,
                        createdAt: toolResult.createdDateTime || new Date().toISOString(),
                        size: toolResult.size
                    }
                };
            }
            break;

        case 'microsoft_addContentToWordDocument':
            // Handle content addition - use the document info returned
            if (toolResult.documentId || toolResult.id || toolResult.itemId) {
                return {
                    id: toolResult.documentId || toolResult.id || toolResult.itemId,
                    type: 'word_document',
                    title: toolResult.name || 'Word Document',
                    data: {
                        webUrl: toolResult.webUrl,
                        contentAdded: true,
                        modifiedAt: toolResult.lastModifiedDateTime || new Date().toISOString()
                    }
                };
            }
            break;

        // ========== EXCEL ==========
        case 'microsoft_createExcelWorkbook':
            // Handle Excel workbook creation
            if (toolResult.documentId || toolResult.workbookId || toolResult.id || toolResult.itemId) {
                return {
                    id: toolResult.documentId || toolResult.workbookId || toolResult.id || toolResult.itemId,
                    type: ARTIFACT_TYPES.EXCEL_WORKBOOK,
                    title: toolResult.name || 'Excel Workbook',
                    data: {
                        webUrl: toolResult.webUrl,
                        createdAt: toolResult.createdDateTime || new Date().toISOString(),
                        size: toolResult.size
                    }
                };
            }
            break;

        case 'microsoft_updateExcel':
            if (toolResult.workbookId) {
                return {
                    id: toolResult.workbookId,
                    type: ARTIFACT_TYPES.EXCEL_WORKBOOK,
                    title: toolResult.worksheetName || 'Excel Workbook',
                    data: {
                        worksheetName: toolResult.worksheetName,
                        range: toolResult.range,
                        modified: true
                    }
                };
            }
            break;
    }

    console.log(`[ArtifactMemory]   ❌ No artifact could be extracted for Microsoft tool: ${toolName}`);
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
        let line = `- ${displayType}: "${artifact.title}" (${idField}=${artifact.id})`;
        
        // Add extra context for flight search artifacts
        if (artifact.type === 'flight_search' && artifact.data) {
            const flightData = artifact.data;
            line += `\n  Route: ${flightData.from} → ${flightData.to}`;
            line += `\n  Date: ${flightData.date}${flightData.returnDate ? ' (Return: ' + flightData.returnDate + ')' : ''}`;
            line += `\n  Travelers: ${flightData.travelers || 1}, Currency: ${flightData.currency || 'INR'}`;
            
            // List available flights for reference
            if (flightData.flights && flightData.flights.length > 0) {
                line += `\n  Available flights (${flightData.flightsCount} total):`;
                flightData.flights.slice(0, 5).forEach((flight, i) => {
                    const flightNum = flight.flightNumber || 'N/A';
                    const airline = flight.airline || 'Unknown';
                    const price = flight.price ? `₹${flight.price}` : 'Price N/A';
                    const depTime = flight.departureTime || '';
                    const arrTime = flight.arrivalTime || '';
                    const stops = flight.stops === 0 ? 'Direct' : `${flight.stops} stop(s)`;
                    line += `\n    ${i + 1}. ${airline} ${flightNum} - ${price} | ${depTime} → ${arrTime} | ${stops}`;
                });
            }
        }
        
        // Add extra context for websearch artifacts
        if (artifact.type === 'web_search' && artifact.data) {
            const wsData = artifact.data;
            line += `\n  Query: "${wsData.query}"`;
            line += `\n  Content: ${wsData.contentLength} characters`;
            line += `\n  Sources: ${wsData.sourcesCount || 0}`;
            if (wsData.synthesizedContent) {
                // Show first 300 chars of the synthesized content
                const preview = wsData.synthesizedContent.length > 300 
                    ? wsData.synthesizedContent.substring(0, 300) + '...' 
                    : wsData.synthesizedContent;
                line += `\n  Preview: ${preview}`;
            }
            if (wsData.sources && wsData.sources.length > 0) {
                line += `\n  Top Sources:`;
                wsData.sources.slice(0, 3).forEach((source, i) => {
                    line += `\n    ${i + 1}. ${source.title || 'Untitled'} - ${source.url}`;
                });
            }
        }
        
        // Add extra context for Microsoft artifacts
        if (artifact.type === 'outlook_email' && artifact.data) {
            if (artifact.data.to) line += `\n  To: ${artifact.data.to}`;
            if (artifact.data.subject) line += `\n  Subject: ${artifact.data.subject}`;
        }
        
        if (artifact.type === 'ms_calendar_event' && artifact.data) {
            if (artifact.data.start) line += `\n  Start: ${artifact.data.start}`;
            if (artifact.data.location) line += `\n  Location: ${artifact.data.location}`;
            if (artifact.data.onlineMeetingUrl) line += `\n  Teams Meeting: ${artifact.data.onlineMeetingUrl}`;
        }
        
        if ((artifact.type === 'onedrive_file' || artifact.type === 'onedrive_folder') && artifact.data) {
            if (artifact.data.webUrl) line += `\n  URL: ${artifact.data.webUrl}`;
        }
        
        lines.push(line);
        console.log(`[ArtifactMemory]   ${index + 1}. ${displayType}: ${artifact.title}`);
    });

    lines.push('');
    lines.push('When user refers to "it", "that", "the previous one", "the form/doc/sheet we created", "that flight", "the IndiGo flight", "the outlook email", "the onedrive file", "this info", "these results", "the search results", etc., resolve to the appropriate artifact above.');
    lines.push('For flights: If user says "book flight X" or "I want the IndiGo flight", use the flight details from the stored flight search artifact above.');
    lines.push('For web searches: If user says "send this info", "email these results", "send the search results", use the synthesized content and sources from the web search artifact above.');
    lines.push('For Microsoft: Resolve references to "the email I sent via outlook", "the teams meeting", "the file on onedrive" to the appropriate Microsoft artifact.');
    
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
        filter: 'filterId',
        flight_search: 'searchId',
        web_search: 'searchId',
        // Microsoft-specific ID fields
        outlook_email: 'messageId',
        outlook_draft: 'draftId',
        ms_calendar_event: 'eventId',
        onedrive_file: 'itemId',
        onedrive_folder: 'folderId',
        excel_workbook: 'workbookId'
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
        'excel': ARTIFACT_TYPES.EXCEL_WORKBOOK,
        'workbook': ARTIFACT_TYPES.EXCEL_WORKBOOK,
        'email': ARTIFACT_TYPES.EMAIL,
        'mail': ARTIFACT_TYPES.EMAIL,
        'message': ARTIFACT_TYPES.EMAIL,
        'outlook email': ARTIFACT_TYPES.OUTLOOK_EMAIL,
        'outlook mail': ARTIFACT_TYPES.OUTLOOK_EMAIL,
        'microsoft email': ARTIFACT_TYPES.OUTLOOK_EMAIL,
        'draft': ARTIFACT_TYPES.DRAFT,
        'event': ARTIFACT_TYPES.EVENT,
        'meeting': ARTIFACT_TYPES.EVENT,
        'appointment': ARTIFACT_TYPES.EVENT,
        'outlook event': ARTIFACT_TYPES.MS_CALENDAR_EVENT,
        'microsoft calendar': ARTIFACT_TYPES.MS_CALENDAR_EVENT,
        'teams meeting': ARTIFACT_TYPES.MS_CALENDAR_EVENT,
        'meet': ARTIFACT_TYPES.MEET,
        'video call': ARTIFACT_TYPES.MEET,
        'onedrive': ARTIFACT_TYPES.ONEDRIVE_FILE,
        'onedrive file': ARTIFACT_TYPES.ONEDRIVE_FILE,
        'onedrive folder': ARTIFACT_TYPES.ONEDRIVE_FOLDER,
        'repo': ARTIFACT_TYPES.REPO,
        'repository': ARTIFACT_TYPES.REPO,
        'issue': ARTIFACT_TYPES.ISSUE,
        'pull request': ARTIFACT_TYPES.PR,
        'pr': ARTIFACT_TYPES.PR,
        'flight': ARTIFACT_TYPES.FLIGHT_SEARCH,
        'flights': ARTIFACT_TYPES.FLIGHT_SEARCH,
        'ticket': ARTIFACT_TYPES.FLIGHT_SEARCH,
        'booking': ARTIFACT_TYPES.FLIGHT_SEARCH,
        'indigo': ARTIFACT_TYPES.FLIGHT_SEARCH,
        'air india': ARTIFACT_TYPES.FLIGHT_SEARCH,
        'spicejet': ARTIFACT_TYPES.FLIGHT_SEARCH,
        'vistara': ARTIFACT_TYPES.FLIGHT_SEARCH,
        'search': ARTIFACT_TYPES.WEB_SEARCH,
        'web search': ARTIFACT_TYPES.WEB_SEARCH,
        'research': ARTIFACT_TYPES.WEB_SEARCH,
        'info': ARTIFACT_TYPES.WEB_SEARCH,
        'information': ARTIFACT_TYPES.WEB_SEARCH,
        'results': ARTIFACT_TYPES.WEB_SEARCH
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
