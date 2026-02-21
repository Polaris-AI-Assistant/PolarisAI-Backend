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
 */

const OpenAI = require('openai');

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
   *   type: 'actionable' | 'advisory' | 'conversational' | 'file_generation',
   *   confidence: 0.0-1.0,
   *   reasoning: string,
   *   actionType: string (if actionable), // 'create', 'send', 'schedule', 'search', etc.
   *   shouldUseAgents: boolean
   * }
   */
  async classifyIntent(query, conversationHistory = []) {
    try {
      console.log(`[IntentClassifier] 🤖 Classifying intent for query: "${query}"`);

      // Build conversation context
      let conversationContext = '';
      if (conversationHistory && conversationHistory.length > 0) {
        const recentHistory = conversationHistory.slice(-4);
        conversationContext = recentHistory
          .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content.substring(0, 300)}`)
          .join('\n');
      }

      const classificationPrompt = `You are an expert at understanding user intent in natural language queries.

Classify the following user query into ONE of these categories:

1. **ACTIONABLE**: User wants to PERFORM an action
   - Examples: "Create a google docs titled Project Plan"
   - Examples: "Send an email to john@example.com"
   - Examples: "Schedule a meeting for tomorrow"
   - Examples: "Search for flights to NYC"
   - Key indicators: Action verbs like create, make, send, schedule, book, search, find, show, list, get
   - IMPORTANT: "Help me create X" is ACTIONABLE (user wants action, not tutorial)
   - IMPORTANT: "Guide me through sending an email" is ACTIONABLE (user wants to perform the action)

2. **ADVISORY**: User wants ADVICE, GUIDANCE, or INFORMATION
   - Examples: "How do I create a google docs?"
   - Examples: "What's the best way to send emails?"
   - Examples: "Should I schedule the meeting now or later?"
   - Examples: "What are best practices for project planning?"
   - Key indicators: Question patterns, "how to", "best way", "should I", "what's the best", "advice", "suggest"
   - IMPORTANT: These are QUESTIONS about HOW TO DO something, not requests to DO it

3. **CONVERSATIONAL**: User is asking about PAST interactions or information
   - Examples: "What is my name?"
   - Examples: "What did I tell you about the project?"
   - Examples: "What flights did I search for?"
   - Examples: "Remind me what we discussed"
   - Key indicators: Past tense, "what did", "remind me", "tell me about", "what was"

4. **FILE_GENERATION**: User wants to GENERATE a file (PDF/TXT)
   - Examples: "Generate a PDF of the project plan"
   - Examples: "Create a text file with the summary"
   - Examples: "Export this as a PDF"
   - Key indicators: "generate", "export", "create", "save" + "pdf" or "txt" or "text file"

CRITICAL RULES:
- If query contains action verbs (create, make, send, schedule, book, search, find, show, list, get) → ACTIONABLE
- If query is a question asking HOW TO DO something → ADVISORY
- If query asks about past actions or information → CONVERSATIONAL
- If query mentions file formats (PDF, TXT) → FILE_GENERATION
- Ambiguous cases: Lean towards ACTIONABLE if user seems to want something done

${conversationContext ? `\nRECENT CONVERSATION:\n${conversationContext}\n` : ''}

User Query: "${query}"

Respond with ONLY a JSON object (no markdown, no code blocks):
{
  "type": "actionable" | "advisory" | "conversational" | "file_generation",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of why this is classified as [type]",
  "actionType": "create" | "send" | "schedule" | "search" | "find" | "show" | "list" | "get" | null,
  "shouldUseAgents": true | false
}`;

      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content: classificationPrompt
          }
        ]
      });

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
          shouldUseAgents: true
        };
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
        shouldUseAgents: true
      };
    }
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
    
    // Obvious conversational patterns
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
        return {
          type: 'conversational',
          confidence: 0.99,
          reasoning: 'Obvious conversational query pattern',
          actionType: null,
          shouldUseAgents: false
        };
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
   * Classify intent with quick checks first, then LLM if needed
   * 
   * @param {string} query - User's query
   * @param {Array} conversationHistory - Recent conversation history
   * @returns {Promise<Object>} - Intent classification
   */
  async classify(query, conversationHistory = []) {
    // Quick checks for obvious patterns
    const conversationalCheck = this.quickCheckConversational(query);
    if (conversationalCheck) {
      console.log(`[IntentClassifier] ⚡ Quick check: Conversational`);
      return conversationalCheck;
    }

    const fileGenerationCheck = this.quickCheckFileGeneration(query);
    if (fileGenerationCheck) {
      console.log(`[IntentClassifier] ⚡ Quick check: File Generation`);
      return fileGenerationCheck;
    }

    // Use LLM for nuanced classification
    return await this.classifyIntent(query, conversationHistory);
  }
}

module.exports = IntentClassifier;
