#!/usr/bin/env python3
"""
Run Claude prompts with ML data validation - Version 2
Integrated into the complete flow for any TikTok URL
"""

import os
import sys
import json
import time
import statistics
from datetime import datetime
from run_claude_insight import ClaudeInsightRunner

# Initialize the runner
runner = ClaudeInsightRunner()

def parse_timestamp_to_seconds(timestamp):
    """Convert timestamp like '0-1s' to start second"""
    try:
        return int(timestamp.split('-')[0])
    except:
        return None


def is_timestamp_in_second(timestamp, second):
    """Check if a timestamp range overlaps with a given second"""
    try:
        parts = timestamp.split('-')
        if len(parts) == 2:
            start = float(parts[0])
            end = float(parts[1].replace('s', ''))
            return start <= second < end
        return False
    except:
        return False


def mean(values):
    """Calculate mean of a list"""
    return sum(values) / len(values) if values else 0


def stdev(values):
    """Calculate standard deviation of a list"""
    if len(values) < 2:
        return 0
    return statistics.stdev(values)


def compute_visual_overlay_metrics(text_overlay_timeline, sticker_timeline, gesture_timeline, 
                                  speech_timeline, object_timeline, video_duration):
    """Compute comprehensive visual overlay metrics for ML-ready analysis"""
    import re
    from collections import defaultdict, Counter
    
    # Initialize tracking
    seconds = int(video_duration) + 1
    
    # Core metrics
    total_text_overlays = len(text_overlay_timeline)
    unique_texts = set()
    text_appearances = []
    
    # Process text overlays
    for timestamp, data in text_overlay_timeline.items():
        text = data.get('text', '')
        if text:
            unique_texts.add(text.lower().strip())
            try:
                start_sec = float(timestamp.split('-')[0])
                text_appearances.append((start_sec, text))
            except:
                pass
    
    # 1. Core Metrics
    avg_texts_per_second = total_text_overlays / video_duration if video_duration > 0 else 0
    unique_text_count = len(unique_texts)
    time_to_first_text = min([t[0] for t in text_appearances]) if text_appearances else video_duration
    
    # Calculate average display duration
    display_durations = []
    for timestamp, data in text_overlay_timeline.items():
        try:
            parts = timestamp.split('-')
            if len(parts) == 2:
                start = float(parts[0])
                end = float(parts[1].replace('s', ''))
                duration = end - start
                display_durations.append(duration)
        except:
            pass
    avg_text_display_duration = mean(display_durations)
    
    # 2. Overlay Rhythm & Density
    appearance_intervals = []
    sorted_appearances = sorted(text_appearances, key=lambda x: x[0])
    for i in range(1, len(sorted_appearances)):
        interval = sorted_appearances[i][0] - sorted_appearances[i-1][0]
        appearance_intervals.append(interval)
    
    # Burst windows and clutter timeline
    burst_windows = []
    clutter_timeline = {}
    for start in range(0, seconds, 5):
        end = min(start + 5, seconds)
        window_key = f"{start}-{end}s"
        
        text_count = sum(1 for t in text_appearances if start <= t[0] < end)
        sticker_count = sum(1 for ts, _ in sticker_timeline.items() 
                           if start <= parse_timestamp_to_seconds(ts) < end)
        total_count = text_count + sticker_count
        
        clutter_timeline[window_key] = {
            'text': text_count,
            'sticker': sticker_count,
            'total': total_count
        }
        
        if total_count >= 3:
            burst_windows.append(window_key)
    
    # Calculate breathing room ratio
    seconds_with_overlays = set()
    for timestamp in text_overlay_timeline:
        start_sec = parse_timestamp_to_seconds(timestamp)
        if start_sec is not None:
            seconds_with_overlays.add(int(start_sec))
    breathing_room_ratio = (seconds - len(seconds_with_overlays)) / seconds if seconds > 0 else 0
    
    # Average simultaneous texts
    simultaneous_counts = []
    for sec in range(seconds):
        count = sum(1 for ts in text_overlay_timeline 
                   if is_timestamp_in_second(ts, sec))
        if count > 0:
            simultaneous_counts.append(count)
    avg_simultaneous_texts = mean(simultaneous_counts)
    
    # 3. Readability Components (defaults)
    readability_components = {
        'avg_contrast_ratio': 0.75,
        'avg_text_size_normalized': 0.6,
        'center_screen_percentage': 0.7,
        'occlusion_events': 0
    }
    
    # Count occlusion events
    for i, (time1, _) in enumerate(sorted_appearances):
        for time2, _ in sorted_appearances[i+1:]:
            if abs(time1 - time2) < 1.0:
                readability_components['occlusion_events'] += 1
    
    # 4. Text Position Distribution (defaults)
    text_position_distribution = {
        'top_third': 0.3,
        'middle_third': 0.5,
        'bottom_third': 0.2
    }
    
    # 5. Text Hierarchy Metrics
    text_sizes = []
    for _, text in text_appearances:
        size_score = len(text) * (2 if text.isupper() else 1)
        text_sizes.append(size_score)
    
    text_size_variance = stdev(text_sizes) if len(text_sizes) > 1 else 0
    
    dominant_text_changes = 0
    if text_sizes:
        last_dominant = text_sizes[0]
        mean_size = mean(text_sizes)
        for size in text_sizes[1:]:
            if abs(size - last_dominant) > mean_size * 0.5:
                dominant_text_changes += 1
                last_dominant = size
    
    # 6. CTA Reinforcement Matrix
    cta_keywords = ['buy', 'shop', 'click', 'link', 'follow', 'subscribe', 'comment', 
                    'share', 'order', 'get', 'save', 'discount', 'sale', 'limited']
    
    cta_reinforcement_matrix = {
        'text_only': 0,
        'text_gesture': 0,
        'text_sticker': 0,
        'all_three': 0
    }
    
    for timestamp, data in text_overlay_timeline.items():
        text = data.get('text', '').lower()
        if any(keyword in text for keyword in cta_keywords):
            has_gesture = timestamp in gesture_timeline
            has_sticker = timestamp in sticker_timeline
            
            if has_gesture and has_sticker:
                cta_reinforcement_matrix['all_three'] += 1
            elif has_gesture:
                cta_reinforcement_matrix['text_gesture'] += 1
            elif has_sticker:
                cta_reinforcement_matrix['text_sticker'] += 1
            else:
                cta_reinforcement_matrix['text_only'] += 1
    
    # 7. Semantic Clustering
    text_semantic_groups = {
        'product_mentions': 0,
        'urgency_phrases': 0,
        'social_proof': 0,
        'questions': 0,
        'other_text': 0
    }
    
    product_patterns = ['product', 'item', 'brand', 'quality', 'feature', 'benefit']
    urgency_patterns = ['now', 'today', 'limited', 'last', 'hurry', 'quick', 'fast']
    social_patterns = ['everyone', 'viral', 'trending', 'popular', 'love', 'favorite']
    
    for _, text in text_appearances:
        text_lower = text.lower()
        classified = False
        
        if any(pattern in text_lower for pattern in product_patterns):
            text_semantic_groups['product_mentions'] += 1
            classified = True
        elif any(pattern in text_lower for pattern in urgency_patterns):
            text_semantic_groups['urgency_phrases'] += 1
            classified = True
        elif any(pattern in text_lower for pattern in social_patterns):
            text_semantic_groups['social_proof'] += 1
            classified = True
        elif '?' in text:
            text_semantic_groups['questions'] += 1
            classified = True
        
        if not classified:
            text_semantic_groups['other_text'] += 1
    
    # 8. Cross-Modal Alignment - Speech
    text_speech_alignment = {
        'text_matches_speech': 0,
        'text_precedes_speech': 0,
        'text_follows_speech': 0,
        'text_contradicts_speech': 0
    }
    
    speech_texts = []
    for timestamp, data in speech_timeline.items():
        if 'text' in data:
            speech_texts.append((parse_timestamp_to_seconds(timestamp), data['text'].lower()))
    
    for text_time, text in text_appearances:
        text_lower = text.lower()
        alignment_found = False
        
        for speech_time, speech_text in speech_texts:
            time_diff = text_time - speech_time
            
            if any(word in speech_text for word in text_lower.split()) or \
               any(word in text_lower for word in speech_text.split()):
                if abs(time_diff) < 1.0:
                    text_speech_alignment['text_matches_speech'] += 1
                elif time_diff < -1.0:
                    text_speech_alignment['text_precedes_speech'] += 1
                elif time_diff > 1.0:
                    text_speech_alignment['text_follows_speech'] += 1
                alignment_found = True
                break
        
        if not alignment_found and speech_texts:
            text_speech_alignment['text_contradicts_speech'] += 1
    
    # 9. Cross-Modal Alignment - Gesture
    text_gesture_coordination = {
        'aligned': 0,
        'misaligned': 0,
        'neutral': 0
    }
    
    for timestamp in text_overlay_timeline:
        text_sec = parse_timestamp_to_seconds(timestamp)
        if text_sec is not None:
            gesture_found = False
            for gesture_ts in gesture_timeline:
                gesture_sec = parse_timestamp_to_seconds(gesture_ts)
                if gesture_sec is not None and abs(text_sec - gesture_sec) < 1.0:
                    gesture_data = gesture_timeline[gesture_ts]
                    if any(g in str(gesture_data).lower() for g in ['point', 'tap', 'swipe']):
                        text_gesture_coordination['aligned'] += 1
                    else:
                        text_gesture_coordination['neutral'] += 1
                    gesture_found = True
                    break
            
            if not gesture_found:
                text_gesture_coordination['misaligned'] += 1
    
    return {
        'avg_texts_per_second': round(avg_texts_per_second, 3),
        'unique_text_count': unique_text_count,
        'time_to_first_text': round(time_to_first_text, 2),
        'avg_text_display_duration': round(avg_text_display_duration, 2),
        'overlay_rhythm': {
            'appearance_intervals': [round(i, 2) for i in appearance_intervals[:10]],
            'burst_windows': burst_windows,
            'breathing_room_ratio': round(breathing_room_ratio, 3)
        },
        'clutter_timeline': clutter_timeline,
        'avg_simultaneous_texts': round(avg_simultaneous_texts, 2),
        'readability_components': readability_components,
        'text_position_distribution': text_position_distribution,
        'text_size_variance': round(text_size_variance, 2),
        'dominant_text_changes': dominant_text_changes,
        'cta_reinforcement_matrix': cta_reinforcement_matrix,
        'text_semantic_groups': text_semantic_groups,
        'text_speech_alignment': text_speech_alignment,
        'text_gesture_coordination': text_gesture_coordination
    }


