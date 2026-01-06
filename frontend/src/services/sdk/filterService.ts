/**
 * Filter Service
 * Wraps SDK filtering functions for tag-based and other filtering
 */

import { sdkLoader } from './sdkLoader';
import type { Table } from '@/types/table';
import type { ComputeAsset } from '@/types/cads';
import type { Relationship } from '@/types/relationship';
import type { System } from '@/types/system';

export interface FilteredWorkspace {
  tables: Table[];
  computeAssets: ComputeAsset[];
  relationships: Relationship[];
  systems: System[];
}

/**
 * Filter workspace resources by tags using SDK's filter_by_tags function
 *
 * Tag formats supported:
 * - Simple: "production" - matches any tag containing "production"
 * - Keyword: "env:production" - matches tags with key "env" and value "production"
 * - Keyword with list: "env:production,staging" - matches tags with key "env" and value "production" OR "staging"
 *
 * @param workspace - The workspace containing tables, compute assets, relationships, and systems
 * @param tags - Array of tag filters to apply
 * @returns Filtered workspace with matching resources, their parents, and relationships
 */
export async function filterByTags(
  workspace: {
    tables: Table[];
    computeAssets: ComputeAsset[];
    relationships: Relationship[];
    systems: System[];
  },
  tags: string[]
): Promise<FilteredWorkspace> {
  try {
    // If no tags, return everything
    if (tags.length === 0) {
      return {
        tables: workspace.tables,
        computeAssets: workspace.computeAssets,
        relationships: workspace.relationships,
        systems: workspace.systems,
      };
    }

    const sdk = await sdkLoader.load();

    if (!sdk.filter_by_tags) {
      console.warn(
        '[filterService] SDK filter_by_tags not available, falling back to client-side filtering'
      );
      return clientSideFilterByTags(workspace, tags);
    }

    // The SDK filter_by_tags expects a workspace JSON string with nodes and relationships
    // We need to convert our workspace structure to match SDK expectations
    const workspaceForSDK = {
      nodes: [
        ...workspace.tables.map((t) => ({ ...t, type: 'table' })),
        ...workspace.computeAssets.map((a) => ({ ...a, type: 'compute_asset' })),
      ],
      relationships: workspace.relationships,
    };

    const workspaceJson = JSON.stringify(workspaceForSDK);

    // Apply each tag filter
    let filteredJson = workspaceJson;
    for (const tag of tags) {
      filteredJson = sdk.filter_by_tags(filteredJson, tag);
    }

    const filteredWorkspace = JSON.parse(filteredJson);

    // Extract filtered resources
    const filteredTables = filteredWorkspace.nodes
      .filter((n: any) => n.type === 'table')
      .map((n: any) => {
        const { type, ...table } = n;
        return table as Table;
      });

    const filteredAssets = filteredWorkspace.nodes
      .filter((n: any) => n.type === 'compute_asset')
      .map((n: any) => {
        const { type, ...asset } = n;
        return asset as ComputeAsset;
      });

    const filteredRelationships = filteredWorkspace.relationships as Relationship[];

    // Include systems that contain any of the filtered resources
    const resourceIds = new Set([
      ...filteredTables.map((t: Table) => t.id),
      ...filteredAssets.map((a: ComputeAsset) => a.id),
    ]);

    const filteredSystems = workspace.systems.filter((system) => {
      // Include system if it contains any filtered tables
      const hasFilteredTables = (system.table_ids || []).some((id: string) => resourceIds.has(id));
      // Include system if it contains any filtered compute assets (asset_ids, not compute_asset_ids)
      const hasFilteredAssets = (system.asset_ids || []).some((id: string) => resourceIds.has(id));
      return hasFilteredTables || hasFilteredAssets;
    });

    return {
      tables: filteredTables,
      computeAssets: filteredAssets,
      relationships: filteredRelationships,
      systems: filteredSystems,
    };
  } catch (error) {
    console.error('[filterService] Error filtering by tags:', error);
    // Fall back to client-side filtering
    return clientSideFilterByTags(workspace, tags);
  }
}

/**
 * Client-side fallback for tag filtering when SDK is not available
 */
function clientSideFilterByTags(
  workspace: {
    tables: Table[];
    computeAssets: ComputeAsset[];
    relationships: Relationship[];
    systems: System[];
  },
  tags: string[]
): FilteredWorkspace {
  // Helper to check if a resource matches any of the tag filters
  const matchesTags = (resourceTags: string[] | undefined): boolean => {
    if (!resourceTags || resourceTags.length === 0) {
      return false;
    }

    return tags.some((filter) => {
      // Simple tag: "production"
      if (!filter.includes(':')) {
        return resourceTags.some((tag) => tag.toLowerCase().includes(filter.toLowerCase()));
      }

      // Keyword tag: "env:production" or "env:production,staging"
      const [key, values] = filter.split(':');
      if (!key || !values) {
        return false;
      }
      const valueList = values.split(',').map((v) => v.trim().toLowerCase());

      return resourceTags.some((tag) => {
        if (!tag.includes(':')) {
          return false;
        }
        const [tagKey, tagValue] = tag.split(':');
        if (!tagKey || !tagValue) {
          return false;
        }
        return (
          tagKey.toLowerCase() === key.toLowerCase() &&
          valueList.some((v) => tagValue.toLowerCase().includes(v))
        );
      });
    });
  };

  // Filter tables and compute assets
  const filteredTables = workspace.tables.filter((t) => matchesTags(t.tags));
  const filteredAssets = workspace.computeAssets.filter((a) => matchesTags(a.tags));

  // Get IDs of filtered resources
  const resourceIds = new Set([
    ...filteredTables.map((t) => t.id),
    ...filteredAssets.map((a) => a.id),
  ]);

  // Include relationships that connect filtered resources
  const filteredRelationships = workspace.relationships.filter(
    (rel) => resourceIds.has(rel.source_id) || resourceIds.has(rel.target_id)
  );

  // Include systems that contain any filtered resources
  const filteredSystems = workspace.systems.filter((system) => {
    const hasFilteredTables = (system.table_ids || []).some((id: string) => resourceIds.has(id));
    const hasFilteredAssets = (system.asset_ids || []).some((id: string) => resourceIds.has(id));
    return hasFilteredTables || hasFilteredAssets;
  });

  return {
    tables: filteredTables,
    computeAssets: filteredAssets,
    relationships: filteredRelationships,
    systems: filteredSystems,
  };
}

export const filterService = {
  filterByTags,
};
