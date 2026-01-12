#!/bin/bash
# Download pre-built WASM SDK from GitHub releases and copy to frontend/public/wasm/

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WASM_OUT_DIR="$FRONTEND_DIR/public/wasm"
SDK_VERSION="2.0.2"
GITHUB_REPO="OffeneDatenmodellierung/data-modelling-sdk"
RELEASE_URL="https://github.com/$GITHUB_REPO/releases/download/v$SDK_VERSION/data-modelling-sdk-wasm-v$SDK_VERSION.tar.gz"

echo "Downloading pre-built WASM SDK v$SDK_VERSION from GitHub releases..."

# Create temporary directory for download
TMP_DIR=$(mktemp -d)
trap "rm -rf $TMP_DIR" EXIT

# Download the pre-built WASM package
echo "   Downloading from: $RELEASE_URL"
if command -v curl &> /dev/null; then
  if ! curl -L -f -o "$TMP_DIR/wasm-pkg.tar.gz" "$RELEASE_URL"; then
    echo "   ❌ Error: Failed to download pre-built WASM from GitHub releases"
    echo "   Please check:"
    echo "     - Internet connection is available"
    echo "     - GitHub release v$SDK_VERSION exists at $GITHUB_REPO"
    echo "     - The release contains wasm-pkg.tar.gz asset"
    exit 1
  fi
elif command -v wget &> /dev/null; then
  if ! wget -O "$TMP_DIR/wasm-pkg.tar.gz" "$RELEASE_URL"; then
    echo "   ❌ Error: Failed to download pre-built WASM from GitHub releases"
    echo "   Please check:"
    echo "     - Internet connection is available"
    echo "     - GitHub release v$SDK_VERSION exists at $GITHUB_REPO"
    echo "     - The release contains wasm-pkg.tar.gz asset"
    exit 1
  fi
else
  echo "   ❌ Error: Neither curl nor wget is available for downloading"
  echo "   Please install curl or wget to download the WASM SDK"
  exit 1
fi

echo "   ✅ Downloaded WASM package (v$SDK_VERSION)"

# Extract the archive
echo "   Extracting WASM files..."
cd "$TMP_DIR"
tar -xzf wasm-pkg.tar.gz

# Create wasm output directory if it doesn't exist
mkdir -p "$WASM_OUT_DIR"

# Copy WASM files to frontend/public/wasm/
echo "   Copying WASM files to $WASM_OUT_DIR..."
cp -r pkg/* "$WASM_OUT_DIR/" 2>/dev/null || {
  # If pkg/ doesn't exist, try copying from root of archive
  cp -r ./* "$WASM_OUT_DIR/" 2>/dev/null || {
    echo "   ⚠️  Warning: Unexpected archive structure"
    exit 0
  }
}

echo "✅ WASM SDK v$SDK_VERSION downloaded and installed successfully"
echo "   WASM files are now in $WASM_OUT_DIR"
