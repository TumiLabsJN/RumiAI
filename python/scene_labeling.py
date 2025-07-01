import torch
import clip
from PIL import Image
import numpy as np
import json
import sys
from typing import List, Dict, Any
import cv2

class SceneLabeler:
    """
    Scene labeling using CLIP (OpenAI)
    Lighter alternative to BLIP-2
    """
    
    def __init__(self, model_name="ViT-B/32", device=None):
        """
        Initialize CLIP model
        Args:
            model_name: CLIP model variant (ViT-B/32 is efficient)
            device: torch device (auto-detect if None)
        """
        if device is None:
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        else:
            self.device = device
            
        print(f"Loading CLIP model {model_name} on {self.device}...")
        self.model, self.preprocess = clip.load(model_name, device=self.device)
        self.model.eval()
        
        # Default label categories for video analysis
        self.default_labels = [
            "person", "people", "face", "indoor", "outdoor", 
            "kitchen", "food", "cooking", "dancing", "sports",
            "nature", "city", "office", "bedroom", "bathroom",
            "car", "street", "beach", "mountain", "text",
            "product", "clothing", "makeup", "tutorial", "gaming",
            "music", "performance", "crowd", "party", "wedding"
        ]
    
    def encode_text_labels(self, labels: List[str]):
        """Pre-encode text labels for efficiency"""
        text_tokens = clip.tokenize(labels).to(self.device)
        with torch.no_grad():
            text_features = self.model.encode_text(text_tokens)
            text_features /= text_features.norm(dim=-1, keepdim=True)
        return text_features
    
    def label_frame(self, frame: np.ndarray, labels: List[str] = None, top_k: int = 5) -> Dict[str, Any]:
        """
        Label a single frame
        Args:
            frame: OpenCV frame (BGR)
            labels: Custom labels or use defaults
            top_k: Return top K predictions
        """
        if labels is None:
            labels = self.default_labels
            
        # Convert BGR to RGB and prepare for CLIP
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        pil_image = Image.fromarray(frame_rgb)
        
        # Preprocess image
        image_input = self.preprocess(pil_image).unsqueeze(0).to(self.device)
        
        # Encode image
        with torch.no_grad():
            image_features = self.model.encode_image(image_input)
            image_features /= image_features.norm(dim=-1, keepdim=True)
        
        # Encode text labels
        text_features = self.encode_text_labels(labels)
        
        # Calculate similarities
        similarities = (100.0 * image_features @ text_features.T).softmax(dim=-1)
        values, indices = similarities[0].topk(top_k)
        
        # Format results
        predictions = []
        for value, index in zip(values, indices):
            predictions.append({
                'label': labels[index],
                'confidence': float(value)
            })
        
        return predictions
    
    def label_frames(self, frames: List[Dict[str, Any]], labels: List[str] = None, top_k: int = 5) -> List[Dict[str, Any]]:
        """
        Label multiple frames
        Args:
            frames: List of frame dicts with 'data' and metadata
            labels: Custom labels or use defaults
            top_k: Return top K predictions per frame
        """
        if labels is None:
            labels = self.default_labels
            
        # Pre-encode text labels once
        text_features = self.encode_text_labels(labels)
        
        results = []
        for frame_info in frames:
            frame = frame_info['data']
            
            # Convert BGR to RGB
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pil_image = Image.fromarray(frame_rgb)
            
            # Preprocess
            image_input = self.preprocess(pil_image).unsqueeze(0).to(self.device)
            
            # Encode image
            with torch.no_grad():
                image_features = self.model.encode_image(image_input)
                image_features /= image_features.norm(dim=-1, keepdim=True)
            
            # Calculate similarities
            similarities = (100.0 * image_features @ text_features.T).softmax(dim=-1)
            values, indices = similarities[0].topk(top_k)
            
            # Format frame results
            frame_labels = []
            for value, index in zip(values, indices):
                frame_labels.append({
                    'label': labels[index],
                    'confidence': float(value)
                })
            
            results.append({
                'frame_number': frame_info['frame_number'],
                'timestamp': frame_info['timestamp'],
                'labels': frame_labels
            })
        
        return results
    
    def get_video_summary_labels(self, frame_labels: List[Dict[str, Any]], threshold: float = 0.3) -> List[Dict[str, Any]]:
        """
        Aggregate frame labels to get video-level labels
        """
        label_scores = {}
        label_frames = {}
        
        for frame_result in frame_labels:
            frame_num = frame_result['frame_number']
            for label_info in frame_result['labels']:
                label = label_info['label']
                confidence = label_info['confidence']
                
                if confidence >= threshold:
                    if label not in label_scores:
                        label_scores[label] = []
                        label_frames[label] = []
                    
                    label_scores[label].append(confidence)
                    label_frames[label].append(frame_num)
        
        # Calculate average confidence for each label
        summary_labels = []
        for label, scores in label_scores.items():
            summary_labels.append({
                'description': label,
                'confidence': float(np.mean(scores)),
                'frame_count': len(scores),
                'sample_frames': label_frames[label][:5]  # First 5 frames
            })
        
        # Sort by confidence
        summary_labels.sort(key=lambda x: x['confidence'], reverse=True)
        
        return summary_labels


if __name__ == "__main__":
    if len(sys.argv) > 2:
        video_path = sys.argv[1]
        output_path = sys.argv[2] if len(sys.argv) > 2 else "scene_labels.json"
        
        # Initialize scene labeler
        labeler = SceneLabeler()
        
        # Sample frames from video
        from frame_sampler import FrameSampler
        frames = FrameSampler.sample_uniform(video_path, target_fps=1.0)
        
        print(f"Processing {len(frames)} frames...")
        
        # Label all frames
        frame_labels = labeler.label_frames(frames, top_k=5)
        
        # Get video summary
        summary_labels = labeler.get_video_summary_labels(frame_labels)
        
        # Save results
        result = {
            'video_path': video_path,
            'frame_count': len(frames),
            'frame_labels': frame_labels,
            'labels': summary_labels
        }
        
        with open(output_path, 'w') as f:
            json.dump(result, f, indent=2)
        
        print(f"Results saved to {output_path}")
        print(f"Top labels: {[l['description'] for l in summary_labels[:5]]}")