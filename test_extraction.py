#!/usr/bin/env python3
"""Test timeline extraction"""

import json
import sys

video_id = sys.argv[1] if len(sys.argv) > 1 else "7372639293631679790"

# Load unified analysis
with open(f'unified_analysis/{video_id}.json', 'r') as f:
    unified_data = json.load(f)

# Check structure
print("Top-level keys:", list(unified_data.keys()))
print("\nTimelines available:", list(unified_data.get('timelines', {}).keys()))

# Check first 5 seconds of text overlay
text_timeline = unified_data.get('timelines', {}).get('textOverlayTimeline', {})
print(f"\nText overlay timeline entries: {len(text_timeline)}")

first_5_seconds = {}
for timestamp, data in text_timeline.items():
    try:
        seconds = int(timestamp.split('-')[0])
        if seconds < 5:
            first_5_seconds[timestamp] = {
                'text_count': len(data.get('texts', [])),
                'texts': [t.get('text', '') for t in data.get('texts', [])][:3]  # First 3 texts
            }
    except:
        pass

print(f"\nFirst 5 seconds text data:")
for ts, data in sorted(first_5_seconds.items()):
    print(f"  {ts}: {data['text_count']} texts - {data['texts']}")

# Check gestures
gesture_timeline = unified_data.get('timelines', {}).get('gestureTimeline', {})
print(f"\nGesture timeline entries: {len(gesture_timeline)}")
for ts, data in list(gesture_timeline.items())[:3]:
    print(f"  {ts}: {data}")