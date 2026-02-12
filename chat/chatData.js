// Chat History Data Layer - Supabase operations
const supabase = require('../supabase/supabaseConnect');
const supabaseAdmin = require('../supabase/supabaseAdmin');

/**
 * Get all chat sessions for a user
 */
async function getAllChatSessions(userId) {
  try {
    // Fetch chat sessions ordered by updated_at
    const { data: sessions, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      throw error;
    }

    if (!sessions || sessions.length === 0) {
      return [];
    }

    // Fetch messages for each session (limit to last 20 for performance)
    const sessionsWithMessages = await Promise.all(
      sessions.map(async (session) => {
        const { data: messages, error: msgError } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('chat_session_id', session.id)
          .order('sequence_order', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(20);

        if (msgError) {
          console.error('Error fetching messages:', msgError);
          return {
            id: session.id,
            title: session.title,
            createdAt: session.created_at,
            updatedAt: session.updated_at,
            messages: [],
            messageCount: session.message_count || 0,
          };
        }

        // Reverse messages so they're in ascending order (oldest first) for display
        const orderedMessages = (messages || []).reverse();
        
        return {
          id: session.id,
          title: session.title,
          createdAt: session.created_at,
          updatedAt: session.updated_at,
          messages: orderedMessages.map((msg) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            timestamp: msg.created_at,
            agentsUsed: msg.agents_used || [],
            processingTime: msg.processing_time,
            sequenceOrder: msg.sequence_order,
            isError: msg.is_error || false,
            isPendingConfirmation: msg.is_pending_confirmation || false,
            isConfirmed: msg.is_confirmed || false,
            isCanceled: msg.is_canceled || false,
            confirmationData: msg.confirmation_data || undefined,
          })),
          messageCount: session.message_count || 0,
        };
      })
    );

    return sessionsWithMessages;
  } catch (error) {
    console.error('Error in getAllChatSessions:', error);
    throw error;
  }
}

/**
 * Get a specific chat session by ID
 */
async function getChatSession(chatId, userId) {
  try {
    // Fetch the chat session
    const { data: session, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', chatId)
      .eq('user_id', userId)
      .single();

    if (sessionError || !session) {
      throw sessionError || new Error('Chat session not found');
    }

    // Fetch messages for this session (limit to last 20 for performance, rely on realtime for new ones)
    const { data: messages, error: msgError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('chat_session_id', chatId)
      .order('sequence_order', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(20);

    if (msgError) {
      throw msgError;
    }

    // Reverse messages so they're in ascending order (oldest first) for display
    const orderedMessages = (messages || []).reverse();

    // Fetch attached files for all messages in this chat session
    let filesByMessageId = {};
    try {
      const messageIds = orderedMessages.map(m => m.id);
      if (messageIds.length > 0) {
        // Use supabaseAdmin to bypass RLS (backend uses custom JWT auth, not Supabase Auth)
        const { data: chatFiles, error: filesError } = await supabaseAdmin
          .from('files')
          .select('id, message_id, original_filename, filename, mime_type, size, public_url, file_type, storage_path, storage_bucket')
          .eq('chat_id', chatId)
          .eq('status', 'ready')
          .in('message_id', messageIds);

        if (!filesError && chatFiles && chatFiles.length > 0) {
          // Group files by message_id
          for (const file of chatFiles) {
            if (!filesByMessageId[file.message_id]) {
              filesByMessageId[file.message_id] = [];
            }
            filesByMessageId[file.message_id].push({
              id: file.id,
              filename: file.filename,
              originalFilename: file.original_filename,
              mimeType: file.mime_type,
              size: file.size,
              url: file.public_url,
              fileType: file.file_type,
            });
          }
        }
      }
    } catch (fileErr) {
      console.error('[chatData] Error fetching files for session:', fileErr);
      // Continue without files - non-critical
    }

    return {
      id: session.id,
      title: session.title,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
      messages: orderedMessages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.created_at,
        agentsUsed: msg.agents_used || [],
        processingTime: msg.processing_time,
        sequenceOrder: msg.sequence_order,
        isError: msg.is_error || false,
        isPendingConfirmation: msg.is_pending_confirmation || false,
        isConfirmed: msg.is_confirmed || false,
        isCanceled: msg.is_canceled || false,
        confirmationData: msg.confirmation_data || undefined,
        // Include attached files: prefer files stored directly on the message row,
        // fall back to cross-table lookup from the files table
        ...(msg.files ? { files: msg.files } : (filesByMessageId[msg.id] && { files: filesByMessageId[msg.id] })),
      })),
      messageCount: session.message_count || 0,
    };
  } catch (error) {
    console.error('Error in getChatSession:', error);
    throw error;
  }
}

/**
 * Create a new chat session
 */
