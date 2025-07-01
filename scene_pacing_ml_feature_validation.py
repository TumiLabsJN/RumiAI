#!/usr/bin/env python3
"""
Validate that our compute_scene_pacing_metrics() function provides
all required ML features for scene pacing analysis.
"""

from run_video_prompts_validated_v2 import compute_scene_pacing_metrics

# Define the ML feature requirements
ml_features = {
    "Core Pacing Stats": {
        "total_shots": {
            "description": "Total number of detected shots/scenes",
            "why_matters": "Indicates overall cut frequency and edit intensity",
            "type": "int"
        },
        "avg_shot_duration": {
            "description": "Average length of each shot in seconds",
            "why_matters": "Core pacing measure — key driver of viewer tempo perception",
            "type": "float"
        },
        "shots_per_minute": {
            "description": "Rate of scene changes scaled to a 60s pace",
            "why_matters": "Normalized pacing metric to compare across videos of different lengths",
            "type": "float"
        }
    },
    "Shot Duration Analysis": {
        "shortest_shot": {
            "description": "Duration of the shortest cut",
            "why_matters": "Captures burstiness or jarring micro-cuts",
            "type": "float"
        },
        "longest_shot": {
            "description": "Duration of the longest uncut sequence",
            "why_matters": "Detects breath or narrative pause moments",
            "type": "float"
        },
        "shot_duration_variance": {
            "description": "Variability of shot lengths",
            "why_matters": "Measures editing rhythm consistency",
            "type": "float"
        }
    },
    "Pacing Classification": {
        "pacing_classification": {
            "description": "Overall pace bucket: rapid, fast, moderate, slow",
            "why_matters": "Quick reference for filtering/testing pacing styles",
            "type": "str"
        },
        "rhythm_consistency": {
            "description": "How even or choppy the edit rhythm is",
            "why_matters": "Indicates whether viewer tempo is predictable or surprising",
            "type": "str"
        }
    },
    "Temporal Dynamics": {
        "pacing_curve": {
            "description": "Shot count per 10-second window",
            "why_matters": "Reveals pacing shifts across timeline",
            "type": "Dict[str, int]"
        },
        "acceleration_score": {
            "description": "Difference in cut rate between first and second half",
            "why_matters": "Detects if pacing ramps up or slows down",
            "type": "float (-1 to 1)"
        },
        "cut_density_zones": {
            "description": "Time segments with peak cutting intensity",
            "why_matters": "Highlights pacing 'hot spots' for attention or rhythm anchoring",
            "type": "List[str]"
        }
    },
    "Intro/Outro Analysis": {
        "intro_pacing": {
            "description": "Number of cuts in the first 10 seconds",
            "why_matters": "Strong early cuts signal aggressive hook strategy",
            "type": "int"
        },
        "outro_pacing": {
            "description": "Number of cuts in the last 10 seconds",
            "why_matters": "Helps identify rewatch optimization or loop-tuning pacing",
            "type": "int"
        }
    },
    "Visual Complexity": {
        "visual_load_per_scene": {
            "description": "Average number of objects visible per shot",
            "why_matters": "Correlates pacing with density — high visual load + fast cuts = high cognitive demand",
            "type": "float"
        },
        "shot_type_changes": {
            "description": "Count of framing/camera distance switches across shots",
            "why_matters": "Measures visual variation and dynamism beyond just cuts",
            "type": "int"
        }
    },
    "ML Pattern Tags": {
        "pacing_tags": {
            "description": "Labeled pacing traits like 'quick_cuts' or 'accelerating_pace'",
            "why_matters": "Useful for clustering, creative testing strategies, or downstream ML models",
            "type": "List[str]"
        }
    }
}

# Test data
test_scene_timeline = {
    "0-1s": {"type": "scene_change", "confidence": 0.9},
    "2-3s": {"type": "scene_change", "confidence": 0.85},
    "3-4s": {"type": "scene_change", "confidence": 0.88},
    "5-6s": {"type": "scene_change", "confidence": 0.92},
    "7-8s": {"type": "scene_change", "confidence": 0.87},
    "9-10s": {"type": "scene_change", "confidence": 0.91},
    "10-11s": {"type": "scene_change", "confidence": 0.89},
    "12-13s": {"type": "scene_change", "confidence": 0.86}
}

