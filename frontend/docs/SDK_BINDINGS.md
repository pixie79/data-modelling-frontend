# Data Modelling SDK WASM Bindings Reference

**Package**: `data-modelling-sdk`  
**Version**: 1.13.6  
**Audit Date**: 2026-01-08

This document lists all exported bindings from the Data Modelling SDK WASM module.

---

## Installation

The SDK is downloaded from GitHub releases during build:

```bash
npm run build:wasm
```

This downloads from: `https://github.com/OffeneDatenmodellierung/data-modelling-sdk/releases/download/v1.13.6/data-modelling-sdk-wasm-v1.13.6.tar.gz`

## WASM Files

| File                         | Size   | Purpose                |
| ---------------------------- | ------ | ---------------------- |
| `data_modelling_sdk_bg.wasm` | ~8.8MB | Core WASM binary       |
| `data_modelling_sdk.js`      | ~111KB | JavaScript bindings    |
| `data_modelling_sdk.d.ts`    | ~40KB  | TypeScript definitions |

---

## Initialization

```typescript
import init, * as sdk from '/wasm/data_modelling_sdk.js';

// Initialize WASM module
await init();

// Use SDK functions
const result = sdk.parse_odcs_yaml(yamlContent);
```

---

## Function Categories

### ODCS/ODCL Parsing

| Function              | Signature                                    | Description                    |
| --------------------- | -------------------------------------------- | ------------------------------ |
| `parse_odcs_yaml`     | `(yaml: string) => string`                   | Parse ODCS YAML to JSON        |
| `parse_odcl_yaml`     | `(yaml: string) => string`                   | Parse legacy ODCL YAML to JSON |
| `is_odcl_format`      | `(yaml: string) => boolean`                  | Check if YAML is ODCL format   |
| `export_to_odcs_yaml` | `(json: string) => string`                   | Export workspace to ODCS YAML  |
| `convert_to_odcs`     | `(input: string, format?: string) => string` | Convert any format to ODCS     |

### Domain Operations

| Function                           | Signature                                              | Description                  |
| ---------------------------------- | ------------------------------------------------------ | ---------------------------- |
| `create_domain`                    | `(name: string) => string`                             | Create new domain            |
| `create_domain_config`             | `(name: string, workspace_id: string) => string`       | Create domain config         |
| `parse_domain_config_yaml`         | `(yaml: string) => string`                             | Parse domain config YAML     |
| `export_domain_config_to_yaml`     | `(json: string) => string`                             | Export domain config to YAML |
| `export_to_domain`                 | `(json: string) => string`                             | Export domain to YAML        |
| `import_from_domain`               | `(yaml: string) => string`                             | Import domain from YAML      |
| `get_domain_config_id`             | `(json: string) => string`                             | Get domain ID from config    |
| `add_entity_to_domain_config`      | `(config: string, type: string, id: string) => string` | Add entity to domain         |
| `remove_entity_from_domain_config` | `(config: string, type: string, id: string) => string` | Remove entity from domain    |
| `update_domain_view_positions`     | `(config: string, positions: string) => string`        | Update view positions        |

### Workspace Operations

| Function                                 | Signature                                                        | Description                  |
| ---------------------------------------- | ---------------------------------------------------------------- | ---------------------------- |
| `create_workspace`                       | `(name: string, owner_id: string) => string`                     | Create new workspace         |
| `parse_workspace_yaml`                   | `(yaml: string) => string`                                       | Parse workspace YAML         |
| `export_workspace_to_yaml`               | `(json: string) => string`                                       | Export workspace to YAML     |
| `add_domain_to_workspace`                | `(workspace: string, domain_id: string, name: string) => string` | Add domain to workspace      |
| `remove_domain_from_workspace`           | `(workspace: string, domain_id: string) => string`               | Remove domain from workspace |
| `add_relationship_to_workspace`          | `(workspace: string, relationship: string) => string`            | Add relationship             |
| `remove_relationship_from_workspace`     | `(workspace: string, rel_id: string) => string`                  | Remove relationship          |
| `get_workspace_relationships_for_source` | `(workspace: string, source_id: string) => string`               | Get relationships by source  |
| `get_workspace_relationships_for_target` | `(workspace: string, target_id: string) => string`               | Get relationships by target  |

### Decision Log Operations (MADR)

