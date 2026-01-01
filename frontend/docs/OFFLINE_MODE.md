# Offline Mode Architecture

## Overview

The application supports **dual-mode operation**:
- **Online Mode**: Uses API endpoints (which use the SDK server-side)
- **Offline Mode**: Uses WASM SDK directly in the browser

## Architecture

### Mode Detection

The `sdkModeDetector` service automatically detects whether to use online or offline mode by checking API availability.

### SDK Integration

1. **Online Mode** (default when API is available):
   - All import/export operations go through API endpoints
   - API uses the SDK server-side
   - Benefits: Centralized processing, consistent results

2. **Offline Mode** (when API unavailable):
   - Uses WASM SDK directly in the browser
   - All operations run client-side
   - Benefits: Works without internet, faster for local operations

### WASM SDK Build

The SDK (version **1.0.2**) is automatically built as part of the application build process:

```bash
# Build WASM SDK manually
npm run build:wasm

# Or it will be built automatically before npm run build
npm run build
```

The build script (`scripts/build-wasm.sh`):
1. Locates the `data-modelling-sdk` directory (must be version 1.0.2)
2. Builds the WASM module using `wasm-pack` with `--features wasm`
3. Copies the built files to `frontend/public/wasm/`

**SDK Version Requirement**: The application requires `data-modelling-sdk = "1.0.2"` crate. The API project also uses this version with features `["api-backend", "git"]`.

**Note**: If the SDK is not available, the build will continue successfully and offline mode will use a JavaScript YAML parser fallback.

### Services

All SDK services (`odcsService`, `importExportService`) automatically switch between modes:

- `parseYAML()` - Parses ODCS YAML (API or WASM)
- `toYAML()` - Converts workspace to ODCS YAML (API or WASM)
- `importFromSQL()` - Imports SQL (API or WASM)
- `importFromAVRO()` - Imports AVRO (API or WASM)
- `importFromJSONSchema()` - Imports JSON Schema (API or WASM)
- `importFromProtobuf()` - Imports Protobuf (API or WASM)
- `exportToSQL()` - Exports SQL (API or WASM)
- `exportToAVRO()` - Exports AVRO (API or WASM)
- `exportToJSONSchema()` - Exports JSON Schema (API or WASM)
- `exportToProtobuf()` - Exports Protobuf (API or WASM)

### Current Status

- ✅ WASM SDK build: **Automated** (builds before app build)
- ✅ Mode detection: **Implemented**
- ✅ Dual-mode services: **Implemented**
- ✅ YAML parser fallback: **Implemented** (js-yaml when SDK unavailable)
- ✅ Build integration: **Implemented** (prebuild script)
- ⏳ WASM bindings: **Pending** (SDK methods need to be exposed via wasm-bindgen)
- ⏳ WASM module loading: **Placeholder** (needs actual module integration)

### Build Process

The WASM SDK is built automatically:
1. **Development**: Run `npm run build:wasm` manually or let `npm run dev` handle it
2. **Production**: `npm run build` automatically runs `prebuild` which builds WASM SDK
3. **CI/CD**: GitHub Actions builds WASM SDK before building the application

If the SDK is not available, the build continues and offline mode uses the JavaScript YAML parser fallback.

