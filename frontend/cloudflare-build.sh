#!/bin/bash
# Cloudflare Pages build script
# This script builds the frontend application for Cloudflare Pages
# SDK WASM is bundled via NPM package (@offenedatenmodellierung/data-modelling-sdk)
# DuckDB-WASM is loaded from CDN due to Cloudflare's 25MB file limit

set -e

echo "🚀 Starting Cloudflare Pages build..."

# Set environment variables for Cloudflare Pages
export VITE_OFFLINE_MODE="true"
export VITE_BASE_PATH="/"
export CLOUDFLARE_PAGES="true"  # Signals scripts to use CDN for large WASM files

# Install dependencies first (includes SDK NPM package with bundled WASM)
echo "📦 Installing npm dependencies..."
npm ci

# =============================================================================
# Version Configuration
# =============================================================================
# SDK version is now managed via NPM package.json
# Check: npm list @offenedatenmodellierung/data-modelling-sdk

# DuckDB-WASM version (should match @duckdb/duckdb-wasm in package.json)
DUCKDB_WASM_VERSION="1.32.0"
DUCKDB_OUT_DIR="public/duckdb"

# Function to setup DuckDB-WASM
# For Cloudflare Pages, we use CDN instead of local files due to 25MB limit
# DuckDB WASM files are ~35MB which exceeds Cloudflare's limit
setup_duckdb_wasm() {
  echo "📥 Setting up DuckDB-WASM..."

  # For Cloudflare Pages, we DON'T copy WASM files - they're loaded from CDN
  # This is because Cloudflare Pages has a 25MB file size limit
  # and duckdb-eh.wasm is ~35MB

  # IMPORTANT: Remove any existing WASM files to avoid 25MB limit errors
  # These files may exist from local development or git
  if [ -d "$DUCKDB_OUT_DIR" ]; then
    echo "   Removing existing DuckDB WASM files (too large for Cloudflare)..."
    rm -f "$DUCKDB_OUT_DIR"/*.wasm
    rm -f "$DUCKDB_OUT_DIR"/*.js
    echo "   ✅ Removed large WASM files"
  fi

  # Create a placeholder README to document this
  mkdir -p "$DUCKDB_OUT_DIR"
  cat > "$DUCKDB_OUT_DIR/README.md" << 'EOF'
# DuckDB-WASM Files

For Cloudflare Pages deployments, DuckDB-WASM files are loaded from jsDelivr CDN
instead of being bundled locally. This is because Cloudflare Pages has a 25MB
file size limit and DuckDB WASM files exceed this limit (~35MB).

The application automatically detects the environment and loads from:
- **Web (Cloudflare Pages)**: https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.32.0/dist/
- **Electron**: Local files in /duckdb/

See `src/types/duckdb.ts` for the CDN configuration.
EOF

  echo "✅ DuckDB-WASM will be loaded from CDN (jsDelivr)"
  echo "   CDN URL: https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@${DUCKDB_WASM_VERSION}/dist/"
  echo "   Reason: Cloudflare Pages 25MB file limit (DuckDB WASM is ~35MB)"
}

# =============================================================================
# Setup WASM Dependencies
# =============================================================================

# SDK WASM is bundled in the NPM package - no manual download needed!
echo "✅ SDK WASM bundled via NPM package (@offenedatenmodellierung/data-modelling-sdk)"

# Setup DuckDB-WASM (uses CDN for Cloudflare Pages due to 25MB limit)
setup_duckdb_wasm

# =============================================================================
# Build Application
# =============================================================================

# Build the frontend application
echo "🔨 Building frontend application..."
npm run build

# =============================================================================
# Verify Build Output
# =============================================================================

echo "🔍 Verifying build output..."

# Check that the build completed
if [ ! -d "dist" ]; then
  echo "❌ ERROR: Build output directory 'dist' not found"
  exit 1
fi

# Note: SDK WASM is bundled by Vite from node_modules
# Note: DuckDB WASM files are loaded from CDN, not bundled
echo "   - SDK WASM: Bundled via NPM package"
echo "   - DuckDB-WASM: Loaded from CDN (jsDelivr)"

# Get SDK version from package.json
SDK_VERSION=$(node -e "console.log(require('./node_modules/@offenedatenmodellierung/data-modelling-sdk/package.json').version)")

echo "✅ Build complete! Output directory: dist"
echo ""
echo "📋 Build Summary:"
echo "   - SDK Version: ${SDK_VERSION} (via NPM)"
echo "   - DuckDB-WASM Version: ${DUCKDB_WASM_VERSION} (via CDN)"
echo "   - Output Directory: dist"
