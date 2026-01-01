import { defineConfig } from 'vite';
import path from 'path';

// Vite config for Electron build
export default defineConfig({
  build: {
    outDir: 'dist-electron',
    lib: {
      entry: {
        main: path.resolve(__dirname, 'electron/main.ts'),
        preload: path.resolve(__dirname, 'electron/preload.ts'),
      },
      formats: ['cjs'],
    },
    rollupOptions: {
      external: ['electron', 'fs/promises', 'path', 'url', 'module'],
      output: {
        entryFileNames: '[name].cjs', // Use .cjs extension for CommonJS in ES module project
      },
    },
    target: 'node18',
  },
});

