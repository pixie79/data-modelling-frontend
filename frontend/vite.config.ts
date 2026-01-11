import { defineConfig, Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import packageJson from './package.json';

// https://vitejs.dev/config/
// Use absolute paths for web/Docker, relative paths for Electron
// VITE_BASE_PATH can be set to './' for Electron builds, '/' for web builds
// Check if we're building for Electron by checking if VITE_ELECTRON_BUILD is set
const basePath =
  process.env.VITE_BASE_PATH || (process.env.VITE_ELECTRON_BUILD === 'true' ? './' : '/');

/**
 * Plugin to ensure WASM files are served with correct MIME type
 * Fixes: "WebAssembly.instantiateStreaming failed because your server
 * does not serve Wasm with application/wasm MIME type"
 */
function wasmMimeTypePlugin(): Plugin {
  return {
    name: 'wasm-mime-type',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.endsWith('.wasm')) {
          res.setHeader('Content-Type', 'application/wasm');
        }
        next();
      });
    },
  };
}

export default defineConfig({
  base: basePath,
  plugins: [react(), wasmMimeTypePlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Content Security Policy for bpmn-js/dmn-js inline styles
  // Cross-Origin headers required for SharedArrayBuffer (DuckDB-WASM performance)
  server: {
    port: 5173,
    headers: {
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; worker-src 'self' blob:;",
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Ensure WASM files are copied to dist
    copyPublicDir: true,
    rollupOptions: {
      output: {
        // Preserve WASM files in the build at the root wasm/ directory
        // This ensures they're accessible via ./wasm/ from dist/index.html
        assetFileNames: (assetInfo) => {
          // Keep SDK WASM files in wasm/ directory (no hash for easier path resolution)
          if (
            assetInfo.name &&
            (assetInfo.name.endsWith('.wasm') || assetInfo.name.includes('data_modelling_sdk'))
          ) {
            return 'wasm/[name][extname]';
          }
          // Keep DuckDB WASM files in duckdb/ directory
          if (assetInfo.name && assetInfo.name.includes('duckdb')) {
            return 'duckdb/[name][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
  // Optimize WASM handling
  // Exclude WASM packages from pre-bundling (they need to load WASM files dynamically)
  optimizeDeps: {
    exclude: ['@offenedatenmodellierung/data-modelling-sdk', '@duckdb/duckdb-wasm'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/e2e/**', // Exclude E2E tests (Playwright)
      '**/*.e2e.test.ts',
      '**/*.e2e.test.tsx',
      '**/tests/unit/services/api/**', // Exclude API tests (not relevant for offline mode)
      '**/tests/integration/sync.test.ts', // Exclude sync tests (API-dependent)
      '**/tests/unit/hooks/useWebSocket.test.ts', // Exclude WebSocket tests (API-dependent)
      '**/tests/unit/hooks/useCollaboration.test.ts', // Exclude collaboration tests (API-dependent)
      '**/tests/unit/services/websocket/**', // Exclude WebSocket service tests (API-dependent)
      '**/tests/unit/services/sync/**', // Exclude sync service tests (API-dependent)
      '**/tests/integration/collaboration.test.ts', // Exclude collaboration integration tests (API-dependent)
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.config.ts',
        '**/*.config.js',
        '**/e2e/**', // Exclude E2E tests from coverage
      ],
      thresholds: {
        lines: 95,
        branches: 95,
        functions: 95,
        statements: 95,
      },
    },
  },
});
