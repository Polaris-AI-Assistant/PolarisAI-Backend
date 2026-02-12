/**
 * File Processing Queue and Workers
 * Handles background processing of uploaded files
 * Extracts text, generates thumbnails, and updates metadata
 */

const Queue = require('bull');
const sharp = require('sharp');
const Tesseract = require('tesseract.js');
const pdf = require('pdf-parse');
const OpenAI = require('openai');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const os = require('os');
const supabase = require('../supabase/supabaseConnect');
const filesService = require('./filesService');

// Initialize OpenAI (for transcription and image analysis)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Create Bull Queue for file processing (only if Redis is available)
let fileProcessingQueue = null;

try {
  if (process.env.REDIS_HOST || process.env.ENABLE_FILE_PROCESSING === 'true') {
    fileProcessingQueue = new Queue('file-processing', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        removeOnComplete: true,
        removeOnFail: false
      }
    });
    console.log('File processing queue initialized successfully');
  } else {
    console.log('File processing disabled (Redis not configured)');
  }
} catch (error) {
  console.warn('File processing queue initialization failed:', error.message);
  console.log('File uploads will work, but processing (thumbnails, OCR, etc.) will be skipped');
}

/**
 * Add file to processing queue
 */
async function queueFileForProcessing(fileId) {
  try {
    if (!fileProcessingQueue) {
      console.log(`File ${fileId} upload confirmed (processing disabled)`);
      // Mark file as ready without processing
      await filesService.markFileAsReady(fileId);
      return;
    }
    
    await fileProcessingQueue.add(
      { fileId },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    );
    console.log(`File ${fileId} queued for processing`);
  } catch (error) {
    console.error('Error queuing file for processing:', error);
    // Mark as ready anyway so file is usable
    await filesService.markFileAsReady(fileId);
  }
}

/**
 * Download file from Supabase Storage to temp directory
 */
async function downloadFileToTemp(storagePath) {
  try {
    const { data, error } = await supabase.storage
      .from('user-uploads')
      .download(storagePath);

    if (error) {
      throw new Error(`Download failed: ${error.message}`);
    }

    // Create temp file
    const tempDir = os.tmpdir();
    const tempFileName = `${Date.now()}-${path.basename(storagePath)}`;
    const tempPath = path.join(tempDir, tempFileName);

    // Write to temp file
    const buffer = Buffer.from(await data.arrayBuffer());
    fs.writeFileSync(tempPath, buffer);

    return { tempPath, buffer };
  } catch (error) {
    console.error('Error downloading file to temp:', error);
    throw error;
  }
}

/**
 * Upload file to Supabase Storage
 */
async function uploadToStorage(filePath, buffer, contentType) {
  try {
    const { error } = await supabase.storage
      .from('user-uploads')
      .upload(filePath, buffer, {
        contentType: contentType,
        upsert: true
      });

    if (error) {
      console.error('Upload error:', error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('user-uploads')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Error uploading to storage:', error);
    return null;
  }
}

/**
 * Process image: generate thumbnail and extract text with OCR
 */
async function processImage(buffer, file) {
  try {
    const metadata = {};

    // Get image metadata
    const image = sharp(buffer);
    const imageMetadata = await image.metadata();

    metadata.width = imageMetadata.width;
    metadata.height = imageMetadata.height;
    metadata.format = imageMetadata.format;

    // Generate thumbnail (300x300)
    const thumbnailBuffer = await image
      .resize(300, 300, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: 80 })
      .toBuffer();

    // Upload thumbnail
    const thumbnailPath = file.storage_path.replace(/\.[^.]+$/, '_thumb.webp');
    const thumbnailUrl = await uploadToStorage(thumbnailPath, thumbnailBuffer, 'image/webp');

    if (thumbnailUrl) {
      metadata.thumbnailUrl = thumbnailUrl;
    }

    return metadata;
  } catch (error) {
    console.error('Error processing image:', error);
    return {};
  }
}

/**
 * Extract text from image using OCR
 */
async function extractTextFromImage(buffer) {
  try {
    const { data: { text } } = await Tesseract.recognize(buffer, 'eng', {
      logger: () => {} // Suppress logs
    });
    return text.trim() || null;
  } catch (error) {
    console.error('OCR error:', error);
    return null;
  }
}

/**
 * Extract text from PDF document
 */
async function extractTextFromPDF(buffer) {
  try {
    const data = await pdf(buffer);
    return data.text || null;
  } catch (error) {
    console.error('PDF parsing error:', error);
    return null;
  }
}

/**
 * Get PDF metadata
 */
async function getPDFMetadata(buffer) {
  try {
    const data = await pdf(buffer);
    return {
      pageCount: data.numpages,
      author: data.info?.Author,
      title: data.info?.Title,
      creator: data.info?.Creator,
      producer: data.info?.Producer
    };
  } catch (error) {
    console.error('PDF metadata error:', error);
    return {};
  }
}

/**
 * Extract text from document
 */
async function extractTextFromDocument(buffer, file) {
  try {
    if (file.mime_type === 'application/pdf') {
      return await extractTextFromPDF(buffer);
    }

    if (file.mime_type === 'text/plain' || file.mime_type.startsWith('text/')) {
      return buffer.toString('utf-8');
    }

    // For other document types, return null
    return null;
  } catch (error) {
    console.error('Error extracting text from document:', error);
    return null;
  }
}

/**
 * Get document metadata
 */
async function getDocumentMetadata(buffer, file) {
  try {
    if (file.mime_type === 'application/pdf') {
      return await getPDFMetadata(buffer);
    }

    return {};
  } catch (error) {
    console.error('Error getting document metadata:', error);
    return {};
  }
}

/**
 * Transcribe audio using OpenAI Whisper
 */
async function transcribeAudio(tempPath, file) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.log('OpenAI API key not configured, skipping transcription');
      return null;
    }

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: 'whisper-1',
      language: 'en'
    });

    return transcription.text;
  } catch (error) {
    console.error('Transcription error:', error);
    return null;
  }
}

