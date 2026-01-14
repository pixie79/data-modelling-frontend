#!/usr/bin/env node
/**
 * Rebuild Examples Script
 *
 * Scans the public/examples directory and rebuilds the index.json file.
 * Also optionally runs ODCS migration on example files.
 *
 * Usage:
 *   node scripts/rebuild-examples.cjs [options]
 *
 * Options:
 *   --migrate    Run ODCS migration on example files (custom -> customProperties)
 *   --dry-run    Show what would be changed without modifying files
 *   --verbose    Show detailed output
 *
 * Examples:
 *   node scripts/rebuild-examples.cjs
 *   node scripts/rebuild-examples.cjs --migrate
 *   node scripts/rebuild-examples.cjs --migrate --dry-run
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Parse command line arguments
const args = process.argv.slice(2);
const migrate = args.includes('--migrate');
const dryRun = args.includes('--dry-run');
const verbose = args.includes('--verbose');

const EXAMPLES_DIR = path.join(__dirname, '..', 'public', 'examples');
const INDEX_FILE = path.join(EXAMPLES_DIR, 'index.json');

function log(message) {
  console.log(message);
}

function verboseLog(message) {
  if (verbose) {
    console.log(`  ${message}`);
  }
}

/**
 * Get all files in a directory recursively
 */
function getFilesRecursive(dir, baseDir = dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      // Skip hidden directories and special folders
      if (!entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'tmp') {
        files.push(...getFilesRecursive(fullPath, baseDir));
      }
    } else {
      // Include workspace, ODCS, ODPS, ADR, KB, and BPMN files
      if (
        entry.name.endsWith('.workspace.yaml') ||
        entry.name.endsWith('.odcs.yaml') ||
        entry.name.endsWith('.odps.yaml') ||
        entry.name.endsWith('.adr.yaml') ||
        entry.name.endsWith('.kb.yaml') ||
        entry.name.endsWith('.bpmn')
      ) {
        files.push(relativePath);
      }
    }
  }

  return files;
}

/**
 * Parse workspace file to extract metadata
 */
function parseWorkspaceMetadata(workspacePath) {
  try {
    const content = fs.readFileSync(workspacePath, 'utf8');
    const workspace = yaml.load(content);
    return {
      name: workspace.name || path.basename(path.dirname(workspacePath)),
      description: workspace.description || '',
    };
  } catch (error) {
    console.warn(`Failed to parse workspace: ${workspacePath}`, error.message);
    return { name: path.basename(path.dirname(workspacePath)), description: '' };
  }
}

/**
 * Count files by type for features list
 */
function countFileTypes(files) {
  const counts = {
    odcs: 0,
    odps: 0,
    bpmn: 0,
    kb: 0,
    adr: 0,
  };

  for (const file of files) {
    if (file.endsWith('.odcs.yaml')) counts.odcs++;
    else if (file.endsWith('.odps.yaml')) counts.odps++;
    else if (file.endsWith('.bpmn')) counts.bpmn++;
    else if (file.endsWith('.kb.yaml')) counts.kb++;
    else if (file.endsWith('.adr.yaml')) counts.adr++;
  }

  return counts;
}

/**
 * Generate features list from file counts
 */
function generateFeatures(counts) {
  const features = [];
  if (counts.odcs > 0) features.push(`${counts.odcs} ODCS data contracts`);
  if (counts.odps > 0) features.push(`${counts.odps} ODPS data products`);
  if (counts.bpmn > 0) features.push(`${counts.bpmn} BPMN processes`);
  if (counts.kb > 0) features.push(`${counts.kb} Knowledge articles`);
  if (counts.adr > 0) features.push(`${counts.adr} Architecture decision records`);
  return features;
}

/**
 * Convert legacy 'custom' to 'customProperties' array format
 */
function convertCustomToCustomProperties(custom) {
  if (!custom || typeof custom !== 'object') return [];
  const props = [];
  for (const [key, value] of Object.entries(custom)) {
    props.push({ property: key, value });
  }
  return props;
}

/**
 * Migrate a property from legacy 'custom' to 'customProperties'
 */
function migrateProperty(prop) {
  if (!prop.custom) return prop;

  const customProps = convertCustomToCustomProperties(prop.custom);
  const existingCustomProps = Array.isArray(prop.customProperties) ? [...prop.customProperties] : [];

  for (const newProp of customProps) {
    if (!existingCustomProps.find((p) => p.property === newProp.property)) {
      existingCustomProps.push(newProp);
    }
  }

  const { custom, ...rest } = prop;
  return {
    ...rest,
    ...(existingCustomProps.length > 0 && { customProperties: existingCustomProps }),
  };
}

/**
 * Migrate a schema entry (status and properties)
 */
function migrateSchemaEntry(schemaEntry) {
  const { status, ...rest } = schemaEntry;

  let customProperties = Array.isArray(schemaEntry.customProperties)
    ? [...schemaEntry.customProperties]
    : [];

  // Migrate status to customProperties
  if (status && !customProperties.find((p) => p.property === 'status')) {
    customProperties.push({ property: 'status', value: status });
  }

  // Migrate properties
  const migratedProperties =
    schemaEntry.properties && Array.isArray(schemaEntry.properties)
      ? schemaEntry.properties.map((prop) => migrateProperty(prop))
      : schemaEntry.properties;

  return {
    ...rest,
    ...(migratedProperties && { properties: migratedProperties }),
    ...(customProperties.length > 0 && { customProperties }),
  };
}

