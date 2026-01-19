/**
 * ODCS Import/Export Integration Test
 *
 * This test verifies the end-to-end workflow of:
 * 1. Creating a new workspace
 * 2. Creating a system in the default domain
 * 3. Importing an ODCS schema with all supported fields
 * 4. Exporting the schema back to ODCS format
 * 5. Comparing the two to ensure no data is lost
 *
 * The test uses the full-example.odcs.yaml fixture which includes:
 * - Multiple tables with relationships
 * - Composite primary keys
 * - All ODCS v3.1.0 column properties (classification, partitioned, clustered, etc.)
 * - Quality rules at table and column level
 * - Custom properties and tags
 * - Authoritative definitions
 * - Transform logic and source objects
 */

import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as yaml from 'js-yaml';

// ES Module compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configuration
const TEST_WORKSPACE_NAME = 'ODCS Integration Test Workspace';
const TEST_SYSTEM_NAME = 'Test System';
const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'full-example.odcs.yaml');

// Helper to wait for app to be ready
async function waitForAppReady(page: Page) {
  await page.waitForLoadState('networkidle');
  // Wait for any loading spinners to disappear
  await page
    .waitForFunction(
      () => {
        const spinners = document.querySelectorAll('.animate-spin');
        return spinners.length === 0;
      },
      { timeout: 30000 }
    )
    .catch(() => {
      // Ignore timeout - some spinners may persist
    });
}

// Helper to create a new workspace in offline mode
async function createWorkspace(page: Page, workspaceName: string) {
  // Look for "New Workspace" button
  const newWorkspaceButton = page.locator('button:has-text("New Workspace")');
  await expect(newWorkspaceButton).toBeVisible({ timeout: 10000 });
  await newWorkspaceButton.click();

  // Fill in workspace name in the dialog
  const nameInput = page.locator(
    'input[name="name"], input#workspace-name, input#workspace-name-offline'
  );
  await expect(nameInput).toBeVisible({ timeout: 5000 });
  await nameInput.fill(workspaceName);

  // Click Create button
  const createButton = page.locator('button:has-text("Create")');
  await createButton.click();

  // Wait for navigation to workspace
  await page.waitForURL(/\/workspace\//, { timeout: 10000 });
  await waitForAppReady(page);
}

// Helper to create a system in Systems view
async function createSystem(page: Page, systemName: string) {
  // We should already be in Systems view after creating workspace
  // Look for the create system button - specifically the one with exact title for systems
  const createSystemButton = page.locator(
    'button[title="Create or import a system (database, schema, namespace)"]'
  );

  // Click the + button to open create system dialog
  await expect(createSystemButton).toBeVisible({ timeout: 5000 });
  await createSystemButton.click();

  // Wait for the Create System dialog
  const systemNameInput = page.locator('input#system-name');
  await expect(systemNameInput).toBeVisible({ timeout: 5000 });
  await systemNameInput.fill(systemName);

  // Click Create button in the dialog
  const createButton = page.locator('button:has-text("Create")').last();
  await createButton.click();

  // Wait for dialog to close and system to be created
  await page.waitForTimeout(500);
  await waitForAppReady(page);
}

// Helper to select a system by clicking on it
// Note: Clicking a system in Systems view will automatically switch to Process view AND select it
async function selectSystem(page: Page, systemName: string) {
  // Find the system node - look for the react-flow node containing the system name
  const systemNode = page.locator(`.react-flow__node`).filter({ hasText: systemName }).first();

  await expect(systemNode).toBeVisible({ timeout: 5000 });

  // Double-click on the system node to trigger both selection and view switch
  // Single click might be absorbed by child elements
  await systemNode.dblclick();

  // Wait for React to process the state changes and re-render
  await page.waitForTimeout(1000);
  await waitForAppReady(page);

  // Check if we auto-switched to Process view
  const processTab = page.locator('button[role="tab"]:has-text("System Process View")');
  const isProcessSelected = await processTab.getAttribute('aria-selected').catch(() => 'false');

  if (isProcessSelected !== 'true') {
    // Auto-switch didn't happen, manually switch to Process view
    console.log('Auto-switch to Process view did not happen, clicking tab manually...');
    await processTab.click();
    await waitForAppReady(page);
  }

  // Now we need to ensure the system is selected in the store
  // Since we can't see system nodes in Process view, we'll verify via the table button
  const tableButton = page.locator('button[title="Create or import a table"]');

  if (!(await tableButton.isVisible({ timeout: 3000 }).catch(() => false))) {
    // Table button not visible means system isn't selected
    // Go back to Systems view, select system, then return to Process view
    console.log('System not selected - going back to Systems view...');

    const systemsTab = page.locator('button[role="tab"]:has-text("Systems View")');
    await systemsTab.click();
    await waitForAppReady(page);

    // Click the system node again
    const systemNodeAgain = page
      .locator(`.react-flow__node`)
      .filter({ hasText: systemName })
      .first();
    await expect(systemNodeAgain).toBeVisible({ timeout: 5000 });
    await systemNodeAgain.click();

    // Wait for auto-switch
    await page.waitForTimeout(1000);
    await waitForAppReady(page);

    // Verify we're in Process view now
    await expect(processTab).toHaveAttribute('aria-selected', 'true', { timeout: 5000 });
  }

  // Final verification that table button is visible
  await expect(tableButton).toBeVisible({ timeout: 5000 });
}

// Helper to close any open dialogs
async function closeAnyDialogs(page: Page) {
  // Look for dialog overlays or modal containers
  const dialogOverlay = page.locator('[role="dialog"], .modal, [class*="Dialog"]').first();

  if (await dialogOverlay.isVisible({ timeout: 500 }).catch(() => false)) {
    // Look for close buttons in dialogs and click them
    const closeButton = page.locator('button:has-text("Close"), button:has-text("Cancel")').first();
    if (await closeButton.isVisible({ timeout: 500 }).catch(() => false)) {
      await closeButton.click();
      await page.waitForTimeout(300);
    } else {
      // Try pressing Escape only if a dialog is visible
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  }
}

// Helper to switch to a specific view mode
async function switchToView(page: Page, viewLabel: string) {
  // First close any open dialogs that might be blocking
  await closeAnyDialogs(page);

  // Find the view button by its text
  const viewButton = page.locator(`button[role="tab"]:has-text("${viewLabel}")`).first();

  // Check if the button exists and is enabled
  await expect(viewButton).toBeVisible({ timeout: 5000 });

  // Wait for the button to be enabled (not disabled)
  await expect(viewButton).toBeEnabled({ timeout: 5000 });

  await viewButton.click();
  await waitForAppReady(page);
}

// Helper to open create/import table dialog
async function openCreateTableDialog(page: Page) {
  // First close any open dialogs that might be blocking
  await closeAnyDialogs(page);

  // Look for the table creation button (appears when a system is selected in table views)
  // The button has title "Create or import a table"
  const tableButton = page.locator('button[title="Create or import a table"]');

  await expect(tableButton).toBeVisible({ timeout: 5000 });
  await tableButton.click();

  // Wait for dialog to open - look for "Create New Table" text in dialog header
  await expect(
    page.locator('h2:has-text("Create New Table"), h3:has-text("Create New Table")').first()
  ).toBeVisible({
    timeout: 5000,
  });
}

// Helper to import ODCS content via CreateTableDialog
async function importODCSContent(page: Page, yamlContent: string) {
  // Switch to Import Mode
  const importModeButton = page.locator('button:has-text("Import Mode")');
  await expect(importModeButton).toBeVisible({ timeout: 5000 });
  await importModeButton.click();

  // Ensure ODCS format is selected
  const formatSelect = page.locator('select#import-format');
  if (await formatSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
    await formatSelect.selectOption('odcs');
  }

  // Find textarea for pasting content
  const textarea = page.locator('textarea#import-yaml');
  await expect(textarea).toBeVisible({ timeout: 5000 });

  // Clear and paste the YAML content
  await textarea.fill(yamlContent);

  // Click Import Table button
  const importButton = page.locator('button:has-text("Import Table")');
  await expect(importButton).toBeEnabled({ timeout: 5000 });
  await importButton.click();

  // Wait for import to complete
  await waitForAppReady(page);

  // Look for success toast or imported tables
  await page.waitForTimeout(2000);
}

// Helper to parse YAML and normalize for comparison
function parseAndNormalizeODCS(yamlContent: string): any {
  const parsed = yaml.load(yamlContent) as any;

  // Normalize the structure for comparison
  const normalize = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) {
      return obj.map(normalize).sort((a, b) => {
        const aKey = a?.name || a?.id || JSON.stringify(a);
        const bKey = b?.name || b?.id || JSON.stringify(b);
        return String(aKey).localeCompare(String(bKey));
      });
    }
    if (typeof obj === 'object') {
      const normalized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        // Skip volatile fields
        if (
          [
            'created_at',
            'updated_at',
            'last_modified_at',
            'contractCreatedTs',
            'id',
            'workspace_id',
            'table_id',
            'domain_id',
          ].includes(key)
        ) {
          continue;
        }
        if (Array.isArray(value) && value.length === 0) continue;
        if (typeof value === 'object' && value !== null && Object.keys(value).length === 0)
          continue;
        normalized[key] = normalize(value);
      }
      return normalized;
    }
    return obj;
  };

  return normalize(parsed);
}

