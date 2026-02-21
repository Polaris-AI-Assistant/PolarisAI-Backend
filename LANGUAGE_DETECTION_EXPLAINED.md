# How Language Detection Works in This Codebase

## Overview
The codebase uses a **pattern-based language detection system** implemented in `utils/languageDetection.js`. It detects the language of user queries and enforces that language throughout the entire execution chain.

## The Detection Method

### 1. Script Detection (Unicode Ranges)
The primary detection method checks for Unicode character ranges:

```javascript
const hindiMarathiPattern = /[\u0900-\u097F]/; // Devanagari script
const hasDevanagari = hindiMarathiPattern.test(text);
```

**Unicode Ranges Used**:
- `\u0900-\u097F` = Devanagari script (Hindi, Marathi, Sanskrit, etc.)
- Other scripts can be added similarly

### 2. Language-Specific Word Detection
After detecting the script, it checks for language-specific keywords to distinguish between similar languages:

```javascript
if (hasDevanagari) {
  // Check for Marathi-specific words
  const marathiWords = ['आहे', 'आहेत', 'होते', 'होती', 'करा', 'करू', 'मला', 'तुला', 'त्याला'];
  const hasMarathi = marathiWords.some(word => text.includes(word));
  
  if (hasMarathi) {
    return 'mr'; // Marathi
  }
  return 'hi'; // Hindi (default for Devanagari)
}
```

**Why This Works**:
- Marathi uses specific verb forms and pronouns that Hindi doesn't
- Example: "आहे" (is) is Marathi, "है" (is) is Hindi
- This distinguishes between languages using the same script

### 3. Other Language Detection
For non-Devanagari languages, it checks for common words:

```javascript
// Spanish
const spanishWords = ['hola', 'gracias', 'por favor', 'buenos', 'días', 'cómo', 'está'];
if (spanishWords.some(word => lowerText.includes(word))) {
  return 'es';
}

// French
const frenchWords = ['bonjour', 'merci', 's\'il vous plaît', 'comment', 'allez-vous'];
if (frenchWords.some(word => lowerText.includes(word))) {
  return 'fr';
}

// German
const germanWords = ['hallo', 'danke', 'bitte', 'wie', 'geht', 'ihnen'];
if (germanWords.some(word => lowerText.includes(word))) {
  return 'de';
}
```

### 4. Default Fallback
If no language is detected, it defaults to English:

```javascript
return 'en'; // Default to English
```

## How It's Used in the Codebase

### Step 1: Detect Language at Entry Point
In `MainAgent.processQueryWithStreaming()`:

```javascript
const languageDetection = require('../utils/languageDetection');
const detectedLanguage = languageDetection.detectLanguage(query);
const languageName = languageDetection.getLanguageName(detectedLanguage);
console.log(`[MainAgent] 🌐 Detected language at START: ${languageName} (${detectedLanguage})`);
```

**Output Example**:
```
[MainAgent] 🌐 Detected language at START: Hindi (hi)
```

### Step 2: Get Language Instruction
The `getLanguageInstruction()` function creates a system prompt instruction:

```javascript
const languageInstruction = languageDetection.getLanguageInstruction(detectedLanguage);
```

**Output Example** (for Hindi):
```
CRITICAL LANGUAGE REQUIREMENT:
- The user's query is in Hindi
- You MUST respond ONLY in Hindi
- DO NOT mix languages in your response
- DO NOT translate the user's query
- Keep ALL your responses (summaries, explanations, confirmations) in Hindi
- If you cannot respond in Hindi, respond in English and apologize

Example:
- User query in English → Your response in English
- User query in Hindi → Your response in Hindi
- User query in Marathi → Your response in Marathi
```

### Step 3: Add to System Prompt
The language instruction is added to every LLM call:

```javascript
const messages = [
  { 
    role: 'system', 
    content: this.systemPrompt + '\n\n' + languageInstruction 
  },
  { role: 'user', content: userQuery }
];

const response = await this.openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: messages,
  temperature: 0.7
});
```

## Detection Examples

### Example 1: English Query
```
Input: "Create a meeting for tomorrow at 5pm"
Detection:
  - No Devanagari script found
  - No Spanish/French/German words found
  - Default to English
Output: detectedLanguage = 'en'
```

### Example 2: Hindi Query
```
Input: "कल शाम 5 बजे एक मीटिंग बनाओ"
Detection:
  - Devanagari script found ✓
  - Check for Marathi words: 'आहे', 'करा', etc. - NOT found
  - Default to Hindi for Devanagari
Output: detectedLanguage = 'hi'
```

### Example 3: Marathi Query
```
Input: "उद्या संध्याकाळी 5 वाजता एक मीटिंग तयार करा"
Detection:
  - Devanagari script found ✓
  - Check for Marathi words: 'करा' found ✓
  - Marathi detected
Output: detectedLanguage = 'mr'
```

