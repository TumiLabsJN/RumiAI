# ML Data Validation System

## Overview

The ML Data Validation System ensures that only real ML detection data from unified analysis JSON files is used when generating prompts for Claude. This prevents any fabricated or hardcoded data from being included in the analysis pipeline.

## Components

### 1. MLDataValidator (`services/ml_data_validator.py`)

The core validation class that:
- Validates unified analysis JSON structure
- Extracts only existing ML detection data
- Filters and samples timeline data appropriately
- Detects suspicious patterns that indicate fabricated data
- Provides detailed validation logging

Key features:
- **Strict Mode**: Raises exceptions on validation failures
- **Warning Mode**: Logs warnings but continues processing
- **Context Extraction**: Creates safe, validated context for each prompt type
- **Pattern Detection**: Identifies common fabrication patterns like "link in bio"

### 2. Validated Prompt Runner (`run_video_prompts_validated.py`)

Enhanced version of the prompt runner that:
- Validates all data before sending to Claude
- Provides detailed logging of what data is included
- Creates validation reports for audit trails
- Supports validation-only mode for testing

Usage:
```bash
# Run with validation
python3 run_video_prompts_validated.py <video_id>

# Run with custom delay
python3 run_video_prompts_validated.py <video_id> 15

# Validate only (no API calls)
python3 run_video_prompts_validated.py <video_id> --validate-only
```

### 3. Data Integrity Tester (`test_ml_data_integrity.py`)

Comprehensive test suite that checks:
- JSON structure validity
- Timeline data format
- Suspicious data patterns
- Data consistency (duration, frame counts)
- Context extraction for all prompt types

Usage:
```bash
# Test all unified analysis files
python3 test_ml_data_integrity.py

# Test specific file
python3 test_ml_data_integrity.py unified_analysis/video_id.json
```

## Validation Process

### 1. Structure Validation
- Verifies required fields exist (video_id, timelines, static_metadata, duration_seconds)
- Checks timeline structure and format
- Validates timestamp formats (e.g., "0-1s", "10-11s")

### 2. Data Extraction
Based on prompt type, extracts appropriate data:
- **hook_analysis**: Only first 5 seconds of timeline data
- **engagement_triggers**, **creative_density**: Sampled timeline data
- **Others**: Summary statistics only

### 3. Pattern Detection
Checks for suspicious patterns that indicate fabricated data:
- "link in bio" (common fabrication)
- "swipe up" (platform-specific, not universal)
- "example.com" (placeholder URLs)
- "lorem ipsum" (placeholder text)
- Other test/placeholder patterns

### 4. Consistency Checks
- Timeline entries don't exceed video duration
- Frame count matches duration × fps
- Metadata summary aligns with timeline content

## Integration Guide

### Using the Validator in Custom Scripts

```python
from services.ml_data_validator import MLDataValidator, create_safe_context

# Load unified analysis
with open('unified_analysis/video_id.json', 'r') as f:
    unified_data = json.load(f)

# Method 1: Using convenience function
context = create_safe_context(unified_data, 'hook_analysis', strict=False)

# Method 2: Using validator directly
validator = MLDataValidator(strict_mode=False)
context = validator.extract_safe_context_data(unified_data, 'hook_analysis')

# Validate the context
is_valid, warnings = validator.validate_prompt_context('hook_analysis', context)
```

### Modifying Existing Scripts

To add validation to existing prompt runners:

1. Import the validator:
```python
from services.ml_data_validator import create_safe_context
```

2. Replace context building with validated extraction:
```python
# Instead of manually building context:
# context_data = {
#     'timeline': unified_data.get('timelines', {})
# }

# Use validated extraction:
context_data = create_safe_context(unified_data, prompt_name)
```

## Validation Reports

The system generates two types of reports:

### 1. Validation Reports (from validated prompt runner)
Location: `validation_reports/<video_id>_validation_<timestamp>.json`

Contains:
- Validation status for each prompt
- Warnings encountered
- Context keys included

### 2. Test Reports (from integrity tester)
Location: `test_reports/ml_integrity_report_<timestamp>.json`

Contains:
- Overall pass/fail statistics
- Detailed test results for each file
- Specific issues found

## Best Practices

1. **Always validate before production runs**: Use `--validate-only` flag to test
2. **Review validation warnings**: Even in non-strict mode, warnings indicate potential issues
3. **Run integrity tests regularly**: Especially after ML pipeline updates
4. **Monitor for new patterns**: Update suspicious pattern list as needed
5. **Use appropriate prompt contexts**: Don't request data that doesn't exist

## Troubleshooting

### Common Issues

1. **"Missing timeline data for hook analysis"**
   - Ensure video has been processed through ML pipeline
   - Check that timelines are populated in unified analysis

2. **"Suspicious pattern detected: 'link in bio'"**
   - ML model may have incorrectly detected this text
   - Review the source frame to verify

3. **"Timeline entry beyond video duration"**
   - ML processing may have incorrect duration
   - Check fps and frame count calculations

### Debugging

Enable detailed logging:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

## Future Enhancements

1. **Schema validation**: Add JSON schema for unified analysis format
2. **ML confidence thresholds**: Filter low-confidence detections
3. **Cross-reference validation**: Verify detections across multiple ML models
4. **Automated remediation**: Suggest fixes for common issues
5. **Performance optimization**: Cache validation results for repeated runs