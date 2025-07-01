# RumiAI Complete Dynamic Video Analysis Flow

## Overview
The RumiAI system now supports fully dynamic video analysis for any TikTok video URL. The system has been upgraded to handle videos of any size (tested up to 4MB) and runs a comprehensive analysis pipeline.

## Complete Flow Command
```bash
node rumiai_complete_flow.js <TikTok Video URL>
```

### Example:
```bash
node rumiai_complete_flow.js https://www.tiktok.com/@username/video/1234567890
```

## What the Complete Flow Does

1. **Scrapes Video Metadata** - Uses Apify to get video details, stats, and download URL
2. **Downloads Video File** - Downloads the actual video to local storage
3. **Starts Google Video Intelligence** - Uploads to GCS and runs async analysis
4. **Runs Local Analysis** - YOLO object detection, OCR, audio extraction
5. **Generates Unified Timeline** - Combines all data sources into one timeline
6. **Creates Insight Folders** - Sets up folder structure for Claude prompts
7. **Runs Claude Prompts** - Executes all AI analysis prompts (if API key present)
8. **Generates Reports** - Creates comprehensive analysis reports

## Key Improvements Made

### 1. Dynamic Metadata Schema
- Removed hardcoded 15-prompt limit
- Automatically detects all prompt folders
- Calculates completion rates dynamically

### 2. Asynchronous GVI Processing
- Handles terminal 2-minute timeout limits
- Runs GVI analysis in background
- Check status with: `node check_gvi_results.js`

### 3. Unified Timeline Assembly
- Combines multiple data sources:
  - TikTok metadata
  - Google Video Intelligence (objects, text, speech)
  - Local YOLO analysis
  - OCR text detection
  - Audio analysis
- Generates comprehensive timeline with all events

### 4. Complete Claude Integration
- Runs all prompts with full context
- Handles API key from .env file
- Saves results in organized folders

## Directory Structure
```
RumiAI/
├── downloads/
│   ├── videos/          # Downloaded video files
│   └── analysis/        # Analysis results (YOLO, GVI, etc.)
├── unified_analysis/    # Combined timeline data
├── insights/            # Claude prompt results
├── outputs/             # Temporary files
└── temp/               # Apify metadata
```

## Running Individual Steps

### Check GVI Status
```bash
node check_gvi_results.js
```

### Update Unified Analysis
```bash
python3 update_unified_analysis.py <video_id>
```

### Run Claude Prompts
```bash
python3 run_all_video_prompts.py <video_id>
```

### View Results
```bash
python3 view_insight_results.py <video_id>
```

## Important Notes

1. **VPN Issues**: Disable VPN when running - it can cause GCS upload timeouts
2. **API Keys Required**: 
   - Set `ANTHROPIC_API_KEY` in `.env` for Claude prompts
   - Google Cloud credentials in `wif-credential.json`
3. **Video Size**: Tested successfully with videos up to 4MB
4. **No Mock Data**: System only uses real data - never creates mock/fake data

## Tested Videos
- ✅ nutsnmore_7462841470299606318 (1.2MB) - Complete
- ✅ healthandwellnessliving_7514038807142894879 (2.5MB) - Complete
- ✅ latstrisomeprotein_7197152431958986026 - Complete

## Next Steps for New Videos
1. Run: `node rumiai_complete_flow.js <URL>`
2. Wait for completion (or check GVI status if timeout)
3. View results in `insights/<video_id>/` folder