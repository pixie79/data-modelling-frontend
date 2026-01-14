#!/usr/bin/env node
/**
 * ODCS Migration Script
 *
 * Migrates legacy ODCS files to the new format:
 * 1. Moves root-level 'id' to the table's schema entry
 * 2. Moves root-level 'tags' to the table's schema entry
 * 3. Optionally merges single-table ODCS files into multi-table files
 *
 * Usage:
 *   node scripts/migrate-odcs.cjs <workspace-path> [options]
 *
 * Options:
 *   --dry-run              Show what would be changed without modifying files
 *   --merge-all            Merge ALL single-table ODCS files into one multi-table file
 *   --group-by=<prefix>    Group files by tag prefix (e.g., --group-by=product)
 *   --group-by-system      Group files by system (reads from .workspace.yaml)
 *   --backup               Create .bak files before modifying
 *   --verbose              Show detailed output
 *
 * Examples:
 *   node scripts/migrate-odcs.cjs /path/to/workspace --dry-run
 *   node scripts/migrate-odcs.cjs /path/to/workspace --backup
 *   node scripts/migrate-odcs.cjs /path/to/workspace --merge-all --dry-run
 *   node scripts/migrate-odcs.cjs /path/to/workspace --group-by=product --dry-run
 *   node scripts/migrate-odcs.cjs /path/to/workspace --group-by=dm_level --dry-run
 *   node scripts/migrate-odcs.cjs /path/to/workspace --group-by-system --dry-run
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Parse command line arguments
const args = process.argv.slice(2);
const workspacePath = args.find((arg) => !arg.startsWith('--'));
const dryRun = args.includes('--dry-run');
const mergeAll = args.includes('--merge-all');
const groupBySystem = args.includes('--group-by-system');
const backup = args.includes('--backup');
const verbose = args.includes('--verbose');

// Parse --group-by=<prefix>
let groupByPrefix = null;
const groupByArg = args.find((arg) => arg.startsWith('--group-by=') && arg !== '--group-by-system');
if (groupByArg) {
  groupByPrefix = groupByArg.split('=')[1];
}

if (!workspacePath) {
  console.error('Usage: node scripts/migrate-odcs.cjs <workspace-path> [options]');
  console.error('');
  console.error('Options:');
  console.error('  --dry-run              Show what would be changed without modifying files');
  console.error('  --merge-all            Merge ALL single-table files into one multi-table file');
  console.error('  --group-by=<prefix>    Group files by tag prefix (e.g., --group-by=product)');
  console.error('  --group-by-system      Group files by system (reads from .workspace.yaml)');
  console.error('  --backup               Create .bak files before modifying');
  console.error('  --verbose              Show detailed output');
  console.error('');
  console.error('Examples:');
  console.error('  node scripts/migrate-odcs.cjs ./odcs --dry-run');
  console.error('  node scripts/migrate-odcs.cjs ./odcs --merge-all');
  console.error('  node scripts/migrate-odcs.cjs ./odcs --group-by=product');
  console.error('  node scripts/migrate-odcs.cjs ./odcs --group-by=dm_level');
  console.error('  node scripts/migrate-odcs.cjs ./workspace --group-by-system --dry-run');
  process.exit(1);
}

function log(message) {
  console.log(message);
}

function verboseLog(message) {
  if (verbose) {
    console.log(`  ${message}`);
  }
}

function findOdcsFiles(dir) {
  const files = [];

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        // Skip node_modules, hidden directories, and ODCS-old
        if (
          !entry.name.startsWith('.') &&
          entry.name !== 'node_modules' &&
          entry.name !== 'ODCS-old'
        ) {
          walk(fullPath);
        }
      } else if (entry.name.endsWith('.odcs.yaml')) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

function getTagValue(contract, prefix) {
  // Check root-level tags
  if (contract.tags && Array.isArray(contract.tags)) {
    for (const tag of contract.tags) {
      if (typeof tag === 'string' && tag.startsWith(`${prefix}:`)) {
        return tag.substring(prefix.length + 1);
      }
    }
  }

  // Check schema-level tags for single-table contracts
  if (contract.schema && contract.schema.length === 1) {
    const schemaEntry = contract.schema[0];
    if (schemaEntry.tags && Array.isArray(schemaEntry.tags)) {
      for (const tag of schemaEntry.tags) {
        if (typeof tag === 'string' && tag.startsWith(`${prefix}:`)) {
          return tag.substring(prefix.length + 1);
        }
      }
    }
  }

  return null;
}

/**
 * Convert legacy 'custom' object to ODCS v3.1.0 'customProperties' array format
 * @param {Object} custom - Legacy custom object like { order: 0, is_foreign_key: true }
 * @returns {Array} Array of { property, value } objects
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
 * Migrate a property/column from legacy 'custom' to 'customProperties' array format
 * @param {Object} prop - The property object
 * @returns {Object} Migrated property
 */
