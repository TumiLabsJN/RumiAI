#!/usr/bin/env python3
"""
ML Data Validator - Ensures only real ML detection data is used in prompts
Prevents fabricated data and validates timeline existence
"""

import json
import logging
from typing import Dict, List, Optional, Any, Tuple
from pathlib import Path
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class MLDataValidator:
    """Validates ML detection data before sending to Claude"""
    
    def __init__(self, strict_mode: bool = True):
        """
        Initialize validator
        
        Args:
            strict_mode: If True, raises exceptions on validation failures.
                        If False, logs warnings and returns safe defaults.
        """
        self.strict_mode = strict_mode
        self.validation_log = []
        
    def validate_unified_analysis(self, unified_data: Dict) -> Tuple[bool, List[str]]:
        """
        Validate the structure and content of unified analysis data
        
        Returns:
            Tuple of (is_valid, list_of_issues)
        """
        issues = []
        
        # Check required top-level fields
        required_fields = ['video_id', 'timelines', 'static_metadata', 'duration_seconds']
        for field in required_fields:
            if field not in unified_data:
                issues.append(f"Missing required field: {field}")
        
        # Validate timelines structure
        if 'timelines' in unified_data:
            timelines = unified_data['timelines']
            expected_timelines = [
                'objectTimeline', 'textOverlayTimeline', 'speechTimeline',
                'gestureTimeline', 'expressionTimeline', 'stickerTimeline'
            ]
            
            for timeline_name in expected_timelines:
                if timeline_name not in timelines:
                    issues.append(f"Missing timeline: {timeline_name}")
                elif not isinstance(timelines[timeline_name], dict):
                    issues.append(f"Invalid timeline format: {timeline_name} should be dict")
        
        # Validate static metadata
        if 'static_metadata' in unified_data:
            metadata = unified_data['static_metadata']
            if 'stats' in metadata and not isinstance(metadata['stats'], dict):
                issues.append("Invalid stats format in static_metadata")
        
        return len(issues) == 0, issues
    
    def validate_timeline_data(self, timeline_data: Dict, timeline_name: str) -> Tuple[bool, List[str]]:
        """
        Validate specific timeline data structure
        
        Returns:
            Tuple of (is_valid, list_of_issues)
        """
        issues = []
        
        if not timeline_data:
            return True, []  # Empty timeline is valid
        
        # Check timeline format (should be time-based dict)
        for timestamp, data in timeline_data.items():
            # Validate timestamp format (e.g., "0-1s", "1-2s")
            if not self._is_valid_timestamp(timestamp):
                issues.append(f"Invalid timestamp format in {timeline_name}: {timestamp}")
            
            # Validate data structure based on timeline type
            if timeline_name == 'objectTimeline':
                if not isinstance(data, dict):
                    issues.append(f"Invalid data at {timestamp} in {timeline_name}")
                elif 'objects' not in data or not isinstance(data['objects'], dict):
                    issues.append(f"Missing or invalid 'objects' field at {timestamp}")
                    
            elif timeline_name == 'textOverlayTimeline':
                if not isinstance(data, dict):
                    issues.append(f"Invalid data at {timestamp} in {timeline_name}")
                elif 'texts' in data and not isinstance(data['texts'], list):
                    issues.append(f"Invalid 'texts' field at {timestamp} - should be list")
                    
            elif timeline_name == 'speechTimeline':
                if not isinstance(data, dict):
                    issues.append(f"Invalid data at {timestamp} in {timeline_name}")
        
        return len(issues) == 0, issues
    
    def _is_valid_timestamp(self, timestamp: str) -> bool:
        """Check if timestamp follows expected format (e.g., '0-1s', '10-11s')"""
        import re
        pattern = r'^\d+-\d+s$'
        return bool(re.match(pattern, timestamp))
    
    def extract_safe_context_data(self, unified_data: Dict, prompt_name: str, 
                                 max_timeline_entries: int = 50) -> Dict:
        """
        Extract and validate context data for a specific prompt
        Only includes data that actually exists in the ML analysis
        
        Args:
            unified_data: The unified analysis data
            prompt_name: Name of the prompt being run
            max_timeline_entries: Maximum timeline entries to include
            
        Returns:
            Safe context data dict with only validated ML detections
        """
        # Validate unified data first
        is_valid, issues = self.validate_unified_analysis(unified_data)
        if not is_valid:
            if self.strict_mode:
                raise ValueError(f"Invalid unified data: {', '.join(issues)}")
            else:
                logger.warning(f"Unified data validation issues: {', '.join(issues)}")
        
        # Build safe context with only existing data
        context = {}
        
        # Add basic metadata if exists
        if 'duration_seconds' in unified_data:
            context['duration'] = unified_data['duration_seconds']
        
        if 'static_metadata' in unified_data:
            metadata = unified_data['static_metadata']
            
            # Add caption if exists (truncated)
            if 'captionText' in metadata:
                context['caption'] = metadata['captionText'][:500]
            
            # Add stats if exists
            if 'stats' in metadata and isinstance(metadata['stats'], dict):
                context['engagement_stats'] = metadata['stats']
        
        # Add timeline data based on prompt requirements
        timelines = unified_data.get('timelines', {})
        
        if prompt_name == 'hook_analysis':
            # For hook analysis, only include first 5 seconds
            context['first_5_seconds'] = {}
            
            for timeline_name, timeline_data in timelines.items():
                if isinstance(timeline_data, dict) and timeline_data:
                    filtered = self._filter_timeline_by_seconds(timeline_data, max_seconds=5)
                    if filtered:
                        context['first_5_seconds'][timeline_name] = filtered
                        
        elif prompt_name in ['creative_density', 'engagement_triggers']:
            # Include sampled timeline data
            context['timeline_samples'] = {}
            
            for timeline_name, timeline_data in timelines.items():
                if isinstance(timeline_data, dict) and timeline_data:
                    sampled = self._sample_timeline(timeline_data, max_entries=max_timeline_entries)
                    if sampled:
                        context['timeline_samples'][timeline_name] = sampled
                        
        else:
            # For other prompts, include summary stats only
            context['timeline_summary'] = self._get_timeline_summary(timelines)
        
        # Add validation metadata
        context['_validation'] = {
            'validated_at': datetime.now().isoformat(),
            'data_source': 'ml_detections',
            'validator_version': '1.0'
        }
        
        return context
    
    def _filter_timeline_by_seconds(self, timeline: Dict, max_seconds: int) -> Dict:
        """Filter timeline to only include entries up to max_seconds"""
        filtered = {}
        
        for timestamp, data in timeline.items():
            # Extract start second from timestamp (e.g., "3-4s" -> 3)
            try:
                start_second = int(timestamp.split('-')[0])
                if start_second < max_seconds:
                    filtered[timestamp] = data
            except (ValueError, IndexError):
                logger.warning(f"Invalid timestamp format: {timestamp}")
                
        return filtered
    
    def _sample_timeline(self, timeline: Dict, max_entries: int) -> Dict:
        """Sample timeline entries evenly across the video"""
        if len(timeline) <= max_entries:
            return timeline
        
        # Sort by timestamp
        sorted_items = sorted(timeline.items(), 
                            key=lambda x: int(x[0].split('-')[0]) if '-' in x[0] else 0)
        
        # Calculate step size for even sampling
        step = max(1, len(sorted_items) // max_entries)
        sampled = dict(sorted_items[::step])
        
        return sampled
    
    def _get_timeline_summary(self, timelines: Dict) -> Dict:
        """Get summary statistics for timelines without including raw data"""
        summary = {}
        
        for timeline_name, timeline_data in timelines.items():
            if isinstance(timeline_data, dict):
                summary[timeline_name] = {
                    'entry_count': len(timeline_data),
                    'has_data': len(timeline_data) > 0
                }
                
                # Add specific counts for certain timelines
                if timeline_name == 'objectTimeline':
                    object_counts = {}
                    for entry in timeline_data.values():
                        if isinstance(entry, dict) and 'objects' in entry:
                            for obj, count in entry.get('objects', {}).items():
                                object_counts[obj] = object_counts.get(obj, 0) + count
                    summary[timeline_name]['unique_objects'] = list(object_counts.keys())
                    summary[timeline_name]['total_detections'] = sum(object_counts.values())
                    
                elif timeline_name == 'textOverlayTimeline':
                    text_count = 0
                    for entry in timeline_data.values():
                        if isinstance(entry, dict) and 'texts' in entry:
                            text_count += len(entry.get('texts', []))
                    summary[timeline_name]['total_text_detections'] = text_count
        
        return summary
    
    def validate_prompt_context(self, prompt_name: str, context_data: Dict) -> Tuple[bool, List[str]]:
        """
        Validate context data before sending to Claude
        
        Returns:
            Tuple of (is_valid, list_of_warnings)
        """
        warnings = []
        
        # Check for common fabricated data patterns
        if isinstance(context_data, dict):
            context_str = json.dumps(context_data).lower()
            
            # Check for suspicious patterns
            suspicious_patterns = [
                'link in bio',  # Common fabrication
                'swipe up',     # Not applicable to all platforms
                'example.com',  # Example URLs
                'lorem ipsum',  # Placeholder text
            ]
            
            for pattern in suspicious_patterns:
                if pattern in context_str:
                    warnings.append(f"Suspicious pattern detected: '{pattern}'")
        
        # Validate required fields for specific prompts
        if prompt_name == 'hook_analysis':
            if 'first_5_seconds' not in context_data and 'timeline_samples' not in context_data:
                warnings.append("Missing timeline data for hook analysis")
                
        elif prompt_name == 'engagement_triggers':
            if 'timeline_samples' not in context_data:
                warnings.append("Missing timeline samples for engagement analysis")
        
        # Check for validation metadata
        if '_validation' not in context_data:
            warnings.append("Context data not validated by MLDataValidator")
        
        return len(warnings) == 0, warnings
    
    def log_validation_event(self, event_type: str, details: Dict):
        """Log validation events for audit trail"""
        event = {
            'timestamp': datetime.now().isoformat(),
            'event_type': event_type,
            'details': details
        }
        self.validation_log.append(event)
        logger.info(f"Validation event: {event_type} - {details}")
    
    def get_validation_report(self) -> Dict:
        """Get summary of all validation events"""
        return {
            'total_events': len(self.validation_log),
            'events': self.validation_log[-100:]  # Last 100 events
        }


# Helper function for easy integration
def create_safe_context(unified_data: Dict, prompt_name: str, 
                       strict: bool = False) -> Dict:
    """
    Convenience function to create validated context data
    
    Args:
        unified_data: The unified analysis data
        prompt_name: Name of the prompt
        strict: Whether to use strict validation mode
        
    Returns:
        Validated context data safe for Claude
    """
    validator = MLDataValidator(strict_mode=strict)
    
    try:
        context = validator.extract_safe_context_data(unified_data, prompt_name)
        
        # Validate the extracted context
        is_valid, warnings = validator.validate_prompt_context(prompt_name, context)
        
        if warnings:
            logger.warning(f"Context validation warnings: {warnings}")
            
        validator.log_validation_event('context_created', {
            'prompt_name': prompt_name,
            'video_id': unified_data.get('video_id', 'unknown'),
            'warnings': warnings
        })
        
        return context
        
    except Exception as e:
        logger.error(f"Failed to create safe context: {str(e)}")
        
        if strict:
            raise
        else:
            # Return minimal safe context
            return {
                'error': 'Failed to extract ML data',
                'video_id': unified_data.get('video_id', 'unknown'),
                '_validation': {
                    'validated_at': datetime.now().isoformat(),
                    'error': str(e)
                }
            }


if __name__ == "__main__":
    # Example usage
    print("ML Data Validator - Test Run")
    print("=" * 50)
    
    # Test with sample data
    sample_unified = {
        'video_id': 'test_video_123',
        'duration_seconds': 15,
        'static_metadata': {
            'captionText': 'Check this out!',
            'stats': {'views': 1000, 'likes': 50}
        },
        'timelines': {
            'objectTimeline': {
                '0-1s': {'objects': {'person': 1}, 'total_objects': 1},
                '1-2s': {'objects': {}, 'total_objects': 0}
            },
            'textOverlayTimeline': {
                '0-1s': {'texts': [{'text': 'Welcome!', 'confidence': 0.95}]}
            },
            'speechTimeline': {},
            'gestureTimeline': {},
            'expressionTimeline': {},
            'stickerTimeline': {}
        }
    }
    
    validator = MLDataValidator()
    
    # Test validation
    is_valid, issues = validator.validate_unified_analysis(sample_unified)
    print(f"\nValidation result: {'PASS' if is_valid else 'FAIL'}")
    if issues:
        print(f"Issues: {issues}")
    
    # Test context extraction
    context = validator.extract_safe_context_data(sample_unified, 'hook_analysis')
    print(f"\nExtracted context for hook_analysis:")
    print(json.dumps(context, indent=2))