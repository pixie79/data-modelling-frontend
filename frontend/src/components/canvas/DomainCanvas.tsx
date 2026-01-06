/**
 * Domain Canvas Component
 * Unified canvas for domain-based data modeling with multiple view modes
 * Replaces InfiniteCanvas and DataFlowCanvas
 */

import React, { useMemo, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  NodeTypes,
  EdgeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useModelStore, type ViewMode } from '@/stores/modelStore';
import { useCanvas } from '@/hooks/useCanvas';
import { CanvasNode } from './CanvasNode';
import { CanvasEdge } from './CanvasEdge';
import { TransformationEdge } from './TransformationEdge';
import { SimpleEdge } from './SimpleEdge';
import { SystemNode } from '@/components/views/SystemNode';
import { ComputeAssetNode } from './ComputeAssetNode';
import { DataProductView } from '@/components/views/DataProductView';
import { SystemsViewActions } from '@/components/views/SystemsViewActions';
import { TableViewActions } from '@/components/views/TableViewActions';
import { NodeViewActions } from '@/components/views/NodeViewActions';
import { TableMetadataModal } from '@/components/table/TableMetadataModal';
import { CreateSystemDialog } from '@/components/system/CreateSystemDialog';
import { UnlinkedTablesDialog } from '@/components/system/UnlinkedTablesDialog';
import { ComputeAssetEditor } from '@/components/asset/ComputeAssetEditor';
import { RelationshipEditor } from '@/components/relationship/RelationshipEditor';
import { EditorModal } from '@/components/editors/EditorModal';
import { useUIStore } from '@/stores/uiStore';
import { bpmnService } from '@/services/sdk/bpmnService';
import { dmnService } from '@/services/sdk/dmnService';

export interface DomainCanvasProps {
  workspaceId: string;
  domainId: string;
}

// Custom node and edge types
const nodeTypes: NodeTypes = {
  table: CanvasNode,
  system: SystemNode,
  'compute-asset': ComputeAssetNode,
};

const edgeTypes: EdgeTypes = {
  cardinality: CanvasEdge,
  transformation: TransformationEdge,
  default: SimpleEdge, // Use SimpleEdge for non-table-to-table relationships
};

