/**
 * BulkUpdateModal Component
 * HubbleWave Platform - Phase 1
 *
 * Production-ready bulk update modal with:
 * - Theme-aware styling using Tailwind CSS
 * - WCAG 2.1 AA accessibility compliance
 * - Mobile-friendly 44px touch targets
 * - Focus trap and keyboard navigation
 * - Screen reader announcements
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dropdownButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const filteredColumns = columns.filter(c => !c.hidden);
  const selectedColumnObj = columns.find(c => c.code === selectedColumn);

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      setSelectedColumn('');
      setNewValue('');
      setError(null);
      setIsUpdating(false);
      setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 0);
    } else {
      previousActiveElement.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowColumnDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showColumnDropdown) {
          setShowColumnDropdown(false);
        } else if (!isUpdating) {
          onClose();
        }
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose, isUpdating, isOpen, showColumnDropdown]);

  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const modal = modalRef.current;
    const focusableElements = modal.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    modal.addEventListener('keydown', handleTabKey);
    return () => modal.removeEventListener('keydown', handleTabKey);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleDropdownKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showColumnDropdown) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setShowColumnDropdown(true);
        setHighlightedIndex(0);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => Math.min(prev + 1, filteredColumns.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (filteredColumns[highlightedIndex]) {
          setSelectedColumn(filteredColumns[highlightedIndex].code);
          setNewValue('');
          setShowColumnDropdown(false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowColumnDropdown(false);
        dropdownButtonRef.current?.focus();
        break;
    }
  }, [showColumnDropdown, filteredColumns, highlightedIndex]);

  const handleUpdate = useCallback(async () => {
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
  }, [selectedColumn, newValue, onUpdate, onClose]);

  const handleBackdropClick = useCallback(() => {
    if (!isUpdating) {
      onClose();
    }
  }, [isUpdating, onClose]);

  const renderValueInput = () => {
    if (!selectedColumnObj) {
      return (
        <input
          type="text"
          disabled
          placeholder="Select a column first"
          className="w-full px-3 py-2.5 rounded-lg text-sm min-h-[44px] bg-muted text-muted-foreground border border-border"
        />
      );
    }

    const type = selectedColumnObj.type?.toLowerCase() || 'string';
    const baseInputClass = "w-full px-3 py-2.5 rounded-lg text-sm min-h-[44px] transition-colors focus:outline-none bg-card text-foreground border border-border focus:border-primary focus:ring-1 focus:ring-primary";

    switch (type) {
      case 'boolean':
        return (
          <div className="flex items-center gap-4" role="radiogroup" aria-label="Boolean value">
            <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
              <input
                type="radio"
                name="boolValue"
                checked={newValue === 'true'}
                onChange={() => setNewValue('true')}
                className="w-5 h-5 accent-primary"
              />
              <span className="text-sm text-foreground">
                Yes / True
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
              <input
                type="radio"
                name="boolValue"
                checked={newValue === 'false'}
                onChange={() => setNewValue('false')}
                className="w-5 h-5 accent-primary"
              />
              <span className="text-sm text-foreground">
                No / False
              </span>
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
            className={baseInputClass}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className={baseInputClass}
          />
        );

      case 'datetime':
        return (
          <input
            type="datetime-local"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className={baseInputClass}
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
            className="w-full px-3 py-2.5 rounded-lg text-sm transition-colors focus:outline-none resize-none bg-card text-foreground border border-border focus:border-primary focus:ring-1 focus:ring-primary"
          />
        );

      default:
        return (
          <input
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="Enter new value"
            className={baseInputClass}
          />
        );
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 backdrop-blur-sm bg-overlay/50"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-update-title"
        aria-describedby="bulk-update-description"
        className="relative w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden bg-card animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2
            id="bulk-update-title"
            className="text-lg font-semibold text-foreground"
          >
            Bulk Update
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            disabled={isUpdating}
            className="p-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center disabled:opacity-50 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div id="bulk-update-description" className="px-6 py-5 space-y-5">
          <div
            className="flex items-start gap-3 p-4 rounded-xl bg-warning-subtle border border-warning-border"
            role="alert"
          >
            <AlertTriangle
              className="h-5 w-5 flex-shrink-0 mt-0.5 text-warning-text"
              aria-hidden="true"
            />
            <div className="text-sm">
              <p className="font-medium text-foreground">
                You are about to update {selectedCount} record{selectedCount !== 1 ? 's' : ''}
              </p>
              <p className="mt-1 text-muted-foreground">
                This action will modify all selected records. Make sure to verify your selection before proceeding.
              </p>
            </div>
          </div>

          <div>
            <label
              id="column-select-label"
              className="block text-sm font-medium mb-2 text-foreground"
            >
              Select Column to Update
            </label>
            <div ref={dropdownRef} className="relative">
              <button
                ref={dropdownButtonRef}
                type="button"
                onClick={() => setShowColumnDropdown(!showColumnDropdown)}
                onKeyDown={handleDropdownKeyDown}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-left transition-colors min-h-[44px] bg-card border ${showColumnDropdown ? 'border-primary' : 'border-border'} ${selectedColumnObj ? 'text-foreground' : 'text-muted-foreground'}`}
                aria-haspopup="listbox"
                aria-expanded={showColumnDropdown}
                aria-labelledby="column-select-label"
              >
                <span>
                  {selectedColumnObj?.label || 'Choose a column...'}
                </span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform text-muted-foreground ${showColumnDropdown ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </button>

              {showColumnDropdown && (
                <div
                  className="absolute left-0 right-0 top-full mt-1 z-10 rounded-lg py-1 max-h-60 overflow-y-auto bg-card border border-border shadow-xl"
                  role="listbox"
                  aria-label="Select column"
                >
                  {filteredColumns.map((col, index) => (
                    <button
                      key={col.code}
                      type="button"
                      onClick={() => {
                        setSelectedColumn(col.code);
                        setNewValue('');
                        setShowColumnDropdown(false);
                      }}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors min-h-[44px] ${
                        highlightedIndex === index || selectedColumn === col.code ? 'bg-muted' : ''
                      } ${selectedColumn === col.code ? 'text-primary' : 'text-foreground'}`}
                      role="option"
                      aria-selected={selectedColumn === col.code}
                    >
                      <span>{col.label}</span>
                      {selectedColumn === col.code && (
                        <Check
                          className="h-4 w-4 text-primary"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">
              New Value
              {selectedColumnObj && (
                <span className="font-normal ml-2 text-muted-foreground">
                  ({selectedColumnObj.type || 'text'})
                </span>
              )}
            </label>
            {renderValueInput()}
            <p className="text-xs mt-1.5 text-muted-foreground">
              Leave empty to clear the field value for all selected records.
            </p>
          </div>

          {error && (
            <div
              className="p-3 rounded-lg text-sm bg-destructive/10 border border-destructive text-destructive"
              role="alert"
            >
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-muted border-t border-border">
          <button
            type="button"
            onClick={onClose}
            disabled={isUpdating}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors min-h-[44px] disabled:opacity-50 text-muted-foreground hover:bg-card hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpdate}
            disabled={!selectedColumn || isUpdating}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg shadow-sm transition-colors min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed ${
              !selectedColumn || isUpdating
                ? 'bg-muted text-muted-foreground'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            {isUpdating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Updating...</span>
              </>
            ) : (
              <>
                <Check className="h-4 w-4" aria-hidden="true" />
                <span>Update {selectedCount} Record{selectedCount !== 1 ? 's' : ''}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};
