/**
 * FormulaEditor Component
 * HubbleWave Platform - Phase 2
 *
 * A specialized formula editor with syntax highlighting, autocomplete,
 * and real-time validation. Supports field references, functions, and operators.
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Calculator,
  Check,
  AlertCircle,
  X,
  Braces,
  Hash,
  Type,
  Calendar,
  Link2,
} from 'lucide-react';

interface FormulaField {
  code: string;
  name: string;
  type: string;
}

interface FormulaFunction {
  name: string;
  description: string;
  category: string;
  syntax: string;
  example: string;
  returnType: string;
}

interface FormulaEditorProps {
  value: string;
  onChange: (value: string) => void;
  fields: FormulaField[];
  onValidate?: (formula: string) => { valid: boolean; error?: string };
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  minHeight?: number;
  maxHeight?: number;
}

const FORMULA_FUNCTIONS: FormulaFunction[] = [
  // Math functions
  { name: 'SUM', description: 'Adds all numbers', category: 'Math', syntax: 'SUM(number1, number2, ...)', example: 'SUM({quantity}, {bonus})', returnType: 'number' },
  { name: 'AVG', description: 'Calculates average', category: 'Math', syntax: 'AVG(number1, number2, ...)', example: 'AVG({score1}, {score2})', returnType: 'number' },
  { name: 'MIN', description: 'Returns minimum value', category: 'Math', syntax: 'MIN(number1, number2, ...)', example: 'MIN({price}, {discount_price})', returnType: 'number' },
  { name: 'MAX', description: 'Returns maximum value', category: 'Math', syntax: 'MAX(number1, number2, ...)', example: 'MAX({cost}, {estimate})', returnType: 'number' },
  { name: 'ABS', description: 'Returns absolute value', category: 'Math', syntax: 'ABS(number)', example: 'ABS({balance})', returnType: 'number' },
  { name: 'ROUND', description: 'Rounds to decimal places', category: 'Math', syntax: 'ROUND(number, decimals)', example: 'ROUND({total}, 2)', returnType: 'number' },
  { name: 'FLOOR', description: 'Rounds down', category: 'Math', syntax: 'FLOOR(number)', example: 'FLOOR({quantity})', returnType: 'number' },
  { name: 'CEIL', description: 'Rounds up', category: 'Math', syntax: 'CEIL(number)', example: 'CEIL({hours})', returnType: 'number' },
  { name: 'POWER', description: 'Raises to power', category: 'Math', syntax: 'POWER(base, exponent)', example: 'POWER({value}, 2)', returnType: 'number' },
  { name: 'SQRT', description: 'Square root', category: 'Math', syntax: 'SQRT(number)', example: 'SQRT({area})', returnType: 'number' },

  // Text functions
  { name: 'CONCAT', description: 'Joins text strings', category: 'Text', syntax: 'CONCAT(text1, text2, ...)', example: 'CONCAT({first_name}, " ", {last_name})', returnType: 'text' },
  { name: 'UPPER', description: 'Converts to uppercase', category: 'Text', syntax: 'UPPER(text)', example: 'UPPER({code})', returnType: 'text' },
  { name: 'LOWER', description: 'Converts to lowercase', category: 'Text', syntax: 'LOWER(text)', example: 'LOWER({email})', returnType: 'text' },
  { name: 'TRIM', description: 'Removes whitespace', category: 'Text', syntax: 'TRIM(text)', example: 'TRIM({input})', returnType: 'text' },
  { name: 'LEFT', description: 'Extracts left characters', category: 'Text', syntax: 'LEFT(text, count)', example: 'LEFT({code}, 3)', returnType: 'text' },
  { name: 'RIGHT', description: 'Extracts right characters', category: 'Text', syntax: 'RIGHT(text, count)', example: 'RIGHT({phone}, 4)', returnType: 'text' },
  { name: 'LEN', description: 'Returns text length', category: 'Text', syntax: 'LEN(text)', example: 'LEN({description})', returnType: 'number' },
  { name: 'REPLACE', description: 'Replaces text', category: 'Text', syntax: 'REPLACE(text, old, new)', example: 'REPLACE({name}, "-", "_")', returnType: 'text' },

  // Date functions
  { name: 'NOW', description: 'Current date/time', category: 'Date', syntax: 'NOW()', example: 'NOW()', returnType: 'datetime' },
  { name: 'TODAY', description: 'Current date', category: 'Date', syntax: 'TODAY()', example: 'TODAY()', returnType: 'date' },
  { name: 'YEAR', description: 'Extracts year', category: 'Date', syntax: 'YEAR(date)', example: 'YEAR({created_at})', returnType: 'number' },
  { name: 'MONTH', description: 'Extracts month', category: 'Date', syntax: 'MONTH(date)', example: 'MONTH({due_date})', returnType: 'number' },
  { name: 'DAY', description: 'Extracts day', category: 'Date', syntax: 'DAY(date)', example: 'DAY({start_date})', returnType: 'number' },
  { name: 'DATEADD', description: 'Adds to date', category: 'Date', syntax: 'DATEADD(date, amount, unit)', example: 'DATEADD({start}, 7, "days")', returnType: 'date' },
  { name: 'DATEDIFF', description: 'Difference between dates', category: 'Date', syntax: 'DATEDIFF(date1, date2, unit)', example: 'DATEDIFF({end}, {start}, "days")', returnType: 'number' },

  // Logic functions
  { name: 'IF', description: 'Conditional logic', category: 'Logic', syntax: 'IF(condition, true_value, false_value)', example: 'IF({status} = "active", "Yes", "No")', returnType: 'any' },
  { name: 'AND', description: 'All conditions true', category: 'Logic', syntax: 'AND(condition1, condition2, ...)', example: 'AND({active}, {verified})', returnType: 'boolean' },
  { name: 'OR', description: 'Any condition true', category: 'Logic', syntax: 'OR(condition1, condition2, ...)', example: 'OR({admin}, {manager})', returnType: 'boolean' },
  { name: 'NOT', description: 'Negates condition', category: 'Logic', syntax: 'NOT(condition)', example: 'NOT({archived})', returnType: 'boolean' },
  { name: 'SWITCH', description: 'Multiple conditions', category: 'Logic', syntax: 'SWITCH(value, case1, result1, case2, result2, ...)', example: 'SWITCH({status}, "A", "Active", "I", "Inactive")', returnType: 'any' },
  { name: 'COALESCE', description: 'First non-empty value', category: 'Logic', syntax: 'COALESCE(value1, value2, ...)', example: 'COALESCE({nickname}, {first_name})', returnType: 'any' },
  { name: 'ISEMPTY', description: 'Checks if empty', category: 'Logic', syntax: 'ISEMPTY(value)', example: 'ISEMPTY({notes})', returnType: 'boolean' },
];

export const FormulaEditor: React.FC<FormulaEditorProps> = ({
  value,
  onChange,
  fields,
  onValidate,
  placeholder = 'Enter formula...',
  disabled = false,
  readOnly = false,
  minHeight = 120,
  maxHeight = 300,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteFilter, setAutocompleteFilter] = useState('');
  const [autocompleteType, setAutocompleteType] = useState<'field' | 'function'>('field');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; error?: string } | null>(null);
  const [showFunctionHelp, setShowFunctionHelp] = useState(false);
  const [selectedFunction, setSelectedFunction] = useState<FormulaFunction | null>(null);

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  // Validate formula on change
  useEffect(() => {
    if (onValidate && value) {
      const result = onValidate(value);
      setValidationResult(result);
    } else {
      setValidationResult(null);
    }
  }, [value, onValidate]);

  // Generate syntax-highlighted HTML
  const highlightedValue = useMemo(() => {
    if (!value) return '';

    let html = value;

    // Escape HTML
    html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Highlight field references {field_name}
    html = html.replace(
      /\{([^}]+)\}/g,
      '<span class="formula-field">{$1}</span>'
    );

    // Highlight functions
    const functionNames = FORMULA_FUNCTIONS.map((f) => f.name).join('|');
    const functionRegex = new RegExp(`\\b(${functionNames})\\s*\\(`, 'gi');
    html = html.replace(functionRegex, '<span class="formula-function">$1</span>(');

    // Highlight strings
    html = html.replace(/"([^"]*?)"/g, '<span class="formula-string">"$1"</span>');

    // Highlight numbers
    html = html.replace(/\b(\d+\.?\d*)\b/g, '<span class="formula-number">$1</span>');

    // Highlight operators
    html = html.replace(
      /(\+|-|\*|\/|%|!=|<=|>=|=|<|>|&|\|)/g,
      '<span class="formula-operator">$1</span>'
    );

    return html;
  }, [value]);

  // Filter autocomplete suggestions
  const filteredFields = useMemo(() => {
    if (!autocompleteFilter) return fields.slice(0, 10);
    const query = autocompleteFilter.toLowerCase();
    return fields.filter(
      (f) =>
        f.code.toLowerCase().includes(query) ||
        f.name.toLowerCase().includes(query)
    ).slice(0, 10);
  }, [fields, autocompleteFilter]);

  const filteredFunctions = useMemo(() => {
    if (!autocompleteFilter) return FORMULA_FUNCTIONS.slice(0, 10);
    const query = autocompleteFilter.toLowerCase();
    return FORMULA_FUNCTIONS.filter(
      (f) =>
        f.name.toLowerCase().includes(query) ||
        f.description.toLowerCase().includes(query)
    ).slice(0, 10);
  }, [autocompleteFilter]);

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    // Check for autocomplete trigger
    const pos = e.target.selectionStart;
    setCursorPosition(pos);

    // Check if typing field reference
    const beforeCursor = newValue.substring(0, pos);
    const fieldMatch = beforeCursor.match(/\{([^}]*)$/);
    if (fieldMatch) {
      setAutocompleteType('field');
      setAutocompleteFilter(fieldMatch[1]);
      setShowAutocomplete(true);
      return;
    }

    // Check if typing function
    const funcMatch = beforeCursor.match(/([A-Z]+)$/i);
    if (funcMatch && funcMatch[1].length >= 2) {
      setAutocompleteType('function');
      setAutocompleteFilter(funcMatch[1]);
      setShowAutocomplete(true);
      return;
    }

    setShowAutocomplete(false);
  };

  // Insert autocomplete selection
  const insertAutocomplete = (item: FormulaField | FormulaFunction, type: 'field' | 'function') => {
    if (!editorRef.current) return;

    const beforeCursor = value.substring(0, cursorPosition);
    const afterCursor = value.substring(cursorPosition);

    let newValue: string;
    let newCursorPos: number;

    if (type === 'field') {
      const field = item as FormulaField;
      // Find the start of the field reference
      const startMatch = beforeCursor.match(/\{[^}]*$/);
      const start = startMatch ? beforeCursor.length - startMatch[0].length : cursorPosition;
      newValue = value.substring(0, start) + `{${field.code}}` + afterCursor;
      newCursorPos = start + field.code.length + 2;
    } else {
      const func = item as FormulaFunction;
      // Find the start of the function name
      const startMatch = beforeCursor.match(/[A-Z]+$/i);
      const start = startMatch ? beforeCursor.length - startMatch[0].length : cursorPosition;
      newValue = value.substring(0, start) + `${func.name}()` + afterCursor;
      newCursorPos = start + func.name.length + 1;
      setSelectedFunction(func);
      setShowFunctionHelp(true);
    }

    onChange(newValue);
    setShowAutocomplete(false);

    // Restore focus and cursor position
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.focus();
        editorRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  // Sync scroll between editor and highlight
  const handleScroll = () => {
    if (editorRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = editorRef.current.scrollTop;
      highlightRef.current.scrollLeft = editorRef.current.scrollLeft;
    }
  };

  // Get field type icon
  const getFieldTypeIcon = (type: string) => {
    switch (type) {
      case 'integer':
      case 'decimal':
      case 'number':
      case 'currency':
      case 'percent':
        return Hash;
      case 'date':
      case 'datetime':
      case 'time':
        return Calendar;
      case 'reference':
      case 'multi_reference':
        return Link2;
      case 'boolean':
        return Check;
      default:
        return Type;
    }
  };

  // Group functions by category
  const groupedFunctions = useMemo(() => {
    return FORMULA_FUNCTIONS.reduce((acc, func) => {
      if (!acc[func.category]) acc[func.category] = [];
      acc[func.category].push(func);
      return acc;
    }, {} as Record<string, FormulaFunction[]>);
  }, []);

  return (
    <div
      className={`relative rounded-lg overflow-hidden border ${
        validationResult && !validationResult.valid
          ? 'border-destructive'
          : isFocused
          ? 'border-primary'
          : 'border-border'
      } ${disabled ? 'bg-muted' : 'bg-card'}`}
    >
      {/* Editor header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted border-b border-border">
        <div className="flex items-center gap-2">
          <Calculator size={16} className="text-primary" />
          <span className="text-sm font-medium text-muted-foreground">
            Formula Editor
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFunctionHelp(!showFunctionHelp)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
              showFunctionHelp
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            <Braces size={12} />
            Functions
          </button>
          {validationResult && (
            <span
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                validationResult.valid
                  ? 'bg-success-subtle text-success-text'
                  : 'bg-destructive/10 text-destructive'
              }`}
            >
              {validationResult.valid ? (
                <>
                  <Check size={12} />
                  Valid
                </>
              ) : (
                <>
                  <AlertCircle size={12} />
                  Invalid
                </>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Editor area */}
      <div
        className={`relative min-h-[${minHeight}px] max-h-[${maxHeight}px]`}
      >
        {/* Syntax highlighting layer */}
        <div
          ref={highlightRef}
          className="absolute inset-0 overflow-auto pointer-events-none p-3 whitespace-pre-wrap break-words font-mono text-sm text-transparent"
          dangerouslySetInnerHTML={{ __html: highlightedValue || placeholder }}
        />

        {/* Actual textarea */}
        <textarea
          ref={editorRef}
          value={value}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            setTimeout(() => setShowAutocomplete(false), 200);
          }}
          onScroll={handleScroll}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setShowAutocomplete(false);
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          className={`w-full h-full resize-none bg-transparent p-3 font-mono text-sm outline-none text-foreground caret-primary min-h-[${minHeight}px] max-h-[${maxHeight}px]`}
          spellCheck={false}
        />

        {/* Autocomplete dropdown */}
        {showAutocomplete && (
          <div className="absolute z-20 mt-1 w-72 rounded-lg shadow-lg overflow-hidden top-full left-4 bg-card border border-border">
            <div className="p-2 flex gap-1">
              <button
                onClick={() => setAutocompleteType('field')}
                className={`flex-1 px-2 py-1 rounded text-xs font-medium ${
                  autocompleteType === 'field'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground hover:bg-accent'
                }`}
              >
                Fields
              </button>
              <button
                onClick={() => setAutocompleteType('function')}
                className={`flex-1 px-2 py-1 rounded text-xs font-medium ${
                  autocompleteType === 'function'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground hover:bg-accent'
                }`}
              >
                Functions
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto border-t border-border">
              {autocompleteType === 'field' ? (
                filteredFields.length > 0 ? (
                  filteredFields.map((field) => {
                    const Icon = getFieldTypeIcon(field.type);
                    return (
                      <button
                        key={field.code}
                        onClick={() => insertAutocomplete(field, 'field')}
                        className="w-full px-3 py-2 flex items-center gap-2 text-left transition-colors bg-transparent hover:bg-accent"
                      >
                        <Icon size={14} className="text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate text-foreground">
                            {field.name}
                          </div>
                          <div className="text-xs truncate font-mono text-muted-foreground">
                            {'{' + field.code + '}'}
                          </div>
                        </div>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {field.type}
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No matching fields
                  </div>
                )
              ) : filteredFunctions.length > 0 ? (
                filteredFunctions.map((func) => (
                  <button
                    key={func.name}
                    onClick={() => insertAutocomplete(func, 'function')}
                    className="w-full px-3 py-2 text-left transition-colors bg-transparent hover:bg-accent"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-medium text-primary">
                        {func.name}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {func.category}
                      </span>
                    </div>
                    <div className="text-xs mt-0.5 truncate text-muted-foreground">
                      {func.description}
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No matching functions
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Validation error */}
      {validationResult && !validationResult.valid && validationResult.error && (
        <div className="px-3 py-2 flex items-center gap-2 bg-destructive/10 border-t border-destructive">
          <AlertCircle size={14} className="text-destructive" />
          <span className="text-xs text-destructive">
            {validationResult.error}
          </span>
        </div>
      )}

      {/* Function help panel */}
      {showFunctionHelp && (
        <div className="absolute right-0 top-0 bottom-0 w-80 overflow-hidden flex flex-col z-10 bg-card border-l border-border">
          <div className="flex items-center justify-between px-3 py-2 flex-shrink-0 bg-muted border-b border-border">
            <span className="text-sm font-medium text-muted-foreground">
              Function Reference
            </span>
            <button
              onClick={() => setShowFunctionHelp(false)}
              className="p-1 rounded text-muted-foreground hover:bg-accent"
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {selectedFunction ? (
              <div className="space-y-3">
                <button
                  onClick={() => setSelectedFunction(null)}
                  className="text-xs text-primary hover:underline"
                >
                  ← Back to list
                </button>
                <div>
                  <div className="text-base font-mono font-medium text-foreground">
                    {selectedFunction.name}
                  </div>
                  <div className="text-sm mt-1 text-muted-foreground">
                    {selectedFunction.description}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium mb-1 text-muted-foreground">
                    Syntax
                  </div>
                  <code className="block text-xs p-2 rounded font-mono bg-muted text-foreground">
                    {selectedFunction.syntax}
                  </code>
                </div>
                <div>
                  <div className="text-xs font-medium mb-1 text-muted-foreground">
                    Example
                  </div>
                  <code className="block text-xs p-2 rounded font-mono bg-muted text-primary">
                    {selectedFunction.example}
                  </code>
                </div>
                <div>
                  <div className="text-xs font-medium mb-1 text-muted-foreground">
                    Returns
                  </div>
                  <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">
                    {selectedFunction.returnType}
                  </span>
                </div>
              </div>
            ) : (
              Object.entries(groupedFunctions).map(([category, funcs]) => (
                <div key={category} className="mb-3">
                  <div className="text-xs font-medium mb-1 px-1 text-muted-foreground">
                    {category}
                  </div>
                  <div className="space-y-0.5">
                    {funcs.map((func) => (
                      <button
                        key={func.name}
                        onClick={() => setSelectedFunction(func)}
                        className="w-full px-2 py-1.5 rounded text-left transition-colors bg-muted hover:bg-accent"
                      >
                        <span className="text-xs font-mono text-primary">
                          {func.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Syntax highlighting styles */}
      <style>{`
        .formula-field {
          color: hsl(var(--chart-4));
          background: hsl(var(--chart-4) / 0.1);
          border-radius: 2px;
          padding: 0 2px;
        }
        .formula-function {
          color: hsl(var(--primary));
          font-weight: 600;
        }
        .formula-string {
          color: hsl(142 76% 36%);
        }
        .formula-number {
          color: hsl(221 83% 53%);
        }
        .formula-operator {
          color: hsl(38 92% 50%);
          font-weight: 600;
        }
      `}</style>
    </div>
  );
};

export default FormulaEditor;
