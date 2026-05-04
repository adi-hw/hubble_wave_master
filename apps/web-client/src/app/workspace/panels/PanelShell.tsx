import React from 'react';
import { AlertCircle } from 'lucide-react';

interface PanelShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export const PanelShell: React.FC<PanelShellProps> = ({ title, subtitle, children }) => (
  <div className="flex h-full flex-col rounded-lg border border-border bg-card">
    <div className="flex items-baseline justify-between border-b border-border px-3 py-2">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {subtitle ? (
        <span className="text-xs text-muted-foreground">{subtitle}</span>
      ) : null}
    </div>
    <div className="flex-1 overflow-auto">{children}</div>
  </div>
);

export const PanelPlaceholder: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
    <div className="flex items-center gap-2">
      <AlertCircle size={14} />
      {message}
    </div>
  </div>
);
