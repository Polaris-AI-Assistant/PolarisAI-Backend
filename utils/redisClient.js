const { createClient } = require('redis');

// Redis configuration from environment variables or defaults
const REDIS_CONFIG = {
    username: process.env.REDIS_USERNAME || 'default',
    password: process.env.REDIS_PASSWORD || 'gFWjuaSL9y3Lfzz60Js7Fp6LfPfMSxUZ',
    socket: {
        host: process.env.REDIS_HOST || 'redis-10777.c305.ap-south-1-1.ec2.cloud.redislabs.com',
        port: parseInt(process.env.REDIS_PORT) || 10777,
        reconnectStrategy: (retries) => {
            if (retries > 10) {
                console.error('❌ Redis: Max reconnection attempts reached');
                return new Error('Max reconnection attempts reached');
            }
            const delay = Math.min(retries * 100, 3000);
            console.log(`🔄 Redis: Reconnecting in ${delay}ms (attempt ${retries})`);
            return delay;
        }
    }
};

let client = null;
let isConnecting = false;
let connectionPromise = null;

/**
 * Create Redis client with error handling and reconnection logic
 */
const createRedisClient = () => {
    const redisClient = createClient(REDIS_CONFIG);

    redisClient.on('error', (err) => {
        console.error('❌ Redis Client Error:', err.message);
    });

    redisClient.on('connect', () => {
        console.log('🔌 Redis: Connecting...');
    });

    redisClient.on('ready', () => {
        console.log('✅ Redis: Connected and ready');
    });

    redisClient.on('reconnecting', () => {
        console.log('🔄 Redis: Reconnecting...');
    });

    redisClient.on('end', () => {
        console.log('🔴 Redis: Connection closed');
        isConnecting = false;
        connectionPromise = null;
    });

    return redisClient;
};

/**
 * Connect to Redis with singleton pattern
 * Ensures only one connection is established
 */
const connectRedis = async () => {
    if (client && client.isOpen) {
        return client;
    }

    if (isConnecting && connectionPromise) {
        return connectionPromise;
    }

    isConnecting = true;
    
    connectionPromise = (async () => {
        try {
            if (!client) {
                client = createRedisClient();
            }
            
            if (!client.isOpen) {
                await client.connect();
            }
            
            isConnecting = false;
            return client;
        } catch (error) {
            isConnecting = false;
            connectionPromise = null;
            throw error;
        }
    })();

    return connectionPromise;
};

/**
 * Get the Redis client, connecting if necessary
 */
const getClient = async () => {
    return await connectRedis();
};

// ========== JSON Helpers ==========

/**
 * Set a JSON value in Redis
 * @param {string} key - Redis key
 * @param {object} value - JSON object to store
 * @param {number} ttl - Optional TTL in seconds
 */
const setJSON = async (key, value, ttl = null) => {
    const redisClient = await getClient();
    const jsonString = JSON.stringify(value);
    
    if (ttl) {
        await redisClient.setEx(key, ttl, jsonString);
    } else {
        await redisClient.set(key, jsonString);
    }
    
    return true;
};

/**
 * Get a JSON value from Redis
 * @param {string} key - Redis key
 * @returns {object|null} - Parsed JSON object or null if not found
 */
const getJSON = async (key) => {
    const redisClient = await getClient();
    const jsonString = await redisClient.get(key);
    
    if (!jsonString) {
        return null;
    }
    
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        console.error(`Error parsing JSON for key ${key}:`, error);
        return null;
    }
};

/**
 * Delete a key from Redis
 * @param {string} key - Redis key to delete
 */
const deleteKey = async (key) => {
    const redisClient = await getClient();
    await redisClient.del(key);
    return true;
};

// ========== Artifact Memory Helpers ==========

/**
 * Get the Redis key for artifacts
 * @param {string} conversationId - Unique conversation/chat ID
 */
const getArtifactKey = (conversationId) => `artifact:${conversationId}`;

/**
 * Push a new artifact to the conversation's artifact list
 * Preserves history - never overwrites, only appends
 * 
 * @param {string} conversationId - Unique conversation/chat ID
 * @param {object} artifact - Artifact object { id, type, title, data }
 * @returns {object} - The stored artifact with metadata
 */
