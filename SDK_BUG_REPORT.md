# SDK Bug Report: ODCS Import/Export Issues

**SDK Version**: `@offenedatenmodellierung/data-modelling-sdk@2.0.3`  
**Reporter**: Integration Test Suite  
**Date**: 2026-01-13  
**Severity**: High  

---

## Summary

Two critical issues were discovered during end-to-end integration testing of the ODCS import/export functionality:

1. **Issue #1**: `parse_odcs_yaml` only returns the first table from multi-table ODCS files
2. **Issue #2**: Multiple ODCS v3.1.0 fields are not returned by `parse_odcs_yaml` (lost at SDK parse time)

---

## Issue #1: Multi-Table ODCS Files Only Import First Table

### Description

When parsing an ODCS v3.1.0 YAML file that contains multiple tables in the `schema` array, the SDK's `parse_odcs_yaml` function only returns the first table. All subsequent tables are silently dropped.

### Steps to Reproduce

1. Create an ODCS v3.1.0 YAML file with multiple tables in the `schema` array
2. Call `sdk.parse_odcs_yaml(yamlContent)`
3. Observe that `result.tables` only contains 1 table

### Test Case

**Input ODCS YAML** (simplified):
```yaml
apiVersion: v3.1.0
kind: DataContract
schema:
  - name: tbl
    physicalName: tbl_1
    properties:
      - name: id
        primaryKey: true
        logicalType: string

  - name: receivers
    physicalName: receivers_master
    properties:
      - name: id
        primaryKey: true
        logicalType: string

  - name: receiver_types
    physicalName: lkp_receiver_types
    properties:
      - name: type_code
        primaryKey: true
        logicalType: string
```

**Expected Result**:
```javascript
{
  tables: [
    { name: 'tbl', ... },
    { name: 'receivers', ... },
    { name: 'receiver_types', ... }
  ],
  errors: []
}
```

**Actual Result**:
```javascript
{
  tables: [
    { name: 'tbl', ... }
    // receivers and receiver_types are missing!
  ],
  errors: []
}
```

### Evidence from Test Run

```
[ODCSService] SDK parse_odcs_yaml result: {tables: Array(1), tables_requiring_name: Array(0), errors: Array(0), ai_suggestions: null}
[ODCSService] First table structure: {id: 53581432-6c55-4ba2-a65f-72344a91553a, name: tbl, columnsCount: 4, hasQualityRules: false, firstColumnQuality: undefined}
```

The fixture file contains 3 tables (`tbl`, `receivers`, `receiver_types`), but only `tbl` is returned.

### Impact

- Users cannot import complete data contracts with multiple tables
- Multi-table schemas must be imported one table at a time (poor UX)
- No error or warning is provided about the dropped tables

### Suggested Fix

In the Rust ODCS parser, ensure the entire `schema` array is iterated and all tables are converted to the output format:

```rust
// Pseudocode - iterate ALL schema items, not just first
for schema_item in odcs.schema.iter() {
    let table = convert_schema_to_table(schema_item)?;
    tables.push(table);
}
```

---

## Issue #2: ODCS Fields Lost During SDK Parse (Not Returned by `parse_odcs_yaml`)

### Description

The SDK's `parse_odcs_yaml` function does not include many ODCS v3.1.0 fields in its return value. These fields are lost at **parse time** (import), not during export. The frontend cannot preserve fields that were never returned by the SDK.

**This affects:**
- **Import**: Fields are lost when calling `parse_odcs_yaml`
- **Export**: Since fields were never imported, they cannot be exported
- **Save**: Same as export - the internal data store never received these fields
- **UI Display**: Fields cannot be displayed because they don't exist in the model

### Where the Loss Occurs

The SDK's `parse_odcs_yaml` function returns a simplified structure that omits these ODCS fields. The frontend's `normalizeTable` function receives an object that already lacks these properties.

Evidence from console logs:
```
[ODCSService] SDK parse_odcs_yaml result: {tables: Array(1), ...}
[ODCSService] First table structure: {id: ..., name: tbl, columnsCount: 4, hasQualityRules: false, ...}
```

The SDK result does not include `physicalName`, `businessName`, `status`, etc.

### Fields Not Returned at Table Level

| ODCS Field | Expected in SDK Result | Actually Returned |
|------------|----------------------|-------------------|
| `physicalName` | `"tbl_1"` | Not returned |
| `physicalType` | `"table"` | Not returned |
| `businessName` | `"Core Payment Metrics"` | Not returned |
| `description` | (full description) | Not returned |
| `status` | `"active"` | Not returned |
| `dataGranularityDescription` | (value) | Not returned |
| `authoritativeDefinitions` | (array) | Not returned |
| `tags` | (array) | Partially returned |
| `quality` | (table-level rules) | Not returned |
| `customProperties` | (array) | Partially returned |
| `relationships` | (schema-level) | Not returned |

### Fields Not Returned at Column Level

