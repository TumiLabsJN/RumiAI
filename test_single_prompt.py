#!/usr/bin/env python3
"""Test single prompt with new extraction"""

import json
from run_video_prompts_validated_v2 import extract_real_ml_data
from run_claude_insight import ClaudeInsightRunner

video_id = "7372639293631679790"

# Load unified analysis
with open(f'unified_analysis/{video_id}.json', 'r') as f:
    unified_data = json.load(f)

# Test hook analysis extraction
print("Testing hook_analysis extraction...")
context_data = extract_real_ml_data(unified_data, 'hook_analysis')

print(f"\nContext keys: {list(context_data.keys())}")
print(f"\nFirst 5 seconds data points: {len(context_data.get('first_5_seconds', {}))}")

# Show sample data
first_5 = context_data.get('first_5_seconds', {})
for timestamp in sorted(list(first_5.keys()))[:2]:
    print(f"\n{timestamp}:")
    data = first_5[timestamp]
    if 'texts' in data:
        print(f"  - {len(data['texts'])} texts detected")
    if 'objects' in data:
        print(f"  - Objects: {list(data['objects'].keys())}")
    if 'gestures' in data:
        print(f"  - Gestures: {data['gestures']}")

# Test creative density extraction
print("\n\nTesting creative_density extraction...")
context_data = extract_real_ml_data(unified_data, 'creative_density')
print(f"Context keys: {list(context_data.keys())}")
if 'timeline_summary' in context_data:
    print("Timeline summary:", json.dumps(context_data['timeline_summary'], indent=2))