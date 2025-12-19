#!/bin/bash

# Start Development Environment

echo "🚀 Starting Alerts Platform V2 Development Environment"
echo "===================================================="

# Check for custom IP
HOST_IP=${1:-""}
export PORT=8818

if [ -n "$HOST_IP" ]; then
    echo "🌐 using custom IP: $HOST_IP"
    export HOST="$HOST_IP"
    FRONTEND_HOST_ARG="--host $HOST_IP"
else
    # Default behavior (bind all)
    FRONTEND_HOST_ARG="--host"
fi

# Check backend environment file
if [ ! -f "backend/.env" ]; then
    echo "⚠️  backend/.env not found!"
    if [ -f "backend/.env.example" ]; then
        echo "📝 Creating backend/.env from .env.example..."
        cp backend/.env.example backend/.env
        echo "⚠️  Please check backend/.env and update your credentials."
    else
        echo "❌ backend/.env.example also not found. Please configure backend environment manually."
        exit 1
    fi
fi

# Function to kill all background processes on script exit
cleanup() {
    echo ""
    echo "🛑 Shutting down services..."
    kill $(jobs -p) 2>/dev/null
    exit
}

trap cleanup SIGINT SIGTERM

# Start Backend
echo "🐘 Starting Backend..."
cd backend
./dev.sh &
BACKEND_PID=$!
cd ..

# Start Frontend
echo "⚛️  Starting Frontend..."
cd frontend
VITE_API_URL="http://${HOST_IP:-localhost}:$PORT/api" npm run dev -- $FRONTEND_HOST_ARG &
FRONTEND_PID=$!
cd ..

echo ""
DISPLAY_HOST=${HOST_IP:-"localhost"}
echo "✅ Services started!"
echo "   - Frontend: http://$DISPLAY_HOST:5001"
echo "   - Backend:  http://$DISPLAY_HOST:$PORT"
echo ""
echo "Press Ctrl+C to stop all services."

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
