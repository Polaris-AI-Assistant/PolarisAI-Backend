# File Upload System - Implementation Guide

## Overview

This file upload system provides a complete solution for handling file uploads with:
- Direct client-to-storage uploads using signed URLs
- Background processing for text extraction, thumbnails, and transcription
- Support for images, documents, audio, video, and other file types
- Supabase Storage integration with 50MB bucket limit

## Files Created

### Backend Files (PolarisAI-Backend/files/)

1. **create_files_tables.sql** - Database schema with tables, indexes, and RLS policies
2. **filesService.js** - Business logic for file operations
3. **filesData.js** - Direct database operations
4. **fileProcessing.js** - Background queue and workers for file processing
5. **filesController.js** - HTTP request handlers
6. **filesRoutes.js** - API route definitions

### Frontend Files (PolarisAI-Frontend/components/ui/)

1. **FileUpload.tsx** - Drag & drop file upload component
2. **FileMessage.tsx** - Display uploaded files in chat

## Setup Instructions

### 1. Database Setup

Run the SQL schema in your Supabase dashboard:

```bash
# Navigate to Supabase Dashboard > SQL Editor
# Run the contents of: PolarisAI-Backend/files/create_files_tables.sql
```

This creates:
- `files` table with all necessary columns
- Indexes for optimal performance
- Row Level Security (RLS) policies
- Helper functions for storage usage tracking
- Storage bucket policies

### 2. Backend Setup

#### Install Dependencies

```bash
cd PolarisAI-Backend
npm install
```

New dependencies added:
- `bull` - Queue management for background processing
- `sharp` - Image processing and thumbnail generation
- `tesseract.js` - OCR for text extraction from images
- `pdf-parse` - PDF text extraction
- `fluent-ffmpeg` - Audio/video metadata extraction

#### Environment Variables

Add to your `.env` file:

```env
# Redis (required for Bull queue)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# OpenAI (optional - for transcription and image analysis)
OPENAI_API_KEY=your_openai_api_key

# Feature flags (optional)
ENABLE_OCR=true              # Enable OCR for images
ENABLE_TRANSCRIPTION=true    # Enable audio transcription
```

#### Install Redis (if not already installed)

**Windows:**
```bash
# Using Chocolatey
choco install redis-64

# Or download from: https://github.com/microsoftarchive/redis/releases
```

**macOS:**
```bash
brew install redis
brew services start redis
```

**Linux:**
```bash
sudo apt-get install redis-server
sudo systemctl start redis
```

#### Install FFmpeg (for video/audio processing)

**Windows:**
```bash
# Using Chocolatey
choco install ffmpeg

# Or download from: https://ffmpeg.org/download.html
```

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt-get install ffmpeg
```

### 3. Frontend Setup

#### Install Dependencies

```bash
cd PolarisAI-Frontend
npm install
```

New dependency added:
- `react-dropzone` - Drag & drop file upload

#### Environment Variables

Add to your `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### 4. Supabase Storage Setup

The bucket `user-uploads` should already be created with 50MB size limit.

Verify in Supabase Dashboard:
1. Go to Storage
2. Check that `user-uploads` bucket exists
3. Bucket should be set to **private** (not public)
4. The SQL policies will handle access control

## API Endpoints

### File Upload

**POST /api/files/upload-url**
- Get signed upload URL
- Body: `{ filename, mimeType, size, chatId?, messageId? }`
- Response: `{ fileId, uploadUrl, token }`

**POST /api/files/confirm**
- Confirm upload completion
- Body: `{ fileId }`
- Response: `{ fileId, url, status, fileType }`

### File Management

**GET /api/files**
- List user's files
- Query params: `chatId`, `fileType`, `status`, `limit`, `offset`

**GET /api/files/:id**
- Get file details

**DELETE /api/files/:id**
- Delete file

**GET /api/files/:id/download**
- Download file

**GET /api/files/search?q=query**
- Search files by name or content

**GET /api/files/stats**
- Get file statistics

**GET /api/files/storage-usage**
- Get storage usage

**GET /api/files/recent**
- Get recent files

**GET /api/files/chat/:chatId**
- Get files for specific chat

**POST /api/files/:id/process**
- Manually trigger file processing

## Usage Examples

### Frontend: Upload File

```tsx
import FileUpload from '@/components/ui/FileUpload';

function ChatComponent() {
  const handleUploadComplete = (fileData) => {
    console.log('File uploaded:', fileData);
    // Add to chat messages
  };

  const handleUploadError = (error) => {
    console.error('Upload error:', error);
  };

  return (
    <FileUpload
      chatId="your-chat-id"
      onUploadComplete={handleUploadComplete}
      onUploadError={handleUploadError}
      maxSize={50 * 1024 * 1024} // 50MB
    />
  );
}
```

