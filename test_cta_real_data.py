#!/usr/bin/env python3
"""Test what REAL CTA data is sent for nutsnmore video with validation."""

import json
from run_video_prompts_validated import extract_real_ml_data

def test_cta_real_data():
    """Show exactly what CTA data would be sent to Claude."""
    video_id = "nutsnmore_7482131638315388203"
    
    # Load the unified analysis
    with open(f"unified_analysis/{video_id}.json", 'r') as f:
        unified_data = json.load(f)
    
    print(f"\n📊 CTA Alignment - REAL Data for {video_id}")
    print("=" * 80)
    
    # Extract validated data for CTA alignment
    context_data = extract_real_ml_data(unified_data, 'cta_alignment')
    
    print("\n📤 Data that would be sent to Claude:")
    print("-" * 80)
    
    # Show basic info
    print(f"\nDuration: {context_data.get('duration', 'N/A')}s")
    print(f"Caption: {context_data.get('caption', 'N/A')[:100]}...")
    print(f"Engagement: {json.dumps(context_data.get('engagement_stats', {}), indent=2)}")
    
    # Show text timeline
    print(f"\n📝 Text Timeline (REAL detections only):")
    text_timeline = context_data.get('text_timeline', {})
    if text_timeline:
        for timestamp, texts in sorted(text_timeline.items())[:10]:  # Show first 10
            print(f"\n   {timestamp}:")
            for text in texts:
                print(f"      Text: '{text['text']}'")
                print(f"      Confidence: {text['confidence']:.3f}")
                print(f"      Category: {text['category']}")
    else:
        print("   ❌ No text detections found")
    
    # Show speech timeline
    print(f"\n🎤 Speech Timeline:")
    speech_timeline = context_data.get('speech_timeline', {})
    if speech_timeline:
        for timestamp, speech in sorted(speech_timeline.items())[:5]:
            print(f"   {timestamp}: {speech}")
    else:
        print("   ❌ No speech detections found")
    
    # Check for "link in bio" or similar
    print(f"\n🔍 Checking for CTAs in text detections:")
    cta_patterns = ["link", "bio", "click", "tap", "swipe", "follow", "comment", "like"]
    found_ctas = []
    
    for timestamp, texts in text_timeline.items():
        for text_item in texts:
            text_lower = text_item['text'].lower()
            for pattern in cta_patterns:
                if pattern in text_lower:
                    found_ctas.append({
                        'timestamp': timestamp,
                        'text': text_item['text'],
                        'pattern': pattern
                    })
    
    if found_ctas:
        print("   ✅ Potential CTAs found:")
        for cta in found_ctas:
            print(f"      {cta['timestamp']}: '{cta['text']}' (matched: {cta['pattern']})")
    else:
        print("   ❌ No CTA-related text found in ML detections")
    
    # Save the actual data for inspection
    output_file = f"test_output/cta_real_data_{video_id}.json"
    import os
    os.makedirs("test_output", exist_ok=True)
    with open(output_file, 'w') as f:
        json.dump(context_data, f, indent=2)
    print(f"\n💾 Full context data saved to: {output_file}")

if __name__ == "__main__":
    test_cta_real_data()