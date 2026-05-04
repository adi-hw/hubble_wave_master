import React from 'react';
import Editor, { type EditorProps } from '@monaco-editor/react';

export type CodeEditorLanguage =
  | 'json'
  | 'javascript'
  | 'typescript'
  | 'sql'
  | 'plaintext';

export interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: CodeEditorLanguage;
  height?: string | number;
  /** Read-only viewer mode. Useful for showing canonicalized output. */
  readOnly?: boolean;
  /**
   * Visual line wrapping. Default `'on'` for JSON / formula editors;
   * pass `'off'` for SQL or for code where horizontal scrolling
   * matters.
   */
  wordWrap?: 'on' | 'off';
  /** Optional placeholder rendered when value is empty. */
  placeholder?: string;
  className?: string;
  /** Forwarded to Monaco's option bag for advanced callers. */
  monacoOptions?: EditorProps['options'];
}

/**
 * Plan §12.1 — Monaco wrapper. Used by:
 *   - Formula editor (`computed.formula`)
 *   - JSON config inputs (Flow Action `body`, MakeDecision `inputs`,
 *     SetFieldValue `value`)
 *   - Read-only canonical-shape viewers
 *
 * The wrapper standardises Monaco init, theme, and the small set of
 * options every builder needs (line wrapping, font size, gutter
 * minimization). Callers don't need to know about Monaco's option
 * shape; the four useful knobs are surfaced directly.
 *
 * UI Scripts (sandboxed JS authoring) is out of scope per Q1 — this
 * editor is for declarative shapes only.
 */
export const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  language = 'json',
  height = 200,
  readOnly = false,
  wordWrap = 'on',
  placeholder,
  className,
  monacoOptions,
}) => {
  return (
    <div className={className}>
      <Editor
        value={value}
        onChange={(next) => onChange(next ?? '')}
        language={language}
        height={height}
        theme="vs"
        options={{
          readOnly,
          wordWrap,
          minimap: { enabled: false },
          fontSize: 12,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          ...monacoOptions,
        }}
      />
      {!value && placeholder ? (
        <p className="mt-1 text-xs text-muted-foreground">{placeholder}</p>
      ) : null}
    </div>
  );
};
