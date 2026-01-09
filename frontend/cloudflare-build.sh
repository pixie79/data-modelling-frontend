#!/bin/bash
# Cloudflare Pages build script
# This script builds the frontend application for Cloudflare Pages
# It downloads pre-built WASM SDK from GitHub Releases (REQUIRED)
# It also sets up DuckDB-WASM for in-browser database operations

set -e

echo "🚀 Starting Cloudflare Pages build..."

# Set environment variables for Cloudflare Pages
export VITE_OFFLINE_MODE="true"
export VITE_BASE_PATH="/"
export CLOUDFLARE_PAGES="true"  # Signals scripts to use CDN for large WASM files

# Install dependencies first
echo "📦 Installing npm dependencies..."
npm ci

# =============================================================================
# Version Configuration
# =============================================================================
# WASM SDK version (defaults to 1.13.4, or set via WASM_SDK_VERSION env var)
WASM_SDK_VERSION="${WASM_SDK_VERSION:-1.13.4}"
SDK_REPO="${WASM_SDK_REPO:-OffeneDatenmodellierung/data-modelling-sdk}"
WASM_OUT_DIR="public/wasm"

# DuckDB-WASM version (should match @duckdb/duckdb-wasm in package.json)
DUCKDB_WASM_VERSION="1.32.0"
DUCKDB_OUT_DIR="public/duckdb"

# Function to download WASM SDK from GitHub Releases
# REQUIRED: Build will fail if WASM SDK cannot be downloaded
download_wasm_sdk() {
  local version=$1
  local repo=$2

  echo "📥 Downloading WASM SDK from GitHub Releases (REQUIRED)..."

  if [ "$version" = "latest" ]; then
    # Get latest release tag
    echo "   Fetching latest release tag..."
    RELEASE_TAG=$(curl -s "https://api.github.com/repos/${repo}/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/' || echo "")

    if [ -z "$RELEASE_TAG" ]; then
      echo "❌ ERROR: Could not fetch latest release tag from ${repo}"
      echo "   Please ensure the SDK repository has published releases"
      echo "   Or set WASM_SDK_VERSION to a specific version (e.g., 1.7.0)"
      exit 1
    fi

    # Extract version number from tag (e.g., v1.7.0 -> 1.7.0)
    VERSION_NUM=${RELEASE_TAG#v}
    echo "   Latest release: ${RELEASE_TAG} (version ${VERSION_NUM})"
  else
    VERSION_NUM=$version
    RELEASE_TAG="v${version}"
    echo "   Using specified version: ${VERSION_NUM}"
  fi

  # Download WASM archive
  ARCHIVE_URL="https://github.com/${repo}/releases/download/${RELEASE_TAG}/data-modelling-sdk-wasm-v${VERSION_NUM}.tar.gz"
  ARCHIVE_FILE="wasm-sdk.tar.gz"

  echo "   Downloading from: ${ARCHIVE_URL}"

  if curl -L -f -o "$ARCHIVE_FILE" "$ARCHIVE_URL"; then
    echo "✅ Downloaded WASM SDK successfully"

    # Create output directory
    mkdir -p "$WASM_OUT_DIR"

    # Extract archive
    echo "   Extracting WASM files..."
    tar -xzf "$ARCHIVE_FILE" -C "$WASM_OUT_DIR"

    # Verify WASM files were extracted
    if [ ! -f "$WASM_OUT_DIR/data_modelling_sdk.js" ]; then
      echo "❌ ERROR: WASM SDK extraction failed - data_modelling_sdk.js not found"
      rm -f "$ARCHIVE_FILE"
      exit 1
    fi

    # Clean up
    rm -f "$ARCHIVE_FILE"

    echo "✅ WASM SDK installed to ${WASM_OUT_DIR}"
    return 0
  else
    echo "❌ ERROR: Failed to download WASM SDK from GitHub Releases"
    echo "   URL: ${ARCHIVE_URL}"
    echo "   The WASM SDK is REQUIRED for this application"
    echo ""
    echo "   Troubleshooting:"
    echo "   1. Ensure the SDK repository (${repo}) has published a release with tag ${RELEASE_TAG}"
    echo "   2. Check that the release includes data-modelling-sdk-wasm-v${VERSION_NUM}.tar.gz"
    echo "   3. Verify network connectivity to GitHub"
    echo "   4. Try setting WASM_SDK_VERSION to a different version"
    rm -f "$ARCHIVE_FILE"
    exit 1
  fi
}

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
- **Web (Cloudflare Pages)**: https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/dist/
- **Electron**: Local files in /duckdb/

See `src/types/duckdb.ts` for the CDN configuration.
EOF

  echo "✅ DuckDB-WASM will be loaded from CDN (jsDelivr)"
  echo "   CDN URL: https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@${DUCKDB_WASM_VERSION}/dist/"
  echo "   Reason: Cloudflare Pages 25MB file limit (DuckDB WASM is ~35MB)"
}

# =============================================================================
# Download/Copy WASM Dependencies
# =============================================================================

# Download WASM SDK (REQUIRED - build will fail if this fails)
if [ -z "$CLOUDFLARE_SKIP_WASM" ]; then
  download_wasm_sdk "$WASM_SDK_VERSION" "$SDK_REPO"
  echo "✅ Using pre-built WASM SDK from GitHub Releases"
else
  echo "⚠️  WARNING: CLOUDFLARE_SKIP_WASM is set - WASM SDK download skipped"
  echo "   This is NOT recommended - the application REQUIRES WASM SDK"
  echo "   Build will continue but the application may not function correctly"
fi

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

# Check SDK WASM files in dist
if [ ! -f "dist/wasm/data_modelling_sdk.js" ]; then
  echo "⚠️  WARNING: SDK WASM files may not be in build output"
fi

# Note: DuckDB WASM files are loaded from CDN, not bundled
echo "   - DuckDB-WASM: Loaded from CDN (jsDelivr)"

echo "✅ Build complete! Output directory: dist"
echo ""
echo "📋 Build Summary:"
echo "   - SDK WASM Version: ${WASM_SDK_VERSION}"
echo "   - DuckDB-WASM Version: ${DUCKDB_WASM_VERSION}"
echo "   - Output Directory: dist"
