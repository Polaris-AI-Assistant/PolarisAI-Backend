/**
 * Main Agent Controller Integration Example
 * 
 * This file shows the EXACT changes needed to integrate the credit system
 * with the existing mainAgentController.js
 * 
 * CHANGES REQUIRED:
 * 1. Add imports at the top
 * 2. Add middleware to routes
 * 3. Add credit info streaming
 * 4. Add credit deduction after success
 * 
 * Copy these code blocks into your mainAgentController.js
 */

// ============================================================
// STEP 1: ADD IMPORTS (at the top of mainAgentController.js)
// ============================================================

// EXISTING IMPORTS...
const express = require('express');
const MainAgent = require('./mainAgent');
const { authenticateToken } = require('../middleware/auth');
// ... other imports ...

// ✅ ADD THESE CREDIT SYSTEM IMPORTS
const { checkCredits } = require('../middleware/creditMiddleware');
const { 
  deductCreditsForAgents, 
  getCreditInfoForStream, 
  getCreditDeductionInfoForStream 
} = require('../credits/creditIntegration');


// ============================================================
// STEP 2: ADD MIDDLEWARE TO STREAMING ENDPOINT
// ============================================================

// BEFORE:
router.post('/query/stream', authenticateToken, async (req, res) => {
  // ... handler code ...
});

// AFTER:
router.post('/query/stream', 
  authenticateToken, 
  checkCredits,  // ✅ ADD THIS LINE
  async (req, res) => {
    // ... handler code ...
  }
);


// ============================================================
// STEP 3: ADD CREDIT INFO STREAMING (in the streaming callback)
// ============================================================

// Inside the streaming handler, find where agentsUsed is set:
// (around line 250 in original mainAgentController.js)

router.post('/query/stream', authenticateToken, checkCredits, async (req, res) => {
  try {
    const { query, conversationHistory, conversationId, chatId, messageId } = req.body;
    const userId = req.user.id;

    // ... validation and SSE setup code ...

    // Track agents and response
    let completeResponse = '';
    let agentsUsed = [];

    try {
      // Process query with streaming
      const result = await mainAgent.processQueryWithStreaming(
        query, 
        userId, 
        { conversationHistory, conversationId, chatId, fileContext }, 
        (chunk) => {
          // Accumulate content chunks
          if (chunk.type === 'content' && chunk.text) {
            completeResponse += chunk.text;
          }
          
          // ✅ ADD THIS BLOCK - Send credit info when agents are determined
          if (chunk.type === 'metadata' && chunk.agentsUsed) {
            agentsUsed = chunk.agentsUsed;
            
            // Send credit info to client immediately
            getCreditInfoForStream(agentsUsed, userId).then(creditInfo => {
              res.write(`data: ${JSON.stringify(creditInfo)}\n\n`);
            }).catch(err => {
              console.error('[MainAgentController] Error sending credit info:', err);
            });
          }
          
          // ... rest of streaming callback ...
          
          // Send chunk to client
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }
      );

      // ✅ ADD THIS BLOCK - Deduct credits after successful execution
      if (result && result.success && agentsUsed.length > 0) {
        console.log(`[MainAgentController] 💳 Deducting credits for agents: ${agentsUsed.join(', ')}`);
        
        const deductionResult = await deductCreditsForAgents(
          agentsUsed,
          userId,
          {
            query: query,
            conversationId: conversationId || chatId || null,
            messageId: messageId || null,
            toolsUsed: result.toolsUsed || [],
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
          // Note: Query still succeeded, just log for manual reconciliation
        }
      } else if (!result || !result.success) {
        console.log('[MainAgentController] ❌ Query failed - no credits will be deducted');
      } else if (agentsUsed.length === 0) {
        console.log('[MainAgentController] ℹ️ No agents used - no credits deducted');
      }

      // ... rest of the handler (timeline save, memory, etc.) ...

      // Send completion signal
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();

    } catch (error) {
      console.error('[MainAgentController] Streaming error:', error);
      // ❌ NO CREDITS DEDUCTED ON ERROR - This is automatic
      
      // Stop AI thinking indicator
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


// ============================================================
// STEP 4: ADD MIDDLEWARE TO NON-STREAMING ENDPOINT (Optional)
// ============================================================

// BEFORE:
router.post('/query', authenticateToken, async (req, res) => {
  // ... handler code ...
});

// AFTER:
router.post('/query', 
  authenticateToken,
  checkCredits,  // ✅ ADD THIS LINE
  async (req, res) => {
    try {
      const { query, conversationHistory, chatId } = req.body;
      const userId = req.user.id;

      // ... validation ...

      // Process the query
      const result = await mainAgent.processQuery(query, userId, { conversationHistory });

      // ✅ ADD THIS BLOCK - Deduct credits after success
      if (result && result.success && result.agentsUsed && result.agentsUsed.length > 0) {
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
      }

      // Return result
      res.json(result);

    } catch (error) {
      console.error('[MainAgentController] Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process query',
        message: error.message
      });
    }
  }
);


// ============================================================
// SUMMARY OF CHANGES
// ============================================================

/**
 * TOTAL CHANGES NEEDED:
 * 
 * 1. Add 3 import lines at the top
 * 2. Add 1 middleware to each endpoint (checkCredits)
 * 3. Add 1 block to send credit info (in streaming callback)
 * 4. Add 1 block to deduct credits (after success)
 * 
 * LINES ADDED: Approximately 50 lines total
 * LINES MODIFIED: 2 route definitions
 * BREAKING CHANGES: None
 * 
 * The credit system is fully backward compatible and fail-safe.
 * If anything goes wrong with credits, the agent still executes normally.
 */


// ============================================================
// TESTING CHECKLIST
// ============================================================

/**
 * After integration, test these scenarios:
 * 
 * ✅ 1. User with sufficient credits - should work normally
 * ✅ 2. User with insufficient credits - should get 402 error
 * ✅ 3. Query fails - no credits deducted
 * ✅ 4. Query succeeds - credits deducted correctly
 * ✅ 5. Multi-agent query - all agents charged
 * ✅ 6. Credit balance updates in real-time on frontend
 * ✅ 7. Transaction history records all operations
 * ✅ 8. Credit system error - agent still executes (fail-open)
 */
