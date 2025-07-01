#!/usr/bin/env python3
"""
Complete Video Analysis Pipeline
Runs all local analysis: YOLO, OCR, MediaPipe, Audio, etc.
"""

import os
import sys
import json
import cv2
import numpy as np
from datetime import datetime
from pathlib import Path


class NumpyEncoder(json.JSONEncoder):
    """Custom JSON encoder for NumPy types"""
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        elif isinstance(obj, (np.bool_, bool)):
            return bool(obj)
        elif hasattr(obj, 'item'):  # For numpy scalars
            return obj.item()
        return super(NumpyEncoder, self).default(obj)

# Try to import analysis modules
try:
    import mediapipe as mp
    MEDIAPIPE_AVAILABLE = True
except ImportError:
    MEDIAPIPE_AVAILABLE = False
    print("⚠️ MediaPipe not available - skipping pose/gesture detection")

try:
    import easyocr
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False
    print("⚠️ EasyOCR not available - skipping text detection")

try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False
    print("⚠️ YOLO not available - skipping object detection")

try:
    import whisper
    WHISPER_AVAILABLE = True
except ImportError:
    WHISPER_AVAILABLE = False
    print("⚠️ Whisper not available - skipping speech transcription")


class CompleteVideoAnalyzer:
    def __init__(self, video_path, video_id):
        self.video_path = video_path
        self.video_id = video_id
        self.output_dir = Path(f'downloads/analysis/{video_id}')
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize models
        self.init_models()
        
        # Video properties
        self.cap = cv2.VideoCapture(video_path)
        self.fps = self.cap.get(cv2.CAP_PROP_FPS)
        self.total_frames = int(self.cap.get(cv2.CAP_PROP_FRAME_COUNT))
        self.duration = self.total_frames / self.fps if self.fps > 0 else 0
        
    def init_models(self):
        """Initialize all analysis models"""
        # YOLO for object detection
        if YOLO_AVAILABLE:
            try:
                self.yolo_model = YOLO('yolov8n.pt')  # nano model for speed
                print("✅ YOLO model loaded")
            except:
                self.yolo_model = None
                print("⚠️ Failed to load YOLO model")
        
        # MediaPipe for pose/gesture detection
        if MEDIAPIPE_AVAILABLE:
            self.mp_pose = mp.solutions.pose
            self.mp_hands = mp.solutions.hands
            self.mp_face_mesh = mp.solutions.face_mesh
            self.pose = self.mp_pose.Pose(static_image_mode=False)
            self.hands = self.mp_hands.Hands(static_image_mode=False)
            self.face_mesh = self.mp_face_mesh.FaceMesh(static_image_mode=False)
            print("✅ MediaPipe models loaded")
        
        # OCR for text detection
        if OCR_AVAILABLE:
            try:
                self.ocr_reader = easyocr.Reader(['en'])
                print("✅ OCR model loaded")
            except:
                self.ocr_reader = None
                print("⚠️ Failed to load OCR model")
        
        # Whisper for speech transcription
        if WHISPER_AVAILABLE:
            try:
                self.whisper_model = whisper.load_model("base")
                print("✅ Whisper model loaded")
            except:
                self.whisper_model = None
                print("⚠️ Failed to load Whisper model")
    
    def analyze_video(self):
        """Run complete video analysis"""
        print(f"\n🎥 Analyzing video: {self.video_id}")
        print(f"   Duration: {self.duration:.2f}s")
        print(f"   Total frames: {self.total_frames}")
        print(f"   FPS: {self.fps}")
        
        results = {
            'video_id': self.video_id,
            'video_path': str(self.video_path),
            'duration': self.duration,
            'fps': self.fps,
            'total_frames': self.total_frames,
            'analysis_timestamp': datetime.now().isoformat(),
            'timelines': {
                'objects': {},
                'text': {},
                'poses': {},
                'gestures': {},
                'faces': {},
                'scenes': {},
                'expressions': {}
            },
            'audio': {},
            'speech': {}
        }
        
        # 1. Frame-by-frame analysis
        print("\n📹 Running frame analysis...")
        self.analyze_frames(results)
        
        # 2. Audio analysis
        print("\n🎵 Running audio analysis...")
        self.analyze_audio(results)
        
        # 3. Speech transcription
        print("\n🗣️ Running speech transcription...")
        self.transcribe_speech(results)
        
        # 4. Scene detection
        print("\n🎬 Running scene detection...")
        self.detect_scenes(results)
        
        # Save results
        output_path = self.output_dir / 'complete_analysis.json'
        with open(output_path, 'w') as f:
            json.dump(results, f, indent=2, cls=NumpyEncoder)
        
        print(f"\n✅ Analysis complete! Results saved to: {output_path}")
        return results
    
    def analyze_frames(self, results):
        """Analyze video frame by frame"""
        frame_interval = max(1, int(self.fps / 2))  # Analyze 2 frames per second
        
        frame_count = 0
        analyzed_frames = 0
        
        while True:
            ret, frame = self.cap.read()
            if not ret:
                break
            
            # Only analyze at intervals
            if frame_count % frame_interval == 0:
                timestamp = frame_count / self.fps
                frame_key = f"{timestamp:.2f}"
                
                # YOLO object detection
                if YOLO_AVAILABLE and self.yolo_model:
                    objects = self.detect_objects(frame)
                    if objects:
                        results['timelines']['objects'][frame_key] = objects
                
                # MediaPipe pose detection
                if MEDIAPIPE_AVAILABLE:
                    poses = self.detect_poses(frame)
                    if poses:
                        results['timelines']['poses'][frame_key] = poses
                    
                    gestures = self.detect_gestures(frame)
                    if gestures:
                        results['timelines']['gestures'][frame_key] = gestures
                    
                    faces = self.detect_faces(frame)
                    if faces:
                        results['timelines']['faces'][frame_key] = faces
                
                # OCR text detection
                if OCR_AVAILABLE and self.ocr_reader:
                    text = self.detect_text(frame)
                    if text:
                        results['timelines']['text'][frame_key] = text
                
                analyzed_frames += 1
                
                # Progress update
                if analyzed_frames % 10 == 0:
                    progress = (frame_count / self.total_frames) * 100
                    print(f"   Progress: {progress:.1f}% ({analyzed_frames} frames analyzed)")
            
            frame_count += 1
        
        self.cap.release()
        print(f"   ✅ Analyzed {analyzed_frames} frames")
    
    def detect_objects(self, frame):
        """Detect objects using YOLO"""
        try:
            results = self.yolo_model(frame, verbose=False)
            objects = []
            
            for r in results:
                if r.boxes is not None:
                    for box in r.boxes:
                        obj = {
                            'class': r.names[int(box.cls.item() if hasattr(box.cls, 'item') else box.cls)],
                            'confidence': float(box.conf.item() if hasattr(box.conf, 'item') else box.conf),
                            'bbox': box.xyxy[0].tolist() if hasattr(box.xyxy[0], 'tolist') else list(box.xyxy[0])
                        }
                        objects.append(obj)
            
            return objects if objects else None
        except:
            return None
    
    def detect_poses(self, frame):
        """Detect poses using MediaPipe"""
        try:
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = self.pose.process(rgb_frame)
            
            if results.pose_landmarks:
                landmarks = []
                for landmark in results.pose_landmarks.landmark:
                    landmarks.append({
                        'x': landmark.x,
                        'y': landmark.y,
                        'z': landmark.z,
                        'visibility': landmark.visibility
                    })
                
                return {
                    'landmarks': landmarks,
                    'pose_type': self.classify_pose(landmarks)
                }
            return None
        except:
            return None
    
    def detect_gestures(self, frame):
        """Detect hand gestures using MediaPipe"""
        try:
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = self.hands.process(rgb_frame)
            
            if results.multi_hand_landmarks:
                hands = []
                for hand_landmarks in results.multi_hand_landmarks:
                    landmarks = []
                    for landmark in hand_landmarks.landmark:
                        landmarks.append({
                            'x': landmark.x,
                            'y': landmark.y,
                            'z': landmark.z
                        })
                    hands.append({
                        'landmarks': landmarks,
                        'gesture': self.classify_gesture(landmarks)
                    })
                return hands
            return None
        except:
            return None
    
    def detect_faces(self, frame):
        """Detect faces and expressions using MediaPipe"""
        try:
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = self.face_mesh.process(rgb_frame)
            
            if results.multi_face_landmarks:
                faces = []
                for face_landmarks in results.multi_face_landmarks:
                    # Simplified - just count landmarks
                    faces.append({
                        'num_landmarks': len(face_landmarks.landmark),
                        'expression': 'neutral'  # Would need more logic for expression
                    })
                return faces
            return None
        except:
            return None
    
    def detect_text(self, frame):
        """Detect text using OCR"""
        try:
            results = self.ocr_reader.readtext(frame)
            text_items = []
            
            for (bbox, text, prob) in results:
                if prob > 0.5:  # Confidence threshold
                    text_items.append({
                        'text': text,
                        'confidence': prob,
                        'bbox': bbox
                    })
            
            return text_items if text_items else None
        except:
            return None
    
    def classify_pose(self, landmarks):
        """Simple pose classification"""
        # This is a placeholder - real classification would be more complex
        return "standing"
    
    def classify_gesture(self, landmarks):
        """Simple gesture classification"""
        # This is a placeholder - real classification would be more complex
        return "open_hand"
    
    def analyze_audio(self, results):
        """Extract and analyze audio"""
        try:
            # Extract audio using ffmpeg
            audio_path = self.output_dir / 'audio.wav'
            os.system(f'ffmpeg -i "{self.video_path}" -vn -acodec pcm_s16le -ar 44100 -ac 2 "{audio_path}" -y 2>/dev/null')
            
            if audio_path.exists():
                results['audio']['extracted'] = True
                results['audio']['path'] = str(audio_path)
                print("   ✅ Audio extracted")
            else:
                results['audio']['extracted'] = False
                print("   ⚠️ Failed to extract audio")
        except:
            results['audio']['extracted'] = False
    
    def transcribe_speech(self, results):
        """Transcribe speech using Whisper"""
        if not WHISPER_AVAILABLE or not self.whisper_model:
            results['speech']['transcribed'] = False
            return
        
        try:
            audio_path = self.output_dir / 'audio.wav'
            if audio_path.exists():
                print("   Transcribing with Whisper...")
                result = self.whisper_model.transcribe(str(audio_path))
                
                results['speech'] = {
                    'transcribed': True,
                    'text': result['text'],
                    'segments': result['segments'],
                    'language': result.get('language', 'en')
                }
                print(f"   ✅ Transcribed: {len(result['segments'])} segments")
            else:
                results['speech']['transcribed'] = False
        except Exception as e:
            print(f"   ⚠️ Transcription failed: {e}")
            results['speech']['transcribed'] = False
    
    def detect_scenes(self, results):
        """Scene detection using PySceneDetect"""
        try:
            # Try to import PySceneDetect
            sys.path.append(str(Path(__file__).parent.parent / 'python'))
            from scene_detection import SceneDetector
            
            # Initialize scene detector
            detector = SceneDetector(threshold=20.0)
            
            # Detect scenes
            scene_result = detector.detect_scenes(self.video_path)
            
            # Convert to timeline format
            scene_timeline = {}
            for scene in scene_result['shots']:
                start_key = f"{scene['start_time']:.2f}"
                scene_timeline[start_key] = {
                    'scene': scene['scene_id'] + 1,
                    'duration': scene['duration'],
                    'end_time': scene['end_time']
                }
            
            results['timelines']['scenes'] = scene_timeline
            
            # Save scene detection results separately
            scene_output_path = self.output_dir / 'scene_detection.json'
            with open(scene_output_path, 'w') as f:
                json.dump(scene_result, f, indent=2)
            
            print(f"   ✅ Detected {scene_result['total_scenes']} scenes")
            
        except Exception as e:
            print(f"   ⚠️ Scene detection failed: {e}")
            # Fallback to basic scene detection
            results['timelines']['scenes'] = {
                '0.00': {'scene': 1, 'type': 'intro'},
                f'{self.duration/2:.2f}': {'scene': 2, 'type': 'main'},
                f'{self.duration:.2f}': {'scene': 3, 'type': 'outro'}
            }
            print("   Using basic scene detection as fallback")


def main():
    if len(sys.argv) != 3:
        print("Usage: python complete_video_analysis.py <video_path> <video_id>")
        sys.exit(1)
    
    video_path = sys.argv[1]
    video_id = sys.argv[2]
    
    if not os.path.exists(video_path):
        print(f"❌ Video not found: {video_path}")
        sys.exit(1)
    
    analyzer = CompleteVideoAnalyzer(video_path, video_id)
    results = analyzer.analyze_video()
    
    # Print summary
    print("\n📊 Analysis Summary:")
    print(f"   Objects detected: {len(results['timelines']['objects'])} frames")
    print(f"   Text detected: {len(results['timelines']['text'])} frames")
    print(f"   Poses detected: {len(results['timelines']['poses'])} frames")
    print(f"   Speech transcribed: {results['speech'].get('transcribed', False)}")


if __name__ == "__main__":
    main()