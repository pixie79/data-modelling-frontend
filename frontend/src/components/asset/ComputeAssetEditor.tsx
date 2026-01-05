/**
 * Compute Asset Editor Component
 * Full CRUD editor for CADS compute assets
 */

import React, { useState } from 'react';
import { DraggableModal } from '@/components/common/DraggableModal';
import { useModelStore } from '@/stores/modelStore';
import { useUIStore } from '@/stores/uiStore';
import { AssetMetadataForm } from './AssetMetadataForm';
import { BPMNLink } from './BPMNLink';
import { DMNLink } from './DMNLink';
import type { ComputeAsset } from '@/types/cads';

export interface ComputeAssetEditorProps {
  asset?: ComputeAsset;
  domainId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ComputeAssetEditor: React.FC<ComputeAssetEditorProps> = ({
  asset,
  domainId,
  isOpen,
  onClose,
}) => {
  const { addComputeAsset, updateComputeAsset } = useModelStore();
  const { addToast } = useUIStore();

  const [name, setName] = useState('');
  const [type, setType] = useState<'ai' | 'ml' | 'app'>('app');
  const [description, setDescription] = useState('');
  const [owner, setOwner] = useState<ComputeAsset['owner']>(undefined);
  const [engineeringTeam, setEngineeringTeam] = useState('');
  const [sourceRepo, setSourceRepo] = useState('');
  const [bpmnLink, setBpmnLink] = useState<string | undefined>(undefined);
  const [dmnLink, setDmnLink] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<'development' | 'production' | 'deprecated'>('development');

  // Initialize form when dialog opens or asset changes
  React.useEffect(() => {
    if (!isOpen) {
      // Reset when dialog closes
      setName('');
      setType('app');
      setDescription('');
      setOwner(undefined);
      setEngineeringTeam('');
      setSourceRepo('');
      setBpmnLink(undefined);
      setDmnLink(undefined);
      setStatus('development');
      return;
    }
    
    // Load asset data when dialog opens
    if (asset) {
      setName(asset.name);
      setType(asset.type);
      setDescription(asset.description || '');
      setOwner(asset.owner);
      setEngineeringTeam(asset.engineering_team || '');
      setSourceRepo(asset.source_repo || '');
      setBpmnLink(asset.bpmn_link);
      setDmnLink(asset.dmn_link);
      setStatus(asset.status || 'development');
    }
  }, [asset, isOpen]);

  const handleSave = () => {
    if (!name.trim()) {
      addToast({
        type: 'error',
        message: 'Asset name is required',
      });
      return;
    }

    const assetData: ComputeAsset = {
      id: asset?.id || (typeof crypto !== 'undefined' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
      domain_id: domainId,
      name: name.trim(),
      type,
      description: description.trim() || undefined,
      owner: owner && (owner.name || owner.email) ? owner : undefined,
      engineering_team: engineeringTeam.trim() || undefined,
      source_repo: sourceRepo.trim() || undefined,
      bpmn_link: bpmnLink,
      dmn_link: dmnLink,
      status,
      created_at: asset?.created_at || new Date().toISOString(),
      last_modified_at: new Date().toISOString(),
    };

    if (asset) {
      updateComputeAsset(asset.id, assetData);
      addToast({
        type: 'success',
        message: 'Compute asset updated',
      });
    } else {
      addComputeAsset(assetData);
      addToast({
        type: 'success',
        message: 'Compute asset created',
      });
    }

    onClose();
  };

  return (
    <DraggableModal
      isOpen={isOpen}
      onClose={onClose}
      title={asset ? 'Edit Node (Card)' : 'Create Node (Card)'}
      size="lg"
      initialPosition={{
        x: window.innerWidth / 2 - 400,
        y: window.innerHeight / 2 - 300,
      }}
    >
      <div className="space-y-4 max-h-[80vh] overflow-y-auto">
        {/* Basic Information */}
        <div>
          <label htmlFor="compute-asset-name" className="block text-sm font-medium text-gray-700 mb-2">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            id="compute-asset-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Asset name"
          />
        </div>

        <div>
          <label htmlFor="asset-type" className="block text-sm font-medium text-gray-700 mb-2">Type</label>
          <select
            id="asset-type"
            value={type}
            onChange={(e) => setType(e.target.value as 'ai' | 'ml' | 'app')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ai">AI Model</option>
            <option value="ml">ML Pipeline</option>
            <option value="app">Application</option>
          </select>
        </div>

        <div>
          <label htmlFor="asset-description" className="block text-sm font-medium text-gray-700 mb-2">Description</label>
          <textarea
            id="asset-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Asset description"
          />
        </div>

        {/* Metadata Form */}
        <AssetMetadataForm
          asset={{
            owner,
            engineering_team: engineeringTeam,
            source_repo: sourceRepo,
            status,
          }}
          onChange={(updates) => {
            if (updates.owner !== undefined) setOwner(updates.owner);
            if (updates.engineering_team !== undefined) setEngineeringTeam(updates.engineering_team);
            if (updates.source_repo !== undefined) setSourceRepo(updates.source_repo);
            if (updates.status !== undefined) setStatus(updates.status);
          }}
        />

        {/* BPMN Link */}
        <BPMNLink assetId={asset?.id || 'new'} domainId={domainId} currentLinkId={bpmnLink} onLinkChange={setBpmnLink} />

        {/* DMN Link */}
        <DMNLink assetId={asset?.id || 'new'} domainId={domainId} currentLinkId={dmnLink} onLinkChange={setDmnLink} />

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            {asset ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </DraggableModal>
  );
};

