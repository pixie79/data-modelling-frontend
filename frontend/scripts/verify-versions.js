#!/usr/bin/env node
/**
 * Version Verification Script
 *
 * Verifies that all WASM dependencies are installed with the correct versions
 * and that WASM files are present in the expected locations.
 *
 * Expected versions:
 * - DuckDB-WASM: 1.29.0 (DuckDB 1.4.3)
 * - SDK WASM: 1.13.2
 *
 * Usage: npm run verify:versions
 */

import { readFileSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FRONTEND_DIR = join(__dirname, '..');

// Expected versions
const EXPECTED_VERSIONS = {
  duckdb: '1.29.0',
  sdk: '1.13.2',
};

// WASM file locations
const WASM_PATHS = {
  duckdb: {
    dir: join(FRONTEND_DIR, 'public/duckdb'),
    files: ['duckdb-eh.wasm', 'duckdb-browser-eh.worker.js'],
    optional: ['duckdb-mvp.wasm', 'duckdb-browser-mvp.worker.js'],
  },
  sdk: {
    dir: join(FRONTEND_DIR, 'public/wasm'),
    files: ['data_modelling_sdk.js', 'data_modelling_sdk_bg.wasm'],
  },
};

let hasErrors = false;
let hasWarnings = false;

function log(type, message) {
  const prefix = {
    info: '\x1b[34mINFO\x1b[0m',
    ok: '\x1b[32m OK \x1b[0m',
    warn: '\x1b[33mWARN\x1b[0m',
    error: '\x1b[31mFAIL\x1b[0m',
  };
  console.log(`[${prefix[type]}] ${message}`);
  if (type === 'error') hasErrors = true;
  if (type === 'warn') hasWarnings = true;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function checkPackageVersion(packageName, expectedVersion) {
  try {
    const pkgPath = join(FRONTEND_DIR, 'node_modules', packageName, 'package.json');
    if (!existsSync(pkgPath)) {
      log('error', `Package ${packageName} is not installed`);
      return false;
    }

    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    if (pkg.version === expectedVersion) {
      log('ok', `${packageName}@${pkg.version} (expected ${expectedVersion})`);
      return true;
    } else {
      log('error', `${packageName}@${pkg.version} (expected ${expectedVersion})`);
      return false;
    }
  } catch (err) {
    log('error', `Failed to read ${packageName} version: ${err.message}`);
    return false;
  }
}

function checkWasmFiles(name, config) {
  const { dir, files, optional = [] } = config;

  if (!existsSync(dir)) {
    log('error', `${name} WASM directory missing: ${dir}`);
    return false;
  }

  let allRequired = true;

  // Check required files
  for (const file of files) {
    const filePath = join(dir, file);
    if (existsSync(filePath)) {
      const stats = statSync(filePath);
      log('ok', `${file} (${formatSize(stats.size)})`);
    } else {
      log('error', `Missing required file: ${file}`);
      allRequired = false;
    }
  }

  // Check optional files
  for (const file of optional) {
    const filePath = join(dir, file);
    if (existsSync(filePath)) {
      const stats = statSync(filePath);
      log('ok', `${file} (${formatSize(stats.size)}) [optional]`);
    } else {
      log('warn', `Optional file missing: ${file}`);
    }
  }

  return allRequired;
}

function checkSdkVersion() {
  // Try to read SDK version from package.json in wasm directory
  const sdkPkgPath = join(WASM_PATHS.sdk.dir, 'package.json');
  if (existsSync(sdkPkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(sdkPkgPath, 'utf8'));
      if (pkg.version === EXPECTED_VERSIONS.sdk) {
        log('ok', `SDK WASM version: ${pkg.version} (expected ${EXPECTED_VERSIONS.sdk})`);
        return true;
      } else {
        log('error', `SDK WASM version: ${pkg.version} (expected ${EXPECTED_VERSIONS.sdk})`);
        return false;
      }
    } catch (err) {
      log('warn', `Could not parse SDK version: ${err.message}`);
    }
  } else {
    log('warn', 'SDK package.json not found, cannot verify version');
  }
  return true; // Don't fail if we can't verify
}

console.log('\n========================================');
console.log('  WASM Version Verification');
console.log('========================================\n');

console.log('Expected Versions:');
console.log(`  - DuckDB-WASM: ${EXPECTED_VERSIONS.duckdb}`);
console.log(`  - SDK WASM:    ${EXPECTED_VERSIONS.sdk}`);
console.log('');

// Check DuckDB-WASM npm package
console.log('--- DuckDB-WASM Package ---');
checkPackageVersion('@duckdb/duckdb-wasm', EXPECTED_VERSIONS.duckdb);
console.log('');

// Check DuckDB-WASM files
console.log('--- DuckDB-WASM Files ---');
checkWasmFiles('DuckDB', WASM_PATHS.duckdb);
console.log('');

// Check SDK WASM files
console.log('--- SDK WASM Files ---');
checkWasmFiles('SDK', WASM_PATHS.sdk);
checkSdkVersion();
console.log('');

// Summary
console.log('========================================');
if (hasErrors) {
  console.log('\x1b[31m  VERIFICATION FAILED\x1b[0m');
  console.log('  Please fix the errors above.');
  console.log('');
  console.log('  To fix DuckDB-WASM issues:');
  console.log('    npm install @duckdb/duckdb-wasm@1.29.0');
  console.log('    npm run build:duckdb');
  console.log('');
  console.log('  To fix SDK WASM issues:');
  console.log('    npm run build:wasm');
  console.log('========================================\n');
  process.exit(1);
} else if (hasWarnings) {
  console.log('\x1b[33m  VERIFICATION PASSED WITH WARNINGS\x1b[0m');
  console.log('========================================\n');
  process.exit(0);
} else {
  console.log('\x1b[32m  VERIFICATION PASSED\x1b[0m');
  console.log('========================================\n');
  process.exit(0);
}
