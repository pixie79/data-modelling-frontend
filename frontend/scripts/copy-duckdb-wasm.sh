#!/bin/bash
# Copy DuckDB-WASM files from node_modules to public/duckdb/
# This script ensures DuckDB-WASM files are available for the browser

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DUCKDB_OUT_DIR="$FRONTEND_DIR/public/duckdb"
DUCKDB_PKG="$FRONTEND_DIR/node_modules/@duckdb/duckdb-wasm/dist"

# Expected version (should match package.json)
EXPECTED_VERSION="1.29.0"

echo "Setting up DuckDB-WASM files..."

# Check if DuckDB-WASM package is installed
if [ ! -d "$DUCKDB_PKG" ]; then
  echo "   DuckDB-WASM package not found at $DUCKDB_PKG"
  echo "   Running npm install..."
  cd "$FRONTEND_DIR"
  npm install @duckdb/duckdb-wasm@$EXPECTED_VERSION
fi

# Verify version
INSTALLED_VERSION=$(node -p "require('$FRONTEND_DIR/node_modules/@duckdb/duckdb-wasm/package.json').version" 2>/dev/null || echo "unknown")
if [ "$INSTALLED_VERSION" != "$EXPECTED_VERSION" ]; then
  echo "   WARNING: DuckDB-WASM version mismatch"
  echo "   Expected: $EXPECTED_VERSION"
  echo "   Installed: $INSTALLED_VERSION"
fi

# Create output directory
mkdir -p "$DUCKDB_OUT_DIR"

# Copy WASM files
echo "   Copying DuckDB-WASM files to $DUCKDB_OUT_DIR..."

# Copy the main WASM files (eh = exception handling, mvp = minimal viable product)
cp "$DUCKDB_PKG/duckdb-eh.wasm" "$DUCKDB_OUT_DIR/"
cp "$DUCKDB_PKG/duckdb-mvp.wasm" "$DUCKDB_OUT_DIR/" 2>/dev/null || true

# Copy worker files
cp "$DUCKDB_PKG/duckdb-browser-eh.worker.js" "$DUCKDB_OUT_DIR/"
cp "$DUCKDB_PKG/duckdb-browser-mvp.worker.js" "$DUCKDB_OUT_DIR/" 2>/dev/null || true

# Verify files were copied
if [ ! -f "$DUCKDB_OUT_DIR/duckdb-eh.wasm" ]; then
  echo "   ERROR: Failed to copy DuckDB-WASM files"
  exit 1
fi

# Get file sizes for verification
EH_WASM_SIZE=$(ls -lh "$DUCKDB_OUT_DIR/duckdb-eh.wasm" | awk '{print $5}')
WORKER_SIZE=$(ls -lh "$DUCKDB_OUT_DIR/duckdb-browser-eh.worker.js" | awk '{print $5}')

echo "   DuckDB-WASM v$INSTALLED_VERSION installed successfully"
echo "   Files copied to $DUCKDB_OUT_DIR:"
echo "     - duckdb-eh.wasm ($EH_WASM_SIZE)"
echo "     - duckdb-browser-eh.worker.js ($WORKER_SIZE)"

# Also copy MVP files if they exist
if [ -f "$DUCKDB_OUT_DIR/duckdb-mvp.wasm" ]; then
  MVP_WASM_SIZE=$(ls -lh "$DUCKDB_OUT_DIR/duckdb-mvp.wasm" | awk '{print $5}')
  echo "     - duckdb-mvp.wasm ($MVP_WASM_SIZE)"
fi

echo "DuckDB-WASM setup complete"
