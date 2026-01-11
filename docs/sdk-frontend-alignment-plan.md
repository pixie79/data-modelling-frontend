# Frontend/SDK Type Alignment Plan

## Overview

This document outlines the alignment work needed between the frontend TypeScript types and the SDK JSON schemas at https://github.com/OffeneDatenmodellierung/data-modelling-sdk/tree/main/schemas.

**Key Finding**: The frontend has evolved ahead of the SDK schemas in several areas, particularly the timestamp-based numbering system for Knowledge Base articles and Decisions. This requires SDK schema updates rather than frontend changes.

## Summary of Alignment Work

| Schema | Direction | Priority | Effort |
|--------|-----------|----------|--------|
| Decision | SDK needs update | **High** | Medium |
| Knowledge | SDK needs update | **High** | Medium |
| ODCS (Table) | Both directions | Medium | Large |
| ODPS | SDK needs update | Medium | Medium |
| CADS | SDK needs update | Low | Small |
| Workspace | Aligned | - | - |

---

## 1. Decision Schema (decision-schema.json)

### SDK Feature Request Required: Yes

### Changes Needed in SDK

#### 1.1 Number Format Change (Breaking Change)

**Current SDK Schema:**
```json
"number": {
  "type": "integer",
  "minimum": 1,
  "description": "Sequential decision number"
}
```

**Required SDK Schema:**
```json
"number": {
  "type": "integer",
  "minimum": 1,
  "description": "Timestamp-based decision number in YYMMDDHHmm format (e.g., 2601101806)"
}
```

**Rationale**: The frontend now uses timestamp-based numbers (`YYMMDDHHmm` format) to ensure unique numbers when multiple users create decisions on different systems and merge via Git. Sequential numbers cause conflicts in distributed workflows.

#### 1.2 Status Enum Alignment

**Current SDK Schema:**
```json
"status": {
  "enum": ["draft", "proposed", "accepted", "superseded", "deprecated"]
}
```

**Required SDK Schema:**
```json
"status": {
  "enum": ["draft", "proposed", "accepted", "superseded", "deprecated", "rejected"]
}
```

**Rationale**: Frontend supports `rejected` status for decisions that were not accepted.

#### 1.3 Category Enum Alignment

**Current SDK Schema:**
```json
"category": {
  "enum": ["architecture", "design", "technology", "process", "other"]
}
```

**Required SDK Schema:**
```json
"category": {
  "enum": ["architecture", "technology", "process", "security", "data", "integration"]
}
```

**Rationale**: Frontend uses more specific categories. Remove `design` and `other`, add `security`, `data`, `integration`.

#### 1.4 New Fields to Add

| Field | Type | Description |
|-------|------|-------------|
| `domain_id` | string (UUID) | Optional domain association |
| `workspace_id` | string (UUID) | Workspace this decision belongs to |
| `superseded_by` | string (UUID) | ID of decision that supersedes this one |
| `supersedes` | string (UUID) | ID of decision this one supersedes |
| `related_decisions` | string[] (UUIDs) | Related decision IDs |
| `related_knowledge` | string[] (UUIDs) | Related knowledge article IDs |
| `authors` | string[] | List of authors |
| `deciders` | string[] | List of decision makers |
| `consulted` | string[] | RACI - people consulted |
| `informed` | string[] | RACI - people informed |
| `decided_at` | string (ISO timestamp) | When decision was accepted/rejected |
| `options` | DecisionOption[] | Considered alternatives with pros/cons |

#### 1.5 DecisionOption Schema (New)

```json
"DecisionOption": {
  "type": "object",
  "properties": {
    "title": { "type": "string" },
    "description": { "type": "string" },
    "pros": { "type": "array", "items": { "type": "string" } },
    "cons": { "type": "array", "items": { "type": "string" } }
  },
  "required": ["title", "description", "pros", "cons"]
}
```

---

## 2. Knowledge Schema (knowledge-schema.json)

### SDK Feature Request Required: Yes

### Changes Needed in SDK

#### 2.1 Number Format Change (Breaking Change)

**Current SDK Schema:**
```json
"number": {
  "type": "string",
  "pattern": "^KB-[0-9]{4}$",
  "description": "Knowledge article number"
}
```

