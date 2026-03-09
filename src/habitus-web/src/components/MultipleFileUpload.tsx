import React, { useRef, useState } from 'react';
import { Upload, X, FileText, AlertCircle } from 'lucide-react';

interface MultipleFileUploadProps {
  onFilesSelect: (files: File[]) => void;
  accept?: string;
  maxSizeMB?: number;
  disabled?: boolean;
  currentFiles?: File[];
  removeFile?: (index: number) => void;
  maxFiles?: number;
}

export default function MultipleFileUpload({
  onFilesSelect,
  accept = '*/*',
  maxSizeMB = 100,
  disabled = false,
  currentFiles = [],
  removeFile,
  maxFiles = 10
}: MultipleFileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const validateFiles = (files: FileList | File[]): { valid: File[]; errors: string[] } => {
    const validFiles: File[] = [];
    const errors: string[] = [];
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    Array.from(files).forEach((file) => {
      if (file.size > maxSizeBytes) {
        errors.push(`${file.name}: Excede ${maxSizeMB}MB`);
        return;
      }

      // Validate accept pattern if specified
      if (accept !== '*/*') {
        const acceptedTypes = accept.split(',').map(t => t.trim());
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
        const isAccepted = acceptedTypes.some(
          type => type === file.type || type === fileExtension || type === '*/*'
        );
        
        if (!isAccepted) {
          errors.push(`${file.name}: Tipo não aceite`);
          return;
        }
      }

      validFiles.push(file);
    });

    // Check max files limit
    if (currentFiles.length + validFiles.length > maxFiles) {
      errors.push(`Máximo de ${maxFiles} ficheiros permitidos`);
      return { valid: [], errors };
    }

    return { valid: validFiles, errors };
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);

    if (disabled) return;

    const { valid, errors } = validateFiles(e.dataTransfer.files);
    
    if (errors.length > 0) {
      setError(errors.join(', '));
      return;
    }

    if (valid.length > 0) {
      onFilesSelect([...currentFiles, ...valid]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    
    if (!e.target.files) return;

    const { valid, errors } = validateFiles(e.target.files);
    
    if (errors.length > 0) {
      setError(errors.join(', '));
      return;
    }

    if (valid.length > 0) {
      onFilesSelect([...currentFiles, ...valid]);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
    <div className="w-full space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled}
        multiple
      />

      {/* Selected Files List */}
      {currentFiles.length > 0 && (
        <div className="space-y-2">
          {currentFiles.map((file, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <FileText className="w-4 h-4 text-green-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                  <p className="text-xs text-gray-600">{formatFileSize(file.size)}</p>
                </div>
              </div>
              {removeFile && (
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  disabled={disabled}
                  className="p-1 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50 shrink-0"
                  title="Remover ficheiro"
                >
                  <X className="w-4 h-4 text-red-600" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
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
        <div className="flex flex-col items-center gap-2">
          {error ? (
            <AlertCircle className="w-10 h-10 text-red-500" />
          ) : (
            <Upload className={`w-10 h-10 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
          )}
          
          <div>
            <p className={`text-sm font-medium ${error ? 'text-red-700' : 'text-gray-700'}`}>
              {error || (isDragging 
                ? 'Soltar ficheiros aqui' 
                : currentFiles.length > 0
                  ? 'Adicionar mais ficheiros'
                  : 'Clique ou arraste ficheiros'
              )}
            </p>
            {!error && (
              <p className="text-xs text-gray-500 mt-1">
                Máximo: {maxSizeMB}MB por ficheiro • {maxFiles} ficheiros no total
              </p>
            )}
            {currentFiles.length > 0 && !error && (
              <p className="text-xs text-indigo-600 font-medium mt-1">
                {currentFiles.length} de {maxFiles} ficheiros selecionados
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