test_object_timeline = {
    "0-1s": {"objects": {"person": 1, "bowl": 1, "spoon": 1}},
    "2-3s": {"objects": {"person": 1, "spoon": 1}},
    "5-6s": {"objects": {"bowl": 1, "food": 2, "utensil": 1}},
    "10-11s": {"objects": {"person": 1, "bowl": 1}}
}

test_camera_distance_timeline = {
    "0-1s": {"distance": "medium"},
    "2-3s": {"distance": "close"},
    "5-6s": {"distance": "medium"},
    "9-10s": {"distance": "far"},
    "12-13s": {"distance": "close"}
}

# Run the function
metrics = compute_scene_pacing_metrics(
    scene_timeline=test_scene_timeline,
    video_duration=15,
    object_timeline=test_object_timeline,
    camera_distance_timeline=test_camera_distance_timeline
)

# Validate all ML features
print("🎬 Scene Pacing ML Feature Validation")
print("=" * 80)

all_features_present = True
feature_mapping = {}

for category, features in ml_features.items():
    print(f"\n📊 {category}")
    print("-" * 60)
    
    for feature_name, feature_info in features.items():
        if feature_name in metrics:
            value = metrics[feature_name]
            status = "✅"
            
            # Type validation
            if feature_info["type"] == "int" and not isinstance(value, int):
                status = "⚠️ (type mismatch)"
            elif feature_info["type"] == "float" and not isinstance(value, (int, float)):
                status = "⚠️ (type mismatch)"
            elif feature_info["type"] == "str" and not isinstance(value, str):
                status = "⚠️ (type mismatch)"
            elif "List" in feature_info["type"] and not isinstance(value, list):
                status = "⚠️ (type mismatch)"
            elif "Dict" in feature_info["type"] and not isinstance(value, dict):
                status = "⚠️ (type mismatch)"
                
            print(f"{status} {feature_name}: {value}")
            print(f"   └─ {feature_info['description']}")
            feature_mapping[feature_name] = True
        else:
            print(f"❌ {feature_name}: MISSING")
            print(f"   └─ {feature_info['description']}")
            all_features_present = False
            feature_mapping[feature_name] = False

# Summary
print("\n" + "=" * 80)
print("📈 SUMMARY")
print("-" * 60)

total_features = sum(len(features) for features in ml_features.values())
present_features = sum(1 for present in feature_mapping.values() if present)

print(f"Total ML Features Required: {total_features}")
print(f"Features Present: {present_features}")
print(f"Features Missing: {total_features - present_features}")
print(f"Coverage: {present_features/total_features*100:.1f}%")

if all_features_present:
    print("\n✅ SUCCESS: All ML features are available!")
else:
    print("\n❌ ERROR: Some ML features are missing!")

# Show feature usage example
print("\n" + "=" * 80)
print("💡 FEATURE USAGE EXAMPLE")
print("-" * 60)
print(f"""
Example ML Pipeline Usage:

# Extract features for ML model
pacing_features = {{
    'pacing_score': metrics['shots_per_minute'] * metrics['avg_shot_duration'],
    'complexity_score': metrics['visual_load_per_scene'] * metrics['shot_type_changes'],
    'rhythm_score': 1 if metrics['rhythm_consistency'] == 'consistent' else 0,
    'acceleration': metrics['acceleration_score'],
    'has_montage': 1 if 'has_montage_sections' in metrics['pacing_tags'] else 0,
    'is_mtv_style': 1 if 'mtv_style' in metrics['pacing_tags'] else 0
}}

# Classification based on pacing
if metrics['pacing_classification'] == 'rapid' and metrics['visual_load_per_scene'] > 3:
    risk_level = 'high_cognitive_load'
elif metrics['acceleration_score'] > 0.5:
    engagement_pattern = 'building_momentum'
""")