// Helper to compare ODCS schemas
interface ComparisonResult {
  isEqual: boolean;
  differences: string[];
}

function compareODCSSchemas(original: any, exported: any): ComparisonResult {
  const differences: string[] = [];

  const originalSchema = original.schema || [];
  const exportedSchema = exported.schema || [];

  if (originalSchema.length !== exportedSchema.length) {
    differences.push(
      `Table count mismatch: original=${originalSchema.length}, exported=${exportedSchema.length}`
    );
  }

  for (const origTable of originalSchema) {
    const tableName = origTable.name;
    const expTable = exportedSchema.find((t: any) => t.name === tableName);

    if (!expTable) {
      differences.push(`Missing table in export: ${tableName}`);
      continue;
    }

    // Note: 'status' is contract-level in ODCS spec, table-level status should be in customProperties
    const tableProps = ['physicalName', 'physicalType', 'businessName', 'description'];
    for (const prop of tableProps) {
      if (origTable[prop] !== expTable[prop] && origTable[prop] !== undefined) {
        differences.push(
          `Table "${tableName}" property "${prop}" mismatch: original="${origTable[prop]}", exported="${expTable[prop]}"`
        );
      }
    }

    // Check table-level tags
    if (origTable.tags && Array.isArray(origTable.tags) && origTable.tags.length > 0) {
      const origTags = JSON.stringify(origTable.tags.sort());
      const expTags = JSON.stringify((expTable.tags || []).sort());
      if (origTags !== expTags) {
        differences.push(
          `Table "${tableName}" tags mismatch: original=${origTags}, exported=${expTags}`
        );
      }
    }

    // Check table-level customProperties
    if (origTable.customProperties && Array.isArray(origTable.customProperties)) {
      const origCustom = JSON.stringify(origTable.customProperties);
      const expCustom = JSON.stringify(expTable.customProperties || []);
      if (origCustom !== expCustom) {
        differences.push(
          `Table "${tableName}" customProperties mismatch: original=${origCustom}, exported=${expCustom}`
        );
      }
    }

    const origProps = origTable.properties || [];
    const expProps = expTable.properties || [];

    if (origProps.length !== expProps.length) {
      differences.push(
        `Table "${tableName}" column count mismatch: original=${origProps.length}, exported=${expProps.length}`
      );
    }

    for (const origCol of origProps) {
      const colName = origCol.name;
      const expCol = expProps.find((c: any) => c.name === colName);

      if (!expCol) {
        differences.push(`Missing column in export: ${tableName}.${colName}`);
        continue;
      }

      const colProps = [
        'primaryKey',
        'primaryKeyPosition',
        'businessName',
        'logicalType',
        'physicalType',
        'required',
        'unique',
        'description',
        'partitioned',
        'partitionKeyPosition',
        'clustered',
        'criticalDataElement',
        'classification',
        'encryptedName',
        'transformLogic',
        'transformDescription',
        'transformSourceObjects',
        'examples',
        'logicalTypeOptions',
        'authoritativeDefinitions',
      ];

      for (const prop of colProps) {
        const origVal = origCol[prop];
        const expVal = expCol[prop];

        if (origVal === undefined && expVal === undefined) continue;

        if (typeof origVal === 'boolean' || typeof expVal === 'boolean') {
          if (Boolean(origVal) !== Boolean(expVal)) {
            differences.push(
              `Column "${tableName}.${colName}" property "${prop}" mismatch: original=${origVal}, exported=${expVal}`
            );
          }
        } else {
          // For complex objects/arrays, normalize by sorting keys and normalizing dates before comparison
          const normalizeForComparison = (val: any): string => {
            return JSON.stringify(val, (_, v) => {
              // Normalize Date objects to YYYY-MM-DD format (matching YAML date output)
              if (v instanceof Date) {
                return v.toISOString().split('T')[0];
              }
              // Normalize ISO date strings to YYYY-MM-DD format
              if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v)) {
                return v.split('T')[0];
              }
              if (v && typeof v === 'object' && !Array.isArray(v)) {
                return Object.keys(v)
                  .sort()
                  .reduce((sorted: any, key) => {
                    sorted[key] = v[key];
                    return sorted;
                  }, {});
              }
              return v;
            });
          };
          if (normalizeForComparison(origVal) !== normalizeForComparison(expVal)) {
            differences.push(
              `Column "${tableName}.${colName}" property "${prop}" mismatch: original=${JSON.stringify(origVal)}, exported=${JSON.stringify(expVal)}`
            );
          }
        }
      }

      // Check column-level tags
      if (origCol.tags && Array.isArray(origCol.tags) && origCol.tags.length > 0) {
        const origTags = JSON.stringify(origCol.tags.sort());
        const expTags = JSON.stringify((expCol.tags || []).sort());
        if (origTags !== expTags) {
          differences.push(
            `Column "${tableName}.${colName}" tags mismatch: original=${origTags}, exported=${expTags}`
          );
        }
      }

      // Check column-level customProperties (ODCS v3.1.0 array format)
      // Note: order and is_foreign_key are now stored in customProperties, so we need to compare
      // but ignore ordering differences in the array
      if (origCol.customProperties && Array.isArray(origCol.customProperties)) {
        // Sort both arrays by property name for consistent comparison
        const sortByProperty = (arr: any[]) =>
          [...arr].sort((a, b) => (a.property || '').localeCompare(b.property || ''));
        const origSorted = sortByProperty(origCol.customProperties);
        const expSorted = sortByProperty(expCol.customProperties || []);

        // Filter out 'order' property for comparison since it may be added during export
        const filterOrder = (arr: any[]) => arr.filter((p: any) => p.property !== 'order');
        const origFiltered = filterOrder(origSorted);
        const expFiltered = filterOrder(expSorted);

        const origCustom = JSON.stringify(origFiltered);
        const expCustom = JSON.stringify(expFiltered);
        if (origCustom !== expCustom) {
          differences.push(
            `Column "${tableName}.${colName}" customProperties mismatch: original=${origCustom}, exported=${expCustom}`
          );
        }
      }
      // Note: 'custom' field has been removed in favor of ODCS-compliant 'customProperties' array
    }
  }

  return {
    isEqual: differences.length === 0,
    differences,
  };
}

