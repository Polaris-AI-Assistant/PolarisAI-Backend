const MainAgent = require('../mainAgent/mainAgent');
const supabase = require('../supabase/supabaseConnect');
const { sendActionCompleted } = require('./emailService');

// Single shared MainAgent instance for all scheduled actions
const mainAgent = new MainAgent();

/**
 * Execute a scheduled action using the MainAgent (same pipeline as user chat).
 * This routes the action through the full agent system — Gmail, Calendar, Docs, etc.
 *
 * @param {object} params - Action parameters
 * @param {string} params.userId - User ID
 * @param {string} params.content - Action content/description
 * @param {string} params.scheduleId - Schedule ID
 */
async function executeAction({ userId, content, scheduleId }) {
  try {
    console.log(`[ActionService] Executing action for user ${userId}: ${content}`);

    // Get or create a chat session for scheduled actions
    const chat = await getOrCreateScheduleChat(userId);

    // Build conversation history with a system-level instruction that tells agents
    // to auto-execute without asking for clarification. This history is passed
    // through MainAgent → executeAgentQueries → agent.processQuery(query, userId, { conversationHistory })
    // so the agent-level LLM (e.g. GmailAgent) sees it and knows to just execute.
    const scheduledActionHistory = [
      {
        role: 'user',
        content: `IMPORTANT SYSTEM CONTEXT: This is an automated scheduled action being executed by the Polaris scheduler. 
You MUST execute immediately without asking the user for any follow-up details, clarification, or confirmation.
If any content is missing (e.g., email body, subject line, document content), auto-generate it using professional language.
Do NOT respond with questions. Just perform the action and report what you did.
Current time: ${new Date().toISOString()}`
      },
      {
        role: 'assistant',
        content: 'Understood. I will execute the action immediately without asking for any additional information. I will auto-generate any missing content.'
      }
    ];

    // Process through the real MainAgent — this routes to Gmail, Calendar, etc.
    const result = await mainAgent.processQuery(content, userId, {
      conversationHistory: scheduledActionHistory
    });

    // Check if the action was actually performed (tools were called)
    const toolsUsed = result.agentsUsed || result.tools_used || [];
    const wasActuallyExecuted = toolsUsed.length > 0 ||
      (result.response && !result.response.toLowerCase().includes('could you please provide'));

    const responseText = result.success
      ? (result.response || result.message || JSON.stringify(result))
      : `Action failed: ${result.message || result.error || 'Unknown error'}`;

    console.log(`[ActionService] MainAgent result (success=${result.success}, executed=${wasActuallyExecuted}):`, responseText.substring(0, 200));

    // Save result as message in the "📋 Scheduled Actions" chat session
    const { error: msgError } = await supabase
      .from('chat_messages')
      .insert({
        chat_session_id: chat.id,
        role: 'assistant',
        content: `**Scheduled Action ${wasActuallyExecuted ? 'Executed' : 'Failed'}**\n\n**Action:** ${content}\n\n**Result:** ${responseText}`,
        agents_used: result.agentsUsed || ['scheduler'],
        is_error: !wasActuallyExecuted
      });

    if (msgError) {
      console.error('[ActionService] Error saving action result message:', msgError);
    }

    // Update the chat session's updated_at
    await supabase
      .from('chat_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', chat.id);

    // Only send "action completed" email if the action was actually performed
    if (wasActuallyExecuted) {
      await sendActionCompleted(userId, content, scheduleId, chat.id);
      console.log(`[ActionService] Action executed successfully for schedule ${scheduleId}`);
    } else {
      console.warn(`[ActionService] Action was NOT actually executed for schedule ${scheduleId} — agent asked for clarification instead`);
    }

    return responseText;

  } catch (error) {
    console.error('[ActionService] Error executing action:', error);
    throw error;
  }
}

/**
 * Get or create a dedicated chat session for scheduled actions
 */
async function getOrCreateScheduleChat(userId) {
  // Try to find existing schedule chat session
  const { data: existingChat, error: fetchError } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('title', '📋 Scheduled Actions')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (existingChat && !fetchError) {
    return existingChat;
  }

  // Create new schedule chat session
  const { data: newChat, error: createError } = await supabase
    .from('chat_sessions')
    .insert({
      user_id: userId,
      title: '📋 Scheduled Actions'
    })
    .select()
    .single();

  if (createError) {
    console.error('[ActionService] Error creating schedule chat:', createError);
    throw createError;
  }

  return newChat;
}

module.exports = {
  executeAction
};
