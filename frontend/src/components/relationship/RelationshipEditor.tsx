/**
 * Relationship Editor
 * Dialog for editing relationship properties (type, cardinality, bidirectional)
 */

import React, { useState, useEffect } from 'react';
import { DraggableModal } from '@/components/common/DraggableModal';
import { useModelStore } from '@/stores/modelStore';
import { useUIStore } from '@/stores/uiStore';
import { useSDKModeStore } from '@/services/sdk/sdkMode';
import type { RelationshipType, NewCardinality } from '@/types/relationship';

export interface RelationshipEditorProps {
  relationshipId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const RelationshipEditor: React.FC<RelationshipEditorProps> = ({
  relationshipId,
  isOpen,
  onClose,
}) => {
  const {
    relationships,
    tables,
    systems,
    computeAssets,
    updateRelationship,
    updateRelationshipRemote,
    removeRelationship,
    selectedDomainId,
  } = useModelStore();
  const { addToast } = useUIStore();
  const { mode } = useSDKModeStore();

  const relationship = relationships.find((r) => r.id === relationshipId);

  const [relationshipType, setRelationshipType] = useState<RelationshipType>('one-to-one');
  const [sourceCardinality, setSourceCardinality] = useState<NewCardinality>('oneToOne');
  const [targetCardinality, setTargetCardinality] = useState<NewCardinality>('oneToMany');
  const [sourceKey, setSourceKey] = useState<string>('');
  const [targetKey, setTargetKey] = useState<string>('');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<string>('#000000');
  const [drawioEdgeId, setDrawioEdgeId] = useState<string>('');
  const [sourceHandle, setSourceHandle] = useState<string>('');
  const [targetHandle, setTargetHandle] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // Available connection handle options (matching handles defined in CanvasNode/SystemNode/ComputeAssetNode)
  const handleOptions = [
    { value: '', label: 'Auto (default)' },
    { value: 'top-left', label: 'Top Left' },
    { value: 'top-center', label: 'Top Center' },
    { value: 'top-right', label: 'Top Right' },
    { value: 'right-top', label: 'Right Top' },
    { value: 'right-center', label: 'Right Center' },
    { value: 'right-bottom', label: 'Right Bottom' },
    { value: 'bottom-right', label: 'Bottom Right' },
    { value: 'bottom-center', label: 'Bottom Center' },
    { value: 'bottom-left', label: 'Bottom Left' },
    { value: 'left-bottom', label: 'Left Bottom' },
    { value: 'left-center', label: 'Left Center' },
    { value: 'left-top', label: 'Left Top' },
  ];

  // Convert legacy cardinality format to new SDK format (defined before useEffect)
  const convertLegacyCardinalityValue = (value: string): NewCardinality => {
    // If already in new format, return as-is
    if (['oneToOne', 'oneToMany', 'zeroOrOne', 'zeroOrMany'].includes(value)) {
      return value as NewCardinality;
    }
    // Convert legacy '0', '1', 'N' format
    switch (value) {
      case '0':
        return 'zeroOrOne';
      case '1':
        return 'oneToOne';
      case 'N':
        return 'zeroOrMany';
      default:
        return 'oneToMany';
    }
  };

  // Load relationship data when dialog opens
  useEffect(() => {
    if (relationship && isOpen) {
      setRelationshipType(relationship.type);
      // Convert legacy cardinality values to new format
      setSourceCardinality(convertLegacyCardinalityValue(relationship.source_cardinality));
      setTargetCardinality(convertLegacyCardinalityValue(relationship.target_cardinality));
      setSourceKey(relationship.source_key || '');
      setTargetKey(relationship.target_key || '');
      setLabel(relationship.label || '');
      setDescription(relationship.description || '');
      setColor(relationship.color || '#000000');
      setDrawioEdgeId(relationship.drawio_edge_id || '');
      setSourceHandle(relationship.source_handle || '');
      setTargetHandle(relationship.target_handle || '');
    }
  }, [relationship, isOpen, relationships]);

  // Get available keys for a table (primary keys, foreign keys, unique indexes, and compound keys)
  const getTableKeys = (
    tableId: string
  ): Array<{ id: string; name: string; type: 'PK' | 'FK' | 'IX' | 'compound' }> => {
    const table = tables.find((t) => t.id === tableId);
    if (!table) return [];

    const keys: Array<{ id: string; name: string; type: 'PK' | 'FK' | 'IX' | 'compound' }> = [];

    // Add single column primary keys
    table.columns
      .filter((col) => col.is_primary_key)
      .forEach((col) => {
        keys.push({
          id: col.id,
          name: col.name,
          type: 'PK',
        });
      });

    // Add foreign keys (exclude if already added as PK)
    table.columns
      .filter((col) => col.is_foreign_key && !col.is_primary_key)
      .forEach((col) => {
        keys.push({
          id: col.id,
          name: col.name,
          type: 'FK',
        });
      });

    // Add unique indexes (exclude if already added as PK)
    table.columns
      .filter((col) => col.is_unique && !col.is_primary_key)
      .forEach((col) => {
        keys.push({
          id: col.id,
          name: col.name,
          type: 'IX',
        });
      });

    // Add compound keys
    if (table.compoundKeys) {
      table.compoundKeys.forEach((ck) => {
        const columnNames = ck.column_ids
          .map((colId) => table.columns.find((c) => c.id === colId)?.name)
          .filter(Boolean)
          .join(', ');
        keys.push({
          id: ck.id,
          name: `${ck.name || 'Compound Key'} (${columnNames})`,
          type: 'compound',
        });
      });
    }

    return keys;
  };

  // Derive relationship type from cardinalities
  const getRelationshipTypeFromCardinalities = (
    source: NewCardinality,
    target: NewCardinality
  ): RelationshipType => {
    // Many-to-many: both sides can have many
    if (
      (source === 'zeroOrMany' || source === 'oneToMany') &&
      (target === 'zeroOrMany' || target === 'oneToMany')
    ) {
      return 'many-to-many';
    }
    // One-to-many: one side has many
    if (
      source === 'zeroOrMany' ||
      source === 'oneToMany' ||
      target === 'zeroOrMany' ||
      target === 'oneToMany'
    ) {
      return 'one-to-many';
    }
    // One-to-one: neither side has many
    return 'one-to-one';
  };

  // Get source and target node names for display
  const getNodeName = (nodeId: string, nodeType: 'table' | 'system' | 'compute-asset'): string => {
    if (nodeType === 'table') {
      const table = tables.find((t) => t.id === nodeId);
      return table?.name || table?.alias || nodeId;
    } else if (nodeType === 'system') {
      const system = systems.find((s) => s.id === nodeId);
      return system?.name || nodeId;
    } else {
      const asset = computeAssets.find((a) => a.id === nodeId);
      return asset?.name || nodeId;
    }
  };

  if (!relationship) {
    return null;
  }

  const sourceName = getNodeName(relationship.source_id, relationship.source_type);
  const targetName = getNodeName(relationship.target_id, relationship.target_type);
  const isTableToTable =
    relationship.source_type === 'table' && relationship.target_type === 'table';

  const handleSave = async () => {
    if (!relationship || !selectedDomainId) return;

    setIsSaving(true);
    try {
      const updates = {
        type: relationshipType,
        source_cardinality: sourceCardinality,
        target_cardinality: targetCardinality,
        source_key: isTableToTable && sourceKey ? sourceKey : undefined,
        target_key: isTableToTable && targetKey ? targetKey : undefined,
        source_handle: sourceHandle || undefined,
        target_handle: targetHandle || undefined,
        label: label.trim() || undefined,
        description: description.trim() || undefined,
        color: color !== '#000000' ? color : undefined,
        drawio_edge_id: drawioEdgeId.trim() || undefined,
        last_modified_at: new Date().toISOString(),
      };

      console.log('[RelationshipEditor] Saving relationship:', {
        relationshipId,
        updates,
        currentRelationship: relationship,
      });

      // Update remote first if in online mode (this also updates local store)
      if (mode === 'online') {
        try {
          const updatedRel = await updateRelationshipRemote(
            selectedDomainId,
            relationshipId,
            updates
          );
          console.log('[RelationshipEditor] Relationship updated remotely:', updatedRel);
          // updateRelationshipRemote already updates the store, so we don't need to call updateRelationship again
          // But ensure the relationshipId matches
          if (updatedRel.id !== relationshipId) {
            console.warn('[RelationshipEditor] Remote relationship has different ID:', {
              localId: relationshipId,
              remoteId: updatedRel.id,
            });
            // The store should already be updated by updateRelationshipRemote, but log for debugging
          }
        } catch (error) {
          addToast({
            type: 'error',
            message:
              error instanceof Error ? error.message : 'Failed to update relationship on server',
          });
          setIsSaving(false);
          return;
        }
      } else {
        // Offline mode: update locally only
        updateRelationship(relationshipId, updates);
      }

      // For table-to-table relationships, update reverse relationship if it exists
      // NOTE: We should NOT create reverse relationships here - they should only be created
      // during initial relationship creation (in onConnect handler), not during updates
      if (isTableToTable) {
        // Get fresh relationships from store AFTER the update to avoid stale closure
        // This ensures we see the most recent state including any updates
        const currentRelationships = useModelStore.getState().relationships;

        // Also get the updated relationship to ensure we have the latest data
        const updatedRelationship =
          currentRelationships.find((r) => r.id === relationshipId) || relationship;

        // Check if reverse relationship exists (exclude current relationship)
        const reverseRelationship = currentRelationships.find(
          (r) =>
            r.id !== relationshipId &&
            r.source_id === updatedRelationship.target_id &&
            r.target_id === updatedRelationship.source_id
        );

        console.log('[RelationshipEditor] Checking reverse relationship:', {
          relationshipId,
          sourceId: updatedRelationship.source_id,
          targetId: updatedRelationship.target_id,
          reverseFound: !!reverseRelationship,
          reverseId: reverseRelationship?.id,
          totalRelationships: currentRelationships.length,
        });

        if (reverseRelationship) {
          // Update existing reverse relationship (do NOT create a new one)
          const reverseUpdates = {
            type: relationshipType,
            source_cardinality: targetCardinality, // Swapped
            target_cardinality: sourceCardinality, // Swapped
            label: label.trim() || undefined,
            description: description.trim() || undefined,
            color: color !== '#000000' ? color : undefined,
            last_modified_at: new Date().toISOString(),
          };
          updateRelationship(reverseRelationship.id, reverseUpdates);

          // Update reverse relationship remotely if in online mode
          if (mode === 'online') {
            try {
              await updateRelationshipRemote(
                selectedDomainId,
                reverseRelationship.id,
                reverseUpdates
              );
            } catch (error) {
              console.warn('Failed to update reverse relationship on server:', error);
            }
          }
        }
      }

      addToast({
        type: 'success',
        message: 'Relationship updated successfully',
      });
      onClose();
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to update relationship',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReverse = () => {
    if (!relationship) return;

    // Swap source and target
    const newSourceId = relationship.target_id;
    const newTargetId = relationship.source_id;
    const newSourceType = relationship.target_type;
    const newTargetType = relationship.source_type;

    // Swap cardinalities (convert to new format for local state)
    const newSourceCardinality = convertLegacyCardinalityValue(relationship.target_cardinality);
    const newTargetCardinality = convertLegacyCardinalityValue(relationship.source_cardinality);

    // Update the relationship
    updateRelationship(relationshipId, {
      source_id: newSourceId,
      target_id: newTargetId,
      source_type: newSourceType,
      target_type: newTargetType,
      source_cardinality: newSourceCardinality,
      target_cardinality: newTargetCardinality,
      source_table_id: newSourceType === 'table' ? newSourceId : undefined,
      target_table_id: newTargetType === 'table' ? newTargetId : undefined,
      last_modified_at: new Date().toISOString(),
    });

    // Update local state to reflect the swap
    setSourceCardinality(newSourceCardinality);
    setTargetCardinality(newTargetCardinality);

    addToast({
      type: 'success',
      message: 'Relationship reversed successfully',
    });
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this relationship?')) {
      removeRelationship(relationshipId);

      // Also remove reverse relationship if it exists
      const reverseRelationship = relationships.find(
        (r) => r.source_id === relationship.target_id && r.target_id === relationship.source_id
      );
      if (reverseRelationship) {
        removeRelationship(reverseRelationship.id);
      }

      addToast({
        type: 'success',
        message: 'Relationship deleted successfully',
      });
      onClose();
    }
  };

  return (
    <DraggableModal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Relationship"
      size="md"
      initialPosition={{
        x: window.innerWidth / 2 - 250,
        y: window.innerHeight / 2 - 200,
      }}
    >
      <div className="flex flex-col max-h-[70vh]">
        <div className="space-y-4 overflow-y-auto flex-1 pr-2">
          {/* Relationship Info */}
          <div className="p-3 bg-gray-50 rounded-md">
            <div className="text-sm text-gray-600">
              <span className="font-medium">{sourceName}</span>
              <span className="mx-2">→</span>
              <span className="font-medium">{targetName}</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {relationship.source_type} to {relationship.target_type}
            </div>
          </div>

          {/* Cardinality (only for table-to-table) */}
          {isTableToTable && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="source-cardinality"
                    className="block text-sm font-medium text-gray-700 mb-2"
                    title="Crow's Foot cardinality notation"
                  >
                    Source Cardinality ({sourceName})
                  </label>
                  <select
                    id="source-cardinality"
                    value={sourceCardinality}
                    onChange={(e) => {
                      const newCardinality = e.target.value as NewCardinality;
                      setSourceCardinality(newCardinality);
                      // Update relationship type based on new cardinalities
                      setRelationshipType(
                        getRelationshipTypeFromCardinalities(newCardinality, targetCardinality)
                      );
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    title="Select cardinality for source endpoint"
                  >
                    <option value="oneToOne">1:1 (One to One)</option>
                    <option value="oneToMany">1:N (One to Many)</option>
                    <option value="zeroOrOne">0:1 (Zero or One)</option>
                    <option value="zeroOrMany">0:N (Zero or Many)</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="target-cardinality"
                    className="block text-sm font-medium text-gray-700 mb-2"
                    title="Crow's Foot cardinality notation"
                  >
                    Target Cardinality ({targetName})
                  </label>
                  <select
                    id="target-cardinality"
                    value={targetCardinality}
                    onChange={(e) => {
                      const newCardinality = e.target.value as NewCardinality;
                      setTargetCardinality(newCardinality);
                      // Update relationship type based on new cardinalities
                      setRelationshipType(
                        getRelationshipTypeFromCardinalities(sourceCardinality, newCardinality)
                      );
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    title="Select cardinality for target endpoint"
                  >
                    <option value="oneToOne">1:1 (One to One)</option>
                    <option value="oneToMany">1:N (One to Many)</option>
                    <option value="zeroOrOne">0:1 (Zero or One)</option>
                    <option value="zeroOrMany">0:N (Zero or Many)</option>
                  </select>
                </div>
              </div>

              {/* Source Key Selection */}
              <div>
                <label
                  htmlFor="source-key"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Source Key (from {sourceName})
                </label>
                <select
                  id="source-key"
                  value={sourceKey}
                  onChange={(e) => setSourceKey(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a key...</option>
                  {getTableKeys(relationship.source_id).map((key) => (
                    <option key={key.id} value={key.id}>
                      [{key.type}] {key.name}
                    </option>
                  ))}
                </select>
                {getTableKeys(relationship.source_id).length === 0 && (
                  <p className="mt-1 text-xs text-yellow-600">
                    No keys found. Add a primary key, foreign key, unique index, or compound key to
                    the source table.
                  </p>
                )}
              </div>

              {/* Target Key Selection */}
              <div>
                <label
                  htmlFor="target-key"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Target Key (from {targetName})
                </label>
                <select
                  id="target-key"
                  value={targetKey}
                  onChange={(e) => setTargetKey(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a key...</option>
                  {getTableKeys(relationship.target_id).map((key) => (
                    <option key={key.id} value={key.id}>
                      [{key.type}] {key.name}
                    </option>
                  ))}
                </select>
                {getTableKeys(relationship.target_id).length === 0 && (
                  <p className="mt-1 text-xs text-yellow-600">
                    No keys found. Add a primary key, foreign key, unique index, or compound key to
                    the target table.
                  </p>
                )}
              </div>
            </>
          )}

          {/* Connection Points */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="source-handle"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Source Connection Point
              </label>
              <select
                id="source-handle"
                value={sourceHandle}
                onChange={(e) => setSourceHandle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {handleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="target-handle"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Target Connection Point
              </label>
              <select
                id="target-handle"
                value={targetHandle}
                onChange={(e) => setTargetHandle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {handleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-gray-500 -mt-2">
            Choose where the relationship line connects on each node
          </p>

          {/* Label */}
          <div>
            <label
              htmlFor="relationship-label"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Label (Optional)
            </label>
            <input
              id="relationship-label"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., 'belongs to', 'contains', 'references'"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              This label will appear on the canvas next to the relationship line
            </p>
          </div>

          {/* Line Color */}
          <div>
            <label
              htmlFor="relationship-color"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Line Color
            </label>
            <div className="flex items-center gap-3">
              <input
                id="relationship-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-20 rounded border border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#000000"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setColor('#000000')}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50"
                title="Reset to default (black)"
              >
                Reset
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Choose a color for the relationship line on the canvas
            </p>
          </div>

          {/* DrawIO Edge ID */}
          <div>
            <label
              htmlFor="drawio-edge-id"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              DrawIO Edge ID (Optional)
            </label>
            <input
              id="drawio-edge-id"
              type="text"
              value={drawioEdgeId}
              onChange={(e) => setDrawioEdgeId(e.target.value)}
              placeholder="e.g., edge-1, mxCell-123"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              Link this relationship to a specific edge in a DrawIO diagram for synchronization
            </p>
          </div>

          {/* Description/Notes */}
          <div>
            <label
              htmlFor="relationship-description"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Description / Notes (Optional)
            </label>
            <textarea
              id="relationship-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add notes or description about this relationship..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Actions - Fixed at bottom */}
        <div className="flex justify-between items-center gap-2 pt-4 mt-4 border-t border-gray-200 flex-shrink-0">
          <div className="flex gap-2 flex-1">
            <button
              onClick={handleReverse}
              className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors w-full"
              title="Reverse the direction of this relationship (swap source and target)"
            >
              Reverse Direction
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors w-full"
            >
              Delete
            </button>
          </div>
          <div className="flex gap-2 flex-1">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full"
              disabled={isSaving}
            >
              Close
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-full"
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </DraggableModal>
  );
};
