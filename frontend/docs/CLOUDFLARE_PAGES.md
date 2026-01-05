# Cloudflare Pages Deployment Guide

This guide explains how to build and deploy the Open Data Modelling webapp to Cloudflare Pages, including building the WASM SDK with the `openapi` feature enabled.

## Quick Start Checklist

When configuring in Cloudflare Pages dashboard, you need to set:

✅ **Build command**: `cd frontend && bash cloudflare-build.sh`  
✅ **Build output directory**: `frontend/dist`  
✅ **Environment variables** (after project creation): `VITE_OFFLINE_MODE=true`, `VITE_BASE_PATH=/`  

**Note**: You don't need to select a framework preset - the custom build command handles everything. Just fill in the build command and output directory fields.

## Prerequisites

1. **Cloudflare Account**: Sign up at [cloudflare.com](https://www.cloudflare.com/)
2. **GitHub Repository**: Your code should be in a GitHub repository
3. **data-modelling-sdk Repository**: The SDK repository should be available (either as a submodule or in a sibling directory)

## Repository Setup

### Option 1: SDK as Git Submodule (Recommended)

If the SDK is a git submodule:

```bash
# In your repository root
git submodule add https://github.com/pixie79/data-modelling-sdk.git data-modelling-sdk
git submodule update --init --recursive
```

### Option 2: SDK in Sibling Directory

If the SDK is in a sibling directory (e.g., `../data-modelling-sdk`), ensure it's accessible during the build.

## Cloudflare Pages Configuration

### Method 1: Using Cloudflare Dashboard

1. **Go to Cloudflare Dashboard** → **Pages** → **Create a project**
2. **Connect to Git**: 
   - Click "Connect to Git"
   - Select your GitHub account and repository
   - Select your branch (usually `main` or `master`)

3. **Configure Build Settings** (you'll see these fields on the next page):
   
   **Project name**: 
   - Enter: `open-data-modelling` (or your preferred name)
   
   **Production branch**: 
   - Select: `main` (or your default branch)
   
   **Build command**: 
   - Enter: `cd frontend && bash cloudflare-build.sh`
   - This is the most important field - it tells Cloudflare how to build your app
   
   **Build output directory**: 
   - Enter: `frontend/dist`
   - This is where Vite outputs the built files
   
   **Root directory** (if shown): 
   - Leave empty, OR
   - Set to: `frontend` (if your frontend code is in a subdirectory)
   
   **Framework preset** (if shown):
   - You can ignore this or leave it as "None"
   - We're using a custom build command, so framework detection isn't needed

4. **Click "Save and Deploy"** to start your first build

**Note**: The Cloudflare Pages UI may vary. If you don't see all these fields, look for:
- **Build settings** section
- **Build command** or **Build command** field
- **Output directory** or **Build output directory** field

### Method 2: Using Wrangler CLI

1. **Install Wrangler**:
   ```bash
   npm install -g wrangler
   ```

2. **Login to Cloudflare**:
   ```bash
   wrangler login
   ```

3. **Create `wrangler.toml`** in the project root:
   ```toml
   name = "open-data-modelling"
   compatibility_date = "2024-01-01"

   [env.production]
   account_id = "your-account-id"
   ```

4. **Deploy**:
   ```bash
   cd frontend
   wrangler pages deploy dist --project-name=open-data-modelling
   ```

## Build Configuration

### Environment Variables

Set these in Cloudflare Pages dashboard → **Settings** → **Environment variables**:

- `VITE_OFFLINE_MODE`: `true` (required for offline mode)
- `VITE_BASE_PATH`: `/` (or your custom path)
- `SDK_REPO_URL`: `https://github.com/pixie79/data-modelling-sdk.git` (optional, if using submodule)
- `SDK_VERSION`: `main` (or specific version/tag)

### Build Command Details

The build command `cd frontend && bash cloudflare-build.sh` runs a script that:

1. **Installs Rust** (if not already installed) - takes ~2-3 minutes on first build
2. **Installs wasm-pack** (if not already installed) - takes ~1 minute
3. **Builds the WASM SDK** with `wasm` and `openapi` features enabled
4. **Installs npm dependencies** (`npm ci`)
5. **Builds the frontend application** (`npm run build`)

**Important**: Make sure the `cloudflare-build.sh` file has execute permissions. If it doesn't, Cloudflare Pages will fail. The script is already set with execute permissions in the repository.

**Build Output Directory**: `frontend/dist`

This directory contains:
- `index.html` - Main HTML file
- `assets/` - JavaScript and CSS bundles
- `wasm/` - WASM SDK files (data_modelling_sdk.js, data_modelling_sdk_bg.wasm, etc.)
- `_redirects` - SPA routing configuration

## SDK Build with OpenAPI Feature

The SDK is built with both `wasm` and `openapi` features enabled:

```bash
wasm-pack build --target web --out-dir pkg --features wasm,openapi
```

This enables:
- **wasm**: Core WASM functionality for ODCS, ODPS, CADS, SQL, AVRO, Protobuf, JSON Schema operations
- **openapi**: OpenAPI/Swagger import/export functionality

## Manual Build (Local Testing)

To test the build locally before deploying:

```bash
cd frontend

# Install dependencies
npm ci

# Build WASM SDK (requires Rust and wasm-pack)
npm run build:wasm

# Build frontend
npm run build

# Preview locally
npm run preview
```

## Troubleshooting

### Build Fails: Rust Not Found

If the build fails because Rust is not installed, ensure `cloudflare-build.sh` has execute permissions and includes Rust installation:

```bash
chmod +x frontend/cloudflare-build.sh
```

### Build Fails: SDK Not Found

If the SDK repository is not found:

1. **Check SDK location**: Ensure the SDK is in one of these locations:
   - `../data-modelling-sdk` (sibling directory)
   - `data-modelling-sdk` (submodule in repo root)
   - `../../data-modelling-sdk` (two levels up)

2. **Use Git Submodule**: Add the SDK as a submodule:
   ```bash
   git submodule add https://github.com/pixie79/data-modelling-sdk.git data-modelling-sdk
   ```

### Build Fails: wasm-pack Not Found

The `cloudflare-build.sh` script automatically installs wasm-pack if missing. If it still fails:

1. Check that the script has execute permissions
2. Verify the wasm-pack installation URL is accessible
3. Check Cloudflare Pages build logs for specific errors

### WASM Files Not Loading

If WASM files fail to load in production:

1. **Check MIME types**: Cloudflare Pages should automatically serve `.wasm` files with `application/wasm` MIME type
2. **Check paths**: Ensure WASM files are in `dist/wasm/` directory
3. **Check `_redirects` file**: Ensure `_redirects` file is in `frontend/dist/` (it should be copied automatically)

### OpenAPI Feature Not Available

If OpenAPI import/export doesn't work:

1. **Verify SDK build**: Check build logs to ensure `--features wasm,openapi` was used
2. **Check SDK version**: Ensure SDK version is 1.7.0+ (supports openapi feature)
3. **Rebuild**: Force a rebuild by clearing Cloudflare Pages cache

## Custom Domain

To use a custom domain:

1. Go to **Cloudflare Pages** → Your project → **Custom domains**
2. Add your domain
3. Update DNS records as instructed
4. SSL/TLS will be automatically configured

## Continuous Deployment

Cloudflare Pages automatically deploys on:
- **Push to main branch**: Production deployment
- **Pull requests**: Preview deployments

You can configure branch-specific settings in **Settings** → **Builds & deployments**.

## Build Time Considerations

- **First build**: ~10-15 minutes (installs Rust, wasm-pack, builds SDK)
- **Subsequent builds**: ~5-8 minutes (cached dependencies)
- **Build timeout**: Cloudflare Pages has a 20-minute timeout (should be sufficient)

## File Structure

After build, the `dist` directory should contain:

```
dist/
├── index.html
├── assets/
│   ├── index-[hash].js
│   ├── index-[hash].css
│   └── ...
├── wasm/
│   ├── data_modelling_sdk.js
│   ├── data_modelling_sdk_bg.wasm
│   ├── data_modelling_sdk.d.ts
│   └── ...
└── _redirects
```

## Additional Resources

- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [Vite Build Configuration](https://vitejs.dev/config/)

