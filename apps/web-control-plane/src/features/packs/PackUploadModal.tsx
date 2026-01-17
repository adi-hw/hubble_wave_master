import { useState, useRef, useCallback } from 'react';
import { X, Upload, FileArchive, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { colors } from '../../app/theme/theme';
import { controlPlaneApi } from '../../app/services/api';

interface PackUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: (artifactKey: string, artifactBucket: string) => void;
}

type UploadState = 'idle' | 'requesting-url' | 'uploading' | 'registering' | 'complete' | 'error';

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export function PackUploadModal({ isOpen, onClose, onUploadComplete }: PackUploadModalProps) {
  const [packCode, setPackCode] = useState('');
  const [releaseId, setReleaseId] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({ loaded: 0, total: 0, percentage: 0 });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const resetState = useCallback(() => {
    setPackCode('');
    setReleaseId('');
    setSelectedFile(null);
    setUploadState('idle');
    setUploadProgress({ loaded: 0, total: 0, percentage: 0 });
    setErrorMessage(null);
    setDragOver(false);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.name.endsWith('.zip') && !file.name.endsWith('.hwpack')) {
      setErrorMessage('Pack artifacts must be .zip or .hwpack files.');
      return;
    }
    setSelectedFile(file);
    setErrorMessage(null);
  }, []);

  const handleFileInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleUpload = useCallback(async () => {
    if (!selectedFile || !packCode.trim() || !releaseId.trim()) {
      setErrorMessage('Pack code, release ID, and artifact file are required.');
      return;
    }

    setErrorMessage(null);
    abortControllerRef.current = new AbortController();

    try {
      setUploadState('requesting-url');

      const uploadUrlResponse = await controlPlaneApi.createPackUploadUrl({
        code: packCode.trim(),
        releaseId: releaseId.trim(),
        filename: selectedFile.name,
      });

      setUploadState('uploading');

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            setUploadProgress({
              loaded: event.loaded,
              total: event.total,
              percentage: Math.round((event.loaded / event.total) * 100),
            });
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed due to network error.'));
        });

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload was cancelled.'));
        });

        abortControllerRef.current?.signal.addEventListener('abort', () => {
          xhr.abort();
        });

        xhr.open('PUT', uploadUrlResponse.url);
        xhr.setRequestHeader('Content-Type', 'application/octet-stream');
        xhr.send(selectedFile);
      });

      setUploadState('registering');

      await controlPlaneApi.registerPack({
        artifactKey: uploadUrlResponse.key,
        artifactBucket: uploadUrlResponse.bucket,
      });

      setUploadState('complete');
      onUploadComplete(uploadUrlResponse.key, uploadUrlResponse.bucket);
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'Upload was cancelled.') {
        setUploadState('idle');
        return;
      }
      setUploadState('error');
      const message = error instanceof Error ? error.message : 'An unexpected error occurred during upload.';
      setErrorMessage(message);
    }
  }, [selectedFile, packCode, releaseId, onUploadComplete]);

  const handleCancelUpload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setUploadState('idle');
    setUploadProgress({ loaded: 0, total: 0, percentage: 0 });
  }, []);

  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, exponent);
    return `${value.toFixed(exponent > 0 ? 1 : 0)} ${units[exponent]}`;
  }, []);

  const isUploading = uploadState === 'requesting-url' || uploadState === 'uploading' || uploadState === 'registering';
  const canSubmit = selectedFile && packCode.trim() && releaseId.trim() && !isUploading;

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)' }}
      onClick={handleClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border p-6"
        style={{ backgroundColor: colors.void.base, borderColor: colors.glass.border }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold" style={{ color: colors.text.primary }}>
            Upload Pack Artifact
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: colors.text.muted }}
          >
            <X size={20} />
          </button>
        </div>

        {uploadState === 'complete' ? (
          <div className="text-center py-8">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: colors.success.glow }}
            >
              <CheckCircle size={32} style={{ color: colors.success.base }} />
            </div>
            <h3 className="text-base font-semibold mb-2" style={{ color: colors.text.primary }}>
              Pack Registered Successfully
            </h3>
            <p className="text-sm mb-6" style={{ color: colors.text.secondary }}>
              {packCode}@{releaseId} has been uploaded and registered.
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-2.5 rounded-lg font-semibold text-white transition-opacity hover:opacity-90"
              style={{
                background: `linear-gradient(135deg, ${colors.brand.primary}, ${colors.brand.secondary})`,
              }}
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: colors.text.secondary }}>
                  Pack Code
                </label>
                <input
                  type="text"
                  value={packCode}
                  onChange={(e) => setPackCode(e.target.value)}
                  placeholder="e.g., eam-core"
                  disabled={isUploading}
                  className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-colors disabled:opacity-50"
                  style={{
                    backgroundColor: colors.glass.medium,
                    borderColor: colors.glass.border,
                    color: colors.text.primary,
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: colors.text.secondary }}>
                  Release ID
                </label>
                <input
                  type="text"
                  value={releaseId}
                  onChange={(e) => setReleaseId(e.target.value)}
                  placeholder="e.g., 1.0.0"
                  disabled={isUploading}
                  className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-colors disabled:opacity-50"
                  style={{
                    backgroundColor: colors.glass.medium,
                    borderColor: colors.glass.border,
                    color: colors.text.primary,
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: colors.text.secondary }}>
                  Artifact File
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip,.hwpack"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                <div
                  className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors"
                  style={{
                    borderColor: dragOver ? colors.brand.primary : colors.glass.border,
                    backgroundColor: dragOver ? colors.brand.glow : 'transparent',
                  }}
                  onClick={() => !isUploading && fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileArchive size={24} style={{ color: colors.brand.primary }} />
                      <div className="text-left">
                        <div className="text-sm font-medium" style={{ color: colors.text.primary }}>
                          {selectedFile.name}
                        </div>
                        <div className="text-xs" style={{ color: colors.text.tertiary }}>
                          {formatFileSize(selectedFile.size)}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload size={32} className="mx-auto mb-2" style={{ color: colors.text.muted }} />
                      <div className="text-sm" style={{ color: colors.text.secondary }}>
                        Drop a .zip or .hwpack file here, or click to browse
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {isUploading && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm" style={{ color: colors.text.secondary }}>
                    {uploadState === 'requesting-url' && 'Preparing upload...'}
                    {uploadState === 'uploading' && `Uploading... ${uploadProgress.percentage}%`}
                    {uploadState === 'registering' && 'Registering pack...'}
                  </span>
                  {uploadState === 'uploading' && (
                    <span className="text-xs" style={{ color: colors.text.tertiary }}>
                      {formatFileSize(uploadProgress.loaded)} / {formatFileSize(uploadProgress.total)}
                    </span>
                  )}
                </div>
                <div
                  className="h-2 rounded-full overflow-hidden"
                  style={{ backgroundColor: colors.glass.medium }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: uploadState === 'uploading' ? `${uploadProgress.percentage}%` : '100%',
                      backgroundColor: colors.brand.primary,
                      animation: uploadState !== 'uploading' ? 'pulse 1.5s infinite' : undefined,
                    }}
                  />
                </div>
              </div>
            )}

            {errorMessage && (
              <div
                className="flex items-start gap-3 p-4 rounded-xl mb-6"
                style={{ backgroundColor: colors.danger.glow }}
              >
                <AlertCircle size={20} style={{ color: colors.danger.base, flexShrink: 0, marginTop: 1 }} />
                <span className="text-sm" style={{ color: colors.danger.base }}>
                  {errorMessage}
                </span>
              </div>
            )}

            <div className="flex justify-end gap-3">
              {isUploading ? (
                <button
                  type="button"
                  onClick={handleCancelUpload}
                  className="px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors"
                  style={{ borderColor: colors.glass.border, color: colors.text.secondary }}
                >
                  Cancel
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors"
                    style={{ borderColor: colors.glass.border, color: colors.text.secondary }}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={handleUpload}
                    disabled={!canSubmit}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{
                      background: `linear-gradient(135deg, ${colors.brand.primary}, ${colors.brand.secondary})`,
                    }}
                  >
                    {isUploading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Upload size={16} />
                    )}
                    Upload & Register
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
