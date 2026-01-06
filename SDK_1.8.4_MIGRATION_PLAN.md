# SDK 1.8.4 Migration Plan

## Summary

SDK version 1.8.4 has been published with significant improvements:
- Fixes conversion issues and validations for all file types
- **ODCL parser is now a separate function** (`parse_odcl_yaml`) and not parsed via the ODCS parser
- **No file types should need pre-parsing or extra formatting logic**
- All parsers now handle validation and conversion correctly
- **Increased SQL dialect support** - More SQL dialects are now supported
- **ODCL import only** - We support importing ODCL but not exporting (export not needed)

**Note**: API work is out of scope - we're only focusing on offline/WASM mode

## Changes Required

### 1. Remove Pre-Parsing Logic

**File**: `frontend/src/services/sdk/odcsService.ts`

#### Current Issues:
- `detectFormat()` method tries to detect ODCL vs ODCS format manually
- `parseYAMLFallback()` has complex fallback logic with format detection
- `mergeOriginalYAMLWithSDKResult()` is a workaround to preserve fields SDK didn't parse
- `extractODCLInfo()` manually extracts ODCL metadata
- `applyODCLMetadataToTable()` manually applies ODCL metadata to tables
- Complex conditional logic to handle ODCL through ODCS parser

#### Changes Needed:
1. **Remove format detection** - SDK 1.8.4 handles this internally
2. **Use separate ODCL parser** - Call `parse_odcl_yaml()` instead of `parse_odcs_yaml()` for ODCL files
3. **Remove merge logic** - SDK 1.8.4 returns complete data
4. **Simplify parseYAML()** - Direct SDK calls without pre/post-processing
5. **Remove validateTableCompleteness()** - SDK 1.8.4 handles validation
6. **Remove manual ODCL metadata extraction** - SDK returns this data

### 2. Update Method Signatures

#### Before (SDK 1.5.0):
```typescript
// ODCS and ODCL both use same parser
parse_odcs_yaml(yaml: string): string
export_to_odcs_yaml(json: string): string
```

#### After (SDK 1.8.4):
```typescript
// Separate parsers for ODCS and ODCL
parse_odcs_yaml(yaml: string): string
parse_odcl_yaml(yaml: string): string  // NEW - Import only
export_to_odcs_yaml(json: string): string
// Note: export_to_odcl_yaml() may exist but we don't need it (ODCL import only)
```

### 3. Add ODCL Import Format to UI

**File**: `frontend/src/components/common/ImportExportDialog.tsx`

The import dialog currently has these formats:
- ODCS 3.1.0
- SQL (with multiple dialects)
- AVRO, JSON Schema, Protobuf
- ODPS, CADS, BPMN, DMN, OpenAPI

#### Changes Needed:
1. Add `'odcl'` to `ImportFormat` type
2. Add "ODCL (Data Contract)" option to import format dropdown
3. Add handler case for ODCL in `handleImportContent()`
4. Do NOT add ODCL to export formats (import only)

```typescript
type ImportFormat = 'odcs' | 'odcl' | 'sql' | 'avro' | 'json-schema' | 'protobuf' | 'odps' | 'cads' | 'bpmn' | 'dmn' | 'openapi';

// In import format select:
<option value="odcs">ODCS 3.1.0 (Data Contract Standard)</option>
<option value="odcl">ODCL (Data Contract Language)</option>

// In handleImportContent:
case 'odcl':
  workspace = await odcsService.parseODCL(content); // New method
  break;
```

### 4. Expanded SQL Dialect Support

SDK 1.8.4 supports more SQL dialects. Current UI shows:
- PostgreSQL
- MySQL  
- SQLite
- SQL Server
- Databricks

**Action**: Check SDK 1.8.4 documentation for new dialect support and update the dropdown if needed. Common additional dialects might include:
- Oracle
- Snowflake
- BigQuery
- Redshift
- MariaDB
- Teradata

Update both `SQLDialect` type and the select dropdown in `ImportExportDialog.tsx`.

### 5. Simplified Architecture

#### Current Flow (Complex):
```
User YAML Input
  ↓
detectFormat() → determine if ODCL or ODCS
  ↓
parseYAML() → parse with format detection
  ↓
extractODCLInfo() → manually extract ODCL metadata
  ↓
mergeOriginalYAMLWithSDKResult() → merge to preserve missing fields
  ↓
validateTableCompleteness() → check for missing fields
  ↓
applyODCLMetadataToTable() → manually apply metadata
  ↓
Return workspace
```

#### New Flow (Simple):
```
User YAML Input
  ↓
Detect file extension (.odcs.yaml vs .odcl.yaml) OR check for dataContractSpecification field
  ↓
Call appropriate SDK parser:
  - parse_odcs_yaml() for ODCS files
  - parse_odcl_yaml() for ODCL files
  ↓
Return complete, validated workspace (SDK handles everything)
```

### 6. Update sdkLoader.ts

