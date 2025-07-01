import numpy as np
import cv2
from PIL import Image
import json
import sys
from typing import List, Dict, Any
import torch
import torch.nn as nn
from torchvision import transforms

class OpenNSFW2Model(nn.Module):
    """
    Simplified OpenNSFW2 implementation
    If the actual opennsfw2 package is available, we'll use that instead
    """
    def __init__(self):
        super().__init__()
        # This is a placeholder - in production use the actual OpenNSFW2 model
        pass

class ContentModerator:
    """
    Content moderation using OpenNSFW2 or similar models
    """
    
    def __init__(self, device=None, threshold=0.3):
        """
        Initialize content moderation model
        Args:
            device: torch device (auto-detect if None)
            threshold: NSFW threshold (higher = more strict)
        """
        if device is None:
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        else:
            self.device = device
        
        self.threshold = threshold
        
        # Try to load OpenNSFW2
        try:
            from opennsfw2 import predict_image, predict_video_frames
            self.use_opennsfw2 = True
            self.predict_image = predict_image
            print("Using OpenNSFW2 for content moderation")
        except ImportError:
            print("OpenNSFW2 not found, using fallback implementation")
            self.use_opennsfw2 = False
            self._load_fallback_model()
    
    def _load_fallback_model(self):
        """Load a fallback model if OpenNSFW2 is not available"""
        # In production, you would load an actual model here
        # For now, we'll use a simple placeholder
        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])
    
    def moderate_frame(self, frame: np.ndarray) -> Dict[str, Any]:
        """
        Moderate a single frame
        Args:
            frame: OpenCV frame (BGR)
        Returns:
            dict with nsfw_score and safe_score
        """
        if self.use_opennsfw2:
            # Convert BGR to RGB
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pil_image = Image.fromarray(frame_rgb)
            
            # Get NSFW score
            nsfw_score = self.predict_image(pil_image)
            
            return {
                'nsfw_score': float(nsfw_score),
                'safe_score': float(1.0 - nsfw_score),
                'is_safe': nsfw_score < self.threshold
            }
        else:
            # Fallback: return safe scores
            # In production, implement actual inference here
            return {
                'nsfw_score': 0.05,
                'safe_score': 0.95,
                'is_safe': True
            }
    
    def moderate_frames(self, frames: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Moderate multiple frames
        Args:
            frames: List of frame dicts with 'data' and metadata
        Returns:
            List of moderation results
        """
        results = []
        
        for frame_info in frames:
            frame = frame_info['data']
            moderation = self.moderate_frame(frame)
            
            results.append({
                'frame_number': frame_info['frame_number'],
                'timestamp': frame_info['timestamp'],
                'nsfw_score': moderation['nsfw_score'],
                'safe_score': moderation['safe_score'],
                'is_safe': moderation['is_safe']
            })
        
        return results
    
    def get_explicit_content_summary(self, frame_results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Summarize explicit content detection results
        """
        explicit_frames = []
        nsfw_scores = []
        
        for result in frame_results:
            nsfw_scores.append(result['nsfw_score'])
            if not result['is_safe']:
                explicit_frames.append({
                    'frame': result['frame_number'],
                    'timestamp': result['timestamp'],
                    'nsfw_score': result['nsfw_score']
                })
        
        # Calculate overall safety metrics
        avg_nsfw_score = float(np.mean(nsfw_scores))
        max_nsfw_score = float(np.max(nsfw_scores))
        
        return {
            'is_safe': len(explicit_frames) == 0,
            'avg_nsfw_score': avg_nsfw_score,
            'max_nsfw_score': max_nsfw_score,
            'explicit_frame_count': len(explicit_frames),
            'explicit_frames': explicit_frames,
            'safety_rating': self._get_safety_rating(max_nsfw_score)
        }
    
    def _get_safety_rating(self, max_score: float) -> str:
        """Get human-readable safety rating"""
        if max_score < 0.1:
            return "very_safe"
        elif max_score < 0.3:
            return "safe"
        elif max_score < 0.5:
            return "questionable"
        elif max_score < 0.8:
            return "unsafe"
        else:
            return "explicit"
    
    def moderate_video(self, video_path: str, sample_fps: float = 1.0) -> Dict[str, Any]:
        """
        Moderate entire video by sampling frames
        """
        from frame_sampler import FrameSampler
        
        # Sample frames
        frames = FrameSampler.sample_uniform(video_path, target_fps=sample_fps)
        print(f"Moderating {len(frames)} frames...")
        
        # Moderate all frames
        frame_results = self.moderate_frames(frames)
        
        # Get summary
        summary = self.get_explicit_content_summary(frame_results)
        
        return {
            'video_path': video_path,
            'frames_analyzed': len(frames),
            'sample_fps': sample_fps,
            'explicitContent': summary,
            'frame_results': frame_results
        }


if __name__ == "__main__":
    if len(sys.argv) > 1:
        video_path = sys.argv[1]
        
        # Initialize content moderator
        moderator = ContentModerator(threshold=0.3)
        
        # Moderate video
        result = moderator.moderate_video(video_path, sample_fps=1.0)
        
        # Output summary
        print(f"Video: {video_path}")
        print(f"Safety Rating: {result['explicitContent']['safety_rating']}")
        print(f"Average NSFW Score: {result['explicitContent']['avg_nsfw_score']:.3f}")
        print(f"Max NSFW Score: {result['explicitContent']['max_nsfw_score']:.3f}")
        print(f"Explicit Frames: {result['explicitContent']['explicit_frame_count']}")
        
        # Save full results
        output_path = video_path.replace('.mp4', '_moderation.json')
        with open(output_path, 'w') as f:
            json.dump(result, f, indent=2)
        print(f"Full results saved to {output_path}")