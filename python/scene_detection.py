import json
import sys
from scenedetect import VideoManager, SceneManager
from scenedetect.detectors import ContentDetector
from scenedetect.frame_timecode import FrameTimecode

class SceneDetector:
    """
    Shot/Scene change detection using PySceneDetect
    """
    
    def __init__(self, threshold=20.0, min_scene_len=10):
        """
        Args:
            threshold: Threshold for detecting scene changes (lower = more sensitive)
            min_scene_len: Minimum length of a scene in frames
        """
        self.threshold = threshold
        self.min_scene_len = min_scene_len
    
    def detect_scenes(self, video_path):
        """
        Detect scene changes in video
        Returns list of scenes with start/end times and frames
        """
        # Create video manager
        video_manager = VideoManager([video_path])
        
        # Create scene manager and add detector
        scene_manager = SceneManager()
        scene_manager.add_detector(
            ContentDetector(threshold=self.threshold, min_scene_len=self.min_scene_len)
        )
        
        # Start processing
        video_manager.set_downscale_factor()  # Auto-downscale for performance
        video_manager.start()
        
        # Detect scenes
        scene_manager.detect_scenes(video_manager)
        
        # Get scene list with timecodes
        scene_list = scene_manager.get_scene_list()
        
        # Get FPS for frame calculations
        fps = video_manager.get_framerate()
        
        # Format results
        scenes = []
        for i, (start_time, end_time) in enumerate(scene_list):
            scenes.append({
                'scene_id': i,
                'start_time': start_time.get_seconds(),
                'end_time': end_time.get_seconds(),
                'start_frame': start_time.get_frames(),
                'end_frame': end_time.get_frames(),
                'duration': (end_time - start_time).get_seconds()
            })
        
        # Clean up
        video_manager.release()
        
        return {
            'video_path': video_path,
            'fps': fps,
            'total_scenes': len(scenes),
            'shots': scenes
        }
    
    def get_keyframes(self, video_path):
        """
        Extract a keyframe from each detected scene
        """
        import cv2
        
        # First detect scenes
        result = self.detect_scenes(video_path)
        scenes = result['shots']
        
        keyframes = []
        cap = cv2.VideoCapture(video_path)
        
        for scene in scenes:
            # Get middle frame of each scene
            middle_frame = (scene['start_frame'] + scene['end_frame']) // 2
            
            cap.set(cv2.CAP_PROP_POS_FRAMES, middle_frame)
            ret, frame = cap.read()
            
            if ret:
                keyframes.append({
                    'scene_id': scene['scene_id'],
                    'frame_number': middle_frame,
                    'timestamp': middle_frame / result['fps'],
                    'data': frame
                })
        
        cap.release()
        return keyframes


if __name__ == "__main__":
    if len(sys.argv) > 1:
        video_path = sys.argv[1]
        
        # Initialize detector
        detector = SceneDetector(threshold=20.0)
        
        # Detect scenes
        result = detector.detect_scenes(video_path)
        
        # Output as JSON
        print(json.dumps(result, indent=2))