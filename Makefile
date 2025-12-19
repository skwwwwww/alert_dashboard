.PHONY: all build-backend build-frontend package clean release

# Output directory
DIST_DIR := generated
SERVER_BIN := alerts-platform-v2

# Run default target
all: release

build-backend:
	@echo "🐘 Building Backend..."
	cd backend && go mod tidy && go build -o ../$(DIST_DIR)/$(SERVER_BIN) ./cmd/server

build-frontend:
	@echo "⚛️  Building Frontend..."
	cd frontend && npm install && VITE_API_URL=/api npm run build

# "package" is legacy/alias, "release" is the main target now
package: release

release: clean build-backend build-frontend
	@echo "🚀 Running release script..."
	@./scripts/build_release.sh

clean:
	@echo "🧹 Cleaning..."
	rm -rf $(DIST_DIR)
	rm -rf frontend/dist
