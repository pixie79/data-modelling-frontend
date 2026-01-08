/**
 * OpenAPI Link Component
 * Component for linking OpenAPI specs to compute assets
 * Supports adding/importing OpenAPI specifications directly from the asset editor
 */

import React, { useState } from 'react';
import { useUIStore } from '@/stores/uiStore';
import type { CADSOpenAPISpec } from '@/types/cads';

export interface OpenAPILinkProps {
  assetId: string;
  currentSpecs?: CADSOpenAPISpec[];
  onSpecsChange: (specs: CADSOpenAPISpec[]) => void;
}

export const OpenAPILink: React.FC<OpenAPILinkProps> = ({
  assetId,
  currentSpecs = [],
  onSpecsChange,
}) => {
  const { addToast } = useUIStore();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newSpec, setNewSpec] = useState<Partial<CADSOpenAPISpec>>({
    name: '',
    reference: '',
    format: 'openapi',
    description: '',
  });

  const handleAddSpec = () => {
    if (!newSpec.name?.trim()) {
      addToast({
        type: 'error',
        message: 'OpenAPI spec name is required',
      });
      return;
    }

    if (!newSpec.reference?.trim()) {
      addToast({
        type: 'error',
        message: 'OpenAPI spec reference (URL or path) is required',
      });
      return;
    }

    const spec: CADSOpenAPISpec = {
      name: newSpec.name.trim(),
      reference: newSpec.reference.trim(),
      format: 'openapi',
      description: newSpec.description?.trim() || undefined,
    };

    onSpecsChange([...currentSpecs, spec]);
    setNewSpec({ name: '', reference: '', format: 'openapi', description: '' });
    setShowAddDialog(false);
    addToast({
      type: 'success',
      message: 'OpenAPI spec added',
    });
  };

  const handleRemoveSpec = (index: number) => {
    const updated = currentSpecs.filter((_, i) => i !== index);
    onSpecsChange(updated);
    addToast({
      type: 'success',
      message: 'OpenAPI spec removed',
    });
  };

  const handleImportSpec = async (file: File) => {
    try {
      const content = await file.text();
      // Basic validation - check if it's valid JSON or YAML
      let isValid = false;
      try {
        const parsed = JSON.parse(content);
        // Check for OpenAPI markers
        isValid = parsed.openapi || parsed.swagger;
      } catch {
        // Could be YAML - just accept it
        isValid = content.includes('openapi:') || content.includes('swagger:');
      }

      if (!isValid) {
        addToast({
          type: 'warning',
          message: 'File may not be a valid OpenAPI spec, but it has been added',
        });
      }

      const spec: CADSOpenAPISpec = {
        name: file.name.replace(/\.(json|yaml|yml)$/, ''),
        reference: file.name, // Use filename as reference
        format: 'openapi',
        description: `Imported from ${file.name}`,
      };

      onSpecsChange([...currentSpecs, spec]);
      addToast({
        type: 'success',
        message: 'OpenAPI spec imported',
      });
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to import OpenAPI spec',
      });
    }
  };

  return (
    <div>
      <div className="block text-sm font-medium text-gray-700 mb-2">OpenAPI Specifications</div>

      {/* Action Buttons */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setShowAddDialog(true)}
          className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700"
          title="Add OpenAPI spec reference"
        >
          + Add OpenAPI
        </button>
        <label className="px-3 py-1.5 text-sm bg-teal-600 text-white rounded hover:bg-teal-700 cursor-pointer">
          Import OpenAPI
          <input
            type="file"
            accept=".json,.yaml,.yml"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleImportSpec(file);
              }
              e.target.value = ''; // Reset input
            }}
            className="hidden"
          />
        </label>
      </div>

      {/* Existing Specs List */}
      {currentSpecs.length === 0 ? (
        <p className="text-sm text-gray-500">No OpenAPI specs linked. Add or import one to link.</p>
      ) : (
        <div className="space-y-2">
          {currentSpecs.map((spec, index) => (
            <div
              key={`${assetId}-openapi-${index}`}
              className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg bg-gray-50"
            >
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">{spec.name}</div>
                <div className="text-xs text-gray-500 truncate" title={spec.reference}>
                  {spec.reference}
                </div>
                {spec.description && (
                  <div className="text-xs text-gray-400 mt-1">{spec.description}</div>
                )}
              </div>
              <button
                onClick={() => handleRemoveSpec(index)}
                className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                title="Remove spec"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add OpenAPI Dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Add OpenAPI Specification</h3>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="openapi-name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="openapi-name"
                  type="text"
                  value={newSpec.name || ''}
                  onChange={(e) => setNewSpec({ ...newSpec, name: e.target.value })}
                  placeholder="e.g., User API"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label
                  htmlFor="openapi-reference"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Reference (URL or Path) <span className="text-red-500">*</span>
                </label>
                <input
                  id="openapi-reference"
                  type="text"
                  value={newSpec.reference || ''}
                  onChange={(e) => setNewSpec({ ...newSpec, reference: e.target.value })}
                  placeholder="e.g., ./specs/user-api.yaml or https://api.example.com/openapi.json"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label
                  htmlFor="openapi-description"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Description
                </label>
                <textarea
                  id="openapi-description"
                  value={newSpec.description || ''}
                  onChange={(e) => setNewSpec({ ...newSpec, description: e.target.value })}
                  placeholder="Optional description of the API spec"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowAddDialog(false);
                  setNewSpec({ name: '', reference: '', format: 'openapi', description: '' });
                }}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSpec}
                className="px-4 py-2 text-sm text-white bg-green-600 rounded hover:bg-green-700"
              >
                Add Spec
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
