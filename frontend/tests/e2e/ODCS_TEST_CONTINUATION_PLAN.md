# ODCS Integration Test Continuation Plan

## Overview

This document outlines the remaining test work to be completed once the SDK issues documented in `/SDK_BUG_REPORT.md` are resolved.

## Current State (v2.3.0)

### Tests Implemented ✅

- 7 integration tests passing
- Import flow tested (single table limitation documented)
- Export flow tested (ODCS YAML download)
- Round-trip comparison implemented (detects field loss)

### Known SDK Limitations

1. **Multi-table import**: SDK returns only first table from multi-table ODCS files
2. **Field loss at parse time**: 33+ ODCS v3.1.0 fields not returned by `parse_odcs_yaml`

---

## Post-SDK Update Tasks

### Task 1: Update Multi-Table Import Test

**File**: `frontend/tests/e2e/odcs-import-export.spec.ts`

**Current behavior** (test at line ~526):

```typescript
// Currently expects 1 table due to SDK limitation
test('should import tables with all ODCS metadata', async ({ page }) => {
  // ...
  // This logs: "Expected 3 tables from ODCS fixture" but finds only 1
});
```

**After SDK fix**:

1. Update test to verify all 3 tables are imported (`tbl`, `receivers`, `receiver_types`)
2. Verify each table has correct columns
3. Verify relationships between tables are preserved (if SDK supports this)

**Implementation**:

```typescript
// Verify all 3 tables imported
const tableNodes = page.locator('.react-flow__node');
await expect(tableNodes).toHaveCount(3);

// Verify each table by name
for (const tableName of ['tbl', 'receivers', 'receiver_types']) {
  const tableNode = tableNodes.filter({ hasText: tableName });
  await expect(tableNode).toBeVisible();
}
```

---

### Task 2: Update Round-Trip Field Preservation Test

**File**: `frontend/tests/e2e/odcs-import-export.spec.ts`

**Current behavior** (test at line ~691):

```typescript
test('should preserve column properties in export round-trip', async ({ page }) => {
  // Currently logs 33+ field mismatches and passes (documenting current state)
});
```

**After SDK fix**:

1. Change test to **fail** if fields are not preserved
2. Verify table-level ODCS fields round-trip correctly
3. Verify column-level ODCS fields round-trip correctly

**Fields to verify at table level**:

- `physicalName`
- `physicalType`
- `businessName`
- `description`
- `status`
- `dataGranularityDescription`
- `tags`
- `quality` (table-level rules)

**Fields to verify at column level**:

- `physicalName`
- `physicalType`
- `logicalType`
- `businessName`
- `primaryKeyPosition`
- `partitioned` / `partitionKeyPosition`
- `clustered`
- `criticalDataElement`
- `classification`
- `transformSourceObjects` / `transformLogic` / `transformDescription`
- `examples`
- `logicalTypeOptions` (min, max, pattern, format, etc.)
- `quality` (column-level rules)

**Implementation**:

```typescript
// After SDK fix, this assertion should pass
expect(differences.length).toBe(0);
// Or allow specific acceptable differences
expect(differences.length).toBeLessThanOrEqual(ACCEPTABLE_DIFF_COUNT);
```

---

### Task 3: Update Frontend normalizeTable Function

**File**: `frontend/src/services/sdk/odcsService.ts`

Once SDK returns these fields, update `normalizeTable` to map them:

```typescript
function normalizeTable(item: SDKTable): Table {
  return {
    // Existing mappings...

    // NEW: Table-level ODCS fields (add these)
    physicalName: item.physical_name,
    physicalType: item.physical_type,
    businessName: item.business_name,
    status: item.status,
    dataGranularityDescription: item.data_granularity_description,
    authoritativeDefinitions: item.authoritative_definitions,
    // ...

    columns: item.columns.map((col) => ({
      // Existing mappings...

      // NEW: Column-level ODCS fields (add these)
      physicalName: col.physical_name,
      physicalType: col.physical_type,
      logicalType: col.logical_type,
      businessName: col.business_name,
      primaryKeyPosition: col.primary_key_position,
      partitioned: col.partitioned,
      partitionKeyPosition: col.partition_key_position,
      clustered: col.clustered,
      criticalDataElement: col.critical_data_element,
      classification: col.classification,
      // ...
    })),
  };
}
```

---

### Task 4: Add UI Display Tests for ODCS Fields

**New tests to add**:

```typescript
test('should display ODCS metadata in Column Details Modal', async ({ page }) => {
  // Import ODCS file
  // Open column details modal
  // Verify Engineering tab shows: physicalName, physicalType
  // Verify Governance tab shows: classification, criticalDataElement
  // Verify Transform tab shows: transformLogic, transformSourceObjects
  // Verify Quality tab shows: quality rules
});

test('should display table-level ODCS metadata', async ({ page }) => {
  // Import ODCS file
  // Open table editor
  // Verify businessName, status, description are displayed
});
```

---

### Task 5: Add Relationship Import Tests

**If SDK adds relationship support**:

```typescript
test('should import schema relationships from ODCS', async ({ page }) => {
  // Import ODCS file with relationships defined
  // Verify foreign key edges are created on canvas
  // Verify relationship metadata (cardinality, etc.)
});
```

---

## Test File Locations

| File                                                 | Purpose                    |
| ---------------------------------------------------- | -------------------------- |
| `frontend/tests/e2e/odcs-import-export.spec.ts`      | Main integration tests     |
| `frontend/tests/e2e/fixtures/full-example.odcs.yaml` | Test fixture (ODCS v3.1.0) |
| `frontend/src/services/sdk/odcsService.ts`           | Frontend ODCS service      |
| `frontend/src/types/table.ts`                        | Type definitions           |

---

## Verification Checklist

After SDK update, verify:

- [ ] `parse_odcs_yaml` returns all tables from multi-table files
- [ ] `parse_odcs_yaml` returns all ODCS v3.1.0 fields
- [ ] `export_to_odcs_yaml` writes all fields back
- [ ] Update `normalizeTable` to map new fields
- [ ] All 7 existing tests still pass
- [ ] Round-trip test shows `Equal: true`
- [ ] Multi-table test shows 3 tables imported
- [ ] UI displays ODCS metadata correctly

---

## SDK Version Dependency

Current: `@offenedatenmodellierung/data-modelling-sdk@^2.0.3`

After SDK fix, update to new version:

```bash
npm install @offenedatenmodellierung/data-modelling-sdk@^2.1.0
```

Then re-run tests:

```bash
npm run test:e2e -- tests/e2e/odcs-import-export.spec.ts
```

---

## Contact

For SDK issues, refer to: `/SDK_BUG_REPORT.md`
