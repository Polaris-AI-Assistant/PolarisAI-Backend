/**
 * File Context Builder for LLM Integration
 * Builds optimized file contexts for GPT-4o-mini (128K context window with vision support)
 */

const supabase = require('../supabase/supabaseConnect');
const supabaseAdmin = require('../supabase/supabaseAdmin');

// Token limits for GPT-4o-mini
const TOKEN_LIMITS = {
  'gpt-4o-mini': 128000,  // Total context window
};

// Context allocation strategy (percentages of total tokens)
const CONTEXT_ALLOCATION = {
  systemPrompt: 0.01,      // 1% (~1.3K tokens) for system instructions
  fileContext: 0.62,       // 62% (~79K tokens) for file content  
  chatHistory: 0.31,       // 31% (~40K tokens) for conversation history
  userMessage: 0.02,       // 2% (~2.5K tokens) for current user message
  responseBuffer: 0.04     // 4% (~5K tokens) buffer for response
};

/**
 * Calculate token budget for model
 */
function calculateTokenBudget(model = 'gpt-4o-mini') {
  const totalTokens = TOKEN_LIMITS[model] || 128000;

  return {
    total: totalTokens,
    systemPrompt: Math.floor(totalTokens * CONTEXT_ALLOCATION.systemPrompt),
    fileContext: Math.floor(totalTokens * CONTEXT_ALLOCATION.fileContext),
    chatHistory: Math.floor(totalTokens * CONTEXT_ALLOCATION.chatHistory),
    userMessage: Math.floor(totalTokens * CONTEXT_ALLOCATION.userMessage),
    responseBuffer: Math.floor(totalTokens * CONTEXT_ALLOCATION.responseBuffer)
  };
}

/**
 * Estimate token count (rough approximation)
 * For accurate counting, you'd use tiktoken library
 */
function countTokens(text) {
  if (!text) return 0;
  // Rough estimate: 1 token ≈4 characters
  return Math.ceil(text.length / 4);
}

/**
 * Build context for image files
 * GPT-4o-mini supports vision API!
 * Downloads image from Supabase Storage and converts to base64 data URI
 * to avoid OpenAI timeout issues with private bucket URLs.
 */
async function buildImageContext(file, userMessage) {
  let imageUrl = file.public_url;

  // Download the image from Supabase Storage and convert to base64
  // This is required because our bucket is private and OpenAI can't access the public URL
  try {
    console.log(`[FileContext] Downloading image for base64 conversion: ${file.original_filename}`);
    const { data: imageData, error: downloadError } = await supabaseAdmin.storage
      .from(file.storage_bucket || 'user-uploads')
      .download(file.storage_path);

    if (downloadError) {
      console.error(`[FileContext] Failed to download image: ${downloadError.message}`);
      // Fall back to public URL (may fail at OpenAI)
    } else if (imageData) {
      // Convert Blob to base64
      const arrayBuffer = await imageData.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const mimeType = file.mime_type || 'image/jpeg';
      imageUrl = `data:${mimeType};base64,${base64}`;
      console.log(`[FileContext] ✅ Converted image to base64 (${Math.round(base64.length / 1024)} KB)`);
    }
  } catch (err) {
    console.error(`[FileContext] Error converting image to base64:`, err.message);
    // Fall back to public URL
  }

  // For vision models, return structured format
  const imageContext = {
    type: 'image',
    content: [
      {
        type: 'text',
        text: `[Image: ${file.original_filename}]`
      },
      {
        type: 'image_url',
        image_url: {
          url: imageUrl,
          detail: 'low'  // Use 'low' for cost efficiency (~85 tokens vs 765 for 'high')
        }
      }
    ],
    metadata: {
      filename: file.original_filename,
      size: file.size
    }
  };

  // Also include OCR text if available
  if (file.extracted_text) {
    imageContext.content.push({
      type: 'text',
      text: `\nText extracted from image (OCR):\n${file.extracted_text}`
    });
  }

  // Include AI description if available
  if (file.metadata?.aiDescription) {
    imageContext.content.push({
      type: 'text',
      text: `\nImage Description:\n${file.metadata.aiDescription}`
    });
  }

  return imageContext;
}

/**
 * Build context for document files (PDF, DOCX, TXT)
 */
