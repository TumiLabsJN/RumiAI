#!/bin/bash
# Simple script to view RumiAI frontend

echo "🚀 RumiAI Frontend Viewer"
echo "========================"
echo ""
echo "Choose how to view the frontend:"
echo ""
echo "1. Open file directly in browser (recommended)"
echo "2. Start local web server"
echo ""

# Get the full path
FRONTEND_PATH="$(pwd)/frontend/index_simple.html"

echo "📂 Frontend location:"
echo "   $FRONTEND_PATH"
echo ""
echo "To view, copy and paste this URL in your browser:"
echo "   file://$FRONTEND_PATH"
echo ""
echo "Or run this command:"
echo "   xdg-open file://$FRONTEND_PATH  # Linux"
echo "   open file://$FRONTEND_PATH      # Mac"
echo "   start file://$FRONTEND_PATH     # Windows"
echo ""
echo "Available pages:"
ls -la frontend/*.html | awk '{print "   - " $9}'