def compute_creative_density_analysis(timelines, duration):
    """Compute smart creative density analysis instead of sending full timelines
    
    Args:
        timelines: Dictionary containing all timeline data (textOverlayTimeline, stickerTimeline, etc.)
        duration: Video duration in seconds
        
    Returns:
        dict: Comprehensive density analysis metrics
    """
    # Initialize density tracking
    seconds = int(duration) + 1
    density_per_second = [0] * seconds
    element_types_per_second = [{'text': 0, 'sticker': 0, 'gesture': 0, 'expression': 0, 'object': 0} for _ in range(seconds)]
    
    # Calculate density for each second
    for timeline_type, timeline_data in [
        ('text', timelines.get('textOverlayTimeline', {})),
        ('sticker', timelines.get('stickerTimeline', {})),
        ('gesture', timelines.get('gestureTimeline', {})),
        ('expression', timelines.get('expressionTimeline', {})),
        ('object', timelines.get('objectTimeline', {}))
    ]:
        for timestamp, data in timeline_data.items():
            # Parse timestamp
            try:
                second = int(timestamp.split('-')[0])
                if 0 <= second < seconds:
                    # Count elements based on type
                    if timeline_type == 'text':
                        count = len(data.get('texts', [])) if 'texts' in data else 1
                    elif timeline_type == 'sticker':
                        count = len(data.get('stickers', [])) if 'stickers' in data else 1
                    elif timeline_type == 'gesture':
                        count = len(data.get('gestures', [])) if 'gestures' in data else 1
                    elif timeline_type == 'object':
                        count = data.get('total_objects', 1)
                    else:  # expression
                        count = 1 if data.get('expression') else 0
                    
                    density_per_second[second] += count
                    element_types_per_second[second][timeline_type] += count
            except:
                continue
    
    # Calculate statistics
    total_elements = sum(density_per_second)
    avg_density = mean(density_per_second)
    max_density = max(density_per_second) if density_per_second else 0
    min_density = min(density_per_second) if density_per_second else 0
    std_deviation = stdev(density_per_second) if len(density_per_second) > 1 else 0
    
    # Find peak moments (top 5-10 peaks)
    peak_moments = []
    density_with_index = [(d, i) for i, d in enumerate(density_per_second)]
    density_with_index.sort(reverse=True)
    
    # Calculate surprise scores for peaks
    num_peaks = min(10, len([d for d, _ in density_with_index if d > avg_density]))
    for density, second in density_with_index[:num_peaks]:
        if density > 0:
            # Calculate surprise score based on how much it exceeds local average
            surrounding_window = density_per_second[max(0, second-3):min(seconds, second+4)]
            local_avg = mean(surrounding_window) if surrounding_window else 0
            
            if std_deviation > 0:
                surprise_score = (density - local_avg) / std_deviation
            else:
                surprise_score = 0
            
            peak_moments.append({
                'timestamp': f"{second}-{second+1}s",
                'second': second,
                'total_elements': density,
                'surprise_score': round(surprise_score, 1),
                'breakdown': element_types_per_second[second]
            })
    
    # Sort peaks by timestamp
    peak_moments.sort(key=lambda x: x['second'])
    
    # Identify patterns
    patterns = []
    
    # Strong opening hook
    if seconds > 3:
        opening_density = mean(density_per_second[:3])
        rest_density = mean(density_per_second[3:]) if len(density_per_second) > 3 else 0
        if rest_density > 0 and opening_density > rest_density * 1.5:
            patterns.append('strong_opening_hook')
    
    # Crescendo pattern
    if seconds > 10:
        first_third = mean(density_per_second[:seconds//3])
        last_third = mean(density_per_second[-seconds//3:])
        if first_third > 0 and last_third > first_third * 1.5:
            patterns.append('crescendo_pattern')
    
    # Front loaded
    if seconds > 10:
        first_third = mean(density_per_second[:seconds//3])
        last_third = mean(density_per_second[-seconds//3:])
        if last_third > 0 and first_third > last_third * 1.5:
            patterns.append('front_loaded')
    
    # Consistent density
    if std_deviation < avg_density * 0.3:
        patterns.append('consistent_density')
    
    # Dual peak structure
    significant_peaks = [p for p in peak_moments if p['total_elements'] > avg_density * 1.5]
    if len(significant_peaks) >= 2:
        # Check if peaks are sufficiently separated
        peak_times = [p['second'] for p in significant_peaks]
        for i in range(len(peak_times)-1):
            if peak_times[i+1] - peak_times[i] >= 8:
                patterns.append('dual_peak_structure')
                break
    
    # Multi peak rhythm
    if len(significant_peaks) >= 3:
        patterns.append('multi_peak_rhythm')
    
    # Build density curve (sample every 1-2 seconds)
    density_curve = []
    sample_interval = 2 if seconds > 30 else 1
    for i in range(0, seconds, sample_interval):
        # Find primary element type at this second
        elements = element_types_per_second[i]
        primary_element = max(elements.items(), key=lambda x: x[1])[0] if any(elements.values()) else 'none'
        
        density_curve.append({
            'second': i,
            'density': density_per_second[i],
            'primary_element': primary_element
        })
    
    # Calculate element distribution
    element_distribution = {
        'text': sum(e['text'] for e in element_types_per_second),
        'sticker': sum(e['sticker'] for e in element_types_per_second),
        'gesture': sum(e['gesture'] for e in element_types_per_second),
        'expression': sum(e['expression'] for e in element_types_per_second),
        'object': sum(e['object'] for e in element_types_per_second)
    }
    
    # Add scene changes if available
    scene_changes = len(timelines.get('sceneChangeTimeline', {}))
    
    # Calculate additional metrics expected by prompt
    empty_seconds = len([d for d in density_per_second if d == 0])
    timeline_coverage = (seconds - empty_seconds) / seconds if seconds > 0 else 0
    
    # Normalize volatility to 0-1 range
    density_volatility = std_deviation / avg_density if avg_density > 0 else 0
    density_volatility = min(1.0, density_volatility)  # Cap at 1.0
    
    # Calculate density score (0-10)
    if avg_density < 0.5:
        creative_density_score = avg_density * 6  # 0-3 range for minimal
    elif avg_density < 1.5:
        creative_density_score = 3 + (avg_density - 0.5) * 3  # 3-6 range for medium
    else:
        creative_density_score = 6 + min((avg_density - 1.5) * 2, 4)  # 6-10 range for heavy
    
    # Determine primary density pattern
    if 'front_loaded' in patterns:
        density_pattern = 'front_loaded'
    elif 'crescendo_pattern' in patterns:
        density_pattern = 'back_loaded'
    elif 'consistent_density' in patterns:
        density_pattern = 'even'
    else:
        density_pattern = 'variable'
    
    # Generate ML tags
    creative_ml_tags = []
    if 'strong_opening_hook' in patterns:
        creative_ml_tags.append('hook_heavy')
    if element_distribution['text'] > total_elements * 0.4:
        creative_ml_tags.append('text_driven')
    if element_distribution['gesture'] > total_elements * 0.3:
        creative_ml_tags.append('gesture_rich')
    if len(significant_peaks) >= 3:
        creative_ml_tags.append('multi_peak')
    if empty_seconds > seconds * 0.3:
        creative_ml_tags.append('sparse_density')
    if density_volatility > 0.6:
        creative_ml_tags.append('dynamic_pacing')
    
    # Build peak_density_moments in expected format
    peak_density_moments = []
    for peak in peak_moments[:5]:  # Top 5 peaks
        peak_density_moments.append({
            'timestamp': peak['timestamp'],
            'element_count': peak['total_elements'],
            'surprise_score': peak['surprise_score']
        })
    
    return {
        'density_analysis': {
            # Metrics expected by prompt
            'creative_density_score': round(creative_density_score, 1),
            'elements_per_second': round(avg_density, 2),
            'total_creative_elements': total_elements,
            'element_distribution': element_distribution,
            'timeline_coverage': round(timeline_coverage, 2),
            'density_pattern': density_pattern,
            'peak_density_moments': peak_density_moments,
            'density_volatility': round(density_volatility, 2),
            'empty_seconds': empty_seconds,
            'creative_ml_tags': creative_ml_tags,
            
            # Additional metrics for internal use
            'duration_seconds': int(duration),
            'max_density': max_density,
            'min_density': min_density,
            'std_deviation': round(std_deviation, 1),
            'patterns_identified': patterns,
            'peak_moments': peak_moments,  # Full peak data
            'density_curve': density_curve,
            'scene_changes': scene_changes
        }
    }


def compute_emotional_metrics(expression_timeline, speech_timeline, gesture_timeline, duration, 
                            sample_interval=5, intensity_threshold=0.6):
    """Compute emotional metrics for ML-ready analysis
    
    Args:
        expression_timeline: Timeline of facial expressions
        speech_timeline: Timeline of speech segments
        gesture_timeline: Timeline of gestures
        duration: Video duration in seconds
        sample_interval: Seconds between emotion samples (default: 5)
        intensity_threshold: Threshold for emotional peaks (default: 0.6)
    """
    # Define standardized emotion labels and valence mapping
    EMOTION_LABELS = ['joy', 'sadness', 'anger', 'fear', 'surprise', 'disgust', 'neutral']
    EMOTION_VALENCE = {
        'joy': 0.8, 'happy': 0.8, 'excited': 0.9,
        'neutral': 0.0, 'calm': 0.1,
        'sadness': -0.6, 'sad': -0.6,
        'anger': -0.8, 'angry': -0.8,
        'fear': -0.7, 'worried': -0.5,
        'surprise': 0.3, 'surprised': 0.3,
        'disgust': -0.9,
        'contemplative': -0.1, 'thoughtful': -0.1
    }
    
    # Initialize tracking
    seconds = int(duration) + 1
    emotion_sequence = []
    emotion_valence = []
    emotion_timestamps = []
    
    # Sample emotions at specified interval
    for i in range(0, seconds, sample_interval):
        timestamp = f"{i}-{min(i+sample_interval, seconds)}s"
        
        # Get emotions in this window
        emotions_in_window = []
        for ts, data in expression_timeline.items():
            ts_second = parse_timestamp_to_seconds(ts)
            if ts_second is not None and i <= ts_second < i + sample_interval:
                if 'expression' in data:
                    emotions_in_window.append(data['expression'])
        
        # Determine dominant emotion
        if emotions_in_window:
            # Most common emotion in window
            from collections import Counter
            emotion_counts = Counter(emotions_in_window)
            dominant = emotion_counts.most_common(1)[0][0]
            
            # Map to standardized emotion
            if dominant in ['happy', 'excited']:
                dominant_std = 'joy'
            elif dominant in ['sad']:
                dominant_std = 'sadness'
            elif dominant in ['contemplative', 'thoughtful']:
                dominant_std = 'neutral'
            else:
                dominant_std = dominant if dominant in EMOTION_LABELS else 'neutral'
            
            emotion_sequence.append(dominant_std)
            emotion_valence.append(EMOTION_VALENCE.get(dominant, 0.0))
            emotion_timestamps.append(timestamp)
        else:
            # No emotion detected - assume neutral
            emotion_sequence.append('neutral')
            emotion_valence.append(0.0)
            emotion_timestamps.append(timestamp)
    
    # Calculate emotion variability
    emotion_variability = stdev(emotion_valence) if len(emotion_valence) > 1 else 0
    
    # Find emotional peaks (top 5 by absolute intensity)
    emotional_peaks = []
    for i, (ts, emotion, valence) in enumerate(zip(emotion_timestamps, emotion_sequence, emotion_valence)):
        if abs(valence) > intensity_threshold:
            emotional_peaks.append({
                'timestamp': ts,
                'emotion': emotion,
                'intensity': abs(valence)
            })
    
    # Sort peaks by intensity
    emotional_peaks.sort(key=lambda x: x['intensity'], reverse=True)
    emotional_peaks = emotional_peaks[:5]  # Top 5 peaks
    
    # Determine dominant emotion
    if emotion_sequence:
        from collections import Counter
        emotion_counter = Counter(emotion_sequence)
        dominant_emotion = emotion_counter.most_common(1)[0][0]
    else:
        dominant_emotion = 'neutral'
    
    # Calculate emotional trajectory
    if len(emotion_valence) >= 3:
        start_val = mean(emotion_valence[:len(emotion_valence)//3])
        end_val = mean(emotion_valence[-len(emotion_valence)//3:])
        
        if end_val - start_val > 0.3:
            emotional_trajectory = 'ascending'
        elif start_val - end_val > 0.3:
            emotional_trajectory = 'descending'
        else:
            # Check for U-shaped
            middle_val = mean(emotion_valence[len(emotion_valence)//3:-len(emotion_valence)//3])
            if start_val > middle_val + 0.2 and end_val > middle_val + 0.2:
                emotional_trajectory = 'u-shaped'
            else:
                emotional_trajectory = 'flat'
    else:
        emotional_trajectory = 'flat'
    
    # Calculate emotion-gesture alignment
    alignment_count = 0
    total_checks = 0
    
    for ts, data in expression_timeline.items():
        if ts in gesture_timeline and 'expression' in data:
            emotion = data['expression']
            gestures = gesture_timeline[ts].get('gestures', [])
            
            # Check for alignment patterns
            if emotion in ['happy', 'excited'] and any(g in ['thumbs_up', 'victory', 'pointing'] for g in gestures):
                alignment_count += 1
            elif emotion in ['sad', 'thoughtful'] and any(g in ['closed_fist', 'open_palm'] for g in gestures):
                alignment_count += 1
            elif emotion == 'surprised' and any(g in ['pointing', 'open_palm'] for g in gestures):
                alignment_count += 1
            
            total_checks += 1
    
    emotion_gesture_alignment = alignment_count / total_checks if total_checks > 0 else 0
    
    # Calculate emotion change rate
    emotion_changes = []
    for i in range(1, len(emotion_valence)):
        change = abs(emotion_valence[i] - emotion_valence[i-1])
        emotion_changes.append(change)
    
    emotion_change_rate = mean(emotion_changes) if emotion_changes else 0
    
    # Calculate additional metrics
    emotional_consistency = 1 - emotion_change_rate if emotion_change_rate <= 1 else 0
    has_high_emotion_peak = any(abs(v) > 0.8 for v in emotion_valence)
    peak_intensity_count = len([v for v in emotion_valence if abs(v) > intensity_threshold])
    
    # Calculate emotion diversity
    unique_emotions = len(set(emotion_sequence))
    emotion_diversity = unique_emotions / len(EMOTION_LABELS) if EMOTION_LABELS else 0
    
    # Calculate positive/negative ratios
    positive_count = len([v for v in emotion_valence if v > 0.1])
    negative_count = len([v for v in emotion_valence if v < -0.1])
    total_samples = len(emotion_valence)
    
    positive_ratio = positive_count / total_samples if total_samples > 0 else 0
    negative_ratio = negative_count / total_samples if total_samples > 0 else 0
    
    # Build emotion valence curve
    emotion_valence_curve = []
    for ts, valence, emotion in zip(emotion_timestamps, emotion_valence, emotion_sequence):
        emotion_valence_curve.append({
            'timestamp': ts,
            'valence': round(valence, 2),
            'emotion': emotion
        })
    
    # Calculate emotion transition matrix
    emotion_transition_matrix = {}
    for i in range(1, len(emotion_sequence)):
        transition = f"{emotion_sequence[i-1]}_to_{emotion_sequence[i]}"
        emotion_transition_matrix[transition] = emotion_transition_matrix.get(transition, 0) + 1
    
    # Normalize transition counts to probabilities
    total_transitions = sum(emotion_transition_matrix.values())
    if total_transitions > 0:
        for key in emotion_transition_matrix:
            emotion_transition_matrix[key] = round(emotion_transition_matrix[key] / total_transitions, 2)
    
    # Calculate valence momentum
    valence_momentum = []
    for i in range(1, len(emotion_valence)):
        momentum = emotion_valence[i] - emotion_valence[i-1]
        valence_momentum.append(momentum)
    
    if valence_momentum:
        positive_momentum = [m for m in valence_momentum if m > 0]
        negative_momentum = [m for m in valence_momentum if m < 0]
        
        valence_momentum_stats = {
            'average_momentum': round(mean(valence_momentum), 3),
            'max_positive_momentum': round(max(positive_momentum), 2) if positive_momentum else 0,
            'max_negative_momentum': round(min(negative_momentum), 2) if negative_momentum else 0,
            'momentum_changes': valence_momentum
        }
    else:
        valence_momentum_stats = {
            'average_momentum': 0,
            'max_positive_momentum': 0,
            'max_negative_momentum': 0,
            'momentum_changes': []
        }
    
    # Calculate peak rhythm metrics
    peak_spacings = []
    peak_times = [p['timestamp'] for p in emotional_peaks]
    for i in range(1, len(peak_times)):
        # Extract seconds from timestamps
        time1 = parse_timestamp_to_seconds(peak_times[i-1])
        time2 = parse_timestamp_to_seconds(peak_times[i])
        if time1 is not None and time2 is not None:
            spacing = time2 - time1
            peak_spacings.append(spacing)
    
    if peak_spacings:
        peak_spacing_mean = mean(peak_spacings)
        peak_spacing_variance = variance(peak_spacings) if len(peak_spacings) > 1 else 0
        
        # Calculate regularity score (inverse of coefficient of variation)
        if peak_spacing_mean > 0:
            cv = (peak_spacing_variance ** 0.5) / peak_spacing_mean
            regularity_score = 1 / (1 + cv)  # Higher score = more regular
        else:
            regularity_score = 0
        
        peak_rhythm = {
            'peak_spacing_mean': round(peak_spacing_mean, 1),
            'peak_spacing_variance': round(peak_spacing_variance, 2),
            'regularity_score': round(regularity_score, 2),
            'peak_count': len(emotional_peaks)
        }
    else:
        peak_rhythm = {
            'peak_spacing_mean': 0,
            'peak_spacing_variance': 0,
            'regularity_score': 0,
            'peak_count': len(emotional_peaks)
        }
    
    return {
        'emotion_variability': round(emotion_variability, 2),
        'emotion_sequence': emotion_sequence,
        'emotion_valence': [round(v, 2) for v in emotion_valence],
        'emotion_timestamps': emotion_timestamps,
        'emotional_peaks': emotional_peaks,
        'dominant_emotion': dominant_emotion,
        'emotional_trajectory': emotional_trajectory,
        'emotion_gesture_alignment': round(emotion_gesture_alignment, 2),
        'emotion_change_rate': round(emotion_change_rate, 2),
        'emotional_consistency': round(emotional_consistency, 2),
        'has_high_emotion_peak': has_high_emotion_peak,
        'peak_intensity_count': peak_intensity_count,
        'emotion_diversity': round(emotion_diversity, 2),
        'positive_ratio': round(positive_ratio, 2),
        'negative_ratio': round(negative_ratio, 2),
        'emotion_valence_curve': emotion_valence_curve,
        'emotion_transition_matrix': emotion_transition_matrix,
        'valence_momentum': valence_momentum_stats,
        'peak_rhythm': peak_rhythm,
        'analysis_parameters': {
            'sample_interval': sample_interval,
            'intensity_threshold': intensity_threshold
        }
    }


def compute_person_framing_metrics(expression_timeline, object_timeline, camera_distance_timeline,
                                  person_timeline, enhanced_human_data, duration):
    """Compute person framing metrics for ML-ready analysis
    
    Args:
        expression_timeline: Timeline of facial expressions
        object_timeline: Timeline of detected objects
        camera_distance_timeline: Timeline of camera distances
        person_timeline: Timeline of person detections (currently unused)
        enhanced_human_data: Enhanced human analysis data from metadata
        duration: Video duration in seconds
        
    Returns:
        dict: Comprehensive person framing metrics
    """
    # Initialize tracking
    seconds = int(duration) + 1
    face_frames = 0
    person_frames = 0
    
    # Count face presence from expression timeline
    for timestamp in expression_timeline:
        if expression_timeline[timestamp].get('expression'):
            face_frames += 1
    
    # Count person presence from object timeline
    for timestamp, data in object_timeline.items():
        objects = data.get('objects', {})
        if 'person' in objects and objects['person'] > 0:
            person_frames += 1
    
    # Calculate basic ratios
    total_frames = len(expression_timeline) if expression_timeline else seconds
    face_screen_time_ratio = face_frames / total_frames if total_frames > 0 else 0
    person_screen_time_ratio = person_frames / total_frames if total_frames > 0 else 0
    
    # Analyze camera distances
    distance_counts = {'close': 0, 'medium': 0, 'far': 0}
    distance_changes = 0
    last_distance = None
    intro_shot_type = 'unknown'
    
    for timestamp in sorted(camera_distance_timeline.keys()):
        distance_data = camera_distance_timeline[timestamp]
        distance = distance_data.get('distance', 'medium').lower()
        
        # Count distances
        if distance in distance_counts:
            distance_counts[distance] += 1
        
        # Track changes
        if last_distance and last_distance != distance:
            distance_changes += 1
        last_distance = distance
        
        # Capture intro shot type (first 3 seconds)
        second = parse_timestamp_to_seconds(timestamp)
        if second is not None and second < 3 and intro_shot_type == 'unknown':
            intro_shot_type = distance
    
    # Calculate distance metrics
    total_distance_frames = sum(distance_counts.values())
    if total_distance_frames > 0:
        shot_type_distribution = {
            k: round(v / total_distance_frames, 2) 
            for k, v in distance_counts.items()
        }
        dominant_shot_type = max(distance_counts, key=distance_counts.get)
        avg_camera_distance = dominant_shot_type
    else:
        shot_type_distribution = {'close': 0, 'medium': 0, 'far': 0}
        dominant_shot_type = 'medium'
        avg_camera_distance = 'medium'
    
    # Calculate framing volatility
    framing_volatility = distance_changes / total_frames if total_frames > 1 else 0
    
    # Track subject absence
    absence_segments = []
    current_absence_start = None
    subject_absence_count = 0
    
    for i in range(seconds):
        timestamp = f"{i}-{i+1}s"
        
        # Check if person is present in this second
        person_present = False
        
        # Check expression timeline
        if timestamp in expression_timeline and expression_timeline[timestamp].get('expression'):
            person_present = True
        
        # Check object timeline
        if timestamp in object_timeline:
            objects = object_timeline[timestamp].get('objects', {})
            if 'person' in objects and objects['person'] > 0:
                person_present = True
        
        # Track absence segments
        if not person_present:
            subject_absence_count += 1
            if current_absence_start is None:
                current_absence_start = i
        else:
            if current_absence_start is not None:
                absence_segments.append({
                    'start': current_absence_start,
                    'end': i,
                    'duration': i - current_absence_start
                })
                current_absence_start = None
    
    # Handle final absence segment
    if current_absence_start is not None:
        absence_segments.append({
            'start': current_absence_start,
            'end': seconds,
            'duration': seconds - current_absence_start
        })
    
    # Calculate longest absence
    longest_absence_duration = max([s['duration'] for s in absence_segments]) if absence_segments else 0
    
    # Generate pattern tags
    person_framing_pattern_tags = []
    
    # Creator presence patterns
    if face_screen_time_ratio > 0.7:
        person_framing_pattern_tags.append('strong_creator_presence')
    elif face_screen_time_ratio < 0.3:
        person_framing_pattern_tags.append('minimal_creator_presence')
    
    # Absence patterns
    if len(absence_segments) > 5:
        person_framing_pattern_tags.append('cutaway_heavy')
    elif len(absence_segments) == 0:
        person_framing_pattern_tags.append('continuous_presence')
    
    # Framing stability patterns
    if framing_volatility < 0.2:
        person_framing_pattern_tags.append('stable_framing')
    elif framing_volatility > 0.6:
        person_framing_pattern_tags.append('dynamic_framing')
    
    # Style patterns
    if face_screen_time_ratio > 0.6 and distance_counts.get('close', 0) > distance_counts.get('far', 0):
        person_framing_pattern_tags.append('talking_head_style')
    elif person_screen_time_ratio > 0.7 and distance_counts.get('far', 0) > distance_counts.get('close', 0):
        person_framing_pattern_tags.append('full_body_content')
    
    # Extract data from enhanced_human_data if available
    gaze_analysis = None
    action_recognition = None
    background_analysis = None
    
    if enhanced_human_data:
        # Use enhanced data if available
        if 'face_screen_time_ratio' in enhanced_human_data:
            face_screen_time_ratio = enhanced_human_data['face_screen_time_ratio']
        if 'person_screen_time_ratio' in enhanced_human_data:
            person_screen_time_ratio = enhanced_human_data['person_screen_time_ratio']
        if 'avg_camera_distance' in enhanced_human_data:
            avg_camera_distance = enhanced_human_data['avg_camera_distance']
        if 'framing_volatility' in enhanced_human_data:
            framing_volatility = enhanced_human_data['framing_volatility']
        if 'dominant_shot_type' in enhanced_human_data:
            dominant_shot_type = enhanced_human_data['dominant_shot_type']
        if 'intro_shot_type' in enhanced_human_data:
            intro_shot_type = enhanced_human_data['intro_shot_type']
        if 'subject_absence_count' in enhanced_human_data:
            subject_absence_count = enhanced_human_data['subject_absence_count']
        
        # Extract gaze analysis
        if 'gaze_patterns' in enhanced_human_data:
            gaze_data = enhanced_human_data['gaze_patterns']
            gaze_analysis = {
                'eye_contact_ratio': gaze_data.get('eye_contact_ratio', 0),
                'primary_gaze_direction': 'camera' if isinstance(gaze_data.get('primary_gaze_direction'), dict) else gaze_data.get('primary_gaze_direction', 'unknown')
            }
        
        # Extract action recognition
        if 'primary_actions' in enhanced_human_data:
            actions = enhanced_human_data['primary_actions']
            if isinstance(actions, dict):
                # Extract top actions
                top_actions = sorted(actions.items(), key=lambda x: x[1], reverse=True)[:3]
                primary_actions = [action[0] for action in top_actions]
                action_diversity = len([a for a in actions.values() if a > 0])
            else:
                primary_actions = actions if isinstance(actions, list) else []
                action_diversity = len(primary_actions)
            
            action_recognition = {
                'primary_actions': primary_actions,
                'action_diversity': action_diversity
            }
        
        # Extract background analysis
        if 'scene_analysis' in enhanced_human_data:
            scene_data = enhanced_human_data['scene_analysis']
            if 'background_changes' in scene_data:
                bg_data = scene_data['background_changes']
                background_analysis = {
                    'background_stability': bg_data.get('background_stability', 'unknown'),
                    'background_changes': bg_data.get('background_changes', []),
                    'change_frequency': bg_data.get('change_frequency', 0),
                    'avg_change_magnitude': bg_data.get('avg_change_magnitude', 0)
                }
    
    # Build final metrics
    metrics = {
        'face_screen_time_ratio': round(face_screen_time_ratio, 2),
        'person_screen_time_ratio': round(person_screen_time_ratio, 2),
        'avg_camera_distance': avg_camera_distance,
        'framing_volatility': round(framing_volatility, 2),
        'dominant_shot_type': dominant_shot_type,
        'intro_shot_type': intro_shot_type,
        'subject_absence_count': subject_absence_count,
        'person_framing_pattern_tags': person_framing_pattern_tags,
        'shot_type_distribution': shot_type_distribution,
        'longest_absence_duration': longest_absence_duration
    }
    
    # Add optional enhanced metrics
    if gaze_analysis:
        metrics['gaze_analysis'] = gaze_analysis
    if action_recognition:
        metrics['action_recognition'] = action_recognition
    if background_analysis:
        metrics['background_analysis'] = background_analysis
    
    # Compute temporal evolution
    temporal_evolution = analyze_temporal_evolution(
        expression_timeline, object_timeline, camera_distance_timeline, duration
    )
    metrics['temporal_evolution'] = temporal_evolution
    
    # Compute video intent based on metrics
    video_intent = infer_video_intent(
        face_screen_time_ratio, person_screen_time_ratio,
        intro_shot_type, action_recognition, shot_type_distribution
    )
    metrics['video_intent'] = video_intent
    
    # Calculate intent alignment risk
    intent_alignment_risk = calculate_intent_alignment_risk(
        video_intent, face_screen_time_ratio, framing_volatility,
        shot_type_distribution, person_framing_pattern_tags
    )
    metrics['intent_alignment_risk'] = intent_alignment_risk
    
    # Add gaze steadiness proxy (using eye contact ratio)
    if gaze_analysis and 'eye_contact_ratio' in gaze_analysis:
        # High eye contact suggests steady gaze
        eye_contact = gaze_analysis['eye_contact_ratio']
        if eye_contact > 0.7:
            metrics['gaze_steadiness'] = 'high'
        elif eye_contact > 0.4:
            metrics['gaze_steadiness'] = 'medium'
        else:
            metrics['gaze_steadiness'] = 'low'
    else:
        metrics['gaze_steadiness'] = 'unknown'
    
    return metrics


def analyze_temporal_evolution(expression_timeline, object_timeline, camera_distance_timeline, duration):
    """Analyze how framing evolves throughout the video"""
    if duration <= 0:
        return "insufficient_data"
    
    # Divide video into three segments
    segment_duration = duration / 3
    intro_end = segment_duration
    middle_end = 2 * segment_duration
    
    # Analyze each segment
    intro_distances = []
    middle_distances = []
    end_distances = []
    
    intro_person_count = 0
    middle_person_count = 0
    end_person_count = 0
    
    # Process camera distances by segment
    for timestamp, data in camera_distance_timeline.items():
        second = parse_timestamp_to_seconds(timestamp)
        if second is not None:
            distance = data.get('distance', 'medium')
            if second < intro_end:
                intro_distances.append(distance)
            elif second < middle_end:
                middle_distances.append(distance)
            else:
                end_distances.append(distance)
    
    # Process person presence by segment
    for timestamp, data in object_timeline.items():
        second = parse_timestamp_to_seconds(timestamp)
        if second is not None:
            objects = data.get('objects', {})
            has_person = 'person' in objects and objects['person'] > 0
            if second < intro_end:
                if has_person:
                    intro_person_count += 1
            elif second < middle_end:
                if has_person:
                    middle_person_count += 1
            else:
                if has_person:
                    end_person_count += 1
    
    # Determine evolution pattern
    intro_close = intro_distances.count('close') if intro_distances else 0
    middle_close = middle_distances.count('close') if middle_distances else 0
    end_close = end_distances.count('close') if end_distances else 0
    
    # Analyze patterns
    if not intro_distances and not middle_distances and not end_distances:
        return "no_camera_data"
    
    # Check for increasing intimacy
    if end_close > middle_close > intro_close:
        return "increasing_intimacy"
    elif intro_close > middle_close > end_close:
        return "decreasing_intimacy"
    elif intro_person_count == 0 and end_person_count > 0:
        return "product_to_person"
    elif intro_person_count > 0 and end_person_count == 0:
        return "person_to_product"
    elif intro_close > 0 and end_close > 0 and middle_close == 0:
        return "bookend_pattern"
    else:
        return "consistent_approach"


def infer_video_intent(face_ratio, person_ratio, intro_shot, actions, shot_distribution):
    """Infer the primary intent of the video based on framing metrics"""
    
    # Check intro approach
    intro_signal = None
    if intro_shot == 'close':
        intro_signal = 'creator_first'
    elif intro_shot == 'far' or intro_shot == 'no_person':
        intro_signal = 'content_first'
    else:
        intro_signal = 'balanced'
    
    # Analyze overall presence
    if face_ratio > 0.7:
        presence_signal = 'creator_connection'
    elif face_ratio < 0.3 and person_ratio > 0.5:
        presence_signal = 'demonstration'
    elif person_ratio < 0.3:
        presence_signal = 'product_showcase'
    else:
        presence_signal = 'mixed'
    
    # Consider actions if available
    action_signal = None
    if actions and 'primary_actions' in actions:
        primary_actions = actions['primary_actions']
        if 'talking' in primary_actions:
            action_signal = 'educational'
        elif 'demonstrating' in primary_actions:
            action_signal = 'tutorial'
        elif 'dancing' in primary_actions or 'performing' in primary_actions:
            action_signal = 'entertainment'
    
    # Determine primary intent
    if presence_signal == 'creator_connection' and (action_signal == 'educational' or intro_signal == 'creator_first'):
        primary_intent = 'creator_connection'
    elif presence_signal == 'demonstration' or action_signal == 'tutorial':
        primary_intent = 'product_demo'
    elif action_signal == 'entertainment':
        primary_intent = 'entertainment'
    elif presence_signal == 'product_showcase':
        primary_intent = 'product_showcase'
    else:
        primary_intent = 'education'
    
    return {
        'primary_intent': primary_intent,
        'intro_strategy': intro_signal,
        'presence_signal': presence_signal,
        'action_signal': action_signal
    }


def calculate_intent_alignment_risk(video_intent, face_ratio, volatility, shot_dist, pattern_tags):
    """Calculate how well the framing aligns with apparent video intent"""
    
    primary_intent = video_intent.get('primary_intent', 'unknown')
    risk_factors = []
    
    # Check alignment based on intent
    if primary_intent == 'creator_connection':
        # Should have high face time and stable framing
        if face_ratio < 0.5:
            risk_factors.append('low_face_time_for_creator_content')
        if volatility > 0.5:
            risk_factors.append('unstable_framing_for_connection')
        if 'minimal_creator_presence' in pattern_tags:
            risk_factors.append('conflicting_pattern_tags')
            
    elif primary_intent == 'product_demo':
        # Should have balanced framing with some cutaways
        if face_ratio > 0.8:
            risk_factors.append('too_much_face_time_for_demo')
        if 'cutaway_heavy' not in pattern_tags and face_ratio > 0.5:
            risk_factors.append('missing_product_focus_shots')
            
    elif primary_intent == 'entertainment':
        # Should have dynamic framing
        if volatility < 0.2:
            risk_factors.append('too_static_for_entertainment')
        if 'dynamic_framing' not in pattern_tags:
            risk_factors.append('lacks_energy_in_framing')
    
    # Calculate risk level
    if len(risk_factors) == 0:
        return 'low'
    elif len(risk_factors) == 1:
        return 'medium'
    else:
        return 'high'


def compute_scene_pacing_metrics(scene_timeline, video_duration, object_timeline=None, camera_distance_timeline=None):
    """Compute scene pacing metrics for ML-ready analysis
    
    Args:
        scene_timeline: Timeline of scene changes
        video_duration: Video duration in seconds
        object_timeline: Timeline of detected objects (optional)
        camera_distance_timeline: Timeline of camera distances (optional)
        
    Returns:
        dict: Comprehensive scene pacing metrics
    """
    # Initialize metrics
    shot_durations = []
    shot_transitions = []
    scene_changes = []
    
    # Convert scene timeline to sorted list
    timestamps = sorted(scene_timeline.keys(), key=lambda x: parse_timestamp_to_seconds(x) or 0)
    
    # Calculate shot durations
    for i in range(len(timestamps)):
        current_time = parse_timestamp_to_seconds(timestamps[i])
        if current_time is None:
            continue
            
        # Get next timestamp or use video duration
        if i < len(timestamps) - 1:
            next_time = parse_timestamp_to_seconds(timestamps[i + 1])
            if next_time is not None:
                duration = next_time - current_time
                shot_durations.append(duration)
        else:
            # Last shot duration
            duration = video_duration - current_time
            if duration > 0:
                shot_durations.append(duration)
        
        # Track scene change data
        scene_data = scene_timeline[timestamps[i]]
        if scene_data.get('type') == 'scene_change':
            scene_changes.append({
                'timestamp': timestamps[i],
                'time': current_time,
                'confidence': scene_data.get('confidence', 0.5)
            })
    
    # Basic metrics
    total_shots = len(scene_changes) + 1  # +1 for initial shot
    avg_shot_duration = mean(shot_durations) if shot_durations else video_duration
    min_shot_duration = min(shot_durations) if shot_durations else video_duration
    max_shot_duration = max(shot_durations) if shot_durations else video_duration
    
    # Cut frequency (cuts per minute)
    cut_frequency = (len(scene_changes) / video_duration) * 60 if video_duration > 0 else 0
    
    # Pacing classification
    if cut_frequency < 10:
        pacing_classification = "slow"
    elif cut_frequency < 20:
        pacing_classification = "moderate"
    elif cut_frequency < 40:
        pacing_classification = "fast"
    else:
        pacing_classification = "very_fast"
    
    # Shot distribution
    short_shots = sum(1 for d in shot_durations if d < 2)
    medium_shots = sum(1 for d in shot_durations if 2 <= d < 5)
    long_shots = sum(1 for d in shot_durations if d >= 5)
    
    # Rhythm consistency and variance (std deviation of shot durations)
    if len(shot_durations) > 1:
        rhythm_variability = stdev(shot_durations)
        shot_duration_variance = statistics.variance(shot_durations)
        rhythm_consistency = 1 / (1 + rhythm_variability)  # Higher = more consistent
        # Classify rhythm consistency
        if rhythm_consistency > 0.7:
            rhythm_consistency_class = "consistent"
        elif rhythm_consistency > 0.4:
            rhythm_consistency_class = "varied"
        else:
            rhythm_consistency_class = "erratic"
    else:
        rhythm_variability = 0
        shot_duration_variance = 0
        rhythm_consistency = 1
        rhythm_consistency_class = "consistent"
    
    # Acceleration patterns
    acceleration_phases = []
    if len(shot_durations) >= 3:
        for i in range(len(shot_durations) - 2):
            # Check if shots are getting progressively shorter
            if shot_durations[i] > shot_durations[i+1] > shot_durations[i+2]:
                acceleration_phases.append({
                    'start_shot': i,
                    'acceleration_rate': (shot_durations[i] - shot_durations[i+2]) / 2
                })
    
    # Scene complexity changes
    complexity_changes = 0
    if object_timeline:
        for i in range(1, len(timestamps)):
            prev_objects = len(object_timeline.get(timestamps[i-1], {}).get('objects', {}))
            curr_objects = len(object_timeline.get(timestamps[i], {}).get('objects', {}))
            if abs(curr_objects - prev_objects) > 2:
                complexity_changes += 1
    
    # Montage detection (rapid cuts in sequence)
    montage_segments = []
    rapid_cut_threshold = 1.5  # seconds
    consecutive_rapid = 0
    montage_start = None
    
    for i, duration in enumerate(shot_durations):
        if duration < rapid_cut_threshold:
            if consecutive_rapid == 0:
                montage_start = i
            consecutive_rapid += 1
        else:
            if consecutive_rapid >= 3:  # At least 3 rapid cuts
                montage_segments.append({
                    'start': montage_start,
                    'end': i - 1,
                    'shots': consecutive_rapid
                })
            consecutive_rapid = 0
    
    # Check last segment
    if consecutive_rapid >= 3:
        montage_segments.append({
            'start': montage_start,
            'end': len(shot_durations) - 1,
            'shots': consecutive_rapid
        })
    
    # Intro/outro pacing
    intro_cuts = sum(1 for sc in scene_changes if sc['time'] < 3)
    outro_cuts = sum(1 for sc in scene_changes if sc['time'] > video_duration - 3)
    
    # Peak pacing moments (where cuts accelerate)
    peak_moments = []
    window_size = 3
    for i in range(len(shot_durations) - window_size):
        window_avg = mean(shot_durations[i:i+window_size])
        if window_avg < avg_shot_duration * 0.5:  # 50% faster than average
            peak_moments.append({
                'shot_index': i,
                'avg_duration': window_avg
            })
    
    # Energy curve (inverse of shot duration over time)
    energy_curve = []
    cumulative_time = 0
    for i, duration in enumerate(shot_durations):
        energy = 1 / duration if duration > 0 else 1
        energy_curve.append({
            'time': cumulative_time,
            'energy': round(energy, 2)
        })
        cumulative_time += duration
    
    # Camera movement correlation and shot type changes
    camera_movement_cuts = 0
    shot_type_changes = 0
    last_distance = None
    if camera_distance_timeline:
        for sc in scene_changes:
            # Check if camera distance changed around cut
            time = sc['time']
            for timestamp, data in camera_distance_timeline.items():
                if abs(parse_timestamp_to_seconds(timestamp) - time) < 0.5:
                    camera_movement_cuts += 1
                    break
        # Count shot type changes
        for timestamp in sorted(camera_distance_timeline.keys()):
            distance = camera_distance_timeline[timestamp].get('distance')
            if last_distance and distance != last_distance:
                shot_type_changes += 1
            last_distance = distance
    
    # Pacing curve - shot density per 10-second window
    pacing_curve = {}
    window_size = 10
    for i in range(0, int(video_duration), window_size):
        window_start = i
        window_end = min(i + window_size, int(video_duration))
        window_key = f"{window_start}-{window_end}s"
        
        # Count cuts in this window
        cuts_in_window = sum(1 for sc in scene_changes 
                           if window_start <= sc['time'] < window_end)
        pacing_curve[window_key] = cuts_in_window
    
    # Acceleration score - compare first half to second half
    mid_point = video_duration / 2
    first_half_cuts = sum(1 for sc in scene_changes if sc['time'] < mid_point)
    second_half_cuts = sum(1 for sc in scene_changes if sc['time'] >= mid_point)
    
    if first_half_cuts > 0:
        acceleration_score = (second_half_cuts - first_half_cuts) / first_half_cuts
    else:
        acceleration_score = 0 if second_half_cuts == 0 else 1
    
    # Cut density zones - find windows with high cut frequency
    if pacing_curve:
        max_cuts = max(pacing_curve.values())
        threshold = max_cuts * 0.8  # 80% of peak
        cut_density_zones = [window for window, cuts in pacing_curve.items() 
                            if cuts >= threshold and max_cuts > 0]
    else:
        cut_density_zones = []
    
    # Visual load per scene
    visual_load_per_scene = 0
    if object_timeline and total_shots > 0:
        total_objects = 0
        for timestamp, data in object_timeline.items():
            objects = data.get('objects', {})
            total_objects += sum(objects.values())
        visual_load_per_scene = round(total_objects / total_shots, 2)
    
    # Pattern tags (pacing_tags)
    pattern_tags = []
    
    # Quick cuts and pacing tags
    if pacing_classification in ["fast", "very_fast"] or avg_shot_duration < 4:
        pattern_tags.append("quick_cuts")
    
    # Acceleration/deceleration
    if acceleration_score > 0.3:
        pattern_tags.append("accelerating_pace")
    elif acceleration_score < -0.3:
        pattern_tags.append("decelerating_pace")
    
    # Rhythm
    if rhythm_consistency_class == "consistent":
        pattern_tags.append("rhythmic_editing")
    
    # Montage sections
    if len(cut_density_zones) > 0:
        pattern_tags.append("has_montage_sections")
    
    # MTV style
    if avg_shot_duration < 1.5:
        pattern_tags.append("mtv_style")
    
    # Experimental pacing
    if shot_duration_variance > avg_shot_duration:
        pattern_tags.append("experimental_pacing")
    
    return {
        # Required metrics with exact naming
        'total_shots': total_shots,
        'avg_shot_duration': round(avg_shot_duration, 2),
        'shots_per_minute': round(cut_frequency, 2),  # Same as cut_frequency
        'shortest_shot': round(min_shot_duration, 2),
        'longest_shot': round(max_shot_duration, 2),
        'shot_duration_variance': round(shot_duration_variance, 2),
        'pacing_classification': pacing_classification,
        'rhythm_consistency': rhythm_consistency_class,  # String classification
        'pacing_curve': pacing_curve,
        'acceleration_score': round(acceleration_score, 2),
        'cut_density_zones': cut_density_zones,
        'intro_pacing': intro_cuts,
        'outro_pacing': outro_cuts,
        'visual_load_per_scene': visual_load_per_scene,
        'shot_type_changes': shot_type_changes,
        'pacing_tags': pattern_tags,
        
        # Additional metrics for backward compatibility
        'cut_frequency': round(cut_frequency, 2),
        'min_shot_duration': round(min_shot_duration, 2),
        'max_shot_duration': round(max_shot_duration, 2),
        'rhythm_consistency_score': round(rhythm_consistency, 2),
        'shot_distribution': {
            'short': short_shots,
            'medium': medium_shots,
            'long': long_shots
        },
        'rhythm_variability': round(rhythm_variability, 2),
        'acceleration_phases': len(acceleration_phases),
        'complexity_changes': complexity_changes,
        'montage_segments': len(montage_segments),
        'peak_pacing_moments': len(peak_moments),
        'energy_curve': energy_curve[:10],  # First 10 points for context
        'camera_movement_cuts': camera_movement_cuts,
        'scene_pacing_pattern_tags': pattern_tags  # Same as pacing_tags
    }


def compute_speech_analysis_metrics(speech_timeline, transcript, speech_segments, 
                                   expression_timeline, gesture_timeline, 
                                   human_analysis_data, video_duration):
    """Compute comprehensive speech analysis metrics for ML-ready analysis
    
    Args:
        speech_timeline: Timeline of detected words with timestamps
        transcript: Full transcript text
        speech_segments: List of speech segments with timing
        expression_timeline: Timeline of facial expressions
        gesture_timeline: Timeline of gestures
        human_analysis_data: Enhanced human analysis data
        video_duration: Video duration in seconds
        
    Returns:
        dict: Comprehensive speech analysis metrics
    """
    import re
    from collections import defaultdict, Counter
    
    # Initialize metrics
    metrics = {}
    
    # 1. Basic Speech Metrics
    word_count = len(transcript.split()) if transcript else 0
    
    # Calculate speech coverage from segments
    speech_time = 0
    if speech_segments:
        for segment in speech_segments:
            speech_time += segment.get('end', 0) - segment.get('start', 0)
    
    speech_coverage = speech_time / video_duration if video_duration > 0 else 0
    speech_density = word_count / video_duration if video_duration > 0 else 0
    speech_rate_wpm = (word_count / speech_time * 60) if speech_time > 0 else 0
    
    # Find first and last word timestamps
    first_word_timestamp = float('inf')
    last_word_timestamp = 0
    
    for timestamp, data in speech_timeline.items():
        try:
            time = parse_timestamp_to_seconds(timestamp)
            if time is not None:
                first_word_timestamp = min(first_word_timestamp, time)
                last_word_timestamp = max(last_word_timestamp, time)
        except:
            pass
    
    if first_word_timestamp == float('inf'):
        first_word_timestamp = 0
    
    metrics['word_count'] = word_count
    metrics['speech_density'] = round(speech_density, 2)
    metrics['speech_coverage'] = round(speech_coverage, 2)
    metrics['speech_rate_wpm'] = round(speech_rate_wpm, 1)
    metrics['first_word_timestamp'] = round(first_word_timestamp, 2)
    metrics['last_word_timestamp'] = round(last_word_timestamp, 2)
    
    # 2. Speech Rhythm & Pacing
    wpm_by_segment = {}
    window_size = 5  # 5-second windows
    
    for i in range(0, int(video_duration), window_size):
        window_start = i
        window_end = min(i + window_size, int(video_duration))
        window_key = f"{window_start}-{window_end}s"
        
        # Count words in this window
        window_words = 0
        window_time = 0
        
        for segment in speech_segments:
            seg_start = segment.get('start', 0)
            seg_end = segment.get('end', 0)
            
            # Check overlap with window
            if seg_start < window_end and seg_end > window_start:
                overlap_start = max(seg_start, window_start)
                overlap_end = min(seg_end, window_end)
                overlap_duration = overlap_end - overlap_start
                
                # Estimate words in overlap
                segment_words = len(segment.get('text', '').split())
                segment_duration = seg_end - seg_start
                if segment_duration > 0:
                    overlap_words = int(segment_words * (overlap_duration / segment_duration))
                    window_words += overlap_words
                    window_time += overlap_duration
        
        if window_time > 0:
            wpm = (window_words / window_time) * 60
            wpm_by_segment[window_key] = round(wpm, 1)
        else:
            wpm_by_segment[window_key] = 0
    
    # Calculate acceleration score
    first_half_words = 0
    second_half_words = 0
    mid_point = video_duration / 2
    
    for segment in speech_segments:
        seg_words = len(segment.get('text', '').split())
        if segment.get('start', 0) < mid_point:
            first_half_words += seg_words
        else:
            second_half_words += seg_words
    
    if first_half_words > 0:
        speech_acceleration_score = (second_half_words - first_half_words) / first_half_words
    else:
        speech_acceleration_score = 0 if second_half_words == 0 else 1
    
    # Determine rhythm type
    wpm_values = list(wpm_by_segment.values())
    if wpm_values:
        wpm_variance = statistics.variance(wpm_values) if len(wpm_values) > 1 else 0
        avg_wpm = mean(wpm_values)
        
        if wpm_variance < avg_wpm * 0.2:
            speech_rhythm_type = "flowing"
        elif speech_acceleration_score > 0.3:
            speech_rhythm_type = "building"
        elif max(wpm_values) > avg_wpm * 1.5:
            speech_rhythm_type = "staccato"
        else:
            speech_rhythm_type = "erratic"
        
        rhythm_consistency_score = 1 / (1 + wpm_variance / avg_wpm) if avg_wpm > 0 else 0
    else:
        speech_rhythm_type = "none"
        rhythm_consistency_score = 0
        wpm_variance = 0
    
    # Front-load ratio
    front_words = 0
    front_limit = video_duration * 0.2  # First 20%
    
    for segment in speech_segments:
        if segment.get('start', 0) < front_limit:
            front_words += len(segment.get('text', '').split())
    
    speech_front_load_ratio = front_words / word_count if word_count > 0 else 0
    
    metrics['wpm_by_segment'] = wpm_by_segment
    metrics['speech_acceleration_score'] = round(speech_acceleration_score, 2)
    metrics['speech_rhythm_type'] = speech_rhythm_type
    metrics['rhythm_consistency_score'] = round(rhythm_consistency_score, 2)
    metrics['speech_front_load_ratio'] = round(speech_front_load_ratio, 2)
    
    # 3. Pause & Gap Analysis
    gaps = []
    if speech_segments:
        sorted_segments = sorted(speech_segments, key=lambda x: x.get('start', 0))
        
        for i in range(1, len(sorted_segments)):
            gap_start = sorted_segments[i-1].get('end', 0)
            gap_end = sorted_segments[i].get('start', 0)
            gap_duration = gap_end - gap_start
            
            if gap_duration > 1:  # Pauses > 1 second
                gap_type = "dramatic" if gap_duration > 2 else "strategic"
                if gap_duration > 3:
                    gap_type = "awkward"
                
                gaps.append({
                    'start': round(gap_start, 2),
                    'duration': round(gap_duration, 2),
                    'type': gap_type
                })
    
    total_pause_time = sum(gap['duration'] for gap in gaps)
    pause_count = len(gaps)
    longest_pause_duration = max((gap['duration'] for gap in gaps), default=0)
    strategic_pauses = sum(1 for gap in gaps if gap['type'] == 'strategic')
    awkward_pauses = sum(1 for gap in gaps if gap['type'] == 'awkward')
    
    metrics['pause_analysis'] = {
        'gaps': gaps,
        'total_pause_time': round(total_pause_time, 2),
        'pause_count': pause_count,
        'longest_pause_duration': round(longest_pause_duration, 2),
        'strategic_pauses': strategic_pauses,
        'awkward_pauses': awkward_pauses
    }
    
    # 4. Hook Detection
    hook_phrases = []
    hook_patterns = [
        (r'\b(did you know|guess what|wait for it|watch this|check this out)\b', 'question'),
        (r'\b(amazing|incredible|mind-blowing|shocking|unbelievable)\b', 'hyperbole'),
        (r'\b(you won\'t believe|you need to see|this will change)\b', 'promise'),
        (r'^(hey|hi|hello|what\'s up)', 'greeting'),
        (r'\b(secret|trick|hack|tip)\b', 'value_prop')
    ]
    
    # Analyze transcript for hooks
    lower_transcript = transcript.lower() if transcript else ""
    
    for pattern, hook_type in hook_patterns:
        matches = re.finditer(pattern, lower_transcript, re.IGNORECASE)
        for match in matches:
            # Find approximate timestamp
            word_position = len(lower_transcript[:match.start()].split())
            estimated_time = (word_position / word_count * speech_time) if word_count > 0 else 0
            
            hook_phrases.append({
                'text': match.group(),
                'timestamp': round(estimated_time, 2),
                'type': hook_type,
                'confidence': 0.8
            })
    
    # Calculate hook density per 10s
    hook_density_per_10s = defaultdict(int)
    for hook in hook_phrases:
        window = int(hook['timestamp'] / 10) * 10
        window_key = f"{window}-{window+10}s"
        hook_density_per_10s[window_key] += 1
    
    # Opening hook strength (based on first 3 seconds)
    opening_hooks = sum(1 for hook in hook_phrases if hook['timestamp'] < 3)
    opening_hook_strength = min(opening_hooks / 2, 1)  # Normalize to 0-1
    
    metrics['hook_density_per_10s'] = dict(hook_density_per_10s)
    metrics['hook_phrases'] = hook_phrases[:10]  # Top 10 hooks
    metrics['opening_hook_strength'] = round(opening_hook_strength, 2)
    
    # 5. CTA Analysis
    cta_phrases = []
    cta_patterns = [
        (r'\b(follow|like|subscribe|comment|share|hit the)\b', 'engagement'),
        (r'\b(link in bio|check out|visit|go to)\b', 'traffic'),
        (r'\b(buy|purchase|get yours|order now)\b', 'conversion'),
        (r'\b(save this|bookmark|remember)\b', 'save'),
        (r'\b(tag someone|send this|share with)\b', 'viral')
    ]
    
    for pattern, cta_category in cta_patterns:
        matches = re.finditer(pattern, lower_transcript, re.IGNORECASE)
        for match in matches:
            word_position = len(lower_transcript[:match.start()].split())
            estimated_time = (word_position / word_count * speech_time) if word_count > 0 else 0
            
            # Determine urgency based on context
            urgency = "low"
            if any(word in match.group().lower() for word in ['now', 'today', 'quick']):
                urgency = "high"
            elif estimated_time > speech_time * 0.7:  # In last 30%
                urgency = "medium"
            
            cta_phrases.append({
                'text': match.group(),
                'timestamp': round(estimated_time, 2),
                'urgency': urgency,
                'category': cta_category
            })
    
    # CTA density and clustering
    cta_density_per_10s = defaultdict(int)
    for cta in cta_phrases:
        window = int(cta['timestamp'] / 10) * 10
        window_key = f"{window}-{window+10}s"
        cta_density_per_10s[window_key] += 1
    
    # Find CTA clusters
    cta_clustering = []
    if cta_phrases:
        sorted_ctas = sorted(cta_phrases, key=lambda x: x['timestamp'])
        cluster_start = sorted_ctas[0]['timestamp']
        cluster_count = 1
        
        for i in range(1, len(sorted_ctas)):
            if sorted_ctas[i]['timestamp'] - sorted_ctas[i-1]['timestamp'] < 5:
                cluster_count += 1
            else:
                if cluster_count >= 2:
                    cta_clustering.append({
                        'start': round(cluster_start, 2),
                        'end': round(sorted_ctas[i-1]['timestamp'], 2),
                        'count': cluster_count
                    })
                cluster_start = sorted_ctas[i]['timestamp']
                cluster_count = 1
        
        # Check last cluster
        if cluster_count >= 2:
            cta_clustering.append({
                'start': round(cluster_start, 2),
                'end': round(sorted_ctas[-1]['timestamp'], 2),
                'count': cluster_count
            })
    
    metrics['cta_density_per_10s'] = dict(cta_density_per_10s)
    metrics['cta_phrases'] = cta_phrases[:10]  # Top 10 CTAs
    metrics['cta_clustering'] = cta_clustering
    
    # 6. Speech Quality
    clarity_score_by_window = {}
    overall_confidences = []
    
    # Calculate clarity from speech segments
    for i in range(0, int(video_duration), 5):
        window_key = f"{i}-{i+5}s"
        window_confidences = []
        
        for segment in speech_segments:
            if i <= segment.get('start', 0) < i + 5:
                confidence = segment.get('confidence', 0.5)
                window_confidences.append(confidence)
                overall_confidences.append(confidence)
        
        if window_confidences:
            clarity_score_by_window[window_key] = round(mean(window_confidences), 2)
        else:
            clarity_score_by_window[window_key] = 0
    
    overall_clarity_score = mean(overall_confidences) if overall_confidences else 0
    
    # Filler word detection
    filler_words = ['um', 'uh', 'like', 'you know', 'basically', 'literally', 'actually']
    filler_count = 0
    for filler in filler_words:
        filler_count += len(re.findall(r'\b' + filler + r'\b', lower_transcript, re.IGNORECASE))
    
    filler_word_ratio = filler_count / word_count if word_count > 0 else 0
    
    # Find mumbling segments (low confidence)
    mumbling_segments = []
    for segment in speech_segments:
        if segment.get('confidence', 1) < 0.6:
            mumbling_segments.append({
                'start': round(segment.get('start', 0), 2),
                'end': round(segment.get('end', 0), 2),
                'confidence': round(segment.get('confidence', 0), 2)
            })
    
    metrics['clarity_score_by_window'] = clarity_score_by_window
    metrics['overall_clarity_score'] = round(overall_clarity_score, 2)
    metrics['filler_word_ratio'] = round(filler_word_ratio, 3)
    metrics['mumbling_segments'] = mumbling_segments
    metrics['background_noise_ratio'] = 0.1  # Placeholder - would need audio analysis
    
    # 7. Engagement Patterns
    direct_address_count = len(re.findall(r'\b(you|your|you\'re|you\'ll|you\'ve)\b', lower_transcript, re.IGNORECASE))
    inclusive_words = len(re.findall(r'\b(we|us|our|let\'s)\b', lower_transcript, re.IGNORECASE))
    inclusive_language_ratio = inclusive_words / word_count if word_count > 0 else 0
    
    # Find repetition patterns
    words = lower_transcript.split()
    phrase_counter = Counter()
    
    # Count 2-3 word phrases
    for i in range(len(words) - 2):
        phrase_2 = ' '.join(words[i:i+2])
        phrase_3 = ' '.join(words[i:i+3])
        
        # Skip common phrases
        if not any(common in phrase_2 for common in ['the', 'and', 'for', 'you', 'this']):
            phrase_counter[phrase_2] += 1
        if not any(common in phrase_3 for common in ['the', 'and', 'for']):
            phrase_counter[phrase_3] += 1
    
    # Find repeated phrases
    repetition_phrases = []
    for phrase, count in phrase_counter.most_common(5):
        if count >= 2:
            repetition_phrases.append({
                'text': phrase,
                'count': count,
                'timestamps': []  # Would need more detailed analysis
            })
    
    # Count questions
    question_count = len(re.findall(r'\?|[.!]\s*(?:did|what|why|how|when|where|who|which)', lower_transcript, re.IGNORECASE))
    
    metrics['direct_address_count'] = direct_address_count
    metrics['inclusive_language_ratio'] = round(inclusive_language_ratio, 2)
    metrics['repetition_patterns'] = {
        'phrases': repetition_phrases,
        'emphasis_words': []  # Would need emphasis detection
    }
    metrics['question_count'] = question_count
    
    # 8. Speech Bursts & Energy
    speech_bursts = []
    burst_threshold = speech_rate_wpm * 1.3  # 30% faster than average
    
    for segment in speech_segments:
        seg_duration = segment.get('end', 0) - segment.get('start', 0)
        seg_words = len(segment.get('text', '').split())
        
        if seg_duration > 0:
            seg_wpm = (seg_words / seg_duration) * 60
            
            if seg_wpm > burst_threshold and seg_duration > 2:
                burst_type = "rapid" if seg_wpm > burst_threshold * 1.5 else "energetic"
                speech_bursts.append({
                    'start': round(segment.get('start', 0), 2),
                    'end': round(segment.get('end', 0), 2),
                    'words': seg_words,
                    'wpm': round(seg_wpm, 1),
                    'type': burst_type
                })
    
    # Determine burst pattern
    if speech_bursts:
        avg_burst_time = mean([burst['start'] for burst in speech_bursts])
        if avg_burst_time < video_duration * 0.3:
            burst_pattern = "front_loaded"
        elif avg_burst_time > video_duration * 0.7:
            burst_pattern = "climax"
        else:
            burst_pattern = "distributed"
    else:
        burst_pattern = "none"
    
    # Energy levels by window
    energy_level_windows = {}
    for window, wpm in wpm_by_segment.items():
        if speech_rate_wpm > 0:
            energy = min(wpm / speech_rate_wpm, 2)  # Normalize to 0-2
            energy_level_windows[window] = round(energy, 2)
        else:
            energy_level_windows[window] = 0
    
    energy_values = list(energy_level_windows.values())
    energy_variance = statistics.variance(energy_values) if len(energy_values) > 1 else 0
    
    # Find climax moment
    climax_timestamp = 0
    max_energy = 0
    for window, energy in energy_level_windows.items():
        if energy > max_energy:
            max_energy = energy
            # Extract start time from window
            climax_timestamp = int(window.split('-')[0])
    
    metrics['speech_bursts'] = speech_bursts
    metrics['burst_pattern'] = burst_pattern
    metrics['energy_level_windows'] = energy_level_windows
    metrics['energy_variance'] = round(energy_variance, 2)
    metrics['climax_timestamp'] = climax_timestamp
    
    # 9. Speech-to-Visual Sync Features
    gesture_sync_ratio = 0
    face_on_screen_during_speech = 0
    
    # Calculate gesture sync
    if gesture_timeline and speech_segments:
        speech_with_gesture = 0
        
        for segment in speech_segments:
            seg_start = segment.get('start', 0)
            seg_end = segment.get('end', 0)
            
            # Check if any gestures occur during this speech segment
            for timestamp, gesture_data in gesture_timeline.items():
                gesture_time = parse_timestamp_to_seconds(timestamp)
                if gesture_time and seg_start <= gesture_time <= seg_end:
                    speech_with_gesture += 1
                    break
        
        gesture_sync_ratio = speech_with_gesture / len(speech_segments) if speech_segments else 0
    
    # Calculate face visibility during speech
    if expression_timeline and speech_time > 0:
        face_time_during_speech = 0
        
        for segment in speech_segments:
            seg_start = segment.get('start', 0)
            seg_end = segment.get('end', 0)
            
            # Check expressions during this segment
            for timestamp, expr_data in expression_timeline.items():
                expr_time = parse_timestamp_to_seconds(timestamp)
                if expr_time and seg_start <= expr_time <= seg_end:
                    face_time_during_speech += 1
        
        face_on_screen_during_speech = face_time_during_speech / speech_time
    
    # Find gesture emphasis moments
    gesture_emphasis_moments = []
    
    # This would require more detailed word-level timing
    # For now, we'll identify potential moments
    
    # Visual absence analysis
    off_camera_speech_segments = []
    for segment in speech_segments:
        # Check if face is visible during this segment
        seg_has_face = False
        seg_start = segment.get('start', 0)
        seg_end = segment.get('end', 0)
        
        for timestamp in expression_timeline:
            expr_time = parse_timestamp_to_seconds(timestamp)
            if expr_time and seg_start <= expr_time <= seg_end:
                seg_has_face = True
                break
        
        if not seg_has_face:
            off_camera_speech_segments.append({
                'start': round(seg_start, 2),
                'end': round(seg_end, 2),
                'speech_content': segment.get('text', '')[:50] + '...'
            })
    
    speech_only_ratio = len(off_camera_speech_segments) / len(speech_segments) if speech_segments else 0
    
    # Count expression variety during speech
    expressions_during_speech = set()
    for segment in speech_segments:
        for timestamp, expr_data in expression_timeline.items():
            expr_time = parse_timestamp_to_seconds(timestamp)
            if expr_time and segment.get('start', 0) <= expr_time <= segment.get('end', 0):
                expressions_during_speech.add(expr_data.get('expression', 'unknown'))
    
    expression_variety_during_speech = len(expressions_during_speech) / 10  # Normalize to 0-1
    
    metrics['speech_visual_alignment'] = {
        'gesture_emphasis_moments': gesture_emphasis_moments,
        'expression_peaks_during_speech': [],  # Would need peak detection
        'lip_sync_quality': 0.8,  # Placeholder
        'body_language_congruence': round(gesture_sync_ratio, 2)
    }
    
    metrics['gesture_sync_ratio'] = round(gesture_sync_ratio, 2)
    metrics['face_on_screen_during_speech'] = round(face_on_screen_during_speech, 2)
    metrics['off_camera_speech_segments'] = off_camera_speech_segments
    metrics['speech_only_ratio'] = round(speech_only_ratio, 2)
    metrics['visual_punctuation_count'] = len(gesture_emphasis_moments)
    metrics['expression_variety_during_speech'] = round(expression_variety_during_speech, 2)
    
    # 10. Pattern Tags
    speech_pattern_tags = []
    
    if opening_hook_strength > 0.5:
        speech_pattern_tags.append("strong_opening")
    if speech_rate_wpm > 150:
        speech_pattern_tags.append("rapid_delivery")
    if len(gaps) > 3 and any(gap['type'] == 'dramatic' for gap in gaps):
        speech_pattern_tags.append("has_dramatic_pauses")
    if repetition_phrases:
        speech_pattern_tags.append("repetitive_emphasis")
    if direct_address_count > word_count * 0.05:
        speech_pattern_tags.append("direct_address_heavy")
    if cta_clustering:
        speech_pattern_tags.append("cta_clustered")
    if burst_pattern in ["climax", "building"]:
        speech_pattern_tags.append("energy_building")
    if overall_clarity_score > 0.85:
        speech_pattern_tags.append("clear_articulation")
    if gesture_sync_ratio > 0.6:
        speech_pattern_tags.append("high_gesture_sync")
    if face_on_screen_during_speech > 0.8:
        speech_pattern_tags.append("face_focused_delivery")
    
    metrics['speech_pattern_tags'] = speech_pattern_tags
    
    # 11. Conversation Analysis
    speech_type = "monologue"  # Default, would need speaker diarization
    speaker_changes = 0
    dominant_speaker_ratio = 1.0
    
    metrics['speech_type'] = speech_type
    metrics['speaker_changes'] = speaker_changes
    metrics['dominant_speaker_ratio'] = dominant_speaker_ratio
    
    # 12. Summary Scores
    hook_effectiveness_score = min((len(hook_phrases) * 0.2 + opening_hook_strength), 1)
    cta_effectiveness_score = min((len(cta_phrases) * 0.1 + len(cta_clustering) * 0.3), 1)
    delivery_confidence_score = overall_clarity_score
    
    # Calculate authenticity based on patterns
    authenticity_factors = [
        filler_word_ratio < 0.05,  # Not too polished
        filler_word_ratio > 0.01,  # Not too scripted
        len(repetition_phrases) < 3,  # Not too repetitive
        energy_variance > 0.1,  # Natural variation
        len(mumbling_segments) < 2  # Clear but natural
    ]
    authenticity_score = sum(authenticity_factors) / len(authenticity_factors)
    
    # Overall engagement score
    engagement_factors = [
        hook_effectiveness_score,
        direct_address_count > 0,
        question_count > 0,
        gesture_sync_ratio > 0.5,
        speech_rate_wpm > 120,
        burst_pattern != "none"
    ]
    verbal_engagement_score = sum(1 for f in engagement_factors if f) / len(engagement_factors)
    
    # Visual-verbal harmony
    visual_verbal_harmony_score = (gesture_sync_ratio + face_on_screen_during_speech) / 2
    
    metrics['hook_effectiveness_score'] = round(hook_effectiveness_score, 2)
    metrics['cta_effectiveness_score'] = round(cta_effectiveness_score, 2)
    metrics['delivery_confidence_score'] = round(delivery_confidence_score, 2)
    metrics['authenticity_score'] = round(authenticity_score, 2)
    metrics['verbal_engagement_score'] = round(verbal_engagement_score, 2)
    metrics['visual_verbal_harmony_score'] = round(visual_verbal_harmony_score, 2)
    
    return metrics


def extract_real_ml_data(unified_data, prompt_name, video_id=None):
    """Extract only real ML detection data for a specific prompt"""
    
    context_data = {
        'duration': unified_data.get('duration_seconds', 0),
        'caption': unified_data.get('static_metadata', {}).get('captionText', '')[:500],
        'engagement_stats': unified_data.get('static_metadata', {}).get('stats', {}),
        '_validation': {
            'extracted_at': datetime.now().isoformat(),
            'prompt_type': prompt_name,
            'data_source': 'unified_analysis'
        }
    }
    
    timelines = unified_data.get('timelines', {})
    
    if prompt_name == 'visual_overlay_analysis':
        # Compute comprehensive visual overlay metrics
        visual_overlay_metrics = compute_visual_overlay_metrics(
            timelines.get('textOverlayTimeline', {}),
            timelines.get('stickerTimeline', {}),
            timelines.get('gestureTimeline', {}),
            timelines.get('speechTimeline', {}),
            timelines.get('objectTimeline', {}),
            unified_data.get('duration_seconds', 30)
        )
        
        context_data['visual_overlay_metrics'] = visual_overlay_metrics
        context_data['textOverlayTimeline'] = timelines.get('textOverlayTimeline', {})
        context_data['stickerTimeline'] = timelines.get('stickerTimeline', {})
        context_data['gestureTimeline'] = timelines.get('gestureTimeline', {})
        
    elif prompt_name == 'creative_density':
        # Compute density metrics instead of sending full timelines
        density_metrics = compute_creative_density_analysis(
            timelines,
            unified_data.get('duration_seconds', 30)
        )
        context_data['density_analysis'] = density_metrics['density_analysis']
        
    elif prompt_name == 'emotional_journey':
        # Compute emotional metrics
        emotional_metrics = compute_emotional_metrics(
            expression_timeline=timelines.get('expressionTimeline', {}),
            speech_timeline=timelines.get('speechTimeline', {}),
            gesture_timeline=timelines.get('gestureTimeline', {}),
            duration=unified_data.get('duration_seconds', 30)
        )
        context_data['emotional_metrics'] = emotional_metrics
        
        # Also include raw timelines for validation
        context_data['expression_timeline'] = timelines.get('expressionTimeline', {})
        context_data['gesture_timeline'] = timelines.get('gestureTimeline', {})
        context_data['speech_timeline'] = timelines.get('speechTimeline', {})
        context_data['camera_distance_timeline'] = timelines.get('cameraDistanceTimeline', {})
        context_data['transcript'] = unified_data.get('metadata_summary', {}).get('transcript', '')
        context_data['speech_segments'] = unified_data.get('metadata_summary', {}).get('speechSegments', [])
        
    elif prompt_name == 'person_framing':
        # Get enhanced human analysis data if available
        enhanced_human_data = unified_data.get('metadata_summary', {}).get('enhancedHumanAnalysis', {})
        
        # Compute person framing metrics
        person_framing_metrics = compute_person_framing_metrics(
            expression_timeline=timelines.get('expressionTimeline', {}),
            object_timeline=timelines.get('objectTimeline', {}),
            camera_distance_timeline=timelines.get('cameraDistanceTimeline', {}),
            person_timeline=timelines.get('personTimeline', {}),
            enhanced_human_data=enhanced_human_data,
            duration=unified_data.get('duration_seconds', 30)
        )
        
        # Add metrics to context data
        context_data['person_framing_metrics'] = person_framing_metrics
        
        # Include timeline summary for validation
        context_data['timeline_summary'] = {
            'total_frames': len(timelines.get('expressionTimeline', {})),
            'gesture_count': len(timelines.get('gestureTimeline', {})),
            'expression_count': len(timelines.get('expressionTimeline', {})),
            'object_detection_frames': len(timelines.get('objectTimeline', {})),
            'text_detection_frames': len(timelines.get('textOverlayTimeline', {})),
            'speech_segments': len(timelines.get('speechTimeline', {})),
            'scene_changes': len(timelines.get('sceneChangeTimeline', {}))
        }
        
        # Include insights if available
        context_data['insights'] = unified_data.get('insights', {})
        
    elif prompt_name == 'scene_pacing':
        # Compute scene pacing metrics
        scene_pacing_metrics = compute_scene_pacing_metrics(
            scene_timeline=timelines.get('sceneChangeTimeline', {}),
            video_duration=unified_data.get('duration_seconds', 30),
            object_timeline=timelines.get('objectTimeline', {}),
            camera_distance_timeline=timelines.get('cameraDistanceTimeline', {})
        )
        
        # Add metrics to context data
        context_data['scene_pacing_metrics'] = scene_pacing_metrics
        
        # Include raw timeline for validation
        context_data['scene_timeline'] = timelines.get('sceneChangeTimeline', {})
        context_data['object_timeline'] = timelines.get('objectTimeline', {})
        context_data['camera_distance_timeline'] = timelines.get('cameraDistanceTimeline', {})
        
    elif prompt_name == 'speech_analysis':
        # Get metadata summary for transcript and speech segments
        metadata_summary = unified_data.get('metadata_summary', {})
        
        # Get enhanced human analysis data if available
        enhanced_human_data = metadata_summary.get('enhancedHumanAnalysis', {})
        
        # Compute speech analysis metrics
        speech_analysis_metrics = compute_speech_analysis_metrics(
            speech_timeline=timelines.get('speechTimeline', {}),
            transcript=metadata_summary.get('transcript', ''),
            speech_segments=metadata_summary.get('speechSegments', []),
            expression_timeline=timelines.get('expressionTimeline', {}),
            gesture_timeline=timelines.get('gestureTimeline', {}),
            human_analysis_data=enhanced_human_data,
            video_duration=unified_data.get('duration_seconds', 30)
        )
        
        # Add metrics to context data
        context_data['speech_analysis_metrics'] = speech_analysis_metrics
        
        # Include raw data for validation
        context_data['speech_timeline'] = timelines.get('speechTimeline', {})
        context_data['transcript'] = metadata_summary.get('transcript', '')
        context_data['word_count'] = metadata_summary.get('wordCount', 0)
        context_data['speech_segments'] = metadata_summary.get('speechSegments', [])
        context_data['expression_timeline'] = timelines.get('expressionTimeline', {})
        context_data['camera_distance_timeline'] = timelines.get('cameraDistanceTimeline', {})
        
    elif prompt_name == 'metadata_analysis':
        # For metadata analysis, only include static metadata (no timelines)
        static_metadata = unified_data.get('static_metadata', {})
        context_data['static_metadata'] = {
            'captionText': static_metadata.get('captionText', ''),
            'hashtags': static_metadata.get('hashtags', []),
            'stats': static_metadata.get('stats', {}),
            'createTime': static_metadata.get('createTime', ''),
            'duration': static_metadata.get('duration', 0),
            'musicMeta': static_metadata.get('musicMeta', {})
        }
        # Also include collectCount if available
        if 'collectCount' in static_metadata:
            context_data['static_metadata']['collectCount'] = static_metadata.get('collectCount', 0)
        
    else:
        # For other prompts, include relevant timeline data
        context_data['timelines'] = timelines
        context_data['metadata_summary'] = unified_data.get('metadata_summary', {})
    
    return context_data


def update_progress(video_id, prompt_name, status, message=""):
    """Update progress file for real-time monitoring"""
    progress_file = f'insights/{video_id}/progress.json'
    os.makedirs(os.path.dirname(progress_file), exist_ok=True)
    
    try:
        if os.path.exists(progress_file):
            with open(progress_file, 'r') as f:
                progress = json.load(f)
        else:
            progress = {'prompts': {}, 'start_time': datetime.now().isoformat()}
        
        progress['prompts'][prompt_name] = {
            'status': status,
            'timestamp': datetime.now().isoformat(),
            'message': message
        }
        progress['last_update'] = datetime.now().isoformat()
        
        with open(progress_file, 'w') as f:
            json.dump(progress, f, indent=2)
    except Exception as e:
        print(f"⚠️ Failed to update progress file: {e}")


def run_single_prompt(video_id, prompt_name):
    """Run a single prompt for a video"""
    print(f"\n🎬 Running {prompt_name} for video {video_id}")
    update_progress(video_id, prompt_name, 'started')
    
    # Check if unified analysis exists
    unified_path = f'unified_analysis/{video_id}.json'
    if not os.path.exists(unified_path):
        print(f"❌ Error: {unified_path} not found!")
        # Try to list what files are in the directory
        import glob
        unified_files = glob.glob('unified_analysis/*.json')
        if unified_files:
            print(f"   Available files in unified_analysis/: {', '.join([os.path.basename(f) for f in unified_files[:5]])}")
        return False
    
    # Load unified analysis
    try:
        with open(unified_path, 'r') as f:
            unified_data = json.load(f)
        print(f"✅ Loaded unified analysis: {len(str(unified_data))} characters")
        update_progress(video_id, prompt_name, 'processing', 'Loaded unified analysis')
    except Exception as e:
        print(f"❌ Error loading unified analysis: {str(e)}")
        update_progress(video_id, prompt_name, 'failed', f'Error loading unified analysis: {str(e)}')
        return False
    
    # Extract ML data
    context_data = extract_real_ml_data(unified_data, prompt_name, video_id)
    
    # Load prompt template
    prompt_template_path = f'prompt_templates/{prompt_name}.txt'
    if not os.path.exists(prompt_template_path):
        print(f"❌ Error: Prompt template {prompt_template_path} not found!")
        return False
    
    with open(prompt_template_path, 'r') as f:
        prompt_text = f.read()
    
    # Add mode to context data
    context_data['mode'] = 'labeling'
    
    # Run the prompt
    result = runner.run_claude_prompt(
        video_id=video_id,
        prompt_name=prompt_name,
        prompt_text=prompt_text,
        context_data=context_data
    )
    
    if result and result.get('success'):
        print(f"✅ {prompt_name} completed successfully!")
        update_progress(video_id, prompt_name, 'completed', 'Success')
        return True
    else:
        error_msg = result.get('error', 'Unknown error') if result else 'No result returned'
        print(f"❌ {prompt_name} failed!")
        print(f"Error: {error_msg}")
        update_progress(video_id, prompt_name, 'failed', error_msg)
        return False


def main():
    if len(sys.argv) != 2:
        print("Usage: python run_video_prompts_validated_v2.py <video_id>")
        print("\nThis script runs all Claude prompts for a video")
        sys.exit(1)
    
    video_id = sys.argv[1]
    
    # List of prompts to run
    prompts = [
        'creative_density',
        'emotional_journey',
        'speech_analysis',
        'visual_overlay_analysis',
        'metadata_analysis',
        'person_framing',
        'scene_pacing'
    ]
    
    print(f"\n🧠 Running {len(prompts)} Claude prompts for video {video_id}")
    
    successful = 0
    for prompt_name in prompts:
        if run_single_prompt(video_id, prompt_name):
            successful += 1
    
    print(f"\n📊 Summary: {successful}/{len(prompts)} prompts completed successfully")
    
    return 0 if successful == len(prompts) else 1


if __name__ == "__main__":
    sys.exit(main())