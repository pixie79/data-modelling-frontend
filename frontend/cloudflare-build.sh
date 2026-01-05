#!/bin/bash
# Cloudflare Pages build script
# This script builds the WASM SDK and the frontend application for Cloudflare Pages

set -e

echo "🚀 Starting Cloudflare Pages build..."

# Install Rust and wasm-pack if not already installed
if ! command -v rustc &> /dev/null; then
  echo "📦 Installing Rust..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  source "$HOME/.cargo/env"
fi

if ! command -v wasm-pack &> /dev/null; then
  echo "📦 Installing wasm-pack..."
  curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
fi

# Set environment variables for Cloudflare Pages
export VITE_OFFLINE_MODE="true"
export VITE_BASE_PATH="/"

# Build WASM SDK first
echo "🔨 Building WASM SDK..."
npm run build:wasm || echo "⚠️  WASM SDK build skipped (SDK not found or build failed)"

# Install dependencies
echo "📦 Installing npm dependencies..."
npm ci

# Build the frontend application
echo "🔨 Building frontend application..."
npm run build

echo "✅ Build complete! Output directory: dist"