function migratePropertyCustom(prop) {
  if (!prop.custom) return prop;

  // Convert custom to customProperties array
  const customProps = convertCustomToCustomProperties(prop.custom);

  // Merge with existing customProperties if any
  const existingCustomProps = Array.isArray(prop.customProperties) ? prop.customProperties : [];
  const mergedProps = [...existingCustomProps];

  for (const newProp of customProps) {
    if (!mergedProps.find((p) => p.property === newProp.property)) {
      mergedProps.push(newProp);
    }
  }

  // Create new property without 'custom' field
  const { custom, ...rest } = prop;
  return {
    ...rest,
    ...(mergedProps.length > 0 && { customProperties: mergedProps }),
  };
}

/**
 * Migrate all properties in a schema entry from 'custom' to 'customProperties'
 * Also handles schema-level 'status' migration to customProperties
 * @param {Object} schemaEntry - The schema entry with properties array
 * @returns {Object} Migrated schema entry
 */
function migrateSchemaProperties(schemaEntry) {
  // Start with the schema entry, but we'll handle status separately
  const { status, ...rest } = schemaEntry;

  // Build customProperties array
  let customProperties = Array.isArray(schemaEntry.customProperties)
    ? [...schemaEntry.customProperties]
    : [];

  // Migrate status to customProperties if present
  if (status && !customProperties.find((p) => p.property === 'status')) {
    customProperties.push({ property: 'status', value: status });
  }

  // Migrate properties if present
  const migratedProperties =
    schemaEntry.properties && Array.isArray(schemaEntry.properties)
      ? schemaEntry.properties.map((prop) => migratePropertyCustom(prop))
      : schemaEntry.properties;

  return {
    ...rest,
    ...(migratedProperties && { properties: migratedProperties }),
    ...(customProperties.length > 0 && { customProperties }),
  };
}

function migrateOdcsFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let contract;

  try {
    contract = yaml.load(content);
  } catch (e) {
    console.error(`  ERROR: Failed to parse ${filePath}: ${e.message}`);
    return null;
  }

  if (!contract || typeof contract !== 'object') {
    verboseLog(`Skipping ${filePath}: Not a valid ODCS contract`);
    return null;
  }

  let modified = false;
  const changes = [];

  // Check if this is an ODCS contract with schema
  if (!contract.schema || !Array.isArray(contract.schema) || contract.schema.length === 0) {
    verboseLog(`Skipping ${filePath}: No schema array found`);
    return null;
  }

  // For single-table contracts, migrate root-level fields to schema entry
  if (contract.schema.length === 1) {
    const schemaEntry = contract.schema[0];

    // 1. Migrate root 'id' to schema entry
    if (contract.id && !schemaEntry.id) {
      schemaEntry.id = contract.id;
      changes.push(`Moved root 'id' (${contract.id}) to schema entry`);
      modified = true;
    }

    // 2. Migrate root 'tags' to schema entry
    if (contract.tags && Array.isArray(contract.tags) && contract.tags.length > 0) {
      if (!schemaEntry.tags || schemaEntry.tags.length === 0) {
        schemaEntry.tags = contract.tags;
        changes.push(`Moved ${contract.tags.length} root-level tag(s) to schema entry`);
        // Remove from root level
        delete contract.tags;
        modified = true;
      } else {
        // Merge tags (avoid duplicates)
        const existingTags = new Set(schemaEntry.tags);
        let added = 0;
        for (const tag of contract.tags) {
          if (!existingTags.has(tag)) {
            schemaEntry.tags.push(tag);
            added++;
          }
        }
        if (added > 0) {
          changes.push(`Merged ${added} root-level tag(s) into schema entry`);
          delete contract.tags;
          modified = true;
        }
      }
    }

    // 3. Migrate root 'customProperties' to schema entry
    if (
      contract.customProperties &&
      Array.isArray(contract.customProperties) &&
      contract.customProperties.length > 0
    ) {
      if (!schemaEntry.customProperties || schemaEntry.customProperties.length === 0) {
        schemaEntry.customProperties = contract.customProperties;
        changes.push(
          `Moved ${contract.customProperties.length} root-level customProperties to schema entry`
        );
        delete contract.customProperties;
        modified = true;
      }
    }
  }

  // Migrate 'custom' to 'customProperties' on ALL schema entries (single or multi-table)
  // Also migrate schema-level 'status' to customProperties (status is contract-level only in ODCS spec)
  for (let i = 0; i < contract.schema.length; i++) {
    const schemaEntry = contract.schema[i];
    const schemaName = schemaEntry.name || i;

    // Check what needs migration
    const hasStatus = !!schemaEntry.status;
    let propsWithCustom = 0;
    if (schemaEntry.properties && Array.isArray(schemaEntry.properties)) {
      for (const prop of schemaEntry.properties) {
        if (prop.custom) {
          propsWithCustom++;
        }
      }
    }

    // If anything needs migration, call migrateSchemaProperties
    if (hasStatus || propsWithCustom > 0) {
      const statusValue = schemaEntry.status;
      contract.schema[i] = migrateSchemaProperties(schemaEntry);

      if (hasStatus) {
        changes.push(
          `Moved schema-level 'status' (${statusValue}) to customProperties in schema '${schemaName}'`
        );
        modified = true;
      }
      if (propsWithCustom > 0) {
        changes.push(
          `Migrated 'custom' to 'customProperties' on ${propsWithCustom} properties in schema '${schemaName}'`
        );
        modified = true;
      }
    }
  }

  // Ensure contract has root-level 'id' (required by ODCS spec)
  if (!contract.id) {
    contract.id = require('crypto').randomUUID();
    changes.push(`Added missing contract-level 'id': ${contract.id}`);
    modified = true;
  }

  if (!modified) {
    verboseLog(`No changes needed for ${filePath}`);
    return null;
  }

  return {
    filePath,
    contract,
    changes,
  };
}

function parseOdcsFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let contract;

  try {
    contract = yaml.load(content);
  } catch (e) {
    console.error(`  ERROR: Failed to parse ${filePath}: ${e.message}`);
    return null;
  }

  if (!contract || typeof contract !== 'object') {
    return null;
  }

  if (!contract.schema || !Array.isArray(contract.schema) || contract.schema.length === 0) {
    return null;
  }

  return {
    filePath,
    contract,
    isSingleTable: contract.schema.length === 1,
  };
}

function writeOdcsFile(filePath, contract, createBackup) {
  if (createBackup) {
    const backupPath = filePath + '.bak';
    fs.copyFileSync(filePath, backupPath);
    verboseLog(`Created backup: ${backupPath}`);
  }

  const yamlContent = yaml.dump(contract, {
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
    quotingType: '"',
  });

  fs.writeFileSync(filePath, yamlContent, 'utf8');
}

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function moveToOldFolder(filePath) {
  const odcsDir = path.dirname(filePath);
  const oldFolder = path.join(odcsDir, 'ODCS-old');
  ensureDirectoryExists(oldFolder);

  const fileName = path.basename(filePath);
  const destPath = path.join(oldFolder, fileName);

  fs.renameSync(filePath, destPath);
  return destPath;
}

