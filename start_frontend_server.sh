#!/bin/bash
# Start frontend server

echo "🚀 Starting RumiAI Frontend Server..."
echo "===================================="
echo ""
echo "Server will run on: http://localhost:8080"
echo ""
echo "📌 After starting, open your browser and go to:"
echo "   http://localhost:8080/index_simple.html"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

cd frontend
python3 -m http.server 8080