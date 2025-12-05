/**
 * Memory System Configuration
 * 
 * Centralized configuration for the long-term memory system.
 * All configurable constants are defined here for easy adjustment.
 */

// Memory type enum
const MEMORY_TYPES = {
    USER_PROFILE: 'user_profile',       // Stable preferences, identity, personal info
    BEHAVIOR_PATTERN: 'behavior_pattern', // Habits, repeated behaviors, frequent workflows
    TASK_STATE: 'task_state',           // Ongoing or incomplete tasks
    CROSS_APP: 'cross_app'              // Info derived from or linking multiple connected apps
};

// Source application enum
const SOURCE_APPS = {
    CHAT: 'chat',
    GMAIL: 'gmail',
    GITHUB: 'github',
    CALENDAR: 'calendar',
    DOCS: 'docs',
    SHEETS: 'sheets',
    FORMS: 'forms',
    MEET: 'meet',
    FLIGHTS: 'flights',
    MULTI_AGENT: 'multi-agent'
};

// Memory retrieval configuration
const MEMORY_CONFIG = {
    // Number of top memories to retrieve in similarity search
    TOP_K: parseInt(process.env.MEMORY_TOP_K || '5', 10),
    
    // Minimum similarity threshold for memory retrieval (0-1)
    // Higher = more strict matching
    SIMILARITY_THRESHOLD: parseFloat(process.env.MEMORY_SIMILARITY_THRESHOLD || '0.5'),
    
    // Maximum length of memory content to include in prompt (in characters)
    MAX_MEMORY_PROMPT_LENGTH: parseInt(process.env.MEMORY_MAX_PROMPT_LENGTH || '4000', 10),
    
    // Maximum memories to store per user (for cleanup)
    MAX_MEMORIES_PER_USER: parseInt(process.env.MEMORY_MAX_PER_USER || '1000', 10),
    
    // Days after which old memories can be cleaned up
    MEMORY_RETENTION_DAYS: parseInt(process.env.MEMORY_RETENTION_DAYS || '90', 10),
    
    // Whether to auto-store memories (can be overridden per request)
    AUTO_STORE_ENABLED: process.env.MEMORY_AUTO_STORE !== 'false',
    
    // Minimum content length to store as memory (avoid storing trivial exchanges)
    MIN_CONTENT_LENGTH: parseInt(process.env.MEMORY_MIN_CONTENT_LENGTH || '50', 10)
};

// Model configuration
const MODEL_CONFIG = {
    // OpenAI embedding model for generating memory embeddings
    EMBEDDING_MODEL: process.env.MEMORY_EMBEDDING_MODEL || 'text-embedding-3-small',
    
    // Embedding dimensions (must match pgvector column size)
    EMBEDDING_DIMENSIONS: parseInt(process.env.MEMORY_EMBEDDING_DIMENSIONS || '1536', 10),
    
    // LLM model for memory classification
    CLASSIFIER_MODEL: process.env.MEMORY_CLASSIFIER_MODEL || 'gpt-4o-mini',
    
    // Temperature for classifier (lower = more deterministic)
    CLASSIFIER_TEMPERATURE: parseFloat(process.env.MEMORY_CLASSIFIER_TEMPERATURE || '0.2')
};

// Memory type display names for UI
const MEMORY_TYPE_DISPLAY = {
    user_profile: 'User Profile',
    behavior_pattern: 'Behavior Pattern',
    task_state: 'Task State',
    cross_app: 'Cross-App Context'
};

// Memory type icons for UI
const MEMORY_TYPE_ICONS = {
    user_profile: '👤',
    behavior_pattern: '🔄',
    task_state: '📋',
    cross_app: '🔗'
};

/**
 * Validate memory type value
 * @param {string} type - Memory type to validate
 * @returns {boolean} - True if valid
 */
function isValidMemoryType(type) {
    return Object.values(MEMORY_TYPES).includes(type);
}

/**
 * Validate source app value
 * @param {string} app - Source app to validate
 * @returns {boolean} - True if valid
 */
function isValidSourceApp(app) {
    return Object.values(SOURCE_APPS).includes(app);
}

/**
 * Get display name for memory type
 * @param {string} type - Memory type
 * @returns {string} - Display name
 */
function getMemoryTypeDisplay(type) {
    return MEMORY_TYPE_DISPLAY[type] || type;
}

/**
 * Get icon for memory type
 * @param {string} type - Memory type
 * @returns {string} - Icon emoji
 */
function getMemoryTypeIcon(type) {
    return MEMORY_TYPE_ICONS[type] || '📝';
}

module.exports = {
    MEMORY_TYPES,
    SOURCE_APPS,
    MEMORY_CONFIG,
    MODEL_CONFIG,
    MEMORY_TYPE_DISPLAY,
    MEMORY_TYPE_ICONS,
    isValidMemoryType,
    isValidSourceApp,
    getMemoryTypeDisplay,
    getMemoryTypeIcon
};
