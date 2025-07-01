#!/usr/bin/env python3
"""
Update unified analysis with all available data
"""

import json
import sys
from pathlib import Path


def update_unified_analysis(video_id):
    """Update unified analysis with all available data sources"""
    
    unified_path = Path(f'unified_analysis/{video_id}.json')
    if not unified_path.exists():
        print(f"❌ Unified analysis not found: {unified_path}")
        return False
    
    # Load existing unified analysis
    with open(unified_path, 'r') as f:
        unified = json.load(f)
    
    print(f"📋 Updating unified analysis for {video_id}")
    
    # 1. Load TikTok metadata
    metadata_paths = [
        f'temp/tiktok_profiles/{video_id}_metadata.json',
        f'outputs/tiktok_profiles/{video_id}_metadata.json'
    ]
    
    for path in metadata_paths:
        if Path(path).exists():
            with open(path, 'r') as f:
                metadata = json.load(f)
                
            # Update static metadata
            unified['static_metadata'] = {
                'captionText': metadata.get('text', ''),
                'hashtags': [h['name'] for h in metadata.get('hashtags', []) if h.get('name')],
                'duration': metadata.get('videoMeta', {}).get('duration', 0),
                'createTime': metadata.get('createTimeISO'),
                'author': metadata.get('authorMeta', {}),
                'stats': {
                    'views': metadata.get('playCount', 0),
                    'likes': metadata.get('diggCount', 0),
                    'comments': metadata.get('commentCount', 0),
                    'shares': metadata.get('shareCount', 0),
                    'saves': metadata.get('collectCount', 0),
                    'engagementRate': (metadata.get('diggCount', 0) / max(metadata.get('playCount', 1), 1)) * 100
                },
                'music': metadata.get('musicMeta', {})
            }
            
            # Update video info
            video_meta = metadata.get('videoMeta', {})
            unified['video_info'] = {
                'width': video_meta.get('width', 0),
                'height': video_meta.get('height', 0),
                'duration': video_meta.get('duration', 0),
                'format': video_meta.get('format', 'mp4')
            }
            
            print("   ✅ Updated with TikTok metadata")
            break
    
    # 2. Load local analysis
    analysis_path = Path(f'downloads/analysis/{video_id}/complete_analysis.json')
    if not analysis_path.exists():
        analysis_path = Path(f'downloads/analysis/{video_id}/basic_analysis.json')
    
    if analysis_path.exists():
        with open(analysis_path, 'r') as f:
            analysis = json.load(f)
        
        # Merge timelines
        if 'timelines' in analysis:
            for timeline_type, timeline_data in analysis['timelines'].items():
                if timeline_data:  # Only add non-empty timelines
                    unified['timelines'][timeline_type] = timeline_data
        
        # Add analysis metadata
        unified['local_analysis'] = {
            'type': analysis.get('analysis_type', 'unknown'),
            'timestamp': analysis.get('analysis_timestamp'),
            'frames_extracted': len(analysis.get('extracted_frames', [])),
            'audio_extracted': bool(analysis.get('audio_path'))
        }
        
        print("   ✅ Updated with local analysis")
    
    # 3. Load PySceneDetect results if available
    scene_path = Path(f'downloads/analysis/{video_id}/scene_detection.json')
    if scene_path.exists():
        with open(scene_path, 'r') as f:
            scenes = json.load(f)
        
        # Add scene detection timeline
        if 'scenes' in scenes:
            unified['timelines']['sceneChangeTimeline'] = process_scene_changes(scenes['scenes'])
        
        unified['scene_detection'] = {
            'analyzed': True,
            'timestamp': scenes.get('timestamp'),
            'scene_count': len(scenes.get('scenes', []))
        }
        
        print("   ✅ Updated with PySceneDetect results")
    
    # 4. Calculate insights
    unified['insights'] = calculate_insights(unified)
    
    # 5. Update metadata
    unified['last_updated'] = Path(unified_path).stat().st_mtime
    unified['data_sources'] = {
        'tiktok_metadata': bool(unified['static_metadata'].get('author')),
        'local_analysis': 'local_analysis' in unified,
        'scene_detection': 'scene_detection' in unified
    }
    
    # Save updated unified analysis
    with open(unified_path, 'w') as f:
        json.dump(unified, f, indent=2)
    
    print(f"✅ Unified analysis updated: {unified_path}")
    return True


