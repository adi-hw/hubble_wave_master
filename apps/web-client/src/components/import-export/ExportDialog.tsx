/**
 * ExportDialog - Production-Ready Data Export Component
 *
 * Provides a comprehensive export interface with:
 * - Multi-format support (CSV, Excel, JSON)
 * - Column selection
 * - Filter options (all data vs current view)
 * - Header configuration
 * - Custom filename
 * - Download progress tracking
 */

import React, { useState, useCallback } from 'react';
import {
  Download,
  FileSpreadsheet,
  FileJson,
  Check,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  onExport: (options: ExportOptions) => Promise<void>;
  collectionFields: CollectionField[];
  collectionName: string;
  hasActiveFilters?: boolean;
  filteredCount?: number;
  totalCount?: number;
}

export interface CollectionField {
  id: string;
  name: string;
  type: string;
}

export interface ExportOptions {
  format: 'csv' | 'xlsx' | 'json';
  fields: string[];
  includeHeaders: boolean;
  exportAll: boolean;
  filename: string;
}

type ExportStep = 'configure' | 'exporting' | 'complete';

const EXPORT_FORMATS = [
  {
    id: 'csv' as const,
    label: 'CSV',
    icon: FileSpreadsheet,
    description: 'Comma-separated values, compatible with Excel',
  },
  {
    id: 'xlsx' as const,
    label: 'Excel',
    icon: FileSpreadsheet,
    description: 'Microsoft Excel workbook format',
  },
  {
    id: 'json' as const,
    label: 'JSON',
    icon: FileJson,
    description: 'JavaScript Object Notation for developers',
  },
];

