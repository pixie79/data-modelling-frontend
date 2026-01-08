/**
 * BPMN Editor Component
 * React wrapper for bpmn-js Modeler
 * Provides BPMN 2.0 diagram editing capabilities
 */

import React, { useEffect, useRef, useState } from 'react';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
import { bpmnService } from '@/services/sdk/bpmnService';
import { useUIStore } from '@/stores/uiStore';

export interface BPMNEditorProps {
  xml?: string;
  name?: string;
  onSave?: (xml: string, name: string) => void;
  onClose?: () => void;
  readOnly?: boolean;
}

export const BPMNEditor: React.FC<BPMNEditorProps> = ({
  xml,
  name: initialName,
  onSave,
  onClose,
  readOnly = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<BpmnModeler | null>(null);
  const { addToast } = useUIStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processName, setProcessName] = useState(initialName || 'Untitled Process');

  // Initialize bpmn-js modeler
  useEffect(() => {
    if (!containerRef.current) return undefined;

    // Defer initialization to ensure container is fully rendered
    const timeoutId = setTimeout(() => {
      if (!containerRef.current) return;

      try {
        const modeler = new BpmnModeler({
          container: containerRef.current,
          // keyboard.bindTo is deprecated - keyboard binding is now implicit
        });

        modelerRef.current = modeler;

        // Import XML if provided
        if (xml) {
          modeler
            .importXML(xml)
            .then(() => {
              setIsLoading(false);
              setError(null);
            })
            .catch((err) => {
              console.error('Failed to import BPMN XML:', err);
              setError(`Failed to load BPMN diagram: ${err.message || 'Unknown error'}`);
              setIsLoading(false);
            });
        } else {
          // Create empty diagram
          modeler
            .createDiagram()
            .then(() => {
              setIsLoading(false);
            })
            .catch((err) => {
              console.error('Failed to create empty diagram:', err);
              setError(`Failed to initialize editor: ${err.message || 'Unknown error'}`);
              setIsLoading(false);
            });
        }
      } catch (err) {
        console.error('Failed to initialize BPMN modeler:', err);
        setError(
          `Failed to initialize editor: ${err instanceof Error ? err.message : 'Unknown error'}`
        );
        setIsLoading(false);
      }
    }, 100);

    // Cleanup on unmount
    return () => {
      clearTimeout(timeoutId);
      if (modelerRef.current) {
        modelerRef.current.destroy();
        modelerRef.current = null;
      }
    };
  }, []); // Only run once on mount

  // Re-import XML when it changes externally
  useEffect(() => {
    if (!modelerRef.current || !xml) return;

    modelerRef.current.importXML(xml).catch((err) => {
      console.error('Failed to re-import BPMN XML:', err);
      setError(`Failed to load BPMN diagram: ${err.message || 'Unknown error'}`);
    });
  }, [xml]);

  const handleSave = async () => {
    if (!modelerRef.current || !onSave) return;

    setIsSaving(true);
    setError(null);

    try {
      const { xml: exportedXml } = await modelerRef.current.saveXML({ format: true });
      if (!exportedXml) {
        throw new Error('Failed to export BPMN XML');
      }

      // Validate XML before saving
      const validation = await bpmnService.validateXML(exportedXml);
      if (!validation.valid) {
        throw new Error(
          `Invalid BPMN XML: ${validation.errors?.join(', ') || 'Validation failed'}`
        );
      }

      await onSave(exportedXml, processName.trim() || 'Untitled Process');
      addToast({
        type: 'success',
        message: 'BPMN diagram saved successfully',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save BPMN diagram';
      setError(errorMessage);
      addToast({
        type: 'error',
        message: errorMessage,
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-md">
          <h3 className="text-sm font-semibold text-red-800 mb-2">Error</h3>
          <p className="text-sm text-red-700">{error}</p>
          {onClose && (
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700"
            >
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 bg-gray-100 border-b border-gray-200">
        <div className="flex items-center gap-2 flex-1">
          <h3 className="text-sm font-semibold text-gray-700">BPMN Process Editor</h3>
          {isLoading && <span className="text-xs text-gray-500">Loading...</span>}
          {!readOnly && (
            <div className="flex items-center gap-2 ml-4">
              <label
                htmlFor="bpmn-process-name"
                className="text-xs text-gray-600 whitespace-nowrap"
              >
                Process Name:
              </label>
              <input
                id="bpmn-process-name"
                type="text"
                value={processName}
                onChange={(e) => setProcessName(e.target.value)}
                className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]"
                placeholder="Enter process name..."
              />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onSave && (
            <button
              onClick={handleSave}
              disabled={isSaving || isLoading || readOnly || !processName.trim()}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Editor Container */}
      <div ref={containerRef} className="flex-1 min-h-0" style={{ height: '100%' }} />
    </div>
  );
};
