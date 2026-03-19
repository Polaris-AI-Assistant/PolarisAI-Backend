/**
 * Intent Classifier - LLM-Based Intent Classification
 * 
 * Replaces regex-based intent detection with LLM-powered natural language understanding.
 * This module determines whether a user query is:
 * - ACTIONABLE: User wants to perform an action (create, send, schedule, etc.)
 * - ADVISORY: User wants advice, guidance, or information
 * - CONVERSATIONAL: User is asking about past interactions
 * - FILE_GENERATION: User wants to generate a file (PDF/TXT)
 * 
 * The LLM understands context, nuance, and edge cases that regex cannot handle.
 * 
 * IMPROVEMENTS:
 * - Uses LLMConfig for consistent temperature (0.1 = deterministic)
 * - Normalizes input to prevent parsing variations
 * - Adds chain-of-thought reasoning
 * - Ensures stable, reproducible classification
 */

const OpenAI = require('openai');
const LLMConfig = require('../utils/llmConfig');

class IntentClassifier {
  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.model = 'gpt-4o-mini';
  }

  /**
   * Classify user intent using LLM
   * 
   * @param {string} query - User's query
   * @param {Array} conversationHistory - Recent conversation history for context
   * @returns {Promise<Object>} - Intent classification result
   * 
   * Returns:
   * {
   *   type: 'actionable' | 'advisory' | 'conversational' | 'file_generation' | 'web_search',
   *   confidence: 0.0-1.0,
   *   reasoning: string,
   *   actionType: string (if actionable), // 'create', 'send', 'schedule', 'search', etc.
   *   shouldUseAgents: boolean,
   *   requiresWebSearch: boolean // NEW: indicates if web search is needed
   * }
   */
  async classifyIntent(query, conversationHistory = []) {
    try {
      // ✅ NORMALIZE INPUT for stable parsing
      const normalizedQuery = LLMConfig.normalizeInput(query);
      console.log(`[IntentClassifier] 🤖 Classifying intent for query: "${normalizedQuery}"`);
      if (normalizedQuery !== query) {
        console.log(`[IntentClassifier] 📝 Original: "${query}"`);
      }

      // Build conversation context
      let conversationContext = '';
      if (conversationHistory && conversationHistory.length > 0) {
        const recentHistory = conversationHistory.slice(-4);
        conversationContext = recentHistory
          .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content.substring(0, 300)}`)
          .join('\n');
      }

      const classificationPrompt = `You are an expert at understanding user intent in natural language queries.

REASONING PROCESS (think step by step before classifying):
1. Analyze the main action verb or intent in the query
2. Consider the context and conversation history
3. Determine what the user is trying to achieve
4. Select the single best matching category
5. Provide your confidence level

---

Classify the following user query into ONE of these categories:

1. **ACTIONABLE**: User wants to PERFORM an action or GET information
   - Examples: "Create a google docs titled Project Plan"
   - Examples: "Send an email to john@example.com"
   - Examples: "Schedule a meeting for tomorrow"
   - Examples: "Search for flights to NYC"
   - Examples: "What's the weather in London?" (getting weather data)
   - Examples: "Show me my emails" (fetching data)
   - Key indicators: Action verbs like create, make, send, schedule, book, search, find, show, list, get
   - IMPORTANT: Weather queries are ACTIONABLE (fetching weather data from API)
   - IMPORTANT: "Help me create X" is ACTIONABLE (user wants action, not tutorial)
   - IMPORTANT: "Guide me through sending an email" is ACTIONABLE (user wants to perform the action)

2. **WEB_SEARCH**: User wants CURRENT/REAL-TIME information from the internet (NEWS, EVENTS, ARTICLES)
   - Examples: "Do you know about the AI summit happening in Delhi?"
   - Examples: "What's the latest news about Tesla?"
   - Examples: "Find information about upcoming tech conferences"
   - Examples: "Tell me about recent AI developments"
   - Examples: "What are the current Bitcoin prices?"
   - Key indicators: "latest", "current", "recent", "happening", "today", "now", "upcoming", "news", "do you know about"
   - IMPORTANT: Questions about CURRENT EVENTS, NEWS, or ARTICLES need web search
   - IMPORTANT: "Do you know about X" where X is a current event → WEB_SEARCH
   - IMPORTANT: Weather queries are NOT web search - they use dedicated weather API (classify as ACTIONABLE)

3. **ADVISORY**: User wants ADVICE, GUIDANCE, or GENERAL INFORMATION (not time-sensitive)
   - Examples: "How do I create a google docs?"
   - Examples: "What's the best way to send emails?"
   - Examples: "Should I schedule the meeting now or later?"
   - Examples: "What are best practices for project planning?"
   - Key indicators: Question patterns, "how to", "best way", "should I", "what's the best", "advice", "suggest"
   - IMPORTANT: These are QUESTIONS about HOW TO DO something, not requests to DO it
   - IMPORTANT: General knowledge questions that don't require current information

4. **CONVERSATIONAL**: User is asking about PAST interactions or information
   - Examples: "What is my name?"
   - Examples: "What did I tell you about the project?"
   - Examples: "What flights did I search for?"
   - Examples: "Remind me what we discussed"
   - Key indicators: Past tense, "what did", "remind me", "tell me about", "what was"

5. **FILE_GENERATION**: User wants to GENERATE a file (PDF/TXT)
   - Examples: "Generate a PDF of the project plan"
   - Examples: "Create a text file with the summary"
   - Examples: "Export this as a PDF"
   - Key indicators: "generate", "export", "create", "save" + "pdf" or "txt" or "text file"

CRITICAL RULES:
- Weather queries (temperature, forecast, rain, air quality) → ACTIONABLE (uses weather API, not web search)
- If query asks about CURRENT NEWS/EVENTS/ARTICLES → WEB_SEARCH
- If query contains action verbs (create, make, send, schedule, book, search, find, show, list, get) → ACTIONABLE
- If query is a question asking HOW TO DO something (general knowledge) → ADVISORY
- If query asks about past actions or information → CONVERSATIONAL
- If query mentions file formats (PDF, TXT) → FILE_GENERATION
- "Do you know about [current event]" → WEB_SEARCH
- Ambiguous cases: Lean towards ACTIONABLE if user seems to want something done

${conversationContext ? `\nRECENT CONVERSATION:\n${conversationContext}\n` : ''}

User Query: "${normalizedQuery}"

Respond with ONLY a JSON object (no markdown, no code blocks):
{
  "type": "actionable" | "web_search" | "advisory" | "conversational" | "file_generation",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of why this is classified as [type]",
  "actionType": "create" | "send" | "schedule" | "search" | "find" | "show" | "list" | "get" | "web_search" | null,
  "shouldUseAgents": true | false,
  "requiresWebSearch": true | false
}`;

      // ✅ USE STANDARDIZED LLM CONFIG for deterministic classification
      const response = await LLMConfig.createCompletion(
        this.client,
        [
          {
            role: 'user',
            content: classificationPrompt
          }
        ],
        {
          temperature: LLMConfig.TEMPERATURE.DETERMINISTIC, // 0.1 = deterministic
          maxTokens: 300,
        }
      );

      const responseText = response.choices[0].message.content.trim();
      
      // Parse JSON response
      let classification;
      try {
        classification = JSON.parse(responseText);
      } catch (parseError) {
        console.error(`[IntentClassifier] ⚠️ Failed to parse LLM response:`, responseText);
        // Fallback: treat as actionable if it contains action verbs
        classification = {
          type: 'actionable',
          confidence: 0.5,
          reasoning: 'Fallback classification due to parse error',
          actionType: null,
          shouldUseAgents: true,
          requiresWebSearch: false
        };
      }

      // Ensure requiresWebSearch flag is set
      if (!classification.hasOwnProperty('requiresWebSearch')) {
        classification.requiresWebSearch = classification.type === 'web_search';
      }

      console.log(`[IntentClassifier] ✅ Classification result:`, JSON.stringify(classification, null, 2));
      return classification;

    } catch (error) {
      console.error(`[IntentClassifier] ❌ Error classifying intent:`, error.message);
      // Fallback: assume actionable to avoid blocking user
      return {
        type: 'actionable',
        confidence: 0.3,
        reasoning: 'Error during classification - defaulting to actionable',
        actionType: null,
        shouldUseAgents: true,
        requiresWebSearch: false
      };
    }
  }

  /**
   * Quick check for obvious web search queries (no LLM needed)
   * These are patterns that ALWAYS require web search
   * 
   * @param {string} query - User's query
   * @returns {Object|null} - Classification if obvious, null otherwise
   */
  quickCheckWebSearch(query) {
    const lowerQuery = query.toLowerCase().trim();
    
    // EXCLUDE weather queries - they should use the dedicated weather agent
    const weatherPatterns = [
      /\b(weather|temperature|forecast|rain|snow|sunny|cloudy|wind|humidity|air quality|aqi)\b/i,
      /\b(hot|cold|warm|cool)\s+(is it|in|today|tomorrow)/i,
      /\b(will it|is it)\s+(rain|snow)/i,
      /\b(what's|what is|how's|how is)\s+the\s+(weather|temperature)/i
    ];
    
    for (const pattern of weatherPatterns) {
      if (pattern.test(query)) {
        // This is a weather query - don't classify as web_search
        return null;
      }
    }
    
    // Obvious web search patterns (excluding weather)
    const webSearchPatterns = [
      /\b(latest|current|recent|today|now|this week|this month|upcoming|happening)\b.*\b(news|event|summit|conference|update|development|price|information)/i,
      /\bdo you know (about|if|when|where)\b/i,
      /\b(what|tell me|find)\b.*\b(latest|current|recent|today|now|happening)\b/i,
      /\b(is there|are there)\b.*\b(any|a)\b.*\b(event|summit|conference|meeting|happening)/i,
      /\b(when is|where is)\b.*\b(happening|scheduled|taking place)/i,
      /\b(search|find|look up|google)\b.*\b(information|details|about)/i
    ];

    for (const pattern of webSearchPatterns) {
      if (pattern.test(query)) {
        return {
          type: 'web_search',
          confidence: 0.95,
          reasoning: 'Obvious web search query pattern - requires current information',
          actionType: 'web_search',
          shouldUseAgents: true,
          requiresWebSearch: true
        };
      }
    }

    return null;
  }

  /**
   * Quick check for GitHub and external API queries (no LLM needed)
   * These should be ACTIONABLE because they fetch data from external APIs
   * NOT conversational, because they're not asking about conversation history
   * 
   * @param {string} query - User's query
   * @returns {Object|null} - Classification if obvious, null otherwise
   */
  quickCheckGitHubAndAPIs(query) {
    const lowerQuery = query.toLowerCase().trim();
    
    // GitHub/external API patterns that should be ACTIONABLE
    const apiPatterns = [
      /\b(github|repo|repository|commit|issue|pull request|pr)\b/i,
      /\b(tell me|show me|give me|what is|what are)\s+(my\s+)?(github|profile|username|repos?|commits?)/i,
      /\b(weather|temperature|forecast)\b/i,
      /\b(email|calendar|schedule|meeting)\b.*\b(from|for)\b/i,
      /\b(my|show|list|get)\s+(my\s+)?(profile|account|information|details)\b/i
    ];

    for (const pattern of apiPatterns) {
      if (pattern.test(query)) {
        return {
          type: 'actionable',
          confidence: 0.9,
          reasoning: 'Query asks for external API data (GitHub, Weather, Email, etc.)',
          actionType: 'get',
          shouldUseAgents: true,
          requiresWebSearch: false
        };
      }
    }

    return null;
  }

  /**
   * Quick check for obvious conversational queries (no LLM needed)
   * These are patterns that are ALWAYS conversational
   * 
   * @param {string} query - User's query
   * @returns {Object|null} - Classification if obvious, null otherwise
   */
  quickCheckConversational(query) {
    const lowerQuery = query.toLowerCase().trim();
    
    // Obvious conversational patterns - EXCLUDE queries about external APIs
    const conversationalPatterns = [
      /^what\s+(is|was)\s+my\s+name/i,
      /^who\s+am\s+i/i,
      /^what\s+did\s+(i|we)\s+(say|tell|discuss|talk)/i,
      /^remind\s+me/i,
      /^what\s+was\s+that/i,
      /^tell\s+me\s+about\s+(our|the)\s+conversation/i,
      /^what\s+(flights|forms|documents|emails|meetings)\s+did\s+i/i
    ];

    for (const pattern of conversationalPatterns) {
      if (pattern.test(query)) {
        // But exclude if query mentions GitHub or external APIs
        if (!/\b(github|repo|profile|username)\b/i.test(query)) {
          return {
            type: 'conversational',
            confidence: 0.99,
            reasoning: 'Obvious conversational query pattern',
            actionType: null,
            shouldUseAgents: false
          };
        }
      }
    }

    return null;
  }

  /**
   * Quick check for obvious file generation requests (no LLM needed)
   * 
   * @param {string} query - User's query
   * @returns {Object|null} - Classification if obvious, null otherwise
   */
  quickCheckFileGeneration(query) {
    const lowerQuery = query.toLowerCase().trim();
    
    // Obvious file generation patterns
    const fileGenerationPatterns = [
      /\b(generate|export|create|make|save|download|convert)\s+(a\s+)?(pdf|txt|text|document|file)/i,
      /\b(in|as)\s+(a\s+)?(pdf|txt|text)\b/i,
      /\bpdf\b.*\b(file|format|export|generate|create|download)/i,
      /\b(text|txt)\s+file\b/i
    ];

    for (const pattern of fileGenerationPatterns) {
      if (pattern.test(query)) {
        return {
          type: 'file_generation',
          confidence: 0.95,
          reasoning: 'Obvious file generation request',
          actionType: 'generate',
          shouldUseAgents: false
        };
      }
    }

    return null;
  }

  /**
   * Check if query contains multiple intents (e.g., "search for X and email it")
   * 
   * @param {string} query - User's query
   * @returns {boolean} - True if query likely has multiple intents
   */
  hasMultipleIntents(query) {
    const multiIntentPatterns = [
      /\b(and|then)\s+(send|email|share|create|schedule|add|make)/i,
      /\b(search|find|get|look up)\b.*\b(and|then)\b.*\b(send|email|share)/i,
      /\b(create|make|generate)\b.*\b(and|then)\b.*\b(send|email|share)/i,
    ];

    return multiIntentPatterns.some(pattern => pattern.test(query));
  }

  /**
   * Classify intent using quick checks first, then LLM if needed
   * 
   * @param {string} query - User's query
   * @param {Array} conversationHistory - Recent conversation history
   * @returns {Promise<Object>} - Intent classification
   */
  async classify(query, conversationHistory = []) {
    // Try quick checks first (no LLM needed)
    // Order matters: check more specific patterns first
    
    // 1. Check for GitHub and external API queries (ACTIONABLE)
    let result = this.quickCheckGitHubAndAPIs(query);
    if (result) {
      console.log(`[IntentClassifier] ⚡ Quick check (GitHub/APIs): ${result.type}`);
      return result;
    }

    // 2. Check for web search queries
    result = this.quickCheckWebSearch(query);
    if (result) {
      console.log(`[IntentClassifier] ⚡ Quick check (Web Search): ${result.type}`);
      return result;
    }

    // 3. Check for file generation
    result = this.quickCheckFileGeneration(query);
    if (result) {
      console.log(`[IntentClassifier] ⚡ Quick check (File Generation): ${result.type}`);
      return result;
    }

    // 4. Check for conversational queries (LAST, so GitHub queries don't get caught here)
    result = this.quickCheckConversational(query);
    if (result) {
      console.log(`[IntentClassifier] ⚡ Quick check (Conversational): ${result.type}`);
      return result;
    }

    // Fall back to LLM for ambiguous cases
    console.log(`[IntentClassifier] 🤖 Using LLM for intent classification`);
    return await this.classifyIntent(query, conversationHistory);
  }
}

module.exports = IntentClassifier;
