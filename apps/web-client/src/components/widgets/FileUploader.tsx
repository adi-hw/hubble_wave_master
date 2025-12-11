import React, { useRef, useState } from 'react';
import { Upload, X, File as FileIcon } from 'lucide-react';

interface FileUploaderProps {
  value: any; // Can be a file object or URL string
  onChange: (file: File | null) => void;
  accept?: string;
  label?: string;
  disabled?: boolean;
  maxSize?: number;
  error?: boolean;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  value,
  onChange,
  accept = '*/*',
  label = 'Click or drag file to upload',
  disabled = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  // Handle drag events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    onChange(file);
    
    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };

  const removeFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setPreview(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const fileName =
    typeof File !== 'undefined' && value instanceof File ? (value as File).name : typeof value === 'string' ? value : null;

  return (
    <div
      className={`relative border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
        ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400 bg-gray-50'}
        ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
      `}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={disabled ? undefined : handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        onChange={handleChange}
        disabled={disabled}
      />

      {fileName ? (
        <div className="flex items-center justify-between bg-white p-2 rounded border shadow-sm">
          <div className="flex items-center gap-3 overflow-hidden">
            {preview ? (
              <img src={preview} alt="Preview" className="w-10 h-10 object-cover rounded" />
            ) : (
              <div className="p-2 bg-gray-100 rounded">
                <FileIcon size={20} className="text-gray-500" />
              </div>
            )}
            <span className="text-sm font-medium truncate max-w-[200px]">{fileName}</span>
          </div>
          <button
            type="button"
            onClick={removeFile}
            className="p-1 hover:bg-red-100 text-gray-500 hover:text-red-500 rounded-full transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div className="py-4">
          <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
          <p className="text-sm text-gray-600 font-medium">{label}</p>
          <p className="text-xs text-gray-400 mt-1">SVG, PNG, JPG or GIF (max. 10MB)</p>
        </div>
      )}
    </div>
  );
};
