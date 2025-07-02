#!/usr/bin/env python3
"""
Enhanced Human Analyzer - Comprehensive person analysis for TikTok videos
Includes: Body Pose, Face Recognition, Gaze Detection, Scene Segmentation, Action Recognition
Integrates seamlessly with test_rumiai_complete_flow.js
"""

import cv2
import mediapipe as mp
import numpy as np
import json
import os
import sys
from datetime import datetime
import glob
from collections import Counter, defaultdict


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

class EnhancedHumanAnalyzer:
    def __init__(self):
        # Initialize MediaPipe solutions
        self.mp_face_mesh = mp.solutions.face_mesh
        self.mp_face_detection = mp.solutions.face_detection
        self.mp_hands = mp.solutions.hands
        self.mp_pose = mp.solutions.pose
        self.mp_selfie_segmentation = mp.solutions.selfie_segmentation
        
        # Initialize detectors
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            static_image_mode=True,
            max_num_faces=5,
            refine_landmarks=True,
            min_detection_confidence=0.5
        )
        
        self.hands = self.mp_hands.Hands(
            static_image_mode=True,
            max_num_hands=4,
            min_detection_confidence=0.5
        )
        
        # Enhanced pose detection with full body tracking
        self.pose = self.mp_pose.Pose(
            static_image_mode=True,
            model_complexity=2,
            enable_segmentation=True,
            smooth_segmentation=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        
        # Scene segmentation
        self.selfie_segmentation = self.mp_selfie_segmentation.SelfieSegmentation(
            model_selection=1
        )
        
        # Face landmarks for gaze detection
        self.LEFT_EYE_INDICES = [33, 160, 158, 133, 153, 144]
        self.RIGHT_EYE_INDICES = [362, 385, 387, 263, 373, 380]
        self.LEFT_IRIS_INDICES = [469, 470, 471, 472]
        self.RIGHT_IRIS_INDICES = [474, 475, 476, 477]
        
        # Body pose landmarks
        self.POSE_LANDMARKS = {
            'nose': 0,
            'left_shoulder': 11,
            'right_shoulder': 12,
            'left_elbow': 13,
            'right_elbow': 14,
            'left_wrist': 15,
            'right_wrist': 16,
            'left_hip': 23,
            'right_hip': 24,
            'left_knee': 25,
            'right_knee': 26,
            'left_ankle': 27,
            'right_ankle': 28
        }
        
        # Action patterns
        self.action_patterns = {
            'talking': self._check_talking,
            'dancing': self._check_dancing,
            'pointing': self._check_pointing_action,
            'walking': self._check_walking,
            'sitting': self._check_sitting,
            'standing': self._check_standing,
            'gesturing': self._check_gesturing,
            'demonstrating': self._check_demonstrating
        }
    
    def analyze_frame(self, image, frame_number, timestamp):
        """Comprehensive frame analysis with reduced output"""
        results = {
            'frame': frame_number,
            'timestamp': timestamp,
            'person_presence': {},
            'face_summary': {},
            'body_summary': {},
            'action_recognition': {},
            'scene_summary': {}
        }

        # Convert to RGB
        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        h, w = image.shape[:2]

        # 1. Body Pose Detection (store summary only)
        pose_results = self.pose.process(rgb_image)
        if pose_results.pose_landmarks:
            body_analysis = self._analyze_body_pose(pose_results.pose_landmarks, w, h)
            visibility_score = np.mean([lm.visibility for lm in pose_results.pose_landmarks.landmark])

            results['body_summary'] = {
                'posture': body_analysis['posture'],
                'body_orientation': body_analysis['body_orientation'],
                'gesture_complexity': round(body_analysis['gesture_complexity'], 3),
                'body_visibility_ratio': round(float(visibility_score), 3)
            }

        # 2. Face Detection (store summary only)
        face_results = self.face_mesh.process(rgb_image)
        if face_results.multi_face_landmarks:
            faces = []
            for idx, face_landmarks in enumerate(face_results.multi_face_landmarks):
                # Only analyze, don't store landmarks
                expression = self._analyze_expression(face_landmarks.landmark, w, h)
                gaze = self._analyze_gaze(face_landmarks.landmark, w, h)
                faces.append({'expression': expression, 'gaze': gaze})

            primary_face = faces[0] if faces else None
            results['face_summary'] = {
                'face_count': len(faces),
                'primary_expression': primary_face['expression'] if primary_face else None,
                'primary_gaze_direction': primary_face['gaze']['gaze_direction'] if primary_face else None,
                'eye_contact': primary_face['gaze']['eye_contact'] if primary_face else False
            }

        # 3. Scene Segmentation (remove internal data)
        segmentation_results = self.selfie_segmentation.process(rgb_image)
        if segmentation_results.segmentation_mask is not None:
            scene_data = self._analyze_scene_segmentation(
                segmentation_results.segmentation_mask, image
            )
            results['scene_summary'] = {
                'person_to_background_ratio': round(scene_data['person_to_background_ratio'], 3),
                'background_type': scene_data['background_type']
            }

        # 4. Action Recognition
        results['action_recognition'] = self._recognize_actions(
            pose_results, face_results, results.get('body_summary', {})
        )

        # 5. Person Presence Summary
        results['person_presence'] = {
            'has_face': bool(face_results.multi_face_landmarks),
            'has_body': bool(pose_results.pose_landmarks),
            'face_count': len(face_results.multi_face_landmarks) if face_results.multi_face_landmarks else 0
        }

        return results
    
    def _analyze_body_pose(self, landmarks, w, h):
        """Analyze body pose and posture"""
        pose_data = {
            'posture': 'unknown',
            'body_orientation': 'unknown',
            'gesture_complexity': 0,
            'movement_intensity': 0,
            'key_points': {}
        }
        
        # Extract key body points
        for name, idx in self.POSE_LANDMARKS.items():
            if idx < len(landmarks.landmark):
                lm = landmarks.landmark[idx]
                pose_data['key_points'][name] = {
                    'x': float(lm.x),
                    'y': float(lm.y),
                    'z': float(lm.z),
                    'visibility': float(lm.visibility)
                }
        
        # Determine posture (sitting/standing)
        if all(k in pose_data['key_points'] for k in ['left_hip', 'left_knee', 'left_ankle']):
            hip_y = pose_data['key_points']['left_hip']['y']
            knee_y = pose_data['key_points']['left_knee']['y']
            ankle_y = pose_data['key_points']['left_ankle']['y']
            
            # Check if sitting (knees are bent significantly)
            if abs(hip_y - knee_y) < 0.15 and abs(knee_y - ankle_y) > 0.1:
                pose_data['posture'] = 'sitting'
            else:
                pose_data['posture'] = 'standing'
        
        # Determine body orientation
        if all(k in pose_data['key_points'] for k in ['left_shoulder', 'right_shoulder']):
            left_shoulder = pose_data['key_points']['left_shoulder']
            right_shoulder = pose_data['key_points']['right_shoulder']
            
            shoulder_diff = abs(left_shoulder['z'] - right_shoulder['z'])
            if shoulder_diff < 0.05:
                pose_data['body_orientation'] = 'facing_camera'
            elif left_shoulder['z'] > right_shoulder['z']:
                pose_data['body_orientation'] = 'turned_right'
            else:
                pose_data['body_orientation'] = 'turned_left'
        
        # Calculate gesture complexity based on arm positions
        arm_points = ['left_wrist', 'right_wrist', 'left_elbow', 'right_elbow']
        visible_arms = sum(1 for p in arm_points if p in pose_data['key_points'] and pose_data['key_points'][p]['visibility'] > 0.5)
        pose_data['gesture_complexity'] = visible_arms / 4.0
        
        return pose_data
    
    def _analyze_gaze(self, landmarks, w, h):
        """Analyze gaze direction and eye contact"""
        gaze_data = {
            'eye_contact': False,
            'gaze_direction': 'unknown',
            'eye_openness': 1.0,
            'reading_pattern': False
        }
        
        # Get eye landmarks
        left_eye_points = [landmarks[i] for i in self.LEFT_EYE_INDICES]
        right_eye_points = [landmarks[i] for i in self.RIGHT_EYE_INDICES]
        
        # Calculate eye centers
        left_center = np.mean([[p.x, p.y] for p in left_eye_points], axis=0)
        right_center = np.mean([[p.x, p.y] for p in right_eye_points], axis=0)
        
        # Check if looking at camera (simplified)
        face_center_x = (left_center[0] + right_center[0]) / 2
        if 0.45 < face_center_x < 0.55:  # Face is centered
            gaze_data['eye_contact'] = True
            gaze_data['gaze_direction'] = 'camera'
        elif face_center_x < 0.45:
            gaze_data['gaze_direction'] = 'left'
        else:
            gaze_data['gaze_direction'] = 'right'
        
        # Check eye openness
        left_eye_height = abs(landmarks[159].y - landmarks[145].y)
        right_eye_height = abs(landmarks[386].y - landmarks[374].y)
        avg_eye_height = (left_eye_height + right_eye_height) / 2
        gaze_data['eye_openness'] = min(avg_eye_height * 20, 1.0)  # Normalize
        
        return gaze_data
    
    def _analyze_scene_segmentation(self, mask, original_image):
        """Analyze scene segmentation for background complexity"""
        h, w = mask.shape
        
        # Calculate person to background ratio
        person_pixels = np.sum(mask > 0.5)
        total_pixels = h * w
        person_ratio = person_pixels / total_pixels
        
        # Analyze background complexity (edges in background area)
        background_mask = mask < 0.5
        background_region = cv2.bitwise_and(original_image, original_image, mask=(background_mask * 255).astype(np.uint8))
        
        # Convert to grayscale and detect edges
        gray_bg = cv2.cvtColor(background_region, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray_bg, 50, 150)
        edge_pixels = np.sum(edges > 0)
        
        # Background complexity score
        background_pixels = np.sum(background_mask)
        complexity_score = edge_pixels / background_pixels if background_pixels > 0 else 0
        
        # Extract background for change detection
        # Store histogram and features for comparison
        hist = cv2.calcHist([gray_bg], [0], (background_mask * 255).astype(np.uint8), [64], [0, 256])
        hist = cv2.normalize(hist, hist).flatten()
        
        return {
            'person_to_background_ratio': float(person_ratio),
            'background_complexity': float(complexity_score),
            'background_type': 'complex' if complexity_score > 0.1 else 'simple',
            'person_screen_coverage': float(person_ratio),
            # '_background_histogram': hist,  # COMMENTED OUT
            # '_background_mask': background_mask  # COMMENTED OUT
        }
    
    def _recognize_actions(self, pose_results, face_results, body_pose):
        """Recognize actions based on pose and movement"""
        actions = {
            'primary_action': 'unknown',
            'action_confidence': 0.0,
            'detected_actions': []
        }
        
        if not pose_results.pose_landmarks:
            return actions
        
        # Check each action pattern
        action_scores = {}
        for action_name, check_func in self.action_patterns.items():
            score = check_func(pose_results.pose_landmarks, body_pose if isinstance(body_pose, dict) else {})
            if score > 0.5:
                action_scores[action_name] = score
                actions['detected_actions'].append(action_name)
        
        # Determine primary action
        if action_scores:
            primary = max(action_scores.items(), key=lambda x: x[1])
            actions['primary_action'] = primary[0]
            actions['action_confidence'] = primary[1]
        
        return actions
    
    def _check_talking(self, landmarks, body_pose):
        """Check if person is talking (relatively still, facing camera)"""
        if body_pose.get('body_orientation') == 'facing_camera' and body_pose.get('gesture_complexity', 0) < 0.5:
            return 0.8
        return 0.2
    
    def _check_dancing(self, landmarks, body_pose):
        """Check if person is dancing (high movement, rhythm)"""
        if body_pose.get('gesture_complexity', 0) > 0.7:
            return 0.9
        return 0.1
    
    def _check_pointing_action(self, landmarks, body_pose):
        """Check if person is pointing"""
        # Check if arm is extended
        if 'right_wrist' in body_pose.get('key_points', {}):
            wrist = body_pose['key_points']['right_wrist']
            shoulder = body_pose['key_points'].get('right_shoulder', {})
            if wrist.get('visibility', 0) > 0.5 and abs(wrist.get('y', 0) - shoulder.get('y', 0)) < 0.2:
                return 0.8
        return 0.2
    
    def _check_walking(self, landmarks, body_pose):
        """Check if person is walking"""
        # Simplified check - would need temporal data for accurate detection
        return 0.3
    
    def _check_sitting(self, landmarks, body_pose):
        """Check if person is sitting"""
        return 1.0 if body_pose.get('posture') == 'sitting' else 0.0
    
    def _check_standing(self, landmarks, body_pose):
        """Check if person is standing"""
        return 1.0 if body_pose.get('posture') == 'standing' else 0.0
    
    def _check_gesturing(self, landmarks, body_pose):
        """Check if person is gesturing"""
        return body_pose.get('gesture_complexity', 0)
    
    def _check_demonstrating(self, landmarks, body_pose):
        """Check if person is demonstrating something"""
        # High gesture complexity while standing
        if body_pose.get('posture') == 'standing' and body_pose.get('gesture_complexity', 0) > 0.6:
            return 0.8
        return 0.2
    
    def _get_face_bbox(self, landmarks, w, h):
        """Get face bounding box from landmarks"""
        x_coords = [lm.x * w for lm in landmarks]
        y_coords = [lm.y * h for lm in landmarks]
        return {
            'x1': int(min(x_coords)),
            'y1': int(min(y_coords)),
            'x2': int(max(x_coords)),
            'y2': int(max(y_coords))
        }
    
    def _extract_key_landmarks(self, landmarks):
        """Extract key facial landmarks"""
        return {
            'nose_tip': {'x': landmarks[1].x, 'y': landmarks[1].y},
            'left_eye': {'x': landmarks[33].x, 'y': landmarks[33].y},
            'right_eye': {'x': landmarks[263].x, 'y': landmarks[263].y},
            'mouth_center': {'x': landmarks[13].x, 'y': landmarks[13].y}
        }
    
    def _analyze_expression(self, landmarks, w, h):
        """Analyze facial expression"""
        # Simplified expression analysis
        mouth_landmarks = [landmarks[i] for i in [61, 291, 39, 269]]
        mouth_height = abs(mouth_landmarks[0].y - mouth_landmarks[1].y)
        
        if mouth_height > 0.03:
            return 'surprised'
        elif mouth_height < 0.01:
            return 'neutral'
        else:
            return 'happy'
    
    def _aggregate_gaze_data(self, faces):
        """Aggregate gaze data from all faces"""
        if not faces:
            return {}
        
        primary_face = faces[0]
        eye_contact_ratio = sum(1 for f in faces if f['gaze']['eye_contact']) / len(faces)
        
        return {
            'primary_gaze_direction': primary_face['gaze']['gaze_direction'],
            'eye_contact_ratio': eye_contact_ratio,
            'primary_eye_contact': primary_face['gaze']['eye_contact'],
            'average_eye_openness': np.mean([f['gaze']['eye_openness'] for f in faces])
        }
    
    def analyze_video(self, video_id):
        """Analyze all frames for a video"""
        # Input/output paths
        frames_dir = f'frame_outputs/{video_id}'
        output_dir = f'enhanced_human_analysis_outputs/{video_id}'
        os.makedirs(output_dir, exist_ok=True)
        
        # Get all frames
        frame_files = sorted(glob.glob(os.path.join(frames_dir, '*.jpg')))
        if not frame_files:
            print(f"No frames found in {frames_dir}")
            return None
        
        all_results = {
            'video_id': video_id,
            'total_frames': len(frame_files),
            'analyzed_at': datetime.now().isoformat(),
            'frame_analyses': [],
            'summary': {}
        }
        
        # Process each frame
        print(f"Analyzing {len(frame_files)} frames...")
        for frame_file in frame_files:
            # Extract frame info
            frame_name = os.path.basename(frame_file)
            parts = frame_name.split('_')
            frame_number = int(parts[1])
            timestamp = float(parts[2].replace('t', '').replace('.jpg', ''))
            
            # Read and analyze frame
            image = cv2.imread(frame_file)
            if image is None:
                continue
            
            frame_results = self.analyze_frame(image, frame_number, timestamp)
            all_results['frame_analyses'].append(frame_results)
        
        # Generate summary
        all_results['summary'] = self._generate_summary(all_results['frame_analyses'])
        
        # Save results
        output_path = os.path.join(output_dir, f'{video_id}_enhanced_human_analysis.json')
        with open(output_path, 'w') as f:
            json.dump(all_results, f, indent=2, cls=NumpyEncoder)
        
        print(f"Enhanced human analysis saved to {output_path}")
        return all_results
    
    def _detect_background_changes(self, frame_analyses):
        """Detect background changes through temporal analysis"""
        background_changes = []
        change_magnitudes = []
        
        # Sample every 5th frame for efficiency
        sample_interval = 5
        sampled_frames = frame_analyses[::sample_interval]
        
        for i in range(1, len(sampled_frames)):
            prev_frame = sampled_frames[i-1]
            curr_frame = sampled_frames[i]
            
            # Check if both frames have segmentation data
            if 'scene_segmentation' in prev_frame and 'scene_segmentation' in curr_frame:
                prev_seg = prev_frame['scene_segmentation']
                curr_seg = curr_frame['scene_segmentation']
                
                # Compare histograms if available
                if '_background_histogram' in prev_seg and '_background_histogram' in curr_seg:
                    # Calculate histogram correlation
                    correlation = cv2.compareHist(
                        prev_seg['_background_histogram'], 
                        curr_seg['_background_histogram'],
                        cv2.HISTCMP_CORREL
                    )
                    
                    # Calculate change magnitude (1 - correlation)
                    change_magnitude = 1 - correlation
                    change_magnitudes.append(change_magnitude)
                    
                    # Threshold for significant change
                    if change_magnitude > 0.3:  # 30% change threshold
                        change_type = 'minor'
                        if change_magnitude > 0.5:
                            change_type = 'moderate'
                        if change_magnitude > 0.7:
                            change_type = 'major'
                        
                        background_changes.append({
                            'timestamp': curr_frame['timestamp'],
                            'frame': curr_frame['frame'],
                            'change_type': change_type,
                            'magnitude': float(change_magnitude)
                        })
        
        # Classify background stability
        if not change_magnitudes:
            background_stability = 'unknown'
        else:
            avg_change = np.mean(change_magnitudes)
            if avg_change < 0.1:
                background_stability = 'static'
            elif avg_change < 0.3:
                background_stability = 'mostly_static'
            elif avg_change < 0.5:
                background_stability = 'dynamic'
            else:
                background_stability = 'highly_dynamic'
        
        return {
            'background_changes': background_changes,
            'background_stability': background_stability,
            'change_frequency': len(background_changes),
            'avg_change_magnitude': float(np.mean(change_magnitudes)) if change_magnitudes else 0
        }
    
    def _generate_summary(self, frame_analyses):
        """Generate summary statistics"""
        summary = {
            'face_screen_time_ratio': 0,
            'person_screen_time_ratio': 0,
            'avg_camera_distance': 'unknown',
            'framing_volatility': 0,
            'dominant_shot_type': 'unknown',
            'intro_shot_type': 'unknown',
            'subject_absence_count': 0,
            'multiple_person_frames': 0,
            'primary_actions': Counter(),
            'gaze_patterns': {
                'eye_contact_ratio': 0,
                'primary_gaze_direction': Counter()
            },
            'scene_analysis': {
                'avg_person_coverage': 0,
                'background_complexity': 'simple',
                'background_changes': {}  # Will be populated
            }
        }
        
        # Calculate metrics
        frames_with_face = sum(1 for f in frame_analyses if f['person_presence']['has_face'])
        frames_with_person = sum(1 for f in frame_analyses if f['person_presence']['has_body'])
        
        summary['face_screen_time_ratio'] = frames_with_face / len(frame_analyses) if frame_analyses else 0
        summary['person_screen_time_ratio'] = frames_with_person / len(frame_analyses) if frame_analyses else 0
        
        # Subject absence
        summary['subject_absence_count'] = sum(1 for f in frame_analyses 
                                              if not f['person_presence']['has_face'] 
                                              and not f['person_presence']['has_body'])
        
        # Multiple people
        summary['multiple_person_frames'] = sum(1 for f in frame_analyses 
                                              if f['person_presence'].get('face_count', 0) > 1)
        
        # Actions
        for frame in frame_analyses:
            if frame['action_recognition']['primary_action'] != 'unknown':
                summary['primary_actions'][frame['action_recognition']['primary_action']] += 1
        
        # Gaze patterns
        eye_contact_frames = sum(1 for f in frame_analyses 
                               if f.get('face_summary', {}).get('eye_contact', False))
        summary['gaze_patterns']['eye_contact_ratio'] = eye_contact_frames / len(frame_analyses) if frame_analyses else 0
        
        # Scene analysis
        person_coverages = [f['scene_summary'].get('person_to_background_ratio', 0) 
                           for f in frame_analyses if 'scene_summary' in f]
        if person_coverages:
            summary['scene_analysis']['avg_person_coverage'] = np.mean(person_coverages)
        
        # Detect background changes
        background_change_analysis = self._detect_background_changes(frame_analyses)
        summary['scene_analysis']['background_changes'] = background_change_analysis
        
        # Intro shot type (first 3 seconds)
        intro_frames = [f for f in frame_analyses if f['timestamp'] < 3.0]
        if intro_frames and intro_frames[0]['person_presence']['has_face']:
            summary['intro_shot_type'] = 'face_focused'
        elif intro_frames and intro_frames[0]['person_presence']['has_body']:
            summary['intro_shot_type'] = 'full_body'
        else:
            summary['intro_shot_type'] = 'no_person'
        
        return summary


def main():
    if len(sys.argv) < 2:
        print("Usage: python enhanced_human_analyzer.py <video_id>")
        sys.exit(1)
    
    video_id = sys.argv[1]
    analyzer = EnhancedHumanAnalyzer()
    analyzer.analyze_video(video_id)


if __name__ == "__main__":
    main()