import React, { useEffect, useRef } from 'react';
import { X, Sparkles, Trash2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface AvaPanelProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  onClear?: () => void;
  width?: 'md' | 'lg' | 'xl';
}

const widthClasses = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
};

export const AvaPanel: React.FC<AvaPanelProps> = ({
  isOpen,
  onClose,
  children,
  title = 'AVA',
  subtitle = 'AI Assistant',
  onClear,
  width = 'md',
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] isolate">
      {/* Backdrop */}
      <div 
        className={cn(
          "absolute inset-0 bg-background/20 backdrop-blur-[2px] transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        ref={panelRef}
        className={cn(
          "absolute inset-y-0 right-0 w-full flex flex-col shadow-2xl",
          "bg-card/95 backdrop-blur-xl border-l border-border/50",
          "transform transition-transform duration-300 cubic-bezier(0.16, 1, 0.3, 1)", // Spring-like ease
          isOpen ? "translate-x-0" : "translate-x-full",
          widthClasses[width]
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 bg-card/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/20 ring-1 ring-primary/20">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground tracking-tight">{title}</h2>
              <p className="text-xs text-muted-foreground font-medium">{subtitle}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            {onClear && (
              <button
                onClick={onClear}
                className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive transition-colors"
                title="Clear conversation"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Close panel (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 relative">
          {children}
        </div>
      </div>
    </div>
  );
};
