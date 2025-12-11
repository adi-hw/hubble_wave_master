import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { FieldComponentProps } from '../types';

export const NotImplementedField: React.FC<FieldComponentProps> = ({ field }) => (
  <div className="field-wrapper">
    <label className="flex items-center gap-1 text-sm font-medium text-slate-700 mb-1.5">
      {field.label}
    </label>
    <div className="flex items-center gap-3 px-4 py-3 border border-dashed border-amber-300 bg-amber-50/50 rounded-lg">
      <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
      </div>
      <div>
        <p className="text-sm font-medium text-amber-800">Field type not implemented</p>
        <p className="text-xs text-amber-600">
          The field type "{field.type}" is not yet supported.
        </p>
      </div>
    </div>
  </div>
);
