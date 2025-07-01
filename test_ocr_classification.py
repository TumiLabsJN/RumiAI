#!/usr/bin/env python3
"""Test OCR text classification prompt"""

import json
import sys
from run_video_prompts_validated_v2 import extract_real_ml_data
from run_claude_insight import ClaudeInsightRunner

video_id = sys.argv[1] if len(sys.argv) > 1 else "7372639293631679790"

# Load unified analysis
with open(f'unified_analysis/{video_id}.json', 'r') as f:
    unified_data = json.load(f)

# Extract data for OCR classification
context_data = extract_real_ml_data(unified_data, 'ocr_text_classification')

# Load prompt template
with open('prompt_templates/ocr_text_classification.txt', 'r') as f:
    prompt_template = f.read()

# Initialize runner and run the prompt
runner = ClaudeInsightRunner()
result = runner.run_claude_prompt(
    video_id=video_id,
    prompt_name='ocr_text_classification',
    prompt_text=prompt_template,
    context_data=context_data
)

if result['success']:
    print("✅ OCR classification completed!")
    print("\nResponse:")
    print(result['response'])
else:
    print(f"❌ Failed: {result.get('error', 'Unknown error')}")