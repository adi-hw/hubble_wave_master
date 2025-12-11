import React, { useRef, useState } from 'react';
import { Play, Save, RotateCcw, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

interface ScriptEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: 'javascript' | 'typescript';
  readOnly?: boolean;
  height?: string;
  onSave?: () => void;
  onTest?: () => Promise<{ success: boolean; output?: any; error?: string }>;
  className?: string;
}

export const ScriptEditor: React.FC<ScriptEditorProps> = ({
  value,
  onChange,
  language = 'javascript',
  readOnly = false,
  height = '400px',
  onSave,
  onTest,
  className = '',
}) => {
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    output?: any;
    error?: string;
  } | null>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle Tab key
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = editorRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newValue = value.substring(0, start) + '  ' + value.substring(end);
        onChange(newValue);
        // Set cursor position after tab
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        }, 0);
      }
    }

    // Handle Ctrl+S
    if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onSave?.();
    }
  };

  const handleTest = async () => {
    if (!onTest) return;

    setTesting(true);
    setTestResult(null);

    try {
      const result = await onTest();
      setTestResult(result);
    } catch (err: any) {
      setTestResult({
        success: false,
        error: err.message || 'Test failed',
      });
    } finally {
      setTesting(false);
    }
  };

  // Line numbers
  const lineCount = value.split('\n').length;
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  return (
    <div className={`border border-slate-200 rounded-lg overflow-hidden ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500 uppercase">
            {language}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onTest && (
            <button
              onClick={handleTest}
              disabled={testing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              {testing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              Test
            </button>
          )}
          {onSave && (
            <button
              onClick={onSave}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 transition-colors"
            >
              <Save className="h-3.5 w-3.5" />
              Save
            </button>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex" style={{ height }}>
        {/* Line numbers */}
        <div className="flex-shrink-0 w-12 bg-slate-100 border-r border-slate-200 text-right py-3 pr-2 select-none overflow-hidden">
          {lineNumbers.map((num) => (
            <div key={num} className="text-xs text-slate-400 leading-6 font-mono">
              {num}
            </div>
          ))}
        </div>

        {/* Code area */}
        <textarea
          ref={editorRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          readOnly={readOnly}
          spellCheck={false}
          className={`
            flex-1 p-3 font-mono text-sm leading-6 resize-none outline-none
            bg-white text-slate-800
            ${readOnly ? 'bg-slate-50 cursor-not-allowed' : ''}
          `}
          style={{
            tabSize: 2,
          }}
        />
      </div>

      {/* Test Result */}
      {testResult && (
        <div
          className={`px-4 py-3 border-t ${
            testResult.success
              ? 'bg-green-50 border-green-100'
              : 'bg-red-50 border-red-100'
          }`}
        >
          <div className="flex items-start gap-2">
            {testResult.success ? (
              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <div
                className={`text-sm font-medium ${
                  testResult.success ? 'text-green-700' : 'text-red-700'
                }`}
              >
                {testResult.success ? 'Test Passed' : 'Test Failed'}
              </div>
              {testResult.error && (
                <pre className="mt-1 text-xs text-red-600 whitespace-pre-wrap font-mono">
                  {testResult.error}
                </pre>
              )}
              {testResult.output !== undefined && (
                <pre className="mt-1 text-xs text-slate-600 whitespace-pre-wrap font-mono bg-white rounded p-2 border">
                  {typeof testResult.output === 'object'
                    ? JSON.stringify(testResult.output, null, 2)
                    : String(testResult.output)}
                </pre>
              )}
            </div>
            <button
              onClick={() => setTestResult(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScriptEditor;