**File**: `frontend/src/services/sdk/sdkLoader.ts`

#### Add ODCL Methods to Interface:
```typescript
interface SDKModule {
  // ... existing methods ...
  
  // ODCL methods (SDK 1.8.4+)
  parse_odcl_yaml?(yaml: string): string;
  export_to_odcl_yaml?(json: string): string;
}
```

#### Update Verification:
```typescript
private verifySDKBindings(module: SDKModule): void {
  const v182Methods = [
    'parse_odcl_yaml',
    'export_to_odcl_yaml',
  ];
  
  // Check for 1.8.4+ methods
  // ...
}
```

## Implementation Steps

### Phase 1: Update SDK Loader (Low Risk)
1. Update `sdkLoader.ts` interface to include ODCL methods
2. Update binding verification to check for 1.8.4+ methods
3. Update WASM build scripts to use SDK 1.8.4

### Phase 2: Add ODCL Import to UI (Low Risk)
1. Update `ImportExportDialog.tsx` to add ODCL import format option
2. Update import format type to include `'odcl'`
3. Add ODCL case to import handler (do NOT add to export)
4. Check SDK docs for new SQL dialects and update dropdown if needed

### Phase 3: Simplify ODCS Service (Medium Risk)
1. Add new `parseODCL()` method that:
   - Calls `parse_odcl_yaml()` directly
   - Returns result without merging/validation
2. Simplify existing `parseYAML()` (now ODCS-only) to:
   - Call `parse_odcs_yaml()` directly
   - Remove ODCL detection and handling
   - Remove merging/validation logic
3. Simplify `toYAML()` (ODCS export only)
4. Keep fallback methods for now (remove in Phase 4)
5. **Skip all API-related code** - we're not using the API currently

### Phase 4: Remove Legacy Code (Low Risk)
1. Remove these methods (no longer needed):
   - `detectFormat()` (replaced by separate parseYAML/parseODCL methods)
   - `mergeOriginalYAMLWithSDKResult()` (SDK returns complete data)
   - `validateTableCompleteness()` (SDK handles validation)
   - `extractODCLInfo()` (SDK returns this data)
   - `applyODCLMetadataToTable()` (SDK handles this)
   - `convertSDKResultToWorkspace()` (simplify to direct return)
2. Simplify `parseYAMLFallback()` if still needed (basic YAML only)
3. Update comments and documentation
4. Remove or comment out all API-related code paths (out of scope)

### Phase 5: Testing
1. Test ODCS file import/export
2. Test ODCL file import (no export needed)
3. Test new SQL dialects if added
4. Test with malformed files (SDK should return validation errors)
5. Test offline mode fallback
6. **Skip API testing** (out of scope)

## Benefits

1. **Simpler Code**: Remove ~500 lines of complex parsing/validation logic
2. **More Reliable**: SDK handles validation, no manual workarounds
3. **Better Error Messages**: SDK provides structured validation errors
4. **Easier Maintenance**: One source of truth (SDK) for parsing logic
5. **Future-Proof**: SDK updates automatically improve parsing

## Breaking Changes

### None Expected
- Public API remains the same (`parseYAML()`, `toYAML()`)
- Fallback logic maintained for offline mode
- All existing tests should pass with better results

## Risks

### Low Risk
- SDK 1.8.4 is more complete than previous versions
- Existing workarounds may have masked SDK bugs that are now fixed
- Fallback logic can remain as safety net

### Mitigation
- Test thoroughly with real-world files
- Keep fallback logic during transition
- Add SDK version detection and warnings

## Files to Update

1. `frontend/src/services/sdk/sdkLoader.ts` - Add ODCL methods to interface
2. `frontend/src/services/sdk/odcsService.ts` - Simplify parsing logic, add parseODCL method
3. `frontend/src/components/common/ImportExportDialog.tsx` - Add ODCL import option
4. `frontend/public/wasm/*` - Update to SDK 1.8.4 WASM build
5. `frontend/package.json` - Update SDK version dependency (if using npm package)
6. Documentation files mentioning SDK version or parsing logic
7. Type definitions if SQLDialect type needs new dialects

## Rollback Plan

If issues arise:
1. Keep old methods with `_legacy` suffix during migration
2. Add feature flag to toggle between old/new parsing
3. Revert to old logic if critical bugs found

## Timeline

- **Phase 1**: 1 hour (update interfaces)
- **Phase 2**: 1 hour (add ODCL import to UI)
- **Phase 3**: 2 hours (simplify service, skip API code)
- **Phase 4**: 1 hour (remove legacy code)
- **Phase 5**: 2 hours (testing)

**Total**: ~7 hours of work

## Next Steps

1. Verify SDK 1.8.4 is available and accessible
2. Build and copy WASM module to `frontend/public/wasm/`
3. Begin Phase 1 implementation
4. Test with sample ODCS and ODCL files
5. Proceed through phases with testing after each
