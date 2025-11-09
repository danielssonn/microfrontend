#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "=================================="
echo "Starting Micro Frontend Applications"
echo "=================================="
echo ""

# Check if dependencies are installed
if [ ! -d "react-remote/node_modules" ] || [ ! -d "angular-host/node_modules" ]; then
    echo -e "${RED}Dependencies not installed. Running setup first...${NC}"
    ./setup.sh
fi

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        return 0
    else
        return 1
    fi
}

# Kill existing processes on ports if any
if check_port 5001; then
    echo -e "${BLUE}Killing existing process on port 5001...${NC}"
    kill -9 $(lsof -ti:5001)
    sleep 2
fi

if check_port 4200; then
    echo -e "${BLUE}Killing existing process on port 4200...${NC}"
    kill -9 $(lsof -ti:4200)
    sleep 2
fi

echo -e "${BLUE}Starting React Remote on port 5001...${NC}"
cd react-remote
npm start &
REACT_PID=$!
cd ..

echo -e "${BLUE}Waiting for React Remote to initialize...${NC}"
sleep 8

echo -e "${BLUE}Starting Angular Host on port 4200...${NC}"
cd angular-host
npm start &
ANGULAR_PID=$!
cd ..

echo ""
echo "=================================="
echo -e "${GREEN}Applications are running!${NC}"
echo "=================================="
echo ""
echo -e "${GREEN}✓ React Remote:${NC} http://localhost:5001"
echo -e "${GREEN}✓ Angular Host:${NC} http://localhost:4200"
echo ""
echo -e "${BLUE}Open http://localhost:4200 in your browser${NC}"
echo ""
echo "Press Ctrl+C to stop both applications"
echo "=================================="
echo ""

# Handle Ctrl+C to stop both applications
cleanup() {
    echo ""
    echo -e "${BLUE}Stopping applications...${NC}"
    kill $REACT_PID 2>/dev/null
    kill $ANGULAR_PID 2>/dev/null

    # Force kill if still running
    sleep 2
    kill -9 $(lsof -ti:5001) 2>/dev/null
    kill -9 $(lsof -ti:4200) 2>/dev/null

    echo -e "${GREEN}Applications stopped${NC}"
    exit 0
}

trap cleanup INT TERM

# Wait for background processes
wait
