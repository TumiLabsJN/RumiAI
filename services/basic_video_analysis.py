#!/usr/bin/env python3
"""
Basic Video Analysis - Extracts frames and basic metadata
Works without advanced ML libraries
"""

import os
import sys
import json
import subprocess
from datetime import datetime
from pathlib import Path


class BasicVideoAnalyzer:
    def __init__(self, video_path, video_id):
        self.video_path = video_path
        self.video_id = video_id
        self.output_dir = Path(f'downloads/analysis/{video_id}')
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def get_video_info(self):
        """Get video metadata using ffprobe"""
        try:
            cmd = [
                'ffprobe', '-v', 'error',
                '-select_streams', 'v:0',
                '-show_entries', 'stream=width,height,duration,nb_frames,r_frame_rate',
                '-of', 'json',
                self.video_path
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode == 0:
                data = json.loads(result.stdout)
                stream = data['streams'][0] if data.get('streams') else {}
                
                # Parse frame rate
                fps = 30  # default
                if 'r_frame_rate' in stream:
                    num, den = map(int, stream['r_frame_rate'].split('/'))
                    fps = num / den if den > 0 else 30
                
                return {
                    'width': int(stream.get('width', 0)),
                    'height': int(stream.get('height', 0)),
                    'duration': float(stream.get('duration', 0)),
                    'fps': fps,
                    'nb_frames': int(stream.get('nb_frames', 0))
                }
        except Exception as e:
            print(f"⚠️ Failed to get video info: {e}")
        
        return {
            'width': 0,
            'height': 0,
            'duration': 0,
            'fps': 30,
            'nb_frames': 0
        }
    
    def extract_frames(self, video_info):
        """Extract key frames from video"""
        frames_dir = self.output_dir / 'frames'
        frames_dir.mkdir(exist_ok=True)
        
        duration = video_info['duration']
        if duration <= 0:
            return []
        
        # Extract frames at key timestamps
        timestamps = []
        
        # First frame
        timestamps.append(0)
        
        # Every 5 seconds
        current = 5
        while current < duration:
            timestamps.append(current)
            current += 5
        
        # Last frame
        if duration > 5:
            timestamps.append(duration - 0.1)
        
        extracted = []
        for i, ts in enumerate(timestamps):
            output_path = frames_dir / f'frame_{i:03d}_{ts:.1f}s.jpg'
            cmd = [
                'ffmpeg', '-ss', str(ts),
                '-i', self.video_path,
                '-vframes', '1',
                '-q:v', '2',
                str(output_path),
                '-y'
            ]
            
            result = subprocess.run(cmd, capture_output=True)
            if result.returncode == 0:
                extracted.append({
                    'timestamp': ts,
                    'frame_number': int(ts * video_info['fps']),
                    'path': str(output_path)
                })
        
        return extracted
    
    def extract_audio(self):
        """Extract audio track"""
        audio_path = self.output_dir / 'audio.wav'
        
        cmd = [
            'ffmpeg', '-i', self.video_path,
            '-vn', '-acodec', 'pcm_s16le',
            '-ar', '44100', '-ac', '2',
            str(audio_path),
            '-y'
        ]
        
        result = subprocess.run(cmd, capture_output=True)
        if result.returncode == 0:
            return str(audio_path)
        return None
    
    def analyze_video(self):
        """Run basic video analysis"""
        print(f"\n🎥 Analyzing video: {self.video_id}")
        
        # Get video info
        print("📊 Getting video metadata...")
        video_info = self.get_video_info()
        print(f"   Duration: {video_info['duration']:.2f}s")
        print(f"   Resolution: {video_info['width']}x{video_info['height']}")
        print(f"   FPS: {video_info['fps']:.2f}")
        
        # Extract frames
        print("\n📹 Extracting key frames...")
        frames = self.extract_frames(video_info)
        print(f"   Extracted {len(frames)} frames")
        
        # Extract audio
        print("\n🎵 Extracting audio...")
        audio_path = self.extract_audio()
        if audio_path:
            print(f"   Audio saved to: {audio_path}")
        
        # Create analysis result
        results = {
            'video_id': self.video_id,
            'video_path': str(self.video_path),
            'analysis_timestamp': datetime.now().isoformat(),
            'video_info': video_info,
            'extracted_frames': frames,
            'audio_path': audio_path,
            'timelines': {
                'frames': {str(f['timestamp']): f for f in frames},
                'objects': {},  # Placeholder
                'text': {},     # Placeholder
                'poses': {},    # Placeholder
                'speech': {}    # Placeholder
            },
            'analysis_type': 'basic',
            'message': 'Basic analysis completed. For full analysis, install cv2, mediapipe, easyocr, etc.'
        }
        
        # Save results
        output_path = self.output_dir / 'basic_analysis.json'
        with open(output_path, 'w') as f:
            json.dump(results, f, indent=2)
        
        print(f"\n✅ Basic analysis complete! Results saved to: {output_path}")
        
        # Also save as complete_analysis.json for compatibility
        complete_path = self.output_dir / 'complete_analysis.json'
        with open(complete_path, 'w') as f:
            json.dump(results, f, indent=2)
        
        return results


def main():
    if len(sys.argv) != 3:
        print("Usage: python basic_video_analysis.py <video_path> <video_id>")
        sys.exit(1)
    
    video_path = sys.argv[1]
    video_id = sys.argv[2]
    
    if not os.path.exists(video_path):
        print(f"❌ Video not found: {video_path}")
        sys.exit(1)
    
    analyzer = BasicVideoAnalyzer(video_path, video_id)
    analyzer.analyze_video()


if __name__ == "__main__":
    main()