import cv2
import numpy as np
from typing import Generator, List, Dict, Any
import os

class FrameSampler:
    """
    Intelligent frame sampling for different model requirements
    """
    
    @staticmethod
    def extract_video_metadata(video_path: str) -> Dict[str, Any]:
        """Extract basic video metadata"""
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Could not open video: {video_path}")
            
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        duration = frame_count / fps if fps > 0 else 0
        
        cap.release()
        
        return {
            'fps': fps,
            'frame_count': frame_count,
            'width': width,
            'height': height,
            'duration': duration
        }
    
    @staticmethod
    def get_adaptive_fps(duration: float, analysis_type: str = 'general') -> float:
        """Get optimal FPS based on video duration and analysis type"""
        if analysis_type == 'expression_detection' or analysis_type == 'mediapipe':
            # Higher FPS for expression/face detection
            if duration < 30:
                return 5.0  # Short videos need more detail
            elif duration < 60:
                return 3.0  # Medium videos moderate sampling
            else:
                return 2.0  # Longer videos lower sampling
        elif analysis_type == 'object_detection':
            return 1.0  # Objects don't change as quickly
        else:
            # Default general sampling
            return 1.0 if duration > 60 else 2.0
    
    @staticmethod
    def sample_uniform(video_path: str, target_fps: float = None, analysis_type: str = 'general') -> List[Dict[str, Any]]:
        """
        Sample frames uniformly at target FPS
        Used for: CLIP, NSFW, MediaPipe, OCR
        
        Args:
            video_path: Path to video file
            target_fps: Target frames per second (default: adaptive based on duration)
            analysis_type: Type of analysis ('expression_detection', 'mediapipe', 'object_detection', 'general')
        """
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Could not open video: {video_path}")
            
        source_fps = cap.get(cv2.CAP_PROP_FPS)
        
        # Use adaptive FPS if not specified
        if target_fps is None:
            frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            duration = frame_count / source_fps if source_fps > 0 else 0
            target_fps = FrameSampler.get_adaptive_fps(duration, analysis_type)
            print(f"Using adaptive FPS: {target_fps} for {analysis_type} analysis of {duration:.1f}s video")
        
        frame_interval = int(source_fps / target_fps) if source_fps > target_fps else 1
        
        frames = []
        frame_idx = 0
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
                
            if frame_idx % frame_interval == 0:
                frames.append({
                    'frame_number': frame_idx,
                    'timestamp': frame_idx / source_fps,
                    'data': frame
                })
                
            frame_idx += 1
            
        cap.release()
        print(f"Sampled {len(frames)} frames at {target_fps} fps from {video_path}")
        return frames
    
    @staticmethod
    def sample_adaptive(video_path: str, target_fps: float = 8.0) -> List[Dict[str, Any]]:
        """
        Sample frames adaptively for scene detection
        Higher sampling rate for accurate shot boundaries
        """
        # For now, same as uniform but can be enhanced to detect motion
        return FrameSampler.sample_uniform(video_path, target_fps)
    
    @staticmethod
    def get_all_frames(video_path: str) -> Generator[Dict[str, Any], None, None]:
        """
        Generator for all frames - memory efficient
        Used for: YOLO object tracking (needs every frame)
        """
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Could not open video: {video_path}")
            
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_idx = 0
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
                
            yield {
                'frame_number': frame_idx,
                'timestamp': frame_idx / fps,
                'data': frame
            }
            frame_idx += 1
            
        cap.release()
    
    @staticmethod
    def sample_frames_batch(video_path: str, batch_size: int = 30) -> Generator[List[Dict[str, Any]], None, None]:
        """
        Get frames in batches for memory-efficient processing
        """
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Could not open video: {video_path}")
            
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_idx = 0
        batch = []
        
        while True:
            ret, frame = cap.read()
            if not ret:
                if batch:  # Yield remaining frames
                    yield batch
                break
                
            batch.append({
                'frame_number': frame_idx,
                'timestamp': frame_idx / fps,
                'data': frame
            })
            
            if len(batch) >= batch_size:
                yield batch
                batch = []
                
            frame_idx += 1
            
        cap.release()


if __name__ == "__main__":
    # Test the frame sampler
    import sys
    if len(sys.argv) > 1:
        video_path = sys.argv[1]
        
        # Test metadata extraction
        metadata = FrameSampler.extract_video_metadata(video_path)
        print(f"Video metadata: {metadata}")
        
        # Test uniform sampling
        frames_1fps = FrameSampler.sample_uniform(video_path, target_fps=1.0)
        print(f"Sampled {len(frames_1fps)} frames at 1 fps")
        
        # Test frame generator
        frame_count = 0
        for frame in FrameSampler.get_all_frames(video_path):
            frame_count += 1
            if frame_count >= 5:  # Just test first 5 frames
                break
        print(f"Successfully accessed frame generator")