#!/bin/bash

# Build Release Script
# This script packages the compiled binaries and assets into a release folder

set -e

# Configuration
DIST_DIR="generated"
SERVER_BIN="alerts-platform-v2"

echo "📦 Packaging release..."

# Create directory structure
mkdir -p "${DIST_DIR}/public"

# Copy frontend assets
echo "   - Copying frontend assets..."
cp -r frontend/dist/* "${DIST_DIR}/public/"

# Copy example configuration
echo "   - Copying configuration..."
cp backend/.env.example "${DIST_DIR}/.env.example"

# Create start script
echo "   - Generating startup script..."
cat > "${DIST_DIR}/start.sh" << 'EOF'
#!/bin/bash
# One-click startup script

cd "$(dirname "$0")"

export PORT=5001

# Check for .env
if [ ! -f .env ]; then
  echo "📝 Creating .env from .env.example"
  cp .env.example .env
  echo "⚠️  Please update .env with your credentials if needed."
fi

echo "🚀 Starting Alerts Platform V2..."
echo "👉 Open http://localhost:$PORT in your browser"
./alerts-platform-v2
EOF

chmod +x "${DIST_DIR}/start.sh"

echo ""
echo "✅ Release created successfully in '${DIST_DIR}' directory!"
echo "   Run './${DIST_DIR}/start.sh' to start the application."