| Function                        | Signature                                                                      | Description                   |
| ------------------------------- | ------------------------------------------------------------------------------ | ----------------------------- |
| `create_decision`               | `(number: number, title: string, context: string, decision: string) => string` | Create decision               |
| `create_decision_index`         | `() => string`                                                                 | Create empty decision index   |
| `parse_decision_yaml`           | `(yaml: string) => string`                                                     | Parse decision YAML           |
| `parse_decision_index_yaml`     | `(yaml: string) => string`                                                     | Parse decision index YAML     |
| `export_decision_to_yaml`       | `(json: string) => string`                                                     | Export decision to YAML       |
| `export_decision_to_markdown`   | `(json: string) => string`                                                     | Export decision to Markdown   |
| `export_decision_index_to_yaml` | `(json: string) => string`                                                     | Export decision index to YAML |
| `add_decision_to_index`         | `(index: string, decision: string, filename: string) => string`                | Add decision to index         |

### Knowledge Base Operations

| Function                         | Signature                                                                                     | Description                    |
| -------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------ |
| `create_knowledge_article`       | `(number: number, title: string, summary: string, content: string, author: string) => string` | Create article                 |
| `create_knowledge_index`         | `() => string`                                                                                | Create empty knowledge index   |
| `parse_knowledge_yaml`           | `(yaml: string) => string`                                                                    | Parse knowledge article YAML   |
| `parse_knowledge_index_yaml`     | `(yaml: string) => string`                                                                    | Parse knowledge index YAML     |
| `export_knowledge_to_yaml`       | `(json: string) => string`                                                                    | Export article to YAML         |
| `export_knowledge_to_markdown`   | `(json: string) => string`                                                                    | Export article to Markdown     |
| `export_knowledge_index_to_yaml` | `(json: string) => string`                                                                    | Export knowledge index to YAML |
| `add_article_to_knowledge_index` | `(index: string, article: string, filename: string) => string`                                | Add article to index           |
| `search_knowledge_articles`      | `(articles: string, query: string) => string`                                                 | Search articles                |

### CADS (Compute Asset) Operations

| Function                  | Signature                                                        | Description                 |
| ------------------------- | ---------------------------------------------------------------- | --------------------------- |
| `import_from_cads`        | `(yaml: string) => string`                                       | Import CADS asset from YAML |
| `export_to_cads`          | `(json: string) => string`                                       | Export CADS asset to YAML   |
| `add_cads_node_to_domain` | `(workspace: string, domain_id: string, node: string) => string` | Add CADS node to domain     |

### ODPS (Data Product) Operations

| Function           | Signature                  | Description                   |
| ------------------ | -------------------------- | ----------------------------- |
| `import_from_odps` | `(yaml: string) => string` | Import ODPS product from YAML |
| `export_to_odps`   | `(json: string) => string` | Export ODPS product to YAML   |
| `validate_odps`    | `(yaml: string) => void`   | Validate ODPS YAML            |

### OpenAPI Operations

| Function                     | Signature                                                                    | Description                    |
| ---------------------------- | ---------------------------------------------------------------------------- | ------------------------------ |
| `import_openapi_spec`        | `(domain_id: string, content: string, api_name?: string) => string`          | Import OpenAPI spec            |
| `export_openapi_spec`        | `(content: string, source_format: string, target_format?: string) => string` | Export OpenAPI spec            |
| `convert_openapi_to_odcs`    | `(content: string, component: string, table_name?: string) => string`        | Convert OpenAPI to ODCS        |
| `analyze_openapi_conversion` | `(content: string, component: string) => string`                             | Analyze conversion feasibility |

### SQL Operations

| Function                  | Signature                                   | Description             |
| ------------------------- | ------------------------------------------- | ----------------------- |
| `import_from_sql`         | `(sql: string, dialect: string) => string`  | Import from SQL DDL     |
| `export_to_sql`           | `(json: string, dialect: string) => string` | Export to SQL DDL       |
| `sanitize_sql_identifier` | `(name: string, dialect: string) => string` | Sanitize SQL identifier |

**Supported SQL Dialects**: `postgresql`, `mysql`, `sqlserver`, `databricks`

### Schema Format Operations

| Function                  | Signature                    | Description             |
| ------------------------- | ---------------------------- | ----------------------- |
| `import_from_avro`        | `(avro: string) => string`   | Import from AVRO schema |
| `export_to_avro`          | `(json: string) => string`   | Export to AVRO schema   |
| `import_from_protobuf`    | `(proto: string) => string`  | Import from Protobuf    |
| `export_to_protobuf`      | `(json: string) => string`   | Export to Protobuf      |
| `import_from_json_schema` | `(schema: string) => string` | Import from JSON Schema |
| `export_to_json_schema`   | `(json: string) => string`   | Export to JSON Schema   |

