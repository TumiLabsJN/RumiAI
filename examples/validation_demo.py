#!/usr/bin/env python3
"""
ML Data Validation Demo
Shows how the validation system prevents fabricated data
"""

import json
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.ml_data_validator import MLDataValidator, create_safe_context


def demo_fabricated_data_detection():
    """Demo: Detecting fabricated data patterns"""
    print("\n🔍 DEMO 1: Detecting Fabricated Data")
    print("=" * 60)
    
    # Create sample data with fabricated content
    fabricated_data = {
        'video_id': 'demo_video_123',
        'duration_seconds': 15,
        'static_metadata': {
            'captionText': 'Check out the link in bio!',  # Suspicious!
            'stats': {'views': 1000}
        },
        'timelines': {
            'textOverlayTimeline': {
                '0-1s': {
                    'texts': [
                        {'text': 'Swipe up for more!', 'confidence': 0.95},  # Suspicious!
                        {'text': 'Visit example.com', 'confidence': 0.90}    # Suspicious!
                    ]
                }
            },
            'objectTimeline': {},
            'speechTimeline': {},
            'gestureTimeline': {},
            'expressionTimeline': {},
            'stickerTimeline': {}
        }
    }
    
    validator = MLDataValidator(strict_mode=False)
    
    # Extract context
    context = validator.extract_safe_context_data(fabricated_data, 'hook_analysis')
    
    # Validate and check for warnings
    is_valid, warnings = validator.validate_prompt_context('hook_analysis', context)
    
    print("\nData contains:")
    print(f"  Caption: '{fabricated_data['static_metadata']['captionText']}'")
    print(f"  Text overlays: {[t['text'] for t in fabricated_data['timelines']['textOverlayTimeline']['0-1s']['texts']]}")
    
    print(f"\nValidation result: {'✅ Valid' if is_valid else '❌ Invalid'}")
    if warnings:
        print("⚠️  Warnings detected:")
        for warning in warnings:
            print(f"   - {warning}")
    else:
        print("✅ No warnings")


def demo_missing_data_handling():
    """Demo: Handling missing timeline data"""
    print("\n\n🔍 DEMO 2: Handling Missing Data")
    print("=" * 60)
    
    # Create data with missing timelines
    incomplete_data = {
        'video_id': 'demo_video_456',
        'duration_seconds': 10,
        'static_metadata': {
            'captionText': 'Real video content',
            'stats': {'views': 500}
        },
        'timelines': {
            'objectTimeline': {
                '0-1s': {'objects': {'person': 1}, 'total_objects': 1}
            },
            'textOverlayTimeline': {},  # Empty!
            'speechTimeline': {},        # Empty!
            # Missing other timelines!
        }
    }
    
    validator = MLDataValidator(strict_mode=False)
    
    # Try to validate
    is_valid, issues = validator.validate_unified_analysis(incomplete_data)
    
    print("Data structure validation:")
    print(f"  Result: {'✅ Valid' if is_valid else '❌ Invalid'}")
    if issues:
        print("  Issues found:")
        for issue in issues:
            print(f"   - {issue}")
    
    # Extract context anyway
    context = create_safe_context(incomplete_data, 'hook_analysis', strict=False)
    
    print("\nExtracted context:")
    print(f"  Keys: {list(context.keys())}")
    if 'first_5_seconds' in context:
        print(f"  Available timelines: {list(context['first_5_seconds'].keys())}")


def demo_data_consistency():
    """Demo: Data consistency validation"""
    print("\n\n🔍 DEMO 3: Data Consistency Checks")
    print("=" * 60)
    
    # Create data with consistency issues
    inconsistent_data = {
        'video_id': 'demo_video_789',
        'duration_seconds': 10,  # 10 second video
        'total_frames': 300,     # But 300 frames?
        'fps': 1,                # At 1 fps? Inconsistent!
        'static_metadata': {
            'captionText': 'Testing consistency',
            'stats': {'views': 100}
        },
        'timelines': {
            'objectTimeline': {
                '0-1s': {'objects': {}, 'total_objects': 0},
                '15-16s': {'objects': {'person': 1}, 'total_objects': 1}  # Beyond duration!
            },
            'textOverlayTimeline': {},
            'speechTimeline': {},
            'gestureTimeline': {},
            'expressionTimeline': {},
            'stickerTimeline': {}
        },
        'metadata_summary': {
            'objects': ['person', 'car'],  # Claims objects exist
            'speech': 'Hello world'         # Claims speech exists
        }
    }
    
    # Test with integrity tester
    from test_ml_data_integrity import MLDataIntegrityTester
    tester = MLDataIntegrityTester()
    
    print("Running consistency checks...")
    issues = tester._check_data_consistency(inconsistent_data)
    
    if issues:
        print("❌ Consistency issues found:")
        for issue in issues:
            print(f"   - {issue}")
    else:
        print("✅ No consistency issues")


