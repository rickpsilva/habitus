import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, X, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import {
  DEFAULT_MAX_UPLOAD_SIZE_BYTES,
  formatUploadSizeLabel,
  getPlatformMaxUploadSizeBytes,
  isFileSizeWithinLimit,
} from '../utils/uploadLimits';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  maxSizeMB?: number;
  disabled?: boolean;
  currentFile?: File | null;
  removeFile?: () => void;
}

export default function FileUpload({
  onFileSelect,
  accept = '*/*',
  maxSizeMB,
  disabled = false,
  currentFile,
  removeFile
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [platformMaxSizeBytes, setPlatformMaxSizeBytes] = useState(DEFAULT_MAX_UPLOAD_SIZE_BYTES);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let mounted = true;

    getPlatformMaxUploadSizeBytes().then((value) => {
      if (!mounted) return;
      setPlatformMaxSizeBytes(value);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const effectiveMaxSizeBytes = useMemo(() => {
    if (typeof maxSizeMB !== 'number' || Number.isNaN(maxSizeMB) || maxSizeMB <= 0) {
      return platformMaxSizeBytes;
    }

    const propLimitBytes = maxSizeMB * 1024 * 1024;
    return Math.min(propLimitBytes, platformMaxSizeBytes);
  }, [maxSizeMB, platformMaxSizeBytes]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const validateFile = (file: File): string | null => {
    if (!isFileSizeWithinLimit(file, effectiveMaxSizeBytes)) {
      return `O ficheiro excede o limite de ${formatUploadSizeLabel(effectiveMaxSizeBytes)}`;
    }

    // Validate accept pattern if specified
    if (accept !== '*/*') {
      const acceptedTypes = accept.split(',').map(t => t.trim());
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      const isAccepted = acceptedTypes.some(
        type => type === file.type || type === fileExtension || type === '*/*'
      );
      
      if (!isAccepted) {
        return `File type not accepted. Accepted types: ${accept}`;
      }
    }

    return null;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const file = files[0];
      const validationError = validateFile(file);
      
      if (validationError) {
        setError(validationError);
        return;
      }

      onFileSelect(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      const validationError = validateFile(file);
      
      if (validationError) {
        setError(validationError);
        return;
      }

      onFileSelect(file);
    }
  };

  const handleClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled}
      />

      {currentFile ? (
        <div className="border-2 border-green-300 bg-green-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-600" />
                  <p className="font-medium text-gray-900">{currentFile.name}</p>
                </div>
                <p className="text-sm text-gray-600">{formatFileSize(currentFile.size)}</p>
              </div>
            </div>
            {removeFile && (
              <button
                type="button"
                onClick={removeFile}
                disabled={disabled}
                className="p-1 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                title="Remove file"
              >
                <X className="w-5 h-5 text-red-600" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
            transition-all duration-200
            ${isDragging 
              ? 'border-blue-500 bg-blue-50' 
              : error 
                ? 'border-red-300 bg-red-50' 
                : 'border-gray-300 hover:border-gray-400 bg-gray-50'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <div className="flex flex-col items-center gap-3">
            {error ? (
              <AlertCircle className="w-12 h-12 text-red-500" />
            ) : (
              <Upload className={`w-12 h-12 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
            )}
            
            <div>
              <p className={`font-medium ${error ? 'text-red-700' : 'text-gray-700'}`}>
                {error || (isDragging 
                  ? 'Drop file here' 
                  : 'Click to upload or drag and drop'
                )}
              </p>
              {!error && (
                <p className="text-sm text-gray-500 mt-1">
                  Tamanho máximo: {formatUploadSizeLabel(effectiveMaxSizeBytes)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
