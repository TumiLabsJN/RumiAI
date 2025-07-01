#!/usr/bin/env python3
"""
View all insight results for a video in a formatted way
"""

import os
import glob
import json
from datetime import datetime

def load_latest_result(video_id, prompt_name):
    """Load the most recent result for a prompt"""
    pattern = f"insights/{video_id}/{prompt_name}/{prompt_name}_result_*.txt"
    files = glob.glob(pattern)
    
    if not files:
        return None
    
    # Get most recent file
    latest_file = max(files, key=os.path.getctime)
    
    with open(latest_file, 'r', encoding='utf-8') as f:
        return f.read()

def view_all_insights(video_id):
    """Display all insights for a video"""
    
    # Dynamically detect all prompts
    video_dir = f"insights/{video_id}"
    prompts = []
    
    if os.path.exists(video_dir):
        for item in os.listdir(video_dir):
            item_path = os.path.join(video_dir, item)
            # Skip non-directories and special folders
            if os.path.isdir(item_path) and item != 'reports' and not item.startswith('.'):
                prompts.append(item)
    
    prompts.sort()  # Sort alphabetically for consistent display
    
    # Display names
    display_names = {
        'hook_analysis': '🎣 Hook Analysis',
        'cta_alignment': '📢 CTA Alignment',
        'creative_density': '🎨 Creative Density',
        'emotional_arc': '😊 Emotional Arc',
        'scene_pacing': '⏱️ Scene Pacing',
        'person_framing': '👤 Person Framing',
        'sticker_overlay': '✨ Sticker & Overlay',
        'speech_cta_phrases': '🗣️ Speech CTAs',
        'engagement_triggers': '🎯 Engagement Triggers',
        'speech_quantity': '📊 Speech Quantity',
        'speech_tone_expression': '🎭 Speech Tone',
        'visual_audio_balance': '🌈 Visual/Audio Balance',
        'weaknesses_detection': '⚠️ Weaknesses Detection',
        'competitive_benchmark': '🏆 Competitive Benchmark'
    }
    
    print(f"\n{'='*80}")
    print(f"📹 INSIGHT RESULTS FOR VIDEO: {video_id}")
    print(f"{'='*80}\n")
    
    # Check metadata
    metadata_path = f"insights/{video_id}/metadata.json"
    if os.path.exists(metadata_path):
        with open(metadata_path, 'r') as f:
            metadata = json.load(f)
            completion_rate = metadata.get('completionRate', 0)
            print(f"📊 Completion Rate: {completion_rate:.1f}%")
            print(f"🕐 Last Updated: {metadata.get('lastUpdated', 'N/A')}")
            print(f"\n{'='*80}\n")
    
    # Display each insight
    for i, prompt_name in enumerate(prompts, 1):
        print(f"\n[{i}/{len(prompts)}] {display_names.get(prompt_name, prompt_name)}")
        print("-" * 60)
        
        result = load_latest_result(video_id, prompt_name)
        
        if result:
            # Try to parse as JSON for better formatting
            try:
                # Look for JSON in the response
                import re
                json_match = re.search(r'\{[\s\S]*\}', result)
                if json_match:
                    parsed = json.loads(json_match.group())
                    print(json.dumps(parsed, indent=2))
                else:
                    # Display first 500 chars if not JSON
                    if len(result) > 500:
                        print(result[:500] + "...")
                        print(f"\n[Truncated - Full result is {len(result)} characters]")
                    else:
                        print(result)
            except:
                # If JSON parsing fails, show raw text
                if len(result) > 500:
                    print(result[:500] + "...")
                    print(f"\n[Truncated - Full result is {len(result)} characters]")
                else:
                    print(result)
        else:
            print("❌ No results found")
        
        print()
    
    # Show report location
    print(f"\n{'='*80}")
    print("📄 FULL REPORTS")
    print(f"{'='*80}")
    
    report_files = glob.glob(f"insights/{video_id}/reports/*.md")
    if report_files:
        print("\nMarkdown reports:")
        for report in sorted(report_files):
            print(f"  📝 {report}")
    
    json_reports = glob.glob(f"insights/{video_id}/reports/*.json")
    if json_reports:
        print("\nJSON reports:")
        for report in sorted(json_reports):
            print(f"  📊 {report}")

def view_single_insight(video_id, prompt_name):
    """View a single insight in full"""
    result = load_latest_result(video_id, prompt_name)
    
    if result:
        print(f"\n{'='*80}")
        print(f"📹 {prompt_name.upper()} for {video_id}")
        print(f"{'='*80}\n")
        print(result)
    else:
        print(f"❌ No results found for {prompt_name}")

def list_videos_with_insights():
    """List all videos that have insights"""
    insights_dir = "insights"
    
    if not os.path.exists(insights_dir):
        print("No insights directory found")
        return []
    
    videos = []
    for item in os.listdir(insights_dir):
        if os.path.isdir(os.path.join(insights_dir, item)):
            metadata_path = os.path.join(insights_dir, item, "metadata.json")
            if os.path.exists(metadata_path):
                with open(metadata_path, 'r') as f:
                    metadata = json.load(f)
                    videos.append({
                        'id': item,
                        'completion': metadata.get('completionRate', 0),
                        'updated': metadata.get('lastUpdated', 'N/A')
                    })
    
    return videos

def main():
    import sys
    
    if len(sys.argv) < 2:
        # List all videos
        print("\n📹 Videos with insights:")
        print("-" * 40)
        
        videos = list_videos_with_insights()
        for video in videos:
            print(f"  {video['id']} - {video['completion']:.1f}% complete")
        
        print(f"\n💡 Usage:")
        print(f"   python3 view_insight_results.py <video_id>              # View all insights")
        print(f"   python3 view_insight_results.py <video_id> <prompt>     # View specific insight")
        print(f"\n📋 Available prompts:")
        prompts = ['hook_analysis', 'cta_alignment', 'creative_density', 'emotional_arc',
                  'scene_pacing', 'person_framing', 'sticker_overlay', 'speech_cta_phrases',
                  'engagement_triggers', 'speech_quantity', 'speech_tone_expression',
                  'visual_audio_balance', 'weaknesses_detection', 'competitive_benchmark']
        for p in prompts:
            print(f"   - {p}")
        return
    
    video_id = sys.argv[1]
    
    if len(sys.argv) > 2:
        # View specific insight
        prompt_name = sys.argv[2]
        view_single_insight(video_id, prompt_name)
    else:
        # View all insights
        view_all_insights(video_id)

if __name__ == "__main__":
    main()