async function createChatSession(userId) {
  try {
    const { data: newSession, error } = await supabase
      .from('chat_sessions')
      .insert([
        {
          user_id: userId,
          title: 'New Chat',
          message_count: 0,
        },
      ])
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      id: newSession.id,
      title: newSession.title,
      createdAt: newSession.created_at,
      updatedAt: newSession.updated_at,
      messages: [],
      messageCount: 0,
    };
  } catch (error) {
    console.error('Error in createChatSession:', error);
    throw error;
  }
}

/**
 * Add messages to a chat session
 */
async function addMessagesToSession(chatId, userId, messages) {
  try {
    // Verify the chat session belongs to the user
    const { data: session, error: verifyError } = await supabase
      .from('chat_sessions')
      .select('id, title')
      .eq('id', chatId)
      .eq('user_id', userId)
      .single();

    if (verifyError || !session) {
      throw new Error('Chat session not found or access denied');
    }

    // Get existing messages
    const { data: existingMessages, error: fetchError } = await supabase
      .from('chat_messages')
      .select('id')
      .eq('chat_session_id', chatId);

    if (fetchError) {
      throw fetchError;
    }

    const existingMessageIds = new Set(existingMessages?.map((m) => m.id) || []);

    // Separate messages into new (to insert) and existing (to update)
    const newMessages = messages
      .filter((msg) => !existingMessageIds.has(msg.id))
      .filter((msg) => msg.content && msg.content.trim() !== '');
    
    const existingMessagesToUpdate = messages
      .filter((msg) => existingMessageIds.has(msg.id))
      .filter((msg) => msg.content && msg.content.trim() !== '');

    // Insert new messages
    if (newMessages.length > 0) {
      // Get the current max sequence_order for this chat session
      const { data: maxSeqData } = await supabase
        .from('chat_messages')
        .select('sequence_order')
        .eq('chat_session_id', chatId)
        .order('sequence_order', { ascending: false })
        .limit(1);
      
      let currentSeq = maxSeqData && maxSeqData.length > 0 ? (maxSeqData[0].sequence_order || 0) : 0;
      
      const { error: insertError } = await supabase
        .from('chat_messages')
        .upsert(
          newMessages.map((msg, index) => ({
            id: msg.id,
            chat_session_id: chatId,
            role: msg.role,
            content: msg.content,
            agents_used: msg.agentsUsed || [],
            processing_time: msg.processingTime,
            is_error: msg.isError || false,
            is_pending_confirmation: msg.isPendingConfirmation || false,
            is_confirmed: msg.isConfirmed || false,
            is_canceled: msg.isCanceled || false,
            confirmation_data: msg.confirmationData || null,
            files: msg.files || null,
            created_at: msg.timestamp,
            sequence_order: currentSeq + index + 1,
          })),
          { onConflict: 'id', ignoreDuplicates: false }
        );

      if (insertError) {
        throw insertError;
      }

      // Update message_count for realtime session updates
      await supabase
        .from('chat_sessions')
        .update({ 
          message_count: (existingMessages?.length || 0) + newMessages.length,
          updated_at: new Date().toISOString()
        })
        .eq('id', chatId);
    }

    // Update existing messages (important for confirmation state changes)
    if (existingMessagesToUpdate.length > 0) {
      for (const msg of existingMessagesToUpdate) {
        const { error: updateError } = await supabase
          .from('chat_messages')
          .update({
            content: msg.content,
            agents_used: msg.agentsUsed || [],
            processing_time: msg.processingTime,
            is_error: msg.isError || false,
            is_pending_confirmation: msg.isPendingConfirmation || false,
            is_confirmed: msg.isConfirmed || false,
            is_canceled: msg.isCanceled || false,
            confirmation_data: msg.confirmationData || null,
            ...(msg.files && { files: msg.files }),
          })
          .eq('id', msg.id)
          .eq('chat_session_id', chatId);

        if (updateError) {
          console.error('Error updating message:', msg.id, updateError);
          // Continue updating other messages even if one fails
        }
      }
    }

    // Update chat session title if it's still "New Chat"
    if (session.title === 'New Chat' && messages.length > 0) {
      const firstUserMessage = messages.find((m) => m.role === 'user');
      if (firstUserMessage) {
        const title = firstUserMessage.content.trim();
        const maxLength = 50;
        const newTitle = title.length <= maxLength ? title : title.substring(0, maxLength) + '...';
        
        await supabase
          .from('chat_sessions')
          .update({ title: newTitle })
          .eq('id', chatId);
      }
    }

    // Return updated session
    return await getChatSession(chatId, userId);
  } catch (error) {
    console.error('Error in addMessagesToSession:', error);
    throw error;
  }
}

/**
 * Delete a chat session
 */
async function deleteChatSession(chatId, userId) {
  try {
    const { error } = await supabase
      .from('chat_sessions')
      .delete()
      .eq('id', chatId)
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteChatSession:', error);
    throw error;
  }
}

/**
 * Rename a chat session
 */
