# Docker Setup Guide

## Overview

This Docker setup builds and runs the frontend application in **offline mode only**. No API server or database is required.

## Quick Start

```bash
# Build and start the frontend service
docker-compose up -d

# View logs
docker-compose logs -f frontend

# Stop the service
docker-compose down
```

## What's Included

- **Frontend Service**: React application with Nginx serving static files
- **WASM SDK**: Built from the latest Rust SDK during Docker build
- **Offline Mode**: Application operates entirely offline (no API required)

## Building

The Dockerfile uses a multi-stage build:

1. **Rust Builder Stage**: Builds the latest WASM SDK from source
2. **Node Builder Stage**: Builds the React frontend application
3. **Nginx Stage**: Serves the built application

### Building with Latest SDK

The Dockerfile automatically:
- Clones the latest `data-modelling-sdk` repository
- Builds WASM using `wasm-pack`
- Copies WASM files to the frontend build

**Note**: If the SDK repository is not available, the build will continue using any existing WASM files or skip WASM build.

### Custom SDK Version

To use a specific SDK version, modify the Dockerfile:

```dockerfile
# In rust-builder stage, checkout specific version
RUN git clone https://github.com/pixie79/data-modelling-sdk.git . && \
    git checkout v1.6.2 && \
    wasm-pack build --target web --out-dir pkg --features wasm
```

## Configuration

### Environment Variables

The application runs in offline mode by default. You can override this:

```yaml
# docker-compose.override.yml
services:
  frontend:
    build:
      args:
        VITE_OFFLINE_MODE: "true"  # Set to "false" to enable online mode (requires API)
```

### Port Configuration

Default port mapping:
- Host port `5173` → Container port `80`

To change the port, update `docker-compose.yml`:

```yaml
services:
  frontend:
    ports:
      - "8080:80"  # Change host port to 8080
```

## Accessing the Application

Once started, access the application at:
- **URL**: http://localhost:5173

## Troubleshooting

### Build Fails - SDK Not Found

If the SDK repository is not accessible during build:

1. **Option 1**: Ensure the SDK repository is publicly accessible
2. **Option 2**: Copy WASM files manually before building:
   ```bash
   # Build WASM SDK locally first
   cd frontend
   npm run build:wasm
   
   # Then build Docker image
   docker-compose build
   ```

### WASM Files Not Loading

- Check browser console for WASM loading errors
- Verify WASM files exist: `docker exec data-modelling-frontend ls -la /usr/share/nginx/html/wasm/`
- Check Nginx logs: `docker-compose logs frontend`
- Verify WASM MIME type is configured in nginx

### Application Shows Blank Screen

- Check Nginx logs: `docker-compose logs frontend`
- Verify build completed successfully: `docker-compose build --no-cache frontend`
- Check browser console for JavaScript errors

## Development

For local development with hot reload, use the development server instead:

```bash
cd frontend
npm install
npm run build:wasm
npm run dev
```

Docker is primarily for production builds and deployment.

## Production Deployment

For production deployment:

1. Build the image:
   ```bash
   docker-compose build frontend
   ```

2. Tag and push to registry:
   ```bash
   docker tag data-modelling-frontend:latest your-registry/data-modelling-frontend:latest
   docker push your-registry/data-modelling-frontend:latest
   ```

3. Run in production:
   ```bash
   docker run -d -p 80:80 --name data-modelling-frontend your-registry/data-modelling-frontend:latest
   ```

## Network

The frontend service uses a bridge network (`data-modelling-network`) for potential future services, but currently operates standalone.

## Volumes

No persistent volumes are required for offline mode. All data is stored locally in the browser/Electron app.
