#!/usr/bin/env python3
"""Analyze text overlays for classification"""

import json
import sys

video_id = sys.argv[1] if len(sys.argv) > 1 else "7372639293631679790"

# Load unified analysis
with open(f'unified_analysis/{video_id}.json', 'r') as f:
    unified_data = json.load(f)

text_timeline = unified_data.get('timelines', {}).get('textOverlayTimeline', {})

# Analyze text patterns
text_occurrences = {}
frame_dimensions = {"width": 576, "height": 1024}  # Typical TikTok dimensions

print(f"Analyzing text overlays for video {video_id}")
print("=" * 60)

# First pass: collect all text occurrences
for timestamp, frame_data in text_timeline.items():
    frame_num = frame_data.get('frame', 0)
    texts = frame_data.get('texts', [])
    
    for text_item in texts:
        text = text_item.get('text', '')
        bbox = text_item.get('bbox', {})
        confidence = text_item.get('confidence', 0)
        
        if text not in text_occurrences:
            text_occurrences[text] = []
        
        text_occurrences[text].append({
            'frame': frame_num,
            'timestamp': timestamp,
            'bbox': bbox,
            'confidence': confidence,
            'category': text_item.get('category', 'unknown')
        })

# Analyze each text
print("\nText Analysis:")
print("-" * 60)

classifications = []

for text, occurrences in text_occurrences.items():
    print(f"\nText: '{text}'")
    print(f"Occurrences: {len(occurrences)}")
    
    # Sort by frame number
    occurrences.sort(key=lambda x: x['frame'])
    
    # Check for consecutive frames
    consecutive_count = 1
    max_consecutive = 1
    for i in range(1, len(occurrences)):
        if occurrences[i]['frame'] == occurrences[i-1]['frame'] + 1:
            consecutive_count += 1
            max_consecutive = max(max_consecutive, consecutive_count)
        else:
            consecutive_count = 1
    
    # Check bounding box stability
    bbox_stable = False
    if len(occurrences) >= 2:
        bbox_changes = []
        for i in range(1, len(occurrences)):
            prev_bbox = occurrences[i-1]['bbox']
            curr_bbox = occurrences[i]['bbox']
            if prev_bbox and curr_bbox:
                x_change = abs(curr_bbox.get('x1', 0) - prev_bbox.get('x1', 0))
                y_change = abs(curr_bbox.get('y1', 0) - prev_bbox.get('y1', 0))
                bbox_changes.append((x_change, y_change))
        
        if bbox_changes:
            avg_x_change = sum(x for x, y in bbox_changes) / len(bbox_changes)
            avg_y_change = sum(y for x, y in bbox_changes) / len(bbox_changes)
            # 10% of frame width/height
            bbox_stable = avg_x_change < frame_dimensions['width'] * 0.1 and avg_y_change < frame_dimensions['height'] * 0.1
    
    # Check bottom-right position
    bottom_right = False
    small_box = False
    if occurrences[0]['bbox']:
        bbox = occurrences[0]['bbox']
        # Check if in bottom-right quadrant
        if bbox.get('x1', 0) > frame_dimensions['width'] * 0.5 and bbox.get('y1', 0) > frame_dimensions['height'] * 0.5:
            bottom_right = True
        # Check if box is small (< 25% of frame area)
        box_width = bbox.get('x2', 0) - bbox.get('x1', 0)
        box_height = bbox.get('y2', 0) - bbox.get('y1', 0)
        box_area = box_width * box_height
        frame_area = frame_dimensions['width'] * frame_dimensions['height']
        if box_area < frame_area * 0.25:
            small_box = True
    
    # Average confidence
    avg_confidence = sum(occ['confidence'] for occ in occurrences) / len(occurrences)
    
    # Classification logic
    category = "overlay_text"
    reasoning = ""
    
    if max_consecutive >= 3 and bbox_stable:
        category = "product_label"
        reasoning = f"Appears in {max_consecutive} consecutive frames with stable position; likely printed on product."
    elif bottom_right and small_box and len(occurrences) >= 2:
        category = "product_label"
        reasoning = "Located in bottom-right with small bounding box across frames; likely product label."
    elif avg_confidence < 0.6:
        category = "product_label"
        reasoning = f"Low confidence score ({avg_confidence:.2f}) suggests distorted text from product surface."
    elif len(occurrences) == 1:
        category = "overlay_text"
        reasoning = "Appears only once; likely an intentional overlay."
    else:
        category = "overlay_text"
        reasoning = "Does not meet product label criteria; classified as overlay."
    
    print(f"Classification: {category}")
    print(f"Reasoning: {reasoning}")
    print(f"Avg confidence: {avg_confidence:.3f}")
    print(f"Consecutive frames: {max_consecutive}")
    print(f"Bbox stable: {bbox_stable}")
    
    # Add to classifications
    classifications.append({
        "text": text,
        "category": category,
        "frame": occurrences[0]['frame'],
        "bbox": occurrences[0]['bbox'],
        "reasoning": reasoning
    })

# Output JSON format
print("\n\nJSON Classification Result:")
print("=" * 60)
print(json.dumps(classifications[:10], indent=2))  # Show first 10