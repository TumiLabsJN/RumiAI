#!/usr/bin/env python3
"""Test what CTA alignment data is actually sent for nutsnmore video."""

import json
import sys
from services.ml_data_validator import MLDataValidator

def test_cta_data():
    """Test CTA alignment data extraction for nutsnmore video."""
    video_id = "nutsnmore_7482131638315388203"
    
    # Load the unified analysis
    try:
        with open(f"unified_analysis/{video_id}.json", 'r') as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"❌ Could not find unified_analysis/{video_id}.json")
        return
    
    # Initialize validator
    validator = MLDataValidator()
    
    # Extract context for CTA alignment
    context = validator.extract_context_for_prompt(data, "cta_alignment")
    
    print(f"\n📊 CTA Alignment Data for {video_id}")
    print("=" * 60)
    
    # Basic info
    print(f"\n📹 Video Info:")
    print(f"   Duration: {context.get('duration', 'N/A')}s")
    print(f"   Caption: {context.get('caption', 'N/A')[:100]}...")
    
    # Timeline summary
    if 'timeline_summary' in context:
        print(f"\n📊 Timeline Summary:")
        for key, value in context['timeline_summary'].items():
            print(f"   {key}: {value}")
    
    # Check for any text detections
    print(f"\n🔍 Searching for text detections in timeline...")
    
    text_found = False
    if 'timeline' in data:
        for timestamp, frame_data in data['timeline'].items():
            if 'text_detections' in frame_data and frame_data['text_detections']:
                if not text_found:
                    print("\n📝 Text Detections Found:")
                    text_found = True
                print(f"\n   Timestamp: {timestamp}")
                for text in frame_data['text_detections']:
                    print(f"      Text: '{text.get('text', 'N/A')}'")
                    print(f"      Category: {text.get('category', 'N/A')}")
                    print(f"      Confidence: {text.get('confidence', 'N/A')}")
    
    if not text_found:
        print("   ❌ No text detections found in timeline")
    
    # Check for suspicious patterns
    print(f"\n⚠️  Checking for suspicious patterns...")
    
    # Search entire data structure for "link in bio"
    def search_for_pattern(obj, pattern, path=""):
        """Recursively search for pattern in data structure."""
        results = []
        if isinstance(obj, dict):
            for key, value in obj.items():
                results.extend(search_for_pattern(value, pattern, f"{path}.{key}"))
        elif isinstance(obj, list):
            for i, item in enumerate(obj):
                results.extend(search_for_pattern(item, pattern, f"{path}[{i}]"))
        elif isinstance(obj, str):
            if pattern.lower() in obj.lower():
                results.append((path, obj))
        return results
    
    link_bio_refs = search_for_pattern(data, "link in bio")
    if link_bio_refs:
        print("   ⚠️  Found 'link in bio' references:")
        for path, value in link_bio_refs:
            print(f"      Path: {path}")
            print(f"      Value: {value}")
    else:
        print("   ✅ No 'link in bio' references found in data")
    
    # Show what would be sent to Claude
    print(f"\n📤 Data that would be sent to Claude:")
    print(json.dumps(context, indent=2)[:1000] + "..." if len(json.dumps(context, indent=2)) > 1000 else json.dumps(context, indent=2))

if __name__ == "__main__":
    test_cta_data()