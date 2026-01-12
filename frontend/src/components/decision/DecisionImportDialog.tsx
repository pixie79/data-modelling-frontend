/**
 * Decision Import Dialog Component
 * Dialog for importing decisions from YAML files
 */

import React, { useState } from 'react';
import { Dialog } from '@/components/common/Dialog';
import { FileUpload } from '@/components/common/FileUpload';
import { UrlImport } from '@/components/common/UrlImport';
import { PasteImport } from '@/components/common/PasteImport';
import { useDecisionStore } from '@/stores/decisionStore';

export interface DecisionImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  domainId?: string;
  onImportSuccess?: () => void;
}

export const DecisionImportDialog: React.FC<DecisionImportDialogProps> = ({
  isOpen,
  onClose,
  domainId,
  onImportSuccess,
}) => {
  const { parseDecisionYaml, addDecision } = useDecisionStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keepCrossDomain, setKeepCrossDomain] = useState(false);

  const handleImportContent = async (content: string) => {
    setIsProcessing(true);
    setError(null);

    try {
      const decision = await parseDecisionYaml(content);
      if (decision) {
        // Generate new ID to avoid conflicts
        const importedDecision = {
          ...decision,
          id: crypto.randomUUID(),
          // Keep as cross-domain if checkbox is checked and original had no domain_id
          domain_id: keepCrossDomain && !decision.domain_id ? undefined : domainId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        addDecision(importedDecision);
        onImportSuccess?.();
        onClose();
      } else {
        setError('Failed to parse YAML content. Please check the format.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import decision');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileImport = async (file: File) => {
    const content = await file.text();
    await handleImportContent(content);
  };

  const handleClose = () => {
    setError(null);
    setKeepCrossDomain(false);
    onClose();
  };

  return (
    <Dialog isOpen={isOpen} onClose={handleClose} title="Import Decision" size="lg">
      <div className="space-y-6">
        <p className="text-sm text-gray-600">
          Import a decision from a YAML file. The decision will be added to the current domain
          unless you choose to keep it as cross-domain.
        </p>

        {/* Cross-domain option */}
        <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg">
          <input
            type="checkbox"
            id="keep-cross-domain"
            checked={keepCrossDomain}
            onChange={(e) => setKeepCrossDomain(e.target.checked)}
            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
          />
          <label htmlFor="keep-cross-domain" className="text-sm text-gray-700">
            Keep as cross-domain if originally cross-domain
          </label>
        </div>

        {/* Error display */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* File upload */}
        <div className="border-b border-gray-200 pb-4">
          <FileUpload
            onFileSelect={handleFileImport}
            accept=".yaml,.yml"
            label="Upload YAML File"
            disabled={isProcessing}
          />
        </div>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-gray-500">Or</span>
          </div>
        </div>

        {/* URL import */}
        <UrlImport
          onImport={handleImportContent}
          label="Import from URL"
          placeholder="https://example.com/decision.yaml"
        />

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-gray-500">Or</span>
          </div>
        </div>

        {/* Paste import */}
        <PasteImport
          onImport={handleImportContent}
          label="Paste YAML Content"
          placeholder="Paste your decision YAML content here..."
          rows={8}
        />

        {/* Processing indicator */}
        {isProcessing && (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Importing...</span>
          </div>
        )}
      </div>
    </Dialog>
  );
};
