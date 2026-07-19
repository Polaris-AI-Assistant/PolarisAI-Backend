/**
 * Main Agent Controller
 * 
 * HTTP endpoint for interacting with the Main Coordinator Agent.
 * This is the primary entry point for users to send queries that may
 * involve one or multiple specialized agents.
 * 
 * Includes:
 * - Streaming query processing with SSE
 * - Confirmation flow for sensitive actions
 * - Confirm/Cancel action endpoints
 * - Artifact memory management
 * - Long-term memory integration
 */

const express = require('express');
const MainAgent = require('./mainAgent');
const confirmationStore = require('./confirmationStore');
const { TimelineEmitter } = require('./timelineEvents');
const { authenticateToken } = require('../middleware/auth');

// Credit System imports
const { checkCredits } = require('../middleware/creditMiddleware');
const { 
  deductCreditsForAgents, 
  getCreditInfoForStream, 
  getCreditDeductionInfoForStream 
} = require('../credits/creditIntegration');

// File context imports
const { buildFileContexts, trackFileReference } = require('../files/fileContextBuilder');

// Socket.io imports for real-time WebSocket events
const { emitAIThinking, emitAgentStatus, emitChatTitleUpdate, sendNotification: sendSocketNotification } = require('../socket/socketManager');

// Artifact Memory imports
const { 
    listArtifacts, 
    getArtifacts, 
    clearArtifacts 
} = require('../utils/artifactMemory');

// Long-term Memory imports
const {
    addMemory,
    MEMORY_CONFIG,
    SOURCE_APPS
} = require('../memory/memoryService');

// Chat History imports
const chatData = require('../chat/chatData');

// File Generation Service
const fileGenerationService = require('../files/fileGenerationService');

const router = express.Router();

// Initialize the Main Coordinator Agent
const mainAgent = new MainAgent();

/**
 * Detect if a query is requesting file generation (PDF or TXT)
 * @param {string} query - User's query
 * @returns {Object} - { fileType: 'pdf' | 'txt' | null, isExplicit: boolean }
 */
function detectFileGenerationRequest(query) {
  if (!query) return { fileType: null, isExplicit: false };

  const lowerQuery = query.toLowerCase();

  // Regex patterns for explicit file generation requests
  const pdfPatterns = [
    /generate\s+(?:a\s+)?pdf/i,
    /export\s+(?:as\s+)?pdf/i,
    /create\s+(?:a\s+)?pdf/i,
    /make\s+(?:a\s+)?pdf/i,
    /convert\s+(?:to\s+)?pdf/i,
    /save\s+(?:as\s+)?pdf/i,
    /download\s+(?:as\s+)?pdf/i,
    /in\s+(?:a\s+)?pdf/i,
    /in\s+pdf\s+(?:format|file)/i,
    /as\s+(?:a\s+)?pdf/i,
    /\bpdf\b.*(?:file|document|export|generate|create|download|format)/i,
    /(?:file|document|export|generate|create|download)\s+.*pdf/i,
    /(?:with|from|of)\s+(?:the\s+)?(?:above|previous|search|results?).*pdf/i,  // ✅ NEW: "create pdf with the above search results"
    /pdf.*(?:with|from|of)\s+(?:the\s+)?(?:above|previous|search|results?)/i,  // ✅ NEW: "pdf with the search results"
  ];

  const txtPatterns = [
    /generate\s+(?:a\s+)?(?:text|txt)\s+file/i,
    /export\s+(?:as\s+)?(?:text|txt)/i,
    /create\s+(?:a\s+)?(?:text|txt)\s+file/i,
    /make\s+(?:a\s+)?(?:text|txt)\s+file/i,
    /convert\s+(?:to\s+)?(?:text|txt)/i,
    /save\s+(?:as\s+)?(?:text|txt)/i,
    /download\s+(?:as\s+)?(?:text|txt)/i,
    /in\s+(?:a\s+)?(?:text|txt)\s+(?:file|format)/i,
    /as\s+(?:a\s+)?(?:text|txt)/i,
    /\b(?:text|txt)\b.*(?:file|export|generate|create|download|format)/i,
    /(?:with|from|of)\s+(?:the\s+)?(?:above|previous|search|results?).*(?:text|txt)/i,  // ✅ NEW: "create txt with the above search results"
    /(?:text|txt).*(?:with|from|of)\s+(?:the\s+)?(?:above|previous|search|results?)/i,  // ✅ NEW: "txt with the search results"
  ];

  // Check for PDF request
  if (pdfPatterns.some(pattern => pattern.test(query))) {
    return { fileType: 'pdf', isExplicit: true };
  }

  // Check for TXT request
  if (txtPatterns.some(pattern => pattern.test(query))) {
    return { fileType: 'txt', isExplicit: true };
  }

  return { fileType: null, isExplicit: false };
}

