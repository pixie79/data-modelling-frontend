/**
 * View Selector Component
 * Allows users to switch between different view modes for a domain
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useModelStore, type ViewMode } from '@/stores/modelStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { HelpText } from '@/components/common/HelpText';
import { getPlatform } from '@/services/platform/platform';
import { closeElectronApp } from '@/services/platform/electron';
import { useUIStore } from '@/stores/uiStore';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

export interface ViewSelectorProps {
  domainId: string;
}

const VIEW_MODES: Array<{ value: ViewMode; label: string; description: string }> = [
  {
    value: 'systems',
    label: 'Systems View',
    description: 'High-level data flow visualization between physical systems',
  },
  {
    value: 'process',
    label: 'System Process View',
    description: 'Detailed ETL processes within systems',
  },
  {
    value: 'operational',
    label: 'Operational Level',
    description: 'Filter tables by operational data level',
  },
  {
    value: 'analytical',
    label: 'Analytical Levels',
    description: 'Filter tables by analytical data levels (Bronze, Silver, Gold)',
  },
  {
    value: 'products',
    label: 'Data Products',
    description: 'View ODPS data products',
  },
];

export const ViewSelector: React.FC<ViewSelectorProps> = ({ domainId }) => {
  const navigate = useNavigate();
  const { currentView, setCurrentView, systems, selectedSystemId } = useModelStore();
  const { manualSave, pendingChanges, autoSaveEnabled, setAutoSaveEnabled } = useWorkspaceStore();
  const { addToast } = useUIStore();
  const [isSaving, setIsSaving] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const handleViewChange = (view: ViewMode) => {
    setCurrentView(view);
  };

  const handleManualSave = async () => {
    setIsSaving(true);
    try {
      await manualSave();
    } catch (error) {
      console.error('Failed to save:', error);
      addToast({
        type: 'error',
        message: `Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseApp = () => {
    const platform = getPlatform();
    
    // Check for pending changes - show confirmation dialog with options
    if (pendingChanges) {
      setShowExitConfirm(true);
    } else {
      // No pending changes, close immediately
      if (platform === 'electron') {
        closeElectronApp().catch((error) => {
          console.error('Failed to close app:', error);
          addToast({
            type: 'error',
            message: 'Failed to close application',
          });
        });
      } else {
        // Browser mode: Navigate back to workspace selection
        navigate('/');
      }
    }
  };

  const handleExitWithSave = async () => {
    setIsClosing(true);
    setShowExitConfirm(false);
    const platform = getPlatform();
    
    try {
      await manualSave();
      // Small delay to show save feedback
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (platform === 'electron') {
        await closeElectronApp();
      } else {
        // Browser mode: Navigate back to workspace selection
        navigate('/');
      }
    } catch (error) {
      console.error('Failed to save before closing:', error);
      addToast({
        type: 'error',
        message: 'Failed to save changes. Workspace will not close.',
      });
      setIsClosing(false);
    }
  };

  const handleExitWithoutSave = async () => {
    setShowExitConfirm(false);
    setIsClosing(true);
    const platform = getPlatform();
    
    try {
      if (platform === 'electron') {
        await closeElectronApp();
      } else {
        // Browser mode: Navigate back to workspace selection
        navigate('/');
      }
    } catch (error) {
      console.error('Failed to close workspace:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to close workspace';
      addToast({
        type: 'error',
        message: platform === 'electron' && (errorMessage.includes('not available') || errorMessage.includes('not a function'))
          ? 'Close app feature requires rebuilding Electron. Please rebuild the app.'
          : 'Failed to close workspace',
      });
      setIsClosing(false);
    }
  };

  // Filter systems for current domain
  const domainSystems = systems.filter((s) => s.domain_id === domainId);
  const hasSystems = domainSystems.length > 0;

  // Views that require systems to exist
  const systemDependentViews: ViewMode[] = ['process', 'operational', 'analytical'];
  
  // Get selected system if one is selected
  const selectedSystem = selectedSystemId ? systems.find((s) => s.id === selectedSystemId) : null;
  const showSelectedSystem = selectedSystem && systemDependentViews.includes(currentView);

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200" role="tablist" aria-label="View mode selector">
      <span className="text-sm font-medium text-gray-700 mr-2">View:</span>
      {VIEW_MODES.map((view) => {
        const isSelected = currentView === view.value;
        const requiresSystems = systemDependentViews.includes(view.value);
        const isDisabled = requiresSystems && !hasSystems;
        
        return (
          <button
            key={view.value}
            onClick={() => !isDisabled && handleViewChange(view.value)}
            role="tab"
            aria-selected={isSelected}
            disabled={isDisabled}
            className={`
              px-3 py-1 text-sm font-medium rounded transition-colors
              ${isSelected
                ? 'bg-blue-600 text-white'
                : isDisabled
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
              }
            `}
            title={isDisabled ? `${view.description} (requires systems)` : view.description}
          >
            {view.label}
          </button>
        );
      })}
      
      {/* Selected System indicator - only show in system-dependent views */}
      {showSelectedSystem && (
        <div className="ml-4 flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-200 rounded">
          <span className="text-xs font-medium text-indigo-700">System:</span>
          <span className="text-xs text-indigo-900 font-semibold">
            {selectedSystem.name}
          </span>
          <span className="text-xs text-indigo-600">
            ({selectedSystem.system_type})
          </span>
        </div>
      )}
      
      <div className="ml-auto flex items-center gap-2">
        {/* Auto-save Toggle */}
        <label className="flex items-center gap-2 px-2 py-1 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={autoSaveEnabled}
            onChange={(e) => setAutoSaveEnabled(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            title={autoSaveEnabled ? 'Auto-save enabled' : 'Auto-save disabled'}
          />
          <span className="text-xs">Auto-save</span>
        </label>

        {/* Manual Save Button */}
        <button
          onClick={handleManualSave}
          disabled={isSaving || isClosing}
          className={`
            px-3 py-1 text-sm font-medium rounded transition-colors flex items-center gap-1
            ${pendingChanges
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }
            ${(isSaving || isClosing) ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          title={pendingChanges ? 'Save changes' : 'No unsaved changes'}
        >
          {isSaving ? (
            <>
              <span className="animate-spin">⏳</span>
              <span>Saving...</span>
            </>
          ) : (
            <>
              <span>💾</span>
              <span>Save</span>
              {pendingChanges && <span className="text-xs">*</span>}
            </>
          )}
        </button>

        {/* Exit/Close Button - available in both Electron and Browser */}
        <button
          onClick={handleCloseApp}
          disabled={isClosing}
          className={`
            px-3 py-1 text-sm font-medium rounded transition-colors flex items-center gap-1
            bg-red-600 text-white hover:bg-red-700
            ${isClosing ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          title={getPlatform() === 'electron' ? 'Close application' : 'Close workspace and return to workspace selection'}
        >
          {isClosing ? (
            <>
              <span className="animate-spin">⏳</span>
              <span>{getPlatform() === 'electron' ? 'Closing...' : 'Closing...'}</span>
            </>
          ) : (
            <>
              <span>✕</span>
              <span>Exit</span>
            </>
          )}
        </button>
        
        <HelpText
          text="View modes are filters/views of the same domain data. Process, Operational, and Analytical views require systems to exist. Switch between views to see different perspectives of your domain."
          title="About View Modes"
        />
      </div>

      {/* Exit Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showExitConfirm}
        onClose={() => {
          setShowExitConfirm(false);
          setIsClosing(false);
        }}
        title="Unsaved Changes"
        message={`You have unsaved changes. What would you like to do?${getPlatform() === 'browser' ? ' Closing the workspace will return you to workspace selection.' : ''}`}
        actions={[
          {
            label: 'Cancel',
            onClick: () => {
              setShowExitConfirm(false);
              setIsClosing(false);
            },
            variant: 'secondary',
          },
          {
            label: "Don't Save",
            onClick: handleExitWithoutSave,
            variant: 'danger',
          },
          {
            label: 'Save',
            onClick: handleExitWithSave,
            variant: 'primary',
          },
        ]}
      />
    </div>
  );
};

