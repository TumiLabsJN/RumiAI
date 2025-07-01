# ML Data Validation Guide

## Overview

The RumiAI system now includes comprehensive validation to ensure that **ONLY real ML detection data** is sent to Claude for analysis. This prevents any fabricated or hardcoded data from entering the analysis pipeline.

## Key Components

### 1. Validated Prompt Runner (`run_video_prompts_validated.py`)

This is the main entry point for running Claude prompts with validation:

```bash
python3 run_video_prompts_validated.py <video_id>
```

**Features:**
- Extracts only real ML detections from unified analysis files
- Validates data before sending to Claude
- Checks for suspicious patterns (e.g., "link in bio" when no such text exists)
- Provides detailed logging of what data is included

### 2. Data Extraction Rules

#### Hook Analysis
- Only includes data from first 5 seconds
- Extracts: object detections, text detections, pose data
- Filters out empty or null detections

#### CTA Alignment
- Extracts actual text detections with confidence scores
- Includes speech timeline if available
- NO hardcoded CTAs like "link in bio" unless actually detected

#### Other Analyses
- Includes timeline summary statistics
- Counts of actual detections per category
- No fabricated timeline data

### 3. Validation Checks

The system checks for:
- Suspicious patterns that don't exist in ML data:
  - "link in bio"
  - "swipe up"
  - "tap here"
  - "click link"
- Empty or null detections
- Data consistency with video duration

## Example: CTA Alignment

**Before (Fabricated):**
```json
{
  "text_timeline": {
    "8.00": {"text": "link in bio"}  // FABRICATED - not in ML data
  }
}
```

**After (Real):**
```json
{
  "text_timeline": {},  // Empty because no text was detected
  "speech_timeline": {},
  "_validation": {
    "extracted_at": "2025-06-24T15:30:00",
    "prompt_type": "cta_alignment",
    "data_source": "unified_analysis"
  }
}
```

## Testing Validation

### 1. Test Specific Prompt Data
```bash
python3 test_cta_real_data.py
```

### 2. Validate Without Running Prompts
```bash
python3 run_video_prompts_validated.py <video_id> --validate-only
```

## Migration Guide

To update existing scripts:

1. Replace `run_video_prompts_safe.py` with `run_video_prompts_validated.py`
2. Update any custom prompt runners to use `extract_real_ml_data()` function
3. Review prompt templates to ensure they handle missing data gracefully

## Best Practices

1. **Always validate ML data** before sending to Claude
2. **Log what data is included** for transparency
3. **Handle missing data gracefully** - don't fabricate
4. **Check for suspicious patterns** that indicate fabricated data
5. **Use the validation tools** to test before deploying

## Troubleshooting

### No Text Detections Found
This is often correct - many videos have no overlay text. The system should report this accurately rather than making up data.

### Validation Warnings
These indicate potential issues with the data. Review warnings carefully but they don't always indicate errors.

### Rate Limiting
The validated runner includes intelligent rate limiting for Claude API calls.

## Summary

The validation system ensures:
- ✅ Only real ML detections are analyzed
- ✅ No fabricated data like "link in bio" when it doesn't exist
- ✅ Transparent logging of what data is sent
- ✅ Graceful handling of missing data
- ✅ Protection against hallucinated analysis results