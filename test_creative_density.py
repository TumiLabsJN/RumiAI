#!/usr/bin/env python3
"""Test the creative density optimization"""

import json
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from run_video_prompts_validated_v2 import compute_creative_density_analysis

# Load a unified analysis file
video_id = '7520218160214183176'
unified_path = f'unified_analysis/{video_id}.json'

if not os.path.exists(unified_path):
    print(f"❌ Unified analysis not found: {unified_path}")
    sys.exit(1)

with open(unified_path, 'r') as f:
    unified_data = json.load(f)

timelines = unified_data.get('timelines', {})
duration = unified_data.get('duration_seconds', 0)

print(f"📹 Testing creative density for video {video_id}")
print(f"   Duration: {duration}s")
print(f"   Timeline sizes:")
print(f"   - Text: {len(timelines.get('textOverlayTimeline', {}))} entries")
print(f"   - Sticker: {len(timelines.get('stickerTimeline', {}))} entries") 
print(f"   - Object: {len(timelines.get('objectTimeline', {}))} entries")
print(f"   - Expression: {len(timelines.get('expressionTimeline', {}))} entries")
print(f"   - Gesture: {len(timelines.get('gestureTimeline', {}))} entries")

# Test the old way (full timelines)
old_way = {
    'gesture_timeline': timelines.get('gestureTimeline', {}),
    'expression_timeline': timelines.get('expressionTimeline', {}),
    'object_timeline': timelines.get('objectTimeline', {}),
    'text_timeline': timelines.get('textOverlayTimeline', {}),
    'sticker_timeline': timelines.get('stickerTimeline', {}),
    'scene_change_timeline': timelines.get('sceneChangeTimeline', {})
}

old_size = len(json.dumps(old_way))
print(f"\n📊 Old approach size: {old_size:,} bytes ({old_size/1024:.1f} KB)")

# Test the new way
new_way = compute_creative_density_analysis(timelines, duration)
new_size = len(json.dumps(new_way))
print(f"📊 New approach size: {new_size:,} bytes ({new_size/1024:.1f} KB)")
print(f"✅ Size reduction: {((old_size - new_size) / old_size * 100):.1f}%")

# Show the analysis
print(f"\n🔍 Creative Density Analysis:")
analysis = new_way['density_analysis']
print(f"   - Average density: {analysis['average_density']:.1f} elements/second")
print(f"   - Max density: {analysis['max_density']} elements/second")
print(f"   - Total creative elements: {analysis['total_creative_elements']}")
print(f"   - Patterns identified: {', '.join(analysis['patterns_identified']) or 'none'}")
print(f"   - Peak moments: {len(analysis['peak_moments'])}")

print(f"\n📈 Element distribution:")
for element_type, count in analysis['element_distribution'].items():
    if count > 0:
        print(f"   - {element_type}: {count}")

print(f"\n🎯 Top 3 peak moments:")
for i, peak in enumerate(analysis['peak_moments'][:3]):
    print(f"   {i+1}. {peak['timestamp']}: {peak['total_elements']} elements")
    breakdown = ', '.join([f"{k}:{v}" for k,v in peak['breakdown'].items() if v > 0])
    print(f"      Breakdown: {breakdown}")

# Save sample output
with open(f'creative_density_sample_{video_id}.json', 'w') as f:
    json.dump(new_way, f, indent=2)
print(f"\n💾 Saved sample output to creative_density_sample_{video_id}.json")