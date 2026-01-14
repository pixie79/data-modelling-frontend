/**
 * Validation utilities
 */

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  if (!uuid || typeof uuid !== 'string') {
    return false;
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Generate a valid UUID v4
 * Always returns a properly formatted UUID, even if crypto.randomUUID is not available
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback: Generate UUID v4 manually
  // Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  // where x is any hexadecimal digit and y is one of 8, 9, A, or B
  const hex = '0123456789abcdef';
  const r = () => Math.floor(Math.random() * 16);
  const v = () => (Math.floor(Math.random() * 4) + 8).toString(16); // 8, 9, a, or b

  return [
    Array.from({ length: 8 }, () => hex[r()]).join(''),
    Array.from({ length: 4 }, () => hex[r()]).join(''),
    '4' + Array.from({ length: 3 }, () => hex[r()]).join(''),
    v() + Array.from({ length: 3 }, () => hex[r()]).join(''),
    Array.from({ length: 12 }, () => hex[r()]).join(''),
  ].join('-');
}

/**
 * Normalize a string to a valid UUID
 * If the input is already a valid UUID, returns it unchanged
 * Otherwise, generates a new UUID
 */
export function normalizeUUID(value: string | undefined | null): string {
  if (!value || typeof value !== 'string') {
    return generateUUID();
  }
  if (isValidUUID(value)) {
    return value;
  }
  // Invalid UUID - generate a new one
  console.warn(`[normalizeUUID] Invalid UUID format detected: "${value}". Generating new UUID.`);
  return generateUUID();
}

/**
 * Validate non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validate positive number
 */
export function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && value > 0 && !isNaN(value);
}

/**
 * Validate non-negative number
 */
export function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && value >= 0 && !isNaN(value);
}

/**
 * Validate table name (max 255 chars, alphanumeric + underscore)
 */
export function isValidTableName(name: string): boolean {
  if (!name || name.length > 255) {
    return false;
  }
  const nameRegex = /^[a-zA-Z0-9_]+$/;
  return nameRegex.test(name);
}

/**
 * Validate column name (max 255 chars, alphanumeric + underscore)
 */
export function isValidColumnName(name: string): boolean {
  if (!name || name.length > 255) {
    return false;
  }
  const nameRegex = /^[a-zA-Z0-9_]+$/;
  return nameRegex.test(name);
}

/**
 * Sanitize string input (remove dangerous characters)
 */
export function sanitizeString(input: string): string {
  return input.replace(/[<>"']/g, '');
}

/**
 * Detect circular relationships in a set of relationships
 * Returns true if adding a relationship from source to target would create a cycle
 */
export function detectCircularRelationship(
  relationships: Array<{ source_table_id: string; target_table_id: string }>,
  sourceTableId: string,
  targetTableId: string
): { isCircular: boolean; path?: string[] } {
  // Build adjacency map
  const graph = new Map<string, string[]>();

  // Add existing relationships
  relationships.forEach((rel) => {
    if (!graph.has(rel.source_table_id)) {
      graph.set(rel.source_table_id, []);
    }
    graph.get(rel.source_table_id)!.push(rel.target_table_id);
  });

  // Add the potential new relationship
  if (!graph.has(sourceTableId)) {
    graph.set(sourceTableId, []);
  }
  graph.get(sourceTableId)!.push(targetTableId);

  // DFS to detect cycle
  const visited = new Set<string>();
  const recStack = new Set<string>();
  const path: string[] = [];

  const dfs = (node: string): boolean => {
    if (recStack.has(node)) {
      // Found a cycle
      path.push(node);
      return true;
    }
    if (visited.has(node)) {
      return false;
    }

    visited.add(node);
    recStack.add(node);
    path.push(node);

    const neighbors = graph.get(node) || [];
    for (const neighbor of neighbors) {
      if (dfs(neighbor)) {
        return true;
      }
    }

    recStack.delete(node);
    path.pop();
    return false;
  };

  // Check all nodes
  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      if (dfs(node)) {
        return { isCircular: true, path: [...path] };
      }
    }
  }

  return { isCircular: false };
}