**Required SDK Schema:**
```json
"number": {
  "type": "integer",
  "minimum": 1,
  "description": "Timestamp-based article number in YYMMDDHHmm format (e.g., 2601101806)"
}
```

**Rationale**: Same as Decision - timestamp-based numbers prevent merge conflicts in Git workflows.

#### 2.2 Type Enum Alignment

**Current SDK Schema:**
```json
"type": {
  "enum": ["guide", "reference", "tutorial", "faq", "glossary"]
}
```

**Required SDK Schema:**
```json
"type": {
  "enum": ["guide", "reference", "concept", "tutorial", "troubleshooting", "runbook"]
}
```

**Changes**: Remove `faq`, `glossary`; Add `concept`, `troubleshooting`, `runbook`.

#### 2.3 Status Enum Alignment

**Current SDK Schema:**
```json
"status": {
  "enum": ["draft", "published", "archived"]
}
```

**Required SDK Schema:**
```json
"status": {
  "enum": ["draft", "review", "published", "archived", "deprecated"]
}
```

**Changes**: Add `review`, `deprecated` statuses.

#### 2.4 Author Field Change

**Current SDK Schema:**
```json
"author": {
  "type": "string",
  "description": "Author name or identifier"
}
```

**Required SDK Schema:**
```json
"authors": {
  "type": "array",
  "items": { "type": "string" },
  "description": "List of author names or identifiers"
}
```

**Rationale**: Articles often have multiple authors.

#### 2.5 New Fields to Add

| Field | Type | Description |
|-------|------|-------------|
| `domain_id` | string (UUID) | Optional domain association |
| `workspace_id` | string (UUID) | Workspace this article belongs to |
| `summary` | string | Brief summary/abstract |
| `reviewers` | string[] | List of reviewer names |
| `related_articles` | string[] (UUIDs) | Related knowledge article IDs |
| `related_decisions` | string[] (UUIDs) | Related decision IDs |
| `prerequisites` | string[] (UUIDs) | Prerequisite article IDs |
| `see_also` | string[] (UUIDs) | "See Also" article IDs |
| `published_at` | string (ISO timestamp) | When article was published |
| `reviewed_at` | string (ISO timestamp) | Last review timestamp |
| `archived_at` | string (ISO timestamp) | When article was archived |

---

## 3. ODCS Schema (odcs-schema.json)

### SDK Feature Request Required: Partial

### Changes Needed

#### 3.1 SDK Updates Needed

| Field | Change |
|-------|--------|
| `relationships` | Add to schema - array of relationship references |
| `team` | Add Team v3.1.0 structure (currently uses v2.x) |

#### 3.2 Frontend Updates Needed

| Field | Change |
|-------|--------|
| `dataQuality` | Add support for SDK's DataQuality structure |

#### 3.3 Team Structure Update (SDK v3.1.0)

The SDK should update to Team v3.1.0 format:

```json
"team": {
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "contact": { "type": "string" },
    "email": { "type": "string", "format": "email" },
    "slack_channel": { "type": "string" },
    "documentation_url": { "type": "string", "format": "uri" }
  }
}
```

---

## 4. ODPS Schema (odps-schema.json)

### SDK Feature Request Required: Yes

### Changes Needed in SDK

#### 4.1 Port Structure Simplification

**Current SDK Schema** has complex nested structure with `inputPorts.ports[]` and `outputPorts.ports[]`.

**Frontend uses simplified structure:**
```typescript
interface ODPSInputPort {
  name: string;
  table_id: string; // UUID reference to ODCS table
  description?: string;
}
```

**Recommendation**: SDK should support both structures, or add a simplified port format.

#### 4.2 Support Structure Alignment

**Current SDK Schema:**
```json
"support": {
  "properties": {
    "team": { "type": "string" },
    "sla": { "type": "object" }
  }
}
```

**Required SDK Schema:**
```json
"support": {
  "properties": {
    "team": { "type": "string" },
    "contact": { "type": "string" },
    "slack_channel": { "type": "string" },
    "documentation_url": { "type": "string", "format": "uri" }
  }
}
```

---

