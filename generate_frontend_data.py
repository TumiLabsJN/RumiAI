#!/usr/bin/env python3
"""
Generate frontend data files from analysis results
"""

import json
import os
from pathlib import Path
from datetime import datetime


def load_json_safely(filepath):
    """Load JSON file safely"""
    try:
        with open(filepath, 'r') as f:
            return json.load(f)
    except:
        return None


def generate_video_data():
    """Generate data for all analyzed videos"""
    videos = []
    
    # Check insights directory for analyzed videos
    insights_dir = Path('insights')
    if not insights_dir.exists():
        print("No insights directory found")
        return
    
    for video_dir in insights_dir.iterdir():
        if not video_dir.is_dir():
            continue
            
        video_id = video_dir.name
        print(f"\nProcessing {video_id}...")
        
        # Load metadata
        metadata_path = video_dir / 'metadata.json'
        metadata = load_json_safely(metadata_path) or {}
        
        # Load unified analysis
        unified_path = Path(f'unified_analysis/{video_id}.json')
        unified_data = load_json_safely(unified_path) or {}
        
        # Count completed prompts
        completed_prompts = 0
        prompt_results = {}
        
        # Get all prompt folders
        for prompt_dir in video_dir.iterdir():
            if prompt_dir.is_dir() and prompt_dir.name != 'reports':
                prompt_name = prompt_dir.name
                
                # Look for complete analysis files
                complete_files = list(prompt_dir.glob('*_complete_*.json'))
                if complete_files:
                    completed_prompts += 1
                    
                    # Load the most recent complete file
                    latest_file = max(complete_files, key=lambda x: x.stat().st_mtime)
                    result_data = load_json_safely(latest_file)
                    
                    if result_data:
                        prompt_results[prompt_name] = {
                            'prompt': result_data.get('prompt', ''),
                            'response': result_data.get('response', ''),
                            'timestamp': result_data.get('timestamp', ''),
                            'model': result_data.get('model', 'claude-3-5-sonnet-20241022')
                        }
        
        # Extract video info
        static_meta = unified_data.get('static_metadata', {})
        stats = static_meta.get('stats', {})
        
        video_info = {
            'id': video_id,
            'username': static_meta.get('author', {}).get('name', video_id.split('_')[0]),
            'videoId': video_id.split('_')[1] if '_' in video_id else video_id,
            'title': static_meta.get('captionText', 'No title')[:100],
            'caption': static_meta.get('captionText', ''),
            'views': stats.get('views', 0),
            'likes': stats.get('likes', 0),
            'comments': stats.get('comments', 0),
            'shares': stats.get('shares', 0),
            'duration': unified_data.get('duration_seconds', 0),
            'analysisComplete': completed_prompts > 0,
            'promptsCompleted': completed_prompts,
            'promptResults': prompt_results,
            'timelines': unified_data.get('timelines', {}),
            'insights': unified_data.get('insights', {}),
            'timeline_counts': {
                'objects': len(unified_data.get('timelines', {}).get('objectTimeline', {})),
                'text': len(unified_data.get('timelines', {}).get('textOverlayTimeline', {})),
                'speech': len(unified_data.get('timelines', {}).get('speechTimeline', {}))
            }
        }
        
        videos.append(video_info)
        
        # Save individual video data file
        video_data_path = Path(f'frontend/data/{video_id}.json')
        video_data_path.parent.mkdir(exist_ok=True)
        
        with open(video_data_path, 'w') as f:
            json.dump(video_info, f, indent=2)
        
        print(f"  ✅ Saved data for {video_id}")
        print(f"     - {completed_prompts} prompts completed")
        print(f"     - {video_info['views']} views, {video_info['likes']} likes")
    
    # Save master video list
    video_list = {
        'videos': videos,
        'generated_at': datetime.now().isoformat(),
        'total_videos': len(videos)
    }
    
    with open('frontend/data/videos.json', 'w') as f:
        json.dump(video_list, f, indent=2)
    
    print(f"\n✅ Generated frontend data for {len(videos)} videos")
    print(f"   Saved to: frontend/data/")
    
    # Generate index.html with links
    generate_index_html(videos)


