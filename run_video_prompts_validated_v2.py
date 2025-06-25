#!/usr/bin/env python3
"""
Run Claude prompts with ML data validation - Version 2
Fixed to properly extract timeline data from unified analysis
"""

import os
import sys
import json
import time
from datetime import datetime
from run_claude_insight import ClaudeInsightRunner

# Initialize the runner
runner = ClaudeInsightRunner()

def validate_ml_data(data, prompt_name):
    """Validate that ML data is real and not fabricated"""
    issues = []
    
    # Check for suspicious patterns
    suspicious_patterns = [
        "link in bio",
        "swipe up", 
        "tap here",
        "click link"
    ]
    
    def check_for_patterns(obj, path=""):
        """Recursively check for suspicious patterns"""
        if isinstance(obj, dict):
            for key, value in obj.items():
                check_for_patterns(value, f"{path}.{key}")
        elif isinstance(obj, list):
            for i, item in enumerate(obj):
                check_for_patterns(item, f"{path}[{i}]")
        elif isinstance(obj, str):
            for pattern in suspicious_patterns:
                if pattern.lower() in obj.lower():
                    issues.append(f"Suspicious pattern '{pattern}' found at {path}: {obj}")
    
    check_for_patterns(data)
    return issues

def parse_timestamp_to_seconds(timestamp):
    """Convert timestamp like '0-1s' to start second"""
    try:
        return int(timestamp.split('-')[0])
    except:
        return None