def process_object_annotations(annotations):
    """Convert object annotations to timeline format"""
    timeline = {}
    for ann in annotations:
        for frame in ann.get('frames', []):
            # Handle timeOffset format
            time_offset = frame.get('timeOffset', {})
            if isinstance(time_offset, dict):
                seconds = float(time_offset.get('seconds', 0))
                nanos = float(time_offset.get('nanos', 0)) / 1e9
                time = seconds + nanos
            else:
                time = float(time_offset)
            
            time_key = f"{time:.2f}"
            if time_key not in timeline:
                timeline[time_key] = []
            timeline[time_key].append({
                'object': ann.get('entity', {}).get('description', 'unknown'),
                'confidence': ann.get('confidence', 0)
            })
    return timeline


def process_text_annotations(annotations):
    """Convert text annotations to timeline format"""
    timeline = {}
    for ann in annotations:
        for segment in ann.get('segments', []):
            # Handle time format
            start_time_obj = segment.get('segment', {}).get('startTimeOffset', {})
            if isinstance(start_time_obj, dict):
                seconds = float(start_time_obj.get('seconds', 0))
                nanos = float(start_time_obj.get('nanos', 0)) / 1e9
                start_time = seconds + nanos
            else:
                start_time = float(start_time_obj) if start_time_obj else 0
            
            time_key = f"{start_time:.2f}"
            timeline[time_key] = {
                'text': ann.get('text', ''),
                'confidence': segment.get('confidence', 0)
            }
    return timeline


def process_speech_transcriptions(transcriptions):
    """Convert speech transcriptions to timeline format"""
    timeline = {}
    for trans in transcriptions:
        for alt in trans.get('alternatives', []):
            for word in alt.get('words', []):
                start_time = word.get('startTime', 0)
                time_key = f"{start_time:.2f}"
                timeline[time_key] = {
                    'word': word.get('word', ''),
                    'confidence': word.get('confidence', 0)
                }
    return timeline


def process_scene_changes(scenes):
    """Convert scene detection results to timeline format"""
    timeline = {}
    for i, scene in enumerate(scenes):
        start_time = scene.get('start_time', 0)
        time_key = f"{start_time:.2f}"
        timeline[time_key] = {
            'scene_number': i + 1,
            'start_time': start_time,
            'end_time': scene.get('end_time', 0),
            'duration': scene.get('duration', 0)
        }
    return timeline


def calculate_insights(unified):
    """Calculate insights from all available data"""
    insights = {
        'primaryObjects': [],
        'dominantExpressions': [],
        'creativeDensity': 0,
        'gestureCount': 0,
        'textOverlayFrequency': 0,
        'humanPresenceRate': 0,
        'objectDiversity': 0,
        'sceneComplexity': 0,
        'engagementIndicators': []
    }
    
    # Count objects
    object_counts = {}
    for timestamp, objects in unified['timelines'].get('objectTimeline', {}).items():
        for obj in objects:
            obj_name = obj.get('object', 'unknown')
            object_counts[obj_name] = object_counts.get(obj_name, 0) + 1
    
    # Get top objects
    if object_counts:
        sorted_objects = sorted(object_counts.items(), key=lambda x: x[1], reverse=True)
        insights['primaryObjects'] = [obj[0] for obj in sorted_objects[:5]]
        insights['objectDiversity'] = len(object_counts)
    
    # Calculate text overlay frequency
    text_count = len(unified['timelines'].get('textOverlayTimeline', {}))
    duration = unified.get('duration_seconds', 1)
    insights['textOverlayFrequency'] = text_count / max(duration, 1)
    
    # Creative density (simplified)
    total_elements = (
        len(unified['timelines'].get('objectTimeline', {})) +
        len(unified['timelines'].get('textOverlayTimeline', {})) +
        len(unified['timelines'].get('speechTimeline', {}))
    )
    insights['creativeDensity'] = total_elements / max(duration, 1)
    
    return insights


def main():
    if len(sys.argv) != 2:
        print("Usage: python update_unified_analysis.py <video_id>")
        sys.exit(1)
    
    video_id = sys.argv[1]
    update_unified_analysis(video_id)


if __name__ == "__main__":
    main()