const pushArtifact = async (conversationId, artifact) => {
    const key = getArtifactKey(conversationId);
    const redisClient = await getClient();
    
    // Get existing artifacts or initialize empty array
    const existing = await getJSON(key) || { artifacts: [] };
    
    // Add timestamp and ensure required fields
    const storedArtifact = {
        id: artifact.id,
        type: artifact.type,
        title: artifact.title || 'Untitled',
        data: artifact.data || {},
        createdAt: Date.now()
    };
    
    // Append to existing artifacts (never overwrite)
    existing.artifacts.push(storedArtifact);
    
    // Store back with 24 hour TTL (can be adjusted)
    await setJSON(key, existing, 86400);
    
    console.log(`[ArtifactMemory] Stored artifact for conversation ${conversationId}:`, {
        id: storedArtifact.id,
        type: storedArtifact.type,
        title: storedArtifact.title
    });
    
    return storedArtifact;
};

/**
 * Get all artifacts for a conversation
 * 
 * @param {string} conversationId - Unique conversation/chat ID
 * @returns {array} - Array of artifacts
 */
const getArtifacts = async (conversationId) => {
    const key = getArtifactKey(conversationId);
    const data = await getJSON(key);
    
    return data?.artifacts || [];
};

/**
 * Get the most recently created artifact
 * 
 * @param {string} conversationId - Unique conversation/chat ID
 * @returns {object|null} - Most recent artifact or null
 */
const getLastArtifact = async (conversationId) => {
    const artifacts = await getArtifacts(conversationId);
    
    if (artifacts.length === 0) {
        return null;
    }
    
    // Sort by createdAt descending and return first
    return artifacts.sort((a, b) => b.createdAt - a.createdAt)[0];
};

/**
 * Get artifacts by type
 * 
 * @param {string} conversationId - Unique conversation/chat ID
 * @param {string} type - Artifact type (form, doc, sheet, email, event, etc.)
 * @returns {array} - Array of artifacts of the specified type
 */
const getArtifactByType = async (conversationId, type) => {
    const artifacts = await getArtifacts(conversationId);
    
    return artifacts
        .filter(a => a.type === type)
        .sort((a, b) => b.createdAt - a.createdAt);
};

/**
 * Get the most recent artifact of a specific type
 * 
 * @param {string} conversationId - Unique conversation/chat ID
 * @param {string} type - Artifact type
 * @returns {object|null} - Most recent artifact of type or null
 */
const getLastArtifactByType = async (conversationId, type) => {
    const artifacts = await getArtifactByType(conversationId, type);
    return artifacts.length > 0 ? artifacts[0] : null;
};

/**
 * List all artifacts with summary info
 * 
 * @param {string} conversationId - Unique conversation/chat ID
 * @returns {array} - Array of artifact summaries
 */
const listArtifacts = async (conversationId) => {
    const artifacts = await getArtifacts(conversationId);
    
    return artifacts.map(a => ({
        id: a.id,
        type: a.type,
        title: a.title,
        createdAt: a.createdAt,
        createdAtFormatted: new Date(a.createdAt).toISOString()
    }));
};

/**
 * Clear all artifacts for a conversation
 * 
 * @param {string} conversationId - Unique conversation/chat ID
 */
const clearArtifacts = async (conversationId) => {
    const key = getArtifactKey(conversationId);
    await deleteKey(key);
    console.log(`[ArtifactMemory] Cleared artifacts for conversation ${conversationId}`);
    return true;
};

// Test function
const testRedisConnection = async () => {
    try {
        await connectRedis();
        const redisClient = await getClient();
        await redisClient.set('foo', 'bar');
        const result = await redisClient.get('foo');
        console.log('Redis test result:', result);
        return { success: true, result };
    } catch (error) {
        console.error('Redis connection test failed:', error);
        return { success: false, error: error.message };
    }
};

module.exports = {
    // Core Redis
    getClient,
    connectRedis,
    testRedisConnection,
    
    // JSON helpers
    setJSON,
    getJSON,
    deleteKey,
    
    // Artifact Memory
    pushArtifact,
    getArtifacts,
    getLastArtifact,
    getArtifactByType,
    getLastArtifactByType,
    listArtifacts,
    clearArtifacts,
    getArtifactKey
};