def demo_safe_context_extraction():
    """Demo: Safe context extraction for different prompt types"""
    print("\n\n🔍 DEMO 4: Safe Context Extraction")
    print("=" * 60)
    
    # Create valid data
    valid_data = {
        'video_id': 'demo_video_valid',
        'duration_seconds': 20,
        'total_frames': 20,
        'fps': 1,
        'static_metadata': {
            'captionText': 'This is a real video with proper ML detections',
            'stats': {'views': 5000, 'likes': 250, 'comments': 30}
        },
        'timelines': {
            'objectTimeline': {
                '0-1s': {'objects': {'person': 1}, 'total_objects': 1},
                '1-2s': {'objects': {'person': 1, 'phone': 1}, 'total_objects': 2},
                '2-3s': {'objects': {'person': 1}, 'total_objects': 1},
                '5-6s': {'objects': {'cat': 1}, 'total_objects': 1},
                '10-11s': {'objects': {'person': 2}, 'total_objects': 2}
            },
            'textOverlayTimeline': {
                '0-1s': {'texts': [{'text': 'Welcome!', 'confidence': 0.98}]},
                '3-4s': {'texts': [{'text': 'Watch this', 'confidence': 0.95}]},
                '10-11s': {'texts': [{'text': 'Thanks for watching', 'confidence': 0.92}]}
            },
            'speechTimeline': {
                '1-2s': {'transcript': 'Hey everyone', 'confidence': 0.88},
                '5-6s': {'transcript': 'Look at this cute cat', 'confidence': 0.91}
            },
            'gestureTimeline': {},
            'expressionTimeline': {},
            'stickerTimeline': {}
        }
    }
    
    validator = MLDataValidator(strict_mode=False)
    
    # Test different prompt types
    prompt_types = ['hook_analysis', 'engagement_triggers', 'creative_density']
    
    for prompt_name in prompt_types:
        print(f"\n📝 Context for {prompt_name}:")
        context = validator.extract_safe_context_data(valid_data, prompt_name)
        
        # Show what's included
        print(f"  Top-level keys: {list(context.keys())}")
        
        if 'first_5_seconds' in context:
            print("  First 5 seconds data:")
            for timeline, data in context['first_5_seconds'].items():
                if data:
                    print(f"    - {timeline}: {len(data)} entries")
                    
        elif 'timeline_samples' in context:
            print("  Timeline samples:")
            for timeline, data in context['timeline_samples'].items():
                if data:
                    print(f"    - {timeline}: {len(data)} entries")
                    
        elif 'timeline_summary' in context:
            print("  Timeline summary:")
            for timeline, summary in context['timeline_summary'].items():
                if summary.get('has_data'):
                    print(f"    - {timeline}: {summary}")


def main():
    """Run all demos"""
    print("🚀 ML Data Validation System Demo")
    print("This demo shows how the validation system ensures data integrity")
    
    demos = [
        demo_fabricated_data_detection,
        demo_missing_data_handling,
        demo_data_consistency,
        demo_safe_context_extraction
    ]
    
    for demo in demos:
        demo()
    
    print("\n\n✅ Demo complete!")
    print("\n💡 Key takeaways:")
    print("  1. The system detects and warns about suspicious patterns")
    print("  2. Missing data is handled gracefully without fabrication")
    print("  3. Data consistency is verified across all fields")
    print("  4. Context extraction is tailored to each prompt's needs")
    print("  5. All data sent to Claude comes from actual ML detections")


if __name__ == "__main__":
    main()