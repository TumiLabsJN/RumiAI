# RumiAI Frontend - Video Analysis Viewer

## Overview
This frontend displays the comprehensive analysis results for TikTok videos processed by the RumiAI system.

## Features

### Main Dashboard (`index_simple.html`)
- Lists all analyzed videos
- Shows key stats: views, likes, duration
- Displays analysis progress (X/15 prompts completed)
- Click any video to view detailed analysis

### Individual Video Pages
Each video has its own page showing:

1. **Video Information**
   - Username, caption, stats
   - Engagement metrics

2. **15 Analysis Tabs** (when available):
   - Hook Analysis
   - Engagement Triggers
   - CTA Alignment
   - Speech CTA Phrases
   - Creative Density
   - Emotional Arc
   - Scene Pacing
   - Person Framing
   - Speech Quantity
   - Speech Tone Expression
   - Sensory Mix
   - Brand/Product Timing
   - Engagement Tactics
   - Content Style
   - Audience Connection

3. **For Each Analysis Type**:
   - **Raw Data**: Timeline data from GVI, YOLO, MediaPipe, OCR
   - **Claude's Analysis**: AI interpretation of the raw data
   - **Prompt Used**: The exact prompt sent to Claude

## How to View

### Option 1: Python Server (Recommended)
```bash
python3 serve_frontend.py
```
This will:
- Start a local server on port 8080
- Automatically open your browser
- Navigate to the dashboard

### Option 2: Direct File Access
Open `frontend/index_simple.html` directly in your browser

### Option 3: Full Interactive Dashboard
Open `frontend/index.html` for the JavaScript-powered version

## Updating Data

To regenerate the frontend with latest analysis results:
```bash
python3 generate_frontend_data.py
```

This will:
- Scan all videos in the insights/ directory
- Extract analysis results and timelines
- Generate static HTML pages for each video
- Update the main index page

## Directory Structure
```
frontend/
├── index_simple.html    # Static dashboard (generated)
├── index.html          # Interactive dashboard
├── video-analysis.html # Template for video details
├── css/               # Stylesheets
├── js/                # JavaScript files
├── data/              # JSON data files
└── [video_id].html    # Individual video pages (generated)
```

## Data Sources

The frontend pulls data from:
- `insights/[video_id]/` - Claude analysis results
- `unified_analysis/[video_id].json` - Combined timeline data
- `downloads/analysis/[video_id]/` - Raw analysis results

## Key Timeline Data Displayed

### Object Timeline (YOLO + GVI)
- Objects detected in each frame
- Confidence scores
- Temporal progression

### Text Overlay Timeline (OCR + GVI)
- On-screen text at each timestamp
- Text confidence scores

### Speech Timeline (GVI)
- Transcribed speech
- Word-level timestamps

### Scene Change Timeline
- Cut points and transitions
- Scene complexity metrics

## Adding New Analysis Types

To add a new analysis type:
1. Add the prompt template to `prompt_templates/`
2. Run the analysis: `python3 run_claude_insight.py [video_id] [prompt_name]`
3. Regenerate frontend: `python3 generate_frontend_data.py`

The new analysis will automatically appear in the frontend!