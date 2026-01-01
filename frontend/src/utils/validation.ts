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
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
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
  return input.replace(/[<>\"']/g, '');
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

