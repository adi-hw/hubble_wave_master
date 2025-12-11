import React, { useMemo } from 'react';
import { Plus, Minus, ArrowRight } from 'lucide-react';

interface JsonPatchOperation {
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
  path: string;
  value?: any;
  from?: string;
}

interface DiffViewerProps {
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  diff?: JsonPatchOperation[];
  mode?: 'side-by-side' | 'unified' | 'patch';
  className?: string;
}

const formatValue = (value: any): string => {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
};

const getValueAtPath = (obj: any, path: string): any => {
  const parts = path.split('/').filter(Boolean);
  let current = obj;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
};

export const DiffViewer: React.FC<DiffViewerProps> = ({
  oldValue,
  newValue,
  diff,
  mode = 'unified',
  className = '',
}) => {
  const changes = useMemo(() => {
    if (diff) return diff;

    // Generate diff from old/new values
    const generated: JsonPatchOperation[] = [];
    if (!oldValue && newValue) {
      generated.push({ op: 'add', path: '/', value: newValue });
    } else if (oldValue && !newValue) {
      generated.push({ op: 'remove', path: '/' });
    } else if (oldValue && newValue) {
      // Simple comparison - would need a proper diff library for complex objects
      const allKeys = new Set([...Object.keys(oldValue), ...Object.keys(newValue)]);
      for (const key of allKeys) {
        const oldVal = oldValue[key];
        const newVal = newValue[key];
        if (!(key in oldValue)) {
          generated.push({ op: 'add', path: `/${key}`, value: newVal });
        } else if (!(key in newValue)) {
          generated.push({ op: 'remove', path: `/${key}` });
        } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          generated.push({ op: 'replace', path: `/${key}`, value: newVal });
        }
      }
    }
    return generated;
  }, [oldValue, newValue, diff]);

  if (mode === 'patch') {
    return (
      <div className={`bg-slate-50 rounded-lg p-4 ${className}`}>
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          JSON Patch Operations
        </h4>
        <div className="space-y-2">
          {changes.map((op, idx) => (
            <PatchOperation key={idx} operation={op} oldValue={oldValue} />
          ))}
          {changes.length === 0 && (
            <p className="text-sm text-slate-400 italic">No changes</p>
          )}
        </div>
      </div>
    );
  }

  if (mode === 'side-by-side') {
    return (
      <div className={`grid grid-cols-2 gap-4 ${className}`}>
        <div>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Previous
          </h4>
          <pre className="text-xs bg-red-50 rounded-lg p-3 border border-red-100 overflow-auto max-h-80">
            {oldValue ? JSON.stringify(oldValue, null, 2) : '(empty)'}
          </pre>
        </div>
        <div>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Current
          </h4>
          <pre className="text-xs bg-green-50 rounded-lg p-3 border border-green-100 overflow-auto max-h-80">
            {newValue ? JSON.stringify(newValue, null, 2) : '(empty)'}
          </pre>
        </div>
      </div>
    );
  }

  // Unified mode
  return (
    <div className={`bg-slate-900 rounded-lg p-4 font-mono text-xs overflow-auto ${className}`}>
      {changes.map((op, idx) => (
        <UnifiedDiffLine key={idx} operation={op} oldValue={oldValue} />
      ))}
      {changes.length === 0 && (
        <p className="text-slate-500 italic">No changes</p>
      )}
    </div>
  );
};

interface PatchOperationProps {
  operation: JsonPatchOperation;
  oldValue?: Record<string, any>;
}

const PatchOperation: React.FC<PatchOperationProps> = ({ operation, oldValue }) => {
  const opColors: Record<string, string> = {
    add: 'bg-green-100 text-green-700',
    remove: 'bg-red-100 text-red-700',
    replace: 'bg-blue-100 text-blue-700',
    move: 'bg-purple-100 text-purple-700',
    copy: 'bg-amber-100 text-amber-700',
    test: 'bg-slate-100 text-slate-700',
  };

  const OpIcon = operation.op === 'add' ? Plus : operation.op === 'remove' ? Minus : ArrowRight;

  return (
    <div className="flex items-start gap-2 bg-white rounded-lg p-2 border border-slate-200">
      <span className={`px-1.5 py-0.5 rounded text-xs font-mono font-medium ${opColors[operation.op]}`}>
        {operation.op}
      </span>
      <div className="flex-1 min-w-0">
        <code className="text-xs text-slate-600 break-all">{operation.path}</code>
        {operation.op === 'replace' && oldValue && (
          <div className="mt-1 flex items-center gap-2 text-xs">
            <span className="text-red-600 line-through">
              {formatValue(getValueAtPath(oldValue, operation.path)).slice(0, 50)}
            </span>
            <OpIcon className="h-3 w-3 text-slate-400 flex-shrink-0" />
            <span className="text-green-600">
              {formatValue(operation.value).slice(0, 50)}
            </span>
          </div>
        )}
        {operation.op === 'add' && operation.value !== undefined && (
          <div className="mt-1 text-xs text-green-600">
            {formatValue(operation.value).slice(0, 100)}
          </div>
        )}
      </div>
    </div>
  );
};

interface UnifiedDiffLineProps {
  operation: JsonPatchOperation;
  oldValue?: Record<string, any>;
}

const UnifiedDiffLine: React.FC<UnifiedDiffLineProps> = ({ operation, oldValue }) => {
  if (operation.op === 'add') {
    return (
      <div className="text-green-400">
        <span className="text-green-600 mr-2">+</span>
        {operation.path}: {formatValue(operation.value)}
      </div>
    );
  }

  if (operation.op === 'remove') {
    return (
      <div className="text-red-400">
        <span className="text-red-600 mr-2">-</span>
        {operation.path}: {oldValue ? formatValue(getValueAtPath(oldValue, operation.path)) : ''}
      </div>
    );
  }

  if (operation.op === 'replace') {
    return (
      <>
        <div className="text-red-400">
          <span className="text-red-600 mr-2">-</span>
          {operation.path}: {oldValue ? formatValue(getValueAtPath(oldValue, operation.path)) : ''}
        </div>
        <div className="text-green-400">
          <span className="text-green-600 mr-2">+</span>
          {operation.path}: {formatValue(operation.value)}
        </div>
      </>
    );
  }

  return (
    <div className="text-slate-400">
      <span className="mr-2">~</span>
      {operation.op} {operation.path}
    </div>
  );
};

export default DiffViewer;
