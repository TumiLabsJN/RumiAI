#!/usr/bin/env python3
"""
Run Claude prompts with ML data validation
Ensures only real ML detection data is sent to Claude
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
    
    # Get timeline data - but validate it exists
    timeline = unified_data.get('timeline', {})
    
    if prompt_name == 'hook_analysis':
        # Extract only first 5 seconds of real data
        first_5_seconds = {}
        
        for timestamp, frame_data in timeline.items():
            try:
                # Parse timestamp (e.g., "0-1s" -> 0)
                time_val = float(timestamp.split('-')[0])
                if time_val <= 5:
                    # Only include actual detections
                    real_data = {}
                    if 'object_detections' in frame_data and frame_data['object_detections']:
                        real_data['objects'] = frame_data['object_detections']
                    if 'text_detections' in frame_data and frame_data['text_detections']:
                        real_data['texts'] = frame_data['text_detections']
                    if 'poses' in frame_data and frame_data['poses']:
                        real_data['poses'] = frame_data['poses']
                    
                    if real_data:
                        first_5_seconds[timestamp] = real_data
            except:
                continue
                
        context_data['first_5_seconds'] = first_5_seconds
        
    elif prompt_name == 'cta_alignment':
        # Extract text and speech data for CTA detection
        text_timeline = {}
        speech_timeline = {}
        
        for timestamp, frame_data in timeline.items():
            # Only include ACTUAL text detections
            if 'text_detections' in frame_data and frame_data['text_detections']:
                texts = []
                for text_item in frame_data['text_detections']:
                    if isinstance(text_item, dict) and 'text' in text_item:
                        texts.append({
                            'text': text_item['text'],
                            'confidence': text_item.get('confidence', 0),
                            'category': text_item.get('category', 'unknown')
                        })
                if texts:
                    text_timeline[timestamp] = texts
            
            # Include speech if available
            if 'speech' in frame_data and frame_data['speech']:
                speech_timeline[timestamp] = frame_data['speech']
        
        context_data['text_timeline'] = text_timeline
        context_data['speech_timeline'] = speech_timeline
        
    else:
        # For other prompts, include summary stats
        context_data['timeline_summary'] = {
            'total_frames': len(timeline),
            'object_detection_frames': sum(1 for f in timeline.values() if f.get('object_detections')),
            'text_detection_frames': sum(1 for f in timeline.values() if f.get('text_detections')),
            'pose_detection_frames': sum(1 for f in timeline.values() if f.get('poses')),
            'speech_frames': sum(1 for f in timeline.values() if f.get('speech'))
        }
    
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
                
                # If rate limit error, wait longer
                if 'rate_limit' in str(result.get('error', '')):
                    print("   ⏳ Rate limit hit - waiting 60s...")
                    time.sleep(60)
                    
        except Exception as e:
            failed += 1
            print(f"   ❌ Error: {str(e)}")
        
        # Delay between prompts
        if i < len(prompts):
            print(f"   ⏱️  Waiting {delay_between_prompts}s before next prompt...")
            time.sleep(delay_between_prompts)
    
    print(f"\n" + "=" * 60)
    print(f"📊 Summary for {video_id}:")
    print(f"   ✅ Successful: {successful}")
    print(f"   ❌ Failed: {failed}")
    print(f"   📊 Total prompts: {len(prompts)}")

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 run_video_prompts_validated.py <video_id>")
        print("\nExample:")
        print("  python3 run_video_prompts_validated.py cristiano_7515739984452701457")
        sys.exit(1)
    
    video_id = sys.argv[1]
    run_validated_prompts(video_id)

if __name__ == "__main__":
    main()