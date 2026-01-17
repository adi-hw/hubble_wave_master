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
      className={`relative rounded-lg p-4 text-center cursor-pointer transition-colors border-2 border-dashed ${dragActive ? 'border-primary bg-primary/10' : 'border-border bg-muted'} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
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
        <div
          className="flex items-center justify-between p-2 rounded-lg shadow-sm bg-card border border-border"
        >
          <div className="flex items-center gap-3 overflow-hidden">
            {preview ? (
              <img src={preview} alt="Preview" className="w-10 h-10 object-cover rounded" />
            ) : (
              <div
                className="p-2 rounded bg-muted"
              >
                <FileIcon size={20} className="text-muted-foreground" />
              </div>
            )}
            <span className="text-sm font-medium truncate max-w-[200px] text-foreground">
              {fileName}
            </span>
          </div>
          <button
            type="button"
            onClick={removeFile}
            className="p-1 rounded-full transition-colors text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div className="py-4">
          <Upload className="mx-auto h-8 w-8 mb-2 text-muted-foreground" />
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-xs mt-1 text-muted-foreground">SVG, PNG, JPG or GIF (max. 10MB)</p>
        </div>
      )}
    </div>
  );
};
