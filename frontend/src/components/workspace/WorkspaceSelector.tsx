/**
 * Workspace Selector Component
 * Dropdown selector for switching between workspaces
 */

import React, { useState, useRef, useEffect } from 'react';
import { useWorkspaceStore } from '@/stores/workspaceStore';

export interface WorkspaceSelectorProps {
  className?: string;
}

export const WorkspaceSelector: React.FC<WorkspaceSelectorProps> = ({ className = '' }) => {
  const { workspaces, currentWorkspaceId, setCurrentWorkspace } = useWorkspaceStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (workspaceId: string) => {
    setCurrentWorkspace(workspaceId);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span className="font-medium text-gray-900">
          {currentWorkspace?.name || 'Select Workspace'}
        </span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          {workspaces.map((workspace) => (
            <button
              key={workspace.id}
              onClick={() => handleSelect(workspace.id)}
              className={`
                w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors
                ${currentWorkspaceId === workspace.id ? 'bg-blue-50' : ''}
              `}
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{workspace.name}</span>
                  <span
                    className={`
                      px-2 py-1 text-xs rounded
                      bg-gray-100 text-gray-800
                    `}
                  >
                    Workspace
                  </span>
                </div>
                {workspace.domains && workspace.domains.length > 0 && (
                  <span className="text-xs text-gray-500">
                    {workspace.domains.length} {workspace.domains.length === 1 ? 'domain' : 'domains'}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

