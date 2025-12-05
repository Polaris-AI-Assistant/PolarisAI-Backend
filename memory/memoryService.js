/**
 * Memory Service
 * 
 * Core service for the long-term semantic memory system.
 * Handles storing and retrieving user-agent conversation memories
 * using OpenAI embeddings and Supabase pgvector for similarity search.
 * 
 * Features:
 * - Generates embeddings using OpenAI text-embedding-3-small
 * - Classifies memories using GPT-4o-mini
 * - Stores memories in Supabase with pgvector
 * - Retrieves relevant memories via semantic similarity search
 */

const OpenAI = require('openai');
const supabase = require('../supabase/supabaseConnect');
const {
    MEMORY_TYPES,
    SOURCE_APPS,
    MEMORY_CONFIG,
    MODEL_CONFIG,
    isValidMemoryType,
    isValidSourceApp,
    getMemoryTypeDisplay,
    getMemoryTypeIcon
} = require('./memoryConfig');

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

/**
 * @typedef {Object} AddMemoryParams
 * @property {string} userId - User ID (UUID)
 * @property {string} userMessage - The user's query/message
 * @property {string} assistantMessage - The assistant's response
 * @property {string} [sourceApp='chat'] - Source application
 * @property {Object} [metadata={}] - Additional metadata
 */

/**
 * @typedef {Object} RetrievedMemory
 * @property {string} id - Memory ID (UUID)
 * @property {string} content - Memory content
 * @property {string} memoryType - Type of memory
 * @property {string} sourceApp - Source application
 * @property {Object} metadata - Additional metadata
 * @property {Date} createdAt - When the memory was created
 * @property {number} similarity - Similarity score (0-1)
 */

/**
 * Generate embedding vector for text using OpenAI
 * 
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} - Embedding vector
 */
async function generateEmbedding(text) {
    try {
        console.log(`[MemoryService] 🧮 Generating embedding for text (${text.length} chars)...`);
        
        const response = await openai.embeddings.create({
            model: MODEL_CONFIG.EMBEDDING_MODEL,
            input: text,
            dimensions: MODEL_CONFIG.EMBEDDING_DIMENSIONS
        });

        const embedding = response.data[0].embedding;
        console.log(`[MemoryService] ✅ Generated ${embedding.length}-dimensional embedding`);
        
        return embedding;
    } catch (error) {
        console.error('[MemoryService] ❌ Error generating embedding:', error);
        throw new Error(`Failed to generate embedding: ${error.message}`);
    }
}

/**
 * Classify memory content into one of the four memory types using LLM
 * 
 * @param {string} content - Combined user message + assistant response
 * @returns {Promise<{memoryType: string, reason: string}>} - Classification result
 */
async function classifyMemory(content) {
    try {
        console.log(`[MemoryService] 🏷️ Classifying memory content...`);

        const classificationPrompt = `You are a memory classification system. Analyze the following conversation exchange and classify it into exactly ONE of these memory types:

1. "user_profile" - Stable user preferences, identity, personal information
   Examples: User's name, preferred language, timezone, work role, favorite tools, communication style
   
2. "behavior_pattern" - Habits, repeated behaviors, frequent workflows
   Examples: User always schedules meetings in the morning, frequently creates docs before meetings, prefers bullet points
   
3. "task_state" - Ongoing or incomplete tasks, things to remember or follow up on
   Examples: Pending tasks, scheduled events, ongoing projects, items awaiting response
   
4. "cross_app" - Information that links or derives from multiple connected applications
   Examples: "Created a form and emailed the link", "Scheduled meeting and created agenda doc", multi-service workflows

CONVERSATION EXCHANGE:
${content}

Respond with ONLY a valid JSON object in this exact format:
{"memory_type": "<type>", "reason": "<brief explanation>"}

Rules:
- Choose the SINGLE most appropriate type
- If multiple types could apply, pick the most dominant one
- Prefer "task_state" for action-oriented exchanges
- Prefer "cross_app" when multiple services are clearly involved
- Keep the reason brief (1-2 sentences)`;

        const response = await openai.chat.completions.create({
            model: MODEL_CONFIG.CLASSIFIER_MODEL,
            messages: [
                {
                    role: 'system',
                    content: 'You are a precise memory classification system. Always respond with valid JSON only, no additional text.'
                },
                {
                    role: 'user',
                    content: classificationPrompt
                }
            ],
            temperature: MODEL_CONFIG.CLASSIFIER_TEMPERATURE,
            response_format: { type: "json_object" }
        });

        const classification = JSON.parse(response.choices[0].message.content);
        
        // Validate the classification
        if (!isValidMemoryType(classification.memory_type)) {
            console.warn(`[MemoryService] ⚠️ Invalid memory type "${classification.memory_type}", defaulting to task_state`);
            classification.memory_type = MEMORY_TYPES.TASK_STATE;
        }

        console.log(`[MemoryService] ✅ Classified as: ${classification.memory_type} (${classification.reason})`);
        
        return {
            memoryType: classification.memory_type,
            reason: classification.reason
        };
    } catch (error) {
        console.error('[MemoryService] ❌ Error classifying memory:', error);
        // Default to task_state if classification fails
        return {
            memoryType: MEMORY_TYPES.TASK_STATE,
            reason: 'Classification failed, defaulting to task_state'
        };
    }
}