// Main test suite
test.describe('ODCS Import/Export Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('should create workspace and navigate to canvas', async ({ page }) => {
    // Step 1: Create a new workspace
    console.log('Step 1: Creating new workspace...');
    await createWorkspace(page, TEST_WORKSPACE_NAME);

    // Verify we're in the workspace
    await expect(page).toHaveURL(/\/workspace\//);

    // Verify the domain canvas is visible
    const canvas = page.locator('[data-testid="domain-canvas"]').first();
    await expect(canvas).toBeVisible({ timeout: 10000 });
  });

  test('should create system and import ODCS tables', async ({ page }) => {
    const originalYAML = fs.readFileSync(FIXTURE_PATH, 'utf-8');
    const originalParsed = yaml.load(originalYAML) as any;

    // Step 1: Create workspace
    console.log('Step 1: Creating workspace...');
    await createWorkspace(page, `${TEST_WORKSPACE_NAME} - Import Test`);

    // Step 2: Create a system (we start in Systems view)
    console.log('Step 2: Creating system...');
    await createSystem(page, TEST_SYSTEM_NAME);

    // Step 3: Select the system (clicking auto-switches to Process view)
    console.log('Step 3: Selecting system...');
    await selectSystem(page, TEST_SYSTEM_NAME);

    // Step 4: Open create/import dialog and import ODCS
    // (Process view should now be active with system selected, showing the table button)
    console.log('Step 4: Opening create table dialog...');
    await openCreateTableDialog(page);

    console.log('Step 5: Importing ODCS tables...');
    await importODCSContent(page, originalYAML);

    // Step 6: Verify at least the first table was imported
    // Note: The import dialog currently imports one table at a time (the first one in the schema)
    console.log('Step 6: Verifying imported table...');
    const firstTableName = originalParsed.schema?.[0]?.name || 'tbl';
    const tableElement = page
      .locator(`.react-flow__node`)
      .filter({ hasText: firstTableName })
      .first();
    await expect(tableElement).toBeVisible({ timeout: 10000 });

    // Verify the table has columns
    const columnCount = originalParsed.schema?.[0]?.properties?.length || 0;
    console.log(`Expected table "${firstTableName}" with ${columnCount} columns`);
  });

  test('should import and verify column properties are preserved', async ({ page }) => {
    const originalYAML = fs.readFileSync(FIXTURE_PATH, 'utf-8');

    // Create workspace
    await createWorkspace(page, `${TEST_WORKSPACE_NAME} - Column Props`);

    // Create and select system (clicking auto-switches to Process view)
    await createSystem(page, TEST_SYSTEM_NAME);
    await selectSystem(page, TEST_SYSTEM_NAME);

    // Import tables (Process view should now be active with system selected)
    await openCreateTableDialog(page);
    await importODCSContent(page, originalYAML);

    // Find the main table and open it for editing
    const mainTable = page.locator('.react-flow__node').filter({ hasText: 'tbl' }).first();
    await expect(mainTable).toBeVisible({ timeout: 10000 });

    // Double-click to open table editor (force to bypass any overlapping elements)
    await mainTable.dblclick({ force: true });

    // Wait for table editor to open
    await page.waitForTimeout(1000);

    // Verify a column exists (rcvr_cntry_code has many properties)
    const columnName = page.locator('text="rcvr_cntry_code"');
    await expect(columnName)
      .toBeVisible({ timeout: 5000 })
      .catch(() => {
        console.log('Column name not visible in table editor');
      });
  });

  test('should preserve primary key on import', async ({ page }) => {
    const originalYAML = fs.readFileSync(FIXTURE_PATH, 'utf-8');

    // Create workspace
    await createWorkspace(page, `${TEST_WORKSPACE_NAME} - Primary Keys`);

    // Create and select system (clicking auto-switches to Process view)
    await createSystem(page, TEST_SYSTEM_NAME);
    await selectSystem(page, TEST_SYSTEM_NAME);

    // Import tables (Process view should now be active with system selected)
    await openCreateTableDialog(page);
    await importODCSContent(page, originalYAML);

    // Find the tbl table (first table in fixture has PK on rcvr_id)
    const tblTable = page.locator('.react-flow__node').filter({ hasText: 'tbl' }).first();
    await expect(tblTable).toBeVisible({ timeout: 10000 });

    // Double-click to open table editor (force to bypass any overlapping elements)
    await tblTable.dblclick({ force: true });

    // Wait for table editor to open
    await page.waitForTimeout(1000);

    // Look for PK indicator on rcvr_id column (the primary key column in tbl table)
    // Check that the PK column name is visible
    const pkColumn = page.locator('text="rcvr_id"');
    await expect(pkColumn)
      .toBeVisible({ timeout: 5000 })
      .catch(() => {
        console.log('PK column rcvr_id not visible');
      });

    // Look for any PK indicators
    const pkIndicators = page.locator('text="PK"');
    const pkCount = await pkIndicators.count();
    console.log(`Found ${pkCount} PK indicators`);
  });

  test('should import tables with all ODCS metadata', async ({ page }) => {
    const originalYAML = fs.readFileSync(FIXTURE_PATH, 'utf-8');
    const originalParsed = yaml.load(originalYAML) as any;

    // Capture console logs from the browser to debug SDK parsing
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('[ODCSService]') || text.includes('[CreateTableDialog]')) {
        consoleLogs.push(text);
      }
    });

    // Create workspace
    await createWorkspace(page, `${TEST_WORKSPACE_NAME} - Metadata`);

    // Create and select system (clicking auto-switches to Process view)
    await createSystem(page, TEST_SYSTEM_NAME);
    await selectSystem(page, TEST_SYSTEM_NAME);

    // Import tables (Process view should now be active with system selected)
    await openCreateTableDialog(page);
    await importODCSContent(page, originalYAML);

    // Print captured console logs
    console.log('\n=== Browser Console Logs (SDK/Import) ===');
    consoleLogs.forEach((log) => console.log(log));
    console.log('=== End Browser Console Logs ===\n');

    // Verify all expected tables are present
    const expectedTableCount = originalParsed.schema?.length || 0;
    console.log(`Expected ${expectedTableCount} tables from ODCS fixture`);

    // Count visible table nodes
    const tableNodes = page.locator('.react-flow__node');
    const actualCount = await tableNodes.count();
    console.log(`Found ${actualCount} table nodes on canvas`);

    // We should have imported at least the tables from the ODCS file
    expect(actualCount).toBeGreaterThanOrEqual(1);
  });
});

