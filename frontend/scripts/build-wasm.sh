#!/bin/bash
# Build WASM SDK and copy to frontend/public/wasm/

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$FRONTEND_DIR/.." && pwd)"

# Try multiple possible SDK locations
SDK_DIR=""
for possible_path in "$PROJECT_ROOT/data-modelling-sdk" "$PROJECT_ROOT/../data-modelling-sdk" "$FRONTEND_DIR/../data-modelling-sdk"; do
  if [ -d "$possible_path" ] && [ -f "$possible_path/Cargo.toml" ]; then
    SDK_DIR="$possible_path"
    break
  fi
done

WASM_OUT_DIR="$FRONTEND_DIR/public/wasm"

echo "Building WASM SDK (requires data-modelling-sdk version 1.7.0+)..."

# Check if SDK directory exists
if [ -z "$SDK_DIR" ]; then
  echo "⚠️  Warning: SDK directory not found"
  echo "   Searched in:"
  echo "     - $PROJECT_ROOT/data-modelling-sdk"
  echo "     - $PROJECT_ROOT/../data-modelling-sdk"
  echo "     - $FRONTEND_DIR/../data-modelling-sdk"
  echo ""
      echo "   The WASM SDK is optional - offline mode will use a JavaScript YAML parser fallback."
      echo "   To build the SDK, ensure data-modelling-sdk (version 1.7.0+) is available and contains Cargo.toml"
  exit 0  # Exit successfully - this is not a fatal error
fi

echo "✅ Found SDK at: $SDK_DIR"

# Check SDK version (if Cargo.toml exists)
if [ -f "$SDK_DIR/Cargo.toml" ]; then
  SDK_VERSION=$(grep -E '^version\s*=' "$SDK_DIR/Cargo.toml" | head -1 | sed 's/.*version\s*=\s*"\([^"]*\)".*/\1/' || echo "")
  if [ -n "$SDK_VERSION" ]; then
    echo "   SDK version: $SDK_VERSION"
    # Check if version is 1.7.0 or higher
    if [ "$(printf '%s\n' "1.7.0" "$SDK_VERSION" | sort -V | head -n1)" != "1.7.0" ]; then
      echo "   ⚠️  Warning: Expected version 1.7.0+, found $SDK_VERSION"
      echo "   The application requires data-modelling-sdk >= \"1.7.0\" for enhanced AVRO/Protobuf/JSON Schema export/import support"
      echo "   Some features may not work correctly with older SDK versions"
    else
      echo "   ✅ SDK version $SDK_VERSION meets requirements (>= 1.7.0)"
    fi
  fi
fi

# Check if wasm-pack is installed
if ! command -v wasm-pack &> /dev/null; then
  echo "Error: wasm-pack is not installed"
  echo "Install it with: cargo install wasm-pack"
  exit 1
fi

# Build WASM SDK with wasm and openapi features
cd "$SDK_DIR"
echo "Building WASM module in $SDK_DIR..."
wasm-pack build --target web --out-dir pkg --features wasm,openapi

# Create wasm output directory if it doesn't exist
mkdir -p "$WASM_OUT_DIR"

# Copy WASM files to frontend/public/wasm/
echo "Copying WASM files to $WASM_OUT_DIR..."
cp -r "$SDK_DIR/pkg"/* "$WASM_OUT_DIR/"

echo "✅ WASM SDK built and copied successfully"
echo "WASM files are now in $WASM_OUT_DIR"