### Frontend: Display File

```tsx
import FileMessage from '@/components/ui/FileMessage';

function MessageComponent({ file }) {
  const handleDelete = async (fileId) => {
    const response = await fetch(`/api/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  };

  return (
    <FileMessage
      file={file}
      onDelete={handleDelete}
      showDeleteButton={true}
    />
  );
}
```

### Backend: Queue File for Processing

```javascript
const { queueFileForProcessing } = require('./files/fileProcessing');

// After file upload confirmation
await queueFileForProcessing(fileId);
```

## File Processing Features

### Image Files
- Generate 300x300 WebP thumbnail
- Extract dimensions and format
- OCR text extraction (optional, requires ENABLE_OCR=true)

### Document Files (PDF, TXT)
- Extract text content
- Extract metadata (page count, author, title)

### Audio Files
- Extract duration and bitrate
- Transcription with OpenAI Whisper (optional, requires ENABLE_TRANSCRIPTION=true)

### Video Files
- Extract duration, resolution, codec
- Generate thumbnail from first frame

## File Size Limits

- Images: 10 MB
- Documents: 50 MB
- Audio: 25 MB
- Video: 100 MB default (adjust based on your bucket limit)
- Other: 5 MB

**Note:** Your Supabase bucket is limited to 50MB total, so consider implementing:
1. File cleanup policies
2. User storage quotas
3. Automatic deletion of old files

## Storage Quotas

The system includes a storage limit check:
- Default: 5GB per user
- Configurable in `create_files_tables.sql` (search for `storage_limit_mb`)
- Enforced via database trigger on file insert

## Cleanup & Maintenance

### Cleanup Expired Files

The SQL schema includes a function to cleanup expired files:

```sql
SELECT cleanup_expired_files();
```

### Check User Storage Usage

```sql
SELECT * FROM get_user_storage_usage('user-uuid');
```

### File Analytics

```sql
SELECT * FROM file_analytics
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY date DESC;
```

## Security Features

1. **File Type Validation** - Only allowed MIME types can be uploaded
2. **File Size Validation** - Enforced on both client and server
3. **User Authentication** - All endpoints require authentication
4. **Row Level Security** - Users can only access their own files
5. **Storage Policies** - Files are stored in user-specific folders
6. **Signed URLs** - Time-limited upload URLs prevent unauthorized access

## Troubleshooting

### Redis Connection Issues

```bash
# Test Redis connection
redis-cli ping
# Should return: PONG
```

### FFmpeg Not Found

```bash
# Verify FFmpeg installation
ffmpeg -version
```

### OCR Not Working

- Ensure Tesseract.js is properly installed
- OCR is CPU-intensive, may be slow for large images
- Consider disabling with `ENABLE_OCR=false`

### Transcription Errors

- Requires valid OpenAI API key
- Check `OPENAI_API_KEY` in .env
- Whisper API has size limits (25MB max audio file)

### File Processing Stuck

```bash
# Check Bull queue status
# Install Bull Board for monitoring:
npm install bull-board
```

## Next Steps

1. **Install Dependencies**
   ```bash
   cd PolarisAI-Backend && npm install
   cd ../PolarisAI-Frontend && npm install
   ```

2. **Setup Redis**
   - Install and start Redis server
   - Configure REDIS_HOST and REDIS_PORT in .env

3. **Setup FFmpeg**
   - Install FFmpeg for video/audio processing

4. **Run SQL Schema**
   - Execute `create_files_tables.sql` in Supabase

5. **Test the System**
   - Start backend: `npm run dev`
   - Start frontend: `npm run dev`
   - Upload a test file

## Optional Enhancements

1. **Image Compression** - Automatically compress images before upload
2. **Virus Scanning** - Integrate ClamAV for file scanning
3. **CDN Integration** - Use Supabase CDN transformations
4. **File Versioning** - Keep multiple versions of files
5. **Shared Files** - Allow file sharing between users
6. **File Collections** - Organize files into folders/albums
7. **Advanced Search** - Full-text search with Supabase
8. **Bulk Upload** - Support multiple file uploads
9. **Upload Progress** - Real-time progress via WebSocket
10. **Smart Thumbnails** - AI-powered thumbnail selection for videos

## Support

For issues or questions:
1. Check the implementation guide PDF
2. Review error logs in terminal
3. Check Supabase logs in dashboard
4. Verify all dependencies are installed
5. Ensure Redis and FFmpeg are running

## License

Part of the Polaris AI project.
