/**
 * File Upload Component
 * Handles file selection for imports
 */

import React, { useRef, useState } from 'react';

export interface FileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  maxSize?: number; // in bytes
  label?: string;
  disabled?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  accept = '*/*',
  maxSize,
  label = 'Upload File',
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (maxSize && file.size > maxSize) {
      setError(`File size exceeds maximum of ${maxSize / 1024 / 1024}MB`);
      return;
    }

    // Validate file type
    if (accept !== '*/*') {
      const acceptedTypes = accept.split(',').map((type) => type.trim());
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      const isValidType = acceptedTypes.some((type) => {
        if (type.startsWith('.')) {
          return type === fileExtension;
        }
        return file.type.match(type);
      });

      if (!isValidType) {
        setError(`File type not supported. Accepted types: ${accept}`);
        return;
      }
    }

    setError(null);
    setSelectedFile(file);
    onFileSelect(file);
  };

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  const handleRemove = () => {
    setSelectedFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled}
        aria-label="File upload"
      />
      
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleClick}
          disabled={disabled}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {label}
        </button>
        
        {selectedFile && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">{selectedFile.name}</span>
            <button
              type="button"
              onClick={handleRemove}
              className="text-sm text-red-600 hover:text-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
              aria-label="Remove file"
            >
              Remove
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