/**
 * Add a new memory to the long-term memory store
 * 
 * Steps:
 * 1. Combine userMessage + assistantMessage into content
 * 2. Generate embedding vector using OpenAI
 * 3. Classify memory type using LLM
 * 4. Insert into Supabase memories table
 * 
 * @param {AddMemoryParams} params - Memory parameters
 * @returns {Promise<{success: boolean, memoryId?: string, error?: string}>}
 */
async function addMemory(params) {
    const {
        userId,
        userMessage,
        assistantMessage,
        sourceApp = SOURCE_APPS.CHAT,
        metadata = {}
    } = params;

    console.log(`\n[MemoryService] 💾 Adding new memory for user ${userId}`);
    console.log(`[MemoryService]   Source: ${sourceApp}`);
    console.log(`[MemoryService]   User message length: ${userMessage?.length || 0}`);
    console.log(`[MemoryService]   Assistant message length: ${assistantMessage?.length || 0}`);

    try {
        // Validate inputs
        if (!userId) {
            throw new Error('userId is required');
        }
        if (!userMessage || !assistantMessage) {
            throw new Error('Both userMessage and assistantMessage are required');
        }

        // Validate source app
        const validSourceApp = isValidSourceApp(sourceApp) ? sourceApp : SOURCE_APPS.CHAT;

        // Combine messages into content
        const content = `User: ${userMessage.trim()}\n\nAssistant: ${assistantMessage.trim()}`;
        
        // Check minimum content length
        if (content.length < MEMORY_CONFIG.MIN_CONTENT_LENGTH) {
            console.log(`[MemoryService] ⚠️ Content too short (${content.length} chars), skipping storage`);
            return {
                success: false,
                error: 'Content too short to store as memory'
            };
        }

        // Generate embedding
        const embedding = await generateEmbedding(content);

        // Classify memory
        const classification = await classifyMemory(content);

        // Prepare metadata
        const fullMetadata = {
            ...metadata,
            classification_reason: classification.reason,
            user_message_length: userMessage.length,
            assistant_message_length: assistantMessage.length,
            stored_at: new Date().toISOString()
        };

        // Insert into Supabase
        console.log(`[MemoryService] 📝 Inserting memory into database...`);
        console.log(`[MemoryService]   User ID: ${userId}`);
        console.log(`[MemoryService]   Memory Type: ${classification.memoryType}`);
        console.log(`[MemoryService]   Source App: ${validSourceApp}`);
        console.log(`[MemoryService]   Embedding length: ${embedding?.length}`);
        
        const { data, error } = await supabase
            .from('memories')
            .insert({
                user_id: userId,
                content: content,
                memory_type: classification.memoryType,
                source_app: validSourceApp,
                embedding: embedding,
                metadata: fullMetadata
            })
            .select('id')
            .single();

        if (error) {
            console.error('[MemoryService] ❌ Database insert error:', error);
            console.error('[MemoryService]   Error details:', JSON.stringify(error, null, 2));
            throw new Error(`Database error: ${error.message}`);
        }

        console.log(`[MemoryService] ✅ Memory stored successfully (ID: ${data.id})`);
        console.log(`[MemoryService]   Type: ${getMemoryTypeIcon(classification.memoryType)} ${getMemoryTypeDisplay(classification.memoryType)}`);

        return {
            success: true,
            memoryId: data.id,
            memoryType: classification.memoryType,
            reason: classification.reason
        };

    } catch (error) {
        console.error('[MemoryService] ❌ Error adding memory:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Retrieve relevant memories for a user query using semantic similarity search
 * 
 * Steps:
 * 1. Generate embedding for the query
 * 2. Call Supabase RPC function match_memories
 * 3. Return formatted results
 * 
 * @param {Object} params - Retrieval parameters
 * @param {string} params.userId - User ID (UUID)
 * @param {string} params.query - Current user query
 * @param {number} [params.limit] - Maximum memories to retrieve (default: TOP_K)
 * @param {number} [params.threshold] - Minimum similarity threshold (default: SIMILARITY_THRESHOLD)
 * @returns {Promise<RetrievedMemory[]>} - Array of relevant memories
 */
async function getRelevantMemories(params) {
    const {
        userId,
        query,
        limit = MEMORY_CONFIG.TOP_K,
        threshold = MEMORY_CONFIG.SIMILARITY_THRESHOLD
    } = params;

    console.log(`\n[MemoryService] 🔍 Retrieving memories for user ${userId}`);
    console.log(`[MemoryService]   Query: "${query.substring(0, 100)}${query.length > 100 ? '...' : ''}"`);
    console.log(`[MemoryService]   Limit: ${limit}, Threshold: ${threshold}`);

    try {
        // Validate inputs
        if (!userId) {
            throw new Error('userId is required');
        }
        if (!query || typeof query !== 'string') {
            throw new Error('query is required and must be a string');
        }

        // Generate embedding for the query
        const queryEmbedding = await generateEmbedding(query);

        // Call the Supabase RPC function
        console.log(`[MemoryService] 🔎 Calling match_memories RPC...`);
        
        const { data, error } = await supabase.rpc('match_memories', {
            query_embedding: queryEmbedding,
            p_user_id: userId,
            match_count: limit,
            match_threshold: threshold
        });

        if (error) {
            console.error('[MemoryService] ❌ RPC error:', error);
            throw new Error(`Database error: ${error.message}`);
        }

        if (!data || data.length === 0) {
            console.log(`[MemoryService] ℹ️ No relevant memories found`);
            return [];
        }

        // Format results
        const memories = data.map(row => ({
            id: row.id,
            content: row.content,
            memoryType: row.memory_type,
            sourceApp: row.source_app,
            metadata: row.metadata || {},
            createdAt: new Date(row.created_at),
            similarity: row.similarity
        }));

        console.log(`[MemoryService] ✅ Found ${memories.length} relevant memories`);
        memories.forEach((m, i) => {
            console.log(`[MemoryService]   ${i + 1}. [${getMemoryTypeIcon(m.memoryType)}${m.memoryType}] similarity=${m.similarity.toFixed(3)}`);
        });

        return memories;

    } catch (error) {
        console.error('[MemoryService] ❌ Error retrieving memories:', error);
        // Return empty array instead of throwing to not break the main flow
        return [];
    }
}

/**
 * Format retrieved memories into a text block for injection into the system prompt
 * 
 * @param {RetrievedMemory[]} memories - Retrieved memories
 * @returns {string} - Formatted memory block for system prompt
 */
function formatMemoriesForPrompt(memories) {
    if (!memories || memories.length === 0) {
        return '';
    }

    const lines = [
        '=== LONG-TERM USER MEMORIES ===',
        'The following are relevant memories from past conversations with this user.',
        'Use them ONLY if directly relevant to the current task. Do not reference memories explicitly unless necessary.',
        ''
    ];

    let totalLength = lines.join('\n').length;
    const maxLength = MEMORY_CONFIG.MAX_MEMORY_PROMPT_LENGTH;

    for (const memory of memories) {
        const icon = getMemoryTypeIcon(memory.memoryType);
        const typeLabel = getMemoryTypeDisplay(memory.memoryType);
        const dateStr = memory.createdAt.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
        });
        
        // Format memory entry
        const entry = `[${icon} ${typeLabel}] (${dateStr}, relevance: ${(memory.similarity * 100).toFixed(0)}%)\n${memory.content}\n`;
        
        // Check if adding this memory would exceed max length
        if (totalLength + entry.length > maxLength) {
            lines.push('\n[Additional memories truncated due to length limit]');
            break;
        }
        
        lines.push(entry);
        totalLength += entry.length;
    }

    lines.push('=== END MEMORIES ===');
    lines.push('');

    return lines.join('\n');
}

/**
 * Get memory statistics for a user
 * 
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Memory statistics
 */
async function getMemoryStats(userId) {
    try {
        const { data, error } = await supabase.rpc('get_memory_stats', {
            p_user_id: userId
        });

        if (error) {
            throw new Error(`Database error: ${error.message}`);
        }

        const stats = {
            total: 0,
            byType: {}
        };

        if (data) {
            for (const row of data) {
                stats.byType[row.memory_type] = parseInt(row.count, 10);
                stats.total += parseInt(row.count, 10);
            }
        }

        return stats;
    } catch (error) {
        console.error('[MemoryService] Error getting memory stats:', error);
        return { total: 0, byType: {} };
    }
}

/**
 * Delete a specific memory
 * 
 * @param {string} memoryId - Memory ID to delete
 * @param {string} userId - User ID for authorization
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function deleteMemory(memoryId, userId) {
    try {
        const { error } = await supabase
            .from('memories')
            .delete()
            .eq('id', memoryId)
            .eq('user_id', userId);

        if (error) {
            throw new Error(`Database error: ${error.message}`);
        }

        console.log(`[MemoryService] 🗑️ Deleted memory ${memoryId}`);
        return { success: true };
    } catch (error) {
        console.error('[MemoryService] Error deleting memory:', error);
        return { success: false, error: error.message };
    }
}

/**
 * List all memories for a user (with pagination)
 * 
 * @param {string} userId - User ID
 * @param {Object} options - Options
 * @param {number} [options.limit=20] - Maximum memories to return
 * @param {number} [options.offset=0] - Offset for pagination
 * @param {string} [options.memoryType] - Filter by memory type
 * @returns {Promise<{memories: Object[], total: number}>}
 */
async function listMemories(userId, options = {}) {
    const { limit = 20, offset = 0, memoryType } = options;

    try {
        let query = supabase
            .from('memories')
            .select('id, content, memory_type, source_app, metadata, created_at', { count: 'exact' })
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (memoryType && isValidMemoryType(memoryType)) {
            query = query.eq('memory_type', memoryType);
        }

        const { data, error, count } = await query;

        if (error) {
            throw new Error(`Database error: ${error.message}`);
        }

        return {
            memories: data || [],
            total: count || 0
        };
    } catch (error) {
        console.error('[MemoryService] Error listing memories:', error);
        return { memories: [], total: 0 };
    }
}

/**
 * Cleanup old memories for a user
 * 
 * @param {string} userId - User ID
 * @param {number} [daysOld] - Delete memories older than this many days
 * @returns {Promise<{success: boolean, deletedCount: number}>}
 */
async function cleanupOldMemories(userId, daysOld = MEMORY_CONFIG.MEMORY_RETENTION_DAYS) {
    try {
        const { data, error } = await supabase.rpc('cleanup_old_memories', {
            p_user_id: userId,
            days_old: daysOld
        });

        if (error) {
            throw new Error(`Database error: ${error.message}`);
        }

        console.log(`[MemoryService] 🧹 Cleaned up ${data} old memories`);
        return { success: true, deletedCount: data };
    } catch (error) {
        console.error('[MemoryService] Error cleaning up memories:', error);
        return { success: false, deletedCount: 0 };
    }
}

module.exports = {
    // Core operations
    addMemory,
    getRelevantMemories,
    
    // Formatting
    formatMemoriesForPrompt,
    
    // Management
    getMemoryStats,
    deleteMemory,
    listMemories,
    cleanupOldMemories,
    
    // Utilities (exported for testing)
    generateEmbedding,
    classifyMemory,
    
    // Re-export config for convenience
    MEMORY_TYPES,
    SOURCE_APPS,
    MEMORY_CONFIG,
    MODEL_CONFIG
};
