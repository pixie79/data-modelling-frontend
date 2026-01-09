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
- **WASM SDK**: Downloaded from GitHub Releases (pre-built, required)
- **Offline Mode**: Application operates entirely offline (no API required)

## Building

The Dockerfile uses a multi-stage build:

1. **Node Builder Stage**: Downloads WASM SDK from GitHub Releases and builds the React frontend application
2. **Nginx Stage**: Serves the built application

### Building with Latest SDK

The Dockerfile automatically:
- Downloads the latest pre-built WASM SDK from GitHub Releases
- Extracts WASM files to `public/wasm/`
- Builds the frontend application

**Note**: The WASM SDK is **REQUIRED** - the build will fail if it cannot be downloaded. Ensure the SDK repository has published releases before building.

### Custom SDK Version

To use a specific SDK version, set the `WASM_SDK_VERSION` build argument:

```bash
# Build with specific SDK version
docker-compose build --build-arg WASM_SDK_VERSION=1.7.0 frontend

# Or in docker-compose.yml
services:
  frontend:
    build:
      args:
        WASM_SDK_VERSION: "1.7.0"
```

**Build Arguments**:
- `WASM_SDK_VERSION`: SDK version to download (defaults to `latest`)
- `WASM_SDK_REPO`: GitHub repository (defaults to `OffeneDatenmodellierung/data-modelling-sdk`)

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

### Build Fails - WASM SDK Download Failed

If the WASM SDK cannot be downloaded:

1. **Check GitHub Releases**: Ensure the SDK repository has published releases with WASM artifacts
2. **Verify Version**: Check that the specified `WASM_SDK_VERSION` exists in releases
3. **Network Connectivity**: Ensure Docker build can access GitHub (check firewall/proxy settings)
4. **Use Specific Version**: Try setting `WASM_SDK_VERSION` to a known working version:

   ```bash
   docker-compose build --build-arg WASM_SDK_VERSION=1.7.0 frontend
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
