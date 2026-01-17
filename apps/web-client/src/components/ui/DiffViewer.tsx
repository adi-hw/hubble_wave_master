import React, { useMemo, useState } from 'react';
import { Plus, Minus, ArrowRight, ChevronDown, ChevronRight, Copy, Check, Columns, List, Code } from 'lucide-react';

export interface JsonPatchOperation {
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
  path: string;
  value?: any;
  from?: string;
}

export type DiffMode = 'side-by-side' | 'unified' | 'patch';

interface DiffViewerProps {
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  diff?: JsonPatchOperation[];
  mode?: DiffMode;
  title?: string;
  oldLabel?: string;
  newLabel?: string;
  expandedByDefault?: boolean;
  showModeToggle?: boolean;
  className?: string;
  maxHeight?: string;
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

const generateDiff = (oldValue?: Record<string, any>, newValue?: Record<string, any>): JsonPatchOperation[] => {
  const generated: JsonPatchOperation[] = [];

  if (!oldValue && newValue) {
    generated.push({ op: 'add', path: '/', value: newValue });
  } else if (oldValue && !newValue) {
    generated.push({ op: 'remove', path: '/' });
  } else if (oldValue && newValue) {
    const compareObjects = (oldObj: any, newObj: any, path: string) => {
      const allKeys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);

      for (const key of allKeys) {
        const currentPath = `${path}/${key}`;
        const oldVal = oldObj?.[key];
        const newVal = newObj?.[key];

        if (!(key in (oldObj || {}))) {
          generated.push({ op: 'add', path: currentPath, value: newVal });
        } else if (!(key in (newObj || {}))) {
          generated.push({ op: 'remove', path: currentPath });
        } else if (typeof oldVal === 'object' && typeof newVal === 'object' && oldVal !== null && newVal !== null) {
          if (Array.isArray(oldVal) && Array.isArray(newVal)) {
            if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
              generated.push({ op: 'replace', path: currentPath, value: newVal });
            }
          } else {
            compareObjects(oldVal, newVal, currentPath);
          }
        } else if (oldVal !== newVal) {
          generated.push({ op: 'replace', path: currentPath, value: newVal });
        }
      }
    };

    compareObjects(oldValue, newValue, '');
  }

  return generated;
};