/**
 * Get audio metadata using ffmpeg
 */
async function getAudioMetadata(tempPath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(tempPath, (err, metadata) => {
      if (err) {
        console.error('Audio metadata error:', err);
        resolve({});
        return;
      }

      const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

      resolve({
        duration: metadata.format.duration,
        bitrate: metadata.format.bit_rate,
        format: metadata.format.format_name,
        codec: audioStream?.codec_name
      });
    });
  });
}

/**
 * Get video metadata using ffmpeg
 */
async function getVideoMetadata(tempPath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(tempPath, (err, metadata) => {
      if (err) {
        console.error('Video metadata error:', err);
        resolve({});
        return;
      }

      const videoStream = metadata.streams.find(s => s.codec_type === 'video');

      resolve({
        duration: metadata.format.duration,
        bitrate: metadata.format.bit_rate,
        format: metadata.format.format_name,
        width: videoStream?.width,
        height: videoStream?.height,
        codec: videoStream?.codec_name,
        fps: videoStream?.r_frame_rate ? eval(videoStream.r_frame_rate) : null
      });
    });
  });
}

/**
 * Generate video thumbnail
 */
async function generateVideoThumbnail(tempPath, file) {
  return new Promise((resolve) => {
    const tempOutputPath = path.join(os.tmpdir(), `thumb-${file.id}.jpg`);

    ffmpeg(tempPath)
      .screenshots({
        timestamps: ['00:00:01'],
        filename: path.basename(tempOutputPath),
        folder: path.dirname(tempOutputPath),
        size: '640x360'
      })
      .on('end', async () => {
        try {
          const thumbnailBuffer = fs.readFileSync(tempOutputPath);
          const thumbnailPath = file.storage_path.replace(/\.[^.]+$/, '_thumb.jpg');

          const thumbnailUrl = await uploadToStorage(thumbnailPath, thumbnailBuffer, 'image/jpeg');

          // Cleanup
          fs.unlinkSync(tempOutputPath);

          resolve(thumbnailUrl);
        } catch (error) {
          console.error('Error uploading video thumbnail:', error);
          resolve(null);
        }
      })
      .on('error', (err) => {
        console.error('Thumbnail generation error:', err);
        resolve(null);
      });
  });
}

/**
 * Process file based on type
 */
async function processFile(fileId) {
  let tempPath = null;

  try {
    console.log(`Processing file: ${fileId}`);

    // Get file record
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .single();

    if (fileError || !file) {
      throw new Error('File not found');
    }

    // Download file
    const { tempPath: downloadedPath, buffer } = await downloadFileToTemp(file.storage_path);
    tempPath = downloadedPath;

    let extractedText = null;
    let metadata = {};

    // Process based on file type
    switch (file.file_type) {
      case 'image':
        metadata = await processImage(buffer, file);
        // OCR is optional and can be slow
        if (process.env.ENABLE_OCR === 'true') {
          extractedText = await extractTextFromImage(buffer);
        }
        break;

      case 'document':
        extractedText = await extractTextFromDocument(buffer, file);
        metadata = await getDocumentMetadata(buffer, file);
        break;

      case 'audio':
        metadata = await getAudioMetadata(tempPath);
        // Transcription is optional
        if (process.env.ENABLE_TRANSCRIPTION === 'true') {
          extractedText = await transcribeAudio(tempPath, file);
        }
        break;

      case 'video':
        metadata = await getVideoMetadata(tempPath);
        const thumbnailUrl = await generateVideoThumbnail(tempPath, file);
        if (thumbnailUrl) {
          metadata.thumbnailUrl = thumbnailUrl;
        }
        break;
    }

    // Update file record
    await filesService.markFileAsReady(fileId, extractedText, metadata);

    // Cleanup temp file
    if (tempPath && fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }

    console.log(`File processed successfully: ${fileId}`);

  } catch (error) {
    console.error(`Processing error for file ${fileId}:`, error);

    // Mark as failed
    await filesService.markFileAsFailed(fileId, error.message);

    // Cleanup temp file
    if (tempPath && fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }

    throw error;
  }
}

/**
 * Set up queue processor (only if queue is available)
 */
if (fileProcessingQueue) {
  fileProcessingQueue.process(async (job) => {
    const { fileId } = job.data;
    await processFile(fileId);
  });

  /**
   * Queue event handlers
   */
  fileProcessingQueue.on('failed', (job, err) => {
    console.error(`Job ${job.id} failed:`, err);
  });

  fileProcessingQueue.on('completed', (job) => {
    console.log(`Job ${job.id} completed`);
  });

  fileProcessingQueue.on('error', (error) => {
    console.error('Queue error:', error);
  });
}

module.exports = {
  queueFileForProcessing,
  fileProcessingQueue
};
