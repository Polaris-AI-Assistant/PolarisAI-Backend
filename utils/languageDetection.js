/**
 * Language Detection and Enforcement Utility
 * 
 * Uses LLM to detect the language of user queries and ensures responses are in the same language
 */

const OpenAI = require('openai');

/**
 * Detect the language of a text query using LLM
 * @param {string} text - The text to analyze
 * @returns {Promise<string>} - Language code (en, hi, mr, es, fr, de, etc.)
 */
async function detectLanguage(text) {
  if (!text || typeof text !== 'string') {
    return 'en'; // Default to English
  }

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a language detection expert. Analyze the given text and determine which language it is written in.

Return ONLY a JSON object with the following format:
{
  "languageCode": "en|hi|mr|es|fr|de|pt|it|ja|zh|ar|ru|ko",
  "languageName": "English|Hindi|Marathi|Spanish|French|German|Portuguese|Italian|Japanese|Chinese|Arabic|Russian|Korean",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of why this language was detected"
}

Supported languages:
- en: English
- hi: Hindi
- mr: Marathi
- es: Spanish
- fr: French
- de: German
- pt: Portuguese
- it: Italian
- ja: Japanese
- zh: Chinese (Mandarin)
- ar: Arabic
- ru: Russian
- ko: Korean

IMPORTANT:
- Distinguish between similar languages (e.g., Hindi vs Marathi, Portuguese vs Spanish)
- If text is mixed language, detect the PRIMARY language
- Be confident in your detection
- Return ONLY valid JSON, no other text`
        },
        {
          role: 'user',
          content: `Detect the language of this text:\n\n"${text}"`
        }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(response.choices[0].message.content);
    console.log(`[LanguageDetection] 🌐 Detected: ${result.languageName} (${result.languageCode}) - Confidence: ${result.confidence}`);
    console.log(`[LanguageDetection] 📝 Reasoning: ${result.reasoning}`);
    
    return result.languageCode;
  } catch (error) {
    console.error('[LanguageDetection] ⚠️ Error detecting language with LLM:', error.message);
    // Fallback to English if LLM detection fails
    return 'en';
  }
}

/**
 * Get language name from code
 * @param {string} code - Language code
 * @returns {string} - Full language name
 */
function getLanguageName(code) {
  const languages = {
    'en': 'English',
    'hi': 'Hindi',
    'mr': 'Marathi',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German'
  };
  return languages[code] || 'English';
}

/**
 * Get system prompt instruction for language enforcement
 * @param {string} languageCode - Detected language code
 * @returns {string} - System prompt instruction
 */
function getLanguageInstruction(languageCode) {
  const languageName = getLanguageName(languageCode);
  
  return `CRITICAL LANGUAGE REQUIREMENT:
- The user's query is in ${languageName}
- You MUST respond ONLY in ${languageName}
- DO NOT mix languages in your response
- DO NOT translate the user's query
- Keep ALL your responses (summaries, explanations, confirmations) in ${languageName}
- If you cannot respond in ${languageName}, respond in English and apologize

Example:
- User query in English → Your response in English
- User query in Hindi → Your response in Hindi
- User query in Marathi → Your response in Marathi`;
}

/**
 * Validate if response is in the correct language
 * @param {string} response - The response text
 * @param {string} expectedLanguage - Expected language code
 * @returns {boolean} - True if language matches
 */
function validateResponseLanguage(response, expectedLanguage) {
  if (!response || typeof response !== 'string') {
    return true; // Can't validate, assume OK
  }
  
  const detectedLanguage = detectLanguage(response);
  
  // Allow English responses for any language (fallback)
  if (detectedLanguage === 'en') {
    return true;
  }
  
  return detectedLanguage === expectedLanguage;
}

module.exports = {
  detectLanguage,
  getLanguageName,
  getLanguageInstruction,
  validateResponseLanguage
};