### Filtering Operations

| Function                                      | Signature                                      | Description                            |
| --------------------------------------------- | ---------------------------------------------- | -------------------------------------- |
| `filter_by_tags`                              | `(workspace: string, tag: string) => string`   | Filter nodes/relationships by tag      |
| `filter_nodes_by_infrastructure_type`         | `(workspace: string, type: string) => string`  | Filter by infrastructure               |
| `filter_nodes_by_owner`                       | `(workspace: string, owner: string) => string` | Filter by owner                        |
| `filter_relationships_by_infrastructure_type` | `(workspace: string, type: string) => string`  | Filter relationships by infrastructure |
| `filter_relationships_by_owner`               | `(workspace: string, owner: string) => string` | Filter relationships by owner          |

### Validation Operations

| Function                       | Signature                                                                 | Description                         |
| ------------------------------ | ------------------------------------------------------------------------- | ----------------------------------- |
| `validate_uuid`                | `(id: string) => string`                                                  | Validate UUID format                |
| `validate_table_name`          | `(name: string) => string`                                                | Validate table name                 |
| `validate_column_name`         | `(name: string) => string`                                                | Validate column name                |
| `validate_data_type`           | `(type: string) => string`                                                | Validate data type                  |
| `validate_description`         | `(desc: string) => string`                                                | Validate description                |
| `validate_no_self_reference`   | `(source_id: string, target_id: string) => string`                        | Check no self-reference             |
| `validate_pattern_exclusivity` | `(table: string) => string`                                               | Validate SCD/Data Vault exclusivity |
| `check_circular_dependency`    | `(relationships: string, source_id: string, target_id: string) => string` | Check for cycles                    |

### Utility Operations

| Function                  | Signature                                   | Description               |
| ------------------------- | ------------------------------------------- | ------------------------- |
| `sanitize_description`    | `(desc: string) => string`                  | Sanitize description text |
| `detect_naming_conflicts` | `(existing: string, new: string) => string` | Detect naming conflicts   |
| `parse_tag`               | `(tag: string) => string`                   | Parse tag string          |
| `serialize_tag`           | `(tag: string) => string`                   | Serialize tag to string   |

### Node Operations

| Function                  | Signature                                                          | Description   |
| ------------------------- | ------------------------------------------------------------------ | ------------- |
| `add_odcs_node_to_domain` | `(workspace: string, domain_id: string, node: string) => string`   | Add ODCS node |
| `add_system_to_domain`    | `(workspace: string, domain_id: string, system: string) => string` | Add system    |

### Migration Operations

| Function                     | Signature                                        | Description                |
| ---------------------------- | ------------------------------------------------ | -------------------------- |
| `migrate_dataflow_to_domain` | `(yaml: string, domain_name?: string) => string` | Migrate DataFlow to Domain |

### Browser Storage Operations

| Function     | Signature                                                                  | Description               |
| ------------ | -------------------------------------------------------------------------- | ------------------------- |
| `load_model` | `(db: string, store: string, path: string) => Promise<any>`                | Load model from IndexedDB |
| `save_model` | `(db: string, store: string, path: string, model: string) => Promise<any>` | Save model to IndexedDB   |

---

## Return Value Format

All functions return JSON strings. Parse the result to get the data:

```typescript
const resultJson = sdk.parse_odcs_yaml(yamlContent);
const result = JSON.parse(resultJson);

if (result.error) {
  console.error('Parse error:', result.error);
} else {
  console.log('Tables:', result.tables);
}
```

### ImportResult Structure

```typescript
interface ImportResult {
  tables: Table[];
  relationships: Relationship[];
  errors: ValidationError[];
  warnings: string[];
}
```

### Validation Result Structure

```typescript
interface ValidationResult {
  valid: boolean;
  error?: string;
  // Additional fields depending on validation type
}
```

---

## Error Handling

Errors are returned as JSON with an `error` field:

```typescript
try {
  const result = sdk.parse_odcs_yaml(invalidYaml);
  const parsed = JSON.parse(result);

  if (parsed.error) {
    console.error('SDK Error:', parsed.error);
  }
} catch (e) {
  console.error('WASM Error:', e);
}
```

---

## Example Usage

### Parse ODCS YAML

