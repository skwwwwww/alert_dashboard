#!/bin/bash

# Backend Development Quick Start Script

set -e

echo "🚀 Backend Development Environment Setup"
echo "=========================================="

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your JIRA credentials before running the server"
    echo "   JIRA_USER and JIRA_TOKEN are required for data sync features"
    read -p "Press Enter to continue or Ctrl+C to exit and edit .env first..."
fi

# Check if Air is installed
if ! command -v air &> /dev/null; then
    echo "📦 Installing Air for hot reload..."
    go install github.com/air-verse/air@latest
    echo "✅ Air installed successfully"
else
    echo "✅ Air already installed"
fi

# Clean tmp directory if exists
if [ -d tmp ]; then
    echo "🧹 Cleaning tmp directory..."
    rm -rf tmp
fi

# Install dependencies
echo "📥 Installing Go dependencies..."
go mod download
go mod tidy

echo ""
echo "✅ Setup complete!"
echo ""
echo "🔥 Starting development server with hot reload..."
echo "   Server will run on http://localhost:8080"
echo "   Code changes will auto-reload"
echo "   Press Ctrl+C to stop"
echo ""

# Start Air
air