/**
 * Create a merged contract from multiple single-table files
 * @param {Array} files - Array of parsed ODCS files
 * @param {string} groupName - Name for the merged contract
 * @param {string} [systemId] - Optional system ID to use as contract.id (for system-based merging)
 */
function createMergedContract(files, groupName, systemId = null) {
  const mergedSchemas = [];

  for (const file of files) {
    let schemaEntry = { ...file.contract.schema[0] };

    // Move root-level id to schema entry if not already there
    // This preserves the table's original ID for relationship linking
    if (file.contract.id && !schemaEntry.id) {
      schemaEntry.id = file.contract.id;
    }

    // Move root-level tags to schema entry if not already there
    if (file.contract.tags && Array.isArray(file.contract.tags) && file.contract.tags.length > 0) {
      if (!schemaEntry.tags || schemaEntry.tags.length === 0) {
        schemaEntry.tags = file.contract.tags;
      }
    }

    // Move root-level customProperties to schema entry if not already there
    if (
      file.contract.customProperties &&
      Array.isArray(file.contract.customProperties) &&
      file.contract.customProperties.length > 0
    ) {
      if (!schemaEntry.customProperties || schemaEntry.customProperties.length === 0) {
        schemaEntry.customProperties = file.contract.customProperties;
      }
    }

    // Migrate 'custom' to 'customProperties' on all properties
    schemaEntry = migrateSchemaProperties(schemaEntry);

    mergedSchemas.push(schemaEntry);
  }

  // Use the first file as the base for contract metadata
  const baseContract = files[0].contract;

  // Contract ID priority:
  // 1. systemId (when merging by system - ensures tables link back to their system on load)
  // 2. Generate a new UUID (for other merge modes)
  const contractId = systemId || require('crypto').randomUUID();

  return {
    apiVersion: baseContract.apiVersion || 'v3.1.0',
    kind: baseContract.kind || 'DataContract',
    id: contractId,
    version: baseContract.version || '1.0.0',
    status: baseContract.status || 'active',
    name: groupName,
    description: {
      purpose: `Multi-table contract containing ${files.length} tables`,
    },
    schema: mergedSchemas,
  };
}

function mergeAllContracts(parsedFiles, workspaceDir) {
  const singleTableFiles = parsedFiles.filter((f) => f.isSingleTable);

  if (singleTableFiles.length < 2) {
    return [];
  }

  // Sort files by table name for consistent ordering
  singleTableFiles.sort((a, b) => {
    const nameA = a.contract.schema[0]?.name || '';
    const nameB = b.contract.schema[0]?.name || '';
    return nameA.localeCompare(nameB);
  });

  const mergedContract = createMergedContract(singleTableFiles, 'merged_tables');

  // Determine the output path
  const odcsDir = path.dirname(singleTableFiles[0].filePath);
  const outputPath = path.join(odcsDir, 'merged_tables.odcs.yaml');

  return [
    {
      groupName: 'all',
      sourceFiles: singleTableFiles.map((f) => f.filePath),
      outputPath,
      mergedContract,
      tableCount: singleTableFiles.length,
    },
  ];
}

