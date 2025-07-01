#!/usr/bin/env python3
"""
Run full ML analysis on a video using all available libraries
"""

import os
import sys
import subprocess
from pathlib import Path

def run_full_analysis(video_id):
    """Run complete ML analysis with all libraries"""
    
    # Find video file
    video_paths = [
        f'downloads/videos/{video_id.split("_")[0]}/{video_id.split("_")[1]}.mp4',
        f'inputs/{video_id}.mp4'
    ]
    
    video_path = None
    for path in video_paths:
        if Path(path).exists():
            video_path = path
            break
    
    if not video_path:
        print(f"❌ Video file not found for {video_id}")
        return False
    
    print(f"🎥 Running full ML analysis on: {video_path}")
    print("   - YOLO object detection")
    print("   - MediaPipe pose/gesture detection") 
    print("   - EasyOCR text detection")
    print("   - Whisper speech transcription")
    
    # Run analysis in virtual environment
    cmd = [
        'bash', '-c',
        f'source venv/bin/activate && python3 services/complete_video_analysis.py "{video_path}" "{video_id}"'
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        
        if result.stdout:
            print(result.stdout)
        
        if result.returncode == 0:
            print(f"✅ Full ML analysis complete!")
            
            # Check results
            analysis_file = Path(f'downloads/analysis/{video_id}/complete_analysis.json')
            if analysis_file.exists():
                import json
                with open(analysis_file, 'r') as f:
                    data = json.load(f)
                
                # Check what was detected
                print("\n📊 Analysis Summary:")
                print(f"   - Objects detected: {len(data.get('timelines', {}).get('objects', {}))}")
                print(f"   - Text detected: {len(data.get('timelines', {}).get('text', {}))}")
                print(f"   - Poses detected: {len(data.get('timelines', {}).get('poses', {}))}")
                print(f"   - Speech segments: {len(data.get('timelines', {}).get('speech', {}))}")
                
                # Update unified analysis
                print("\n🔄 Updating unified analysis...")
                subprocess.run(['python3', 'update_unified_analysis.py', video_id])
                
            return True
        else:
            print(f"❌ Analysis failed: {result.stderr}")
            return False
            
    except subprocess.TimeoutError:
        print("❌ Analysis timed out after 5 minutes")
        return False
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 run_full_ml_analysis.py <video_id>")
        print("Example: python3 run_full_ml_analysis.py nutsnmore_7462841470299606318")
        sys.exit(1)
    
    video_id = sys.argv[1]
    
    # Check if venv exists
    if not Path('venv').exists():
        print("❌ Virtual environment not found. Please run:")
        print("   python3 -m venv venv")
        print("   source venv/bin/activate")
        print("   pip install ultralytics mediapipe easyocr whisper")
        sys.exit(1)
    
    success = run_full_analysis(video_id)
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()