## 5. CADS Schema (cads-schema.json)

### SDK Feature Request Required: Yes (Minor)

### Changes Needed in SDK

#### 5.1 New Fields to Add

| Field | Type | Description |
|-------|------|-------------|
| `runtime` | object | Runtime environment configuration |
| `risk` | object | Risk assessment information |
| `compliance` | object | Compliance requirements |
| `validationProfiles` | string[] | Applied validation profiles |
| `bpmn_models` | CADSBPMNModel[] | BPMN model references |
| `dmn_models` | CADSDMNModel[] | DMN model references |
| `openapi_specs` | CADSOpenAPISpec[] | OpenAPI spec references |

#### 5.2 Kind Enum Addition

Add `kind` field with values:
- `AIModel`
- `MLPipeline`
- `Application`
- `DataPipeline`
- `ETLProcess`

---

## Implementation Plan

### Phase 1: SDK Feature Request (Week 1)

Create GitHub issue in SDK repository requesting:

1. **Decision Schema Updates**
   - Change `number` to integer (timestamp-based)
   - Add `rejected` to status enum
   - Update category enum
   - Add new fields (options, RACI, relationships)

2. **Knowledge Schema Updates**
   - Change `number` from string pattern to integer (timestamp-based)
   - Update type and status enums
   - Change `author` to `authors` array
   - Add new fields (summary, reviewers, relationships)

3. **Minor Updates**
   - ODPS support structure alignment
   - CADS additional fields
   - ODCS relationships field

### Phase 2: SDK Implementation (SDK Team)

SDK team implements schema changes and releases new version.

### Phase 3: Frontend Alignment (After SDK Release)

1. Update frontend types to exactly match new SDK schemas
2. Add any missing SDK fields to frontend types
3. Implement DataQuality support for ODCS
4. Update validation to match SDK patterns

### Phase 4: Migration Support

1. Create migration utility for existing workspaces
2. Convert legacy sequential numbers to timestamp format
3. Convert `KB-XXXX` strings to integer timestamps
4. Update `author` string to `authors` array

---

## SDK Feature Request Template

```markdown
# Feature Request: Schema Updates for v2.0

## Summary
Update Decision and Knowledge schemas to support timestamp-based numbering 
and align with frontend type definitions.

## Breaking Changes

### Decision Schema
- `number`: Change from sequential integer to timestamp-based integer (YYMMDDHHmm format)
- `category`: Update enum values

### Knowledge Schema  
- `number`: Change from string pattern `KB-XXXX` to timestamp-based integer
- `author`: Change from string to `authors` array

## Rationale
Timestamp-based numbering prevents merge conflicts when multiple users create 
records on different systems and merge via Git. Sequential numbers and string 
patterns don't work in distributed workflows.

## New Fields Required
See detailed field lists in alignment plan document.

## Migration Path
Provide migration utilities to convert:
- Sequential decision numbers to timestamps
- `KB-XXXX` strings to timestamp integers
- `author` string to `authors` array
```

---

## Files Reference

### Frontend Types
- `/frontend/src/types/decision.ts` - Decision types with timestamp-based numbers
- `/frontend/src/types/knowledge.ts` - Knowledge types with timestamp-based numbers
- `/frontend/src/types/odcs.ts` - ODCS table types (file was empty in check)
- `/frontend/src/types/odps.ts` - ODPS data product types
- `/frontend/src/types/cads.ts` - CADS compute asset types
- `/frontend/src/types/workspace.ts` - Workspace and relationship types

### SDK Schemas
- `decision-schema.json` - Decision record schema
- `knowledge-schema.json` - Knowledge article schema
- `odcs-schema.json` - ODCS table schema
- `odps-schema.json` - ODPS data product schema
- `cads-schema.json` - CADS compute asset schema
- `workspace-schema.json` - Workspace schema

---

## Priority Summary

1. **High Priority (SDK Update Required)**
   - Decision number format change
   - Knowledge number format change
   - Decision/Knowledge enum alignments

2. **Medium Priority**
   - ODCS DataQuality support
   - ODPS port structure alignment
   - New relationship fields

3. **Low Priority**
   - CADS additional fields
   - Minor field additions across schemas