function mergeContractsByTagPrefix(parsedFiles, prefix, workspaceDir) {
  // Group files by tag value
  const groups = new Map();

  for (const parsed of parsedFiles) {
    if (!parsed.isSingleTable) {
      verboseLog(`Skipping ${parsed.filePath}: Already multi-table contract`);
      continue;
    }

    const tagValue = getTagValue(parsed.contract, prefix);
    if (!tagValue) {
      verboseLog(`Skipping ${parsed.filePath}: No ${prefix}:* tag found`);
      continue;
    }

    if (!groups.has(tagValue)) {
      groups.set(tagValue, []);
    }
    groups.get(tagValue).push(parsed);
  }

  const mergeResults = [];

  for (const [tagValue, files] of groups) {
    if (files.length < 2) {
      verboseLog(`Group ${prefix}:${tagValue}: Only ${files.length} file(s), skipping merge`);
      continue;
    }

    // Sort files by table name for consistent ordering
    files.sort((a, b) => {
      const nameA = a.contract.schema[0]?.name || '';
      const nameB = b.contract.schema[0]?.name || '';
      return nameA.localeCompare(nameB);
    });

    const groupName = `${prefix}_${tagValue}_tables`;
    const mergedContract = createMergedContract(files, groupName);

    // Determine the output path
    const odcsDir = path.dirname(files[0].filePath);
    const safeTagValue = tagValue.replace(/[^a-zA-Z0-9_-]/g, '_');
    const outputFileName = `${prefix}_${safeTagValue}.odcs.yaml`;
    const outputPath = path.join(odcsDir, outputFileName);

    mergeResults.push({
      groupName: `${prefix}:${tagValue}`,
      sourceFiles: files.map((f) => f.filePath),
      outputPath,
      mergedContract,
      tableCount: files.length,
    });
  }

  return mergeResults;
}

function findWorkspaceFiles(dir) {
  const files = [];

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        // Skip node_modules, hidden directories, and ODCS-old
        if (
          !entry.name.startsWith('.') &&
          entry.name !== 'node_modules' &&
          entry.name !== 'ODCS-old'
        ) {
          walk(fullPath);
        }
      } else if (entry.name.endsWith('.workspace.yaml')) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

function parseSystemsFromWorkspace(workspaceDir) {
  const workspaceFiles = findWorkspaceFiles(workspaceDir);
  const systems = [];
  let workspaceName = null;

  for (const filePath of workspaceFiles) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const workspace = yaml.load(content);

      if (workspace && typeof workspace === 'object') {
        // Capture workspace name
        if (workspace.name && !workspaceName) {
          workspaceName = workspace.name;
        }

        if (Array.isArray(workspace.domains)) {
          // Extract systems from each domain
          for (const domain of workspace.domains) {
            if (Array.isArray(domain.systems)) {
              for (const system of domain.systems) {
                systems.push({
                  workspaceFile: filePath,
                  workspaceName: workspace.name,
                  domainId: domain.id,
                  domainName: domain.name,
                  id: system.id,
                  name: system.name,
                  tableIds: system.table_ids || [],
                });
              }
            }
          }
        }
      }
    } catch (e) {
      verboseLog(`Failed to parse workspace file ${filePath}: ${e.message}`);
    }
  }

  return systems;
}

function getTableIdFromContract(contract) {
  // Get the table ID from schema entry or root-level id
  if (contract.schema && contract.schema.length === 1) {
    const schemaEntry = contract.schema[0];
    return schemaEntry.id || contract.id || null;
  }
  return contract.id || null;
}