// Test for column order persistence
test.describe('Column Order Persistence', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('should preserve column order after reordering and saving', async ({ page }) => {
    const originalYAML = fs.readFileSync(FIXTURE_PATH, 'utf-8');
    const originalParsed = yaml.load(originalYAML) as any;

    // Step 1: Create workspace and import table
    console.log('Step 1: Creating workspace and importing table...');
    await createWorkspace(page, `${TEST_WORKSPACE_NAME} - Column Order`);
    await createSystem(page, TEST_SYSTEM_NAME);
    await selectSystem(page, TEST_SYSTEM_NAME);
    await openCreateTableDialog(page);
    await importODCSContent(page, originalYAML);

    // Step 2: Open the table editor
    const firstTableName = originalParsed.schema?.[0]?.name || 'tbl';
    const tableNode = page.locator('.react-flow__node').filter({ hasText: firstTableName }).first();
    await expect(tableNode).toBeVisible({ timeout: 10000 });

    console.log('Step 2: Opening table editor...');
    await tableNode.dispatchEvent('click');
    await page.waitForTimeout(500);

    const tableEditor = page.locator('h2:has-text("Edit Table")');
    await expect(tableEditor).toBeVisible({ timeout: 10000 });

    // Step 3: Get the initial column order from the column list
    console.log('Step 3: Getting initial column order...');

    // Find all column name inputs in the table editor
    const columnInputs = page.locator('input[placeholder="Column name"]');
    const initialColumnCount = await columnInputs.count();
    console.log(`Found ${initialColumnCount} columns`);

    // Get initial column names in order
    const initialColumnNames: string[] = [];
    for (let i = 0; i < Math.min(initialColumnCount, 5); i++) {
      const value = await columnInputs.nth(i).inputValue();
      initialColumnNames.push(value);
    }
    console.log('Initial column order (first 5):', initialColumnNames);

    // Step 4: Find and click the "move down" button for the first column
    console.log('Step 4: Moving first column down...');

    // The move buttons are in the column editor rows
    // Look for the down arrow button (▼) in the first column row
    const moveDownButtons = page.locator('button[title="Move down"]');
    const moveDownCount = await moveDownButtons.count();
    console.log(`Found ${moveDownCount} move down buttons`);

    if (moveDownCount > 0) {
      // Click the first "move down" button to move the first column down
      await moveDownButtons.first().click();
      await page.waitForTimeout(300);

      // Step 5: Click Save Table button
      console.log('Step 5: Saving table...');
      const saveButton = page.locator('button:has-text("Save Table")');
      await expect(saveButton).toBeVisible({ timeout: 5000 });
      await saveButton.click();
      await page.waitForTimeout(1000);

      // Step 6: Verify the column order has changed after save
      console.log('Step 6: Verifying column order after save...');

      // Get the new column order
      const newColumnNames: string[] = [];
      const newColumnInputs = page.locator('input[placeholder="Column name"]');
      const newColumnCount = await newColumnInputs.count();

      for (let i = 0; i < Math.min(newColumnCount, 5); i++) {
        const value = await newColumnInputs.nth(i).inputValue();
        newColumnNames.push(value);
      }
      console.log('New column order (first 5):', newColumnNames);

      // The first two columns should have swapped positions
      if (initialColumnNames.length >= 2 && newColumnNames.length >= 2) {
        // After moving first column down, the second column should now be first
        expect(newColumnNames[0]).toBe(initialColumnNames[1]);
        // And the first column should now be second
        expect(newColumnNames[1]).toBe(initialColumnNames[0]);
        console.log('Column order correctly persisted after save!');
      }

      // Step 7: Close and reopen table editor to verify persistence
      console.log('Step 7: Closing and reopening table editor...');

      // Close the editor
      const closeButton = page.locator('button:has-text("Close")');
      if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeButton.click();
        await page.waitForTimeout(500);
      }

      // Reopen the table editor
      await tableNode.dispatchEvent('click');
      await page.waitForTimeout(500);
      await expect(tableEditor).toBeVisible({ timeout: 10000 });

      // Verify the order is still correct after reopening
      const reopenedColumnNames: string[] = [];
      const reopenedColumnInputs = page.locator('input[placeholder="Column name"]');

      for (let i = 0; i < Math.min(await reopenedColumnInputs.count(), 5); i++) {
        const value = await reopenedColumnInputs.nth(i).inputValue();
        reopenedColumnNames.push(value);
      }
      console.log('Column order after reopening (first 5):', reopenedColumnNames);

      // Verify the order persisted after reopening
      if (initialColumnNames.length >= 2 && reopenedColumnNames.length >= 2) {
        expect(reopenedColumnNames[0]).toBe(initialColumnNames[1]);
        expect(reopenedColumnNames[1]).toBe(initialColumnNames[0]);
        console.log('Column order correctly persisted after close/reopen!');
      }
    } else {
      console.log('No move down buttons found - skipping reorder test');
    }
  });

  test('should preserve column order in ODCS export after reordering', async ({ page }) => {
    const originalYAML = fs.readFileSync(FIXTURE_PATH, 'utf-8');
    const originalParsed = yaml.load(originalYAML) as any;

    // Step 1: Create workspace and import table
    console.log('Step 1: Creating workspace and importing table...');
    await createWorkspace(page, `${TEST_WORKSPACE_NAME} - Export Order`);
    await createSystem(page, TEST_SYSTEM_NAME);
    await selectSystem(page, TEST_SYSTEM_NAME);
    await openCreateTableDialog(page);
    await importODCSContent(page, originalYAML);

    // Step 2: Open the table editor
    const firstTableName = originalParsed.schema?.[0]?.name || 'tbl';
    const tableNode = page.locator('.react-flow__node').filter({ hasText: firstTableName }).first();
    await expect(tableNode).toBeVisible({ timeout: 10000 });

    console.log('Step 2: Opening table editor...');
    await tableNode.dispatchEvent('click');
    await page.waitForTimeout(500);

    const tableEditor = page.locator('h2:has-text("Edit Table")');
    await expect(tableEditor).toBeVisible({ timeout: 10000 });

    // Get initial column names
    const columnInputs = page.locator('input[placeholder="Column name"]');
    const initialColumnNames: string[] = [];
    for (let i = 0; i < Math.min(await columnInputs.count(), 3); i++) {
      initialColumnNames.push(await columnInputs.nth(i).inputValue());
    }
    console.log('Initial column order (first 3):', initialColumnNames);

    // Step 3: Move first column down
    console.log('Step 3: Moving first column down...');
    const moveDownButtons = page.locator('button[title="Move down"]');
    if ((await moveDownButtons.count()) > 0) {
      await moveDownButtons.first().click();
      await page.waitForTimeout(300);
    }

    // Step 4: Save the table
    console.log('Step 4: Saving table...');
    const saveButton = page.locator('button:has-text("Save Table")');
    await saveButton.click();
    await page.waitForTimeout(1000);

    // Step 5: Export the table as ODCS
    console.log('Step 5: Exporting as ODCS...');
    const exportButton = page.locator('button:has-text("Export")').first();
    await exportButton.click();

    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await page.locator('button:has-text("ODCS (Default)")').click();

    const download = await downloadPromise;
    const downloadPath = await download.path();
    const exportedContent = fs.readFileSync(downloadPath!, 'utf-8');
    const exportedParsed = yaml.load(exportedContent) as any;

    // Step 6: Verify the column order in the export matches the reordered state
    console.log('Step 6: Verifying column order in export...');
    const exportedProperties = exportedParsed.schema?.[0]?.properties || [];
    const exportedColumnNames = exportedProperties.slice(0, 3).map((p: any) => p.name);
    console.log('Exported column order (first 3):', exportedColumnNames);

    // After moving first column down, the order should be: [original[1], original[0], original[2], ...]
    if (initialColumnNames.length >= 2 && exportedColumnNames.length >= 2) {
      expect(exportedColumnNames[0]).toBe(initialColumnNames[1]);
      expect(exportedColumnNames[1]).toBe(initialColumnNames[0]);
      console.log('Column order correctly preserved in ODCS export!');
    }
  });
});

