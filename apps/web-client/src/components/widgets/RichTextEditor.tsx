import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Bold, Italic, List, ListOrdered, Underline } from 'lucide-react';
import DOMPurify from 'dompurify';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  error?: boolean;
}

// SECURITY: Configure DOMPurify to allow only safe HTML tags for rich text
// This prevents XSS attacks while allowing basic formatting
const ALLOWED_TAGS = [
  'b', 'strong', 'i', 'em', 'u', 'p', 'br', 'div', 'span',
  'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'pre', 'code'
];
const ALLOWED_ATTR = ['href', 'target', 'rel', 'class', 'style'];

const sanitizeHtml = (dirty: string): string => {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    // Force safe link target behavior
    ADD_ATTR: ['target'],
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onfocus', 'onblur'],
  });
};

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Enter text...',
  readOnly = false,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // SECURITY: Sanitize input value before rendering
  const sanitizedValue = useMemo(() => sanitizeHtml(value || ''), [value]);

  // Sync external value changes to editor content
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== sanitizedValue) {
      // Only update if content is different to avoid cursor jumping
      if (!isFocused) {
        editorRef.current.innerHTML = sanitizedValue;
      }
    }
  }, [sanitizedValue, isFocused]);

  const execCommand = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      editorRef.current.focus();
      // SECURITY: Sanitize output to ensure stored content is safe
      onChange(sanitizeHtml(editorRef.current.innerHTML));
    }
  };

  const handleInput = () => {
    if (editorRef.current) {
      // SECURITY: Sanitize output to ensure stored content is safe
      onChange(sanitizeHtml(editorRef.current.innerHTML));
    }
  };

  return (
    <div className="rounded-md overflow-hidden bg-card border border-border">
      <div
        className="flex items-center gap-1 p-2 bg-muted border-b border-border"
        role="toolbar"
        aria-label="Text formatting toolbar"
      >
        <button
          type="button"
          onClick={() => execCommand('bold')}
          className="p-1.5 rounded min-h-[44px] min-w-[44px] flex items-center justify-center text-foreground hover:bg-accent"
          disabled={readOnly}
          title="Bold"
          aria-label="Bold"
        >
          <Bold size={16} />
        </button>
        <button
          type="button"
          onClick={() => execCommand('italic')}
          className="p-1.5 rounded min-h-[44px] min-w-[44px] flex items-center justify-center text-foreground hover:bg-accent"
          disabled={readOnly}
          title="Italic"
          aria-label="Italic"
        >
          <Italic size={16} />
        </button>
        <button
          type="button"
          onClick={() => execCommand('underline')}
          className="p-1.5 rounded min-h-[44px] min-w-[44px] flex items-center justify-center text-foreground hover:bg-accent"
          disabled={readOnly}
          title="Underline"
          aria-label="Underline"
        >
          <Underline size={16} />
        </button>
        <div className="w-px h-4 mx-1 bg-border" />
        <button
          type="button"
          onClick={() => execCommand('insertUnorderedList')}
          className="p-1.5 rounded min-h-[44px] min-w-[44px] flex items-center justify-center text-foreground hover:bg-accent"
          disabled={readOnly}
          title="Bullet List"
          aria-label="Bullet List"
        >
          <List size={16} />
        </button>
        <button
          type="button"
          onClick={() => execCommand('insertOrderedList')}
          className="p-1.5 rounded min-h-[44px] min-w-[44px] flex items-center justify-center text-foreground hover:bg-accent"
          disabled={readOnly}
          title="Numbered List"
          aria-label="Numbered List"
        >
          <ListOrdered size={16} />
        </button>
      </div>

      <div
        ref={editorRef}
        contentEditable={!readOnly}
        onInput={handleInput}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className="p-3 min-h-[150px] outline-none prose prose-sm max-w-none empty-cells-show"
        role="textbox"
        aria-label="Rich text editor"
        aria-multiline="true"
        data-placeholder={placeholder}
      />
      
      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: hsl(var(--muted-foreground));
          pointer-events: none;
          display: block;
        }
      `}</style>
    </div>
  );
};