/**
 * Check if a relationship would create a circular dependency
 * Returns warning message if circular, null otherwise
 */
export function checkCircularRelationshipWarning(
  relationships: Array<{ source_table_id: string; target_table_id: string }>,
  sourceTableId: string,
  targetTableId: string
): string | null {
  const result = detectCircularRelationship(relationships, sourceTableId, targetTableId);
  if (result.isCircular) {
    const pathStr = result.path ? result.path.join(' → ') : 'unknown path';
    return `Warning: This relationship creates a circular dependency: ${pathStr}. Circular relationships are allowed but may indicate a design issue.`;
  }
  return null;
}

/**
 * Process nested columns from SQL import (e.g., Databricks STRUCT/ARRAY types)
 * Columns with dot notation (e.g., "parent.child") are converted to a hierarchy
 * and assigned UUIDs with parent_column_id references
 */
export function processNestedColumns(columns: any[], tableId: string): any[] {
  if (!Array.isArray(columns) || columns.length === 0) {
    return columns;
  }

  // Check if columns already have parent_column_id set (from ODCS import)
  const hasExistingHierarchy = columns.some((c) => c.parent_column_id);

  console.log('[processNestedColumns] Processing columns:', {
    count: columns.length,
    columnNames: columns.map((c) => c.name),
    hasExistingHierarchy,
  });

  const columnMap = new Map<string, any>(); // Map column names to column objects
  const originalIdToColumn = new Map<string, any>(); // Map original column IDs to column objects
  const oldIdToNewId = new Map<string, string>(); // Map old IDs to new IDs for parent_column_id updates

  // First pass: Assign UUIDs to all columns and build maps
  columns.forEach((col, index) => {
    const colCopy = { ...col };
    const originalId = col.id;

    // Assign UUID if missing or invalid
    if (!colCopy.id) {
      colCopy.id = generateUUID();
    }

    // Track ID mapping for parent_column_id updates
    if (originalId && originalId !== colCopy.id) {
      oldIdToNewId.set(originalId, colCopy.id);
    }

    // Ensure table_id is set
    if (!colCopy.table_id) {
      colCopy.table_id = tableId;
    }

    // Ensure order is set
    if (colCopy.order === undefined) {
      colCopy.order = index;
    }

    columnMap.set(colCopy.name, colCopy);
    // Map by ORIGINAL ID so we can find parents when child has parent_column_id
    if (originalId) {
      originalIdToColumn.set(originalId, colCopy);
    }
    // Also map by new ID in case IDs weren't changed
    originalIdToColumn.set(colCopy.id, colCopy);
  });

  // If columns already have parent_column_id (from ODCS import), preserve that hierarchy
  // Only use dot notation detection as a fallback for SQL imports
  if (hasExistingHierarchy) {
    // Second pass: Update parent_column_id to new IDs and build nested_columns arrays
    columnMap.forEach((col) => {
      if (col.parent_column_id) {
        // Find parent using the ORIGINAL parent_column_id
        const parentCol = originalIdToColumn.get(col.parent_column_id);
        if (parentCol) {
          // Update parent_column_id to use the parent's NEW ID
          col.parent_column_id = parentCol.id;

          if (!parentCol.nested_columns) {
            parentCol.nested_columns = [];
          }
          // Avoid duplicates
          if (!parentCol.nested_columns.find((c: any) => c.id === col.id)) {
            parentCol.nested_columns.push(col);
          }
        } else {
          // Parent not found - this shouldn't happen but clear the invalid reference
          console.warn(
            `[processNestedColumns] Parent column not found for ${col.name}, parent_column_id: ${col.parent_column_id}`
          );
          col.parent_column_id = undefined;
        }
      }
    });
  } else {
    // No existing hierarchy - use dot notation detection (for SQL imports)
    columnMap.forEach((col) => {
      const nameParts = col.name.split('.');

      if (nameParts.length > 1) {
        // This is a nested column (e.g., "parent.child")
        const parentName = nameParts.slice(0, -1).join('.');
        const parentCol = columnMap.get(parentName);

        if (parentCol) {
          // Link to parent
          col.parent_column_id = parentCol.id;

          // Add to parent's nested_columns array
          if (!parentCol.nested_columns) {
            parentCol.nested_columns = [];
          }
          parentCol.nested_columns.push(col);
        }
      }
    });
  }

  // Return all columns in a flat array (TableEditor will use parent_column_id for hierarchy)
  // Sort to maintain order: root columns first, then nested columns
  const allColumns = Array.from(columnMap.values()).sort((a, b) => {
    // Root columns come first
    if (!a.parent_column_id && b.parent_column_id) return -1;
    if (a.parent_column_id && !b.parent_column_id) return 1;

    // Within same level, sort by order
    return a.order - b.order;
  });

  console.log('[processNestedColumns] Processed columns:', {
    totalColumns: allColumns.length,
    rootColumns: allColumns.filter((c) => !c.parent_column_id).length,
    nestedColumns: allColumns.filter((c) => c.parent_column_id).length,
    hierarchy: allColumns.map((c) => ({
      name: c.name,
      hasParent: !!c.parent_column_id,
      childCount: c.nested_columns?.length || 0,
    })),
  });

  return allColumns;
}

