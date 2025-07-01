#!/usr/bin/env python3
"""
Simple HTTP server to serve the frontend
"""

import http.server
import socketserver
import os
import webbrowser
from threading import Timer

PORT = 8080

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory="frontend", **kwargs)

def open_browser():
    webbrowser.open(f'http://localhost:{PORT}/index_simple.html')

def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
        print(f"🚀 Serving RumiAI frontend at http://localhost:{PORT}")
        print(f"📂 View analysis at: http://localhost:{PORT}/index_simple.html")
        print(f"Press Ctrl+C to stop the server")
        
        # Open browser after 1 second
        Timer(1, open_browser).start()
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n👋 Server stopped")

if __name__ == "__main__":
    main()