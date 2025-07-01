#!/bin/bash

# Script to view insight results summary

VIDEO_ID="${1:-cristiano_7515739984452701457}"

echo "📹 INSIGHT SUMMARY FOR: $VIDEO_ID"
echo "========================================="
echo ""

# Check if insights folder exists
if [ ! -d "insights/$VIDEO_ID" ]; then
    echo "❌ No insights found for video: $VIDEO_ID"
    exit 1
fi

# Count completed analyses
TOTAL=$(ls -d insights/$VIDEO_ID/*/ 2>/dev/null | grep -v reports | wc -l)
COMPLETED=$(find insights/$VIDEO_ID -name "*_result_*.txt" | cut -d'/' -f3 | sort -u | wc -l)

echo "📊 Analysis Progress: $COMPLETED/$TOTAL completed"
echo ""

# Show each analysis status
echo "📋 Individual Analyses:"
echo "----------------------"

# List all prompt folders
for folder in insights/$VIDEO_ID/*/; do
    if [ "$folder" != "insights/$VIDEO_ID/reports/" ]; then
        PROMPT_NAME=$(basename "$folder")
        RESULT_FILES=$(find "$folder" -name "*_result_*.txt" 2>/dev/null | wc -l)
        
        if [ $RESULT_FILES -gt 0 ]; then
            # Get latest result file size
            LATEST_FILE=$(ls -t "$folder"/*_result_*.txt 2>/dev/null | head -1)
            FILE_SIZE=$(wc -c < "$LATEST_FILE" 2>/dev/null || echo "0")
            printf "✅ %-30s (%d bytes)\n" "$PROMPT_NAME" "$FILE_SIZE"
        else
            printf "❌ %-30s (pending)\n" "$PROMPT_NAME"
        fi
    fi
done

echo ""

# Check for performance summary
if [ -f "insights/$VIDEO_ID/creative_performance_summary/creative_performance_summary_result_"*.txt ]; then
    echo "📈 Performance Summary:"
    echo "---------------------"
    SUMMARY_FILE=$(ls -t insights/$VIDEO_ID/creative_performance_summary/*_result_*.txt | head -1)
    
    # Extract key metrics using grep
    SCORE=$(grep -o '"overallScore": [0-9]*' "$SUMMARY_FILE" | head -1 | cut -d' ' -f2)
    echo "   Overall Score: $SCORE/100"
    
    # Extract key strengths count
    STRENGTHS=$(grep -c '"strength":' "$SUMMARY_FILE" 2>/dev/null || echo "0")
    echo "   Key Strengths: $STRENGTHS identified"
    
    # Extract weaknesses count
    WEAKNESSES=$(grep -c '"weakness":' "$SUMMARY_FILE" 2>/dev/null || echo "0")
    echo "   Critical Weaknesses: $WEAKNESSES identified"
    
    echo ""
fi

# Show report locations
if [ -d "insights/$VIDEO_ID/reports" ]; then
    echo "📄 Reports Available:"
    echo "-------------------"
    ls -1 insights/$VIDEO_ID/reports/*.md 2>/dev/null | while read report; do
        echo "   📝 $(basename "$report")"
    done
    ls -1 insights/$VIDEO_ID/reports/*.json 2>/dev/null | while read report; do
        echo "   📊 $(basename "$report")"
    done
fi

echo ""
echo "💡 To view full results, use:"
echo "   python3 view_insight_results.py $VIDEO_ID"
echo "   python3 view_insight_results.py $VIDEO_ID hook_analysis"