/**
 * Migrate an ODCS file
 */
function migrateOdcsFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let contract;

  try {
    contract = yaml.load(content);
  } catch (error) {
    console.warn(`Failed to parse ${filePath}: ${error.message}`);
    return { modified: false };
  }

  if (!contract || !contract.schema || !Array.isArray(contract.schema)) {
    return { modified: false };
  }

  let modified = false;
  const changes = [];

  // Ensure contract has ID
  if (!contract.id) {
    contract.id = require('crypto').randomUUID();
    changes.push('Added contract ID');
    modified = true;
  }

  // Migrate each schema entry
  for (let i = 0; i < contract.schema.length; i++) {
    const schemaEntry = contract.schema[i];
    const hasStatus = !!schemaEntry.status;
    let propsWithCustom = 0;

    if (schemaEntry.properties && Array.isArray(schemaEntry.properties)) {
      for (const prop of schemaEntry.properties) {
        if (prop.custom) propsWithCustom++;
      }
    }

    if (hasStatus || propsWithCustom > 0) {
      contract.schema[i] = migrateSchemaEntry(schemaEntry);
      if (hasStatus) changes.push(`Migrated status in schema '${schemaEntry.name || i}'`);
      if (propsWithCustom > 0)
        changes.push(`Migrated ${propsWithCustom} custom properties in schema '${schemaEntry.name || i}'`);
      modified = true;
    }
  }

  if (modified && !dryRun) {
    const yamlContent = yaml.dump(contract, {
      lineWidth: -1,
      noRefs: true,
      sortKeys: false,
      quotingType: '"',
    });
    fs.writeFileSync(filePath, yamlContent, 'utf8');
  }

  return { modified, changes };
}

/**
 * Scan example directories and build index
 */
function buildExamplesIndex() {
  const examples = [];

  // Get all subdirectories in examples folder
  const entries = fs.readdirSync(EXAMPLES_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'tmp' || entry.name.startsWith('.')) continue;

    const exampleDir = path.join(EXAMPLES_DIR, entry.name);
    const files = getFilesRecursive(exampleDir, exampleDir);

    // Find workspace file
    const workspaceFile = files.find((f) => f.endsWith('.workspace.yaml'));
    if (!workspaceFile) {
      verboseLog(`Skipping ${entry.name}: No workspace file found`);
      continue;
    }

    // Parse workspace metadata
    const metadata = parseWorkspaceMetadata(path.join(exampleDir, workspaceFile));

    // Count file types
    const counts = countFileTypes(files);
    const features = generateFeatures(counts);

    // Sort files: workspace first, then by type and name
    const sortedFiles = [workspaceFile, ...files.filter((f) => f !== workspaceFile).sort()];

    examples.push({
      id: entry.name,
      name: metadata.name,
      description: metadata.description,
      folder: entry.name,
      workspaceFile,
      files: sortedFiles,
      features,
    });

    verboseLog(`Found example: ${entry.name} with ${files.length} files`);
  }

  return { examples };
}

/**
 * Main function
 */
function main() {
  log('');
  log('Rebuild Examples Script');
  log('=======================');
  log('');

  if (!fs.existsSync(EXAMPLES_DIR)) {
    console.error(`ERROR: Examples directory not found: ${EXAMPLES_DIR}`);
    process.exit(1);
  }

  log(`Examples directory: ${EXAMPLES_DIR}`);
  log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  if (migrate) log('Migration: Enabled (custom -> customProperties)');
  log('');

  // Run migration if requested
  if (migrate) {
    log('Running ODCS migration...');
    const odcsFiles = [];

    // Find all ODCS files
    const entries = fs.readdirSync(EXAMPLES_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === 'tmp' || entry.name.startsWith('.')) continue;

      const exampleDir = path.join(EXAMPLES_DIR, entry.name);
      const files = getFilesRecursive(exampleDir, exampleDir);

      for (const file of files) {
        if (file.endsWith('.odcs.yaml')) {
          odcsFiles.push(path.join(exampleDir, file));
        }
      }
    }

    log(`Found ${odcsFiles.length} ODCS files`);

    let migratedCount = 0;
    for (const filePath of odcsFiles) {
      const result = migrateOdcsFile(filePath);
      if (result.modified) {
        migratedCount++;
        const relativePath = path.relative(EXAMPLES_DIR, filePath);
        log(`  ✓ ${relativePath}`);
        result.changes.forEach((change) => verboseLog(`    - ${change}`));
      }
    }

    if (migratedCount === 0) {
      log('  No files needed migration');
    } else {
      log(`  Migrated ${migratedCount} files`);
    }
    log('');
  }

  // Build index
  log('Building examples index...');
  const index = buildExamplesIndex();

  log(`Found ${index.examples.length} example(s):`);
  for (const example of index.examples) {
    log(`  - ${example.name} (${example.files.length} files)`);
  }
  log('');

  // Write index file
  if (dryRun) {
    log('DRY RUN: Would write index.json:');
    log(JSON.stringify(index, null, 2));
  } else {
    fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2) + '\n', 'utf8');
    log(`✓ Written: ${INDEX_FILE}`);
  }

  log('');
  log('Done!');
}

// Check dependencies
try {
  require.resolve('js-yaml');
} catch (e) {
  console.error('ERROR: js-yaml package is required.');
  console.error('Run this script from the frontend directory where node_modules is available.');
  process.exit(1);
}

main();
