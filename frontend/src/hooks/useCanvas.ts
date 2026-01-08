/**
 * useCanvas Hook
 * Provides canvas interaction handlers for ReactFlow
 */

import { useCallback } from 'react';
import { Node, Edge, Connection } from 'reactflow';
import { useModelStore } from '@/stores/modelStore';
import { useUIStore } from '@/stores/uiStore';
import { useSDKModeStore } from '@/services/sdk/sdkMode';
import { relationshipService } from '@/services/api/relationshipService';
import { checkCircularRelationshipWarning } from '@/utils/validation';
import type { Relationship } from '@/types/relationship';

export interface UseCanvasReturn {
  onNodeClick: (event: React.MouseEvent, node: Node) => void;
  onNodeDragStop: (event: React.MouseEvent, node: Node) => Promise<void>;
  onEdgeClick: (event: React.MouseEvent, edge: Edge) => void;
  onConnect: (connection: Connection) => Promise<void>;
}

export function useCanvas(_workspaceId: string, domainId: string): UseCanvasReturn {
  const {
    tables,
    computeAssets,
    systems,
    relationships,
    domains,
    currentView,
    setSelectedTable,
    setSelectedRelationship,
    updateTable,
    updateTableRemote,
    updateComputeAsset,
    updateSystem,
    updateDomain,
  } = useModelStore();
  const { addToast } = useUIStore();
  const { mode } = useSDKModeStore();

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedTable(node.id);
    },
    [setSelectedTable]
  );

  const onNodeDragStop = useCallback(
    async (_event: React.MouseEvent, node: Node) => {
      if (!node.position) return;

      // Check node type
      const isTable = node.type === 'table';
      const isComputeAsset = node.type === 'compute-asset';
      const isSystem = node.type === 'system';

      // Get current domain to update view_positions
      const domain = domains.find((d) => d.id === domainId);
      if (!domain) {
        console.warn(`[useCanvas] Domain ${domainId} not found`);
        return;
      }

      // Initialize view_positions if it doesn't exist
      if (!domain.view_positions) {
        domain.view_positions = {};
      }
      if (!domain.view_positions[currentView]) {
        domain.view_positions[currentView] = {};
      }

      // Save position per view mode
      domain.view_positions[currentView][node.id] = {
        x: node.position.x,
        y: node.position.y,
      };

      // Update domain with new view_positions
      updateDomain(domainId, {
        view_positions: domain.view_positions,
      });

      if (isTable) {
        // Update local state immediately (for backward compatibility)
        updateTable(node.id, {
          position_x: node.position.x,
          position_y: node.position.y,
        });

        // Update remote state only if online
        if (mode === 'online') {
          try {
            await updateTableRemote(domainId, node.id, {
              position_x: node.position.x,
              position_y: node.position.y,
            });
          } catch (error) {
            console.error('Failed to update table position:', error);
            // Revert local state on error
            const table = tables.find((t) => t.id === node.id);
            if (table) {
              updateTable(node.id, {
                position_x: table.position_x,
                position_y: table.position_y,
              });
            }
          }
        }
      } else if (isComputeAsset) {
        // Update compute asset position (for backward compatibility)
        updateComputeAsset(node.id, {
          position_x: node.position.x,
          position_y: node.position.y,
        });
        // Note: Compute assets don't have remote update yet, positions saved on workspace save
      } else if (isSystem) {
        // Update system position (for backward compatibility)
        updateSystem(node.id, {
          position_x: node.position.x,
          position_y: node.position.y,
        });
        // Note: Systems don't have remote update yet, positions saved on workspace save
      }

      // In offline mode, local state update is sufficient
      // Position will be saved when workspace is saved
    },
    [
      domainId,
      domains,
      currentView,
      tables,
      computeAssets,
      systems,
      updateTable,
      updateTableRemote,
      updateComputeAsset,
      updateSystem,
      updateDomain,
      mode,
    ]
  );

  const onEdgeClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      // Double-click to edit relationship
      if (event.detail === 2) {
        setSelectedRelationship(edge.id);
        // Trigger edit dialog - this will be handled by DomainCanvas
        window.dispatchEvent(
          new CustomEvent('edit-relationship', { detail: { relationshipId: edge.id } })
        );
      } else {
        setSelectedRelationship(edge.id);
      }
    },
    [setSelectedRelationship]
  );

  const onConnect = useCallback(
    async (connection: Connection) => {
      console.log('[useCanvas] onConnect called:', connection);
      if (!connection.source || !connection.target) {
        console.warn('[useCanvas] Connection missing source or target:', connection);
        return;
      }

      const { currentView, addRelationship, tables, systems, computeAssets, relationships } =
        useModelStore.getState();
      console.log(
        '[useCanvas] Found tables:',
        tables.length,
        'systems:',
        systems.length,
        'assets:',
        computeAssets.length,
        'relationships:',
        relationships.length
      );

      // Determine source and target types by checking which store they belong to
      const sourceTable = tables.find((t) => t.id === connection.source);
      const sourceSystem = systems.find((s) => s.id === connection.source);
      const sourceAsset = computeAssets.find((a) => a.id === connection.source);

      const targetTable = tables.find((t) => t.id === connection.target);
      const targetSystem = systems.find((s) => s.id === connection.target);
      const targetAsset = computeAssets.find((a) => a.id === connection.target);

      const sourceType: 'table' | 'system' | 'compute-asset' = sourceTable
        ? 'table'
        : sourceSystem
          ? 'system'
          : sourceAsset
            ? 'compute-asset'
            : 'table';
      const targetType: 'table' | 'system' | 'compute-asset' = targetTable
        ? 'table'
        : targetSystem
          ? 'system'
          : targetAsset
            ? 'compute-asset'
            : 'table';

      // For table-to-table relationships, check for circular dependency warning
      if (sourceType === 'table' && targetType === 'table') {
        const warning = checkCircularRelationshipWarning(
          relationships.filter(
            (r): r is Relationship & { source_table_id: string; target_table_id: string } =>
              Boolean(r.source_table_id && r.target_table_id)
          ),
          connection.source,
          connection.target
        );

        if (warning) {
          // Show warning but allow creation
          console.warn(warning);
          addToast({
            type: 'warning',
            message: warning,
          });
        }
      }

      // Create relationship locally (offline mode)
      try {
        const workspaceId =
          sourceTable?.workspace_id || sourceSystem?.domain_id || sourceAsset?.domain_id || '';

        // For table-to-table relationships, use Crow's Foot notation (cardinality)
        // For other relationships, use simple links (no cardinality)
        const isTableToTable = sourceType === 'table' && targetType === 'table';

        // Check for existing relationship between these two tables (for table-to-table only)
        if (isTableToTable) {
          const existingRelationship = relationships.find(
            (rel) =>
              rel.source_type === 'table' &&
              rel.target_type === 'table' &&
              rel.source_id === connection.source &&
              rel.target_id === connection.target &&
              rel.domain_id === domainId
          );

          if (existingRelationship) {
            addToast({
              type: 'error',
              message: `A relationship already exists between these tables. Each table can only have one relationship to another specific table.`,
            });
            console.warn('[useCanvas] Relationship already exists between tables:', {
              source: connection.source,
              target: connection.target,
              existingRelationshipId: existingRelationship.id,
            });
            return;
          }
        }

        // Always use UUIDs for relationship IDs
        const { generateUUID } = await import('@/utils/validation');
        const relationship: import('@/types/relationship').Relationship = {
          id: generateUUID(),
          workspace_id: workspaceId,
          domain_id: domainId,
          source_id: connection.source,
          target_id: connection.target,
          source_type: sourceType,
          target_type: targetType,
          // Legacy fields for backward compatibility
          source_table_id: sourceType === 'table' ? connection.source : undefined,
          target_table_id: targetType === 'table' ? connection.target : undefined,
          type: isTableToTable ? 'one-to-many' : 'one-to-one', // Default to one-to-many for tables, one-to-one for others
          source_cardinality: isTableToTable ? '1' : '1',
          target_cardinality: isTableToTable ? 'N' : '1',
          // Capture connection handle positions (strip 'src-' prefix if present for source handles)
          source_handle: connection.sourceHandle?.replace(/^src-/, '') || undefined,
          target_handle: connection.targetHandle || undefined,
          model_type:
            currentView === 'operational' || currentView === 'analytical'
              ? 'logical'
              : 'conceptual',
          is_circular: false,
          created_at: new Date().toISOString(),
          last_modified_at: new Date().toISOString(),
        };

        // Add relationship to store
        addRelationship(relationship);

        // If online mode, also create via API (only for table-to-table relationships)
        if (mode === 'online' && isTableToTable) {
          try {
            await relationshipService.createRelationship(domainId, {
              source_table_id: connection.source,
              target_table_id: connection.target,
              type: relationship.type,
              source_cardinality: relationship.source_cardinality,
              target_cardinality: relationship.target_cardinality,
            });
          } catch (apiError) {
            console.warn(
              'Failed to create relationship via API, but relationship created locally:',
              apiError
            );
            // Relationship already added locally, so we continue
          }
        }

        addToast({
          type: 'success',
          message: 'Relationship created successfully',
        });
      } catch (error) {
        console.error('Failed to create relationship:', error);
        addToast({
          type: 'error',
          message: `Failed to create relationship: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    },
    [domainId, relationships, addToast, mode]
  );

  return {
    onNodeClick,
    onNodeDragStop,
    onEdgeClick,
    onConnect,
  };
}