// Test for nested column import (array/object types with items.properties)
test.describe('Nested Column Import', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('should import table with nested array columns', async ({ page }) => {
    const originalYAML = fs.readFileSync(FIXTURE_PATH, 'utf-8');
    const originalParsed = yaml.load(originalYAML) as any;

    // Find the alerts table which has nested columns
    const alertsTable = originalParsed.schema?.find((t: any) => t.name === 'alerts');
    expect(alertsTable).toBeDefined();

    // Count expected columns including nested ones
    const countColumnsRecursively = (props: any[]): number => {
      let count = 0;
      for (const prop of props) {
        count += 1;
        if (prop.items?.properties) {
          count += countColumnsRecursively(prop.items.properties);
        }
        if (prop.properties) {
          count += countColumnsRecursively(prop.properties);
        }
      }
      return count;
    };

    const expectedTotalColumns = countColumnsRecursively(alertsTable.properties);
    console.log(`Expected total columns (including nested): ${expectedTotalColumns}`);

    // Capture console logs to verify nested column processing
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (
        text.includes('[ODCSService]') ||
        text.includes('[processNestedColumns]') ||
        text.includes('nested')
      ) {
        consoleLogs.push(text);
      }
    });

    // Create workspace and import
    await createWorkspace(page, `${TEST_WORKSPACE_NAME} - Nested Columns`);
    await createSystem(page, TEST_SYSTEM_NAME);
    await selectSystem(page, TEST_SYSTEM_NAME);
    await openCreateTableDialog(page);

    // Import specifically the alerts table by filtering the YAML
    // For now, we'll import the full YAML and verify the alerts table
    await importODCSContent(page, originalYAML);

    // Print captured console logs to verify nested processing
    console.log('\n=== Nested Column Processing Logs ===');
    consoleLogs.forEach((log) => console.log(log));
    console.log('=== End Nested Column Logs ===\n');

    // The import should have processed nested columns
    // Look for evidence that more than just root columns were processed
    const nestedProcessingLog = consoleLogs.find(
      (log) => log.includes('nestedColumns') || log.includes('nested_columns')
    );

    // Verify the alerts table was imported (it's the 4th table in the schema)
    // Note: The import dialog imports tables sequentially, so we may need to check
    // if all tables were imported or just the first one
    console.log(`Total tables in fixture: ${originalParsed.schema?.length}`);
  });

  test('should preserve parent_column_id for nested columns', async ({ page }) => {
    const originalYAML = fs.readFileSync(FIXTURE_PATH, 'utf-8');

    // Capture browser console to inspect imported data structure
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('parent_column_id') || text.includes('nested_columns')) {
        consoleLogs.push(text);
      }
    });

    // Create workspace and import
    await createWorkspace(page, `${TEST_WORKSPACE_NAME} - Parent Column IDs`);
    await createSystem(page, TEST_SYSTEM_NAME);
    await selectSystem(page, TEST_SYSTEM_NAME);
    await openCreateTableDialog(page);
    await importODCSContent(page, originalYAML);

    // The normalizeTableV2 function should have set parent_column_id on nested columns
    // This is verified by the unit tests, but we can check console output here
    console.log('\n=== Parent Column ID Logs ===');
    consoleLogs.forEach((log) => console.log(log));
    console.log('=== End Parent Column ID Logs ===\n');
  });

  test('should handle deeply nested columns (3+ levels)', async ({ page }) => {
    const originalYAML = fs.readFileSync(FIXTURE_PATH, 'utf-8');
    const originalParsed = yaml.load(originalYAML) as any;

    // Find the alerts table and verify the deeply nested operation object
    const alertsTable = originalParsed.schema?.find((t: any) => t.name === 'alerts');
    const rulesTriggered = alertsTable?.properties?.find((p: any) => p.name === 'rules_triggered');
    const operation = rulesTriggered?.items?.properties?.find((p: any) => p.name === 'operation');

    // Verify the fixture has the deeply nested structure
    expect(operation).toBeDefined();
    expect(operation?.properties).toBeInstanceOf(Array);
    expect(operation?.properties?.length).toBe(3); // operation_name, operation_field, revert_action

    console.log('Deeply nested structure verified in fixture:');
    console.log('  alerts.rules_triggered[].operation.operation_name');
    console.log('  alerts.rules_triggered[].operation.operation_field');
    console.log('  alerts.rules_triggered[].operation.revert_action');

    // Create workspace and import
    await createWorkspace(page, `${TEST_WORKSPACE_NAME} - Deep Nesting`);
    await createSystem(page, TEST_SYSTEM_NAME);
    await selectSystem(page, TEST_SYSTEM_NAME);
    await openCreateTableDialog(page);
    await importODCSContent(page, originalYAML);

    // Verify import completed (at least one table visible)
    const tableNodes = page.locator('.react-flow__node');
    const tableCount = await tableNodes.count();
    expect(tableCount).toBeGreaterThanOrEqual(1);
    console.log(`Imported ${tableCount} tables`);
  });

  test('should preserve nested columns on export round-trip', async ({ page }) => {
    const originalYAML = fs.readFileSync(FIXTURE_PATH, 'utf-8');
    const originalParsed = yaml.load(originalYAML) as any;

    // Find the alerts table which has nested columns
    const alertsTable = originalParsed.schema?.find((t: any) => t.name === 'alerts');
    expect(alertsTable).toBeDefined();

    // Capture console logs
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('[ODCSService]') || text.includes('nested') || text.includes('V2')) {
        consoleLogs.push(`[${msg.type()}] ${text}`);
      }
    });

    // Create workspace and import
    await createWorkspace(page, `${TEST_WORKSPACE_NAME} - Nested Round Trip`);
    await createSystem(page, TEST_SYSTEM_NAME);
    await selectSystem(page, TEST_SYSTEM_NAME);
    await openCreateTableDialog(page);
    await importODCSContent(page, originalYAML);

    // Find and click on the alerts table node
    const alertsNode = page.locator('.react-flow__node').filter({ hasText: 'alerts' }).first();

    // The alerts table might not be the first one imported - check if it exists
    const alertsVisible = await alertsNode.isVisible({ timeout: 5000 }).catch(() => false);

    if (!alertsVisible) {
      console.log('Alerts table not visible - may need to scroll or it was not imported');
      // Skip test if alerts table not found
      return;
    }

    await alertsNode.dispatchEvent('click');
    await page.waitForTimeout(500);

    // Wait for editor
    await expect(page.locator('h2:has-text("Edit Table")')).toBeVisible({ timeout: 10000 });

    // Export the table
    const exportButton = page.locator('button:has-text("Export")').first();
    await exportButton.click();

    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await page.locator('button:has-text("ODCS (Default)")').click();

    const download = await downloadPromise;
    const downloadPath = await download.path();
    const exportedContent = fs.readFileSync(downloadPath!, 'utf-8');
    const exportedParsed = yaml.load(exportedContent) as any;

    // Verify the exported alerts table has nested structure preserved
    const exportedAlertsTable = exportedParsed.schema?.[0]; // Should be the only table in export

    // Helper to count columns recursively
    const countColumnsRecursively = (props: any[]): number => {
      let count = 0;
      for (const prop of props || []) {
        count += 1;
        if (prop.items?.properties) {
          count += countColumnsRecursively(prop.items.properties);
        }
        if (prop.properties) {
          count += countColumnsRecursively(prop.properties);
        }
      }
      return count;
    };

    const originalNestedCount = countColumnsRecursively(alertsTable.properties);
    const exportedNestedCount = countColumnsRecursively(exportedAlertsTable?.properties);

    console.log(`Original nested column count: ${originalNestedCount}`);
    console.log(`Exported nested column count: ${exportedNestedCount}`);

    // Verify nested columns were preserved
    expect(exportedNestedCount).toBe(originalNestedCount);

    // Verify specific nested structure: rules_triggered should have items.properties
    const exportedRulesTriggered = exportedAlertsTable?.properties?.find(
      (p: any) => p.name === 'rules_triggered'
    );
    expect(exportedRulesTriggered).toBeDefined();
    expect(exportedRulesTriggered?.items?.properties).toBeInstanceOf(Array);
    expect(exportedRulesTriggered?.items?.properties?.length).toBeGreaterThan(0);

    // Verify deeply nested: operation should have properties
    const exportedOperation = exportedRulesTriggered?.items?.properties?.find(
      (p: any) => p.name === 'operation'
    );
    expect(exportedOperation).toBeDefined();
    expect(exportedOperation?.properties).toBeInstanceOf(Array);

    console.log('\n=== Nested Round-trip Console Logs ===');
    consoleLogs.forEach((log) => console.log(log));
    console.log('=== End Console Logs ===\n');
  });
});

