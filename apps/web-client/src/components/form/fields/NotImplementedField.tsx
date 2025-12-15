import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { FieldComponentProps } from '../types';

export const NotImplementedField: React.FC<FieldComponentProps> = ({ field }) => (
  <div className="field-wrapper">
    <label className="flex items-center gap-1 text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
      {field.label}
    </label>
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-lg"
      style={{
        border: '1px dashed var(--border-warning)',
        backgroundColor: 'var(--bg-warning-subtle)',
      }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: 'var(--bg-warning)' }}
      >
        <AlertTriangle className="h-4 w-4 text-white" />
      </div>
      <div>
        <p className="text-sm font-medium" style={{ color: 'var(--text-warning)' }}>Field type not implemented</p>
        <p className="text-xs" style={{ color: 'var(--text-warning)' }}>
          The field type "{field.type}" is not yet supported.
        </p>
      </div>
    </div>
  </div>
);