def extract_real_ml_data(unified_data, prompt_name):
    """Extract only real ML detection data for a specific prompt"""
    
    context_data = {
        'duration': unified_data.get('duration_seconds', 0),
        'caption': unified_data.get('static_metadata', {}).get('captionText', '')[:500],
        'engagement_stats': unified_data.get('static_metadata', {}).get('stats', {}),
        '_validation': {
            'extracted_at': datetime.now().isoformat(),
            'prompt_type': prompt_name,
            'data_source': 'unified_analysis'
        }
    }
    
    # Get timelines data - note the plural!
    timelines = unified_data.get('timelines', {})
    
    if prompt_name == 'hook_analysis':
        # Extract first 5 seconds from all relevant timelines
        first_5_seconds = {}
        
        # Check gesture timeline
        for timestamp, data in timelines.get('gestureTimeline', {}).items():
            seconds = parse_timestamp_to_seconds(timestamp)
            if seconds is not None and seconds < 5:
                if timestamp not in first_5_seconds:
                    first_5_seconds[timestamp] = {}
                first_5_seconds[timestamp]['gestures'] = data.get('gestures', [])
        
        # Check expression timeline
        for timestamp, data in timelines.get('expressionTimeline', {}).items():
            seconds = parse_timestamp_to_seconds(timestamp)
            if seconds is not None and seconds < 5:
                if timestamp not in first_5_seconds:
                    first_5_seconds[timestamp] = {}
                first_5_seconds[timestamp]['expression'] = data.get('expression', '')
        
        # Check object timeline
        for timestamp, data in timelines.get('objectTimeline', {}).items():
            seconds = parse_timestamp_to_seconds(timestamp)
            if seconds is not None and seconds < 5:
                if timestamp not in first_5_seconds:
                    first_5_seconds[timestamp] = {}
                first_5_seconds[timestamp]['objects'] = data.get('objects', {})
        
        # Check text overlay timeline
        for timestamp, data in timelines.get('textOverlayTimeline', {}).items():
            seconds = parse_timestamp_to_seconds(timestamp)
            if seconds is not None and seconds < 5:
                if timestamp not in first_5_seconds:
                    first_5_seconds[timestamp] = {}
                first_5_seconds[timestamp]['texts'] = data.get('texts', [])
        
        # Check speech timeline
        for timestamp, data in timelines.get('speechTimeline', {}).items():
            seconds = parse_timestamp_to_seconds(timestamp)
            if seconds is not None and seconds < 5:
                if timestamp not in first_5_seconds:
                    first_5_seconds[timestamp] = {}
                first_5_seconds[timestamp]['speech'] = data.get('text', '')
        
        # Check scene changes
        for timestamp, data in timelines.get('sceneChangeTimeline', {}).items():
            seconds = parse_timestamp_to_seconds(timestamp)
            if seconds is not None and seconds < 5:
                if timestamp not in first_5_seconds:
                    first_5_seconds[timestamp] = {}
                first_5_seconds[timestamp]['scene_change'] = data
                
        context_data['first_5_seconds'] = first_5_seconds
        
    elif prompt_name == 'cta_alignment':
        # Extract text and speech data for CTA detection
        context_data['text_timeline'] = timelines.get('textOverlayTimeline', {})
        context_data['speech_timeline'] = timelines.get('speechTimeline', {})
        
    elif prompt_name == 'creative_density':
        # Include all timeline data for density analysis
        context_data['gesture_timeline'] = timelines.get('gestureTimeline', {})
        context_data['expression_timeline'] = timelines.get('expressionTimeline', {})
        context_data['object_timeline'] = timelines.get('objectTimeline', {})
        context_data['text_timeline'] = timelines.get('textOverlayTimeline', {})
        context_data['sticker_timeline'] = timelines.get('stickerTimeline', {})
        context_data['scene_change_timeline'] = timelines.get('sceneChangeTimeline', {})
        
        # Add summary stats
        context_data['timeline_summary'] = {
            'total_frames': unified_data.get('total_frames', 0),
            'gesture_count': len(timelines.get('gestureTimeline', {})),
            'expression_count': len(timelines.get('expressionTimeline', {})),
            'object_detection_frames': len(timelines.get('objectTimeline', {})),
            'text_detection_frames': len(timelines.get('textOverlayTimeline', {})),
            'sticker_frames': len(timelines.get('stickerTimeline', {})),
            'scene_changes': len(timelines.get('sceneChangeTimeline', {}))
        }
        
    elif prompt_name == 'emotional_arc':
        # Include expression and gesture data
        context_data['expression_timeline'] = timelines.get('expressionTimeline', {})
        context_data['gesture_timeline'] = timelines.get('gestureTimeline', {})
        context_data['speech_timeline'] = timelines.get('speechTimeline', {})
        
    elif prompt_name == 'scene_pacing':
        # Include scene change and camera distance data
        context_data['scene_change_timeline'] = timelines.get('sceneChangeTimeline', {})
        context_data['camera_distance_timeline'] = timelines.get('cameraDistanceTimeline', {})
        context_data['object_timeline'] = timelines.get('objectTimeline', {})
        
    elif prompt_name == 'gesture_effectiveness':
        # Include gesture and expression data
        context_data['gesture_timeline'] = timelines.get('gestureTimeline', {})
        context_data['expression_timeline'] = timelines.get('expressionTimeline', {})
        context_data['camera_distance_timeline'] = timelines.get('cameraDistanceTimeline', {})
        
    elif prompt_name == 'text_hook_quality':
        # Include text overlay data
        context_data['text_timeline'] = timelines.get('textOverlayTimeline', {})
        context_data['sticker_timeline'] = timelines.get('stickerTimeline', {})
        
    elif prompt_name == 'ocr_text_classification':
        # Include text overlay timeline for OCR classification
        context_data['textOverlayTimeline'] = timelines.get('textOverlayTimeline', {})
        
    elif prompt_name == 'music_sync':
        # Include audio ratio timeline
        context_data['audio_ratio_timeline'] = timelines.get('audioRatioTimeline', {})
        context_data['scene_change_timeline'] = timelines.get('sceneChangeTimeline', {})
        context_data['gesture_timeline'] = timelines.get('gestureTimeline', {})
        
    else:
        # For other prompts, include relevant summary stats
        context_data['timeline_summary'] = {
            'total_frames': unified_data.get('total_frames', 0),
            'gesture_count': len(timelines.get('gestureTimeline', {})),
            'expression_count': len(timelines.get('expressionTimeline', {})),
            'object_detection_frames': len(timelines.get('objectTimeline', {})),
            'text_detection_frames': len(timelines.get('textOverlayTimeline', {})),
            'speech_segments': len(timelines.get('speechTimeline', {})),
            'scene_changes': len(timelines.get('sceneChangeTimeline', {}))
        }
        
        # Add insights if available
        if 'insights' in unified_data:
            context_data['insights'] = unified_data['insights']
    
    # Validate the extracted data
    validation_issues = validate_ml_data(context_data, prompt_name)
    if validation_issues:
        print(f"   ⚠️  Validation warnings:")
        for issue in validation_issues:
            print(f"      - {issue}")
    
    return context_data