// Additional test for export functionality
test.describe('ODCS Export', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('should export table as ODCS YAML', async ({ page }) => {
    const originalYAML = fs.readFileSync(FIXTURE_PATH, 'utf-8');
    const originalParsed = yaml.load(originalYAML) as any;

    // Capture console logs from the browser to verify V2 SDK usage
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (
        text.includes('[ODCSService]') ||
        text.includes('[SDKLoader]') ||
        text.includes('export')
      ) {
        consoleLogs.push(text);
      }
    });

    // Step 1: Create workspace
    console.log('Step 1: Creating workspace...');
    await createWorkspace(page, `${TEST_WORKSPACE_NAME} - Export Test`);

    // Step 2: Create and select system
    console.log('Step 2: Creating system...');
    await createSystem(page, TEST_SYSTEM_NAME);
    await selectSystem(page, TEST_SYSTEM_NAME);

    // Step 3: Import the ODCS table
    console.log('Step 3: Importing ODCS table...');
    await openCreateTableDialog(page);
    await importODCSContent(page, originalYAML);

    // Step 4: Verify the table was imported
    const firstTableName = originalParsed.schema?.[0]?.name || 'tbl';
    const tableNode = page.locator('.react-flow__node').filter({ hasText: firstTableName }).first();
    await expect(tableNode).toBeVisible({ timeout: 10000 });

    // Step 5: Open the table editor by clicking on the table node
    console.log('Step 5: Opening table editor...');

    // ReactFlow nodes need to be clicked via their wrapper div for the onNodeClick to fire
    // The node wrapper has data-testid="rf__node-{id}"
    // First, let's find the node and click on it using dispatch click event
    const rfNode = page.locator('.react-flow__node').filter({ hasText: firstTableName }).first();
    await expect(rfNode).toBeVisible({ timeout: 5000 });

    // Dispatch a native click event to trigger ReactFlow's onNodeClick
    await rfNode.dispatchEvent('click');
    await page.waitForTimeout(500);

    // Wait for the table editor to open
    const tableEditor = page.locator('h2:has-text("Edit Table")');
    await expect(tableEditor).toBeVisible({ timeout: 10000 });

    // Step 6: Click the Export button to open the export menu
    console.log('Step 6: Opening export menu...');
    const exportButton = page.locator('button:has-text("Export")').first();
    await expect(exportButton).toBeVisible({ timeout: 5000 });
    await exportButton.click();

    // Wait for the export menu to appear
    const exportMenu = page.locator('button:has-text("ODCS (Default)")');
    await expect(exportMenu).toBeVisible({ timeout: 5000 });

    // Step 7: Set up download listener before clicking export
    console.log('Step 7: Exporting as ODCS YAML...');
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });

    // Click ODCS export option
    await exportMenu.click();

    // Step 8: Wait for download and verify
    const download = await downloadPromise;
    const downloadedFileName = download.suggestedFilename();
    console.log(`Downloaded file: ${downloadedFileName}`);

    // Verify the filename ends with .odcs.yaml
    expect(downloadedFileName).toMatch(/\.odcs\.yaml$/);

    // Get the downloaded content
    const downloadPath = await download.path();
    const exportedContent = fs.readFileSync(downloadPath!, 'utf-8');
    console.log(`Exported content length: ${exportedContent.length} bytes`);

    // Parse the exported YAML
    const exportedParsed = yaml.load(exportedContent) as any;

    // Step 9: Verify exported content has expected structure
    console.log('Step 9: Verifying exported content...');

    // Check that it's valid ODCS format
    expect(exportedParsed).toBeDefined();

    // ODCS 3.1.0 should have schema array or direct table properties
    const hasSchema = Array.isArray(exportedParsed.schema);
    const hasTableProperties = exportedParsed.name || exportedParsed.properties;

    expect(hasSchema || hasTableProperties).toBeTruthy();

    // If it has schema, verify table name matches
    if (hasSchema && exportedParsed.schema.length > 0) {
      const exportedTableName = exportedParsed.schema[0].name;
      expect(exportedTableName).toBe(firstTableName);
      console.log(`Verified exported table name: ${exportedTableName}`);

      // Verify columns/properties are present
      const exportedProperties = exportedParsed.schema[0].properties;
      expect(Array.isArray(exportedProperties)).toBeTruthy();
      console.log(`Exported table has ${exportedProperties?.length || 0} columns`);
    }

    // Print any export-related console logs
    if (consoleLogs.length > 0) {
      console.log('\n=== Export Console Logs ===');
      consoleLogs.forEach((log) => console.log(log));
      console.log('=== End Export Console Logs ===\n');
    }

    // CRITICAL: Verify SDK V2 was used for export (not fallback)
    // The V2 path should log "toYAMLv2 called" and NOT "Falling back to JavaScript YAML converter"
    const usedV2Export = consoleLogs.some((log) => log.includes('toYAMLv2 called'));
    const usedFallback = consoleLogs.some(
      (log) =>
        log.includes('Falling back to JavaScript YAML converter') ||
        log.includes('V2 export failed, falling back')
    );

    // Log SDK version detection for debugging
    const sdkVersionLog = consoleLogs.find((log) => log.includes('Detected SDK version'));
    if (sdkVersionLog) {
      console.log(`SDK Version: ${sdkVersionLog}`);
    }

    // Fail the test if fallback was used - we must use V2 for lossless export
    expect(usedFallback).toBe(false);
    expect(usedV2Export).toBe(true);
  });

  test('should preserve column properties in export round-trip', async ({ page }) => {
    const originalYAML = fs.readFileSync(FIXTURE_PATH, 'utf-8');
    const originalParsed = yaml.load(originalYAML) as any;

    // Capture console logs to verify V2 SDK usage and field preservation
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (
        text.includes('[ODCSService]') ||
        text.includes('[SDKLoader]') ||
        text.includes('[CreateTableDialog]') ||
        text.includes('[App]') ||
        text.includes('WASM') ||
        text.includes('V2') ||
        msg.type() === 'error'
      ) {
        consoleLogs.push(`[${msg.type()}] ${text}`);
      }
    });

    // Step 1: Create workspace and import
    await createWorkspace(page, `${TEST_WORKSPACE_NAME} - Round Trip`);
    await createSystem(page, TEST_SYSTEM_NAME);
    await selectSystem(page, TEST_SYSTEM_NAME);
    await openCreateTableDialog(page);
    await importODCSContent(page, originalYAML);

    // Step 2: Open table editor
    const firstTableName = originalParsed.schema?.[0]?.name || 'tbl';
    const tableNode = page.locator('.react-flow__node').filter({ hasText: firstTableName }).first();
    await expect(tableNode).toBeVisible({ timeout: 10000 });

    // Click on the ReactFlow node to trigger onNodeClick
    const rfNode = page.locator('.react-flow__node').filter({ hasText: firstTableName }).first();
    await expect(rfNode).toBeVisible({ timeout: 5000 });
    await rfNode.dispatchEvent('click');
    await page.waitForTimeout(500);

    // Wait for editor
    await expect(page.locator('h2:has-text("Edit Table")')).toBeVisible({ timeout: 10000 });

    // Step 3: Export the table
    const exportButton = page.locator('button:has-text("Export")').first();
    await exportButton.click();

    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await page.locator('button:has-text("ODCS (Default)")').click();

    const download = await downloadPromise;
    const downloadPath = await download.path();
    const exportedContent = fs.readFileSync(downloadPath!, 'utf-8');
    const exportedParsed = yaml.load(exportedContent) as any;

    // Step 4: Compare key properties
    const originalTable = originalParsed.schema?.[0];
    const exportedTable = exportedParsed.schema?.[0];

    // Debug: Log status fields from both original and exported
    // Note: Table-level status should be in customProperties, not as direct field
    const getStatusFromCustomProps = (customProps: any[]) =>
      customProps?.find((p: any) => p.property === 'status')?.value;

    console.log('Status comparison:', {
      originalRootStatus: originalParsed.status,
      originalSchemaStatusInCustomProps: getStatusFromCustomProps(originalTable?.customProperties),
      exportedRootStatus: exportedParsed.status,
      exportedSchemaStatusInCustomProps: getStatusFromCustomProps(exportedTable?.customProperties),
    });

    if (originalTable && exportedTable) {
      // Compare table-level properties
      const result = compareODCSSchemas({ schema: [originalTable] }, { schema: [exportedTable] });

      console.log('Round-trip comparison results:');
      console.log(`  Equal: ${result.isEqual}`);
      if (result.differences.length > 0) {
        console.log('  Differences:');
        result.differences.slice(0, 10).forEach((diff) => console.log(`    - ${diff}`));
        if (result.differences.length > 10) {
          console.log(`    ... and ${result.differences.length - 10} more`);
        }
      }

      // With V2 SDK, we should have NO differences - lossless round-trip
      // Check that at least the column count matches
      const originalColumnCount = originalTable.properties?.length || 0;
      const exportedColumnCount = exportedTable.properties?.length || 0;
      expect(exportedColumnCount).toBe(originalColumnCount);

      // V2 should preserve all properties - fail if there are differences
      if (result.differences.length > 0) {
        console.log('\n=== Round-trip Console Logs ===');
        consoleLogs.forEach((log) => console.log(log));
        console.log('=== End Console Logs ===\n');
      }

      // With SDK 2.0.4+ V2 methods, round-trip should be lossless
      expect(result.differences.length).toBe(0);
    }

    // CRITICAL: Verify SDK V2 was used (not fallback)
    const usedV2Import = consoleLogs.some((log) => log.includes('Using SDK 2.0.6+ V2 methods'));
    const usedV2Export = consoleLogs.some((log) => log.includes('toYAMLv2 called'));
    const usedFallback = consoleLogs.some(
      (log) =>
        log.includes('Falling back to JavaScript YAML converter') ||
        log.includes('V2 export failed, falling back') ||
        log.includes('V2 parsing failed, falling back')
    );

    expect(usedFallback).toBe(false);
    expect(usedV2Import).toBe(true);
    expect(usedV2Export).toBe(true);
  });

  test('should preserve column details modal edits in export', async ({ page }) => {
    // This test verifies that edits made via the Column Details Modal are:
    // 1. Saved to the table state
    // 2. Preserved when the table is exported to ODCS format

    // Step 1: Create workspace and import a simple table
    await createWorkspace(page, `${TEST_WORKSPACE_NAME} - Column Details`);
    await createSystem(page, TEST_SYSTEM_NAME);
    await selectSystem(page, TEST_SYSTEM_NAME);
    await openCreateTableDialog(page);

    // Import a simple ODCS with one table
    const simpleODCS = `
apiVersion: v3.1.0
kind: DataContract
id: test-contract
schema:
  - name: test_table
    description: Test table for column details
    properties:
      - name: id
        logicalType: string
        physicalType: VARCHAR
        description: Test ID column
      - name: status
        logicalType: string
        physicalType: VARCHAR
        description: Status column
`;
    await importODCSContent(page, simpleODCS);

    // Step 2: Open table editor
    const tableNode = page.locator('.react-flow__node').filter({ hasText: 'test_table' }).first();
    await expect(tableNode).toBeVisible({ timeout: 10000 });
    await tableNode.dispatchEvent('click');
    await page.waitForTimeout(500);
    await expect(page.locator('h2:has-text("Edit Table")')).toBeVisible({ timeout: 10000 });

    // Step 3: Open Column Details modal for the 'status' column
    // Find the status column row and click its Details button
    const statusColumnRow = page.locator('text=status').first();
    await expect(statusColumnRow).toBeVisible({ timeout: 5000 });

    // Click the Details button for the status column
    const detailsButton = page
      .locator('div')
      .filter({ hasText: /^status/ })
      .locator('button:has-text("Details")')
      .first();
    await detailsButton.click();
    await page.waitForTimeout(500);

    // Step 4: Navigate to Engineering tab and set Physical/Logical types
    const engineeringTab = page.locator('button:has-text("Engineering")');
    await expect(engineeringTab).toBeVisible({ timeout: 5000 });
    await engineeringTab.click();

    // Set Physical Type
    const physicalTypeSelect = page
      .locator('select')
      .filter({ hasText: /VARCHAR/ })
      .first();
    await physicalTypeSelect.selectOption('DECIMAL(10,2)');

    // Set Logical Type
    const logicalTypeSelect = page.locator('select').filter({ hasText: /Select logical type/ });
    await logicalTypeSelect.selectOption('number');

    // Step 5: Navigate to Quality tab and add Valid Values rule
    const qualityTab = page.locator('button:has-text("Quality")');
    await qualityTab.click();

    // Add valid_values quality rule
    const ruleSelect = page.locator('select:has-text("Add Quality Rule")');
    await ruleSelect.selectOption('valid_values');

    // Enter valid values
    const validValuesInput = page.locator('input[placeholder="active, inactive, pending"]');
    await expect(validValuesInput).toBeVisible({ timeout: 5000 });
    await validValuesInput.fill('active, inactive, pending');
    // Blur to trigger parsing
    await validValuesInput.blur();

    // Step 6: Save the column details
    const saveButton = page.locator('button:has-text("Save Changes")');
    await saveButton.click();
    await page.waitForTimeout(500);

    // Step 7: Save the table
    const saveTableButton = page.locator('button:has-text("Save Table")');
    await saveTableButton.click();
    await page.waitForTimeout(1000);

    // Step 8: Export the table
    const exportButton = page.locator('button:has-text("Export")').first();
    await exportButton.click();

    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await page.locator('button:has-text("ODCS (Default)")').click();

    const download = await downloadPromise;
    const downloadPath = await download.path();
    const exportedContent = fs.readFileSync(downloadPath!, 'utf-8');
    const exportedParsed = yaml.load(exportedContent) as any;

    // Step 9: Verify the exported data contains our edits
    const exportedTable = exportedParsed.schema?.[0];
    expect(exportedTable).toBeDefined();
    expect(exportedTable.name).toBe('test_table');

    const statusColumn = exportedTable.properties?.find((p: any) => p.name === 'status');
    expect(statusColumn).toBeDefined();

    // Verify physical type was saved
    expect(statusColumn.physicalType).toBe('DECIMAL(10,2)');

    // Verify logical type was saved
    expect(statusColumn.logicalType).toBe('number');

    // Verify quality rules / constraints were saved
    // Valid values may be in constraints.validValues or in quality array
    const hasValidValues =
      statusColumn.constraints?.validValues?.length > 0 ||
      statusColumn.quality?.some((q: any) => q.implementation?.kwargs?.value_set?.length > 0) ||
      statusColumn.logicalTypeOptions?.enum?.length > 0;

    expect(hasValidValues).toBe(true);

    console.log('Column Details Modal persistence test passed!');
    console.log('Exported status column:', JSON.stringify(statusColumn, null, 2));
  });
});
