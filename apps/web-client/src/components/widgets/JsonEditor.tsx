import React, { useState, useEffect } from 'react';
import { AlertCircle, Check, Copy, FileJson, Layers, AlertTriangle, ChevronRight, ChevronDown } from 'lucide-react';

interface JsonEditorProps {
  value: any;
  onChange: (value: any) => void;
  disabled?: boolean;
  readOnly?: boolean;
  error?: boolean;
  height?: string;
}

export const JsonEditor: React.FC<JsonEditorProps> = ({
  value,
  onChange,
  disabled = false,
  readOnly = false,
  error = false,
  height = '300px',
}) => {
  const [mode, setMode] = useState<'text' | 'tree'>('text');
  const [textValue, setTextValue] = useState('');
  const [isValid, setIsValid] = useState(true);
  const [parseError, setParseError] = useState<string | null>(null);

  // Initialize text value from props
  useEffect(() => {
    if (value === undefined || value === null) {
      setTextValue('');
      setIsValid(true);
      return;
    }
    // If we are sending a new object (e.g. from outside), update text if it matches
    // But be careful not to overwrite user typing if local state is out of sync?
    // Current simple approach: Sync on mount or when value deeply changes
    // To avoid cursor jumping, usually we don't sync back from value unless it's very different.
    // For simplicity, let's trusting parent passes correct value.
    try {
      const currentParsed = textValue ? JSON.parse(textValue) : null;
      // Deep compare could be expensive. Let's just stringify.
      if (JSON.stringify(currentParsed) !== JSON.stringify(value)) {
         setTextValue(JSON.stringify(value, null, 2));
      }
    } catch {
       // If textValue is invalid but prop value is valid (object), we overwrite textValue
       setTextValue(JSON.stringify(value, null, 2));
    }
  }, [value]);

  const handleTextChange = (newText: string) => {
    setTextValue(newText);
    if (!newText.trim()) {
      setIsValid(true);
      setParseError(null);
      onChange(null);
      return;
    }

    try {
      const parsed = JSON.parse(newText);
      setIsValid(true);
      setParseError(null);
      onChange(parsed);
    } catch (e: any) {
      setIsValid(false);
      setParseError(e.message);
      // We don't bubble invalid JSON to parent onChange usually, or pass raw string? 
      // Field types says `onChange(value: any)`. If we pass invalid string to a JSON field, backend might reject.
      // Better to NOT call onChange if invalid, OR pass a special error indicator?
      // Standard practice: Don't call onChange (keep old valid value in model) or allow invalid.
      // Let's NOT call onChange for invalid JSON to prevent corrupting the model state with a string.
    }
  };

  const formatJson = () => {
    try {
      if (!textValue.trim()) return;
      const parsed = JSON.parse(textValue);
      setTextValue(JSON.stringify(parsed, null, 2));
    } catch (e) {
      // ignore
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(textValue);
  };

  return (
    <div className={`border rounded-lg overflow-hidden flex flex-col bg-card ${error ? 'border-destructive' : 'border-border'}`} style={{ height }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted border-border" role="toolbar" aria-label="JSON editor toolbar">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMode('text')}
            className={`p-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors min-h-[44px] min-w-[44px] ${
              mode === 'text'
                ? 'bg-card text-primary shadow-sm'
                : 'text-muted-foreground hover:bg-accent'
            }`}
            aria-label="Switch to text view"
          >
            <FileJson size={14} />
            Text
          </button>
          <button
            type="button"
            onClick={() => isValid && setMode('tree')}
            disabled={!isValid}
            className={`p-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50 min-h-[44px] min-w-[44px] ${
              mode === 'tree'
                ? 'bg-card text-primary shadow-sm'
                : 'text-muted-foreground hover:bg-accent'
            }`}
            aria-label="Switch to tree view"
          >
            <Layers size={14} />
            Tree
          </button>
        </div>
        
        <div className="flex items-center gap-2">
            {!isValid && (
                <span className="text-xs flex items-center gap-1 animate-pulse font-medium text-destructive">
                    <AlertTriangle size={12} />
                    Invalid JSON
                </span>
            )}
            {isValid && textValue && (
                 <span className="text-xs flex items-center gap-1 font-medium text-success-text">
                    <Check size={12} />
                    Valid
                </span>
            )}
            <div className="w-px h-4 mx-1 bg-border" />
            <button
                type="button"
                onClick={formatJson}
                disabled={!isValid || readOnly}
                className="text-xs disabled:opacity-50 font-medium min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                aria-label="Format JSON"
            >
                Format
            </button>
            <button
                type="button"
                onClick={copyToClipboard}
                className="text-xs font-medium ml-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                aria-label="Copy JSON to clipboard"
            >
                <Copy size={12} />
            </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {mode === 'text' ? (
             <textarea
                value={textValue}
                onChange={(e) => handleTextChange(e.target.value)}
                className={`w-full h-full p-3 font-mono text-sm resize-none focus:outline-none ${!isValid ? 'bg-destructive/10' : 'bg-transparent'}`}
                spellCheck={false}
                placeholder="{}"
                disabled={disabled}
                readOnly={readOnly}
                aria-label="JSON text editor"
             />
        ) : (
             <div className="w-full h-full p-3 overflow-auto bg-muted" role="tree" aria-label="JSON tree view">
                 <JsonTree data={value} />
             </div>
        )}
        
        {/* Error overlay toast */}
        {parseError && mode === 'text' && (
             <div className="absolute bottom-4 left-4 right-4 border p-2 rounded text-xs font-mono shadow-lg flex items-start gap-2 bg-destructive/10 border-destructive text-destructive" role="alert" aria-live="polite">
                 <AlertCircle size={14} className="mt-0.5 shrink-0" />
                 <span>{parseError}</span>
             </div>
        )}
      </div>
    </div>
  );
};

// Recursive JSON Tree Component
const JsonTree = ({ data, level = 0, name = '' }: { data: any, level?: number, name?: string }) => {
    const [collapsed, setCollapsed] = useState(false);
    const isObject = data !== null && typeof data === 'object';
    const isArray = Array.isArray(data);
    const isEmpty = isObject && Object.keys(data).length === 0;
    
    // Auto-collapse deep levels
    useEffect(() => {
        if (level > 2) setCollapsed(true);
    }, [level]);

    if (!isObject) {
         const type = typeof data;
         const getColorClass = () => {
            if (type === 'string') return 'text-success-text';
            if (type === 'number') return 'text-primary';
            if (type === 'boolean') return 'text-primary';
            if (data === null) return 'text-muted-foreground/70';
            return 'text-foreground';
         };

         const displayValue = type === 'string' ? `"${data}"` : String(data);

         return (
             <div className="font-mono text-sm pl-4 flex items-start" role="treeitem">
                 {name && <span className="mr-1 opacity-75 text-foreground">{name}:</span>}
                 <span className={`break-all ${getColorClass()}`}>{displayValue}</span>
             </div>
         );
    }

    const keys = Object.keys(data);

    return (
        <div className="font-mono text-sm" role="treeitem" aria-expanded={!isEmpty ? !collapsed : undefined}>
             <div
                className="flex items-center gap-1 cursor-pointer rounded px-1 -ml-1 select-none hover:bg-accent transition-colors"
                onClick={() => !isEmpty && setCollapsed(!collapsed)}
                role="button"
                aria-label={isEmpty ? (isArray ? 'Empty array' : 'Empty object') : (collapsed ? `Expand ${isArray ? 'array' : 'object'}` : `Collapse ${isArray ? 'array' : 'object'}`)}
                tabIndex={isEmpty ? -1 : 0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    !isEmpty && setCollapsed(!collapsed);
                  }
                }}
            >
                {isEmpty ? <div className="w-4" /> : (collapsed ? <ChevronRight size={14} className="text-muted-foreground/70" /> : <ChevronDown size={14} className="text-muted-foreground/70" />)}
                 {name && <span className="mr-1 text-primary">{name}:</span>}
                 {isArray ? (
                     <span className="text-muted-foreground">{isEmpty ? '[]' : (collapsed ? `Array(${keys.length})` : '[')}</span>
                 ) : (
                     <span className="text-muted-foreground">{isEmpty ? '{}' : (collapsed ? `{...} keys: ${keys.length}` : '{')}</span>
                 )}
             </div>

             {!collapsed && !isEmpty && (
                 <div className="pl-4 border-l ml-2 border-border" role="group">
                     {keys.map(key => (
                         <JsonTree key={key} name={isArray ? '' : key} data={data[key]} level={level + 1} />
                     ))}
                 </div>
             )}

             {!collapsed && !isEmpty && (
                 <div className="pl-4">
                     <span className="text-muted-foreground">{isArray ? ']' : '}'}</span>
                 </div>
             )}
        </div>
    );
};