export const DiffViewer: React.FC<DiffViewerProps> = ({
  oldValue,
  newValue,
  diff,
  mode: initialMode = 'unified',
  title,
  oldLabel = 'Previous',
  newLabel = 'Current',
  expandedByDefault = true,
  showModeToggle = true,
  className = '',
  maxHeight = '400px',
}) => {
  const [mode, setMode] = useState<DiffMode>(initialMode);
  const [expanded, setExpanded] = useState(expandedByDefault);
  const [copied, setCopied] = useState(false);

  const changes = useMemo(() => {
    if (diff) return diff;
    return generateDiff(oldValue, newValue);
  }, [oldValue, newValue, diff]);

  const hasChanges = changes.length > 0;

  const handleCopy = async () => {
    const content = mode === 'patch'
      ? JSON.stringify(changes, null, 2)
      : JSON.stringify({ old: oldValue, new: newValue, diff: changes }, null, 2);

    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const modeIcons = {
    'side-by-side': <Columns className="h-4 w-4" />,
    unified: <List className="h-4 w-4" />,
    patch: <Code className="h-4 w-4" />,
  };

  const maxHeightClass = maxHeight === '400px' ? 'max-h-[400px]' : '';

  return (
    <div className={`rounded-xl overflow-hidden bg-card border border-border ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm font-medium text-foreground"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          {title || 'Changes'}
          <span
            className={`px-1.5 py-0.5 rounded text-xs font-normal ${
              hasChanges ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            }`}
          >
            {changes.length} {changes.length === 1 ? 'change' : 'changes'}
          </span>
        </button>

        <div className="flex items-center gap-2">
          {showModeToggle && (
            <div className="flex items-center rounded-lg p-0.5 bg-card">
              {(['side-by-side', 'unified', 'patch'] as DiffMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`p-1.5 rounded-md transition-colors ${
                    mode === m
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                  title={m.replace('-', ' ')}
                >
                  {modeIcons[m]}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
            title="Copy diff"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div className={`overflow-auto scrollbar-thin ${maxHeightClass}`}>
          {!hasChanges ? (
            <div className="py-8 text-center text-muted-foreground">
              <p className="text-sm">No changes detected</p>
            </div>
          ) : mode === 'patch' ? (
            <PatchView changes={changes} oldValue={oldValue} />
          ) : mode === 'side-by-side' ? (
            <SideBySideView
              oldValue={oldValue}
              newValue={newValue}
              changes={changes}
              oldLabel={oldLabel}
              newLabel={newLabel}
            />
          ) : (
            <UnifiedView changes={changes} oldValue={oldValue} />
          )}
        </div>
      )}
    </div>
  );
};

// Patch View Component
interface PatchViewProps {
  changes: JsonPatchOperation[];
  oldValue?: Record<string, any>;
}

const PatchView: React.FC<PatchViewProps> = ({ changes, oldValue }) => {
  const getOpClasses = (op: string) => {
    switch (op) {
      case 'add':
        return { badge: 'bg-success-subtle text-success-text', line: '' };
      case 'remove':
        return { badge: 'bg-danger-subtle text-danger-text', line: '' };
      case 'replace':
        return { badge: 'bg-info-subtle text-info-text', line: '' };
      case 'move':
        return { badge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400', line: '' };
      case 'copy':
        return { badge: 'bg-warning-subtle text-warning-text', line: '' };
      default:
        return { badge: 'bg-muted text-muted-foreground', line: '' };
    }
  };

  return (
    <div className="p-4 space-y-2">
      {changes.map((op, idx) => {
        const classes = getOpClasses(op.op);
        const OpIcon = op.op === 'add' ? Plus : op.op === 'remove' ? Minus : ArrowRight;

        return (
          <div
            key={idx}
            className="flex items-start gap-3 p-3 rounded-lg bg-muted"
          >
            <span
              className={`px-2 py-0.5 rounded text-xs font-mono font-medium flex-shrink-0 ${classes.badge}`}
            >
              {op.op}
            </span>
            <div className="flex-1 min-w-0">
              <code className="text-xs break-all text-muted-foreground">
                {op.path}
              </code>
              {op.op === 'replace' && oldValue && (
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="line-through px-2 py-1 rounded bg-danger-subtle text-danger-text">
                    {formatValue(getValueAtPath(oldValue, op.path)).slice(0, 60)}
                  </span>
                  <OpIcon className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                  <span className="px-2 py-1 rounded bg-success-subtle text-success-text">
                    {formatValue(op.value).slice(0, 60)}
                  </span>
                </div>
              )}
              {op.op === 'add' && op.value !== undefined && (
                <div className="mt-2 text-xs px-2 py-1 rounded bg-success-subtle text-success-text">
                  {formatValue(op.value).slice(0, 120)}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Side by Side View Component
interface SideBySideViewProps {
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  changes: JsonPatchOperation[];
  oldLabel: string;
  newLabel: string;
}

const SideBySideView: React.FC<SideBySideViewProps> = ({
  oldValue,
  newValue,
  oldLabel,
  newLabel,
}) => {
  return (
    <div className="grid grid-cols-2 divide-x divide-border">
      <div>
        <div className="px-4 py-2 text-xs font-medium uppercase tracking-wider sticky top-0 bg-danger-subtle text-danger-text">
          {oldLabel}
        </div>
        <pre className="p-4 text-xs font-mono overflow-auto text-muted-foreground">
          {oldValue ? JSON.stringify(oldValue, null, 2) : '(empty)'}
        </pre>
      </div>
      <div>
        <div className="px-4 py-2 text-xs font-medium uppercase tracking-wider sticky top-0 bg-success-subtle text-success-text">
          {newLabel}
        </div>
        <pre className="p-4 text-xs font-mono overflow-auto text-muted-foreground">
          {newValue ? JSON.stringify(newValue, null, 2) : '(empty)'}
        </pre>
      </div>
    </div>
  );
};

// Unified View Component
interface UnifiedViewProps {
  changes: JsonPatchOperation[];
  oldValue?: Record<string, any>;
}

const UnifiedView: React.FC<UnifiedViewProps> = ({ changes, oldValue }) => {
  return (
    <div className="p-4 font-mono text-xs bg-muted/50">
      {changes.map((op, idx) => {
        if (op.op === 'add') {
          return (
            <div key={idx} className="diff-line-add px-2 py-0.5 rounded bg-success-subtle text-success-text">
              <span className="mr-2 select-none">+</span>
              {op.path}: {formatValue(op.value)}
            </div>
          );
        }

        if (op.op === 'remove') {
          return (
            <div key={idx} className="diff-line-remove px-2 py-0.5 rounded bg-danger-subtle text-danger-text">
              <span className="mr-2 select-none">-</span>
              {op.path}: {oldValue ? formatValue(getValueAtPath(oldValue, op.path)) : ''}
            </div>
          );
        }

        if (op.op === 'replace') {
          return (
            <React.Fragment key={idx}>
              <div className="diff-line-remove px-2 py-0.5 rounded bg-danger-subtle text-danger-text">
                <span className="mr-2 select-none">-</span>
                {op.path}: {oldValue ? formatValue(getValueAtPath(oldValue, op.path)) : ''}
              </div>
              <div className="diff-line-add px-2 py-0.5 rounded bg-success-subtle text-success-text">
                <span className="mr-2 select-none">+</span>
                {op.path}: {formatValue(op.value)}
              </div>
            </React.Fragment>
          );
        }

        return (
          <div key={idx} className="px-2 py-0.5 text-muted-foreground">
            <span className="mr-2 select-none">~</span>
            {op.op} {op.path}
          </div>
        );
      })}
    </div>
  );
};

export default DiffViewer;
