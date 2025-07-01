#!/usr/bin/env python3
"""
Run Claude prompts with rate limit protection
Handles long videos by chunking data and adding delays
"""

import os
import sys
import json
import time
from datetime import datetime
from run_claude_insight import ClaudeInsightRunner

# Initialize the runner
runner = ClaudeInsightRunner()

def estimate_token_count(data):
    """Rough estimate of tokens (1 token ≈ 4 characters)"""
    return len(json.dumps(data)) // 4

def truncate_timeline_for_prompt(timeline, max_entries=50):
    """Limit timeline entries to prevent token overflow"""
    if isinstance(timeline, dict) and len(timeline) > max_entries:
        # Take evenly spaced samples
        keys = sorted(timeline.keys(), key=lambda x: float(x))
        step = max(1, len(keys) // max_entries)
        sampled_keys = keys[::step]
        return {k: timeline[k] for k in sampled_keys}
    return timeline

def run_prompts_with_rate_limit_protection(video_id, delay_between_prompts=10):
    """Run prompts with intelligent rate limiting"""
    
    print(f"\n🤖 Running Claude Prompts for {video_id}")
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
        max_timeline_entries = 30
    else:
        max_timeline_entries = 50
    
    # Get available prompts
    prompt_templates_dir = 'prompt_templates'
    prompts = []
    if os.path.exists(prompt_templates_dir):
        for file in os.listdir(prompt_templates_dir):
            if file.endswith('.txt'):
                prompts.append(file.replace('.txt', ''))
    
    prompts = sorted(prompts)
    print(f"📝 Found {len(prompts)} prompts to run")
    print(f"⏱️  Delay between prompts: {delay_between_prompts}s")
    
    # Track results
    successful = 0
    failed = 0
    tokens_used = 0
    
    for i, prompt_name in enumerate(prompts, 1):
        print(f"\n[{i}/{len(prompts)}] Running: {prompt_name}")
        
        # Load prompt template
        with open(f'{prompt_templates_dir}/{prompt_name}.txt', 'r') as f:
            prompt_template = f.read()
        
        # Prepare context data (truncated for long videos)
        context_data = {
            'duration': duration,
            'caption': unified_data.get('static_metadata', {}).get('captionText', '')[:500],
            'engagement_stats': unified_data.get('static_metadata', {}).get('stats', {})
        }
        
        # Add timeline data based on prompt type
        timelines = unified_data.get('timelines', {})
        
        if prompt_name == 'hook_analysis':
            # Only first 5 seconds
            for key, timeline in timelines.items():
                filtered = {k: v for k, v in timeline.items() if float(k) <= 5}
                context_data[key] = truncate_timeline_for_prompt(filtered, 10)
                
        elif prompt_name in ['creative_density', 'engagement_triggers']:
            # Sample throughout video
            for key, timeline in timelines.items():
                context_data[key] = truncate_timeline_for_prompt(timeline, max_timeline_entries)
                
        else:
            # Minimal timeline data
            context_data['timeline_summary'] = {
                'object_count': len(timelines.get('objectTimeline', {})),
                'text_count': len(timelines.get('textOverlayTimeline', {})),
                'speech_count': len(timelines.get('speechTimeline', {}))
            }
        
        # Estimate tokens
        prompt_tokens = estimate_token_count(prompt_template + str(context_data))
        print(f"   Estimated tokens: ~{prompt_tokens}")
        
        # Extra delay if approaching limit
        if tokens_used + prompt_tokens > 35000:  # Leave buffer
            wait_time = 60
            print(f"   ⏳ Approaching rate limit - waiting {wait_time}s...")
            time.sleep(wait_time)
            tokens_used = 0
        
        try:
            # Run the prompt
            result = runner.run_claude_prompt(
                video_id=video_id,
                prompt_name=prompt_name,
                prompt_text=prompt_template,
                context_data=context_data
            )
            
            if result['success']:
                successful += 1
                tokens_used += prompt_tokens
                print(f"   ✅ Success")
            else:
                failed += 1
                print(f"   ❌ Failed: {result.get('error', 'Unknown error')}")
                
                # If rate limit error, wait longer
                if 'rate_limit' in str(result.get('error', '')):
                    print("   ⏳ Rate limit hit - waiting 60s...")
                    time.sleep(60)
                    tokens_used = 0
                    
        except Exception as e:
            failed += 1
            print(f"   ❌ Error: {str(e)}")
        
        # Delay between prompts
        if i < len(prompts):
            print(f"   ⏳ Waiting {delay_between_prompts}s...")
            time.sleep(delay_between_prompts)
    
    # Summary
    print(f"\n{'=' * 60}")
    print(f"📊 Summary for {video_id}:")
    print(f"   ✅ Successful: {successful}")
    print(f"   ❌ Failed: {failed}")
    print(f"   📊 Total: {len(prompts)}")
    
    if successful > 0:
        print(f"\n✅ Results saved in: insights/{video_id}/")


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 run_video_prompts_safe.py <video_id> [delay_seconds]")
        print("Example: python3 run_video_prompts_safe.py nutsnmore_7482131638315388203 15")
        sys.exit(1)
    
    video_id = sys.argv[1]
    delay = int(sys.argv[2]) if len(sys.argv) > 2 else 10
    
    run_prompts_with_rate_limit_protection(video_id, delay)


if __name__ == "__main__":
    main()