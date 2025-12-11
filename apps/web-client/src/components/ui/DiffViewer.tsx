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

  return (
    <div
      className={`rounded-xl overflow-hidden ${className}`}
      style={{
        backgroundColor: 'var(--hw-surface)',
        border: '1px solid var(--hw-border)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--hw-border)', backgroundColor: 'var(--hw-bg-subtle)' }}
      >
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm font-medium"
          style={{ color: 'var(--hw-text)' }}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          {title || 'Changes'}
          <span
            className="px-1.5 py-0.5 rounded text-xs font-normal"
            style={{
              backgroundColor: hasChanges ? 'var(--hw-primary-subtle)' : 'var(--hw-bg-subtle)',
              color: hasChanges ? 'var(--hw-primary)' : 'var(--hw-text-muted)',
            }}
          >
            {changes.length} {changes.length === 1 ? 'change' : 'changes'}
          </span>
        </button>

        <div className="flex items-center gap-2">
          {showModeToggle && (
            <div
              className="flex items-center rounded-lg p-0.5"
              style={{ backgroundColor: 'var(--hw-surface)' }}
            >
              {(['side-by-side', 'unified', 'patch'] as DiffMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="p-1.5 rounded-md transition-colors"
                  style={{
                    backgroundColor: mode === m ? 'var(--hw-primary-subtle)' : 'transparent',
                    color: mode === m ? 'var(--hw-primary)' : 'var(--hw-text-muted)',
                  }}
                  title={m.replace('-', ' ')}
                >
                  {modeIcons[m]}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-md transition-colors"
            style={{ color: 'var(--hw-text-muted)' }}
            title="Copy diff"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div style={{ maxHeight }} className="overflow-auto scrollbar-thin">
          {!hasChanges ? (
            <div className="py-8 text-center" style={{ color: 'var(--hw-text-muted)' }}>
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
  const opColors: Record<string, { bg: string; text: string }> = {
    add: { bg: 'var(--hw-success-subtle)', text: 'var(--hw-success)' },
    remove: { bg: 'var(--hw-danger-subtle)', text: 'var(--hw-danger)' },
    replace: { bg: 'var(--hw-info-subtle)', text: 'var(--hw-info)' },
    move: { bg: 'var(--hw-accent-subtle)', text: 'var(--hw-accent)' },
    copy: { bg: 'var(--hw-warning-subtle)', text: 'var(--hw-warning)' },
    test: { bg: 'var(--hw-bg-subtle)', text: 'var(--hw-text-muted)' },
  };

  return (
    <div className="p-4 space-y-2">
      {changes.map((op, idx) => {
        const colors = opColors[op.op];
        const OpIcon = op.op === 'add' ? Plus : op.op === 'remove' ? Minus : ArrowRight;

        return (
          <div
            key={idx}
            className="flex items-start gap-3 p-3 rounded-lg"
            style={{ backgroundColor: 'var(--hw-bg-subtle)' }}
          >
            <span
              className="px-2 py-0.5 rounded text-xs font-mono font-medium flex-shrink-0"
              style={{ backgroundColor: colors.bg, color: colors.text }}
            >
              {op.op}
            </span>
            <div className="flex-1 min-w-0">
              <code className="text-xs break-all" style={{ color: 'var(--hw-text-secondary)' }}>
                {op.path}
              </code>
              {op.op === 'replace' && oldValue && (
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span
                    className="line-through px-2 py-1 rounded"
                    style={{ backgroundColor: 'var(--hw-danger-subtle)', color: 'var(--hw-danger)' }}
                  >
                    {formatValue(getValueAtPath(oldValue, op.path)).slice(0, 60)}
                  </span>
                  <OpIcon className="h-3 w-3 flex-shrink-0" style={{ color: 'var(--hw-text-muted)' }} />
                  <span
                    className="px-2 py-1 rounded"
                    style={{ backgroundColor: 'var(--hw-success-subtle)', color: 'var(--hw-success)' }}
                  >
                    {formatValue(op.value).slice(0, 60)}
                  </span>
                </div>
              )}
              {op.op === 'add' && op.value !== undefined && (
                <div
                  className="mt-2 text-xs px-2 py-1 rounded"
                  style={{ backgroundColor: 'var(--hw-success-subtle)', color: 'var(--hw-success)' }}
                >
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
    <div className="grid grid-cols-2 divide-x" style={{ borderColor: 'var(--hw-border)' }}>
      <div>
        <div
          className="px-4 py-2 text-xs font-medium uppercase tracking-wider sticky top-0"
          style={{ backgroundColor: 'var(--hw-danger-subtle)', color: 'var(--hw-danger)' }}
        >
          {oldLabel}
        </div>
        <pre
          className="p-4 text-xs font-mono overflow-auto"
          style={{ color: 'var(--hw-text-secondary)' }}
        >
          {oldValue ? JSON.stringify(oldValue, null, 2) : '(empty)'}
        </pre>
      </div>
      <div>
        <div
          className="px-4 py-2 text-xs font-medium uppercase tracking-wider sticky top-0"
          style={{ backgroundColor: 'var(--hw-success-subtle)', color: 'var(--hw-success)' }}
        >
          {newLabel}
        </div>
        <pre
          className="p-4 text-xs font-mono overflow-auto"
          style={{ color: 'var(--hw-text-secondary)' }}
        >
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
    <div className="p-4 font-mono text-xs" style={{ backgroundColor: 'var(--hw-code-bg)' }}>
      {changes.map((op, idx) => {
        if (op.op === 'add') {
          return (
            <div key={idx} className="diff-line-add px-2 py-0.5 rounded">
              <span className="mr-2 select-none">+</span>
              {op.path}: {formatValue(op.value)}
            </div>
          );
        }

        if (op.op === 'remove') {
          return (
            <div key={idx} className="diff-line-remove px-2 py-0.5 rounded">
              <span className="mr-2 select-none">-</span>
              {op.path}: {oldValue ? formatValue(getValueAtPath(oldValue, op.path)) : ''}
            </div>
          );
        }

        if (op.op === 'replace') {
          return (
            <React.Fragment key={idx}>
              <div className="diff-line-remove px-2 py-0.5 rounded">
                <span className="mr-2 select-none">-</span>
                {op.path}: {oldValue ? formatValue(getValueAtPath(oldValue, op.path)) : ''}
              </div>
              <div className="diff-line-add px-2 py-0.5 rounded">
                <span className="mr-2 select-none">+</span>
                {op.path}: {formatValue(op.value)}
              </div>
            </React.Fragment>
          );
        }

        return (
          <div key={idx} className="px-2 py-0.5" style={{ color: 'var(--hw-text-muted)' }}>
            <span className="mr-2 select-none">~</span>
            {op.op} {op.path}
          </div>
        );
      })}
    </div>
  );
};

export default DiffViewer;