/**
 * Normalize UUIDs in a workspace object to ensure all UUID fields are valid
 * This is critical for SDK export functions which require valid UUIDs
 */
export function normalizeWorkspaceUUIDs(workspace: any): any {
  if (!workspace || typeof workspace !== 'object') {
    return workspace;
  }

  const normalized = { ...workspace };
  const uuidMap = new Map<string, string>(); // Map old invalid UUIDs to new valid ones

  // Normalize workspace-level UUIDs
  if (normalized.workspace_id) {
    const oldId = normalized.workspace_id;
    normalized.workspace_id = normalizeUUID(oldId);
    if (oldId !== normalized.workspace_id) {
      uuidMap.set(oldId, normalized.workspace_id);
    }
  }

  if (normalized.domain_id) {
    const oldId = normalized.domain_id;
    normalized.domain_id = normalizeUUID(oldId);
    if (oldId !== normalized.domain_id) {
      uuidMap.set(oldId, normalized.domain_id);
    }
  }

  // Normalize tables
  if (Array.isArray(normalized.tables)) {
    normalized.tables = normalized.tables.map((table: any) => {
      const normalizedTable = { ...table };

      // Normalize table-level UUIDs
      if (normalizedTable.id) {
        const oldId = normalizedTable.id;
        normalizedTable.id = normalizeUUID(oldId);
        if (oldId !== normalizedTable.id) {
          uuidMap.set(oldId, normalizedTable.id);
        }
      }
      if (normalizedTable.workspace_id) {
        normalizedTable.workspace_id =
          uuidMap.get(normalizedTable.workspace_id) || normalizeUUID(normalizedTable.workspace_id);
      }
      if (normalizedTable.primary_domain_id) {
        normalizedTable.primary_domain_id =
          uuidMap.get(normalizedTable.primary_domain_id) ||
          normalizeUUID(normalizedTable.primary_domain_id);
      }
      if (normalizedTable.table_id) {
        normalizedTable.table_id = normalizeUUID(normalizedTable.table_id);
      }

      // Normalize columns - process nested columns first, then normalize UUIDs
      if (Array.isArray(normalizedTable.columns)) {
        // Process nested columns to build hierarchy
        const processedColumns = processNestedColumns(normalizedTable.columns, normalizedTable.id);

        normalizedTable.columns = processedColumns.map((col: any) => {
          const normalizedCol = { ...col };

          // Ensure UUID is valid (processNestedColumns already assigned UUIDs)
          if (normalizedCol.id) {
            normalizedCol.id = normalizeUUID(normalizedCol.id);
          } else {
            normalizedCol.id = generateUUID();
          }

          if (normalizedCol.table_id) {
            normalizedCol.table_id = normalizedTable.id; // Use normalized table ID
          }
          if (normalizedCol.foreign_key_reference) {
            normalizedCol.foreign_key_reference = normalizeUUID(
              normalizedCol.foreign_key_reference
            );
          }
          if (normalizedCol.compound_key_id) {
            normalizedCol.compound_key_id = normalizeUUID(normalizedCol.compound_key_id);
          }
          if (normalizedCol.parent_column_id) {
            normalizedCol.parent_column_id = normalizeUUID(normalizedCol.parent_column_id);
          }
          return normalizedCol;
        });
      }

      // Normalize compound keys
      if (Array.isArray(normalizedTable.compoundKeys)) {
        normalizedTable.compoundKeys = normalizedTable.compoundKeys.map((ck: any) => {
          const normalizedCK = { ...ck };
          if (normalizedCK.id) {
            normalizedCK.id = normalizeUUID(normalizedCK.id);
          }
          if (normalizedCK.table_id) {
            normalizedCK.table_id = normalizedTable.id; // Use normalized table ID
          }
          if (Array.isArray(normalizedCK.column_ids)) {
            // Map column IDs to normalized column IDs
            normalizedCK.column_ids = normalizedCK.column_ids.map((colId: string) => {
              const col = normalizedTable.columns?.find(
                (c: any) => c.id === colId || c.id === uuidMap.get(colId)
              );
              return col?.id || normalizeUUID(colId);
            });
          }
          return normalizedCK;
        });
      }

      // Normalize indexes in metadata
      if (normalizedTable.metadata && Array.isArray(normalizedTable.metadata.indexes)) {
        normalizedTable.metadata.indexes = normalizedTable.metadata.indexes.map((idx: any) => {
          const normalizedIdx = { ...idx };
          if (normalizedIdx.id) {
            normalizedIdx.id = normalizeUUID(normalizedIdx.id);
          }
          if (Array.isArray(normalizedIdx.column_ids)) {
            normalizedIdx.column_ids = normalizedIdx.column_ids.map((colId: string) => {
              const col = normalizedTable.columns?.find(
                (c: any) => c.id === colId || c.id === uuidMap.get(colId)
              );
              return col?.id || normalizeUUID(colId);
            });
          }
          return normalizedIdx;
        });
      }

      return normalizedTable;
    });
  }

  // Normalize relationships
  if (Array.isArray(normalized.relationships)) {
    normalized.relationships = normalized.relationships.map((rel: any) => {
      const normalizedRel = { ...rel };
      if (normalizedRel.id) {
        normalizedRel.id = normalizeUUID(normalizedRel.id);
      }
      if (normalizedRel.workspace_id) {
        normalizedRel.workspace_id =
          uuidMap.get(normalizedRel.workspace_id) || normalizeUUID(normalizedRel.workspace_id);
      }
      if (normalizedRel.domain_id) {
        normalizedRel.domain_id =
          uuidMap.get(normalizedRel.domain_id) || normalizeUUID(normalizedRel.domain_id);
      }
      if (normalizedRel.source_id) {
        normalizedRel.source_id =
          uuidMap.get(normalizedRel.source_id) || normalizeUUID(normalizedRel.source_id);
      }
      if (normalizedRel.target_id) {
        normalizedRel.target_id =
          uuidMap.get(normalizedRel.target_id) || normalizeUUID(normalizedRel.target_id);
      }
      if (normalizedRel.source_table_id) {
        normalizedRel.source_table_id =
          uuidMap.get(normalizedRel.source_table_id) ||
          normalizeUUID(normalizedRel.source_table_id);
      }
      if (normalizedRel.target_table_id) {
        normalizedRel.target_table_id =
          uuidMap.get(normalizedRel.target_table_id) ||
          normalizeUUID(normalizedRel.target_table_id);
      }
      if (normalizedRel.source_key) {
        normalizedRel.source_key = normalizeUUID(normalizedRel.source_key);
      }
      if (normalizedRel.target_key) {
        normalizedRel.target_key = normalizeUUID(normalizedRel.target_key);
      }
      return normalizedRel;
    });
  }

  return normalized;
}
