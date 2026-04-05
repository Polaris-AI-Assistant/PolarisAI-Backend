/**
 * Conversational Agent
 * 
 * Handles pure LLM conversational queries that don't require external tools or integrations.
 * This agent provides high-quality responses for:
 * - Coding questions (write code, explain code, debug code)
 * - Study plans and learning roadmaps
 * - General knowledge questions
 * - Advisory/planning requests
 * - Math, logic, explanations
 * 
 * Features:
 * - Direct GPT-4o-mini calls with rich system prompt
 * - Support for streaming responses
 * - Conversation history context
 * - Multi-language support
 */

const OpenAI = require('openai');
const languageDetection = require('../utils/languageDetection');

class ConversationalAgent {
  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.model = 'gpt-4o-mini';
    this.name = 'conversational';
    this.displayName = 'Assistant';
  }

  /**
   * Process a conversational query using direct LLM call
   * 
   * @param {string} query - User's question or request
   * @param {Object} options - Processing options
   * @param {Array} options.conversationHistory - Chat history for context
   * @param {string} options.language - Target language (detected or specified)
   * @param {string} options.userId - User ID for logging
   * @param {string} options.conversationId - Conversation ID for tracking
   * @returns {Promise<Object>} - Response with stream for real-time streaming
   */
  async processQuery(query, options = {}) {
    const { 
      conversationHistory = [], 
      language = 'en', 
      userId = null,
      conversationId = null 
    } = options;

    console.log(`\n[ConversationalAgent] 🤖 Processing query: "${query}"`);
    console.log(`[ConversationalAgent] 📋 Context:`, { 
      userId, 
      conversationId,
      historyLength: conversationHistory.length 
    });

    try {
      // Detect language from query if not provided
      const detectedLanguage = language || await languageDetection.detectLanguage(query);
      const languageName = languageDetection.getLanguageName(detectedLanguage);
      console.log(`[ConversationalAgent] 🌐 Language: ${languageName} (${detectedLanguage})`);

      // Build system prompt optimized for high-quality conversational responses
      const systemPrompt = `You are Polaris AI, an intelligent multi-agent productivity platform.

🎯 YOUR IDENTITY:
- You are NOT a generic AI assistant. Your name is Polaris AI.
- You are: "Your intelligent companion for effortless productivity"
- You help users manage Gmail, Google Calendar, Docs, Sheets, Forms, GitHub, Microsoft 365, 
  Flights, Maps, Web Search, Deep Research, and Smart Reminders.
- You have 13+ specialized agents working together to serve users.
- You have long-term memory that remembers user preferences and past interactions.

⚠️ CRITICAL RULES FOR POLARIS CAPABILITY QUESTIONS:
- When users ask "What can you do?", "Who are you?", or "What [service] tasks can you do?":
  ✅ Give SPECIFIC examples of what you can do with EACH service
  ✅ Mention your key services (Gmail, Calendar, Docs, GitHub, etc.)
  ✅ Highlight that you handle multi-step workflows
  ✅ Mention long-term memory as a key feature
  ❌ NEVER say "I don't have access to tools" — you DO have 13+ connected agents
  ❌ NEVER give generic AI assistant responses for platform questions

- When users ask about integrations or services, tell them EXACTLY what services you're connected to
- Be enthusiastic and specific about Polaris capabilities

CORE PRINCIPLES:
- Give thorough, well-structured, and genuinely helpful responses
- Provide complete, accurate answers without cutting content short
- Use clear explanations with examples when appropriate
- Format responses with markdown for readability (headers, bullet points, code blocks)

RESPONSE GUIDELINES BY QUERY TYPE:

📝 FOR CODING REQUESTS:
- Provide complete, working code with clear comments explaining key parts
- Include practical example usage demonstrating the code
- Explain what the code does and why each part matters
- Format code in proper markdown code blocks with language specification
- Include any important notes or edge cases to consider

📚 FOR STUDY PLANS / LEARNING ROADMAPS:
- Structure as a multi-step learning progression
- For each topic: Include name, importance, time estimate, key concepts
- Provide at least 400-600 words for comprehensive study plans
- Include learning resources, recommended practices, and progression path
- Add checkpoints and milestones for tracking progress
- Suggest related advanced topics for deeper learning

🧠 FOR EXPLANATIONS & CONCEPTS:
- Start with a clear, simple definition
- Build complexity gradually with examples
- Use analogies to relate to familiar concepts
- Include visual descriptions where helpful
- Provide real-world applications or use cases
- Conclude with practical implications

💡 FOR GENERAL QUESTIONS:
- Answer completely and directly
- Provide supporting details and context
- Include relevant background information
- Mention limitations or edge cases if important
- Offer follow-up considerations when appropriate

🍳 FOR COOKING/RECIPE QUESTIONS:
- Provide step-by-step instructions
- List ingredients clearly
- Include cooking times and temperatures
- Add helpful tips and variations
- Mention common mistakes to avoid

RESPONSE LENGTH:
- Coding samples: 500-1500 words with examples
- Study plans: 600-1200 words with structured sections
- Explanations: 300-800 words with examples
- Recipes/cooking: 400-800 words with clear steps
- Never artificially cut responses short - provide complete thoughts

LANGUAGE:
- Match the user's language: ${detectedLanguage}
- Use maximum detail and depth - don't abbreviate or oversimplify`;

      // Build messages with recent conversation history for context
      const messages = [
        { 
          role: 'system', 
          content: systemPrompt 
        },
        // Include last 10 messages for context but avoid overwhelming the LLM
        ...conversationHistory.slice(-10),
        { 
          role: 'user', 
          content: query 
        }
      ];

      console.log(`[ConversationalAgent] 📧 Building prompt with ${messages.length} messages (${conversationHistory.slice(-10).length} from history)`);

      // Create streaming completion for real-time response
      const stream = await this.openai.chat.completions.create({
        model: this.model,
        messages,
        stream: true,
        temperature: 0.7, // Balanced: creative but consistent
        max_tokens: 2000, // Allow comprehensive responses
        top_p: 0.9,
      });

      console.log(`[ConversationalAgent] ✅ Created streaming completion`);

      // ✅ CRITICAL: Return stream wrapped in result object for MainAgent compatibility
      // The stream will be consumed by streamCombinedResponse in MainAgent
      return {
        success: true,
        stream: stream,  // ✅ Return the stream for real-time streaming
        agentName: 'conversational',
        isStreaming: true  // ✅ Flag to indicate this is a streaming response
      };

    } catch (error) {
      console.error(`[ConversationalAgent] ❌ Error processing query:`, error.message);
      
      // Return error in expected format
      return {
        success: false,
        error: `I encountered an error processing your request: ${error.message}`,
        agentName: 'conversational'
      };
    }
  }

  /**
   * Non-streaming version for testing or simple responses
   * 
   * @param {string} query - User's question or request
   * @param {Object} options - Processing options (same as processQuery)
   * @returns {Promise<string>} - Response text
   */
  async processQuerySimple(query, options = {}) {
    try {
      const stream = await this.processQuery(query, options);
      
      // Collect all chunks from stream
      let fullResponse = '';
      for await (const chunk of stream) {
        if (chunk.choices[0].delta.content) {
          fullResponse += chunk.choices[0].delta.content;
        }
      }
      
      return fullResponse;
    } catch (error) {
      console.error(`[ConversationalAgent] Error in simple mode:`, error);
      throw error;
    }
  }
}

module.exports = ConversationalAgent;
