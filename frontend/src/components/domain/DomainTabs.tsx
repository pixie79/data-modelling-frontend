/**
 * Domain Tabs Component
 * Displays domain-based canvas tabs for organizing large models
 */

import React from 'react';
import { useModelStore } from '@/stores/modelStore';
import { HelpText } from '@/components/common/HelpText';

export interface DomainTabsProps {
  workspaceId: string;
}

export const DomainTabs: React.FC<DomainTabsProps> = () => {
  const { domains, selectedDomainId, setSelectedDomain } = useModelStore();

  const handleTabClick = (domainId: string) => {
    setSelectedDomain(domainId);
  };

  if (!domains || domains.length === 0) {
    return (
      <div className="flex items-center justify-center p-4 text-gray-500">
        <p>No domains available. Create a domain to get started.</p>
      </div>
    );
  }

  return (
    <div className="flex items-center border-b border-gray-200 bg-white" role="tablist" aria-label="Domain tabs">
      {domains.map((domain) => {
        const isSelected = selectedDomainId === domain.id;
        return (
          <button
            key={domain.id}
            onClick={() => handleTabClick(domain.id)}
            role="tab"
            aria-selected={isSelected}
            aria-controls={`domain-panel-${domain.id}`}
            id={`domain-tab-${domain.id}`}
            className={`
              px-4 py-2 text-sm font-medium border-b-2 transition-colors
              ${isSelected
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }
            `}
          >
            <div className="flex items-center gap-2">
              <span>{domain.name}</span>
              {domain.is_primary && (
                <span
                  className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded"
                  title="Primary domain"
                >
                  Primary
                </span>
              )}
            </div>
          </button>
        );
      })}
      <div className="ml-auto px-4">
        <HelpText
          text="Domains organize your model into separate canvases. Tables can appear on multiple domains but are only editable on their primary domain."
          title="About Domains"
        />
      </div>
    </div>
  );
};

