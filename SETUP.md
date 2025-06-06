# Advanced TikTok Video Analyzer - Setup Guide

This guide will help you set up the advanced TikTok video analysis system that provides AI-powered insights including speech transcription, object detection, sentiment analysis, and optimization recommendations.

## 🔧 System Overview

The system consists of two analysis phases:
1. **Metadata Analysis** (existing) - Fast analysis of TikTok engagement metrics, duration patterns, etc.
2. **Video Analysis** (new) - Deep AI analysis using Google Cloud Video Intelligence and Claude AI

## 📋 Prerequisites

- Node.js 16+ and npm
- Google Cloud account with billing enabled
- Anthropic Claude API access
- Apify account
- yt-dlp installed on system (for video downloads)

## 🚀 Quick Start

1. **Clone and install dependencies:**
```bash
git clone https://github.com/TumiLabsJN/tiktok-competitor-analyzer
cd tiktok-competitor-analyzer
npm install
```

2. **Install yt-dlp (video downloader):**
```bash
# Ubuntu/Debian
sudo apt install yt-dlp

# macOS
brew install yt-dlp

# Windows
# Download from https://github.com/yt-dlp/yt-dlp/releases
```

3. **Configure environment:**
```bash
cp .env.example .env
# Edit .env with your API keys (see configuration section below)
```

4. **Start the server:**
```bash
npm start
```

## 🔐 Environment Configuration

### Required API Keys and Services

