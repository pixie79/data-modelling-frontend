/**
 * Compute Asset Node Component
 * ReactFlow node for displaying AI/ML/App nodes (CADS assets) on the canvas
 */

import React from 'react';
import { Handle, Position } from 'reactflow';
import type { ComputeAsset } from '@/types/cads';

export interface ComputeAssetNodeData {
  asset: ComputeAsset;
  nodeType: 'compute-asset';
  onEdit?: (assetId: string) => void;
  onDelete?: (assetId: string) => void;
  onExport?: (assetId: string) => void;
  onBPMNClick?: (assetId: string) => void;
  onDMNClick?: (assetId: string) => void;
}

export interface ComputeAssetNodeProps {
  data: ComputeAssetNodeData;
  selected?: boolean;
}

const getAssetTypeColor = (type: ComputeAsset['type']): string => {
  switch (type) {
    case 'app':
      return 'bg-green-500';
    case 'ml':
      return 'bg-orange-500';
    case 'ai':
      return 'bg-purple-500';
    default:
      return 'bg-gray-500';
  }
};

const getAssetTypeLabel = (type: ComputeAsset['type']): string => {
  switch (type) {
    case 'app':
      return 'App';
    case 'ml':
      return 'ML';
    case 'ai':
      return 'AI';
    default:
      return 'Asset';
  }
};

const getAssetTypeIcon = (type: ComputeAsset['type']): string => {
  switch (type) {
    case 'app':
      return '📱';
    case 'ml':
      return '🤖';
    case 'ai':
      return '🧠';
    default:
      return '⚙️';
  }
};

export const ComputeAssetNode: React.FC<ComputeAssetNodeProps> = ({ data, selected }) => {
  const { asset, onEdit, onDelete, onExport, onBPMNClick, onDMNClick } = data;
  const colorClass = getAssetTypeColor(asset.type);
  const typeLabel = getAssetTypeLabel(asset.type);
  const typeIcon = getAssetTypeIcon(asset.type);
  const hasBPMN = !!asset.bpmn_link;
  const hasDMN = !!asset.dmn_link;

  return (
    <div
      className={`
        bg-white border-2 rounded-lg shadow-md min-w-[200px] max-w-[250px] relative group
        ${selected ? 'border-blue-600 ring-2 ring-blue-200' : 'border-gray-300'}
      `}
      role="group"
      aria-label={`${typeLabel} Asset: ${asset.name}`}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      <Handle type="target" position={Position.Bottom} className="w-3 h-3" />
      <Handle type="target" position={Position.Left} className="w-3 h-3" />
      <Handle type="target" position={Position.Right} className="w-3 h-3" />
      <Handle type="source" position={Position.Top} className="w-3 h-3" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
      <Handle type="source" position={Position.Left} className="w-3 h-3" />
      <Handle type="source" position={Position.Right} className="w-3 h-3" />

      {/* Color bar indicating asset type */}
      <div className={`h-2 ${colorClass} rounded-t-lg`} title={`Type: ${typeLabel}`} />

      {/* Edit/Delete/Export buttons */}
      {(onEdit || onDelete || onExport) && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <div className="flex gap-1">
            {onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(asset.id);
                }}
                className="p-1 bg-white rounded shadow text-blue-600 hover:text-blue-800"
                title="Edit Node"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
            )}
            {onExport && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onExport(asset.id);
                }}
                className="p-1 bg-white rounded shadow text-green-600 hover:text-green-800"
                title="Export CADS YAML"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(asset.id);
                }}
                className="p-1 bg-white rounded shadow text-red-600 hover:text-red-800"
                title="Delete Node"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Node content */}
      <div className="p-3">
        {/* Title with icon */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">{typeIcon}</span>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-gray-900 truncate" title={asset.name}>
              {asset.name}
            </div>
          </div>
        </div>

        {/* Type badge and model indicators */}
        <div className="mb-2 flex items-center gap-1 flex-wrap">
          <span 
            className={`inline-block px-2 py-0.5 text-xs font-medium rounded text-white ${colorClass}`}
            title={`Type: ${typeLabel}`}
          >
            {typeLabel}
          </span>
          {asset.status && (
            <span 
              className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-gray-200 text-gray-700"
              title={`Status: ${asset.status}`}
            >
              {asset.status}
            </span>
          )}
          {/* BPMN Model Indicator */}
          {hasBPMN && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onBPMNClick?.(asset.id);
              }}
              className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors"
              title="Click to view BPMN process model"
            >
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              BPMN
            </button>
          )}
          {/* DMN Model Indicator */}
          {hasDMN && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDMNClick?.(asset.id);
              }}
              className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
              title="Click to view DMN decision model"
            >
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              DMN
            </button>
          )}
        </div>

        {/* Description */}
        {asset.description && (
          <div 
            className="text-xs text-gray-500 line-clamp-2" 
            title={asset.description}
          >
            {asset.description}
          </div>
        )}
      </div>
    </div>
  );
};

