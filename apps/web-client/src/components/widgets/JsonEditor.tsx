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
    <div className={`border rounded-lg overflow-hidden bg-white flex flex-col ${error ? 'border-danger-300' : 'border-slate-200'}`} style={{ height }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMode('text')}
            className={`p-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors ${mode === 'text' ? 'bg-white shadow-sm text-primary-700' : 'text-slate-600 hover:bg-slate-200'}`}
          >
            <FileJson size={14} />
            Text
          </button>
          <button
            type="button"
            onClick={() => isValid && setMode('tree')}
            disabled={!isValid}
            className={`p-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors ${mode === 'tree' ? 'bg-white shadow-sm text-primary-700' : 'text-slate-600 hover:bg-slate-200 disabled:opacity-50'}`}
          >
            <Layers size={14} />
            Tree
          </button>
        </div>
        
        <div className="flex items-center gap-2">
            {!isValid && (
                <span className="text-xs text-danger-600 flex items-center gap-1 animate-pulse font-medium">
                    <AlertTriangle size={12} />
                    Invalid JSON
                </span>
            )}
            {isValid && textValue && (
                 <span className="text-xs text-emerald-600 flex items-center gap-1 font-medium">
                    <Check size={12} />
                    Valid
                </span>
            )}
            <div className="w-px h-4 bg-slate-300 mx-1" />
            <button
                type="button"
                onClick={formatJson}
                disabled={!isValid || readOnly}
                className="text-xs text-slate-600 hover:text-primary-600 disabled:opacity-50 font-medium"
            >
                Format
            </button>
            <button
                type="button"
                onClick={copyToClipboard}
                className="text-xs text-slate-600 hover:text-primary-600 font-medium ml-2"
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
                className={`w-full h-full p-3 font-mono text-sm resize-none focus:outline-none ${!isValid ? 'bg-danger-50/30' : ''}`}
                spellCheck={false}
                placeholder="{}"
                disabled={disabled}
                readOnly={readOnly}
             />
        ) : (
             <div className="w-full h-full p-3 overflow-auto bg-slate-50/50">
                 <JsonTree data={value} />
             </div>
        )}
        
        {/* Error overlay toast */}
        {parseError && mode === 'text' && (
             <div className="absolute bottom-4 left-4 right-4 bg-danger-50 border border-danger-200 text-danger-800 p-2 rounded text-xs font-mono shadow-lg flex items-start gap-2">
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
         const colorClass = 
            type === 'string' ? 'text-emerald-600' :
            type === 'number' ? 'text-blue-600' :
            type === 'boolean' ? 'text-purple-600' : 
            data === null ? 'text-slate-400' : 'text-slate-700';
         
         const displayValue = type === 'string' ? `"${data}"` : String(data);

         return (
             <div className="font-mono text-sm pl-4 flex items-start">
                 {name && <span className="text-slate-700 mr-1 opacity-75">{name}:</span>}
                 <span className={`${colorClass} break-all`}>{displayValue}</span>
             </div>
         );
    }

    const keys = Object.keys(data);
    
    return (
        <div className="font-mono text-sm">
             <div 
                className="flex items-center gap-1 cursor-pointer hover:bg-slate-100 rounded px-1 -ml-1 select-none"
                onClick={() => !isEmpty && setCollapsed(!collapsed)}
            >
                {isEmpty ? <div className="w-4" /> : (collapsed ? <ChevronRight size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />)}
                 {name && <span className="text-purple-700 mr-1">{name}:</span>}
                 {isArray ? (
                     <span className="text-slate-500">{isEmpty ? '[]' : (collapsed ? `Array(${keys.length})` : '[')}</span>
                 ) : (
                     <span className="text-slate-500">{isEmpty ? '{}' : (collapsed ? `{...} keys: ${keys.length}` : '{')}</span>
                 )}
             </div>
             
             {!collapsed && !isEmpty && (
                 <div className="pl-4 border-l border-slate-200 ml-2">
                     {keys.map(key => (
                         <JsonTree key={key} name={isArray ? '' : key} data={data[key]} level={level + 1} />
                     ))}
                 </div>
             )}
             
             {!collapsed && !isEmpty && (
                 <div className="pl-4">
                     <span className="text-slate-500">{isArray ? ']' : '}'}</span>
                 </div>
             )}
        </div>
    );
};
