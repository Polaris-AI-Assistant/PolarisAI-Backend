# File Upload Setup Guide (Windows)

This guide will help you set up the file upload system without using Chocolatey package manager.

## Prerequisites

All required packages are already installed via npm!

## Basic Setup (No Optional Dependencies)

The file upload system will work immediately without any additional setup. Files can be uploaded, stored, and downloaded without Redis or FFmpeg.

### What Works Without Redis/FFmpeg:
- ✅ File uploads (drag & drop, file picker)
- ✅ File storage in Supabase
- ✅ File downloads
- ✅ File previews (images, documents, audio, video)
- ✅ File attachments in chat
- ✅ File management (list, delete, search)

### What Requires Optional Dependencies:
- ⚠️ Background processing queue (requires Redis)
- ⚠️ Image thumbnail generation (requires Redis + Sharp)
- ⚠️ PDF text extraction (requires Redis + pdf-parse)
- ⚠️ Image OCR (requires Redis + Tesseract.js)
- ⚠️ Video/audio metadata (requires Redis + FFmpeg)
- ⚠️ Audio transcription (requires Redis + OpenAI API)

## Database Setup

1. Open your Supabase project dashboard
2. Go to the SQL Editor
3. Run the SQL file:
   ```sql
   -- Copy and paste the contents of:
   PolarisAI-Backend/files/create_files_tables.sql
   ```
4. Verify the tables were created:
   - `files` table
   - Storage bucket policies
   - RLS policies

## Backend Configuration

The backend will automatically work in "simple mode" without Redis:

1. **Files will upload directly** - No background processing
2. **Status will be "ready" immediately** - No processing queue
3. **Errors are handled gracefully** - System degrades gracefully

### Test the Backend

```powershell
cd PolarisAI-Backend
npm start
```

### Verify File Routes

Check that the backend started without errors. You should see:
```
File processing disabled (Redis not configured)
```

This is normal and expected!

## Frontend Configuration

No changes needed - the frontend automatically uses the simple upload mode.

### Test the Frontend

```powershell
cd PolarisAI-Frontend
npm run dev
```

## How to Use

1. Open your chat interface
2. Click the 📎 (paperclip) icon or "Attach" button
3. Select a file to upload
4. The file will upload with a progress bar
5. Once uploaded, the file appears as an attachment
6. Send your message with the attached file

## File Limits

- **Max file size**: 50MB (Supabase free tier limit)
- **Max storage per user**: 50MB total (configured in code)
- **Supported types**: All file types are supported

## Optional: Advanced Processing (Redis + FFmpeg)

If you want background processing features (thumbnails, OCR, transcription), follow these additional steps:

### Step 1: Install Redis (Optional)

**Using Windows Package:**
1. Download Redis for Windows: https://github.com/microsoftarchive/redis/releases
2. Install `Redis-x64-3.0.504.msi`
3. Redis will start automatically as a Windows service

**Using Docker (Recommended):**
```powershell
# Install Docker Desktop from https://www.docker.com/products/docker-desktop
docker run -d -p 6379:6379 --name redis redis:latest
```

### Step 2: Install FFmpeg (Optional)

1. **Download FFmpeg**:
   - go to https://www.gyan.dev/ffmpeg/builds/
   - Download `ffmpeg-release-essentials.zip`

2. **Extract and Add to PATH**:
   ```powershell
   # Extract to C:\ffmpeg
   # Add C:\ffmpeg\bin to your PATH:
   $env:Path += ";C:\ffmpeg\bin"
   
   # Verify installation:
   ffmpeg -version
   ```

### Step 3: Enable Processing

Create a `.env` file in `PolarisAI-Backend/`:

```env
# Enable file processing
ENABLE_FILE_PROCESSING=true

# Redis configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Optional: OpenAI API for audio transcription
OPENAI_API_KEY=your-api-key-here
```

### Restart Backend

```powershell
cd PolarisAI-Backend
npm start
```

You should now see:
```
File processing queue initialized successfully
```

## Troubleshooting

### Backend Won't Start

**Error**: `Router.use() requires a middleware function`
- **Solution**: This was fixed in the latest update. Pull latest changes.

### Files Upload But Show Error

**Issue**: Files upload but status stays "uploading"
- **Solution**: Check Supabase storage bucket CORS settings
- **Fix**: Go to Storage → user-uploads → Settings → Add your frontend URL

### Cannot See Uploaded Files

**Issue**: Files upload but don't appear in chat
- **Solution**: Check browser console for errors
- **Fix**: Verify Supabase RLS policies are correctly set up

### Redis Connection Error

**Issue**: `Redis connection failed`
- **Solution**: This is OK! The system works without Redis
- **Optional**: Install Redis to enable processing features

## Architecture Overview

```
┌─────────────┐
│   Frontend  │
│  File Upload│
└──────┬──────┘
       │
       ▼
┌─────────────────┐     ┌──────────────┐
│  Backend API    │────▶│  Supabase    │
│  (Express.js)   │     │  Storage     │
└────────┬────────┘     └──────────────┘
         │
         │ (Optional)
         ▼
   ┌──────────┐
   │  Redis   │
   │  Queue   │
   └──────────┘
```

## API Endpoints

The following endpoints are available:

- `POST /api/files/upload-url` - Get signed URL for upload
- `POST /api/files/confirm` - Confirm upload with processing
- `POST /api/files/upload-simple` - Simple upload without processing
- `POST /api/files/confirm-simple` - Confirm without processing
- `GET /api/files` - List user's files
- `GET /api/files/:id` - Get file details
- `DELETE /api/files/:id` - Delete file
- `GET /api/files/:id/download` - Download file

## Security Features

- ✅ **Row Level Security (RLS)**: Users can only access their own files
- ✅ **Signed URLs**: Time-limited upload URLs (1 hour expiry)
- ✅ **File validation**: Type and size validation
- ✅ **User quotas**: Storage limits per user
- ✅ **Secure deletion**: Files deleted from both DB and storage

## Support

If you encounter any issues:

1. Check the browser console for errors
2. Check the backend logs
3. Verify Supabase configuration
4. Ensure SQL schema is properly set up

The system is designed to work without Redis/FFmpeg - they are purely optional enhancements!
