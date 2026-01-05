# Offline Mode Architecture

## Overview

**⚠️ IMPORTANT: This application currently only supports OFFLINE MODE.**

The application operates entirely offline using:
- **WASM SDK**: Direct use of `data-modelling-sdk` compiled to WebAssembly
- **Local File System**: Electron file system access for saving/loading workspaces
- **No API Required**: All functionality works without any backend server

## Architecture

### Offline Mode Only

The application uses WASM SDK directly in the browser/Electron:
- All import/export operations run client-side
- File operations use Electron IPC handlers
- All data is stored locally in YAML files
- No network requests required

### WASM SDK Build

The SDK (version **1.7.0+**) is automatically built as part of the application build process:

```bash
# Build WASM SDK manually
npm run build:wasm

# Or it will be built automatically before npm run build
npm run build
```

The build script (`scripts/build-wasm.sh`):
1. Locates the `data-modelling-sdk` directory
2. Builds the WASM module using `wasm-pack` with `--features wasm`
3. Copies the built files to `frontend/public/wasm/`

**Note**: If the SDK is not available, the build will continue successfully and the app will use a JavaScript YAML parser fallback.

### Services

All SDK services (`odcsService`, `importExportService`) use offline mode:
- `odcsService.parseYAML()` - Uses WASM SDK `parse_odcs_yaml` function
- `odcsService.toYAML()` - Uses WASM SDK `export_to_odcs_yaml` function
- `importExportService` - Uses WASM SDK for SQL, AVRO, JSON Schema, Protobuf imports

### File Storage

In Electron offline mode:
- **Workspace Storage**: Domain folders with YAML files
- **File Structure**: Each domain has its own folder containing:
  - `domain.yaml` - Domain definition with systems and relationships
  - `{table-name}.odcs.yaml` - Table definitions
  - `{product-name}.odps.yaml` - Data product definitions
  - `{asset-name}.cads.yaml` - Compute asset definitions
  - `{process-name}.bpmn` - BPMN process definitions
  - `{decision-name}.dmn` - DMN decision definitions

### File Operations

File operations use Electron IPC handlers:
- `readFile` - Read files from disk
- `writeFile` - Write files to disk (creates directories automatically)
- `readDirectory` - List files in a directory
- `deleteFile` - Delete files
- `ensureDirectory` - Create directories

### Benefits of Offline Mode

1. **No Server Required**: Works completely standalone
2. **Fast Local Operations**: No network latency
3. **Privacy**: All data stays on your machine
4. **Offline Capable**: Works without internet connection
5. **Version Control Friendly**: All data stored as YAML files

## Related Documentation

- [ELECTRON_BUILD_GUIDE.md](../ELECTRON_BUILD_GUIDE.md) - Building the Electron app
- [README.md](../../README.md) - Project overview