| ODCS Field | Expected | Actually Returned |
|------------|----------|-------------------|
| `physicalName` | `"txn_ref_dt"` | Not returned |
| `physicalType` | `"date"` | Not returned |
| `logicalType` | `"date"` | Not returned |
| `businessName` | `"transaction reference date"` | Not returned |
| `primaryKeyPosition` | `1` | Not returned |
| `partitioned` | `true` | Not returned |
| `partitionKeyPosition` | `1` | Not returned |
| `clustered` | `true`/`false` | Not returned |
| `criticalDataElement` | `true`/`false` | Not returned |
| `classification` | `"public"`/`"restricted"` | Not returned |
| `encryptedName` | (value) | Not returned |
| `transformSourceObjects` | (array) | Not returned |
| `transformLogic` | (SQL) | Not returned |
| `transformDescription` | (text) | Not returned |
| `examples` | (array) | Not returned |
| `logicalTypeOptions` | (constraints object) | Not returned |
| `default` | (default value) | Returned as `default_value` |
| `authoritativeDefinitions` | (array) | Not returned |
| `quality` | (column-level rules) | Partially returned |

### Test Evidence

Round-trip comparison from integration tests:

```
Round-trip comparison results:
  Equal: false
  Differences:
    - Table "tbl" property "physicalName" mismatch: original="tbl_1", exported="undefined"
    - Table "tbl" property "physicalType" mismatch: original="table", exported="undefined"
    - Table "tbl" property "businessName" mismatch: original="Core Payment Metrics", exported="undefined"
    - Table "tbl" property "description" mismatch: original="Provides core payment metrics...", exported="undefined"
    - Table "tbl" property "status" mismatch: original="active", exported="draft"
    - Column "tbl.transaction_reference_date" property "primaryKeyPosition" mismatch
    - Column "tbl.transaction_reference_date" property "businessName" mismatch
    - Column "tbl.transaction_reference_date" property "physicalType" mismatch
    - Column "tbl.transaction_reference_date" property "partitioned" mismatch: original=true, exported=undefined
    - Column "tbl.transaction_reference_date" property "partitionKeyPosition" mismatch
    ... and 23 more
```

### Impact

- **Import**: Users lose critical metadata when importing ODCS files
- **UI Display**: Fields like `businessName`, `classification` cannot be shown
- **Export**: Exported files are incomplete - significant data loss
- **Save/Load**: Saved workspaces lack this ODCS metadata
- **Data Governance**: Classification, critical data element flags, etc. are lost

### Suggested Fix

1. **Update SDK's internal types**: Add all ODCS v3.1.0 fields to the Rust structs:

```rust
// Table struct - add ODCS fields
pub struct Table {
    // Existing fields...
    pub physical_name: Option<String>,
    pub physical_type: Option<String>,
    pub business_name: Option<String>,
    pub status: Option<String>,
    pub data_granularity_description: Option<String>,
    pub authoritative_definitions: Option<Vec<AuthoritativeDefinition>>,
    pub quality: Option<Vec<QualityRule>>,
    pub custom_properties: Option<Vec<CustomProperty>>,
    pub relationships: Option<Vec<SchemaRelationship>>,
}

// Column struct - add ODCS fields
pub struct Column {
    // Existing fields...
    pub physical_name: Option<String>,
    pub physical_type: Option<String>,
    pub logical_type: Option<String>,
    pub business_name: Option<String>,
    pub primary_key_position: Option<i32>,
    pub partitioned: Option<bool>,
    pub partition_key_position: Option<i32>,
    pub clustered: Option<bool>,
    pub critical_data_element: Option<bool>,
    pub classification: Option<String>,
    pub encrypted_name: Option<String>,
    pub transform_source_objects: Option<Vec<String>>,
    pub transform_logic: Option<String>,
    pub transform_description: Option<String>,
    pub examples: Option<Vec<String>>,
    pub logical_type_options: Option<LogicalTypeOptions>,
    pub authoritative_definitions: Option<Vec<AuthoritativeDefinition>>,
    pub quality: Option<Vec<QualityRule>>,
}
```

2. **Update `parse_odcs_yaml`**: Map ALL ODCS fields from the YAML to the output structs

3. **Update `export_to_odcs_yaml`**: Write ALL fields back to the YAML output

---

## Test Fixture Reference

The full ODCS test fixture used for these tests is available at:
- `frontend/tests/e2e/fixtures/full-example.odcs.yaml`

This fixture is based on the official ODCS example from:
- https://github.com/bitol-io/open-data-contract-standard/blob/main/docs/examples/all/full-example.odcs.yaml

---

## Priority Recommendation

1. **Issue #1 (Multi-table)**: **Critical** - This completely blocks users from importing real-world data contracts
2. **Issue #2 (Field loss)**: **High** - This causes silent data loss at import time, affecting all downstream operations (UI, save, export)

---

## Verification

After fixes are applied, the integration tests at `frontend/tests/e2e/odcs-import-export.spec.ts` should:

1. Show all 3 tables imported (not just 1)
2. Show the round-trip comparison with `Equal: true` or minimal acceptable differences

---

## Frontend Readiness

Note: The frontend is **ready** to handle these fields once the SDK provides them:

1. **Type definitions exist**: `frontend/src/types/table.ts` already defines `Column` with fields like `businessName`, `physicalName`, `classification`, `partitioned`, etc.

2. **UI components exist**: The Column Details Modal has tabs for Governance (classification), Engineering (physical details), Transform (lineage), and Quality.

3. **normalizeTable needs updating**: Once the SDK returns these fields, the frontend's `normalizeTable` function in `odcsService.ts` needs to map them to the output object. Currently these mappings are missing because the SDK doesn't return the fields.
