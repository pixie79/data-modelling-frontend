/**
 * Loading Component
 * Displays loading spinner and message
 */

import React from 'react';
import { useUIStore } from '@/stores/uiStore';

export interface LoadingProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
}

export const Loading: React.FC<LoadingProps> = ({
  message = 'Loading...',
  size = 'md',
  fullScreen = false,
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  const spinner = (
    <div
      className={`${sizeClasses[size]} border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin`}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">{message}</span>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white bg-opacity-75 z-50">
        <div className="flex flex-col items-center space-y-4">
          {spinner}
          {message && <p className="text-gray-600">{message}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      {spinner}
      {message && <p className="text-gray-600">{message}</p>}
    </div>
  );
};

export const GlobalLoading: React.FC = () => {
  const { isGlobalLoading, loadingMessage } = useUIStore();

  if (!isGlobalLoading) return null;

  return <Loading message={loadingMessage || undefined} fullScreen />;
};