### Example 4: Spanish Query
```
Input: "Crear una reunión para mañana a las 5 pm"
Detection:
  - No Devanagari script
  - Check Spanish words: 'para', 'mañana' found ✓
Output: detectedLanguage = 'es'
```

## Where Language Detection Happens

### 1. **MainAgent.processQuery()** (Line ~4540)
```javascript
const detectedLanguage = languageDetection.detectLanguage(query);
```
- Detects language from user query
- Passes to `analyzeQuery()` and `combineResponses()`

### 2. **MainAgent.processQueryWithStreaming()** (Line ~2160)
```javascript
const detectedLanguage = languageDetection.detectLanguage(query);
```
- Detects language at the very start
- Passes to `analyzeQuery()` and `streamCombinedResponse()`

### 3. **MainAgent.analyzeQuery()** (Line ~1510)
```javascript
const languageInstruction = languageDetection.getLanguageInstruction(detectedLanguage);
// Added to system prompt for query routing
```

### 4. **MainAgent.combineResponses()** (Line ~2060)
```javascript
const languageInstruction = languageDetection.getLanguageInstruction(detectedLanguage);
// Added to system prompt for response combination
```

### 5. **MainAgent.streamCombinedResponse()** (Line ~4375)
```javascript
const languageInstruction = languageDetection.getLanguageInstruction(detectedLanguage);
// Added to system prompt for streaming response
```

### 6. **MainAgent.streamConfirmedActionResponse()** (Line ~4235)
```javascript
const detectedLanguage = languageDetection.detectLanguage(query);
const languageInstruction = languageDetection.getLanguageInstruction(detectedLanguage);
// Added to system prompt for intermediate confirmations
```

### 7. **MainAgent.generateEmailFromScratch()** (Line ~710)
```javascript
const detectedLanguage = languageDetection.detectLanguage(originalQuery);
const languageInstruction = languageDetection.getLanguageInstruction(detectedLanguage);
// Added to system prompt for email generation
```

### 8. **BaseAgent.processQuery()** (Line ~30)
```javascript
const detectedLanguage = languageDetection.detectLanguage(query);
// Added to system prompt for specialized agents
```

## Flow Diagram

```
User Query: "कल शाम 5 बजे एक मीटिंग बनाओ"
    ↓
detectLanguage(query)
    ↓ [Check for Devanagari: ✓ Found]
    ↓ [Check for Marathi words: ✗ Not found]
    ↓ [Default to Hindi]
detectedLanguage = 'hi'
    ↓
getLanguageName('hi') → "Hindi"
    ↓
getLanguageInstruction('hi') → "You MUST respond ONLY in Hindi"
    ↓
Add to system prompt:
  "CRITICAL LANGUAGE REQUIREMENT:
   - The user's query is in Hindi
   - You MUST respond ONLY in Hindi
   ..."
    ↓
LLM Call with language instruction
    ↓
Response: ✅ In Hindi
```

## Limitations & Improvements

### Current Limitations
1. **Word-based detection is limited**: Only checks for specific keywords
2. **No ML/NLP**: Uses simple pattern matching, not machine learning
3. **Limited language support**: Only supports 6 languages (en, hi, mr, es, fr, de)
4. **Script-based only for Devanagari**: Other scripts not yet implemented

### Potential Improvements
1. **Use Google Translate API** for more accurate detection
2. **Use language detection library** like `franc` or `textcat`
3. **Add more languages** by adding more Unicode ranges and keywords
4. **Use ML models** for better accuracy
5. **Detect language from user profile** if available

### Example: Using `franc` Library
```javascript
const franc = require('franc');

function detectLanguageWithFranc(text) {
  const language = franc(text);
  // Returns ISO 639-3 language code
  // 'eng' for English, 'hin' for Hindi, 'mar' for Marathi, etc.
  return language;
}
```

## Testing Language Detection

### Test Cases
```javascript
// Test 1: English
detectLanguage("Create a meeting for tomorrow") 
// Expected: 'en'

// Test 2: Hindi
detectLanguage("कल शाम 5 बजे एक मीटिंग बनाओ")
// Expected: 'hi'

// Test 3: Marathi
detectLanguage("उद्या संध्याकाळी 5 वाजता एक मीटिंग तयार करा")
// Expected: 'mr'

// Test 4: Spanish
detectLanguage("Crear una reunión para mañana a las 5 pm")
// Expected: 'es'

// Test 5: Mixed (should detect first language)
detectLanguage("Create a meeting कल शाम 5 बजे")
// Expected: 'en' (English detected first)
```

## Summary

The language detection system works by:
1. **Checking Unicode script ranges** to identify script families
2. **Checking language-specific keywords** to distinguish similar languages
3. **Defaulting to English** if no language is detected
4. **Adding language instructions to system prompts** to enforce language in LLM responses
5. **Passing language through the entire execution chain** to ensure consistency

This ensures that all responses (initial analysis, intermediate confirmations, email content, final response) are in the same language as the user's query.
