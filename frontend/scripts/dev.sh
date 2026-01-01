#!/bin/bash
# Development server startup script

set -e

echo "🚀 Starting Data Modelling Web Application"
echo ""

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "❌ Error: Node.js 20+ required. Current version: $(node --version)"
  exit 1
fi

echo "✅ Node.js version: $(node --version)"

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

# Check if WASM files exist, if not try to build them
if [ ! -f "public/wasm/data_modelling_sdk.js" ]; then
  echo "📦 WASM SDK not found. Attempting to build..."
  if command -v wasm-pack &> /dev/null; then
    npm run build:wasm || echo "⚠️  Warning: Failed to build WASM SDK. Offline mode will use fallback parser."
  else
    echo "⚠️  Warning: wasm-pack not found. Install with: cargo install wasm-pack"
    echo "   Offline mode will use fallback YAML parser."
  fi
fi

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
  echo "📝 Creating .env.local from example..."
  cp .env.example .env.local 2>/dev/null || echo "VITE_API_BASE_URL=http://localhost:8081
VITE_WS_BASE_URL=ws://localhost:8081" > .env.local
  echo "✅ Created .env.local (edit if needed)"
fi

echo ""
echo "🌐 Starting development server..."
echo "   Application will be available at: http://localhost:5173"
echo ""
echo "💡 Tips:"
echo "   - API should run on http://localhost:8081 (optional)"
echo "   - App will work offline if API is not available"
echo "   - Press Ctrl+C to stop"
echo ""

npm run dev

