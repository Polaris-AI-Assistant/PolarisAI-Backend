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
    // ✅ HEURISTIC PRE-CHECK: Quick script-based detection before LLM call
    // This catches obvious cases and reduces LLM errors
    const hasDevanagari = /[\u0900-\u097F]/.test(text); // Hindi/Marathi script
    const hasArabic = /[\u0600-\u06FF]/.test(text); // Arabic script
    const hasChinese = /[\u4E00-\u9FFF]/.test(text); // Chinese characters
    const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF]/.test(text); // Hiragana/Katakana
    const hasKorean = /[\uAC00-\uD7AF]/.test(text); // Hangul
    const hasCyrillic = /[\u0400-\u04FF]/.test(text); // Russian/Cyrillic
    
    // If text contains non-Latin scripts, it's likely that language
    if (hasDevanagari) {
      // Check if it's Hindi or Marathi based on common words
      const hindiWords = /है|हैं|का|की|के|में|से|को|ने|पर|और|या|यह|वह|मैं|तुम|आप/;
      const marathiWords = /आहे|आहेत|च्या|ची|चे|मध्ये|पासून|ला|ने|वर|आणि|किंवा|हा|तो|मी|तू|तुम्ही/;
      
      if (marathiWords.test(text)) {
        console.log('[LanguageDetection] 🔍 Heuristic: Detected Marathi (Devanagari + Marathi words)');
        return 'mr';
      } else {
        console.log('[LanguageDetection] 🔍 Heuristic: Detected Hindi (Devanagari script)');
        return 'hi';
      }
    }
    if (hasArabic) {
      console.log('[LanguageDetection] 🔍 Heuristic: Detected Arabic (Arabic script)');
      return 'ar';
    }
    if (hasChinese) {
      console.log('[LanguageDetection] 🔍 Heuristic: Detected Chinese (Chinese characters)');
      return 'zh';
    }
    if (hasJapanese) {
      console.log('[LanguageDetection] 🔍 Heuristic: Detected Japanese (Hiragana/Katakana)');
      return 'ja';
    }
    if (hasKorean) {
      console.log('[LanguageDetection] 🔍 Heuristic: Detected Korean (Hangul)');
      return 'ko';
    }
    if (hasCyrillic) {
      console.log('[LanguageDetection] 🔍 Heuristic: Detected Russian (Cyrillic script)');
      return 'ru';
    }
    
    // ✅ ENGLISH GRAMMAR CHECK: If text has clear English grammar patterns, it's English
    // This prevents misclassification when text contains foreign proper nouns
    const englishPatterns = [
      /\b(the|a|an|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|should|could|can|may|might|must|shall)\b/i,
      /\b(it|this|that|these|those|with|from|to|in|on|at|by|for|of|and|or|but|if|when|where|why|how|what|which|who)\b/i,
      /\b(compare|show|give|create|make|get|find|search|tell|explain|describe)\b/i
    ];
    
    const englishWordCount = (text.match(/\b[a-zA-Z]+\b/g) || []).length;
    const hasEnglishGrammar = englishPatterns.some(pattern => pattern.test(text));
    
    // If text is mostly Latin script with English grammar, it's English
    if (hasEnglishGrammar && englishWordCount > 2) {
      console.log('[LanguageDetection] 🔍 Heuristic: Detected English (English grammar + Latin script)');
      return 'en';
    }

    // ✅ LLM-BASED DETECTION: For ambiguous cases, use LLM
    console.log('[LanguageDetection] 🤖 Using LLM for language detection...');
    
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

CRITICAL RULES FOR ACCURATE DETECTION:
1. Look at the GRAMMAR and SENTENCE STRUCTURE, not just individual words
2. Proper nouns (names, places, brands) DO NOT determine the language
   - "ujjain", "mumbai", "delhi" are city names, not Hindi words
   - "google", "microsoft", "amazon" are brand names, not English words
3. If the sentence structure, grammar, and function words (it, with, and, the, is, etc.) are in one language, that's the language
4. Mixed language: Detect the PRIMARY language based on grammar and majority of words
5. Be especially careful with Indian city/place names in English sentences
6. Script matters: Devanagari script = Hindi/Marathi, Latin script with English grammar = English

EXAMPLES:
- "compare it with ujjain weather" → English (grammar is English, "ujjain" is just a city name)
- "ujjain ka mausam batao" → Hindi (grammar is Hindi)
- "मुंबई का मौसम कैसा है" → Hindi (Devanagari script)
- "show me mumbai weather" → English (grammar is English, "mumbai" is just a city name)

Return ONLY valid JSON, no other text`
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