async function buildDocumentContext(file, tokenBudget) {
  const fullText = file.extracted_text || '';
  const tokenCount = countTokens(fullText);

  let context = `[Document: ${file.original_filename}]\n`;

  // Add metadata if available
  if (file.metadata?.pageCount) {
    context += `Pages: ${file.metadata.pageCount}\n`;
  }
  if (file.metadata?.author) {
    context += `Author: ${file.metadata.author}\n`;
  }

  context += '\nContent:\n';

  // If document fits in budget, include full text
  if (tokenCount <= tokenBudget) {
    context += fullText;
  } else {
    // Otherwise, truncate to fit budget
    const charsToInclude = Math.floor(tokenBudget * 4);  // 4 chars per token rough estimate
    context += fullText.substring(0, charsToInclude);
    context += `\n\n[Document truncated due to length. Showing first ${charsToInclude} characters of ${fullText.length} total]`;
  }

  return context;
}

/**
 * Build context for audio files
 */
async function buildAudioContext(file) {
  let context = `[Audio: ${file.original_filename}]\n`;

  if (file.metadata?.duration) {
    const minutes = Math.floor(file.metadata.duration / 60);
    const seconds = Math.floor(file.metadata.duration % 60);
    context += `Duration: ${minutes}:${seconds.toString().padStart(2, '0')}\n`;
  }

  if (file.extracted_text) {
    context += `\nTranscription:\n${file.extracted_text}\n`;
  } else {
    context += '\n[Audio transcription not available]\n';
  }

  return context;
}

/**
 * Build context for video files
 */
async function buildVideoContext(file) {
  let context = `[Video: ${file.original_filename}]\n`;

  if (file.metadata?.duration) {
    const minutes = Math.floor(file.metadata.duration / 60);
    const seconds = Math.floor(file.metadata.duration % 60);
    context += `Duration: ${minutes}:${seconds.toString().padStart(2, '0')}\n`;
  }

  if (file.metadata?.width && file.metadata?.height) {
    context += `Resolution: ${file.metadata.width}x${file.metadata.height}\n`;
  }

  context += '\n[Video content analysis not yet available]\n';

  return context;
}

/**
 * Build context for code files
 */
async function buildCodeContext(file) {
  const language = detectLanguage(file.original_filename);
  const code = file.extracted_text || '';

  let context = `[Code File: ${file.original_filename}]\n`;
  context += `Language: ${language}\n`;
  context += `Size: ${file.size} bytes\n\n`;
  context += '```' + language + '\n';
  context += code;
  context += '\n```\n';

  return context;
}

/**
 * Detect programming language from filename
 */
function detectLanguage(filename) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const languageMap = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'py': 'python',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c',
    'cs': 'csharp',
    'go': 'go',
    'rs': 'rust',
    'rb': 'ruby',
    'php': 'php',
    'swift': 'swift',
    'kt': 'kotlin',
    'html': 'html',
    'css': 'css',
    'json': 'json',
    'xml': 'xml',
    'sql': 'sql',
    'sh': 'bash',
    'md': 'markdown'
  };

  return languageMap[ext] || 'text';
}

/**
 * Main function to build file contexts for LLM
 * @param {string[]} fileIds - Array of file IDs to include
 * @param {string} userMessage - Current user message
 * @param {string} userId - User ID for file access verification
 * @param {string} model - LLM model name
 * @returns {Object} File contexts and token usage
 */