function mergeContractsBySystem(parsedFiles, systems, workspaceDir) {
  // Build a map of table_id -> system
  const tableToSystemMap = new Map();
  for (const sys of systems) {
    for (const tableId of sys.tableIds) {
      tableToSystemMap.set(tableId, sys);
    }
  }

  // Group files by system
  const groups = new Map();
  const unassigned = [];

  for (const parsed of parsedFiles) {
    if (!parsed.isSingleTable) {
      verboseLog(`Skipping ${parsed.filePath}: Already multi-table contract`);
      continue;
    }

    const tableId = getTableIdFromContract(parsed.contract);
    if (!tableId) {
      verboseLog(`Skipping ${parsed.filePath}: No table ID found`);
      unassigned.push(parsed);
      continue;
    }

    const system = tableToSystemMap.get(tableId);
    if (!system) {
      verboseLog(`Skipping ${parsed.filePath}: Table ${tableId} not assigned to any system`);
      unassigned.push(parsed);
      continue;
    }

    if (!groups.has(system.id)) {
      groups.set(system.id, { system, files: [] });
    }
    groups.get(system.id).files.push(parsed);
  }

  if (unassigned.length > 0) {
    log(`\nNote: ${unassigned.length} table(s) not assigned to any system:`);
    for (const parsed of unassigned) {
      const tableId = getTableIdFromContract(parsed.contract);
      const tableName = parsed.contract.schema?.[0]?.name || 'unknown';
      log(`  - ${tableName} (id: ${tableId || 'none'})`);
    }
  }

  const mergeResults = [];

  for (const [systemId, group] of groups) {
    const { system, files } = group;

    if (files.length < 1) {
      verboseLog(`System ${system.name}: No files, skipping`);
      continue;
    }

    // Sort files by table name for consistent ordering
    files.sort((a, b) => {
      const nameA = a.contract.schema[0]?.name || '';
      const nameB = b.contract.schema[0]?.name || '';
      return nameA.localeCompare(nameB);
    });

    // Pass system.id as the contract ID so tables can be linked back to this system on load
    const mergedContract = createMergedContract(files, system.name, system.id);

    // Build filename: {workspace}_{domain}_{system}.odcs.yaml
    // Convert names to lowercase with underscores (matching the loader's expected format)
    const safeWorkspaceName = (system.workspaceName || 'workspace')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_');
    const safeDomainName = (system.domainName || 'domain').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const safeSystemName = system.name.toLowerCase().replace(/[^a-z0-9]/g, '_');

    // Determine the output path - use same directory as the first file
    const odcsDir = path.dirname(files[0].filePath);
    const outputFileName = `${safeWorkspaceName}_${safeDomainName}_${safeSystemName}.odcs.yaml`;
    const outputPath = path.join(odcsDir, outputFileName);

    mergeResults.push({
      groupName: system.name,
      systemId: system.id,
      sourceFiles: files.map((f) => f.filePath),
      outputPath,
      mergedContract,
      tableCount: files.length,
    });
  }

  return mergeResults;
}

