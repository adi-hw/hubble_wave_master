/**
 * SchemaImportExport Component
 * HubbleWave Platform - Phase 2
 *
 * Import and export schema definitions as JSON/YAML files.
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  Upload,
  Download,
  FileJson,
  FileCode,
  AlertCircle,
  CheckCircle,
  X,
  Copy,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { SchemaCollection, SchemaRelationship } from './types';

export type ExportFormat = 'json' | 'yaml';

export interface ExportOptions {
  format: ExportFormat;
  includeRelationships: boolean;
  includeMetadata: boolean;
  prettyPrint: boolean;
  selectedCollections?: string[];
}

export interface ImportResult {
  success: boolean;
  collections: SchemaCollection[];
  relationships: SchemaRelationship[];
  errors: string[];
  warnings: string[];
}

interface SchemaImportExportProps {
  collections: SchemaCollection[];
  relationships: SchemaRelationship[];
  onImport: (result: ImportResult) => Promise<void>;
  onClose?: () => void;
}

// Simple YAML serialization for schema export
function toYaml(obj: Record<string, unknown>, indent = 0): string {
  const spaces = '  '.repeat(indent);
  let result = '';

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;

    if (Array.isArray(value)) {
      if (value.length === 0) {
        result += `${spaces}${key}: []\n`;
      } else if (typeof value[0] === 'object') {
        result += `${spaces}${key}:\n`;
        value.forEach((item) => {
          result += `${spaces}  -\n`;
          result += toYaml(item as Record<string, unknown>, indent + 2);
        });
      } else {
        result += `${spaces}${key}:\n`;
        value.forEach((item) => {
          result += `${spaces}  - ${JSON.stringify(item)}\n`;
        });
      }
    } else if (typeof value === 'object') {
      result += `${spaces}${key}:\n`;
      result += toYaml(value as Record<string, unknown>, indent + 1);
    } else if (typeof value === 'string') {
      const needsQuotes = value.includes(':') || value.includes('#') || value.includes('\n');
      result += `${spaces}${key}: ${needsQuotes ? `"${value.replace(/"/g, '\\"')}"` : value}\n`;
    } else {
      result += `${spaces}${key}: ${value}\n`;
    }
  }

  return result;
}

// Parse simple YAML to object
function fromYaml(yaml: string): Record<string, unknown> {
  const lines = yaml.split('\n');
  const result: Record<string, unknown> = {};
  const stack: { indent: number; obj: Record<string, unknown> | unknown[] }[] = [{ indent: -1, obj: result }];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimEnd();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const indent = line.search(/\S/);
    if (indent === -1) continue;

    // Pop from stack based on indent
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const currentObj = stack[stack.length - 1].obj;

    // Array item
    if (trimmed.startsWith('-')) {
      const content = trimmed.slice(1).trim();
      if (Array.isArray(currentObj)) {
        if (content) {
          currentObj.push(parseYamlValue(content));
        } else {
          const newObj: Record<string, unknown> = {};
          currentObj.push(newObj);
          stack.push({ indent, obj: newObj });
        }
      }
      continue;
    }

    // Key-value pair
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) continue;

    const key = trimmed.slice(0, colonIndex).trim();
    const valueStr = trimmed.slice(colonIndex + 1).trim();

    if (!valueStr) {
      // Check next line to determine if array or object
      const nextLine = lines[i + 1] || '';
      const nextTrimmed = nextLine.trim();
      if (nextTrimmed.startsWith('-')) {
        const newArr: unknown[] = [];
        (currentObj as Record<string, unknown>)[key] = newArr;
        stack.push({ indent, obj: newArr });
      } else {
        const newObj: Record<string, unknown> = {};
        (currentObj as Record<string, unknown>)[key] = newObj;
        stack.push({ indent, obj: newObj });
      }
    } else {
      (currentObj as Record<string, unknown>)[key] = parseYamlValue(valueStr);
    }
  }

  return result;
}

function parseYamlValue(value: string): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (value === '[]') return [];
  if (value === '{}') return {};
  if (/^-?\d+$/.test(value)) return parseInt(value, 10);
  if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

// Validate imported schema
function validateSchema(data: Record<string, unknown>): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data.collections && !data.collection) {
    errors.push('Missing collections array or collection object');
    return { valid: false, errors, warnings };
  }

  const collections = data.collections || [data.collection];
  if (!Array.isArray(collections)) {
    errors.push('Collections must be an array');
    return { valid: false, errors, warnings };
  }

  collections.forEach((col: Record<string, unknown>, index: number) => {
    if (!col.code) {
      errors.push(`Collection at index ${index} missing required 'code' field`);
    }
    if (!col.name) {
      errors.push(`Collection at index ${index} missing required 'name' field`);
    }
    if (!col.properties || !Array.isArray(col.properties)) {
      warnings.push(`Collection '${col.name || index}' has no properties defined`);
    }
  });

  return { valid: errors.length === 0, errors, warnings };
}

export const SchemaImportExport: React.FC<SchemaImportExportProps> = ({
  collections,
  relationships,
  onImport,
  onClose,
}) => {
  const [mode, setMode] = useState<'export' | 'import'>('export');
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'json',
    includeRelationships: true,
    includeMetadata: true,
    prettyPrint: true,
    selectedCollections: collections.map((c) => c.id),
  });
  const [importData, setImportData] = useState<string>('');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate export content
  const generateExportContent = useCallback((): string => {
    const selectedCollections = collections.filter((c) =>
      exportOptions.selectedCollections?.includes(c.id)
    );

    const exportData: Record<string, unknown> = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      collections: selectedCollections.map((col) => {
        const data: Record<string, unknown> = {
          code: col.code,
          name: col.name,
          description: col.description,
          singularName: col.singularName,
          pluralName: col.pluralName,
          icon: col.icon,
          color: col.color,
          properties: col.properties.map((prop) => ({
            code: prop.code,
            name: prop.name,
            type: prop.type,
            required: prop.required,
            unique: prop.unique,
            indexed: prop.indexed,
            description: prop.description,
            config: prop.config,
          })),
        };

        if (exportOptions.includeMetadata) {
          data.isSystem = col.isSystem;
        }

        return data;
      }),
    };

    if (exportOptions.includeRelationships) {
      const relevantRelationships = relationships.filter(
        (r) =>
          exportOptions.selectedCollections?.includes(r.sourceCollection) ||
          exportOptions.selectedCollections?.includes(r.targetCollection)
      );

      if (relevantRelationships.length > 0) {
        exportData.relationships = relevantRelationships.map((rel) => ({
          name: rel.name,
          sourceCollection: collections.find((c) => c.id === rel.sourceCollection)?.code,
          sourceProperty: rel.sourceProperty,
          targetCollection: collections.find((c) => c.id === rel.targetCollection)?.code,
          targetProperty: rel.targetProperty,
          type: rel.type,
          cascadeDelete: rel.cascadeDelete,
          required: rel.required,
        }));
      }
    }

    if (exportOptions.format === 'yaml') {
      return toYaml(exportData);
    }

    return JSON.stringify(exportData, null, exportOptions.prettyPrint ? 2 : 0);
  }, [collections, relationships, exportOptions]);

  // Handle export
  const handleExport = useCallback(() => {
    const content = generateExportContent();
    const blob = new Blob([content], {
      type: exportOptions.format === 'json' ? 'application/json' : 'text/yaml',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `schema-export.${exportOptions.format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [generateExportContent, exportOptions.format]);

  // Handle copy to clipboard
  const handleCopy = useCallback(async () => {
    const content = generateExportContent();
    await navigator.clipboard.writeText(content);
  }, [generateExportContent]);

  // Preview export
  const handlePreview = useCallback(() => {
    const content = generateExportContent();
    setPreviewContent(content);
    setShowPreview(true);
  }, [generateExportContent]);

  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImportData(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  }, []);

  // Handle file select
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImportData(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  }, []);

  // Parse and validate import data
  const handleValidate = useCallback(() => {
    setIsProcessing(true);
    try {
      let parsed: Record<string, unknown>;

      // Try JSON first
      try {
        parsed = JSON.parse(importData);
      } catch {
        // Try YAML
        parsed = fromYaml(importData);
      }

      const validation = validateSchema(parsed);

      if (!validation.valid) {
        setImportResult({
          success: false,
          collections: [],
          relationships: [],
          errors: validation.errors,
          warnings: validation.warnings,
        });
        return;
      }

      // Convert to collections
      const rawCollections = (parsed.collections || [parsed.collection]) as Record<string, unknown>[];
      const importedCollections: SchemaCollection[] = rawCollections.map((col) => ({
        id: `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        code: String(col.code || ''),
        name: String(col.name || ''),
        description: col.description ? String(col.description) : undefined,
        singularName: col.singularName ? String(col.singularName) : undefined,
        pluralName: col.pluralName ? String(col.pluralName) : undefined,
        icon: col.icon ? String(col.icon) : undefined,
        color: col.color ? String(col.color) : undefined,
        isSystem: Boolean(col.isSystem),
        properties: ((col.properties as Record<string, unknown>[]) || []).map((prop) => ({
          id: `import-prop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          code: String(prop.code || ''),
          name: String(prop.name || ''),
          type: String(prop.type || 'string') as SchemaCollection['properties'][0]['type'],
          required: Boolean(prop.required),
          unique: Boolean(prop.unique),
          indexed: Boolean(prop.indexed),
          description: prop.description ? String(prop.description) : undefined,
          config: prop.config as SchemaCollection['properties'][0]['config'],
        })),
      }));

      // Convert relationships if present
      const importedRelationships: SchemaRelationship[] = [];
      if (parsed.relationships && Array.isArray(parsed.relationships)) {
        (parsed.relationships as Record<string, unknown>[]).forEach((rel) => {
          const sourceCol = importedCollections.find((c) => c.code === rel.sourceCollection);
          const targetCol = importedCollections.find((c) => c.code === rel.targetCollection);

          if (sourceCol && targetCol) {
            importedRelationships.push({
              id: `import-rel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              name: String(rel.name || ''),
              sourceCollection: sourceCol.id,
              sourceProperty: String(rel.sourceProperty || ''),
              targetCollection: targetCol.id,
              targetProperty: rel.targetProperty ? String(rel.targetProperty) : undefined,
              type: (rel.type as SchemaRelationship['type']) || 'one_to_many',
              cascadeDelete: Boolean(rel.cascadeDelete),
              required: Boolean(rel.required),
            });
          }
        });
      }

      setImportResult({
        success: true,
        collections: importedCollections,
        relationships: importedRelationships,
        errors: [],
        warnings: validation.warnings,
      });
    } catch (error) {
      setImportResult({
        success: false,
        collections: [],
        relationships: [],
        errors: [`Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: [],
      });
    } finally {
      setIsProcessing(false);
    }
  }, [importData]);

  // Handle import confirmation
  const handleConfirmImport = useCallback(async () => {
    if (!importResult || !importResult.success) return;

    setIsProcessing(true);
    try {
      await onImport(importResult);
      onClose?.();
    } finally {
      setIsProcessing(false);
    }
  }, [importResult, onImport, onClose]);

  return (
    <div
      className="flex flex-col h-full max-h-[80vh] rounded-xl overflow-hidden bg-card border border-border"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 flex-shrink-0 border-b border-border"
      >
        <div className="flex items-center gap-4">
          {/* Mode Toggle */}
          <div
            className="flex items-center rounded-lg p-1 bg-muted"
          >
            <button
              onClick={() => setMode('export')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === 'export' ? 'bg-card text-primary' : 'bg-transparent text-muted-foreground'
              }`}
            >
              <Download size={16} />
              Export
            </button>
            <button
              onClick={() => setMode('import')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === 'import' ? 'bg-card text-primary' : 'bg-transparent text-muted-foreground'
              }`}
            >
              <Upload size={16} />
              Import
            </button>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-opacity-50 text-muted-foreground"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {mode === 'export' ? (
          <div className="space-y-6">
            {/* Format Selection */}
            <div>
              <label
                className="block text-sm font-medium mb-2 text-foreground"
              >
                Export Format
              </label>
              <div className="flex gap-3">
                {(['json', 'yaml'] as const).map((format) => (
                  <button
                    key={format}
                    onClick={() => setExportOptions({ ...exportOptions, format })}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors border ${
                      exportOptions.format === format
                        ? 'bg-primary/10 border-primary'
                        : 'bg-muted border-border'
                    }`}
                  >
                    {format === 'json' ? <FileJson size={24} /> : <FileCode size={24} />}
                    <div className="text-left">
                      <div className="font-medium text-foreground">
                        {format.toUpperCase()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format === 'json' ? 'JavaScript Object Notation' : 'Human-readable format'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Collection Selection */}
            <div>
              <label
                className="block text-sm font-medium mb-2 text-foreground"
              >
                Collections to Export ({exportOptions.selectedCollections?.length || 0} selected)
              </label>
              <div
                className="max-h-48 overflow-y-auto rounded-lg p-3 bg-muted border border-border"
              >
                {collections.map((col) => (
                  <label key={col.id} className="flex items-center gap-3 py-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exportOptions.selectedCollections?.includes(col.id) || false}
                      onChange={(e) => {
                        const selected = exportOptions.selectedCollections || [];
                        setExportOptions({
                          ...exportOptions,
                          selectedCollections: e.target.checked
                            ? [...selected, col.id]
                            : selected.filter((id) => id !== col.id),
                        });
                      }}
                      className="w-4 h-4 rounded"
                    />
                    <div>
                      <span className="text-foreground">{col.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({col.properties.length} properties)
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Options */}
            <div>
              <label
                className="block text-sm font-medium mb-2 text-foreground"
              >
                Options
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeRelationships}
                    onChange={(e) =>
                      setExportOptions({ ...exportOptions, includeRelationships: e.target.checked })
                    }
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-foreground">Include relationships</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeMetadata}
                    onChange={(e) =>
                      setExportOptions({ ...exportOptions, includeMetadata: e.target.checked })
                    }
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-foreground">Include metadata</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={exportOptions.prettyPrint}
                    onChange={(e) =>
                      setExportOptions({ ...exportOptions, prettyPrint: e.target.checked })
                    }
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-foreground">Pretty print</span>
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-primary text-primary-foreground"
              >
                <Download size={18} />
                Download File
              </button>
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted text-foreground"
              >
                <Copy size={18} />
                Copy to Clipboard
              </button>
              <button
                onClick={handlePreview}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted text-foreground"
              >
                <Eye size={18} />
                Preview
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Drop Zone */}
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                dragOver ? 'border-primary bg-primary/10' : 'border-border bg-transparent'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <Upload size={48} className="text-muted-foreground mx-auto" />
              <p className="mt-4 text-foreground">
                Drop a JSON or YAML file here
              </p>
              <p className="text-sm mt-1 text-muted-foreground">
                or
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground"
              >
                Browse Files
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.yaml,.yml"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Or paste content */}
            <div>
              <label
                className="block text-sm font-medium mb-2 text-foreground"
              >
                Or paste content directly
              </label>
              <textarea
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                placeholder="Paste JSON or YAML content here..."
                rows={10}
                className="w-full px-4 py-3 rounded-lg text-sm font-mono resize-none bg-muted border border-border text-foreground"
              />
            </div>

            {/* Validate button */}
            {importData && !importResult && (
              <button
                onClick={handleValidate}
                disabled={isProcessing}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium disabled:opacity-50 bg-primary text-primary-foreground"
              >
                <RefreshCw size={18} className={isProcessing ? 'animate-spin' : ''} />
                Validate & Preview
              </button>
            )}

            {/* Validation Results */}
            {importResult && (
              <div
                className={`rounded-lg p-4 ${
                  importResult.success ? 'bg-success-subtle' : 'bg-destructive/10'
                }`}
              >
                <div className="flex items-center gap-2 mb-3">
                  {importResult.success ? (
                    <>
                      <CheckCircle size={20} className="text-success-text" />
                      <span className="font-medium text-success-text">
                        Validation Successful
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={20} className="text-destructive" />
                      <span className="font-medium text-destructive">
                        Validation Failed
                      </span>
                    </>
                  )}
                </div>

                {importResult.errors.length > 0 && (
                  <div className="mb-3">
                    <h4 className="text-sm font-medium mb-1 text-destructive">
                      Errors:
                    </h4>
                    <ul className="text-sm space-y-1 text-destructive">
                      {importResult.errors.map((err, i) => (
                        <li key={i}>• {err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {importResult.warnings.length > 0 && (
                  <div className="mb-3">
                    <h4 className="text-sm font-medium mb-1 text-warning-text">
                      Warnings:
                    </h4>
                    <ul className="text-sm space-y-1 text-warning-text">
                      {importResult.warnings.map((warn, i) => (
                        <li key={i}>• {warn}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {importResult.success && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 text-foreground">
                      Will Import:
                    </h4>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>• {importResult.collections.length} collection(s)</p>
                      <p>• {importResult.relationships.length} relationship(s)</p>
                    </div>

                    <button
                      onClick={handleConfirmImport}
                      disabled={isProcessing}
                      className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg font-medium disabled:opacity-50 bg-primary text-primary-foreground"
                    >
                      {isProcessing ? 'Importing...' : 'Confirm Import'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/50">
          <div
            className="w-full max-w-3xl max-h-[80vh] rounded-xl overflow-hidden flex flex-col bg-card"
          >
            <div
              className="flex items-center justify-between px-4 py-3 border-b border-border"
            >
              <h3 className="font-semibold text-foreground">
                Export Preview
              </h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-muted-foreground"
              >
                <X size={20} />
              </button>
            </div>
            <pre
              className="flex-1 overflow-auto p-4 text-sm bg-muted text-foreground"
            >
              {previewContent}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchemaImportExport;
