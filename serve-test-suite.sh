#!/bin/bash

# Simple HTTP server for the destructive test suite
# This avoids CORS issues with file:// protocol

# Find a free port starting from 8080
PORT=8080
while lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; do
  PORT=$((PORT + 1))
done

echo "🧪 Starting Destructive Test Suite Server..."
echo "   URL: http://localhost:$PORT/destructive-test-suite.html"
echo ""
echo "   Make sure MFE servers are running:"
echo "   - React Pink:   http://localhost:5001"
echo "   - React Orange: http://localhost:5002"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Check if Python is available
if command -v python3 &> /dev/null; then
    python3 -m http.server $PORT
elif command -v python &> /dev/null; then
    python -m SimpleHTTPServer $PORT
elif command -v npx &> /dev/null; then
    npx http-server -p $PORT
else
    echo "Error: No suitable HTTP server found"
    echo "Please install Python or Node.js"
    exit 1
fi