#### 1. Apify (TikTok Scraping)
```env
APIFY_TOKEN=your_apify_token_here
```
- Sign up at [apify.com](https://apify.com)
- Go to Settings > Integrations > API tokens
- Create new token and copy to `.env`

#### 2. Google Cloud Services (Video Analysis)
```env
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_KEY_FILE=path/to/service-account-key.json
GOOGLE_CLOUD_STORAGE_BUCKET=your-bucket-name
```

**Setup Steps:**
1. Create Google Cloud Project at [console.cloud.google.com](https://console.cloud.google.com)
2. Enable these APIs:
   - Cloud Storage API
   - Video Intelligence API
3. Create service account:
   - Go to IAM & Admin > Service Accounts
   - Create new service account
   - Grant roles: "Storage Admin", "Cloud Video Intelligence Admin"
   - Download JSON key file
4. Create Cloud Storage bucket:
   - Go to Cloud Storage > Buckets
   - Create bucket (remember the name for your .env)

#### 3. Claude API (AI Insights)
```env
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```
- Sign up at [console.anthropic.com](https://console.anthropic.com)
- Go to Settings > API Keys
- Create new key and copy to `.env`

### Optional Configuration

```env
# Server settings
PORT=3001
NODE_ENV=development

# Rate limiting (per 15 minutes)
RATE_LIMIT_MAX_REQUESTS=5

# Video analysis settings
VIDEO_ANALYSIS_TIMEOUT=300000  # 5 minutes
MAX_CONCURRENT_JOBS=3

# Content filtering
MIN_VIEWS_THRESHOLD=10000
ANALYSIS_DAYS=30
```

## 🎬 Video Analysis Features

### What Gets Analyzed
- **6 top videos**: 3 from last 30 days, 3 from 30-60 days ago
- **AI Processing**: 
  - Speech transcription and sentiment
  - Object/product/animal detection
  - Text overlay extraction
  - Hook effectiveness (first 3 seconds)
  - Visual trends and effects

### Output Sections
1. **Performance Snapshot** - Side-by-side video metrics
2. **Hook Analysis** - First 3-second effectiveness rating
3. **Brand Recognition** - Products, animals, themes detected
4. **Sentiment Analysis** - Tone and emotional cues
5. **Visual Trends** - Cuts, pace, effects used
6. **Optimization Suggestions** - AI-powered recommendations

## 🔄 How It Works

### Flow Diagram
```
User Input → Metadata Analysis (30s) → Display Results
                    ↓
            Background Video Analysis (2-5min)
                    ↓
            Progressive UI Updates → Final Insights
```

### API Endpoints

#### Existing Metadata Analysis
- `POST /api/tiktok/analyze` - Start analysis (now also triggers video analysis)
- `POST /api/analysis/videos` - Metadata processing

#### New Video Analysis
- `POST /api/video-analysis/start` - Start video analysis job
- `GET /api/video-analysis/status/:jobId` - Poll job status
- `GET /api/video-analysis/results/:jobId` - Get completed results
- `GET /api/video-analysis/health` - Service health check

### Processing Pipeline
1. **Video Selection**: Algorithm selects 6 best-performing videos
2. **Download**: Uses yt-dlp to download videos locally
3. **Upload**: Transfers to Google Cloud Storage
4. **AI Analysis**: Google Video Intelligence processes each video
5. **Claude Insights**: Claude analyzes results and generates recommendations
6. **Cleanup**: Removes temporary files and cloud objects

## 💰 Cost Estimation

Per profile analysis (6 videos):
- **Google Cloud Video Intelligence**: ~$1-2
- **Google Cloud Storage**: ~$0.01
- **Claude API**: ~$1-3
- **Total**: ~$3-6 per analysis

## 🚨 Troubleshooting

### Common Issues

#### "Video analysis failed to start"
- Check Google Cloud credentials and project ID
- Verify Video Intelligence API is enabled
- Ensure service account has proper permissions

#### "yt-dlp command not found"
```bash
# Install yt-dlp
pip install yt-dlp
# or
npm install -g yt-dlp
```

#### "Claude API error"
- Verify ANTHROPIC_API_KEY is correct
- Check account has sufficient credits
- Ensure API endpoint URL is correct

#### "Rate limit exceeded"
- Default limit: 5 analyses per 15 minutes
- Increase `RATE_LIMIT_MAX_REQUESTS` if needed
- Consider upgrading API plans for higher limits

### Debug Mode
```bash
NODE_ENV=development npm start
```
Enables detailed logging for troubleshooting.

### Health Checks
- Server: `GET /health`
- Video Analysis: `GET /api/video-analysis/health`

## 🔧 Development

### Project Structure
```
server/
├── services/
│   ├── TikTokService.js          # Existing metadata analysis
│   ├── MetadataAnalysisService.js # Existing insights generation
│   └── VideoAnalysisService.js   # New video analysis pipeline
├── routes/
│   ├── tiktok.js                 # Updated to trigger video analysis
│   ├── analysis.js               # Existing metadata routes
│   └── video-analysis.js         # New video analysis routes
public/
├── js/app.js                     # Updated with video analysis UI
└── css/styles.css                # Updated with video analysis styles
```

### Key Classes
- `VideoAnalysisService` - Main video processing pipeline
- `TumiLabsAnalyzer` - Frontend controller (updated)

### Security Features
- Rate limiting on all video analysis endpoints
- Input validation and sanitization
- Temporary file cleanup
- Secure API key handling

## 📚 API Documentation

### Start Video Analysis
```javascript
POST /api/video-analysis/start
{
  "videos": [...], // Array of video objects
  "username": "tiktok_handle"
}

Response:
{
  "success": true,
  "data": {
    "jobId": "abc123...",
    "status": "started",
    "estimatedTime": "2-5 minutes"
  }
}
```

### Check Status
```javascript
GET /api/video-analysis/status/abc123

Response:
{
  "success": true,
  "data": {
    "status": "running",
    "progress": 65,
    "phase": "ai_analysis",
    "message": "Analyzing video 3/6 with AI..."
  }
}
```

### Get Results
```javascript
GET /api/video-analysis/results/abc123

Response:
{
  "success": true,
  "data": {
    "results": {
      "videos": [...],
      "insights": {
        "hookAnalysis": {...},
        "brandRecognition": {...},
        "sentimentAnalysis": {...},
        "optimizationSuggestions": [...]
      }
    }
  }
}
```

## 🆘 Support

For technical support:
1. Check troubleshooting section above
2. Review server logs: `tail -f server.log`
3. Test individual components:
   - Metadata analysis: Works independently
   - Video analysis: Check `/api/video-analysis/health`

## 🔄 Updates

This system is modular and non-breaking:
- Existing metadata functionality unchanged
- Video analysis runs asynchronously in background
- UI gracefully handles missing video analysis data
- All new features are additive

The system maintains full backward compatibility while adding powerful new AI-driven insights to your TikTok competitor analysis workflow.