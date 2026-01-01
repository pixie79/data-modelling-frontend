/**
 * Data Flow Diagram List Component
 * Displays list of data flow diagrams and allows creation/selection
 */

import React from 'react';
import { useModelStore } from '@/stores/modelStore';
import { useUIStore } from '@/stores/uiStore';

export interface DataFlowDiagramListProps {
  workspaceId: string;
  onSelectDiagram: (diagramId: string) => void;
  onCreateDiagram: () => void;
}

export const DataFlowDiagramList: React.FC<DataFlowDiagramListProps> = ({
  onSelectDiagram,
  onCreateDiagram,
}) => {
  const { dataFlowDiagrams, selectedDataFlowDiagramId } = useModelStore();
  const { addToast } = useUIStore();

  const handleSelect = (diagramId: string) => {
    onSelectDiagram(diagramId);
  };

  const handleDelete = async (diagramId: string, diagramName: string) => {
    if (window.confirm(`Are you sure you want to delete "${diagramName}"?`)) {
      try {
        const workspaceId = useModelStore.getState().dataFlowDiagrams.find((d) => d.id === diagramId)?.workspace_id;
        if (workspaceId) {
          await useModelStore.getState().deleteDataFlowDiagramRemote(workspaceId, diagramId);
          addToast({
            type: 'success',
            message: `Deleted diagram "${diagramName}"`,
          });
        }
      } catch (error) {
        addToast({
          type: 'error',
          message: `Failed to delete diagram: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 overflow-y-auto">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Data Flow Diagrams</h2>
          <button
            onClick={onCreateDiagram}
            className="px-2 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            title="Create new data flow diagram"
          >
            +
          </button>
        </div>
      </div>

      <div className="p-2">
        {dataFlowDiagrams.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="mb-4">No data flow diagrams</p>
            <button
              onClick={onCreateDiagram}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Create First Diagram
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {dataFlowDiagrams.map((diagram) => (
              <div
                key={diagram.id}
                className={`
                  p-3 border rounded-lg cursor-pointer transition-colors
                  ${selectedDataFlowDiagramId === diagram.id
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }
                `}
                onClick={() => handleSelect(diagram.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-sm">{diagram.name}</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {diagram.nodes.length} nodes, {diagram.connections.length} connections
                    </p>
                    {diagram.linked_tables && diagram.linked_tables.length > 0 && (
                      <p className="text-xs text-blue-600 mt-1">
                        Linked to {diagram.linked_tables.length} table(s)
                      </p>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(diagram.id, diagram.name);
                    }}
                    className="ml-2 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                    title="Delete diagram"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

