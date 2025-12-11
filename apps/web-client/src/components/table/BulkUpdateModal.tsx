import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { X, AlertTriangle, ChevronDown, Check, Loader2 } from 'lucide-react';
import { TableColumn } from './types';

interface BulkUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  columns: TableColumn[];
  selectedCount: number;
  onUpdate: (columnCode: string, newValue: any) => Promise<void>;
}

export const BulkUpdateModal: React.FC<BulkUpdateModalProps> = ({
  isOpen,
  onClose,
  columns,
  selectedCount,
  onUpdate,
}) => {
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [newValue, setNewValue] = useState<string>('');
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedColumn('');
      setNewValue('');
      setError(null);
      setIsUpdating(false);
    }
  }, [isOpen]);

  // Handle click outside dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowColumnDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isUpdating) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose, isUpdating]);

  // Get the selected column object
  const selectedColumnObj = columns.find(c => c.code === selectedColumn);

  // Handle update
  const handleUpdate = async () => {
    if (!selectedColumn) {
      setError('Please select a column to update');
      return;
    }

    setIsUpdating(true);
    setError(null);

    try {
      await onUpdate(selectedColumn, newValue);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update records');
    } finally {
      setIsUpdating(false);
    }
  };

  // Render input based on column type
  const renderValueInput = () => {
    if (!selectedColumnObj) {
      return (
        <input
          type="text"
          disabled
          placeholder="Select a column first"
          className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-400 text-sm"
        />
      );
    }

    const type = selectedColumnObj.type?.toLowerCase() || 'string';

    switch (type) {
      case 'boolean':
        return (
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="boolValue"
                checked={newValue === 'true'}
                onChange={() => setNewValue('true')}
                className="w-4 h-4 text-primary-600 border-slate-300 focus:ring-primary-500"
              />
              <span className="text-sm text-slate-700">Yes / True</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="boolValue"
                checked={newValue === 'false'}
                onChange={() => setNewValue('false')}
                className="w-4 h-4 text-primary-600 border-slate-300 focus:ring-primary-500"
              />
              <span className="text-sm text-slate-700">No / False</span>
            </label>
          </div>
        );

      case 'number':
      case 'integer':
      case 'float':
      case 'decimal':
        return (
          <input
            type="number"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="Enter numeric value"
            className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 focus:outline-none transition-colors"
          />
        );

      case 'date':
        return (
          <input
            type="date"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 focus:outline-none transition-colors"
          />
        );

      case 'datetime':
        return (
          <input
            type="datetime-local"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 focus:outline-none transition-colors"
          />
        );

      case 'text':
      case 'longtext':
        return (
          <textarea
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="Enter new value"
            rows={4}
            className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 focus:outline-none transition-colors resize-none"
          />
        );

      default:
        return (
          <input
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="Enter new value"
            className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 focus:outline-none transition-colors"
          />
        );
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={() => !isUpdating && onClose()}
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
        style={{ animation: 'modalFadeIn 0.2s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Bulk Update</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isUpdating}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Warning */}
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-800">
                You are about to update {selectedCount} record{selectedCount !== 1 ? 's' : ''}
              </p>
              <p className="text-amber-700 mt-1">
                This action will modify all selected records. Make sure to verify your selection before proceeding.
              </p>
            </div>
          </div>

          {/* Column Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Select Column to Update
            </label>
            <div ref={dropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setShowColumnDropdown(!showColumnDropdown)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-left hover:border-slate-300 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 focus:outline-none transition-colors"
              >
                <span className={selectedColumnObj ? 'text-slate-900' : 'text-slate-400'}>
                  {selectedColumnObj?.label || 'Choose a column...'}
                </span>
                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${showColumnDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown */}
              {showColumnDropdown && (
                <div className="absolute left-0 right-0 top-full mt-1 z-10 bg-white border border-slate-200 rounded-lg shadow-xl py-1 max-h-60 overflow-y-auto">
                  {columns.filter(c => !c.hidden).map((col) => (
                    <button
                      key={col.code}
                      type="button"
                      onClick={() => {
                        setSelectedColumn(col.code);
                        setNewValue('');
                        setShowColumnDropdown(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                        selectedColumn === col.code
                          ? 'bg-primary-50 text-primary-700'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span>{col.label}</span>
                      {selectedColumn === col.code && <Check className="h-4 w-4" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Value Input */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              New Value
              {selectedColumnObj && (
                <span className="text-slate-400 font-normal ml-2">
                  ({selectedColumnObj.type || 'text'})
                </span>
              )}
            </label>
            {renderValueInput()}
            <p className="text-xs text-slate-500 mt-1.5">
              Leave empty to clear the field value for all selected records.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg text-sm text-danger-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            disabled={isUpdating}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpdate}
            disabled={!selectedColumn || isUpdating}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUpdating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Updating...</span>
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                <span>Update {selectedCount} Record{selectedCount !== 1 ? 's' : ''}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Animation styles */}
      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};
