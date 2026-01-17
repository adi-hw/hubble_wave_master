
import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Wand2, ChevronDown, Check, Loader2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type AiActionType = 'summarize' | 'improve' | 'fix_grammar' | 'expand' | 'shorten' | 'tone_professional';

export interface AiActionOption {
  id: AiActionType;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

const defaultActions: AiActionOption[] = [
  { id: 'improve', label: 'Improve Writing', icon: Wand2 },
  { id: 'fix_grammar', label: 'Fix Grammar & Spelling', icon: Check },
  { id: 'shorten', label: 'Make Shorter', icon: ChevronDown },
  { id: 'expand', label: 'Make Longer', icon: ChevronDown },
  { id: 'tone_professional', label: 'Make Professional', icon: Sparkles },
];

export interface AiActionBadgeProps {
  onAction: (action: AiActionType) => void;
  isLoading?: boolean;
  className?: string;
  actions?: AiActionOption[];
}

export const AiActionBadge: React.FC<AiActionBadgeProps> = ({
  onAction,
  isLoading = false,
  className,
  actions = defaultActions,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (isLoading) {
    return (
      <div className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium animate-pulse", className)}>
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Improving...</span>
      </div>
    );
  }

  return (
    <div className={cn("relative inline-block", className)} ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "group flex items-center gap-1.5 px-2 py-1 rounded-full",
          "bg-transparent hover:bg-primary/10 transition-colors",
          "text-xs font-medium text-muted-foreground hover:text-primary",
          "border border-transparent hover:border-primary/20",
          isOpen && "bg-primary/10 text-primary border-primary/20"
        )}
      >
        <Sparkles className="h-3 w-3" />
        <span>AI Assist</span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 z-50 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg animate-in fade-in-80 zoom-in-95">
           <div className="p-1">
             {actions.map((action) => (
               <button
                 key={action.id}
                 onClick={() => {
                   onAction(action.id);
                   setIsOpen(false);
                 }}
                 className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs outline-none hover:bg-accent hover:text-accent-foreground cursor-pointer focus:bg-accent focus:text-accent-foreground"
               >
                 {action.icon && <action.icon className="mr-1 h-3.5 w-3.5 opacity-70" />}
                 {action.label}
               </button>
             ))}
           </div>
        </div>
      )}
    </div>
  );
};
