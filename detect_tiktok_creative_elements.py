#!/usr/bin/env python3
"""
TikTok Creative Elements Detection
Combines YOLO with specialized detectors for TikTok-specific elements
"""

import os
import cv2
import json
import numpy as np
from datetime import datetime
import glob

# Install with: pip install easyocr
try:
    import easyocr
    EASYOCR_AVAILABLE = True
except ImportError:
    EASYOCR_AVAILABLE = False
    print("⚠️  EasyOCR not installed. Install with: pip install easyocr")

from ultralytics import YOLO

class TikTokCreativeDetector:
    def __init__(self):
        # Initialize YOLO for general objects
        self.yolo_model = YOLO('yolov8n.pt')
        
        # Initialize text detector if available
        if EASYOCR_AVAILABLE:
            print("📝 Initializing text detector...")
            self.text_reader = easyocr.Reader(['en'], gpu=False)
        else:
            self.text_reader = None
        
        # TikTok UI regions (right side buttons)
        self.ui_regions = {
            'like_button': {'x': 0.9, 'y': 0.4, 'w': 0.08, 'h': 0.08},
            'comment_button': {'x': 0.9, 'y': 0.5, 'w': 0.08, 'h': 0.08},
            'share_button': {'x': 0.9, 'y': 0.6, 'w': 0.08, 'h': 0.08},
            'profile_button': {'x': 0.9, 'y': 0.3, 'w': 0.08, 'h': 0.08}
        }
    
    def detect_text_regions(self, image_path):
        """Detect text using OCR"""
        if not self.text_reader:
            return []
        
        try:
            results = self.text_reader.readtext(image_path)
            text_detections = []
            
            for (bbox, text, prob) in results:
                if prob > 0.5:  # Confidence threshold
                    # Convert bbox points to x1,y1,x2,y2
                    points = np.array(bbox)
                    x1, y1 = points.min(axis=0)
                    x2, y2 = points.max(axis=0)
                    
                    text_detections.append({
                        'type': 'text',
                        'text': text,
                        'confidence': float(prob),
                        'bbox': {
                            'x1': float(x1),
                            'y1': float(y1),
                            'x2': float(x2),
                            'y2': float(y2)
                        },
                        'category': self.categorize_text(text, y1, image_path)
                    })
            
            return text_detections
        except Exception as e:
            print(f"Text detection error: {e}")
            return []
    
    def categorize_text(self, text, y_position, image_path):
        """Categorize text based on content and position"""
        text_lower = text.lower()
        
        # Get image height for position analysis
        img = cv2.imread(image_path)
        if img is None:
            return 'unknown'
        
        height = img.shape[0]
        relative_y = y_position / height
        
        # Categorization rules
        if any(cta in text_lower for cta in ['follow', 'like', 'comment', 'share', 'click', 'tap', 'swipe']):
            return 'call_to_action'
        elif relative_y < 0.2:  # Top 20% of frame
            return 'header_text'
        elif relative_y > 0.8:  # Bottom 20% of frame
            return 'caption'
        elif '@' in text:
            return 'username'
        elif '#' in text:
            return 'hashtag'
        else:
            return 'overlay_text'
    
    def detect_ui_elements(self, image_path):
        """Detect TikTok UI elements using template matching or region analysis"""
        img = cv2.imread(image_path)
        if img is None:
            return []
        
        height, width = img.shape[:2]
        ui_detections = []
        
        # Check right side for UI buttons
        for element, region in self.ui_regions.items():
            x1 = int(region['x'] * width)
            y1 = int(region['y'] * height)
            x2 = int((region['x'] + region['w']) * width)
            y2 = int((region['y'] + region['h']) * height)
            
            # Extract region
            roi = img[y1:y2, x1:x2]
            
            # Simple detection: check if region has high contrast (likely UI element)
            if roi.size > 0:
                gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
                contrast = gray.std()
                
                if contrast > 30:  # Threshold for UI element presence
                    ui_detections.append({
                        'type': 'ui_element',
                        'element': element,
                        'confidence': min(contrast / 100, 1.0),
                        'bbox': {
                            'x1': x1,
                            'y1': y1,
                            'x2': x2,
                            'y2': y2
                        }
                    })
        
        return ui_detections
    
    def detect_colorful_regions(self, image_path):
        """Detect colorful regions that might be stickers, CTAs, or graphics"""
        img = cv2.imread(image_path)
        if img is None:
            return []
        
        # Convert to HSV for better color detection
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        
        # Detect high saturation regions (likely graphics/stickers)
        saturation = hsv[:, :, 1]
        
        # Threshold for colorful regions
        _, binary = cv2.threshold(saturation, 180, 255, cv2.THRESH_BINARY)
        
        # Find contours
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        colorful_regions = []
        for contour in contours:
            area = cv2.contourArea(contour)
            if area > 500:  # Minimum area threshold
                x, y, w, h = cv2.boundingRect(contour)
                
                # Classify based on aspect ratio and position
                aspect_ratio = w / h if h > 0 else 0
                region_type = 'graphic_overlay'
                
                if 0.8 < aspect_ratio < 1.2 and area < 5000:
                    region_type = 'sticker'
                elif w > img.shape[1] * 0.6 and h < img.shape[0] * 0.2:
                    region_type = 'banner'
                
                colorful_regions.append({
                    'type': 'creative_element',
                    'element': region_type,
                    'confidence': 0.7,
                    'bbox': {
                        'x1': x,
                        'y1': y,
                        'x2': x + w,
                        'y2': y + h
                    }
                })
        
        return colorful_regions[:5]  # Limit to top 5 regions
    
    def detect_all_elements(self, image_path):
        """Detect all creative elements in a frame"""
        print(f"🔍 Analyzing: {os.path.basename(image_path)}")
        
        all_detections = {
            'frame': os.path.basename(image_path),
            'yolo_objects': [],
            'text_elements': [],
            'ui_elements': [],
            'creative_elements': []
        }
        
        # 1. Run YOLO for general objects
        yolo_results = self.yolo_model(image_path, verbose=False)
        if yolo_results[0].boxes is not None:
            for box in yolo_results[0].boxes.data.tolist():
                all_detections['yolo_objects'].append({
                    'label': self.yolo_model.names[int(box[5])],
                    'confidence': float(box[4]),
                    'bbox': {
                        'x1': float(box[0]),
                        'y1': float(box[1]),
                        'x2': float(box[2]),
                        'y2': float(box[3])
                    }
                })
        
        # 2. Detect text
        all_detections['text_elements'] = self.detect_text_regions(image_path)
        
        # 3. Detect UI elements
        all_detections['ui_elements'] = self.detect_ui_elements(image_path)
        
        # 4. Detect creative elements (stickers, banners, etc.)
        all_detections['creative_elements'] = self.detect_colorful_regions(image_path)
        
        # Summary
        all_detections['summary'] = {
            'total_elements': (
                len(all_detections['yolo_objects']) +
                len(all_detections['text_elements']) +
                len(all_detections['ui_elements']) +
                len(all_detections['creative_elements'])
            ),
            'has_text': len(all_detections['text_elements']) > 0,
            'has_cta': any(t['category'] == 'call_to_action' for t in all_detections['text_elements']),
            'has_ui': len(all_detections['ui_elements']) > 0,
            'has_creative': len(all_detections['creative_elements']) > 0
        }
        
        return all_detections


