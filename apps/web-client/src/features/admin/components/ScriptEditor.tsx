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
    <div className={`border border-border rounded-lg overflow-hidden ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase">
            {language}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onTest && (
            <button
              onClick={handleTest}
              disabled={testing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground bg-card border border-border rounded-md hover:bg-muted disabled:opacity-50 transition-colors"
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
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-foreground bg-primary rounded-md hover:bg-primary/90 transition-colors"
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
        <div className="flex-shrink-0 w-12 bg-muted border-r border-border text-right py-3 pr-2 select-none overflow-hidden">
          {lineNumbers.map((num) => (
            <div key={num} className="text-xs text-muted-foreground leading-6 font-mono">
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
            bg-card text-foreground
            ${readOnly ? 'bg-muted cursor-not-allowed' : ''}
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
              ? 'bg-success-subtle border-success-border'
              : 'bg-danger-subtle border-danger-border'
          }`}
        >
          <div className="flex items-start gap-2">
            {testResult.success ? (
              <CheckCircle className="h-4 w-4 text-success-text mt-0.5" />
            ) : (
              <AlertCircle className="h-4 w-4 text-danger-text mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <div
                className={`text-sm font-medium ${
                  testResult.success ? 'text-success-text' : 'text-danger-text'
                }`}
              >
                {testResult.success ? 'Test Passed' : 'Test Failed'}
              </div>
              {testResult.error && (
                <pre className="mt-1 text-xs text-danger-text whitespace-pre-wrap font-mono">
                  {testResult.error}
                </pre>
              )}
              {testResult.output !== undefined && (
                <pre className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-card rounded p-2 border border-border">
                  {typeof testResult.output === 'object'
                    ? JSON.stringify(testResult.output, null, 2)
                    : String(testResult.output)}
                </pre>
              )}
            </div>
            <button
              onClick={() => setTestResult(null)}
              className="text-muted-foreground hover:text-foreground"
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