/**
 * Determine if an exchange should be automatically stored in long-term memory
 * Based on heuristics about the exchange content and type
 * 
 * IMPORTANT: This is now disabled by default. Only explicit user action (clicking "remember")
 * should trigger memory storage to respect user consent.
 * 
 * @param {string} query - User's query
 * @param {string} response - Assistant's response
 * @param {string[]} agentsUsed - List of agents used
 * @returns {boolean} - Whether to auto-store (ALWAYS FALSE now - require explicit user action)
 */
function shouldAutoStoreMemory(query, response, agentsUsed) {
  // ⚠️ DISABLED: Auto-storage requires explicit user consent via "Remember" button
  // Memory should only be stored when user EXPLICITLY clicks "Remember" on a conversation
  // This respects user privacy and preferences
  return false;
}

/**
 * POST /agent/query/stream
 * Process natural language queries with streaming response
 * 
 * Request body:
 * {
 *   "query": "schedule a meeting tomorrow and create a document for it",
 *   "conversationHistory": [], // optional
 *   "conversationId": "uuid" // optional - for artifact memory
 *   "addToMemory": boolean // optional - whether to auto-store this exchange in long-term memory
 * }
 * 
 * Response: Server-Sent Events (SSE) stream
 */
router.post('/query/stream', authenticateToken, checkCredits, async (req, res) => {
  try {
    const { query, conversationHistory, conversationId, addToMemory, userLocation, chatId, messageId, fileIds, userMessageId, responseLanguage } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Query is required and must be a non-empty string',
      });
    }

    console.log(`[MainAgentController] User ${userId} streaming query: "${query}"`);
    if (conversationId) {
      console.log(`[MainAgentController] Conversation ID: ${conversationId}`);
    }
    if (chatId) {
      console.log(`[MainAgentController] Chat ID (Session ID): ${chatId}`);
    }
    if (messageId) {
      console.log(`[MainAgentController] Message ID: ${messageId}`);
    }
    if (addToMemory) {
      console.log(`[MainAgentController] Auto-store to memory: enabled`);
    }
    if (userLocation) {
      console.log(`[MainAgentController] User location provided: ${userLocation.lat}, ${userLocation.lng}`);
    }
    if (fileIds && fileIds.length > 0) {
      console.log(`[MainAgentController] File IDs provided: ${fileIds.length} files`);
    }

    // Build file contexts if fileIds provided
    let fileContext = null;
    if (fileIds && fileIds.length > 0) {
      try {
        console.log(`[MainAgentController] 📎 Building file context for ${fileIds.length} files...`);
        fileContext = await buildFileContexts(fileIds, query, userId);
        console.log(`[MainAgentController] ✅ File context built: ${fileContext.filesProcessed} files, ~${fileContext.tokensUsed} tokens`);
        
        // Track file references - link to user message (not assistant message) for chat persistence
        const trackMessageId = userMessageId || messageId;
        if (trackMessageId && chatId) {
          for (const fileId of fileIds) {
            await trackFileReference(fileId, trackMessageId, chatId).catch(err => {
              console.error(`[MainAgentController] ⚠️ Error tracking file reference:`, err);
            });
          }
        }
      } catch (fileError) {
        console.error(`[MainAgentController] ⚠️ Error building file context:`, fileError);
        // Continue without file context if there's an error
      }
    }

    // Retrieve full chat history from database if chatId is provided
    let fullChatHistory = conversationHistory || [];
    if (chatId) {
      try {
        console.log(`[MainAgentController] 💬 Retrieving full chat history from database for chatId: ${chatId}`);
        const chatSession = await chatData.getChatSession(chatId, userId);
        if (chatSession && chatSession.messages) {
          fullChatHistory = chatSession.messages;
          console.log(`[MainAgentController] ✅ Retrieved ${fullChatHistory.length} messages from database`);
        } else {
          console.log(`[MainAgentController] ⚠️ No chat session found in database, using provided history`);
        }
      } catch (dbError) {
        console.error(`[MainAgentController] ⚠️ Error retrieving chat history from database:`, dbError.message);
        console.log(`[MainAgentController] ⚠️ Falling back to provided conversationHistory`);
        // Continue with provided conversationHistory if database retrieval fails
      }
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering in nginx

    // Send thinking indicator (SSE)
    res.write(`data: ${JSON.stringify({ type: 'thinking', status: 'start' })}\n\n`);

    // Emit "AI is thinking" via Socket.io for real-time WebSocket clients
    if (conversationId || chatId) {
      emitAIThinking(conversationId || chatId, true);
    }

    // Track the complete response for memory storage
    let completeResponse = '';
    let agentsUsed = [];

    try {
      // Process the query through the main agent with streaming
      // Now includes conversationId for artifact memory and userLocation for Maps
      // Uses fullChatHistory retrieved from database for complete conversation context
      const result = await mainAgent.processQueryWithStreaming(query, userId, { 
        conversationHistory: fullChatHistory,  // Pass full chat history from database
        conversationId,  // Pass conversationId for artifact memory
        userLocation,  // Pass userLocation for Maps agent
        chatId,  // Pass chatId for reference
        fileContext,  // Pass file context for LLM
        fileIds,  // ✅ NEW: Pass fileIds for Gmail agent attachment support
        responseLanguage  // Pass response language preference for multi-language support
      }, (chunk) => {
        // Accumulate content chunks for memory storage
        if (chunk.type === 'content' && chunk.text) {
          completeResponse += chunk.text;
        }
        if (chunk.type === 'metadata' && chunk.agentsUsed) {
          agentsUsed = chunk.agentsUsed;
          
          // ✅ Send credit info when agents are determined
          getCreditInfoForStream(agentsUsed, userId).then(creditInfo => {
            res.write(`data: ${JSON.stringify(creditInfo)}\n\n`);
          }).catch(err => {
            console.error('[MainAgentController] Error sending credit info:', err);
          });
        }

        // Emit agent status updates via Socket.io for real-time listeners
        if (chunk.type === 'status' && chunk.message) {
          const activeChatId = conversationId || chatId;
          if (activeChatId) {
            emitAgentStatus(activeChatId, chunk.message);
          }
        }

        // Emit task completion/failure notifications via Socket.io (toasts)
        // This ensures users get a toast even if SSE handlers vary by page/component.
        if (chunk.type === 'timeline_task_completed' || chunk.type === 'timeline_task_failed') {
          try {
            const status = chunk.status || (chunk.type === 'timeline_task_failed' ? 'failed' : 'completed');
            const isNeedsInput = status === 'needs_input';
            const notifType =
              chunk.type === 'timeline_task_failed' ? 'error' : isNeedsInput ? 'warning' : 'success';

            sendSocketNotification(userId, {
              type: notifType,
              title: chunk.type === 'timeline_task_failed'
                ? 'Action failed'
                : isNeedsInput
                ? 'Needs your input'
                : 'Action completed',
              message: chunk.message || chunk.summary || (chunk.type === 'timeline_task_failed' ? 'Action failed' : 'Action completed'),
              data: {
                chatId: chatId || conversationId || null,
                conversationId: conversationId || null,
                messageId: messageId || null,
                status,
                dedupeKey: `agent:${chunk.type}:${userId}:${chatId || conversationId || 'none'}:${messageId || 'none'}:${chunk.eventId || ''}`,
              },
            });
          } catch (e) {
            console.warn('[MainAgentController] ⚠️ Failed to emit socket notification:', e.message);
          }
        }
        
        // Send each chunk to the client
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      });

      // Save timeline events to database ONLY if flow is complete (no pending confirmation)
      // If there's a pending confirmation, timeline will be saved after all confirmations are done
      const hasPendingConfirmation = result?.pendingConfirmation === true;
      console.log(`[MainAgentController] 📊 Timeline save check - messageId: ${messageId}, chatId: ${chatId}, hasResult: ${!!result}, timelineEvents: ${result?.timelineEvents?.length || 0}, pendingConfirmation: ${hasPendingConfirmation}`);
      
      if (!hasPendingConfirmation && messageId && chatId && result && result.timelineEvents && result.timelineEvents.length > 0) {
        try {
          console.log(`[MainAgentController] 📊 Saving ${result.timelineEvents.length} timeline events for message ${messageId}`);
          await chatData.saveTimelineEvents(messageId, chatId, userId, result.timelineEvents);
          console.log(`[MainAgentController] ✅ Timeline events saved successfully`);
        } catch (timelineError) {
          console.error('[MainAgentController] ⚠️ Error saving timeline events:', timelineError.message);
          // Don't fail the request if timeline storage fails
        }
      } else if (hasPendingConfirmation) {
        console.log(`[MainAgentController] ⏳ Timeline events NOT saved - pending confirmation, will save after all confirmations complete`);
      } else {
        console.log(`[MainAgentController] ⚠️ Timeline events NOT saved - missing: messageId=${!!messageId}, chatId=${!!chatId}, result=${!!result}, events=${result?.timelineEvents?.length || 0}`);
      }

      // Auto-store to memory if enabled or if auto-store conditions are met
      if (addToMemory || shouldAutoStoreMemory(query, completeResponse, agentsUsed)) {
        try {
          console.log(`[MainAgentController] 🧠 Auto-storing exchange to long-term memory...`);
          
          // Determine source app based on agents used
          let sourceApp = SOURCE_APPS.CHAT;
          if (agentsUsed.length === 1) {
            const agentToSource = {
              'gmail': SOURCE_APPS.GMAIL,
              'github': SOURCE_APPS.GITHUB,
              'calendar': SOURCE_APPS.CALENDAR,
              'docs': SOURCE_APPS.DOCS,
              'sheets': SOURCE_APPS.SHEETS,
              'forms': SOURCE_APPS.FORMS,
              'meet': SOURCE_APPS.MEET,
              'flights': SOURCE_APPS.FLIGHTS
            };
            sourceApp = agentToSource[agentsUsed[0]] || SOURCE_APPS.CHAT;
          } else if (agentsUsed.length > 1) {
            sourceApp = SOURCE_APPS.MULTI_AGENT;
          }
          
          const memoryResult = await addMemory({
            userId,
            userMessage: query,
            assistantMessage: completeResponse,
            sourceApp,
            metadata: {
              conversationId,
              agentsUsed,
              autoStored: !addToMemory // Mark if auto-stored vs user-requested
            }
          });
          
          if (memoryResult.success) {
            console.log(`[MainAgentController] ✅ Memory stored: ${memoryResult.memoryId} (${memoryResult.memoryType})`);
            // Send memory stored event to client
            res.write(`data: ${JSON.stringify({ 
              type: 'memory_stored', 
              memoryId: memoryResult.memoryId,
              memoryType: memoryResult.memoryType
            })}\n\n`);
          }
        } catch (memoryError) {
          console.error('[MainAgentController] ⚠️ Error storing memory:', memoryError.message);
          // Don't fail the request if memory storage fails
        }
      }

      // Check if file generation was requested and generate PDF/TXT if needed
      try {
        const { fileType, isExplicit } = detectFileGenerationRequest(query);
        
        if (isExplicit && fileType && completeResponse.length > 0) {
          console.log(`[MainAgentController] 📄 Generating ${fileType.toUpperCase()} for file generation request`);
          
          // ✅ FIX: Check if user is referencing previous web search results
          // If conversationId exists, try to get the latest web search artifact
          let contentToGenerate = completeResponse;
          let titlePrefix = 'response';
          
          if (conversationId) {
            try {
              console.log(`[MainAgentController] 🔍 Checking for web search artifacts in conversation: ${conversationId}`);
              const { getLastArtifactByType } = require('../utils/artifactMemory');
              const webSearchArtifact = await getLastArtifactByType(conversationId, 'web_search');
              
              if (webSearchArtifact && webSearchArtifact.data && webSearchArtifact.data.synthesizedContent) {
                console.log(`[MainAgentController] ✅ Found web search artifact: ${webSearchArtifact.title}`);
                console.log(`[MainAgentController] 📊 Using synthesized content (${webSearchArtifact.data.synthesizedContent.length} chars) with ${webSearchArtifact.data.sources?.length || 0} sources`);
                
                // Build comprehensive content with sources
                let fullContent = `# ${webSearchArtifact.data.query}\n\n`;
                fullContent += webSearchArtifact.data.synthesizedContent;
                
                // Add sources section if available
                if (webSearchArtifact.data.sources && webSearchArtifact.data.sources.length > 0) {
                  fullContent += '\n\n---\n\n## Sources\n\n';
                  webSearchArtifact.data.sources.forEach((source, index) => {
                    fullContent += `${index + 1}. **${source.title}**\n`;
                    fullContent += `   ${source.url}\n`;
                    if (source.snippet) {
                      fullContent += `   ${source.snippet}\n`;
                    }
                    fullContent += '\n';
                  });
                }
                
                contentToGenerate = fullContent;
                titlePrefix = webSearchArtifact.data.query.substring(0, 50).replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
              } else {
                console.log(`[MainAgentController] ℹ️ No web search artifact found, using AI response`);
              }
            } catch (artifactError) {
              console.error(`[MainAgentController] ⚠️ Error retrieving web search artifact:`, artifactError.message);
              // Continue with completeResponse if artifact retrieval fails
            }
          }
          
          // Generate appropriate file title from query or use default
          const titleMatch = query.match(/["']([^"']+)["']/) || query.match(/(?:titled?\s+|named?\s+)([^\s,\.!?]+)/i);
          const fileTitle = titleMatch ? titleMatch[1] : `${titlePrefix}-${Date.now()}`;
          
          try {
            // Generate and upload file based on type
            const fileResult = await fileGenerationService.generateAndUploadFile({
              type: fileType,
              content: contentToGenerate,
              title: fileTitle,
              userId
            });

            if (fileResult && fileResult.success && fileResult.fileUrl) {
              console.log(`[MainAgentController] ✅ ${fileType.toUpperCase()} generated successfully: ${fileResult.filename}`);
              
              // Send file generation result to client
              res.write(`data: ${JSON.stringify({
                type: 'file_generated',
                fileType: fileType,
                filename: fileResult.filename,
                fileUrl: fileResult.fileUrl,
                fileSize: fileResult.fileSize,
                expiresIn: fileResult.expiresIn,
                message: `${fileType.toUpperCase()} file generated and ready for download`
              })}\n\n`);
            } else {
              console.error(`[MainAgentController] ⚠️ File generation failed:`, fileResult?.message || 'Unknown error');
            }
          } catch (fileGenError) {
            console.error(`[MainAgentController] ⚠️ Error generating file:`, fileGenError.message);
            // Don't fail the request if file generation fails - respond content was still provided
            res.write(`data: ${JSON.stringify({
              type: 'file_generation_error',
              message: `Failed to generate ${fileType.toUpperCase()}: ${fileGenError.message}`
            })}\n\n`);
          }
        }
      } catch (fileGenCheckError) {
        console.error('[MainAgentController] ⚠️ Error checking file generation request:', fileGenCheckError.message);
        // Don't fail the request if file generation check fails
      }

      // ✅ Deduct credits after successful execution
      // If we got here without throwing an error and agents were used, deduct credits
      if (agentsUsed.length > 0) {
        console.log(`[MainAgentController] 💳 Deducting credits for agents: ${agentsUsed.join(', ')}`);
        
        const deductionResult = await deductCreditsForAgents(
          agentsUsed,
          userId,
          {
            query: query,
            conversationId: conversationId || chatId || null,
            messageId: messageId || null,
            toolsUsed: result?.toolsUsed || [],
            timestamp: new Date().toISOString()
          }
        );
        
        // Send deduction info to client
        const deductionInfo = getCreditDeductionInfoForStream(deductionResult);
        res.write(`data: ${JSON.stringify(deductionInfo)}\n\n`);
        
        if (deductionResult.success) {
          console.log(`[MainAgentController] ✅ Credits deducted: ${deductionResult.totalDeducted}. New balance: ${deductionResult.newBalance}`);
        } else {
          console.error(`[MainAgentController] ⚠️ Credit deduction failed: ${deductionResult.error}`);
        }
      } else {
        console.log('[MainAgentController] ℹ️ No agents used - no credits deducted');
      }

      // Stop AI thinking indicator via Socket.io
      if (conversationId || chatId) {
        emitAIThinking(conversationId || chatId, false);
      }

      // Send completion signal
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();

    } catch (error) {
      console.error('[MainAgentController] Streaming error:', error);

      // Stop AI thinking indicator on error via Socket.io
      if (conversationId || chatId) {
        emitAIThinking(conversationId || chatId, false);
      }

      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        error: error.message || 'Failed to process query' 
      })}\n\n`);
      res.end();
    }

  } catch (error) {
    console.error('[MainAgentController] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process query',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /agent/query
 * Process natural language queries that may involve multiple services
 * (Non-streaming version for backward compatibility)
 * 
 * Request body:
 * {
 *   "query": "schedule a meeting tomorrow and create a document for it",
 *   "conversationHistory": [] // optional
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "query": "schedule a meeting...",
 *   "response": "I've scheduled a meeting...",
 *   "agentsUsed": ["calendar", "docs"],
 *   "toolsUsed": [...],
 *   "analysis": {
 *     "reasoning": "...",
 *     "sequential": true
 *   },
 *   "processingTime": "1234ms",
 *   "timestamp": "2025-01-01T00:00:00.000Z"
 * }
 */
router.post('/query', authenticateToken, checkCredits, async (req, res) => {
  try {
    const { query, conversationHistory, chatId } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Query is required and must be a non-empty string',
        examples: [
          "Schedule a meeting tomorrow at 2pm",
          "Create a document and share it with my team",
          "Show me my GitHub repositories and recent calendar events",
          "Create a feedback form and a spreadsheet to track responses"
        ]
      });
    }

    console.log(`[MainAgentController] User ${userId} query: "${query}"`);
    if (chatId) {
      console.log(`[MainAgentController] Chat ID (Session ID): ${chatId}`);
    }

    // Retrieve full chat history from database if chatId is provided
    let fullChatHistory = conversationHistory || [];
    if (chatId) {
      try {
        console.log(`[MainAgentController] 💬 Retrieving full chat history from database for chatId: ${chatId}`);
        const chatSession = await chatData.getChatSession(chatId, userId);
        if (chatSession && chatSession.messages) {
          fullChatHistory = chatSession.messages;
          console.log(`[MainAgentController] ✅ Retrieved ${fullChatHistory.length} messages from database`);
        } else {
          console.log(`[MainAgentController] ⚠️ No chat session found in database, using provided history`);
        }
      } catch (dbError) {
        console.error(`[MainAgentController] ⚠️ Error retrieving chat history from database:`, dbError.message);
        console.log(`[MainAgentController] ⚠️ Falling back to provided conversationHistory`);
        // Continue with provided conversationHistory if database retrieval fails
      }
    }

    // Process the query through the main agent
    const result = await mainAgent.processQuery(query, userId, { conversationHistory: fullChatHistory });

    // ✅ Deduct credits after success (if agents were used)
    if (result && result.agentsUsed && result.agentsUsed.length > 0) {
      const deductionResult = await deductCreditsForAgents(
        result.agentsUsed,
        userId,
        {
          query: query,
          chatId: chatId || null,
          toolsUsed: result.toolsUsed || [],
          timestamp: new Date().toISOString()
        }
      );
      
      // Attach credit info to response
      result.creditInfo = {
        charged: deductionResult.success,
        amountCharged: deductionResult.totalDeducted || 0,
        newBalance: deductionResult.newBalance || null,
        transactions: deductionResult.transactions || []
      };
      
      if (deductionResult.success) {
        console.log(`[MainAgentController] ✅ Credits deducted: ${deductionResult.totalDeducted}`);
      }
    }

    // Return the result
    res.json(result);

  } catch (error) {
    console.error('[MainAgentController] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process query',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /agent/confirm-action
 * Confirm and execute a pending action that requires user approval
 * 
 * Request body:
 * {
 *   "requestId": "uuid-of-pending-action",
 *   "messageId": "optional-message-id-for-timeline-storage",
 *   "chatId": "optional-chat-id-for-timeline-storage"
 * }
 * 
 * Response: Server-Sent Events (SSE) stream with execution result
 */
router.post('/confirm-action', authenticateToken, async (req, res) => {
  try {
    const { requestId, messageId, chatId } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!requestId || typeof requestId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'requestId is required and must be a string'
      });
    }

    console.log(`[MainAgentController] User ${userId} confirming action: ${requestId}, messageId: ${messageId}, chatId: ${chatId}`);

    // Verify the pending action exists and belongs to this user
    const pendingAction = confirmationStore.getPendingAction(requestId, userId);
    if (!pendingAction) {
      return res.status(404).json({
        success: false,
        error: 'Action not found, expired, or unauthorized',
        message: 'The action you are trying to confirm is no longer available. It may have expired or been canceled.'
      });
    }
    
    // Debug: Log pending action timeline events
    console.log(`[MainAgentController] 🔍 PendingAction timelineEvents: ${pendingAction.timelineEvents?.length || 0} events`);
    if (pendingAction.chainId) {
      console.log(`[MainAgentController] 🔗 Chain: ${pendingAction.chainId}, step ${(pendingAction.chainIndex || 0) + 1}/${pendingAction.totalInChain || '?'}`);
    }

    // Set up SSE headers for streaming response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Create timeline emitter for confirmation flow
    const onChunk = (chunk) => {
      // Emit task completion/failure notifications via Socket.io (toasts) for confirmation flows too
      if (chunk.type === 'timeline_task_completed' || chunk.type === 'timeline_task_failed') {
        try {
          const status = chunk.status || (chunk.type === 'timeline_task_failed' ? 'failed' : 'completed');
          const isNeedsInput = status === 'needs_input';
          const notifType =
            chunk.type === 'timeline_task_failed' ? 'error' : isNeedsInput ? 'warning' : 'success';

          sendSocketNotification(userId, {
            type: notifType,
            title: chunk.type === 'timeline_task_failed'
              ? 'Action failed'
              : isNeedsInput
              ? 'Needs your input'
              : 'Action completed',
            message: chunk.message || chunk.summary || (chunk.type === 'timeline_task_failed' ? 'Action failed' : 'Action completed'),
            data: {
              chatId: pendingAction.conversationId || null,
              conversationId: pendingAction.conversationId || null,
              requestId,
              status,
              dedupeKey: `agent:confirm:${chunk.type}:${userId}:${pendingAction.conversationId || 'none'}:${requestId}:${chunk.eventId || ''}`,
            },
          });
        } catch (e) {
          console.warn('[MainAgentController] ⚠️ Failed to emit socket notification (confirm flow):', e.message);
        }
      }

      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    };
    const timeline = new TimelineEmitter(onChunk, userId, pendingAction.conversationId);

    // Send thinking indicator
    res.write(`data: ${JSON.stringify({ type: 'thinking', status: 'start' })}\n\n`);

    // Emit AI thinking via Socket.io for confirmation flow
    if (chatId) {
      emitAIThinking(chatId, true);
    }
    
    // Emit confirmation received timeline event
    timeline.emitConfirmationReceived(pendingAction.toolName, pendingAction.agentName, true);
    timeline.emitNarrative('Executing confirmed action...');

    try {
      // Execute the confirmed action with timeline
      const executionResult = await mainAgent.executeConfirmedAction(requestId, userId, timeline);

      if (!executionResult.success) {
        timeline.emitTaskFailed(executionResult.error || 'Failed to execute action');
        res.write(`data: ${JSON.stringify({ 
          type: 'error', 
          error: executionResult.error || 'Failed to execute action'
        })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        res.end();
        return;
      }

      // Stream the response after successful execution
      await mainAgent.streamConfirmedActionResponse(executionResult, onChunk, timeline);

      // Check if there's a next action in the chain that needs confirmation
      if (executionResult.nextConfirmation) {
        console.log(`[MainAgentController] Sending next confirmation in chain: ${executionResult.nextConfirmation.toolName}`);
        
        // Emit step completed event to mark the current generating_response as done
        // This prevents the "Generating response..." from staying stuck
        timeline.emitNarrative(`Step completed. Proceeding to ${executionResult.nextConfirmation.toolName}...`);
        
        // Emit waiting for next confirmation
        timeline.emitConfirmationRequired(
          executionResult.nextConfirmation.toolName,
          executionResult.nextConfirmation.agentName,
          executionResult.nextConfirmation.previewContent
        );
        
        // Send the next confirmation request
        res.write(`data: ${JSON.stringify({ 
          type: 'confirmation_request',
          ...executionResult.nextConfirmation
        })}\n\n`);
      } else {
        // Emit task completed - this is the final step
        timeline.emitTaskCompleted('All tasks completed successfully');
        
        // ✅ Deduct credits after successful confirmation
        if (executionResult.agentsUsed && executionResult.agentsUsed.length > 0) {
          console.log(`[MainAgentController] 💳 Deducting credits for confirmed action. Agents: ${executionResult.agentsUsed.join(', ')}`);
          
          const deductionResult = await deductCreditsForAgents(
            executionResult.agentsUsed,
            userId,
            {
              query: pendingAction.query || 'Confirmed action',
              conversationId: pendingAction.conversationId || chatId || null,
              messageId: messageId || null,
              requestId: requestId,
              toolsUsed: executionResult.toolsUsed || [],
              timestamp: new Date().toISOString()
            }
          );
          
          // Send deduction info to client
          const deductionInfo = getCreditDeductionInfoForStream(deductionResult);
          res.write(`data: ${JSON.stringify(deductionInfo)}\n\n`);
          
          if (deductionResult.success) {
            console.log(`[MainAgentController] ✅ Credits deducted: ${deductionResult.totalDeducted}. New balance: ${deductionResult.newBalance}`);
          } else {
            console.error(`[MainAgentController] ⚠️ Credit deduction failed: ${deductionResult.error}`);
          }
        }
        
        // Save timeline events now that the chain is complete
        // MERGE initial timeline events from the query with confirmation flow events
        if (messageId && chatId) {
          try {
            const confirmationEvents = timeline.getEvents();
            // Merge: initial query events + confirmation flow events
            const initialEvents = pendingAction.timelineEvents || [];
            const allTimelineEvents = [...initialEvents, ...confirmationEvents];
            
            console.log(`[MainAgentController] 📊 Confirmation chain complete - Merging ${initialEvents.length} initial + ${confirmationEvents.length} confirmation = ${allTimelineEvents.length} total events for message ${messageId}`);
            await chatData.saveTimelineEvents(messageId, chatId, userId, allTimelineEvents);
            console.log(`[MainAgentController] ✅ Timeline events saved successfully after confirmation chain`);
          } catch (timelineError) {
            console.error('[MainAgentController] ⚠️ Error saving timeline events after confirmation:', timelineError.message);
            // Don't fail the request if timeline storage fails
          }
        } else {
          console.log(`[MainAgentController] ⚠️ Timeline events NOT saved after confirmation - missing messageId or chatId`);
        }
      }

      // Stop AI thinking via Socket.io after confirmation completes
      if (chatId) {
        emitAIThinking(chatId, false);
      }

      // Send completion signal
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();

    } catch (error) {
      console.error('[MainAgentController] Confirm action error:', error);

      // Stop AI thinking on error via Socket.io
      if (chatId) {
        emitAIThinking(chatId, false);
      }

      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        error: error.message || 'Failed to execute confirmed action'
      })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();
    }

  } catch (error) {
    console.error('[MainAgentController] Confirm action setup error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process confirmation',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /agent/cancel-action
 * Cancel a pending action that requires user approval
 * 
 * Request body:
 * {
 *   "requestId": "uuid-of-pending-action"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Action canceled...",
 *   "canceledAction": {...}
 * }
 */
router.post('/cancel-action', authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!requestId || typeof requestId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'requestId is required and must be a string'
      });
    }

    console.log(`[MainAgentController] User ${userId} canceling action: ${requestId}`);

    // Cancel the pending action
    const result = mainAgent.cancelPendingAction(requestId, userId);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: result.error || 'Action not found',
        message: 'The action you are trying to cancel is no longer available.'
      });
    }

    res.json({
      success: true,
      message: result.message,
      canceledAction: result.canceledAction,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[MainAgentController] Cancel action error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel action',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /agent/pending-actions
 * Get all pending actions for the current user
 * 
 * Response:
 * {
 *   "success": true,
 *   "pendingActions": [...]
 * }
 */
router.get('/pending-actions', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const pendingActions = confirmationStore.getUserPendingActions(userId);

    res.json({
      success: true,
      pendingActions: pendingActions.map(action => ({
        requestId: action.requestId,
        toolName: action.toolName,
        agentName: action.agentName,
        previewContent: action.previewContent,
        createdAt: action.createdAt,
        expiresAt: action.expiresAt
      })),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[MainAgentController] Get pending actions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve pending actions',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /agent/info
 * Get information about the main agent and all available specialized agents
 */
router.get('/info', (req, res) => {
  try {
    const agentInfo = mainAgent.getAgentInfo();
    
    res.json({
      success: true,
      ...agentInfo,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[MainAgentController] Error getting agent info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve agent information',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /agent/examples
 * Get example queries demonstrating single and multi-agent capabilities
 */
router.get('/examples', (req, res) => {
  res.json({
    success: true,
    examples: {
      singleAgent: {
        calendar: [
          "Schedule a team meeting tomorrow at 2pm",
          "Show me my events for this week",
          "Cancel my 3pm meeting today"
        ],
        docs: [
          "Create a new document called 'Project Plan'",
          "Add a heading 'Introduction' to my document",
          "Share my document with john@example.com"
        ],
        forms: [
          "Create a customer feedback form",
          "Add a multiple choice question to my form",
          "Show me the responses to my survey"
        ],
        github: [
          "Show me my GitHub profile",
          "List my repositories",
          "Show recent commits in my main project"
        ],
        meet: [
          "Create a new meeting space",
          "Show me my recent meetings",
          "Get details about my last meeting"
        ],
        sheets: [
          "Create a new spreadsheet called 'Budget 2025'",
          "Add data to cells A1 to C3",
          "Format the header row as bold"
        ]
      },
      multiAgent: [
        {
          query: "Schedule a meeting tomorrow and create a document for the agenda",
          agents: ["calendar", "docs"],
          description: "Creates both a calendar event and a document"
        },
        {
          query: "Create a feedback form and a spreadsheet to track responses",
          agents: ["forms", "sheets"],
          description: "Sets up a form and a tracking spreadsheet"
        },
        {
          query: "Show me my GitHub activity and upcoming calendar events",
          agents: ["github", "calendar"],
          description: "Retrieves information from multiple sources"
        },
        {
          query: "Create a meeting, document the agenda, and share both",
          agents: ["meet", "docs"],
          description: "Multi-step workflow across services"
        },
        {
          query: "Set up a project: create a GitHub repo, schedule kickoff meeting, and make a project doc",
          agents: ["github", "calendar", "docs"],
          description: "Complex multi-agent project setup"
        }
      ],
      tips: [
        "You can ask for multiple things in one query",
        "The agent will automatically determine which services to use",
        "Be specific about dates, times, and other details",
        "You can reference previous items in your query",
        "The agent handles both simple and complex multi-step requests"
      ]
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /agent/health
 * Health check for the main agent system
 */
router.get('/health', (req, res) => {
  try {
    const agentInfo = mainAgent.getAgentInfo();
    const agentCount = Object.keys(agentInfo.specializedAgents).length;

    res.json({
      success: true,
      status: 'healthy',
      mainAgent: 'operational',
      specializedAgents: {
        count: agentCount,
        available: Object.keys(agentInfo.specializedAgents)
      },
      capabilities: [
        'Single agent queries',
        'Multi agent coordination',
        'Parallel execution',
        'Sequential execution',
        'Response aggregation'
      ],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[MainAgentController] Health check error:', error);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /agent/test
 * Test endpoint for development - allows testing without authentication
 * This should be disabled in production
 */
if (process.env.NODE_ENV === 'development') {
  router.post('/test', async (req, res) => {
    try {
      const { query, userId, conversationHistory } = req.body;

      if (!query || !userId) {
        return res.status(400).json({
          success: false,
          error: 'Query and userId are required for testing',
          example: {
            query: "show me my calendar events",
            userId: "test-user-id"
          }
        });
      }

      console.log(`[MainAgentController TEST] User ${userId} query: "${query}"`);

      const result = await mainAgent.processQuery(query, userId, { conversationHistory });

      res.json({
        ...result,
        testMode: true,
        warning: 'This endpoint is only available in development mode'
      });

    } catch (error) {
      console.error('[MainAgentController TEST] Error:', error);
      res.status(500).json({
        success: false,
        error: 'Test query failed',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
}

// ========== ARTIFACT MEMORY ENDPOINTS ==========

/**
 * GET /agent/artifacts/:conversationId
 * Get all artifacts for a conversation
 * 
 * Response:
 * {
 *   "success": true,
 *   "conversationId": "uuid",
 *   "artifacts": [{ id, type, title, createdAt, createdAtFormatted }, ...]
 * }
 */
router.get('/artifacts/:conversationId', authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        error: 'conversationId is required'
      });
    }

    const artifacts = await listArtifacts(conversationId);

    res.json({
      success: true,
      conversationId,
      artifacts,
      count: artifacts.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[MainAgentController] Get artifacts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve artifacts',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /agent/artifacts/:conversationId/full
 * Get all artifacts with full data for a conversation
 * 
 * Response:
 * {
 *   "success": true,
 *   "conversationId": "uuid",
 *   "artifacts": [{ id, type, title, data, createdAt }, ...]
 * }
 */
router.get('/artifacts/:conversationId/full', authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        error: 'conversationId is required'
      });
    }

    const artifacts = await getArtifacts(conversationId);

    res.json({
      success: true,
      conversationId,
      artifacts,
      count: artifacts.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[MainAgentController] Get full artifacts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve artifacts',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * DELETE /agent/artifacts/:conversationId
 * Clear all artifacts for a conversation
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Artifacts cleared"
 * }
 */
router.delete('/artifacts/:conversationId', authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        error: 'conversationId is required'
      });
    }

    await clearArtifacts(conversationId);

    res.json({
      success: true,
      message: 'Artifacts cleared successfully',
      conversationId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[MainAgentController] Clear artifacts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear artifacts',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
