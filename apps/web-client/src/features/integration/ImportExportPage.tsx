/**
 * Import/Export Page
 * HubbleWave Platform - Phase 5
 *
 * Data import wizard and export interface.
 */

import { useState, useRef } from 'react';
import { GlassCard } from '../../components/ui/glass/GlassCard';

type ImportStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'complete';
type ExportFormat = 'csv' | 'xlsx' | 'json' | 'xml';

interface FieldMapping {
  sourceField: string;
  targetField: string;
  transform?: string;
}

interface ImportRecord {
  [key: string]: string | number | boolean | null;
}

export function ImportExportPage() {
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');
  const [importStep, setImportStep] = useState<ImportStep>('upload');
  const [, setUploadedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<ImportRecord[]>([]);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [selectedCollection, setSelectedCollection] = useState('');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const collections = [
    { id: 'assets', name: 'Assets', fields: ['name', 'type', 'location', 'status', 'serialNumber'] },
    { id: 'work_orders', name: 'Work Orders', fields: ['title', 'description', 'priority', 'assignee', 'dueDate'] },
    { id: 'locations', name: 'Locations', fields: ['name', 'address', 'type', 'parentLocation'] },
  ];

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      // Simulate parsing preview data
      setPreviewData([
        { name: 'HVAC Unit 1', type: 'Equipment', location: 'Building A', status: 'Active' },
        { name: 'Elevator 1', type: 'Equipment', location: 'Building B', status: 'Active' },
        { name: 'Generator 1', type: 'Equipment', location: 'Building A', status: 'Maintenance' },
      ]);
      setFieldMappings([
        { sourceField: 'name', targetField: 'name' },
        { sourceField: 'type', targetField: 'type' },
        { sourceField: 'location', targetField: 'location' },
        { sourceField: 'status', targetField: 'status' },
      ]);
      setImportStep('mapping');
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.currentTarget.classList.add('drag-over');
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.currentTarget.classList.remove('drag-over');
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');
    const file = event.dataTransfer.files?.[0];
    if (file) {
      setUploadedFile(file);
      setImportStep('mapping');
    }
  };

  const renderImportWizard = () => {
    switch (importStep) {
      case 'upload':
        return (
          <div className="import-upload">
            <div
              className="upload-zone"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.json,.xml"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="upload-icon">+</div>
              <h3>Drop your file here or click to browse</h3>
              <p>Supported formats: CSV, Excel, JSON, XML (Max 100MB)</p>
            </div>

            <div className="upload-options">
              <h4>Or import from:</h4>
              <div className="option-buttons">
                <button className="option-button">Google Sheets</button>
                <button className="option-button">OneDrive</button>
                <button className="option-button">Dropbox</button>
              </div>
            </div>
          </div>
        );

      case 'mapping':
        return (
          <div className="import-mapping">
            <div className="mapping-header">
              <h3>Map Fields</h3>
              <p>Map your file columns to collection fields</p>
            </div>

            <div className="collection-select">
              <label>Target Collection</label>
              <select
                value={selectedCollection}
                onChange={(e) => setSelectedCollection(e.target.value)}
              >
                <option value="">Select a collection...</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-mappings">
              <div className="mapping-row mapping-header-row">
                <span>Source Field</span>
                <span></span>
                <span>Target Field</span>
                <span>Transform</span>
              </div>
              {fieldMappings.map((mapping, index) => (
                <div key={index} className="mapping-row">
                  <span className="source-field">{mapping.sourceField}</span>
                  <span className="arrow">→</span>
                  <select
                    value={mapping.targetField}
                    onChange={(e) => {
                      const updated = [...fieldMappings];
                      updated[index].targetField = e.target.value;
                      setFieldMappings(updated);
                    }}
                  >
                    <option value="">Skip this field</option>
                    {selectedCollection &&
                      collections
                        .find((c) => c.id === selectedCollection)
                        ?.fields.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                  </select>
                  <select
                    value={mapping.transform || ''}
                    onChange={(e) => {
                      const updated = [...fieldMappings];
                      updated[index].transform = e.target.value;
                      setFieldMappings(updated);
                    }}
                  >
                    <option value="">No transform</option>
                    <option value="uppercase">Uppercase</option>
                    <option value="lowercase">Lowercase</option>
                    <option value="trim">Trim whitespace</option>
                    <option value="date">Parse as date</option>
                  </select>
                </div>
              ))}
            </div>

            <div className="mapping-actions">
              <button className="button button--secondary" onClick={() => setImportStep('upload')}>
                Back
              </button>
              <button
                className="button button--primary"
                onClick={() => setImportStep('preview')}
                disabled={!selectedCollection}
              >
                Preview Import
              </button>
            </div>
          </div>
        );

      case 'preview':
        return (
          <div className="import-preview">
            <div className="preview-header">
              <h3>Preview Import</h3>
              <p>Review the data before importing</p>
            </div>

            <div className="preview-stats">
              <div className="stat-item">
                <span className="stat-value">{previewData.length}</span>
                <span className="stat-label">Total Records</span>
              </div>
              <div className="stat-item stat-item--success">
                <span className="stat-value">{previewData.length}</span>
                <span className="stat-label">Valid</span>
              </div>
              <div className="stat-item stat-item--warning">
                <span className="stat-value">0</span>
                <span className="stat-label">Warnings</span>
              </div>
              <div className="stat-item stat-item--error">
                <span className="stat-value">0</span>
                <span className="stat-label">Errors</span>
              </div>
            </div>

            <div className="preview-table-container">
              <table className="preview-table">
                <thead>
                  <tr>
                    <th>#</th>
                    {Object.keys(previewData[0] || {}).map((key) => (
                      <th key={key}>{key}</th>
                    ))}
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, index) => (
                    <tr key={index}>
                      <td>{index + 1}</td>
                      {Object.values(row).map((value, i) => (
                        <td key={i}>{String(value)}</td>
                      ))}
                      <td>
                        <span className="status-badge status-badge--valid">Valid</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="preview-options">
              <label className="checkbox-label">
                <input type="checkbox" />
                <span>Skip duplicate records</span>
              </label>
              <label className="checkbox-label">
                <input type="checkbox" />
                <span>Update existing records if found</span>
              </label>
            </div>

            <div className="preview-actions">
              <button className="button button--secondary" onClick={() => setImportStep('mapping')}>
                Back
              </button>
              <button className="button button--primary" onClick={() => setImportStep('importing')}>
                Start Import
              </button>
            </div>
          </div>
        );

      case 'importing':
        return (
          <div className="import-progress">
            <div className="progress-container">
              <div className="progress-spinner"></div>
              <h3>Importing Data...</h3>
              <p>Please wait while we import your records</p>
              <div className="progress-bar">
                <div className="progress-fill w-[65%]"></div>
              </div>
              <span className="progress-text">65% complete (195 of 300 records)</span>
            </div>
          </div>
        );

      case 'complete':
        return (
          <div className="import-complete">
            <div className="complete-icon">✓</div>
            <h3>Import Complete</h3>
            <div className="complete-stats">
              <div className="stat-item stat-item--success">
                <span className="stat-value">298</span>
                <span className="stat-label">Imported</span>
              </div>
              <div className="stat-item stat-item--warning">
                <span className="stat-value">2</span>
                <span className="stat-label">Skipped</span>
              </div>
              <div className="stat-item stat-item--error">
                <span className="stat-value">0</span>
                <span className="stat-label">Failed</span>
              </div>
            </div>
            <button className="button button--primary" onClick={() => setImportStep('upload')}>
              Import Another File
            </button>
          </div>
        );
    }
  };

  const renderExport = () => (
    <div className="export-interface">
      <div className="export-options">
        <div className="form-group">
          <label>Collection</label>
          <select value={selectedCollection} onChange={(e) => setSelectedCollection(e.target.value)}>
            <option value="">Select a collection...</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Export Format</label>
          <div className="format-options">
            {(['csv', 'xlsx', 'json', 'xml'] as ExportFormat[]).map((format) => (
              <button
                key={format}
                className={`format-option ${exportFormat === format ? 'format-option--active' : ''}`}
                onClick={() => setExportFormat(format)}
              >
                <span className="format-icon">{format.toUpperCase()}</span>
                <span className="format-label">{format.toUpperCase()}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>Fields to Export</label>
          <div className="field-checklist">
            {selectedCollection &&
              collections
                .find((c) => c.id === selectedCollection)
                ?.fields.map((field) => (
                  <label key={field} className="checkbox-label">
                    <input type="checkbox" defaultChecked />
                    <span>{field}</span>
                  </label>
                ))}
          </div>
        </div>

        <div className="form-group">
          <label>Filters (Optional)</label>
          <div className="filter-builder">
            <select>
              <option>status</option>
              <option>type</option>
              <option>location</option>
            </select>
            <select>
              <option>equals</option>
              <option>contains</option>
              <option>starts with</option>
            </select>
            <input type="text" placeholder="Value" />
            <button className="button button--icon">+</button>
          </div>
        </div>

        <div className="export-actions">
          <button className="button button--secondary">Schedule Export</button>
          <button className="button button--primary">Export Now</button>
        </div>
      </div>

      <GlassCard className="export-history">
        <h3>Recent Exports</h3>
        <div className="history-list">
          <div className="history-item">
            <div className="history-info">
              <span className="history-name">Assets Export</span>
              <span className="history-meta">CSV • 1,234 records • 2 hours ago</span>
            </div>
            <button className="button button--ghost">Download</button>
          </div>
          <div className="history-item">
            <div className="history-info">
              <span className="history-name">Work Orders Export</span>
              <span className="history-meta">Excel • 567 records • Yesterday</span>
            </div>
            <button className="button button--ghost">Download</button>
          </div>
        </div>
      </GlassCard>
    </div>
  );

  return (
    <div className="import-export-page">
      <header className="page-header">
        <h1 className="page-title">Import & Export</h1>
        <p className="page-description">Import data from files or export your data in various formats</p>
      </header>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'import' ? 'tab--active' : ''}`}
          onClick={() => setActiveTab('import')}
        >
          Import Data
        </button>
        <button
          className={`tab ${activeTab === 'export' ? 'tab--active' : ''}`}
          onClick={() => setActiveTab('export')}
        >
          Export Data
        </button>
      </div>

      <GlassCard className="content-card">
        {activeTab === 'import' ? renderImportWizard() : renderExport()}
      </GlassCard>

      <style>{`
        .import-export-page {
          padding: 2rem;
          max-width: 1200px;
          margin: 0 auto;
        }

        .page-header {
          margin-bottom: 2rem;
        }

        .page-title {
          font-size: 2rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
        }

        .page-description {
          color: var(--text-secondary);
        }

        .tabs {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
        }

        .tab {
          padding: 0.75rem 1.5rem;
          border: none;
          background: transparent;
          font-size: 1rem;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 0.15s ease;
        }

        .tab--active {
          border-bottom-color: var(--primary);
          color: var(--primary);
          font-weight: 500;
        }

        .content-card {
          padding: 2rem;
        }

        .upload-zone {
          border: 2px dashed var(--border-color);
          border-radius: 12px;
          padding: 3rem;
          text-align: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .upload-zone:hover, .upload-zone.drag-over {
          border-color: var(--primary);
          background: var(--primary-light);
        }

        .upload-icon {
          font-size: 3rem;
          color: var(--primary);
          margin-bottom: 1rem;
        }

        .upload-options {
          margin-top: 2rem;
          text-align: center;
        }

        .option-buttons {
          display: flex;
          justify-content: center;
          gap: 1rem;
          margin-top: 1rem;
        }

        .option-button {
          padding: 0.75rem 1.5rem;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          background: var(--glass-bg);
          cursor: pointer;
        }

        .mapping-header, .preview-header {
          margin-bottom: 1.5rem;
        }

        .collection-select {
          margin-bottom: 1.5rem;
        }

        .collection-select label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 500;
        }

        .collection-select select {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid var(--border-color);
          border-radius: 8px;
        }

        .field-mappings {
          background: var(--surface-elevated);
          border-radius: 8px;
          overflow: hidden;
        }

        .mapping-row {
          display: grid;
          grid-template-columns: 1fr auto 1fr 1fr;
          gap: 1rem;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid var(--border-color);
          align-items: center;
        }

        .mapping-header-row {
          background: var(--glass-bg);
          font-weight: 600;
        }

        .source-field {
          font-family: monospace;
        }

        .arrow {
          color: var(--text-secondary);
        }

        .mapping-row select {
          padding: 0.5rem;
          border: 1px solid var(--border-color);
          border-radius: 4px;
        }

        .mapping-actions, .preview-actions, .export-actions {
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
          margin-top: 2rem;
        }

        .preview-stats, .complete-stats {
          display: flex;
          gap: 2rem;
          margin-bottom: 1.5rem;
        }

        .stat-item {
          text-align: center;
          padding: 1rem;
          background: var(--surface-elevated);
          border-radius: 8px;
          min-width: 100px;
        }

        .stat-value {
          display: block;
          font-size: 1.5rem;
          font-weight: 700;
        }

        .stat-label {
          font-size: 0.875rem;
          color: var(--text-secondary);
        }

        .stat-item--success .stat-value { color: var(--text-success); }
        .stat-item--warning .stat-value { color: var(--text-warning); }
        .stat-item--error .stat-value { color: var(--text-danger); }

        .preview-table-container {
          overflow-x: auto;
          margin-bottom: 1.5rem;
        }

        .preview-table {
          width: 100%;
          border-collapse: collapse;
        }

        .preview-table th, .preview-table td {
          padding: 0.75rem;
          text-align: left;
          border-bottom: 1px solid var(--border-color);
        }

        .preview-table th {
          background: var(--surface-elevated);
          font-weight: 600;
        }

        .status-badge {
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.75rem;
        }

        .status-badge--valid {
          background: var(--bg-success-subtle);
          color: var(--text-success);
        }

        .preview-options {
          display: flex;
          gap: 2rem;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
        }

        .import-progress, .import-complete {
          text-align: center;
          padding: 3rem;
        }

        .progress-container {
          max-width: 400px;
          margin: 0 auto;
        }

        .progress-spinner {
          width: 48px;
          height: 48px;
          border: 3px solid var(--border-color);
          border-top-color: var(--primary);
          border-radius: 50%;
          margin: 0 auto 1rem;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .progress-bar {
          height: 8px;
          background: var(--surface-elevated);
          border-radius: 4px;
          overflow: hidden;
          margin: 1rem 0;
        }

        .progress-fill {
          height: 100%;
          background: var(--primary);
          transition: width 0.3s ease;
        }

        .complete-icon {
          width: 64px;
          height: 64px;
          background: var(--bg-success);
          color: var(--text-on-success);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
          margin: 0 auto 1rem;
        }

        .export-interface {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 2rem;
        }

        .form-group {
          margin-bottom: 1.5rem;
        }

        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 500;
        }

        .form-group select, .form-group input {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid var(--border-color);
          border-radius: 8px;
        }

        .format-options {
          display: flex;
          gap: 0.5rem;
        }

        .format-option {
          flex: 1;
          padding: 1rem;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          background: var(--glass-bg);
          cursor: pointer;
          text-align: center;
          transition: all 0.15s ease;
        }

        .format-option--active {
          border-color: var(--primary);
          background: var(--primary-light);
        }

        .format-icon {
          display: block;
          font-size: 1.25rem;
          font-weight: 700;
          margin-bottom: 0.25rem;
        }

        .format-label {
          font-size: 0.75rem;
          color: var(--text-secondary);
        }

        .field-checklist {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.5rem;
        }

        .filter-builder {
          display: flex;
          gap: 0.5rem;
        }

        .filter-builder select, .filter-builder input {
          flex: 1;
        }

        .export-history h3 {
          margin-bottom: 1rem;
        }

        .history-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          border-bottom: 1px solid var(--border-color);
        }

        .history-name {
          font-weight: 500;
        }

        .history-meta {
          font-size: 0.875rem;
          color: var(--text-secondary);
        }

        .button {
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          border: none;
          transition: all 0.15s ease;
        }

        .button--primary {
          background: var(--gradient-brand);
          color: var(--text-on-primary);
          box-shadow: var(--shadow-primary);
        }

        .button--primary:hover {
          background: var(--gradient-brand-hover);
        }

        .button--secondary {
          background: var(--bg-surface);
          border: 1px solid var(--border-default);
          color: var(--text-secondary);
        }

        .button--secondary:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }

        .button--ghost {
          background: transparent;
          color: var(--text-brand);
        }

        .button--icon {
          padding: 0.5rem;
          width: 40px;
        }
      `}</style>
    </div>
  );
}
