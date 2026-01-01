/**
 * useCanvas Hook
 * Provides canvas interaction handlers for ReactFlow
 */

import { useCallback } from 'react';
import { Node, Edge, Connection } from 'reactflow';
import { useModelStore } from '@/stores/modelStore';
import { relationshipService } from '@/services/api/relationshipService';
import { checkCircularRelationshipWarning } from '@/utils/validation';

export interface UseCanvasReturn {
  onNodeClick: (event: React.MouseEvent, node: Node) => void;
  onNodeDragStop: (event: React.MouseEvent, node: Node) => Promise<void>;
  onEdgeClick: (event: React.MouseEvent, edge: Edge) => void;
  onConnect: (connection: Connection) => Promise<void>;
}

export function useCanvas(_workspaceId: string, domainId: string): UseCanvasReturn {
  const {
    tables,
    relationships,
    setSelectedTable,
    setSelectedRelationship,
    updateTable,
    updateTableRemote,
  } = useModelStore();

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedTable(node.id);
    },
    [setSelectedTable]
  );

  const onNodeDragStop = useCallback(
    async (_event: React.MouseEvent, node: Node) => {
      if (!node.position) return;

      // Update local state immediately
      updateTable(node.id, {
        position_x: node.position.x,
        position_y: node.position.y,
      });

      // Update remote state
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
    },
    [domainId, tables, updateTable, updateTableRemote]
  );

  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      setSelectedRelationship(edge.id);
    },
    [setSelectedRelationship]
  );

  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      // Check for circular dependency warning
      const warning = checkCircularRelationshipWarning(
        relationships,
        connection.source,
        connection.target
      );

      if (warning) {
        // Show warning but allow creation
        console.warn(warning);
        // TODO: Show toast notification with warning
      }

      // Create relationship
      try {
        const relationship = await relationshipService.createRelationship(domainId, {
          source_table_id: connection.source,
          target_table_id: connection.target,
          type: 'one-to-many',
          source_cardinality: '1',
          target_cardinality: 'N',
        });

        // Relationship is added to store by the service
        console.log('Relationship created:', relationship);
      } catch (error) {
        console.error('Failed to create relationship:', error);
        // TODO: Show error toast
      }
    },
    [domainId, relationships]
  );

  return {
    onNodeClick,
    onNodeDragStop,
    onEdgeClick,
    onConnect,
  };
}

