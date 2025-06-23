#!/usr/bin/env python3
"""
Integrated Full Pipeline with All Detection Methods
Combines: YOLO, Creative Elements, MediaPipe, and Quick Detectors
"""

import os
import subprocess
import json
import time
import glob
from datetime import datetime
from pathlib import Path

class IntegratedFullPipeline:
    def __init__(self):
        self.input_dir = "inputs"
        self.frame_output_dir = "frame_outputs"
        self.detection_outputs = {
            'yolo': 'object_detection_outputs',
            'creative': 'creative_analysis_outputs',
            'human': 'human_analysis_outputs',
            'comprehensive': 'comprehensive_analysis_outputs'
        }
        self.processed_videos_file = "integrated_processed_videos.json"
        self.processed_videos = self.load_processed_videos()
        
        # Ensure all output directories exist
        for output_dir in self.detection_outputs.values():
            os.makedirs(output_dir, exist_ok=True)
    
    def load_processed_videos(self):
        """Load list of fully processed videos"""
        if os.path.exists(self.processed_videos_file):
            try:
                with open(self.processed_videos_file, 'r') as f:
                    return set(json.load(f))
            except:
                return set()
        return set()
    
    def save_processed_videos(self):
        """Save list of processed videos"""
        with open(self.processed_videos_file, 'w') as f:
            json.dump(list(self.processed_videos), f, indent=2)
    
    def process_single_video(self, video_path):
        """Process a single video through ALL detection pipelines"""
        # Check for environment variable override for video ID
        video_id = os.environ.get('VIDEO_ID')
        if not video_id:
            video_id = os.path.basename(video_path).replace('.mp4', '').replace('.avi', '').replace('.mov', '').replace('.mkv', '')
        
        print(f"\n{'='*80}")
        print(f"🎬 INTEGRATED PIPELINE PROCESSING: {video_id}")
        print(f"{'='*80}")
        
        start_time = time.time()
        
        try:
            # Step 1: Extract frames
            print(f"\n📷 Step 1/5: Extracting frames...")
            frame_result = subprocess.run(
                ['python3', 'automated_video_pipeline.py', 'once'],
                capture_output=True,
                text=True
            )
            
            if frame_result.returncode != 0:
                print(f"❌ Frame extraction failed: {frame_result.stderr}")
                return False
            
            # Verify frames
            frame_dir = os.path.join(self.frame_output_dir, video_id)
            frames = glob.glob(os.path.join(frame_dir, '*.jpg'))
            print(f"✅ Extracted {len(frames)} frames")
            
            # Step 2: YOLO object detection
            print(f"\n🎯 Step 2/5: Running YOLO object detection...")
            yolo_result = subprocess.run(
                ['python3', 'run_yolo_detection.py'],
                capture_output=True,
                text=True
            )
            print(f"✅ YOLO detection complete")
            
            # Step 3: Creative elements detection (EasyOCR + custom)
            print(f"\n🎨 Step 3/5: Detecting creative elements...")
            creative_result = subprocess.run(
                ['python3', 'detect_tiktok_creative_elements.py', video_id],
                capture_output=True,
                text=True
            )
            print(f"✅ Creative elements detection complete")
            
            # Step 4: MediaPipe human detection
            print(f"\n🎭 Step 4/5: Analyzing human elements...")
            mediapipe_result = subprocess.run(
                ['python3', 'mediapipe_human_detector.py', video_id],
                capture_output=True,
                text=True
            )
            print(f"✅ Human elements analysis complete")
            
            # Step 5: Aggregate all results
            print(f"\n📊 Step 5/5: Aggregating comprehensive analysis...")
            comprehensive_analysis = self.aggregate_all_results(video_id)
            
            # Save comprehensive analysis
            output_file = os.path.join(
                self.detection_outputs['comprehensive'], 
                f'{video_id}_comprehensive_analysis.json'
            )
            
            with open(output_file, 'w') as f:
                json.dump(comprehensive_analysis, f, indent=2)
            
            print(f"💾 Saved comprehensive analysis: {output_file}")
            
            # Generate Claude-ready prompt
            claude_prompt = self.generate_claude_prompt(comprehensive_analysis)
            prompt_file = os.path.join(
                self.detection_outputs['comprehensive'],
                f'{video_id}_claude_prompt.json'
            )
            
            with open(prompt_file, 'w') as f:
                json.dump(claude_prompt, f, indent=2)
            
            # Mark as processed
            self.processed_videos.add(video_path)
            self.save_processed_videos()
            
            # Print comprehensive summary
            elapsed_time = time.time() - start_time
            self.print_comprehensive_summary(comprehensive_analysis, elapsed_time)
            
            return True
            
        except Exception as e:
            print(f"❌ Pipeline error: {e}")
            return False
    
    def aggregate_all_results(self, video_id):
        """Aggregate results from all detection methods"""
        results = {
            'video_id': video_id,
            'processed_at': datetime.now().isoformat(),
            'frame_count': 0,
            'detections': {
                'yolo': {},
                'creative': {},
                'human': {}
            },
            'insights': {},
            'timeline': {},
            'claude_data': {}
        }
        
        # Load frame metadata
        metadata_path = os.path.join(self.frame_output_dir, video_id, 'metadata.json')
        if os.path.exists(metadata_path):
            with open(metadata_path, 'r') as f:
                metadata = json.load(f)
                results['frame_count'] = metadata['frame_count']
                results['fps'] = metadata['fps']
                results['duration_seconds'] = results['frame_count'] / results['fps']
        
        # Load YOLO results
        yolo_path = os.path.join(
            self.detection_outputs['yolo'], 
            video_id, 
            f'{video_id}_yolo_detections.json'
        )
        if os.path.exists(yolo_path):
            with open(yolo_path, 'r') as f:
                yolo_data = json.load(f)
                results['detections']['yolo'] = {
                    'summary': yolo_data['summary'],
                    'timeline': yolo_data.get('object_timeline', {})
                }
        
        # Load creative elements results
        creative_path = os.path.join(
            self.detection_outputs['creative'],
            video_id,
            f'{video_id}_creative_analysis.json'
        )
        if os.path.exists(creative_path):
            with open(creative_path, 'r') as f:
                creative_data = json.load(f)
                results['detections']['creative'] = creative_data['insights']
                
                # Extract text content
                text_elements = []
                for frame in creative_data.get('frame_details', []):
                    for text in frame.get('text_elements', []):
                        text_elements.append({
                            'text': text['text'],
                            'category': text.get('category', 'unknown'),
                            'frame': frame['frame']
                        })
                results['detections']['creative']['text_content'] = text_elements
        
        # Load human analysis results
        human_path = os.path.join(
            self.detection_outputs['human'],
            video_id,
            f'{video_id}_human_analysis.json'
        )
        if os.path.exists(human_path):
            with open(human_path, 'r') as f:
                human_data = json.load(f)
                results['detections']['human'] = human_data['insights']
        
        # Generate comprehensive insights
        results['insights'] = self.generate_comprehensive_insights(results)
        
        # Create unified timeline
        results['timeline'] = self.create_unified_timeline(results)
        
        # Prepare Claude-optimized data
        results['claude_data'] = self.prepare_claude_data(results)
        
        return results
    
    def generate_comprehensive_insights(self, results):
        """Generate insights from all detection methods"""
        insights = {
            'content_type': 'unknown',
            'engagement_score': 0,
            'key_elements': [],
            'optimization_suggestions': []
        }
        
        # Determine content type
        has_person = 'person' in results['detections']['yolo'].get('summary', {}).get('unique_object_types', [])
        has_dancing = results['detections']['human'].get('dominant_expressions', [])
        creative_density = results['detections']['creative'].get('creative_density', 0)
        
        if has_person and has_dancing:
            insights['content_type'] = 'dance_content'
        elif has_person and creative_density > 15:
            insights['content_type'] = 'influencer_content'
        elif results['detections']['creative'].get('cta_frames', []):
            insights['content_type'] = 'promotional_content'
        else:
            insights['content_type'] = 'general_content'
        
        # Calculate engagement score (0-100)
        score = 0
        
        # Creative elements contribution
        if creative_density > 10:
            score += 20
        if results['detections']['creative'].get('text_coverage', 0) > 0.7:
            score += 15
        if results['detections']['creative'].get('cta_frames', []):
            score += 20
        
        # Human elements contribution
        if results['detections']['human'].get('engagement_rate', 0) > 0.5:
            score += 25
        if results['detections']['human'].get('gesture_count', 0) > 5:
            score += 10
        if results['detections']['human'].get('expression_variety', 0) > 2:
            score += 10
        
        insights['engagement_score'] = min(score, 100)
        
        # Key elements
        key_elements = []
        
        # From YOLO
        objects = results['detections']['yolo'].get('summary', {}).get('unique_object_types', [])
        if objects:
            key_elements.append(f"Objects: {', '.join(objects[:3])}")
        
        # From Creative
        if results['detections']['creative'].get('cta_frames', []):
            key_elements.append("Contains CTAs")
        if creative_density > 15:
            key_elements.append("High creative density")
        
        # From Human
        expressions = results['detections']['human'].get('dominant_expressions', [])
        if expressions:
            key_elements.append(f"Expressions: {', '.join(expressions[:2])}")
        
        gestures = results['detections']['human'].get('dominant_gestures', [])
        if gestures:
            key_elements.append(f"Gestures: {', '.join(gestures[:2])}")
        
        insights['key_elements'] = key_elements
        
        # Optimization suggestions
        suggestions = []
        
        if score < 50:
            suggestions.append("Consider adding more engaging visual elements")
        
        if not results['detections']['creative'].get('cta_frames', []):
            suggestions.append("Add clear call-to-action elements")
        
        if results['detections']['human'].get('human_presence', 0) < 0.5:
            suggestions.append("Increase human presence for better connection")
        
        if creative_density < 5:
            suggestions.append("Add more text overlays and creative elements")
        
        insights['optimization_suggestions'] = suggestions
        
        return insights
    
    def create_unified_timeline(self, results):
        """Create a unified timeline of all events"""
        timeline = {
            'events': [],
            'key_moments': []
        }
        
        frame_count = results['frame_count']
        
        # Add YOLO events
        yolo_timeline = results['detections']['yolo'].get('timeline', {})
        for obj_type, appearances in yolo_timeline.items():
            for appearance in appearances:
                timeline['events'].append({
                    'frame': appearance['frame'],
                    'type': 'object',
                    'description': f"{obj_type} detected",
                    'source': 'yolo'
                })
        
        # Add creative events
        creative_timeline = results['detections']['creative'].get('creative_moments', {})
        for cta_frame in creative_timeline.get('cta_timeline', []):
            timeline['events'].append({
                'frame': cta_frame,
                'type': 'cta',
                'description': "Call-to-action displayed",
                'source': 'creative'
            })
        
        # Add human events
        human_timeline = results['detections']['human'].get('timeline', {})
        for expression in human_timeline.get('expressions', []):
            timeline['events'].append({
                'frame': expression['frame'],
                'type': 'expression',
                'description': f"{expression['expression']} expression",
                'source': 'human'
            })
        
        for gesture in human_timeline.get('gestures', []):
            timeline['events'].append({
                'frame': gesture['frame'],
                'type': 'gesture',
                'description': f"{gesture['gesture']} gesture",
                'source': 'human'
            })
        
        # Sort events by frame
        timeline['events'].sort(key=lambda x: x['frame'])
        
        # Identify key moments
        # Opening hook (first 20% of video)
        opening_events = [e for e in timeline['events'] if e['frame'] <= frame_count * 0.2]
        if opening_events:
            timeline['key_moments'].append({
                'moment': 'opening_hook',
                'frames': [e['frame'] for e in opening_events],
                'description': "Initial engagement elements"
            })
        
        # CTA concentration
        cta_frames = [e['frame'] for e in timeline['events'] if e['type'] == 'cta']
        if cta_frames:
            timeline['key_moments'].append({
                'moment': 'cta_peak',
                'frames': cta_frames,
                'description': "Peak call-to-action moment"
            })
        
        # Gesture moments
        gesture_frames = [e['frame'] for e in timeline['events'] if e['type'] == 'gesture']
        if gesture_frames:
            timeline['key_moments'].append({
                'moment': 'gesture_interaction',
                'frames': gesture_frames[:5],  # Top 5
                'description': "Key gesture interactions"
            })
        
        return timeline
    
    def prepare_claude_data(self, results):
        """Prepare data optimized for Claude analysis"""
        claude_data = {
            'video_summary': {
                'duration': f"{results.get('duration_seconds', 0):.1f} seconds",
                'content_type': results['insights']['content_type'],
                'engagement_score': results['insights']['engagement_score']
            },
            'visual_elements': {
                'objects': results['detections']['yolo'].get('summary', {}).get('unique_object_types', []),
                'object_count': results['detections']['yolo'].get('summary', {}).get('total_detections', 0)
            },
            'creative_elements': {
                'density': results['detections']['creative'].get('creative_density', 0),
                'text_coverage': results['detections']['creative'].get('text_coverage', 0),
                'has_cta': len(results['detections']['creative'].get('cta_frames', [])) > 0,
                'cta_timing': results['detections']['creative'].get('cta_frames', [])
            },
            'human_elements': {
                'presence_rate': results['detections']['human'].get('human_presence', 0),
                'expressions': results['detections']['human'].get('dominant_expressions', []),
                'gestures': results['detections']['human'].get('dominant_gestures', []),
                'engagement_rate': results['detections']['human'].get('engagement_rate', 0)
            },
            'key_text': [t['text'] for t in results['detections']['creative'].get('text_content', [])[:10]],
            'timeline_highlights': results['timeline']['key_moments']
        }
        
        return claude_data
    
    def generate_claude_prompt(self, analysis):
        """Generate a comprehensive prompt for Claude"""
        claude_data = analysis['claude_data']
        
        prompt = {
            'system': "You are analyzing a TikTok video to provide insights on engagement, effectiveness, and optimization opportunities.",
            'video_data': claude_data,
            'questions': [
                "What is the primary engagement strategy of this video?",
                "How effective is the timing and placement of creative elements?",
                "What role do human expressions and gestures play in viewer engagement?",
                "What are the top 3 optimization opportunities?",
                "How does this video compare to high-performing TikTok content patterns?"
            ],
            'analysis_request': """
            Based on the comprehensive detection data provided, please analyze:
            1. Content Strategy: How the creator uses visual, creative, and human elements
            2. Engagement Tactics: Specific techniques to capture and retain attention
            3. Emotional Journey: How expressions and gestures guide viewer emotions
            4. CTA Effectiveness: Placement, timing, and clarity of calls-to-action
            5. Optimization Recommendations: Specific, actionable improvements
            
            Provide insights that would help creators improve their TikTok performance.
            """
        }
        
        return prompt
    
    def print_comprehensive_summary(self, analysis, elapsed_time):
        """Print a comprehensive summary of all detections"""
        print(f"\n\n{'='*80}")
        print(f"✨ COMPREHENSIVE ANALYSIS COMPLETE")
        print(f"{'='*80}")
        
        print(f"\n📊 Video Overview:")
        print(f"   Video ID: {analysis['video_id']}")
        print(f"   Duration: {analysis.get('duration_seconds', 0):.1f} seconds")
        print(f"   Total Frames: {analysis['frame_count']}")
        print(f"   Processing Time: {elapsed_time:.1f} seconds")
        
        print(f"\n🎯 Content Analysis:")
        print(f"   Content Type: {analysis['insights']['content_type']}")
        print(f"   Engagement Score: {analysis['insights']['engagement_score']}/100")
        
        print(f"\n📦 Detection Summary:")
        
        # YOLO
        yolo_summary = analysis['detections']['yolo'].get('summary', {})
        print(f"\n   YOLO Objects:")
        print(f"      - Total detections: {yolo_summary.get('total_detections', 0)}")
        print(f"      - Object types: {', '.join(yolo_summary.get('unique_object_types', []))}")
        
        # Creative
        creative = analysis['detections']['creative']
        print(f"\n   Creative Elements:")
        print(f"      - Elements per frame: {creative.get('creative_density', 0):.1f}")
        print(f"      - Text coverage: {creative.get('text_coverage', 0)*100:.0f}%")
        print(f"      - CTA frames: {len(creative.get('cta_frames', []))}")
        
        # Human
        human = analysis['detections']['human']
        print(f"\n   Human Elements:")
        print(f"      - Human presence: {human.get('human_presence', 0)*100:.0f}%")
        print(f"      - Expressions detected: {human.get('expression_variety', 0)}")
        print(f"      - Gestures count: {human.get('gesture_count', 0)}")
        print(f"      - Engagement rate: {human.get('engagement_rate', 0)*100:.0f}%")
        
        print(f"\n🔑 Key Elements:")
        for element in analysis['insights']['key_elements']:
            print(f"   - {element}")
        
        print(f"\n💡 Optimization Suggestions:")
        for i, suggestion in enumerate(analysis['insights']['optimization_suggestions'], 1):
            print(f"   {i}. {suggestion}")
        
        print(f"\n🎬 Key Moments:")
        for moment in analysis['timeline']['key_moments']:
            print(f"   - {moment['description']} (frames: {moment['frames'][:3]}...)")
        
        print(f"\n{'='*80}")
    
    def scan_for_new_videos(self):
        """Scan for videos that haven't been fully processed"""
        video_patterns = ['*.mp4', '*.avi', '*.mov', '*.mkv']
        new_videos = []
        
        for pattern in video_patterns:
            for video_path in glob.glob(os.path.join(self.input_dir, pattern)):
                if video_path not in self.processed_videos:
                    new_videos.append(video_path)
        
        return new_videos
    
    def run_continuous(self, check_interval=15):
        """Run the pipeline continuously"""
        print("🤖 RumiAI Integrated Full Pipeline")
        print("="*80)
        print("📊 Detection Methods:")
        print("   1. YOLO - General object detection")
        print("   2. Creative Elements - Text, CTAs, UI (EasyOCR)")
        print("   3. MediaPipe - Faces, gestures, body poses")
        print("   4. Quick Detectors - Color-based CTAs, arrows")
        print(f"\n📁 Monitoring: {self.input_dir}/")
        print(f"⏱️  Check interval: {check_interval} seconds")
        print("Press Ctrl+C to stop\n")
        
        try:
            while True:
                new_videos = self.scan_for_new_videos()
                
                if new_videos:
                    print(f"\n🔍 Found {len(new_videos)} new video(s) to process")
                    for video in new_videos:
                        self.process_single_video(video)
                else:
                    print(f"\r⏳ Waiting for new videos... (Last check: {datetime.now().strftime('%H:%M:%S')})", end='', flush=True)
                
                time.sleep(check_interval)
                
        except KeyboardInterrupt:
            print("\n\n🛑 Stopping pipeline...")
            print("✅ Pipeline stopped")
    
    def run_once(self):
        """Process all pending videos once"""
        # Check if a specific video path is provided via environment variable
        video_path = os.environ.get('VIDEO_PATH')
        
        if video_path:
            print(f"🎬 Processing specified video: {video_path}")
            self.process_single_video(video_path)
            return
        
        # Otherwise, scan for new videos
        new_videos = self.scan_for_new_videos()
        
        if not new_videos:
            print("✅ All videos already processed")
            return
        
        print(f"🎬 Found {len(new_videos)} video(s) to process")
        
        for video in new_videos:
            self.process_single_video(video)


def main():
    import sys
    
    pipeline = IntegratedFullPipeline()
    
    if len(sys.argv) > 1 and sys.argv[1] == 'continuous':
        interval = int(sys.argv[2]) if len(sys.argv) > 2 else 15
        pipeline.run_continuous(check_interval=interval)
    else:
        print("🚀 RumiAI Integrated Full Pipeline - Single Run")
        print("="*80)
        print("\n🔥 This pipeline includes:")
        print("   ✅ YOLO object detection")
        print("   ✅ Creative elements (text, CTAs, UI)")
        print("   ✅ MediaPipe (faces, gestures, poses)")
        print("   ✅ Comprehensive analysis")
        print("   ✅ Claude-ready prompts\n")
        
        pipeline.run_once()
        
        print("\n💡 To run continuously, use:")
        print("   python3 integrated_full_pipeline.py continuous")
        print("   python3 integrated_full_pipeline.py continuous 30  # Check every 30 seconds")


if __name__ == "__main__":
    main()