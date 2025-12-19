#!/bin/bash

# Database Reset and Data Import Script
# This script clears the database and triggers a full data import

set -e  # Exit on error

echo "[INFO] Database reset and data import script"
echo ""

# Navigate to backend directory
cd "$(dirname "$0")"

# Step 1: Stop server if running
echo "[STEP 1] Checking if server is running..."
if pgrep -f "go run cmd/server/main.go" > /dev/null; then
    echo "[WARN] Server is currently running. Please stop it first."
    echo "Press Ctrl+C to cancel, or Enter to continue anyway..."
    read
fi

# Step 2: Backup existing database
if [ -f "alerts_v2.db" ]; then
    BACKUP_FILE="alerts_v2.db.backup.$(date +%Y%m%d_%H%M%S)"
    echo "[STEP 2] Backing up existing database to $BACKUP_FILE"
    cp alerts_v2.db "$BACKUP_FILE"
    echo "[SUCCESS] Backup created"
else
    echo "[STEP 2] No existing database found, skipping backup"
fi

# Step 3: Remove old database
echo "[STEP 3] Removing old database..."
rm -f alerts_v2.db
echo "[SUCCESS] Old database removed"

# Step 4: Check environment variables
echo "[STEP 4] Checking environment variables..."
if [ -f ".env" ]; then
    echo "[INFO] Found .env file, loading..."
    export $(cat .env | grep -v '^#' | xargs)
fi

if [ -z "$JIRA_SERVER" ] || [ -z "$JIRA_USER" ] || [ -z "$JIRA_TOKEN" ]; then
    echo "[ERROR] Missing JIRA credentials!"
    echo "Please set the following environment variables:"
    echo "  JIRA_SERVER  (e.g., https://tidb.atlassian.net)"
    echo "  JIRA_USER    (your JIRA email)"
    echo "  JIRA_TOKEN   (your JIRA API token)"
    echo ""
    echo "You can create a .env file with these variables."
    exit 1
fi

echo "[SUCCESS] JIRA credentials found"
echo "  Server: $JIRA_SERVER"
echo "  User: $JIRA_USER"
echo ""

# Step 5: Start server in background
echo "[STEP 5] Starting server..."
go run cmd/server/main.go > server.log 2>&1 &
SERVER_PID=$!
echo "[INFO] Server started with PID: $SERVER_PID"

# Wait for server to be ready
echo "[INFO] Waiting for server to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:8080/api/update/status > /dev/null 2>&1; then
        echo "[SUCCESS] Server is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "[ERROR] Server failed to start within 30 seconds"
        kill $SERVER_PID 2>/dev/null || true
        tail -50 server.log
        exit 1
    fi
    sleep 1
done

# Step 6: Trigger full data import
echo "[STEP 6] Triggering full data import (last 30 days)..."
RESPONSE=$(curl -s -X POST http://localhost:8080/api/update \
    -H "Content-Type: application/json" \
    -d '{"type": "full"}')

echo "[INFO] Import triggered: $RESPONSE"
echo ""

# Step 7: Monitor progress
echo "[STEP 7] Monitoring import progress..."
echo "[INFO] You can check detailed logs with: tail -f server.log"
echo "[INFO] Or check status with: curl http://localhost:8080/api/update/status"
echo ""

# Wait a bit and show status
sleep 3
STATUS=$(curl -s http://localhost:8080/api/update/status)
echo "[STATUS] Current status:"
echo "$STATUS" | python3 -m json.tool 2>/dev/null || echo "$STATUS"
echo ""

echo "[INFO] Server is running in background (PID: $SERVER_PID)"
echo "[INFO] Logs are being written to server.log"
echo "[INFO] To stop server: kill $SERVER_PID"
echo ""
echo "[TIP] Monitor logs with: tail -f server.log"
echo "[TIP] Check status with: curl http://localhost:8080/api/update/status"
echo ""
echo "[DONE] Script completed! Data import is running in background."
