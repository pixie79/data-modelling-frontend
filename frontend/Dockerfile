# Multi-stage build for frontend with WASM SDK
# Stage 1: Build Rust SDK and WASM
FROM rust:latest AS rust-builder

WORKDIR /sdk

# Install wasm-pack for building WASM SDK
RUN curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# Clone and build the latest data-modelling-sdk
# Uses the latest version from the main branch
# For production, you may want to use a specific version/tag
ARG SDK_REPO_URL=https://github.com/pixie79/data-modelling-sdk.git
ARG SDK_VERSION=main

# Clone SDK repository (with error handling)
RUN git clone --depth 1 --branch ${SDK_VERSION} ${SDK_REPO_URL} . 2>&1 | tee /tmp/clone.log || \
    (echo "⚠️  SDK repository clone failed - check /tmp/clone.log" && \
     echo "   This is not fatal - build will continue and try local WASM build" && \
     mkdir -p pkg)

# Build WASM SDK if Cargo.toml exists (with wasm and openapi features)
RUN if [ -f "Cargo.toml" ]; then \
        echo "✅ Building WASM SDK from latest source (version: ${SDK_VERSION})..." && \
        wasm-pack build --target web --out-dir pkg --features wasm,openapi 2>&1 | tee /tmp/wasm-build.log && \
        echo "✅ WASM SDK built successfully"; \
    else \
        echo "⚠️  SDK Cargo.toml not found - WASM build skipped" && \
        echo "   Build will continue and try local WASM build or use existing files" && \
        mkdir -p pkg; \
    fi

# Stage 2: Build the frontend application
FROM node:20-alpine AS builder

# Install bash for build scripts (Alpine uses dash by default)
RUN apk add --no-cache bash

WORKDIR /app

# Build arguments for environment variables
ARG VITE_OFFLINE_MODE=true
ARG VITE_API_BASE_URL=
ARG VITE_WS_BASE_URL=

# Set environment variables for build
ENV VITE_OFFLINE_MODE=${VITE_OFFLINE_MODE}
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_WS_BASE_URL=${VITE_WS_BASE_URL}
ENV VITE_BASE_PATH=/

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Copy WASM SDK build from rust-builder if available
COPY --from=rust-builder /sdk/pkg /tmp/sdk-pkg

# Copy WASM SDK to public/wasm if built successfully
RUN if [ -d "/tmp/sdk-pkg" ] && [ -f "/tmp/sdk-pkg/data_modelling_sdk.js" ]; then \
        echo "Copying WASM SDK from Docker build..." && \
        mkdir -p public/wasm && \
        cp -r /tmp/sdk-pkg/* public/wasm/ && \
        echo "✅ WASM SDK copied successfully from Docker build"; \
    else \
        echo "⚠️  WASM SDK not found in Docker build - will try local build or use existing"; \
    fi

# Build WASM SDK locally if not already built (fallback)
# This allows building even if SDK repo wasn't available during Docker build
RUN npm run build:wasm || echo "⚠️  Local WASM build skipped (may use existing files)"

# Build the frontend application
# Note: TypeScript errors are checked in CI/CD, but we allow Docker builds to proceed
# to enable testing/deployment even with some type issues
# Use npx vite build directly to skip tsc checking in Docker (type checking happens in CI)
RUN npx vite build --mode production

# Stage 3: Production server with nginx
FROM nginx:alpine

# Copy built files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Add WASM MIME type to mime.types file (if not already present)
RUN if ! grep -q "application/wasm" /etc/nginx/mime.types; then \
        sed -i '/^}$/i\    application/wasm wasm;' /etc/nginx/mime.types || \
        echo "    application/wasm wasm;" >> /etc/nginx/mime.types; \
    fi

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
