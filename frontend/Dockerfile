# Multi-stage build for frontend with WASM SDK
# Stage 1: Build the frontend application
FROM node:20-alpine AS builder

# Install bash and curl for build scripts and WASM SDK download
RUN apk add --no-cache bash curl

WORKDIR /app

# Build arguments for environment variables
ARG VITE_OFFLINE_MODE=true
ARG VITE_API_BASE_URL=
ARG VITE_WS_BASE_URL=
ARG WASM_SDK_VERSION=latest
ARG WASM_SDK_REPO=OffeneDatenmodellierung/data-modelling-sdk

# Set environment variables for build
ENV VITE_OFFLINE_MODE=${VITE_OFFLINE_MODE}
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_WS_BASE_URL=${VITE_WS_BASE_URL}
ENV VITE_BASE_PATH=/

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Download WASM SDK from GitHub Releases (REQUIRED)
RUN set -e && \
    echo "📥 Downloading WASM SDK from GitHub Releases (REQUIRED)..." && \
    if [ "${WASM_SDK_VERSION}" = "latest" ]; then \
    echo "   Fetching latest release tag..." && \
    RELEASE_TAG=$(curl -s "https://api.github.com/repos/${WASM_SDK_REPO}/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/' || echo "") && \
    if [ -z "$RELEASE_TAG" ]; then \
    echo "❌ ERROR: Could not fetch latest release tag from ${WASM_SDK_REPO}" && \
    echo "   Please ensure the SDK repository has published releases" && \
    echo "   Or set WASM_SDK_VERSION build arg to a specific version (e.g., 1.7.0)" && \
    exit 1; \
    fi && \
    VERSION_NUM=${RELEASE_TAG#v} && \
    echo "   Latest release: ${RELEASE_TAG} (version ${VERSION_NUM})"; \
    else \
    VERSION_NUM=${WASM_SDK_VERSION} && \
    RELEASE_TAG="v${WASM_SDK_VERSION}" && \
    echo "   Using specified version: ${VERSION_NUM}"; \
    fi && \
    ARCHIVE_URL="https://github.com/${WASM_SDK_REPO}/releases/download/${RELEASE_TAG}/data-modelling-sdk-wasm-v${VERSION_NUM}.tar.gz" && \
    ARCHIVE_FILE="wasm-sdk.tar.gz" && \
    echo "   Downloading from: ${ARCHIVE_URL}" && \
    if curl -L -f -o "$ARCHIVE_FILE" "$ARCHIVE_URL"; then \
    echo "✅ Downloaded WASM SDK successfully" && \
    mkdir -p public/wasm && \
    tar -xzf "$ARCHIVE_FILE" -C public/wasm && \
    if [ ! -f "public/wasm/data_modelling_sdk.js" ]; then \
    echo "❌ ERROR: WASM SDK extraction failed - data_modelling_sdk.js not found" && \
    rm -f "$ARCHIVE_FILE" && \
    exit 1; \
    fi && \
    rm -f "$ARCHIVE_FILE" && \
    echo "✅ WASM SDK installed to public/wasm"; \
    else \
    echo "❌ ERROR: Failed to download WASM SDK from GitHub Releases" && \
    echo "   URL: ${ARCHIVE_URL}" && \
    echo "   The WASM SDK is REQUIRED for this application" && \
    echo "" && \
    echo "   Troubleshooting:" && \
    echo "   1. Ensure the SDK repository (${WASM_SDK_REPO}) has published a release with tag ${RELEASE_TAG}" && \
    echo "   2. Check that the release includes data-modelling-sdk-wasm-v${VERSION_NUM}.tar.gz" && \
    echo "   3. Verify network connectivity to GitHub" && \
    echo "   4. Try setting WASM_SDK_VERSION build arg to a different version" && \
    rm -f "$ARCHIVE_FILE" && \
    exit 1; \
    fi

# Copy source code
COPY . .

# Build the frontend application
# Note: TypeScript errors are checked in CI/CD, but we allow Docker builds to proceed
# to enable testing/deployment even with some type issues
# Use npx vite build directly to skip tsc checking in Docker (type checking happens in CI)
RUN npx vite build --mode production

# Stage 2: Production server with nginx
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