def run_validated_prompts(video_id, delay_between_prompts=10):
    """Run prompts with ML data validation"""
    
    print(f"\n🤖 Running Validated Claude Prompts for {video_id}")
    print("=" * 60)
    
    # Load unified analysis
    unified_path = f'unified_analysis/{video_id}.json'
    if not os.path.exists(unified_path):
        print(f"❌ Unified analysis not found: {unified_path}")
        return
    
    with open(unified_path, 'r') as f:
        unified_data = json.load(f)
    
    # Check video duration
    duration = unified_data.get('duration_seconds', 0)
    print(f"📹 Video duration: {duration}s")
    
    # Adjust strategy based on video length
    if duration > 30:
        print("⚠️  Long video detected - using conservative rate limiting")
        delay_between_prompts = max(delay_between_prompts, 15)
    
    # Get available prompts
    prompt_templates_dir = 'prompt_templates'
    prompts = []
    if os.path.exists(prompt_templates_dir):
        for file in os.listdir(prompt_templates_dir):
            if file.endswith('.txt'):
                prompts.append(file.replace('.txt', ''))
    
    prompts = sorted(prompts)
    print(f"📝 Found {len(prompts)} prompts to run")
    
    # Track results
    successful = 0
    failed = 0
    
    for i, prompt_name in enumerate(prompts, 1):
        print(f"\n[{i}/{len(prompts)}] Processing: {prompt_name}")
        
        # Load prompt template
        with open(f'{prompt_templates_dir}/{prompt_name}.txt', 'r') as f:
            prompt_template = f.read()
        
        # Extract and validate ML data
        print("   🔍 Extracting validated ML data...")
        context_data = extract_real_ml_data(unified_data, prompt_name)
        
        print(f"   📊 Context includes: {', '.join(context_data.keys())}")
        
        # Show data preview for first 5 seconds (for hook analysis)
        if prompt_name == 'hook_analysis' and 'first_5_seconds' in context_data:
            print(f"   📊 First 5 seconds data: {len(context_data['first_5_seconds'])} timestamps")
        
        try:
            # Run the prompt with validated data
            result = runner.run_claude_prompt(
                video_id=video_id,
                prompt_name=prompt_name,
                prompt_text=prompt_template,
                context_data=context_data
            )
            
            if result['success']:
                successful += 1
                print(f"   ✅ Success")
            else:
                failed += 1
                print(f"   ❌ Failed: {result.get('error', 'Unknown error')}")
                
        except Exception as e:
            failed += 1
            print(f"   ❌ Exception: {str(e)}")
        
        # Delay between prompts
        if i < len(prompts):
            print(f"   ⏳ Waiting {delay_between_prompts}s before next prompt...")
            time.sleep(delay_between_prompts)
    
    # Summary
    print("\n" + "=" * 60)
    print(f"✅ Successful: {successful}")
    print(f"❌ Failed: {failed}")
    print(f"📊 Total: {len(prompts)}")
    
    return {
        'total': len(prompts),
        'successful': successful,
        'failed': failed
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python run_video_prompts_validated_v2.py <video_id>")
        sys.exit(1)
    
    video_id = sys.argv[1]
    run_validated_prompts(video_id)