/**
 * SharedResourcePicker Component
 * Dialog for selecting resources from other domains to share (read-only) in current domain
 */

import React, { useState, useEffect } from 'react';
import { DraggableModal } from '@/components/common/DraggableModal';
import { useModelStore } from '@/stores/modelStore';
import type { Table } from '@/types/table';
import type { ComputeAsset } from '@/types/cads';

export interface SharedResourcePickerProps {
  isOpen: boolean;
  onClose: () => void;
  currentDomainId: string;
  onResourcesSelected: (
    sharedResources: Array<{
      source_domain_id: string;
      resource_type: 'table' | 'system' | 'asset';
      resource_id: string;
      shared_at?: string; // Optional - will be set by the handler
    }>
  ) => void;
}

export const SharedResourcePicker: React.FC<SharedResourcePickerProps> = ({
  isOpen,
  onClose,
  currentDomainId,
  onResourcesSelected,
}) => {
  const { domains, systems, tables, computeAssets } = useModelStore();

  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [selectedSystems, setSelectedSystems] = useState<Set<string>>(new Set());
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  // Map resource IDs to target system IDs (for foreign tables/assets)
  const [targetSystems, setTargetSystems] = useState<Map<string, string | null>>(new Map());

  // Initialize selections from current domain's shared_resources when dialog opens or domain changes
  useEffect(() => {
    if (!isOpen || !selectedDomain) return;

    const currentDomain = domains.find((d) => d.id === currentDomainId);
    if (currentDomain?.shared_resources) {
      const systems = new Set<string>();
      const tables = new Set<string>();
      const assets = new Set<string>();

      const targets = new Map<string, string | null>();

      currentDomain.shared_resources.forEach((ref) => {
        // Only process resources from the currently selected domain
        if (ref.source_domain_id === selectedDomain) {
          if (ref.resource_type === 'system') {
            systems.add(ref.resource_id);
          } else if (ref.resource_type === 'table') {
            tables.add(ref.resource_id);
            // Track target system for foreign tables
            if (ref.target_system_id) {
              targets.set(ref.resource_id, ref.target_system_id);
            }
          } else if (ref.resource_type === 'asset') {
            assets.add(ref.resource_id);
            // Track target system for foreign assets
            if (ref.target_system_id) {
              targets.set(ref.resource_id, ref.target_system_id);
            }
          }
        }
      });

      setSelectedSystems(systems);
      setSelectedTables(tables);
      setSelectedAssets(assets);
      setTargetSystems(targets);
    }
  }, [isOpen, selectedDomain, currentDomainId, domains]);

  // Reset selections when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedDomain(null);
      setSelectedSystems(new Set());
      setSelectedTables(new Set());
      setSelectedAssets(new Set());
      setTargetSystems(new Map());
    }
  }, [isOpen]);

  // Filter out current domain from available domains
  const availableDomains = domains.filter((d) => d.id !== currentDomainId);

  // Get systems from current domain (for target system selection)
  // Exclude shared systems - can't put foreign tables into shared systems
  const currentDomain = domains.find((d) => d.id === currentDomainId);
  const sharedSystemIds = new Set(
    currentDomain?.shared_resources
      ?.filter((ref) => ref.resource_type === 'system')
      .map((ref) => ref.resource_id) || []
  );
  const currentDomainSystems = systems.filter(
    (s) => s.domain_id === currentDomainId && !sharedSystemIds.has(s.id)
  );

  // Get systems for selected domain
  const domainSystems = selectedDomain
    ? systems.filter((s) => s.domain_id === selectedDomain && s.domain_id !== currentDomainId)
    : [];

  // Helper to get available target systems for a resource, including its source system
  const getAvailableTargetSystems = (resourceId: string, resourceType: 'table' | 'asset') => {
    // Find the source system for this resource
    const sourceSystem = domainSystems.find((s) => {
      if (resourceType === 'table') {
        return s.table_ids?.includes(resourceId);
      } else {
        return s.asset_ids?.includes(resourceId);
      }
    });

    // Combine current domain systems with the source system (if it exists and not already included)
    const availableSystems = [...currentDomainSystems];
    if (sourceSystem && !availableSystems.some((s) => s.id === sourceSystem.id)) {
      availableSystems.unshift(sourceSystem); // Add at the beginning as default option
    }

    return availableSystems;
  };

  // Get tables for selected systems
  const systemTables = selectedDomain
    ? tables.filter((t) => {
        const tableDomainId = t.primary_domain_id;
        return tableDomainId === selectedDomain && tableDomainId !== currentDomainId;
      })
    : [];

  // Get assets for selected systems
  const systemAssets = selectedDomain
    ? computeAssets.filter((a) => a.domain_id === selectedDomain && a.domain_id !== currentDomainId)
    : [];

  // Group tables by system
  const tablesBySystem = new Map<string | null, Table[]>();
  systemTables.forEach((table) => {
    const system = systems.find((s) => s.table_ids?.includes(table.id));
    const systemId = system?.id || null;
    if (!tablesBySystem.has(systemId)) {
      tablesBySystem.set(systemId, []);
    }
    tablesBySystem.get(systemId)!.push(table);
  });

  // Group assets by system
  const assetsBySystem = new Map<string | null, ComputeAsset[]>();
  systemAssets.forEach((asset) => {
    const system = systems.find((s) => s.asset_ids?.includes(asset.id));
    const systemId = system?.id || null;
    if (!assetsBySystem.has(systemId)) {
      assetsBySystem.set(systemId, []);
    }
    assetsBySystem.get(systemId)!.push(asset);
  });

  const handleSystemToggle = (systemId: string) => {
    const newSelected = new Set(selectedSystems);
    if (newSelected.has(systemId)) {
      newSelected.delete(systemId);
      // Deselect all resources in this system
      const system = systems.find((s) => s.id === systemId);
      if (system) {
        system.table_ids?.forEach((id) => selectedTables.delete(id));
        system.asset_ids?.forEach((id) => selectedAssets.delete(id));
      }
    } else {
      newSelected.add(systemId);
      // Auto-select all resources in this system
      const system = systems.find((s) => s.id === systemId);
      if (system) {
        system.table_ids?.forEach((id) => selectedTables.add(id));
        system.asset_ids?.forEach((id) => selectedAssets.add(id));
      }
    }
    setSelectedSystems(newSelected);
    setSelectedTables(new Set(selectedTables));
    setSelectedAssets(new Set(selectedAssets));
  };

  const handleTableToggle = (tableId: string) => {
    const newSelected = new Set(selectedTables);
    if (newSelected.has(tableId)) {
      newSelected.delete(tableId);
    } else {
      newSelected.add(tableId);
    }
    setSelectedTables(newSelected);
  };

  const handleAssetToggle = (assetId: string) => {
    const newSelected = new Set(selectedAssets);
    if (newSelected.has(assetId)) {
      newSelected.delete(assetId);
    } else {
      newSelected.add(assetId);
    }
    setSelectedAssets(newSelected);
  };

  const handleApply = () => {
    if (!selectedDomain) return;

    // Validate: all tables/assets must have target systems (no standalone allowed)
    const tablesWithoutTarget = Array.from(selectedTables).filter((id) => !targetSystems.get(id));
    const assetsWithoutTarget = Array.from(selectedAssets).filter((id) => !targetSystems.get(id));

    if (tablesWithoutTarget.length > 0 || assetsWithoutTarget.length > 0) {
      alert(
        'All tables and assets must be assigned to a target system. Please select a system from the dropdown for each checked item.'
      );
      return;
    }

    const sharedResources: Array<{
      source_domain_id: string;
      resource_type: 'table' | 'system' | 'asset';
      resource_id: string;
      target_system_id?: string;
    }> = [];

    // Add selected systems
    selectedSystems.forEach((systemId) => {
      sharedResources.push({
        source_domain_id: selectedDomain,
        resource_type: 'system',
        resource_id: systemId,
      });
    });

    // Add selected tables (must have target system)
    selectedTables.forEach((tableId) => {
      const targetSystemId = targetSystems.get(tableId);
      if (targetSystemId) {
        sharedResources.push({
          source_domain_id: selectedDomain,
          resource_type: 'table',
          resource_id: tableId,
          target_system_id: targetSystemId,
        });
      }
    });

    // Add selected assets (must have target system)
    selectedAssets.forEach((assetId) => {
      const targetSystemId = targetSystems.get(assetId);
      if (targetSystemId) {
        sharedResources.push({
          source_domain_id: selectedDomain,
          resource_type: 'asset',
          resource_id: assetId,
          target_system_id: targetSystemId,
        });
      }
    });

    onResourcesSelected(sharedResources);
    onClose();
  };

  const handleReset = () => {
    setSelectedDomain(null);
    setSelectedSystems(new Set());
    setSelectedTables(new Set());
    setSelectedAssets(new Set());
    setTargetSystems(new Map());
  };

  return (
    <DraggableModal
      isOpen={isOpen}
      onClose={onClose}
      title="Share Resources from Other Domains"
      size="lg"
      initialPosition={{
        x: window.innerWidth / 2 - 400,
        y: window.innerHeight / 2 - 300,
      }}
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Select resources from other domains to view (read-only) in your current domain. Selected
          resources will appear with dashed borders.
        </p>

        {/* Domain Selection */}
        <div>
          <label htmlFor="domain-select" className="block text-sm font-medium text-gray-700 mb-2">
            Select Source Domain
          </label>
          <select
            id="domain-select"
            value={selectedDomain || ''}
            onChange={(e) => {
              setSelectedDomain(e.target.value || null);
              handleReset();
              setSelectedDomain(e.target.value || null);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Select a domain --</option>
            {availableDomains.map((domain) => (
              <option key={domain.id} value={domain.id}>
                {domain.name}
              </option>
            ))}
          </select>
        </div>

        {/* System and Resource Selection */}
        {selectedDomain && (
          <div className="border border-gray-200 rounded-lg p-4 max-h-96 overflow-y-auto">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Systems and Resources</h3>

            {domainSystems.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No systems found in this domain</p>
            ) : (
              <div className="space-y-3">
                {domainSystems.map((system) => {
                  const systemTables = tablesBySystem.get(system.id) || [];
                  const systemAssets = assetsBySystem.get(system.id) || [];
                  const isSystemSelected = selectedSystems.has(system.id);

                  return (
                    <div key={system.id} className="border border-gray-200 rounded p-3">
                      {/* System Checkbox */}
                      <label className="flex items-center gap-2 font-medium text-gray-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSystemSelected}
                          onChange={() => handleSystemToggle(system.id)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm">{system.name}</span>
                        <span className="text-xs text-gray-500">
                          ({systemTables.length} tables, {systemAssets.length} assets)
                        </span>
                      </label>

                      {/* Tables in System */}
                      {systemTables.length > 0 && (
                        <div className="mt-2 ml-6 space-y-1">
                          <p className="text-xs font-semibold text-gray-600">Tables:</p>
                          {systemTables.map((table) => (
                            <div key={table.id} className="flex items-center gap-2 text-sm">
                              <label className="flex items-center gap-2 text-gray-700 cursor-pointer flex-1">
                                <input
                                  type="checkbox"
                                  checked={selectedTables.has(table.id)}
                                  onChange={() => handleTableToggle(table.id)}
                                  className="w-3 h-3 text-blue-600 rounded focus:ring-blue-500"
                                />
                                {table.name}
                              </label>
                              {selectedTables.has(table.id) && (
                                <select
                                  value={targetSystems.get(table.id) || ''}
                                  onChange={(e) => {
                                    const newTargets = new Map(targetSystems);
                                    if (e.target.value) {
                                      newTargets.set(table.id, e.target.value);
                                    } else {
                                      newTargets.delete(table.id);
                                    }
                                    setTargetSystems(newTargets);
                                  }}
                                  className="text-xs border border-gray-300 rounded px-2 py-1"
                                  title="Select target system (required)"
                                >
                                  <option value="">Select system...</option>
                                  {getAvailableTargetSystems(table.id, 'table').map((sys) => (
                                    <option key={sys.id} value={sys.id}>
                                      → {sys.name}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Assets in System */}
                      {systemAssets.length > 0 && (
                        <div className="mt-2 ml-6 space-y-1">
                          <p className="text-xs font-semibold text-gray-600">Assets:</p>
                          {systemAssets.map((asset) => (
                            <div key={asset.id} className="flex items-center gap-2 text-sm">
                              <label className="flex items-center gap-2 text-gray-700 cursor-pointer flex-1">
                                <input
                                  type="checkbox"
                                  checked={selectedAssets.has(asset.id)}
                                  onChange={() => handleAssetToggle(asset.id)}
                                  className="w-3 h-3 text-blue-600 rounded focus:ring-blue-500"
                                />
                                {asset.name}
                              </label>
                              {selectedAssets.has(asset.id) && (
                                <select
                                  value={targetSystems.get(asset.id) || ''}
                                  onChange={(e) => {
                                    const newTargets = new Map(targetSystems);
                                    if (e.target.value) {
                                      newTargets.set(asset.id, e.target.value);
                                    } else {
                                      newTargets.delete(asset.id);
                                    }
                                    setTargetSystems(newTargets);
                                  }}
                                  className="text-xs border border-gray-300 rounded px-2 py-1"
                                  title="Select target system (required)"
                                >
                                  <option value="">Select system...</option>
                                  {getAvailableTargetSystems(asset.id, 'asset').map((sys) => (
                                    <option key={sys.id} value={sys.id}>
                                      → {sys.name}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Ungrouped Tables */}
                {(tablesBySystem.get(null) || []).length > 0 && (
                  <div className="border border-gray-200 rounded p-3">
                    <p className="text-sm font-medium text-gray-800 mb-2">Ungrouped Tables</p>
                    <div className="ml-6 space-y-1">
                      {(tablesBySystem.get(null) || []).map((table) => (
                        <div key={table.id} className="flex items-center gap-2 text-sm">
                          <label className="flex items-center gap-2 text-gray-700 cursor-pointer flex-1">
                            <input
                              type="checkbox"
                              checked={selectedTables.has(table.id)}
                              onChange={() => handleTableToggle(table.id)}
                              className="w-3 h-3 text-blue-600 rounded focus:ring-blue-500"
                            />
                            {table.name}
                          </label>
                          {selectedTables.has(table.id) && (
                            <select
                              value={targetSystems.get(table.id) || ''}
                              onChange={(e) => {
                                const newTargets = new Map(targetSystems);
                                if (e.target.value) {
                                  newTargets.set(table.id, e.target.value);
                                } else {
                                  newTargets.delete(table.id);
                                }
                                setTargetSystems(newTargets);
                              }}
                              className="text-xs border border-gray-300 rounded px-2 py-1"
                              title="Select target system (required)"
                            >
                              <option value="">Select system...</option>
                              {getAvailableTargetSystems(table.id, 'table').map((sys) => (
                                <option key={sys.id} value={sys.id}>
                                  → {sys.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ungrouped Assets */}
                {(assetsBySystem.get(null) || []).length > 0 && (
                  <div className="border border-gray-200 rounded p-3">
                    <p className="text-sm font-medium text-gray-800 mb-2">Ungrouped Assets</p>
                    <div className="ml-6 space-y-1">
                      {(assetsBySystem.get(null) || []).map((asset) => (
                        <div key={asset.id} className="flex items-center gap-2 text-sm">
                          <label className="flex items-center gap-2 text-gray-700 cursor-pointer flex-1">
                            <input
                              type="checkbox"
                              checked={selectedAssets.has(asset.id)}
                              onChange={() => handleAssetToggle(asset.id)}
                              className="w-3 h-3 text-blue-600 rounded focus:ring-blue-500"
                            />
                            {asset.name}
                          </label>
                          {selectedAssets.has(asset.id) && (
                            <select
                              value={targetSystems.get(asset.id) || ''}
                              onChange={(e) => {
                                const newTargets = new Map(targetSystems);
                                if (e.target.value) {
                                  newTargets.set(asset.id, e.target.value);
                                } else {
                                  newTargets.delete(asset.id);
                                }
                                setTargetSystems(newTargets);
                              }}
                              className="text-xs border border-gray-300 rounded px-2 py-1"
                              title="Select target system (required)"
                            >
                              <option value="">Select system...</option>
                              {getAvailableTargetSystems(asset.id, 'asset').map((sys) => (
                                <option key={sys.id} value={sys.id}>
                                  → {sys.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Selection Summary */}
        {(selectedSystems.size > 0 || selectedTables.size > 0 || selectedAssets.size > 0) && (
          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <p className="text-sm text-blue-800">
              <strong>Selected:</strong> {selectedSystems.size} system(s), {selectedTables.size}{' '}
              table(s), {selectedAssets.size} asset(s)
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between gap-2 pt-4 border-t border-gray-200">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            disabled={!selectedDomain}
          >
            Clear Selection
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              disabled={
                selectedSystems.size === 0 && selectedTables.size === 0 && selectedAssets.size === 0
              }
            >
              Apply Selection
            </button>
          </div>
        </div>
      </div>
    </DraggableModal>
  );
};
