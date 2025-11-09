#!/bin/bash

echo "=================================="
echo "Micro Frontend Setup Script"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    echo "Please install Node.js 18 or higher from https://nodejs.org/"
    exit 1
fi

echo -e "${GREEN}✓ Node.js version: $(node --version)${NC}"
echo ""

# Function to install dependencies
install_deps() {
    local dir=$1
    local name=$2

    echo -e "${BLUE}Installing dependencies for $name...${NC}"
    cd "$dir" || exit 1

    if [ -f "package-lock.json" ]; then
        rm package-lock.json
    fi

    if [ -d "node_modules" ]; then
        rm -rf node_modules
    fi

    npm install

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ $name dependencies installed${NC}"
    else
        echo -e "${RED}✗ Failed to install $name dependencies${NC}"
        exit 1
    fi

    cd ..
    echo ""
}

# Install React Remote dependencies
install_deps "react-remote" "React Remote"

# Install Angular Host dependencies
install_deps "angular-host" "Angular Host"

echo "=================================="
echo -e "${GREEN}Setup Complete!${NC}"
echo "=================================="
echo ""
echo "To start the applications:"
echo ""
echo -e "${BLUE}Terminal 1 - React Remote:${NC}"
echo "  cd react-remote"
echo "  npm start"
echo ""
echo -e "${BLUE}Terminal 2 - Angular Host:${NC}"
echo "  cd angular-host"
echo "  npm start"
echo ""
echo "Then open: http://localhost:4200"
echo ""
echo "=================================="
echo ""

# Ask if user wants to start the apps now
read -p "Would you like to start both applications now? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "${BLUE}Starting React Remote on port 5001...${NC}"
    cd react-remote
    npm start &
    REACT_PID=$!

    echo -e "${BLUE}Waiting for React Remote to start...${NC}"
    sleep 10

    echo -e "${BLUE}Starting Angular Host on port 4200...${NC}"
    cd ../angular-host
    npm start &
    ANGULAR_PID=$!

    echo ""
    echo "=================================="
    echo -e "${GREEN}Both applications are starting!${NC}"
    echo "=================================="
    echo ""
    echo "React Remote: http://localhost:5001"
    echo "Angular Host: http://localhost:4200"
    echo ""
    echo "Press Ctrl+C to stop both applications"
    echo ""

    # Wait for user to press Ctrl+C
    trap "kill $REACT_PID $ANGULAR_PID; exit" INT
    wait
fi
