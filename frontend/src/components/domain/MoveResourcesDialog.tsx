/**
 * Move Resources Dialog
 * Dialog for moving tables, compute assets, and systems between systems and domains
 */

import React, { useState, useMemo } from 'react';
import { useModelStore } from '@/stores/modelStore';
import { useUIStore } from '@/stores/uiStore';
import type { Table } from '@/types/table';
import type { System } from '@/types/system';
import type { ComputeAsset } from '@/types/cads';

export interface MoveResourcesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  domainId: string;
}

type ResourceType = 'table' | 'compute-asset' | 'system';
type ResourceToMove = {
  type: ResourceType;
  id: string;
  name: string;
  currentSystemId?: string;
  currentDomainId: string;
};

export const MoveResourcesDialog: React.FC<MoveResourcesDialogProps> = ({
  isOpen,
  onClose,
  domainId,
}) => {
  const { tables, systems, computeAssets, domains, updateSystem, updateTable, updateComputeAsset } =
    useModelStore();
  const { addToast } = useUIStore();

  const [selectedResource, setSelectedResource] = useState<ResourceToMove | null>(null);
  const [targetSystemId, setTargetSystemId] = useState<string>('');
  const [targetDomainId, setTargetDomainId] = useState<string>('');
  const [isMoving, setIsMoving] = useState(false);

  // Get all systems in current domain
  const domainSystems = useMemo(() => {
    return systems?.filter((s) => s.domain_id === domainId) ?? [];
  }, [systems, domainId]);

  // Get all domains (excluding current)
  const otherDomains = useMemo(() => {
    return domains?.filter((d) => d.id !== domainId) ?? [];
  }, [domains, domainId]);

  // Get all systems in target domain (when moving between domains)
  const targetDomainSystems = useMemo(() => {
    if (!targetDomainId || targetDomainId === domainId) return [];
    return systems?.filter((s) => s.domain_id === targetDomainId) ?? [];
  }, [systems, targetDomainId, domainId]);

  // Get all tables in current domain
  const domainTables = useMemo(() => {
    return tables?.filter((t) => t.primary_domain_id === domainId) ?? [];
  }, [tables, domainId]);

  // Get all compute assets in current domain
  const domainAssets = useMemo(() => {
    return computeAssets?.filter((a) => a.domain_id === domainId) ?? [];
  }, [computeAssets, domainId]);

  // Find which system a table belongs to
  const getTableSystem = (tableId: string): System | null => {
    return systems?.find((s) => s.table_ids?.includes(tableId)) || null;
  };

  // Find which system a compute asset belongs to
  const getAssetSystem = (assetId: string): System | null => {
    return systems?.find((s) => s.asset_ids?.includes(assetId)) || null;
  };

  const handleMoveTable = async (
    tableId: string,
    targetSystemId: string | null,
    targetDomainId: string
  ) => {
    const table = tables?.find((t) => t.id === tableId);
    if (!table) return;

    // Remove from current system
    const currentSystem = getTableSystem(tableId);
    if (currentSystem) {
      const updatedTableIds = (currentSystem.table_ids || []).filter((id) => id !== tableId);
      updateSystem(currentSystem.id, { table_ids: updatedTableIds });
    }

    // Add to target system (if provided and system exists in target domain)
    if (targetSystemId) {
      const targetSystem = systems.find(
        (s) => s.id === targetSystemId && s.domain_id === targetDomainId
      );
      if (targetSystem) {
        const updatedTableIds = [...(targetSystem.table_ids || []), tableId];
        updateSystem(targetSystemId, { table_ids: updatedTableIds });
      }
    }

    // Update table domain
    if (targetDomainId !== domainId) {
      const visibleDomains = table.visible_domains || [];
      const newVisibleDomains = visibleDomains.filter((d) => d !== domainId);
      if (!newVisibleDomains.includes(targetDomainId)) {
        newVisibleDomains.push(targetDomainId);
      }

      updateTable(tableId, {
        primary_domain_id: targetDomainId,
        visible_domains: newVisibleDomains,
      });
    }

    addToast({
      type: 'success',
      message: `Moved table "${table.name}" ${targetDomainId !== domainId ? `to domain "${domains.find((d) => d.id === targetDomainId)?.name || targetDomainId}"` : targetSystemId ? `to system "${systems.find((s) => s.id === targetSystemId)?.name || targetSystemId}"` : 'and unlinked from system'}`,
    });
  };

  const handleMoveComputeAsset = async (
    assetId: string,
    targetSystemId: string | null,
    targetDomainId: string
  ) => {
    const asset = computeAssets.find((a) => a.id === assetId);
    if (!asset) return;

    // Remove from current system
    const currentSystem = getAssetSystem(assetId);
    if (currentSystem) {
      const updatedAssetIds = (currentSystem.asset_ids || []).filter((id) => id !== assetId);
      updateSystem(currentSystem.id, { asset_ids: updatedAssetIds });
    }

    // Add to target system (if provided and system exists in target domain)
    if (targetSystemId) {
      const targetSystem = systems.find(
        (s) => s.id === targetSystemId && s.domain_id === targetDomainId
      );
      if (targetSystem) {
        const updatedAssetIds = [...(targetSystem.asset_ids || []), assetId];
        updateSystem(targetSystemId, { asset_ids: updatedAssetIds });
      }
    }

    // Update asset domain
    if (targetDomainId !== domainId) {
      updateComputeAsset(assetId, {
        domain_id: targetDomainId,
      });
    }

    addToast({
      type: 'success',
      message: `Moved compute asset "${asset.name}" ${targetDomainId !== domainId ? `to domain "${domains.find((d) => d.id === targetDomainId)?.name || targetDomainId}"` : targetSystemId ? `to system "${systems.find((s) => s.id === targetSystemId)?.name || targetSystemId}"` : 'and unlinked from system'}`,
    });
  };

  const handleMoveSystem = async (systemId: string, targetDomainId: string) => {
    const system = systems.find((s) => s.id === systemId);
    if (!system) return;

    // Update system domain
    updateSystem(systemId, {
      domain_id: targetDomainId,
    });

    // Move all tables in this system to the new domain
    if (system.table_ids) {
      for (const tableId of system.table_ids) {
        const table = tables?.find((t) => t.id === tableId);
        if (table) {
          const visibleDomains = table.visible_domains || [];
          const newVisibleDomains = visibleDomains.filter((d) => d !== domainId);
          if (!newVisibleDomains.includes(targetDomainId)) {
            newVisibleDomains.push(targetDomainId);
          }

          updateTable(tableId, {
            primary_domain_id: targetDomainId,
            visible_domains: newVisibleDomains,
          });
        }
      }
    }

    // Move all compute assets in this system to the new domain
    if (system.asset_ids) {
      for (const assetId of system.asset_ids) {
        updateComputeAsset(assetId, {
          domain_id: targetDomainId,
        });
      }
    }

    addToast({
      type: 'success',
      message: `Moved system "${system.name}" and all its resources to domain "${domains.find((d) => d.id === targetDomainId)?.name || targetDomainId}"`,
    });
  };

  const handleMove = async () => {
    if (!selectedResource) return;

    setIsMoving(true);
    try {
      if (selectedResource.type === 'table') {
        await handleMoveTable(
          selectedResource.id,
          targetSystemId || null,
          targetDomainId || selectedResource.currentDomainId
        );
      } else if (selectedResource.type === 'compute-asset') {
        await handleMoveComputeAsset(
          selectedResource.id,
          targetSystemId || null,
          targetDomainId || selectedResource.currentDomainId
        );
      } else if (selectedResource.type === 'system') {
        if (!targetDomainId) {
          addToast({
            type: 'error',
            message: 'Please select a target domain',
          });
          return;
        }
        await handleMoveSystem(selectedResource.id, targetDomainId);
      }

      // Reset form
      setSelectedResource(null);
      setTargetSystemId('');
      setTargetDomainId('');
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to move resource',
      });
    } finally {
      setIsMoving(false);
    }
  };

  const handleSelectTable = (table: Table) => {
    const currentSystem = getTableSystem(table.id);
    setSelectedResource({
      type: 'table',
      id: table.id,
      name: table.name,
      currentSystemId: currentSystem?.id,
      currentDomainId: table.primary_domain_id,
    });
    setTargetSystemId('');
    setTargetDomainId(domainId);
  };

  const handleSelectAsset = (asset: ComputeAsset) => {
    const currentSystem = getAssetSystem(asset.id);
    setSelectedResource({
      type: 'compute-asset',
      id: asset.id,
      name: asset.name,
      currentSystemId: currentSystem?.id,
      currentDomainId: asset.domain_id,
    });
    setTargetSystemId('');
    setTargetDomainId(domainId);
  };

  const handleSelectSystem = (system: System) => {
    setSelectedResource({
      type: 'system',
      id: system.id,
      name: system.name,
      currentSystemId: system.id,
      currentDomainId: system.domain_id,
    });
    setTargetSystemId('');
    setTargetDomainId(domainId);
  };

  if (!isOpen) return null;

  const isMovingBetweenDomains = Boolean(targetDomainId && targetDomainId !== domainId);
  const availableSystems = isMovingBetweenDomains ? targetDomainSystems : domainSystems;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Move Resources</h2>
            <p className="text-sm text-gray-500 mt-1">
              Move tables, compute assets, or systems between systems and domains
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-2 gap-6">
            {/* Left: Select Resource */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Select Resource to Move</h3>

              {/* Tables */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Tables</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {domainTables.map((table) => {
                    const currentSystem = getTableSystem(table.id);
                    return (
                      <button
                        key={table.id}
                        onClick={() => handleSelectTable(table)}
                        className={`w-full text-left px-3 py-2 rounded-md border transition-colors ${
                          selectedResource?.id === table.id && selectedResource?.type === 'table'
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="font-medium text-gray-900">{table.name}</div>
                        <div className="text-xs text-gray-500">
                          {currentSystem ? `In: ${currentSystem.name}` : 'Unlinked'}
                        </div>
                      </button>
                    );
                  })}
                  {domainTables.length === 0 && (
                    <p className="text-sm text-gray-400 italic">No tables in this domain</p>
                  )}
                </div>
              </div>

              {/* Compute Assets */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Compute Assets</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {domainAssets.map((asset) => {
                    const currentSystem = getAssetSystem(asset.id);
                    return (
                      <button
                        key={asset.id}
                        onClick={() => handleSelectAsset(asset)}
                        className={`w-full text-left px-3 py-2 rounded-md border transition-colors ${
                          selectedResource?.id === asset.id &&
                          selectedResource?.type === 'compute-asset'
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="font-medium text-gray-900">{asset.name}</div>
                        <div className="text-xs text-gray-500">
                          {currentSystem ? `In: ${currentSystem.name}` : 'Unlinked'} • {asset.type}
                        </div>
                      </button>
                    );
                  })}
                  {domainAssets.length === 0 && (
                    <p className="text-sm text-gray-400 italic">No compute assets in this domain</p>
                  )}
                </div>
              </div>

              {/* Systems */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Systems</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {domainSystems.map((system) => (
                    <button
                      key={system.id}
                      onClick={() => handleSelectSystem(system)}
                      className={`w-full text-left px-3 py-2 rounded-md border transition-colors ${
                        selectedResource?.id === system.id && selectedResource?.type === 'system'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium text-gray-900">{system.name}</div>
                      <div className="text-xs text-gray-500">
                        {system.table_ids?.length || 0} tables • {system.asset_ids?.length || 0}{' '}
                        assets
                      </div>
                    </button>
                  ))}
                  {domainSystems.length === 0 && (
                    <p className="text-sm text-gray-400 italic">No systems in this domain</p>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Select Target */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Select Target</h3>

              {!selectedResource ? (
                <div className="text-center py-12 text-gray-400">
                  <p>Select a resource to move</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Current Resource Info */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm font-medium text-gray-700 mb-1">Moving:</div>
                    <div className="text-lg font-semibold text-gray-900">
                      {selectedResource.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Type: {selectedResource.type}
                      {selectedResource.currentSystemId && (
                        <>
                          {' '}
                          • Current System:{' '}
                          {systems.find((s) => s.id === selectedResource.currentSystemId)?.name}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Target Domain */}
                  <div>
                    <label
                      htmlFor="move-target-domain"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Target Domain:
                    </label>
                    <select
                      id="move-target-domain"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={targetDomainId}
                      onChange={(e) => {
                        setTargetDomainId(e.target.value);
                        setTargetSystemId(''); // Reset system when domain changes
                      }}
                    >
                      <option value={domainId}>
                        Current Domain ({domains.find((d) => d.id === domainId)?.name || domainId})
                      </option>
                      {otherDomains.map((domain) => (
                        <option key={domain.id} value={domain.id}>
                          {domain.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Target System (only for tables and compute assets) */}
                  {selectedResource.type !== 'system' && (
                    <div>
                      <label
                        htmlFor="move-target-system"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
                        Target System:
                      </label>
                      <select
                        id="move-target-system"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={targetSystemId}
                        onChange={(e) => setTargetSystemId(e.target.value)}
                        disabled={isMovingBetweenDomains && availableSystems.length === 0}
                      >
                        <option value="">Unlink from system (unlinked)</option>
                        {availableSystems
                          .filter((s) => s.id !== selectedResource.currentSystemId)
                          .map((system) => (
                            <option key={system.id} value={system.id}>
                              {system.name} ({system.system_type})
                            </option>
                          ))}
                      </select>
                      {isMovingBetweenDomains && availableSystems.length === 0 && (
                        <p className="text-xs text-yellow-600 mt-1">
                          No systems in target domain. Resource will be unlinked and can be linked
                          later.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Warning for system moves */}
                  {selectedResource.type === 'system' && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <div className="flex items-start">
                        <svg
                          className="w-5 h-5 text-yellow-600 mt-0.5 mr-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                          />
                        </svg>
                        <div className="text-sm text-yellow-800">
                          <strong>
                            Moving a system will move all its tables and compute assets
                          </strong>{' '}
                          to the target domain.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleMove}
            disabled={
              !selectedResource ||
              isMoving ||
              (selectedResource.type === 'system' && !targetDomainId)
            }
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isMoving ? 'Moving...' : 'Move Resource'}
          </button>
        </div>
      </div>
    </div>
  );
};
