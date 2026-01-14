/**
 * SDK Error Page
 * Displayed when the WASM SDK fails to load or is incompatible
 */

import React from 'react';

interface SDKErrorPageProps {
  error: Error;
}

export const SDKErrorPage: React.FC<SDKErrorPageProps> = ({ error }) => {
  const isVersionError =
    error.message.includes('incompatible') || error.message.includes('Missing methods');

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
            <svg
              className="w-6 h-6 text-red-600"
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
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isVersionError ? 'SDK Version Error' : 'SDK Loading Error'}
            </h1>
            <p className="text-gray-600">
              {isVersionError
                ? 'The data modelling SDK is outdated'
                : 'Failed to load the data modelling SDK'}
            </p>
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-red-800 font-mono break-words">{error.message}</p>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">How to fix this</h2>

          {isVersionError ? (
            <div className="space-y-3">
              <p className="text-gray-700">
                The application requires SDK version 2.0.6 or later. Please update the SDK package:
              </p>
              <div className="bg-gray-900 rounded-lg p-4">
                <code className="text-green-400 text-sm">
                  npm install @offenedatenmodellierung/data-modelling-sdk@latest
                </code>
              </div>
              <p className="text-gray-700">Then rebuild and restart the application.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-gray-700">This could be caused by:</p>
              <ul className="list-disc list-inside text-gray-700 space-y-1">
                <li>The WASM file failed to download</li>
                <li>Browser doesn't support WebAssembly</li>
                <li>Content Security Policy blocking WASM execution</li>
                <li>Network issues preventing the SDK from loading</li>
              </ul>
              <p className="text-gray-700 mt-4">Try the following:</p>
              <ul className="list-decimal list-inside text-gray-700 space-y-1">
                <li>Refresh the page</li>
                <li>Clear browser cache and reload</li>
                <li>Check browser console for additional errors</li>
                <li>Ensure you're using a modern browser (Chrome, Firefox, Safari, Edge)</li>
              </ul>
            </div>
          )}
        </div>

        <div className="mt-8 flex gap-4">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Reload Page
          </button>
          <a
            href="https://github.com/OffeneDatenmodellierung/data-modelling-sdk/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
          >
            View SDK Releases
          </a>
        </div>
      </div>
    </div>
  );
};

export default SDKErrorPage;
