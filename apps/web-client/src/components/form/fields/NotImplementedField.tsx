import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { FieldComponentProps } from '../types';

export const NotImplementedField: React.FC<FieldComponentProps> = ({ field }) => (
  <div className="field-wrapper">
    <label className="flex items-center gap-1 text-sm font-medium mb-1.5 text-foreground">
      {field.label}
    </label>
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-dashed border-warning-border bg-warning-subtle">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-warning-subtle">
        <AlertTriangle className="h-4 w-4 text-warning-text" />
      </div>
      <div>
        <p className="text-sm font-medium text-warning-text">Field type not implemented</p>
        <p className="text-xs text-warning-text">
          The field type "{field.type}" is not yet supported.
        </p>
      </div>
    </div>
  </div>
);