function runMigration() {
  log('');
  log('ODCS Migration Script');
  log('=====================');
  log('');

  // Validate workspace path
  if (!fs.existsSync(workspacePath)) {
    console.error(`ERROR: Workspace path does not exist: ${workspacePath}`);
    process.exit(1);
  }

  log(`Workspace: ${workspacePath}`);
  log(`Mode: ${dryRun ? 'DRY RUN (no files will be modified)' : 'LIVE'}`);
  if (backup) log('Backups: Enabled');
  if (mergeAll) log('Merge: Will merge ALL single-table files into one');
  if (groupByPrefix) log(`Merge: Will group by tag prefix "${groupByPrefix}:"`);
  if (groupBySystem) log('Merge: Will group by system (from .workspace.yaml files)');
  log('');

  // Find all ODCS files
  log('Scanning for ODCS files...');
  const odcsFiles = findOdcsFiles(workspacePath);
  log(`Found ${odcsFiles.length} ODCS file(s)`);
  log('');

  if (odcsFiles.length === 0) {
    log('No ODCS files found. Nothing to migrate.');
    return;
  }

  if (mergeAll || groupByPrefix || groupBySystem) {
    // Merge mode: combine files
    log('Parsing ODCS files...');
    const parsedFiles = [];
    for (const filePath of odcsFiles) {
      const parsed = parseOdcsFile(filePath);
      if (parsed) {
        parsedFiles.push(parsed);
      }
    }

    log(`Parsed ${parsedFiles.length} valid ODCS file(s)`);
    log('');

    let mergeResults;
    if (mergeAll) {
      log('Merging all single-table files...');
      mergeResults = mergeAllContracts(parsedFiles, workspacePath);
    } else if (groupBySystem) {
      log('Loading system definitions from workspace file(s)...');
      const systems = parseSystemsFromWorkspace(workspacePath);
      log(`Found ${systems.length} system(s)`);
      for (const sys of systems) {
        verboseLog(`  - ${sys.name} [${sys.domainName}] (${sys.tableIds.length} tables)`);
      }
      log('');
      log('Grouping ODCS files by system...');
      mergeResults = mergeContractsBySystem(parsedFiles, systems, workspacePath);
    } else {
      log(`Grouping by tag prefix "${groupByPrefix}:"...`);
      mergeResults = mergeContractsByTagPrefix(parsedFiles, groupByPrefix, workspacePath);
    }

    if (mergeResults.length === 0) {
      log('No files found to merge.');
      if (groupByPrefix) {
        log(`Make sure files have tags like "${groupByPrefix}:<value>"`);
      }
      if (groupBySystem) {
        log('Make sure .workspace.yaml file exists with domains[].systems[].table_ids');
      }
      return;
    }

    log('');
    log('Merge Plan');
    log('----------');

    for (const result of mergeResults) {
      const relativePath = path.relative(workspacePath, result.outputPath);
      log(`\n📦 Group: ${result.groupName}`);
      log(`   Output: ${relativePath}`);
      log(`   Tables: ${result.tableCount}`);
      log('   Source files:');
      for (const srcFile of result.sourceFiles) {
        const relSrcPath = path.relative(workspacePath, srcFile);
        log(`     - ${relSrcPath}`);
      }
    }

    log('');

    if (dryRun) {
      log('DRY RUN complete. No files were modified.');
      log('Run without --dry-run to apply changes.');
    } else {
      log('Applying merge...');

      for (const result of mergeResults) {
        // Write the merged contract
        writeOdcsFile(result.outputPath, result.mergedContract, false);
        const relativePath = path.relative(workspacePath, result.outputPath);
        log(`  ✓ Created: ${relativePath}`);

        // Move source files to ODCS-old folder
        for (const srcFile of result.sourceFiles) {
          const movedTo = moveToOldFolder(srcFile);
          const relSrcPath = path.relative(workspacePath, srcFile);
          const relDestPath = path.relative(workspacePath, movedTo);
          verboseLog(`Moved ${relSrcPath} -> ${relDestPath}`);
        }

        log(`  ✓ Moved ${result.sourceFiles.length} source file(s) to ODCS-old/`);
      }

      log('');
      log('Merge complete!');
      log('');
      log('IMPORTANT: Update your workspace.yaml to reference the new merged ODCS files.');
    }
  } else {
    // Standard migration mode: update files in place
    const results = [];
    for (const filePath of odcsFiles) {
      const relativePath = path.relative(workspacePath, filePath);
      verboseLog(`Processing: ${relativePath}`);

      const result = migrateOdcsFile(filePath);
      if (result) {
        results.push(result);
      }
    }

    // Summary
    log('');
    log('Migration Summary');
    log('-----------------');

    if (results.length === 0) {
      log('No files need migration. All ODCS files are already in the correct format.');
      return;
    }

    log(`Files to migrate: ${results.length}`);
    log('');

    for (const result of results) {
      const relativePath = path.relative(workspacePath, result.filePath);
      log(`📄 ${relativePath}`);
      for (const change of result.changes) {
        log(`   ✓ ${change}`);
      }
    }

    log('');

    if (dryRun) {
      log('DRY RUN complete. No files were modified.');
      log('Run without --dry-run to apply changes.');
    } else {
      log('Applying changes...');
      for (const result of results) {
        writeOdcsFile(result.filePath, result.contract, backup);
        const relativePath = path.relative(workspacePath, result.filePath);
        log(`  ✓ Updated: ${relativePath}`);
      }
      log('');
      log('Migration complete!');
    }
  }
}

// Check if js-yaml is available
try {
  require.resolve('js-yaml');
} catch (e) {
  console.error('ERROR: js-yaml package is required but not found.');
  console.error('Run this script from the frontend directory where node_modules is available:');
  console.error('  cd frontend && node scripts/migrate-odcs.cjs <workspace-path>');
  process.exit(1);
}

runMigration();