export const DomainCanvas: React.FC<DomainCanvasProps> = ({ workspaceId, domainId }) => {
  const {
    relationships,
    bpmnProcesses,
    dmnDecisions,
    systems,
    tables,
    computeAssets,
    domains,
    selectedTableId,
    selectedRelationshipId,
    selectedSystemId,
    setSelectedSystem,
    setSelectedTable,
    currentView,
    getFilteredTables,
    updateSystem,
    removeSystem,
    removeComputeAsset,
    removeTable,
    updateBPMNProcess,
    updateDMNDecision,
  } = useModelStore();
  const { addToast } = useUIStore();

  // Use canvas hook for interaction handlers
  const {
    onNodeClick: onTableNodeClick,
    onNodeDragStop,
    onEdgeClick,
    onConnect,
  } = useCanvas(workspaceId, domainId);

  // State for table metadata modal
  const [selectedTableForMetadata, setSelectedTableForMetadata] = React.useState<
    (typeof tables)[0] | null
  >(null);
  const [showTableMetadataModal, setShowTableMetadataModal] = React.useState(false);

  // State for system edit dialog
  const [editingSystemId, setEditingSystemId] = React.useState<string | null>(null);
  const [showSystemEditDialog, setShowSystemEditDialog] = React.useState(false);

  // State for compute asset edit dialog
  const [editingAssetId, setEditingAssetId] = React.useState<string | null>(null);
  const [showAssetEditDialog, setShowAssetEditDialog] = React.useState(false);

  // State for unlinked tables dialog
  const [showUnlinkedTablesDialog, setShowUnlinkedTablesDialog] = React.useState(false);

  // State for relationship editor
  const [editingRelationshipId, setEditingRelationshipId] = React.useState<string | null>(null);
  const [showRelationshipEditor, setShowRelationshipEditor] = React.useState(false);

  // State for BPMN/DMN editors
  const [showBPMNEditor, setShowBPMNEditor] = React.useState(false);
  const [showDMNEditor, setShowDMNEditor] = React.useState(false);
  const [editingBPMNProcessId, setEditingBPMNProcessId] = React.useState<string | null>(null);
  const [editingDMNDecisionId, setEditingDMNDecisionId] = React.useState<string | null>(null);

  // Listen for edit-relationship event (double-click on edge)
  React.useEffect(() => {
    const handleEditRelationship = (event: CustomEvent<{ relationshipId: string }>) => {
      setEditingRelationshipId(event.detail.relationshipId);
      setShowRelationshipEditor(true);
    };

    window.addEventListener('edit-relationship', handleEditRelationship as EventListener);
    return () => {
      window.removeEventListener('edit-relationship', handleEditRelationship as EventListener);
    };
  }, []);

  // Handle table card click (from SystemNode)
  const handleTableCardClick = React.useCallback(
    (table: (typeof tables)[0]) => {
      setSelectedTableForMetadata(table);
      setShowTableMetadataModal(true);
      setSelectedTable(table.id);
    },
    [setSelectedTable]
  );

  // Handle table edit
  const handleTableEdit = React.useCallback(
    (tableId: string) => {
      setSelectedTable(tableId);
      // The ModelEditor will handle opening the table editor when selectedTableId changes
    },
    [setSelectedTable]
  );

  // Handle table delete
  const handleTableDelete = React.useCallback(
    (tableId: string) => {
      const table = tables.find((t) => t.id === tableId);
      if (!table) return;

      if (confirm(`Are you sure you want to delete the table "${table.name}"?`)) {
        removeTable(tableId);
        // Remove from system if it's in one
        const system = systems.find((s) => s.table_ids?.includes(tableId));
        if (system) {
          const updatedTableIds = system.table_ids?.filter((id) => id !== tableId) || [];
          updateSystem(system.id, { table_ids: updatedTableIds });
        }
      }
    },
    [tables, systems, removeTable, updateSystem]
  );

  // Handle table export
  const handleTableExport = React.useCallback(
    async (tableId: string) => {
      const table = tables.find((t) => t.id === tableId);
      if (!table) return;

      try {
        const { odcsService } = await import('@/services/sdk/odcsService');
        const { browserFileService } = await import('@/services/platform/browser');
        const workspace = {
          workspace_id: table.workspace_id,
          domain_id: table.primary_domain_id || domainId,
          tables: [table],
        };
        const yamlContent = await odcsService.toYAML(workspace);
        const fileName = `${table.name.replace(/\s+/g, '_')}.odcs.yaml`;
        browserFileService.downloadFile(fileName, yamlContent, 'text/yaml');

        useUIStore.getState().addToast({
          type: 'success',
          message: `Exported ${table.name} as ODCS YAML`,
        });
      } catch (error) {
        useUIStore.getState().addToast({
          type: 'error',
          message: `Failed to export table: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    },
    [tables, domainId]
  );

  // Handle system edit
  const handleSystemEdit = React.useCallback((systemId: string) => {
    setEditingSystemId(systemId);
    setShowSystemEditDialog(true);
  }, []);

  // Handle system delete
  const handleSystemDelete = React.useCallback(
    (systemId: string) => {
      const system = systems.find((s) => s.id === systemId);
      if (!system) return;

      if (
        confirm(
          `Are you sure you want to delete the system "${system.name}"? This will remove all associated tables and assets from this system.`
        )
      ) {
        removeSystem(systemId);
        if (selectedSystemId === systemId) {
          setSelectedSystem(null);
        }
      }
    },
    [systems, selectedSystemId, removeSystem, setSelectedSystem]
  );

  // Handle compute asset edit
  const handleAssetEdit = React.useCallback((assetId: string) => {
    setEditingAssetId(assetId);
    setShowAssetEditDialog(true);
  }, []);

  // Handle compute asset delete
  const handleAssetDelete = React.useCallback(
    (assetId: string) => {
      const asset = computeAssets.find((a) => a.id === assetId);
      if (!asset) return;

      if (confirm(`Are you sure you want to delete the compute asset "${asset.name}"?`)) {
        removeComputeAsset(assetId);
      }
    },
    [computeAssets, removeComputeAsset]
  );

  // Handle compute asset export
  const handleAssetExport = React.useCallback(
    async (assetId: string) => {
      const asset = computeAssets.find((a) => a.id === assetId);
      if (!asset) return;

      try {
        const { cadsService } = await import('@/services/sdk/cadsService');
        const { browserFileService } = await import('@/services/platform/browser');
        const yamlContent = await cadsService.toYAML(asset);
        const fileName = `${asset.name.replace(/\s+/g, '_')}.cads.yaml`;
        browserFileService.downloadFile(fileName, yamlContent, 'text/yaml');

        useUIStore.getState().addToast({
          type: 'success',
          message: `Exported ${asset.name} as CADS YAML`,
        });
      } catch (error) {
        useUIStore.getState().addToast({
          type: 'error',
          message: `Failed to export asset: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    },
    [computeAssets]
  );

  // Handle BPMN click on table (open BPMN process linked via transformation_links)
  const handleTableBPMNClick = React.useCallback(
    (tableId: string) => {
      // Find BPMN process that has transformation links involving this table
      const linkedProcess = bpmnProcesses.find(
        (p) =>
          p.domain_id === domainId &&
          p.transformation_links?.some(
            (link) => link.source_table_id === tableId || link.target_table_id === tableId
          )
      );

      if (linkedProcess) {
        setEditingBPMNProcessId(linkedProcess.id);
        setShowBPMNEditor(true);
      } else {
        useUIStore.getState().addToast({
          type: 'info',
          message: 'No BPMN process found for this table',
        });
      }
    },
    [bpmnProcesses, domainId]
  );

  // Handle BPMN click on compute asset
  const handleAssetBPMNClick = React.useCallback(
    (assetId: string) => {
      const asset = computeAssets.find((a) => a.id === assetId);
      if (!asset || !asset.bpmn_link) return;

      const process = bpmnProcesses.find((p) => p.id === asset.bpmn_link);
      if (process) {
        setEditingBPMNProcessId(process.id);
        setShowBPMNEditor(true);
      }
    },
    [computeAssets, bpmnProcesses]
  );

  // Handle DMN click on compute asset
  const handleAssetDMNClick = React.useCallback(
    (assetId: string) => {
      const asset = computeAssets.find((a) => a.id === assetId);
      if (!asset || !asset.dmn_link) return;

      const { dmnDecisions } = useModelStore.getState();
      const decision = dmnDecisions.find((d) => d.id === asset.dmn_link);
      if (decision) {
        setEditingDMNDecisionId(decision.id);
        setShowDMNEditor(true);
      }
    },
    [computeAssets]
  );

  // Check if table has BPMN link via transformation_links
  const tableHasBPMN = React.useCallback(
    (tableId: string): boolean => {
      return bpmnProcesses.some(
        (p) =>
          p.domain_id === domainId &&
          p.transformation_links?.some(
            (link) => link.source_table_id === tableId || link.target_table_id === tableId
          )
      );
    },
    [bpmnProcesses, domainId]
  );

  // Handle system node clicks
  const onNodeClick = React.useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.type === 'system') {
        const systemId = node.id;
        if (selectedSystemId === systemId) {
          // Deselect if clicking the same system
          setSelectedSystem(null);
        } else {
          // Select system and switch to Process view for drill-down
          setSelectedSystem(systemId);
          if (currentView === 'systems') {
            useModelStore.getState().setCurrentView('process');
          }
        }
      } else if (node.type === 'compute-asset') {
        // Don't do anything on click for compute assets - edit/delete/export handled by buttons
        // Just prevent it from routing to table editor
        return;
      } else {
        // Handle table node clicks (for non-Systems views)
        onTableNodeClick(_event, node);
      }
    },
    [selectedSystemId, currentView, setSelectedSystem, onTableNodeClick]
  );

  // Get filtered tables based on view mode and data level
  const visibleTables = useMemo(() => {
    const allTables = tables;
    let filtered = getFilteredTables();

    console.log(`[DomainCanvas] Filtering tables for domain ${domainId}:`, {
      totalTables: allTables.length,
      filteredCount: filtered.length,
      currentView,
      selectedSystemId,
      tables: allTables.map((t) => ({
        id: t.id,
        name: t.name,
        primary_domain_id: t.primary_domain_id,
        visible_domains: t.visible_domains,
      })),
      filtered: filtered.map((t) => ({
        id: t.id,
        name: t.name,
        primary_domain_id: t.primary_domain_id,
        visible_domains: t.visible_domains,
      })),
    });

    // If a system is selected, filter tables by system
    if (
      selectedSystemId &&
      (currentView === 'process' || currentView === 'operational' || currentView === 'analytical')
    ) {
      const selectedSystem = systems.find((s) => s.id === selectedSystemId);
      console.log(`[DomainCanvas] Filtering by selected system ${selectedSystemId}:`, {
        system: selectedSystem
          ? {
              id: selectedSystem.id,
              name: selectedSystem.name,
              table_ids: selectedSystem.table_ids,
            }
          : null,
        filteredBefore: filtered.length,
      });
      if (selectedSystem && selectedSystem.table_ids) {
        filtered = filtered.filter((t) => selectedSystem.table_ids?.includes(t.id));
        console.log(`[DomainCanvas] Filtered to ${filtered.length} table(s) after system filter`);
      }
    }

    return filtered;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getFilteredTables, currentView, domainId, selectedSystemId, systems, tables]);

  // Get systems for current domain
  const domainSystems = useMemo(() => {
    const filtered = systems.filter((s) => s.domain_id === domainId);
    console.log(`[DomainCanvas] Filtering systems for domain ${domainId}:`, {
      totalSystems: systems.length,
      filteredCount: filtered.length,
      systems: systems.map((s) => ({ id: s.id, name: s.name, domain_id: s.domain_id })),
      filtered: filtered.map((s) => ({ id: s.id, name: s.name, domain_id: s.domain_id })),
    });
    return filtered;
  }, [systems, domainId]);

  // Find unlinked tables (tables that don't appear in any system's table_ids)
  const unlinkedTables = useMemo(() => {
    const allTableIdsInSystems = new Set(domainSystems.flatMap((s) => s.table_ids || []));

    return tables.filter(
      (t) => t.primary_domain_id === domainId && !allTableIdsInSystems.has(t.id)
    );
  }, [tables, domainSystems, domainId]);

  // Get compute assets for current domain
  const domainComputeAssets = useMemo(() => {
    let assets = computeAssets.filter((a) => a.domain_id === domainId);

    // If a system is selected, filter assets by system
    if (
      selectedSystemId &&
      (currentView === 'process' || currentView === 'operational' || currentView === 'analytical')
    ) {
      const selectedSystem = systems.find((s) => s.id === selectedSystemId);
      if (selectedSystem && selectedSystem.asset_ids) {
        assets = assets.filter((a) => selectedSystem.asset_ids?.includes(a.id));
      }
    }

    return assets;
  }, [computeAssets, domainId, selectedSystemId, currentView, systems]);

  // Filter relationships for current domain
  const domainRelationships = useMemo(() => {
    return relationships.filter((rel) => rel.domain_id === domainId);
  }, [relationships, domainId]);

  // Convert systems and tables to ReactFlow nodes
  const initialNodes: Node[] = useMemo(() => {
    const nodes: Node[] = [];

    // Get domain to access view_positions
    const domain = domains.find((d) => d.id === domainId);
    const viewPositions = domain?.view_positions?.[currentView] || {};

    // In Systems view, show systems as nodes with table cards inside
    if (currentView === 'systems') {
      domainSystems.forEach((system, index) => {
        // Get tables belonging to this system
        const systemTables = visibleTables.filter((table) => system.table_ids?.includes(table.id));

        // Get compute assets belonging to this system
        const systemAssets = domainComputeAssets.filter((asset) =>
          system.asset_ids?.includes(asset.id)
        );

        // Use view-specific position if available, then fallback to system.position_x/y, then default
        const defaultX = 100 + (index % 3) * 450;
        const defaultY = 100 + Math.floor(index / 3) * 500;
        const viewPos = viewPositions[system.id];
        const positionX = viewPos?.x ?? system.position_x ?? defaultX;
        const positionY = viewPos?.y ?? system.position_y ?? defaultY;

        nodes.push({
          id: system.id,
          type: 'system',
          position: {
            x: positionX,
            y: positionY,
          },
          draggable: true,
          data: {
            systemId: system.id,
            systemName: system.name,
            systemType: system.system_type,
            description: system.description,
            tables: systemTables,
            computeAssets: systemAssets,
            onTableClick: handleTableCardClick,
            onTableBPMNClick: handleTableBPMNClick,
            tableHasBPMN: tableHasBPMN,
            onEdit: handleSystemEdit,
            onDelete: handleSystemDelete,
            onAssetEdit: handleAssetEdit,
            onAssetDelete: handleAssetDelete,
            onAssetExport: handleAssetExport,
            onAssetBPMNClick: handleAssetBPMNClick,
            onAssetDMNClick: handleAssetDMNClick,
            currentView: currentView,
          },
          selected: selectedSystemId === system.id,
        });
      });

      // In Systems View, don't add tables or assets as separate nodes - they're shown as cards inside systems
      return nodes;
    }

    // For other views (Process, Operational, Analytical), show tables and compute assets as separate nodes
    const tableNodes = visibleTables.map((table, index) => {
      const isOwnedByDomain = table.primary_domain_id === domainId;

      // Use view-specific position if available, then fallback to table.position_x/y, then default
      const defaultX = 100 + (index % 4) * 300;
      const defaultY = 100 + Math.floor(index / 4) * 200;
      const viewPos = viewPositions[table.id];
      const positionX = viewPos?.x ?? table.position_x ?? defaultX;
      const positionY = viewPos?.y ?? table.position_y ?? defaultY;

      return {
        id: table.id,
        type: 'table',
        position: { x: positionX, y: positionY },
        draggable: true,
        data: {
          table,
          nodeType: 'table',
          isOwnedByDomain,
          // Determine model type based on current view
          modelType: currentView === 'process' ? 'logical' : 'physical',
        },
        selected: selectedTableId === table.id,
      };
    });

    // Add compute asset nodes (only in Process View)
    const computeAssetNodes =
      currentView === 'process'
        ? domainComputeAssets.map((asset) => {
            // Use view-specific position if available, then fallback to asset.position_x/y, then default
            const centerX = window.innerWidth / 2 - 200;
            const centerY = window.innerHeight / 2 - 150;
            const viewPos = viewPositions[asset.id];
            const positionX = viewPos?.x ?? asset.position_x ?? centerX;
            const positionY = viewPos?.y ?? asset.position_y ?? centerY;

            return {
              id: asset.id,
              type: 'compute-asset',
              position: { x: positionX, y: positionY },
              draggable: true,
              data: {
                asset,
                nodeType: 'compute-asset' as const,
                onEdit: handleAssetEdit,
                onDelete: handleAssetDelete,
                onExport: handleAssetExport,
                onBPMNClick: handleAssetBPMNClick,
                onDMNClick: handleAssetDMNClick,
              },
              selected: false,
            };
          })
        : [];

    return [...nodes, ...tableNodes, ...computeAssetNodes];
  }, [
    domainSystems,
    visibleTables,
    domainComputeAssets,
    selectedTableId,
    selectedSystemId,
    domainId,
    currentView,
    domains,
    handleTableCardClick,
    handleTableEdit,
    handleTableDelete,
    handleTableExport,
    handleSystemEdit,
    handleSystemDelete,
    handleAssetEdit,
    handleAssetDelete,
    handleAssetExport,
  ]);

  // Get transformation links from BPMN processes
  const transformationLinks = useMemo(() => {
    return bpmnProcesses
      .filter((p) => p.domain_id === domainId && p.transformation_links)
      .flatMap((p) => p.transformation_links || []);
  }, [bpmnProcesses, domainId]);

  // Convert relationships to ReactFlow edges
  const initialEdges: Edge[] = useMemo(() => {
    const relationshipEdges = domainRelationships
      .filter((rel) => {
        // Get source and target IDs (support both new format and legacy format)
        const sourceId = rel.source_id || rel.source_table_id || '';
        const targetId = rel.target_id || rel.target_table_id || '';
        const sourceType = rel.source_type || (rel.source_table_id ? 'table' : 'table');
        const targetType = rel.target_type || (rel.target_table_id ? 'table' : 'table');

        // Check if source is visible
        let sourceVisible = false;
        if (sourceType === 'table') {
          sourceVisible = visibleTables.some((t) => t.id === sourceId);
        } else if (sourceType === 'system') {
          sourceVisible = domainSystems.some((s) => s.id === sourceId);
        } else if (sourceType === 'compute-asset') {
          sourceVisible = domainComputeAssets.some((a) => a.id === sourceId);
        }

        // Check if target is visible
        let targetVisible = false;
        if (targetType === 'table') {
          targetVisible = visibleTables.some((t) => t.id === targetId);
        } else if (targetType === 'system') {
          targetVisible = domainSystems.some((s) => s.id === targetId);
        } else if (targetType === 'compute-asset') {
          targetVisible = domainComputeAssets.some((a) => a.id === targetId);
        }

        return sourceVisible && targetVisible;
      })
      .map((relationship) => {
        // Get source and target IDs (support both new format and legacy format)
        const sourceId = relationship.source_id || relationship.source_table_id || '';
        const targetId = relationship.target_id || relationship.target_table_id || '';
        const sourceType =
          relationship.source_type || (relationship.source_table_id ? 'table' : 'table');
        const targetType =
          relationship.target_type || (relationship.target_table_id ? 'table' : 'table');

        // Use Crow's Foot notation (cardinality edge) only for table-to-table relationships
        // in Operational and Analytical views
        const isTableToTable = sourceType === 'table' && targetType === 'table';
        const useCardinalityEdge =
          isTableToTable && (currentView === 'operational' || currentView === 'analytical');

        return {
          id: relationship.id,
          type: useCardinalityEdge ? 'cardinality' : 'default', // Use default edge for non-table relationships
          source: sourceId,
          target: targetId,
          data: { relationship },
          selected: selectedRelationshipId === relationship.id,
          animated: false,
          style: { stroke: '#374151', strokeWidth: 2 },
        };
      });

    // Add transformation links as edges (only in Process view)
    const transformationEdges =
      currentView === 'process'
        ? transformationLinks
            .filter((link) => {
              const sourceVisible = visibleTables.some((t) => t.id === link.source_table_id);
              const targetVisible = visibleTables.some((t) => t.id === link.target_table_id);
              return sourceVisible && targetVisible;
            })
            .map((link) => ({
              id: `transformation-${link.id}`,
              type: 'transformation',
              source: link.source_table_id,
              target: link.target_table_id,
              data: { transformationLink: link },
              selected: false,
            }))
        : [];

    return [...relationshipEdges, ...transformationEdges];
  }, [
    domainRelationships,
    visibleTables,
    domainSystems,
    domainComputeAssets,
    selectedRelationshipId,
    transformationLinks,
    currentView,
  ]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Track previous data to only update nodes when actual data changes (not positions)
  interface PrevDataRef {
    tableIds: string[];
    assetIds: string[];
    systemIds: string[];
    currentView: ViewMode;
    tableDataHash?: string;
  }

  const prevDataRef = React.useRef<PrevDataRef>({
    tableIds: [],
    assetIds: [],
    systemIds: [],
    currentView: 'systems',
  });

  // Update nodes when items are added/removed OR when table data changes (e.g., columns)
  useEffect(() => {
    const currentTableIds = visibleTables.map((t) => t.id).sort();
    const currentAssetIds = domainComputeAssets.map((a) => a.id).sort();
    const currentSystemIds = domainSystems.map((s) => s.id).sort();

    // Create a hash of table data to detect changes (not just IDs)
    // Include compoundKeys and metadata.indexes in the hash to detect changes
    const currentTableDataHash = visibleTables
      .map(
        (t) =>
          `${t.id}:${t.name}:${t.columns?.length || 0}:${JSON.stringify(t.columns?.map((c) => `${c.id}:${c.name}:${c.is_primary_key}:${c.compound_key_id || ''}`))}:${JSON.stringify(t.compoundKeys || [])}:${JSON.stringify(t.metadata?.indexes || [])}`
      )
      .join('|');

    const prevTableIds = prevDataRef.current.tableIds;
    const prevAssetIds = prevDataRef.current.assetIds;
    const prevSystemIds = prevDataRef.current.systemIds;
    const prevView = prevDataRef.current.currentView;
    const prevTableDataHash = prevDataRef.current.tableDataHash || '';

    // Check if data actually changed (items added/removed) or view changed
    const tablesChanged =
      currentTableIds.length !== prevTableIds.length ||
      currentTableIds.some((id, idx) => id !== prevTableIds[idx]);
    const assetsChanged =
      currentAssetIds.length !== prevAssetIds.length ||
      currentAssetIds.some((id, idx) => id !== prevAssetIds[idx]);
    const systemsChanged =
      currentSystemIds.length !== prevSystemIds.length ||
      currentSystemIds.some((id, idx) => id !== prevSystemIds[idx]);
    const viewChanged = currentView !== prevView;
    const tableDataChanged = currentTableDataHash !== prevTableDataHash;

    if (tablesChanged || assetsChanged || systemsChanged || viewChanged || tableDataChanged) {
      // Update nodes if data structure changed OR table data changed, preserve current positions from ReactFlow state
      setNodes((currentNodes) => {
        // Create a map of current node positions from ReactFlow (user's current drag positions)
        const positionMap = new Map(currentNodes.map((n) => [n.id, n.position]));

        // Update nodes with new data but preserve positions from ReactFlow state
        // This ensures user drags are preserved even when data changes
        return initialNodes.map((node) => {
          const existingPosition = positionMap.get(node.id);
          // Use existing position if available (preserves user drags), otherwise use initial position
          return {
            ...node,
            position: existingPosition || node.position,
          };
        });
      });

      prevDataRef.current = {
        tableIds: currentTableIds,
        assetIds: currentAssetIds,
        systemIds: currentSystemIds,
        currentView,
        tableDataHash: currentTableDataHash,
      };
    }
    // Note: We don't update positions from store when data hasn't changed
    // ReactFlow manages positions during drag, and positions are saved via onNodeDragStop
    // This prevents overriding user drags
  }, [visibleTables, domainComputeAssets, domainSystems, currentView, initialNodes, setNodes]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  // For Products view, show product-specific visualization (not ReactFlow)
  if (currentView === 'products') {
    return (
      <div className="w-full h-full" data-testid="domain-canvas">
        <DataProductView workspaceId={workspaceId} domainId={domainId} />
      </div>
    );
  }

  // For Systems/Process/Operational/Analytical views, show ReactFlow canvas
  return (
    <div className="w-full h-full relative" data-testid="domain-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={true}
        nodesConnectable={true}
        elementsSelectable={true}
        fitView
        attributionPosition="bottom-left"
        edgesUpdatable={false}
        edgesFocusable={true}
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>

      {/* Create/Import System button - only in Systems view */}
      {currentView === 'systems' && (
        <>
          <SystemsViewActions domainId={domainId} />
          {/* Show unlinked tables notification - positioned below SystemsViewActions */}
          {unlinkedTables.length > 0 && (
            <div className="absolute top-20 right-4 z-10">
              <button
                onClick={() => setShowUnlinkedTablesDialog(true)}
                className="px-4 py-2 bg-yellow-500 text-white rounded-lg shadow-lg hover:bg-yellow-600 transition-colors flex items-center gap-2 text-sm font-medium"
                title={`${unlinkedTables.length} table${unlinkedTables.length !== 1 ? 's' : ''} not linked to any system`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                {unlinkedTables.length} Unlinked Table{unlinkedTables.length !== 1 ? 's' : ''}
              </button>
            </div>
          )}
        </>
      )}

      {/* Create/Import Table buttons - only in Process, Operational, and Analytical views */}
      {(currentView === 'process' ||
        currentView === 'operational' ||
        currentView === 'analytical') && (
        <>
          <TableViewActions workspaceId={workspaceId} domainId={domainId} />
          {currentView === 'process' && <NodeViewActions domainId={domainId} />}
        </>
      )}

      {/* Table Metadata Modal */}
      <TableMetadataModal
        table={selectedTableForMetadata}
        isOpen={showTableMetadataModal}
        onClose={() => {
          setShowTableMetadataModal(false);
          setSelectedTableForMetadata(null);
        }}
      />

      {/* System Edit Dialog */}
      {editingSystemId && (
        <CreateSystemDialog
          domainId={domainId}
          isOpen={showSystemEditDialog}
          editingSystemId={editingSystemId}
          onClose={() => {
            setShowSystemEditDialog(false);
            setEditingSystemId(null);
          }}
          onCreated={() => {
            setShowSystemEditDialog(false);
            setEditingSystemId(null);
          }}
        />
      )}

      {/* Compute Asset Edit Dialog */}
      {editingAssetId && (
        <ComputeAssetEditor
          asset={computeAssets.find((a) => a.id === editingAssetId)}
          domainId={domainId}
          isOpen={showAssetEditDialog}
          onClose={() => {
            setShowAssetEditDialog(false);
            setEditingAssetId(null);
          }}
        />
      )}

      {/* Relationship Editor */}
      {showRelationshipEditor && editingRelationshipId && (
        <RelationshipEditor
          relationshipId={editingRelationshipId}
          isOpen={showRelationshipEditor}
          onClose={() => {
            setShowRelationshipEditor(false);
            setEditingRelationshipId(null);
          }}
        />
      )}

      {/* BPMN Editor Modal */}
      {showBPMNEditor && editingBPMNProcessId && (
        <EditorModal
          type="bpmn"
          isOpen={showBPMNEditor}
          onClose={() => {
            setShowBPMNEditor(false);
            setEditingBPMNProcessId(null);
          }}
          title={`View BPMN Process: ${bpmnProcesses.find((p) => p.id === editingBPMNProcessId)?.name || ''}`}
          size="full"
          bpmnProps={{
            xml: bpmnProcesses.find((p) => p.id === editingBPMNProcessId)?.bpmn_xml,
            name: bpmnProcesses.find((p) => p.id === editingBPMNProcessId)?.name,
            onSave: async (xml: string, name: string) => {
              try {
                const process = await bpmnService.parseXML(xml);
                updateBPMNProcess(editingBPMNProcessId, {
                  ...process,
                  id: editingBPMNProcessId,
                  name: name.trim() || process.name || 'Untitled Process',
                });
                addToast({
                  type: 'success',
                  message: 'BPMN process saved successfully',
                });
                setShowBPMNEditor(false);
                setEditingBPMNProcessId(null);
              } catch (error) {
                addToast({
                  type: 'error',
                  message: error instanceof Error ? error.message : 'Failed to save BPMN process',
                });
              }
            },
          }}
        />
      )}

      {/* DMN Editor Modal */}
      {showDMNEditor && editingDMNDecisionId && (
        <EditorModal
          type="dmn"
          isOpen={showDMNEditor}
          onClose={() => {
            setShowDMNEditor(false);
            setEditingDMNDecisionId(null);
          }}
          title={`View DMN Decision: ${dmnDecisions.find((d) => d.id === editingDMNDecisionId)?.name || ''}`}
          size="full"
          dmnProps={{
            xml: dmnDecisions.find((d) => d.id === editingDMNDecisionId)?.dmn_xml,
            name: dmnDecisions.find((d) => d.id === editingDMNDecisionId)?.name,
            onSave: async (xml: string, name: string) => {
              try {
                const decision = await dmnService.parseXML(xml);
                updateDMNDecision(editingDMNDecisionId, {
                  ...decision,
                  id: editingDMNDecisionId,
                  name: name.trim() || decision.name || 'Untitled Decision',
                });
                addToast({
                  type: 'success',
                  message: 'DMN decision saved successfully',
                });
                setShowDMNEditor(false);
                setEditingDMNDecisionId(null);
              } catch (error) {
                addToast({
                  type: 'error',
                  message: error instanceof Error ? error.message : 'Failed to save DMN decision',
                });
              }
            },
          }}
        />
      )}

      {/* Unlinked Tables Dialog */}
      <UnlinkedTablesDialog
        isOpen={showUnlinkedTablesDialog}
        onClose={() => setShowUnlinkedTablesDialog(false)}
        domainId={domainId}
      />

      {/* Copyright Notice */}
      <div
        style={{
          position: 'absolute',
          bottom: 10,
          right: 10,
          fontSize: '10px',
          color: '#666',
          zIndex: 1000,
          pointerEvents: 'auto',
        }}
      >
        <a
          href="https://opendatamodelling.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#666',
            textDecoration: 'none',
          }}
        >
          © Open Data Modelling | MIT License
        </a>
      </div>
    </div>
  );
};