def analyze_video_creative_elements(video_id, input_dir='frame_outputs', output_dir='creative_analysis_outputs'):
    """Analyze all frames of a video for creative elements"""
    detector = TikTokCreativeDetector()
    
    # Setup paths
    video_frame_dir = os.path.join(input_dir, video_id)
    video_output_dir = os.path.join(output_dir, video_id)
    os.makedirs(video_output_dir, exist_ok=True)
    
    # Get all frames
    frames = sorted(glob.glob(os.path.join(video_frame_dir, '*.jpg')))
    if not frames:
        print(f"⚠️  No frames found for {video_id}")
        return
    
    print(f"\n🎬 Analyzing creative elements for: {video_id}")
    print(f"   Frames: {len(frames)}")
    
    # Process each frame
    all_frame_results = []
    creative_timeline = {
        'text_timeline': [],
        'cta_timeline': [],
        'ui_timeline': [],
        'creative_timeline': []
    }
    
    for i, frame_path in enumerate(frames):
        print(f"   Processing frame {i+1}/{len(frames)}", end='\r')
        
        # Detect elements
        frame_results = detector.detect_all_elements(frame_path)
        all_frame_results.append(frame_results)
        
        # Update timeline
        frame_num = i + 1
        if frame_results['summary']['has_text']:
            creative_timeline['text_timeline'].append(frame_num)
        if frame_results['summary']['has_cta']:
            creative_timeline['cta_timeline'].append(frame_num)
        if frame_results['summary']['has_ui']:
            creative_timeline['ui_timeline'].append(frame_num)
        if frame_results['summary']['has_creative']:
            creative_timeline['creative_timeline'].append(frame_num)
    
    print(f"\n   ✅ Analysis complete")
    
    # Generate insights
    insights = {
        'video_id': video_id,
        'total_frames': len(frames),
        'creative_density': sum(r['summary']['total_elements'] for r in all_frame_results) / len(frames),
        'text_coverage': len(creative_timeline['text_timeline']) / len(frames),
        'cta_frames': creative_timeline['cta_timeline'],
        'has_persistent_ui': len(creative_timeline['ui_timeline']) > len(frames) * 0.8,
        'creative_moments': creative_timeline,
        'processed_at': datetime.now().isoformat()
    }
    
    # Save results
    output_file = os.path.join(video_output_dir, f'{video_id}_creative_analysis.json')
    with open(output_file, 'w') as f:
        json.dump({
            'insights': insights,
            'frame_details': all_frame_results
        }, f, indent=2)
    
    print(f"   💾 Saved analysis: {output_file}")
    
    # Print summary
    print(f"\n   📊 Creative Elements Summary:")
    print(f"      - Average elements per frame: {insights['creative_density']:.1f}")
    print(f"      - Frames with text: {len(creative_timeline['text_timeline'])}/{len(frames)}")
    print(f"      - CTA frames: {len(creative_timeline['cta_timeline'])}")
    print(f"      - UI persistence: {'Yes' if insights['has_persistent_ui'] else 'No'}")
    
    return insights


def main():
    """Main function to analyze all videos"""
    import sys
    
    print("🎨 TikTok Creative Elements Analyzer")
    print("=" * 50)
    
    if not EASYOCR_AVAILABLE:
        print("\n⚠️  EasyOCR not available. Install for text detection:")
        print("   pip install easyocr")
        print("\n   Continuing with limited functionality...\n")
    
    # Check for specific video or process all
    if len(sys.argv) > 1:
        video_id = sys.argv[1]
        analyze_video_creative_elements(video_id)
    else:
        # Process all videos
        frame_dirs = glob.glob('frame_outputs/*')
        for frame_dir in frame_dirs:
            if os.path.isdir(frame_dir):
                video_id = os.path.basename(frame_dir)
                analyze_video_creative_elements(video_id)


if __name__ == "__main__":
    main()