async function renameChatSession(chatId, userId, newTitle) {
  try {
    const { error } = await supabase
      .from('chat_sessions')
      .update({ title: newTitle.trim() || 'Untitled Chat' })
      .eq('id', chatId)
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Error in renameChatSession:', error);
    throw error;
  }
}

/**
 * Clear all chat sessions for a user
 */
async function clearAllChatSessions(userId) {
  try {
    const { error } = await supabase
      .from('chat_sessions')
      .delete()
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Error in clearAllChatSessions:', error);
    throw error;
  }
}

/**
 * Save timeline events for a message (stores all events as single JSON row)
 * @param {string} messageId - The message ID
 * @param {string} chatSessionId - The chat session ID
 * @param {string} userId - The user ID
 * @param {Array} events - Array of timeline events
 */
async function saveTimelineEvents(messageId, chatSessionId, userId, events) {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000; // 1 second
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[chatData] saveTimelineEvents called (attempt ${attempt}) - messageId: ${messageId}, chatSessionId: ${chatSessionId}, userId: ${userId}, events: ${events?.length || 0}`);
      
      if (!events || events.length === 0) {
        console.log(`[chatData] No events to save, returning`);
        return true;
      }

    // Format events for storage (keep all event data)
    const formattedEvents = events.map((event, index) => ({
      type: event.type,
      eventId: event.eventId || null,
      agentName: event.agentName || null,
      agentDisplayName: event.agentDisplayName || null,
      agentIcon: event.agentIcon || null,
      toolName: event.toolName || null,
      toolDisplayName: event.toolDisplayName || null,
      status: event.status || 'completed',
      message: event.message || null,
      description: event.description || null,
      icon: event.icon || null,
      data: event.data || null,
      result: event.result || null,
      timestamp: event.timestamp || new Date().toISOString(),
      sequenceOrder: index,
    }));

    console.log(`[chatData] Saving ${formattedEvents.length} timeline events as single row`);

    // Upsert: insert or update if message_id exists
    const { data, error } = await supabase
      .from('timeline_events')
      .upsert({
        message_id: messageId,
        chat_session_id: chatSessionId,
        user_id: userId,
        events: formattedEvents,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'message_id'
      });

    if (error) {
      console.error(`[chatData] Supabase upsert error:`, error);
      throw error;
    }

    console.log(`[chatData] Timeline events saved successfully as single row`);
    return true;
    } catch (error) {
      console.error(`Error in saveTimelineEvents (attempt ${attempt}/${MAX_RETRIES}):`, error.message || error);
      
      // Check if it's a retryable network error
      const isRetryable = error.message?.includes('fetch failed') || 
                          error.message?.includes('ECONNRESET') ||
                          error.message?.includes('ETIMEDOUT') ||
                          error.code === 'ECONNRESET';
      
      if (isRetryable && attempt < MAX_RETRIES) {
        console.log(`[chatData] Retrying in ${RETRY_DELAY}ms...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
        continue;
      }
      
      // On final attempt or non-retryable error, throw
      throw error;
    }
  }
}

/**
 * Get timeline events for a message
 * @param {string} messageId - The message ID
 */
async function getTimelineEventsForMessage(messageId) {
  try {
    const { data, error } = await supabase
      .from('timeline_events')
      .select('events')
      .eq('message_id', messageId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No row found - return empty array
        return [];
      }
      throw error;
    }

    return data?.events || [];
  } catch (error) {
    console.error('Error in getTimelineEventsForMessage:', error);
    return [];
  }
}

/**
 * Get timeline events for multiple messages
 * @param {Array<string>} messageIds - Array of message IDs
 */
async function getTimelineEventsForMessages(messageIds) {
  try {
    if (!messageIds || messageIds.length === 0) {
      return {};
    }

    const { data, error } = await supabase
      .from('timeline_events')
      .select('message_id, events')
      .in('message_id', messageIds);

    if (error) {
      throw error;
    }

    // Build map of message_id -> events array
    const eventsByMessage = {};
    (data || []).forEach((row) => {
      eventsByMessage[row.message_id] = row.events || [];
    });

    return eventsByMessage;
  } catch (error) {
    console.error('Error in getTimelineEventsForMessages:', error);
    return {};
  }
}

/**
 * Delete timeline events for a message
 * @param {string} messageId - The message ID
 */
async function deleteTimelineEventsForMessage(messageId) {
  try {
    const { error } = await supabase
      .from('timeline_events')
      .delete()
      .eq('message_id', messageId);

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteTimelineEventsForMessage:', error);
    throw error;
  }
}

module.exports = {
  getAllChatSessions,
  getChatSession,
  createChatSession,
  addMessagesToSession,
  deleteChatSession,
  renameChatSession,
  clearAllChatSessions,
  saveTimelineEvents,
  getTimelineEventsForMessage,
  getTimelineEventsForMessages,
  deleteTimelineEventsForMessage,
};
