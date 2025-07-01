import cv2
import numpy as np
import json
import sys
from typing import List, Dict, Any, Tuple
from collections import defaultdict

# YOLO imports
try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    print("Warning: ultralytics (YOLOv8) not installed")
    YOLO_AVAILABLE = False

# DeepSort imports
try:
    from deep_sort_realtime.deepsort_tracker import DeepSort
    DEEPSORT_AVAILABLE = True
except ImportError:
    print("Warning: deep-sort-realtime not installed")
    DEEPSORT_AVAILABLE = False

class YOLODeepSortTracker:
    """
    Enhanced YOLO object detection with DeepSort tracking
    Processes ALL frames for consistent object tracking
    """
    
    def __init__(self, yolo_model='yolov8n.pt', max_age=30, n_init=3):
        """
        Initialize YOLO + DeepSort tracker
        Args:
            yolo_model: Path to YOLO model or model name
            max_age: Maximum frames to keep track alive without detection
            n_init: Number of frames before confirming a track
        """
        if not YOLO_AVAILABLE:
            raise ImportError("Please install ultralytics: pip install ultralytics")
            
        if not DEEPSORT_AVAILABLE:
            raise ImportError("Please install deep-sort-realtime: pip install deep-sort-realtime")
        
        # Initialize YOLO
        self.yolo = YOLO(yolo_model)
        
        # Initialize DeepSort
        self.tracker = DeepSort(max_age=max_age, n_init=n_init)
        
        # Track storage
        self.tracked_objects = defaultdict(lambda: {
            'class': None,
            'frames': [],
            'confidence_scores': []
        })
    
    def process_frame(self, frame: np.ndarray, frame_idx: int, timestamp: float) -> List[Dict[str, Any]]:
        """
        Process a single frame through YOLO + DeepSort
        """
        # Run YOLO detection
        results = self.yolo(frame, verbose=False)
        
        # Extract detections
        detections = []
        
        if len(results) > 0 and results[0].boxes is not None:
            boxes = results[0].boxes
            
            for i in range(len(boxes)):
                # Get box coordinates
                x1, y1, x2, y2 = boxes.xyxy[i].cpu().numpy()
                confidence = float(boxes.conf[i].cpu().numpy())
                class_id = int(boxes.cls[i].cpu().numpy())
                class_name = self.yolo.names[class_id]
                
                # Format for DeepSort: [x1, y1, w, h]
                bbox = [x1, y1, x2 - x1, y2 - y1]
                
                detections.append((bbox, confidence, class_name))
        
        # Update DeepSort tracker
        if detections:
            tracks = self.tracker.update_tracks(detections, frame=frame)
        else:
            # Still update tracker even with no detections
            tracks = self.tracker.update_tracks([], frame=frame)
        
        # Process active tracks
        frame_tracks = []
        for track in tracks:
            if not track.is_confirmed():
                continue
                
            track_id = track.track_id
            ltrb = track.to_ltrb()  # left, top, right, bottom
            
            # Store track info
            self.tracked_objects[track_id]['class'] = track.det_class
            self.tracked_objects[track_id]['frames'].append({
                'frame': frame_idx,
                'timestamp': timestamp,
                'bbox': {
                    'left': float(ltrb[0]) / frame.shape[1],   # Normalize to 0-1
                    'top': float(ltrb[1]) / frame.shape[0],
                    'right': float(ltrb[2]) / frame.shape[1],
                    'bottom': float(ltrb[3]) / frame.shape[0]
                },
                'confidence': float(track.det_conf) if hasattr(track, 'det_conf') and track.det_conf is not None else 0.9
            })
            self.tracked_objects[track_id]['confidence_scores'].append(
                float(track.det_conf) if hasattr(track, 'det_conf') and track.det_conf is not None else 0.9
            )
            
            frame_tracks.append({
                'track_id': track_id,
                'class': track.det_class,
                'bbox': ltrb,
                'confidence': float(track.det_conf) if hasattr(track, 'det_conf') and track.det_conf is not None else 0.9
            })
        
        return frame_tracks
    
    def process_video(self, video_path: str, batch_size: int = 30, frame_skip: int = 0) -> Dict[str, Any]:
        """
        Process entire video with YOLO + DeepSort
        Args:
            video_path: Path to video file
            batch_size: Process frames in batches for memory efficiency
            frame_skip: Number of frames to skip (0 = process all, 1 = every other frame, etc.)
        """
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Could not open video: {video_path}")
        
        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        print(f"Processing {total_frames} frames at {fps} fps...")
        
        frame_idx = 0
        processed_frames = 0
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            # Skip frames if requested (for performance)
            if frame_skip > 0 and frame_idx % (frame_skip + 1) != 0:
                frame_idx += 1
                continue
                
            timestamp = frame_idx / fps
            
            # Process frame
            self.process_frame(frame, frame_idx, timestamp)
            
            processed_frames += 1
            
            # Progress update
            if processed_frames % 100 == 0:
                actual_frames = processed_frames * (frame_skip + 1) if frame_skip > 0 else processed_frames
                print(f"Processed {processed_frames} frames (frame {actual_frames}/{total_frames})...")
                
            frame_idx += 1
        
        cap.release()
        
        # Format results
        object_annotations = []
        for track_id, track_data in self.tracked_objects.items():
            if len(track_data['frames']) > 0:  # Only include tracks with detections
                avg_confidence = np.mean(track_data['confidence_scores'])
                
                object_annotations.append({
                    'trackId': f"object_{track_id}",
                    'entity': {
                        'entityId': track_data['class'],
                        'description': track_data['class']
                    },
                    'confidence': float(avg_confidence),
                    'frames': track_data['frames']
                })
        
        # Sort by track ID for consistency
        object_annotations.sort(key=lambda x: x['trackId'])
        
        return {
            'video_path': video_path,
            'total_frames': total_frames,
            'fps': fps,
            'objectAnnotations': object_annotations,
            'total_tracks': len(object_annotations)
        }
    
    def get_object_summary(self) -> Dict[str, Any]:
        """
        Get summary statistics of tracked objects
        """
        class_counts = defaultdict(int)
        class_durations = defaultdict(list)
        
        for track_data in self.tracked_objects.values():
            if track_data['class'] and len(track_data['frames']) > 0:
                class_counts[track_data['class']] += 1
                
                # Calculate duration (last frame - first frame)
                duration = track_data['frames'][-1]['timestamp'] - track_data['frames'][0]['timestamp']
                class_durations[track_data['class']].append(duration)
        
        summary = {
            'object_counts': dict(class_counts),
            'average_durations': {
                cls: float(np.mean(durations)) 
                for cls, durations in class_durations.items()
            }
        }
        
        return summary


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='YOLO + DeepSort object tracking')
    parser.add_argument('video_path', help='Path to video file')
    parser.add_argument('--frame-skip', type=int, default=0, 
                       help='Number of frames to skip (0=process all, 2=every 3rd frame)')
    
    args = parser.parse_args()
    
    if args.video_path:
        # Initialize tracker
        tracker = YOLODeepSortTracker()
        
        # Process video with frame skipping
        result = tracker.process_video(args.video_path, frame_skip=args.frame_skip)
        
        # Get summary
        summary = tracker.get_object_summary()
        
        # Output results
        print(f"\nTracking Results:")
        print(f"Total tracks: {result['total_tracks']}")
        print(f"Object counts: {summary['object_counts']}")
        if args.frame_skip > 0:
            print(f"Frame sampling: every {args.frame_skip + 1} frames")
        
        # Save results
        output_path = args.video_path.replace('.mp4', '_tracking.json')
        with open(output_path, 'w') as f:
            json.dump(result, f, indent=2)
        print(f"Results saved to {output_path}")