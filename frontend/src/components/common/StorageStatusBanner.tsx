/**
 * Storage Status Banner Component
 * Shows warnings/info about browser storage capabilities
 */

import React, { useState } from 'react';
import { useDuckDBContextSafe } from '@/contexts/DuckDBContext';
import { StorageMode } from '@/types/duckdb';

export interface StorageStatusBannerProps {
  /** Additional CSS classes */
  className?: string;
  /** Whether the banner can be dismissed */
  dismissible?: boolean;
  /** Only show if there are warnings */
  warningsOnly?: boolean;
}

/**
 * Banner component that displays browser storage status
 * Shows warnings when OPFS is not available or cross-origin isolation is missing
 */
export const StorageStatusBanner: React.FC<StorageStatusBannerProps> = ({
  className = '',
  dismissible = true,
  warningsOnly = false,
}) => {
  const [dismissed, setDismissed] = useState(false);
  const duckdbContext = useDuckDBContextSafe();

  // Don't render if dismissed or no context
  if (dismissed || !duckdbContext) {
    return null;
  }

  const { isReady, isInitializing, storageMode, capabilities, error } = duckdbContext;

  // Determine banner type and content
  let bannerType: 'info' | 'warning' | 'error' | null = null;
  let title = '';
  let message = '';
  let details: string[] = [];

  if (error) {
    bannerType = 'error';
    title = 'Database Error';
    message = error.message;
  } else if (isInitializing) {
    if (warningsOnly) return null;
    bannerType = 'info';
    title = 'Initializing Database';
    message = 'Setting up browser storage...';
  } else if (isReady) {
    if (storageMode === StorageMode.Memory) {
      bannerType = 'warning';
      title = 'Using Temporary Storage';
      message =
        'Your browser does not support persistent storage. Data will be lost when you close or refresh the page.';

      if (capabilities) {
        if (!capabilities.opfs) {
          details.push('OPFS (Origin Private File System) is not supported');
        }
        if (!capabilities.crossOriginIsolated) {
          details.push('Cross-origin isolation is not enabled');
        }
        if (!capabilities.sharedArrayBuffer) {
          details.push('SharedArrayBuffer is not available');
        }
      }
    } else if (storageMode === StorageMode.OPFS) {
      if (warningsOnly) return null;
      // OPFS is working - show success info (optional)
      bannerType = 'info';
      title = 'Persistent Storage Active';
      message = 'Your data is stored locally and will persist across sessions.';
    }
  }

  // Don't render if no banner type determined
  if (!bannerType) {
    return null;
  }

  // Style configuration based on banner type
  const styles = {
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
      icon: (
        <svg
          className="w-5 h-5 text-blue-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    warning: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      text: 'text-yellow-800',
      icon: (
        <svg
          className="w-5 h-5 text-yellow-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      ),
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-800',
      icon: (
        <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
  };

  const style = styles[bannerType];

  return (
    <div className={`${style.bg} ${style.border} border rounded-lg p-4 ${className}`} role="alert">
      <div className="flex items-start">
        <div className="flex-shrink-0">{style.icon}</div>
        <div className="ml-3 flex-1">
          <h3 className={`text-sm font-medium ${style.text}`}>{title}</h3>
          <p className={`mt-1 text-sm ${style.text} opacity-90`}>{message}</p>

          {details.length > 0 && (
            <ul className={`mt-2 text-xs ${style.text} opacity-75 list-disc list-inside`}>
              {details.map((detail, i) => (
                <li key={i}>{detail}</li>
              ))}
            </ul>
          )}

          {bannerType === 'warning' && (
            <div className="mt-3">
              <a
                href="https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system"
                target="_blank"
                rel="noopener noreferrer"
                className={`text-xs ${style.text} underline hover:no-underline`}
              >
                Learn more about browser storage support
              </a>
            </div>
          )}
        </div>

        {dismissible && (
          <button
            onClick={() => setDismissed(true)}
            className={`ml-3 flex-shrink-0 ${style.text} hover:opacity-75 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded`}
            aria-label="Dismiss"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Compact version of the storage status banner for use in headers/toolbars
 */
export const StorageStatusIndicator: React.FC<{ className?: string }> = ({ className = '' }) => {
  const duckdbContext = useDuckDBContextSafe();

  if (!duckdbContext) {
    return null;
  }

  const { isReady, isInitializing, storageMode, error } = duckdbContext;

  let statusColor = 'text-gray-400';
  let statusText = 'Storage';
  let tooltip = 'Database status unknown';

  if (error) {
    statusColor = 'text-red-500';
    statusText = 'Error';
    tooltip = `Database error: ${error.message}`;
  } else if (isInitializing) {
    statusColor = 'text-yellow-500';
    statusText = 'Loading';
    tooltip = 'Initializing database...';
  } else if (isReady) {
    if (storageMode === StorageMode.OPFS) {
      statusColor = 'text-green-500';
      statusText = 'Persistent';
      tooltip = 'Using OPFS - data will persist';
    } else if (storageMode === StorageMode.Memory) {
      statusColor = 'text-orange-500';
      statusText = 'Temporary';
      tooltip = 'Using in-memory storage - data will be lost on refresh';
    }
  }

  return (
    <div className={`flex items-center gap-1.5 ${className}`} title={tooltip}>
      <div className={`w-2 h-2 rounded-full ${statusColor.replace('text-', 'bg-')}`} />
      <span className={`text-xs font-medium ${statusColor}`}>{statusText}</span>
    </div>
  );
};

export default StorageStatusBanner;