def generate_index_html(videos):
    """Generate an index.html file that loads actual data"""
    
    html_content = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RumiAI Video Analysis Results</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        h1 {
            color: #2c3e50;
            text-align: center;
            margin-bottom: 30px;
        }
        .video-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
        }
        .video-card {
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .video-card h3 {
            color: #3498db;
            margin-bottom: 10px;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
            margin: 15px 0;
        }
        .stat {
            background: #f8f9fa;
            padding: 10px;
            border-radius: 5px;
            text-align: center;
        }
        .stat-label {
            font-size: 12px;
            color: #7f8c8d;
        }
        .stat-value {
            font-size: 18px;
            font-weight: bold;
            color: #2c3e50;
        }
        .view-btn {
            background: #3498db;
            color: white;
            padding: 10px 20px;
            text-decoration: none;
            border-radius: 5px;
            display: inline-block;
            margin-top: 10px;
        }
        .view-btn:hover {
            background: #2980b9;
        }
    </style>
</head>
<body>
    <h1>RumiAI Video Analysis Results</h1>
    <div class="video-grid">
'''
    
    for video in videos:
        engagement_rate = (video['likes'] / max(video['views'], 1) * 100) if video['views'] > 0 else 0
        
        html_content += f'''
        <div class="video-card">
            <h3>@{video['username']}</h3>
            <p>{video['title']}</p>
            <div class="stats">
                <div class="stat">
                    <div class="stat-label">Views</div>
                    <div class="stat-value">{video['views']:,}</div>
                </div>
                <div class="stat">
                    <div class="stat-label">Likes</div>
                    <div class="stat-value">{video['likes']:,}</div>
                </div>
                <div class="stat">
                    <div class="stat-label">Duration</div>
                    <div class="stat-value">{video['duration']}s</div>
                </div>
                <div class="stat">
                    <div class="stat-label">Prompts</div>
                    <div class="stat-value">{video['promptsCompleted']}/15</div>
                </div>
            </div>
            <a href="{video['id']}.html" class="view-btn">View Analysis →</a>
        </div>
'''
    
    html_content += '''
    </div>
</body>
</html>
'''
    
    with open('frontend/index_simple.html', 'w') as f:
        f.write(html_content)
    
    # Generate individual video pages
    for video in videos:
        generate_video_page(video)


def generate_video_page(video):
    """Generate individual video analysis page"""
    
    html_content = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{video['username']} - Video Analysis</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }}
        .header {{
            background: white;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 20px;
        }}
        .tabs {{
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-bottom: 20px;
            background: white;
            padding: 20px;
            border-radius: 10px;
        }}
        .tab {{
            padding: 10px 20px;
            background: #ecf0f1;
            border: none;
            border-radius: 5px;
            cursor: pointer;
        }}
        .tab.active {{
            background: #3498db;
            color: white;
        }}
        .content {{
            background: white;
            padding: 20px;
            border-radius: 10px;
        }}
        .section {{
            margin-bottom: 30px;
        }}
        .section h3 {{
            color: #2c3e50;
            margin-bottom: 15px;
        }}
        .data-box {{
            background: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            font-family: monospace;
            overflow-x: auto;
            white-space: pre-wrap;
        }}
        .back-link {{
            color: #3498db;
            text-decoration: none;
            margin-bottom: 20px;
            display: inline-block;
        }}
    </style>
</head>
<body>
    <a href="index_simple.html" class="back-link">← Back to all videos</a>
    
    <div class="header">
        <h1>@{video['username']} - Video Analysis</h1>
        <p>{video['caption'][:200]}...</p>
        <p><strong>Stats:</strong> {video['views']:,} views, {video['likes']:,} likes, {video['duration']}s duration</p>
    </div>
    
    <div class="tabs">
'''
    
    # Add tabs for each completed prompt
    for prompt_name in sorted(video['promptResults'].keys()):
        html_content += f'<button class="tab" onclick="showTab(\'{prompt_name}\')">{prompt_name.replace("_", " ").title()}</button>\n'
    
    html_content += '''
    </div>
    
    <div class="content">
'''
    
    # Add content for each prompt
    for prompt_name, result in video['promptResults'].items():
        html_content += f'''
        <div id="{prompt_name}" class="tab-content" style="display: none;">
            <div class="section">
                <h3>📊 Raw Data (YOLO, MediaPipe, OCR, PySceneDetect)</h3>
                <div class="data-box">{json.dumps(get_relevant_timeline_data(video, prompt_name), indent=2)}</div>
            </div>
            
            <div class="section">
                <h3>🤖 Claude's Analysis</h3>
                <div class="data-box">{result.get('response', 'No analysis available')}</div>
            </div>
            
            <div class="section">
                <h3>📝 Prompt Used</h3>
                <div class="data-box">{result.get('prompt', 'No prompt available')}</div>
            </div>
        </div>
'''
    
    html_content += '''
    </div>
    
    <script>
        function showTab(tabName) {
            // Hide all tabs
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.style.display = 'none';
            });
            
            // Remove active class from all buttons
            document.querySelectorAll('.tab').forEach(btn => {
                btn.classList.remove('active');
            });
            
            // Show selected tab
            document.getElementById(tabName).style.display = 'block';
            
            // Add active class to clicked button
            event.target.classList.add('active');
        }
        
        // Show first tab by default
        document.addEventListener('DOMContentLoaded', () => {
            const firstTab = document.querySelector('.tab');
            if (firstTab) {
                firstTab.click();
            }
        });
    </script>
</body>
</html>
'''
    
    with open(f'frontend/{video["id"]}.html', 'w') as f:
        f.write(html_content)


def get_relevant_timeline_data(video, prompt_name):
    """Get relevant timeline data for a specific prompt type"""
    timelines = video.get('timelines', {})
    
    if 'hook' in prompt_name:
        # Return first 3-5 seconds of data
        return {
            'first_3_seconds': {
                'objects': dict(list(timelines.get('objectTimeline', {}).items())[:5]),
                'text': dict(list(timelines.get('textOverlayTimeline', {}).items())[:3]),
                'scenes': dict(list(timelines.get('sceneChangeTimeline', {}).items())[:2])
            }
        }
    elif 'speech' in prompt_name:
        return {
            'speech_data': timelines.get('speechTimeline', {}),
            'audio_levels': timelines.get('audioRatioTimeline', {})
        }
    elif 'creative' in prompt_name:
        return {
            'all_objects': timelines.get('objectTimeline', {}),
            'all_text': timelines.get('textOverlayTimeline', {}),
            'creative_metrics': video.get('insights', {})
        }
    else:
        # Return all timeline data
        return timelines


def main():
    print("🚀 Generating frontend data files...")
    generate_video_data()
    print("\n✅ Frontend generation complete!")
    print("   View results at: frontend/index_simple.html")


if __name__ == "__main__":
    main()