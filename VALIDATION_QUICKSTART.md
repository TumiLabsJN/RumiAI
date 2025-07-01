# ML Data Validation - Quick Start Guide

## 🚀 Quick Start

### 1. Run Video Analysis with Validation

```bash
# Process a video with full validation
python3 run_video_prompts_validated.py <video_id>

# Example
python3 run_video_prompts_validated.py cristiano_7515739984452701457
```

### 2. Test Data Integrity

```bash
# Test all unified analysis files
python3 test_ml_data_integrity.py

# Test specific file
python3 test_ml_data_integrity.py unified_analysis/cristiano_7515739984452701457.json
```

### 3. Validate Without API Calls

```bash
# Validate data only (no Claude API calls)
python3 run_video_prompts_validated.py <video_id> --validate-only
```

## 🔍 What It Does

The validation system ensures:
- ✅ Only real ML detection data is sent to Claude
- ✅ No fabricated data like "link in bio" when not detected
- ✅ Timeline data exists before being referenced
- ✅ Graceful handling of missing data
- ✅ Detailed logging and audit trails

## 📁 Key Files

- `run_video_prompts_validated.py` - Main validated prompt runner
- `services/ml_data_validator.py` - Core validation logic
- `test_ml_data_integrity.py` - Data integrity test suite
- `docs/ML_DATA_VALIDATION.md` - Full documentation

## 🎯 Example: Before vs After

### Before (Potential Issues)
```python
# Could include non-existent data
context_data = {
    'timeline': unified_data.get('timelines', {}),
    'stats': {'link_in_bio': True}  # Fabricated!
}
```

### After (Validated)
```python
# Only includes verified ML detections
context_data = create_safe_context(unified_data, prompt_name)
# Automatically filters and validates all data
```

## ⚠️ Common Warnings

1. **"Suspicious pattern detected: 'link in bio'"**
   - The ML model detected this text (verify in source video)

2. **"Missing timeline data for hook analysis"**
   - Expected timeline is empty (normal for some videos)

3. **"Timeline entry beyond video duration"**
   - Data consistency issue (check ML processing)

## 🛠️ Troubleshooting

Run the validation demo to understand the system:
```bash
python3 examples/validation_demo.py
```

Check validation reports:
```bash
ls validation_reports/
ls test_reports/
```

## 📊 Reports

- **Validation Reports**: `validation_reports/<video_id>_validation_<timestamp>.json`
- **Test Reports**: `test_reports/ml_integrity_report_<timestamp>.json`

## 🔄 Migration

To update existing scripts:
```bash
python3 migrate_to_validated_prompts.py
```

This will:
- Create backups of original files
- Add validation imports and logic
- Update context building code

## 💡 Best Practices

1. Always validate before production runs
2. Review warnings even in non-strict mode
3. Run integrity tests after ML pipeline updates
4. Use `--validate-only` for testing
5. Check reports for patterns of issues