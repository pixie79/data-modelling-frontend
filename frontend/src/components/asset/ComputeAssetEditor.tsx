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
  const { addComputeAsset, updateComputeAsset, selectedDomainId } = useModelStore();
  const { addToast } = useUIStore();

  // Check if asset is editable (must belong to current domain)
  const isEditable = !asset || asset.domain_id === selectedDomainId;

  const [name, setName] = useState('');
  const [type, setType] = useState<'ai' | 'ml' | 'app'>('app');
  const [description, setDescription] = useState('');
  const [owner, setOwner] = useState<ComputeAsset['owner']>(undefined);
  const [engineeringTeam, setEngineeringTeam] = useState('');
  const [sourceRepo, setSourceRepo] = useState('');
  const [bpmnLink, setBpmnLink] = useState<string | undefined>(undefined);
  const [dmnLink, setDmnLink] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<'development' | 'production' | 'deprecated'>('development');
  const [tags, setTags] = useState<string[]>([]);
  const [tagsInput, setTagsInput] = useState('');

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
      setTags([]);
      setTagsInput('');
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
      setTags(asset.tags || []);
      setTagsInput((asset.tags || []).join(', '));
    }
  }, [asset, isOpen]);

  const handleTagsInputChange = (value: string) => {
    setTagsInput(value);
    // Parse tags from input
    // Split on ", " (comma + space) to separate different tags
    // This allows "env:prod,staging" to be one tag, but "env:prod, product:food" to be two tags
    const parsedTags = value
      .split(/, /)
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    setTags(parsedTags);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      addToast({
        type: 'error',
        message: 'Asset name is required',
      });
      return;
    }

    // Always use UUIDs for compute asset IDs
    const { generateUUID } = await import('@/utils/validation');
    const assetData: ComputeAsset = {
      id: asset?.id || generateUUID(),
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
      tags: tags.length > 0 ? tags : undefined,
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

  // Read-only view for shared assets
  if (!isEditable && asset) {
    return (
      <DraggableModal
        isOpen={isOpen}
        onClose={onClose}
        title="View Node (Card) - Read Only"
        size="lg"
        initialPosition={{
          x: window.innerWidth / 2 - 400,
          y: window.innerHeight / 2 - 300,
        }}
      >
        <div className="space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Read-Only Banner */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-yellow-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              <div>
                <h3 className="text-sm font-semibold text-yellow-800">Read-Only View</h3>
                <p className="text-xs text-yellow-700">
                  This asset belongs to another domain. Switch to the primary domain to edit.
                </p>
              </div>
            </div>
          </div>

          {/* Basic Information */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
            <input
              type="text"
              value={asset.name}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
            <input
              type="text"
              value={
                asset.type === 'ai'
                  ? 'AI Model'
                  : asset.type === 'ml'
                    ? 'ML Pipeline'
                    : 'Application'
              }
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
            />
          </div>

          {asset.description && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                value={asset.description}
                disabled
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
              />
            </div>
          )}

          {asset.owner && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Owner</label>
              <input
                type="text"
                value={asset.owner.name || asset.owner.email || 'Unknown'}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
              />
            </div>
          )}

          {asset.engineering_team && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Engineering Team
              </label>
              <input
                type="text"
                value={asset.engineering_team}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
              />
            </div>
          )}

          {asset.source_repo && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Source Repository
              </label>
              <input
                type="text"
                value={asset.source_repo}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
              />
            </div>
          )}

          {asset.status && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <input
                type="text"
                value={asset.status.charAt(0).toUpperCase() + asset.status.slice(1)}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
              />
            </div>
          )}

          {asset.tags && asset.tags.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
              <div className="flex flex-wrap gap-2">
                {asset.tags.map((tag, index) => (
                  <span key={index} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {asset.custom_properties && Object.keys(asset.custom_properties).length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Custom Properties
              </label>
              <div className="border border-gray-300 rounded-lg p-3 bg-gray-50">
                <pre className="text-xs text-gray-700 overflow-auto max-h-40">
                  {JSON.stringify(asset.custom_properties, null, 2)}
                </pre>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      </DraggableModal>
    );
  }

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
          <label
            htmlFor="compute-asset-name"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
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
          <label htmlFor="asset-type" className="block text-sm font-medium text-gray-700 mb-2">
            Type
          </label>
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
          <label
            htmlFor="asset-description"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Description
          </label>
          <textarea
            id="asset-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Asset description"
          />
        </div>

        {/* Tags */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <label htmlFor="asset-tags" className="block text-sm font-medium text-gray-700">
              Tags
            </label>
            <div className="relative group">
              <button
                type="button"
                className="w-4 h-4 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 text-xs font-semibold"
                title="Tag format help"
              >
                ?
              </button>
              <div className="invisible group-hover:visible absolute left-0 top-6 z-50 w-80 bg-white border border-gray-300 rounded-lg shadow-lg p-3 text-xs">
                <h4 className="font-semibold text-gray-900 mb-2">Tag Formats</h4>
                <div className="space-y-2 text-gray-700">
                  <div>
                    <span className="font-medium">Simple:</span>
                    <code className="ml-2 px-1 bg-gray-100 rounded">production</code>
                    <p className="text-xs text-gray-600 mt-1">Single word tag</p>
                  </div>
                  <div>
                    <span className="font-medium">Keyword:</span>
                    <code className="ml-2 px-1 bg-gray-100 rounded">env:production</code>
                    <p className="text-xs text-gray-600 mt-1">Key-value pair</p>
                  </div>
                  <div>
                    <span className="font-medium">Keyword with list:</span>
                    <code className="ml-2 px-1 bg-gray-100 rounded">env:production,staging</code>
                    <p className="text-xs text-gray-600 mt-1">
                      Key with multiple values (no spaces)
                    </p>
                  </div>
                  <div className="pt-2 border-t border-gray-200 mt-2">
                    <p className="text-xs text-gray-600">
                      <span className="font-medium">Multiple tags:</span> Separate with comma +
                      space
                    </p>
                    <code className="block mt-1 px-1 bg-gray-100 rounded">
                      env:production, product:food
                    </code>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <input
            id="asset-tags"
            type="text"
            value={tagsInput}
            onChange={(e) => handleTagsInputChange(e.target.value)}
            placeholder="e.g., env:production, product:food or ml, ai-model"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
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
            if (updates.engineering_team !== undefined)
              setEngineeringTeam(updates.engineering_team);
            if (updates.source_repo !== undefined) setSourceRepo(updates.source_repo);
            if (updates.status !== undefined) setStatus(updates.status);
          }}
        />

        {/* BPMN Link */}
        <BPMNLink
          assetId={asset?.id || 'new'}
          domainId={domainId}
          currentLinkId={bpmnLink}
          onLinkChange={setBpmnLink}
        />

        {/* DMN Link */}
        <DMNLink
          assetId={asset?.id || 'new'}
          domainId={domainId}
          currentLinkId={dmnLink}
          onLinkChange={setDmnLink}
        />

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