async function buildFileContexts(fileIds, userMessage, userId, model = 'gpt-4o-mini') {
  if (!fileIds || fileIds.length === 0) {
    return {
      fileContexts: [],
      visionContent: [],
      textContent: '',
      tokensUsed: 0,
      filesProcessed: 0
    };
  }

  const tokenBudget = calculateTokenBudget(model);
  console.log(`[FileContext] Building file context for ${fileIds.length} files, budget: ${tokenBudget.fileContext} tokens`);

  // Fetch files from database
  const { data: files, error } = await supabase
    .from('files')
    .select('*')
    .in('id', fileIds)
    .eq('user_id', userId)
    .eq('status', 'ready');  // Only include successfully processed files

  if (error) {
    console.error('[FileContext] Error fetching files:', error);
    return {
      fileContexts: [],
      visionContent: [],
      textContent: '',
      tokensUsed: 0,
      filesProcessed: 0,
      error: error.message
    };
  }

  if (!files || files.length === 0) {
    console.log('[FileContext] No ready files found for provided IDs');
    return {
      fileContexts: [],
      visionContent: [],
      textContent: '',
      tokensUsed: 0,
      filesProcessed: 0
    };
  }

  console.log(`[FileContext] Found ${files.length} ready files to process`);

  const visionContent = [];
  const textContexts = [];
  let tokensUsed = 0;

  for (const file of files) {
    if (tokensUsed >= tokenBudget.fileContext) {
      console.log(`[FileContext] Token budget exhausted, processed ${textContexts.length + visionContent.length}/${files.length} files`);
      break;
    }

    try {
      let fileContext;

      switch (file.file_type) {
        case 'image':
          // Use vision API for images
          fileContext = await buildImageContext(file, userMessage);
          visionContent.push(fileContext);
          console.log(`[FileContext] Added image file: ${file.original_filename} (using vision API)`);
          // Vision token count: 'low' detail = 85 tokens, but base64 images add data tokens
          // For 'low' detail, OpenAI resizes to 512x512 so token cost is fixed at ~85 tokens
          tokensUsed += 85;
          break;

        case 'document':
          const remainingBudget = tokenBudget.fileContext - tokensUsed;
          fileContext = await buildDocumentContext(file, remainingBudget);
          const docTokens = countTokens(fileContext);
          if (tokensUsed + docTokens <= tokenBudget.fileContext) {
            textContexts.push(fileContext);
            tokensUsed += docTokens;
            console.log(`[FileContext] Added document: ${file.original_filename} (~${docTokens} tokens)`);
          } else {
            console.log(`[FileContext] Skipping document ${file.original_filename} (would exceed budget)`);
          }
          break;

        case 'audio':
          fileContext = await buildAudioContext(file);
          const audioTokens = countTokens(fileContext);
          if (tokensUsed + audioTokens <= tokenBudget.fileContext) {
            textContexts.push(fileContext);
            tokensUsed += audioTokens;
            console.log(`[FileContext] Added audio: ${file.original_filename} (~${audioTokens} tokens)`);
          }
          break;

        case 'video':
          fileContext = await buildVideoContext(file);
          const videoTokens = countTokens(fileContext);
          if (tokensUsed + videoTokens <= tokenBudget.fileContext) {
            textContexts.push(fileContext);
            tokensUsed += videoTokens;
            console.log(`[FileContext] Added video: ${file.original_filename} (~${videoTokens} tokens)`);
          }
          break;

        default:
          // Handle other file types as code or text
          if (file.extracted_text) {
            fileContext = await buildCodeContext(file);
            const codeTokens = countTokens(fileContext);
            if (tokensUsed + codeTokens <= tokenBudget.fileContext) {
              textContexts.push(fileContext);
              tokensUsed += codeTokens;
              console.log(`[FileContext] Added file: ${file.original_filename} (~${codeTokens} tokens)`);
            }
          }
      }
    } catch (error) {
      console.error(`[FileContext] Error building context for file ${file.id}:`, error);
      // Continue with other files
    }
  }

  // Combine text contexts
  const textContent = textContexts.length > 0 
    ? `The following files are available in this conversation:\n\n${textContexts.join('\n\n---\n\n')}`
    : '';

  console.log(`[FileContext] Built context: ${visionContent.length} vision files, ${textContexts.length} text files, ~${tokensUsed} tokens used`);

  return {
    fileContexts: [...visionContent, ...textContexts],
    visionContent,
    textContent,
    tokensUsed,
    filesProcessed: visionContent.length + textContexts.length,
    tokenBudget
  };
}

/**
 * Update file reference tracking when file is used in message
 */
async function trackFileReference(fileId, messageId, chatId) {
  try {
    // Update the file's message_id and chat_id if not already set
    // Use supabaseAdmin to bypass RLS (backend uses custom JWT auth, not Supabase Auth)
    await supabaseAdmin
      .from('files')
      .update({
        message_id: messageId,
        chat_id: chatId,
        updated_at: new Date().toISOString()
      })
      .eq('id', fileId)
      .is('message_id', null);  // Only update if not already linked

    console.log(`[FileContext] Tracked file ${fileId} reference in message ${messageId}`);
  } catch (error) {
    console.error('[FileContext] Error tracking file reference:', error);
  }
}

module.exports = {
  buildFileContexts,
  trackFileReference,
  calculateTokenBudget,
  countTokens
};