export const ExportDialog: React.FC<ExportDialogProps> = ({
  open,
  onClose,
  onExport,
  collectionFields,
  collectionName,
  hasActiveFilters = false,
  filteredCount = 0,
  totalCount = 0,
}) => {
  const [step, setStep] = useState<ExportStep>('configure');
  const [format, setFormat] = useState<'csv' | 'xlsx' | 'json'>('csv');
  const [selectedFields, setSelectedFields] = useState<Set<string>>(
    new Set(collectionFields.map((f) => f.id))
  );
  const [includeHeaders, setIncludeHeaders] = useState(true);
  const [exportAll, setExportAll] = useState(!hasActiveFilters);
  const [filename, setFilename] = useState(`${collectionName.toLowerCase()}_export`);
  const [progress, setProgress] = useState(0);

  const handleReset = useCallback(() => {
    setStep('configure');
    setFormat('csv');
    setSelectedFields(new Set(collectionFields.map((f) => f.id)));
    setIncludeHeaders(true);
    setExportAll(!hasActiveFilters);
    setFilename(`${collectionName.toLowerCase()}_export`);
    setProgress(0);
  }, [collectionFields, collectionName, hasActiveFilters]);

  const handleClose = useCallback(() => {
    handleReset();
    onClose();
  }, [handleReset, onClose]);

  const toggleField = useCallback((fieldId: string) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(fieldId)) {
        next.delete(fieldId);
      } else {
        next.add(fieldId);
      }
      return next;
    });
  }, []);

  const toggleAllFields = useCallback(() => {
    if (selectedFields.size === collectionFields.length) {
      setSelectedFields(new Set());
    } else {
      setSelectedFields(new Set(collectionFields.map((f) => f.id)));
    }
  }, [selectedFields, collectionFields]);

  const handleExport = useCallback(async () => {
    setStep('exporting');
    setProgress(0);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);

    try {
      await onExport({
        format,
        fields: Array.from(selectedFields),
        includeHeaders,
        exportAll,
        filename,
      });

      clearInterval(progressInterval);
      setProgress(100);
      setStep('complete');
    } catch (error) {
      console.error('Export failed:', error);
      clearInterval(progressInterval);
      setStep('configure');
    }
  }, [format, selectedFields, includeHeaders, exportAll, filename, onExport]);

  const recordCount = exportAll ? totalCount : filteredCount;
  const canExport = selectedFields.size > 0 && filename.trim().length > 0;

  const renderConfigureStep = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-semibold mb-3 text-foreground">
          Export Format
        </label>
        <div className="grid grid-cols-1 gap-3">
          {EXPORT_FORMATS.map((fmt) => {
            const Icon = fmt.icon;
            const isSelected = format === fmt.id;

            return (
              <button
                key={fmt.id}
                onClick={() => setFormat(fmt.id)}
                className={cn(
                  'flex items-start gap-4 p-4 rounded-lg text-left transition-all min-h-[44px]',
                  'focus:outline-none focus:ring-2 focus:ring-offset-2',
                  isSelected
                    ? 'bg-primary/10 border-2 border-primary'
                    : 'bg-muted border border-border hover:border-primary/50'
                )}
                aria-label={`Export as ${fmt.label}`}
                role="radio"
                aria-checked={isSelected}
              >
                <div
                  className={cn(
                    'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center',
                    isSelected ? 'bg-primary' : 'bg-card'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-5 w-5',
                      isSelected ? 'text-primary-foreground' : 'text-primary'
                    )}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold mb-1 text-foreground">
                    {fmt.label}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {fmt.description}
                  </div>
                </div>
                {isSelected && (
                  <Check className="h-5 w-5 flex-shrink-0 text-primary" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-semibold text-foreground">
            Select Columns
          </label>
          <button
            onClick={toggleAllFields}
            className="text-xs font-medium px-3 py-1.5 rounded-md transition-colors min-h-[32px] text-primary bg-primary/10 hover:bg-primary/20"
            aria-label={selectedFields.size === collectionFields.length ? 'Deselect all' : 'Select all'}
          >
            {selectedFields.size === collectionFields.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        <div className="max-h-[240px] overflow-y-auto scrollbar-thin space-y-2 p-3 rounded-lg bg-muted border border-border">
          {collectionFields.map((field) => {
            const isSelected = selectedFields.has(field.id);

            return (
              <label
                key={field.id}
                className={cn(
                  'flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors min-h-[44px]',
                  isSelected ? 'bg-card' : 'hover:bg-accent'
                )}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleField(field.id)}
                  className="flex-shrink-0 min-w-[20px] min-h-[20px]"
                  aria-label={`Select ${field.name}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">
                    {field.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {field.type}
                  </div>
                </div>
              </label>
            );
          })}
        </div>

        <p className="text-xs mt-2 text-muted-foreground">
          {selectedFields.size} of {collectionFields.length} columns selected
        </p>
      </div>

      {hasActiveFilters && (
        <div>
          <label className="text-sm font-semibold mb-3 block text-foreground">
            Data Scope
          </label>
          <div className="space-y-2">
            <label
              className={cn(
                'flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors',
                exportAll
                  ? 'bg-primary/10 border-2 border-primary'
                  : 'bg-muted border border-border hover:border-primary/50'
              )}
            >
              <input
                type="radio"
                checked={exportAll}
                onChange={() => setExportAll(true)}
                className="mt-0.5 flex-shrink-0 min-w-[20px] min-h-[20px]"
                aria-label="Export all records"
              />
              <div className="flex-1">
                <div className="text-sm font-medium mb-0.5 text-foreground">
                  All Records
                </div>
                <div className="text-xs text-muted-foreground">
                  Export all {totalCount.toLocaleString()} records
                </div>
              </div>
            </label>

            <label
              className={cn(
                'flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors',
                !exportAll
                  ? 'bg-primary/10 border-2 border-primary'
                  : 'bg-muted border border-border hover:border-primary/50'
              )}
            >
              <input
                type="radio"
                checked={!exportAll}
                onChange={() => setExportAll(false)}
                className="mt-0.5 flex-shrink-0 min-w-[20px] min-h-[20px]"
                aria-label="Export filtered records"
              />
              <div className="flex-1">
                <div className="text-sm font-medium mb-0.5 text-foreground">
                  Current View
                </div>
                <div className="text-xs text-muted-foreground">
                  Export filtered {filteredCount.toLocaleString()} records
                </div>
              </div>
            </label>
          </div>
        </div>
      )}

      <div>
        <label className="text-sm font-semibold mb-3 block text-foreground">
          Additional Options
        </label>
        <label className="flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors bg-muted border border-border hover:border-primary/50">
          <input
            type="checkbox"
            checked={includeHeaders}
            onChange={(e) => setIncludeHeaders(e.target.checked)}
            className="mt-0.5 flex-shrink-0 min-w-[20px] min-h-[20px]"
            aria-label="Include column headers"
          />
          <div className="flex-1">
            <div className="text-sm font-medium mb-0.5 text-foreground">
              Include Column Headers
            </div>
            <div className="text-xs text-muted-foreground">
              Add field names as the first row
            </div>
          </div>
        </label>
      </div>

      <div>
        <Input
          label="Filename"
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
          placeholder="export_filename"
          hint={`File will be saved as ${filename}.${format}`}
        />
      </div>

      <div className="rounded-lg p-3 flex items-start gap-2 bg-info-subtle border border-info-border">
        <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-info-text" />
        <div className="text-xs text-info-text">
          Exporting {recordCount.toLocaleString()} records with {selectedFields.size} columns in {format.toUpperCase()} format
        </div>
      </div>
    </div>
  );

  const renderExportingStep = () => (
    <div className="py-8 text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center bg-primary/10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
      <h3 className="text-lg font-semibold mb-2 text-foreground">
        Preparing Export
      </h3>
      <p className="text-sm mb-6 text-muted-foreground">
        Processing {recordCount.toLocaleString()} records...
      </p>

      <div className="max-w-xs mx-auto">
        <div className="w-full h-2 rounded-full overflow-hidden bg-muted">
          <div
            className="h-full transition-all duration-300 rounded-full bg-gradient-to-r from-primary to-primary/80"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs mt-2 text-muted-foreground">
          {progress}% complete
        </p>
      </div>
    </div>
  );

  const renderCompleteStep = () => (
    <div className="text-center py-8">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center bg-success-subtle">
        <Check className="h-8 w-8 text-success-text" />
      </div>
      <h3 className="text-lg font-semibold mb-2 text-foreground">
        Export Complete
      </h3>
      <p className="text-sm mb-6 text-muted-foreground">
        Successfully exported {recordCount.toLocaleString()} records
      </p>
      <div className="flex items-center justify-center gap-3">
        <Button variant="secondary" onClick={handleReset}>
          Export Again
        </Button>
        <Button variant="primary" onClick={handleClose}>
          Done
        </Button>
      </div>
    </div>
  );

  const getStepContent = () => {
    switch (step) {
      case 'configure':
        return renderConfigureStep();
      case 'exporting':
        return renderExportingStep();
      case 'complete':
        return renderCompleteStep();
      default:
        return null;
    }
  };

  const getFooterButtons = () => {
    if (step !== 'configure') return null;

    return (
      <>
        <Button variant="ghost" onClick={handleClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleExport}
          disabled={!canExport}
          leftIcon={<Download className="h-4 w-4" />}
        >
          Export {recordCount.toLocaleString()} Records
        </Button>
      </>
    );
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={step === 'complete' ? '' : `Export ${collectionName}`}
      size="lg"
      showCloseButton={step !== 'exporting'}
      closeOnBackdropClick={step !== 'exporting'}
      closeOnEscape={step !== 'exporting'}
      icon={step !== 'complete' ? <Download className="h-5 w-5" /> : undefined}
      footer={getFooterButtons()}
    >
      {getStepContent()}
    </Modal>
  );
};

export default ExportDialog;