```typescript
import init, * as sdk from '/wasm/data_modelling_sdk.js';

await init();

const yaml = `
apiVersion: v3.1.0
kind: DataContract
metadata:
  name: customers
schema:
  - name: customers
    columns:
      - name: id
        type: string
        primaryKey: true
`;

const resultJson = sdk.parse_odcs_yaml(yaml);
const result = JSON.parse(resultJson);

console.log('Tables:', result.tables);
console.log('Columns:', result.tables[0].columns);
```

### Create Decision Log

```typescript
const decisionJson = sdk.create_decision(
  1, // number
  'Use DuckDB for storage', // title
  'We need fast queries...', // context
  'Use DuckDB-WASM with OPFS' // decision
);

const decision = JSON.parse(decisionJson);
console.log('Decision ID:', decision.id);

// Export to Markdown
const markdown = sdk.export_decision_to_markdown(decisionJson);
console.log(markdown);
```

### Search Knowledge Articles

```typescript
const articles = JSON.stringify([
  { id: '1', title: 'Getting Started', content: '...' },
  { id: '2', title: 'Advanced Topics', content: '...' },
]);

const resultsJson = sdk.search_knowledge_articles(articles, 'getting');
const results = JSON.parse(resultsJson);
console.log('Found articles:', results);
```

### Validate and Check Relationships

```typescript
// Check for self-reference
const selfRefResult = sdk.validate_no_self_reference('uuid-1', 'uuid-1');
const selfRef = JSON.parse(selfRefResult);
console.log('Self reference:', !selfRef.valid);

// Check for circular dependency
const relationships = JSON.stringify([
  { source_table_id: 'a', target_table_id: 'b' },
  { source_table_id: 'b', target_table_id: 'c' },
]);

const cycleResult = sdk.check_circular_dependency(relationships, 'c', 'a');
const cycle = JSON.parse(cycleResult);
console.log('Has cycle:', cycle.has_cycle);
```

---

## New in Version 1.13.6

The following features were added/fixed in SDK 1.13.6:

### ODCS v3.1.0 Field Preservation

- Fixed `id` field preservation issue where contract UUIDs were lost during `TableData` construction
- Added contract-level field preservation during import with `TableData` struct now including:
  - `id`, `apiVersion`, `version`, `status`, `kind`
  - `domain`, `dataProduct`, `tenant`, `description`
  - `servers`, `team`, `support`, `roles`
  - `slaProperties`, `quality`, `price`, `tags`
  - `customProperties`, `authoritativeDefinitions`
  - `contractCreatedTs`, `odcsMetadata`

### SystemReference Updates

- `SystemReference` now includes optional `table_ids` and `asset_ids` UUID arrays for explicit system mapping

---

## New in Version 1.13.4

The following functions are available in SDK 1.13.4:

### Decision Log Functions

- `create_decision`
- `create_decision_index`
- `parse_decision_yaml`
- `parse_decision_index_yaml`
- `export_decision_to_yaml`
- `export_decision_to_markdown`
- `export_decision_index_to_yaml`
- `add_decision_to_index`

### Knowledge Base Functions

- `create_knowledge_article`
- `create_knowledge_index`
- `parse_knowledge_yaml`
- `parse_knowledge_index_yaml`
- `export_knowledge_to_yaml`
- `export_knowledge_to_markdown`
- `export_knowledge_index_to_yaml`
- `add_article_to_knowledge_index`
- `search_knowledge_articles`

### Workspace Functions

- `create_workspace`
- `parse_workspace_yaml`
- `export_workspace_to_yaml`
- `add_domain_to_workspace`
- `remove_domain_from_workspace`
- `add_relationship_to_workspace`
- `remove_relationship_from_workspace`

### Domain Config Functions

- `create_domain_config`
- `parse_domain_config_yaml`
- `export_domain_config_to_yaml`
- `add_entity_to_domain_config`
- `remove_entity_from_domain_config`
- `update_domain_view_positions`

---

## Integration with sdkLoader.ts

The SDK is loaded via `sdkLoader.ts` which handles:

1. Dynamic import of WASM module
2. Version detection
3. Method availability checking
4. Graceful fallbacks for missing methods

```typescript
import { sdkLoader } from '@/services/sdk/sdkLoader';

// Load SDK
await sdkLoader.load();
const sdk = sdkLoader.getModule();

// Check feature support
if (sdkLoader.hasDecisionSupport()) {
  // Use decision functions
}

if (sdkLoader.hasKnowledgeSupport()) {
  // Use knowledge functions
}
```
