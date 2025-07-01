#!/usr/bin/env python3
"""
Automated Video Pipeline - Frame Extraction
Extracts frames from videos in the inputs directory
"""

import os
import cv2
import sys
import json
from pathlib import Path

def get_adaptive_fps(video_duration):
    """Get optimal FPS based on video duration for expression detection"""
    if video_duration < 30:
        return 5.0  # Short videos need more detail for expressions
    elif video_duration < 60:
        return 3.0  # Medium videos can use moderate sampling
    else:
        return 2.0  # Longer videos use lower sampling to manage processing

def extract_frames(video_path, output_dir, interval=None, adaptive_mode=True):
    """Extract frames from video at specified interval
    
    Args:
        video_path: Path to video file
        output_dir: Directory to save frames
        interval: Time interval between frames in seconds (default: adaptive)
        adaptive_mode: Use adaptive FPS based on video duration (default: True)
    """
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps if fps > 0 else 0
    
    # Determine interval
    if interval is None and adaptive_mode:
        target_fps = get_adaptive_fps(duration)
        interval = 1.0 / target_fps
        print(f"   Using adaptive sampling: {target_fps} FPS (interval: {interval:.2f}s) for {duration:.1f}s video")
    elif interval is None:
        interval = 1.0  # Default to 1 FPS if not adaptive
    
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    
    frame_count = 0
    saved_count = 0
    interval_frames = max(1, int(fps * interval))
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
            
        # Save frame at interval
        if frame_count % interval_frames == 0:
            timestamp = frame_count / fps
            output_path = os.path.join(output_dir, f'frame_{saved_count:04d}_t{timestamp:.2f}.jpg')
            cv2.imwrite(output_path, frame)
            saved_count += 1
            
        frame_count += 1
    
    cap.release()
    return saved_count

def process_videos():
    """Process all videos in inputs directory"""
    input_dir = "inputs"
    output_base_dir = "frame_outputs"
    
    # Check for environment variable overrides
    video_id = os.environ.get('VIDEO_ID')
    video_path_env = os.environ.get('VIDEO_PATH')
    
    if video_id and video_path_env:
        # Process specific video from environment variables
        output_dir = os.path.join(output_base_dir, video_id)
        
        print(f"🎬 Processing: {video_id}")
        print(f"   Input: {video_path_env}")
        print(f"   Output: {output_dir}")
        
        try:
            # Extract video metadata
            cap = cv2.VideoCapture(video_path_env)
            fps = cap.get(cv2.CAP_PROP_FPS)
            frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            duration = frame_count / fps if fps > 0 else 0
            cap.release()
            
            # Save metadata
            os.makedirs(output_dir, exist_ok=True)
            metadata = {
                'video_id': video_id,
                'fps': fps,
                'frame_count': frame_count,
                'width': width,
                'height': height,
                'duration': duration
            }
            with open(os.path.join(output_dir, 'metadata.json'), 'w') as f:
                json.dump(metadata, f, indent=2)
            
            # Extract frames
            saved_frames = extract_frames(video_path_env, output_dir)
            print(f"   ✅ Extracted {saved_frames} frames")
            print(f"   ✅ Video metadata saved")
        except Exception as e:
            print(f"   ❌ Error: {e}")
        return
    
    # Otherwise, process all videos in inputs directory
    if not os.path.exists(input_dir):
        print(f"❌ Input directory not found: {input_dir}")
        return
    
    # Get all video files
    video_extensions = ['.mp4', '.avi', '.mov', '.mkv']
    video_files = []
    
    for ext in video_extensions:
        video_files.extend(Path(input_dir).glob(f'*{ext}'))
    
    if not video_files:
        print("❌ No video files found in inputs directory")
        return
    
    print(f"📹 Found {len(video_files)} video(s) to process")
    
    for video_path in video_files:
        video_id = video_path.stem  # filename without extension
        output_dir = os.path.join(output_base_dir, video_id)
        
        # Skip if already processed
        if os.path.exists(output_dir) and len(os.listdir(output_dir)) > 0:
            print(f"⏭️ Skipping {video_id} - already processed")
            continue
        
        print(f"\n🎬 Processing: {video_id}")
        print(f"   Input: {video_path}")
        print(f"   Output: {output_dir}")
        
        try:
            frame_count = extract_frames(str(video_path), output_dir)
            print(f"   ✅ Extracted {frame_count} frames")
        except Exception as e:
            print(f"   ❌ Error: {e}")

def main():
    """Main entry point"""
    mode = sys.argv[1] if len(sys.argv) > 1 else 'once'
    
    if mode == 'once':
        process_videos()
    else:
        print(f"Unknown mode: {mode}")
        sys.exit(1)

if __name__ == "__main__":
    main()