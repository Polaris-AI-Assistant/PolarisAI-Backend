// Chat History Data Layer - Supabase operations
const supabase = require('../supabase/supabaseConnect');

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

    // Fetch messages for each session
    const sessionsWithMessages = await Promise.all(
      sessions.map(async (session) => {
        const { data: messages, error: msgError } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('chat_session_id', session.id)
          .order('created_at', { ascending: true });

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

        return {
          id: session.id,
          title: session.title,
          createdAt: session.created_at,
          updatedAt: session.updated_at,
          messages: (messages || []).map((msg) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            timestamp: msg.created_at,
            agentsUsed: msg.agents_used || [],
            processingTime: msg.processing_time,
            isError: msg.is_error || false,
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

    // Fetch messages for this session
    const { data: messages, error: msgError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('chat_session_id', chatId)
      .order('created_at', { ascending: true });

    if (msgError) {
      throw msgError;
    }

    return {
      id: session.id,
      title: session.title,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
      messages: (messages || []).map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.created_at,
        agentsUsed: msg.agents_used || [],
        processingTime: msg.processing_time,
        isError: msg.is_error || false,
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

    // Find new messages that need to be inserted
    const newMessages = messages.filter((msg) => !existingMessageIds.has(msg.id));

    if (newMessages.length > 0) {
      // Insert new messages with frontend-generated IDs
      const { error: insertError } = await supabase
        .from('chat_messages')
        .insert(
          newMessages.map((msg) => ({
            id: msg.id, // Use frontend-generated ID
            chat_session_id: chatId,
            role: msg.role,
            content: msg.content,
            agents_used: msg.agentsUsed || [],
            processing_time: msg.processingTime,
            is_error: msg.isError || false,
            created_at: msg.timestamp,
          }))
        );

      if (insertError) {
        throw insertError;
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

module.exports = {
  getAllChatSessions,
  getChatSession,
  createChatSession,
  addMessagesToSession,
  deleteChatSession,
  renameChatSession,
  clearAllChatSessions,
};
