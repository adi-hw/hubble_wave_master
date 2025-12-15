/**
 * Toast - Modern Notification Component
 *
 * A flexible toast notification system with multiple variants,
 * auto-dismiss, and stacking support.
 * Uses HubbleWave design tokens for consistent styling.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info' | 'loading';
export type ToastPosition = 'top-right' | 'top-left' | 'top-center' | 'bottom-right' | 'bottom-left' | 'bottom-center';

export interface Toast {
  id: string;
  title?: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
  dismissible?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  updateToast: (id: string, updates: Partial<Omit<Toast, 'id'>>) => void;
  clearToasts: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Convenience hooks for common toast types
export const useToastHelpers = () => {
  const { addToast, removeToast, updateToast } = useToast();

  return {
    success: (message: string, title?: string) =>
      addToast({ message, title, variant: 'success' }),
    error: (message: string, title?: string) =>
      addToast({ message, title, variant: 'error', duration: 6000 }),
    warning: (message: string, title?: string) =>
      addToast({ message, title, variant: 'warning' }),
    info: (message: string, title?: string) =>
      addToast({ message, title, variant: 'info' }),
    loading: (message: string, title?: string) =>
      addToast({ message, title, variant: 'loading', duration: 0, dismissible: false }),
    dismiss: removeToast,
    update: updateToast,
  };
};

const variantConfig: Record<ToastVariant, {
  icon: React.ReactNode;
  styles: React.CSSProperties;
  iconStyles: React.CSSProperties;
}> = {
  success: {
    icon: <CheckCircle className="h-5 w-5" />,
    styles: {
      backgroundColor: 'var(--bg-surface)',
      borderLeft: '4px solid var(--color-success-500)',
    },
    iconStyles: { color: 'var(--color-success-500)' },
  },
  error: {
    icon: <AlertCircle className="h-5 w-5" />,
    styles: {
      backgroundColor: 'var(--bg-surface)',
      borderLeft: '4px solid var(--color-danger-500)',
    },
    iconStyles: { color: 'var(--color-danger-500)' },
  },
  warning: {
    icon: <AlertTriangle className="h-5 w-5" />,
    styles: {
      backgroundColor: 'var(--bg-surface)',
      borderLeft: '4px solid var(--color-warning-500)',
    },
    iconStyles: { color: 'var(--color-warning-500)' },
  },
  info: {
    icon: <Info className="h-5 w-5" />,
    styles: {
      backgroundColor: 'var(--bg-surface)',
      borderLeft: '4px solid var(--color-primary-500)',
    },
    iconStyles: { color: 'var(--color-primary-500)' },
  },
  loading: {
    icon: <Loader2 className="h-5 w-5 animate-spin" />,
    styles: {
      backgroundColor: 'var(--bg-surface)',
      borderLeft: '4px solid var(--color-primary-500)',
    },
    iconStyles: { color: 'var(--color-primary-500)' },
  },
};

const positionStyles: Record<ToastPosition, string> = {
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
  'top-center': 'top-4 left-1/2 -translate-x-1/2',
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
};

interface ToastItemProps {
  toast: Toast;
  onDismiss: () => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  const config = variantConfig[toast.variant];
  const [isExiting, setIsExiting] = useState(false);

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(onDismiss, 200);
  }, [onDismiss]);

  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(handleDismiss, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.duration, handleDismiss]);

  return (
    <div
      className={cn(
        'flex items-start gap-3 w-80 px-4 py-3 rounded-xl transition-all duration-200',
        isExiting ? 'opacity-0 translate-x-2' : 'opacity-100 translate-x-0'
      )}
      style={{
        ...config.styles,
        border: '1px solid var(--border-default)',
        boxShadow: 'var(--shadow-lg)',
      }}
      role="alert"
    >
      {/* Icon */}
      <span className="flex-shrink-0 mt-0.5" style={config.iconStyles}>
        {config.icon}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p
            className="text-sm font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            {toast.title}
          </p>
        )}
        <p
          className={cn('text-sm', toast.title && 'mt-0.5')}
          style={{ color: toast.title ? 'var(--text-secondary)' : 'var(--text-primary)' }}
        >
          {toast.message}
        </p>

        {/* Action Button */}
        {toast.action && (
          <button
            onClick={() => {
              toast.action?.onClick();
              handleDismiss();
            }}
            className="mt-2 text-sm font-medium transition-colors"
            style={{ color: 'var(--text-brand)' }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            {toast.action.label}
          </button>
        )}
      </div>

      {/* Dismiss Button */}
      {toast.dismissible !== false && (
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1 -m-1 rounded-lg transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--text-muted)';
          }}
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

interface ToastProviderProps {
  children: React.ReactNode;
  position?: ToastPosition;
  maxToasts?: number;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({
  children,
  position = 'top-right',
  maxToasts = 5,
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback(
    (toast: Omit<Toast, 'id'>): string => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const newToast: Toast = {
        ...toast,
        id,
        duration: toast.duration ?? 4000,
        dismissible: toast.dismissible ?? true,
      };

      setToasts((prev) => {
        const updated = [newToast, ...prev];
        return updated.slice(0, maxToasts);
      });

      return id;
    },
    [maxToasts]
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateToast = useCallback((id: string, updates: Partial<Omit<Toast, 'id'>>) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, updateToast, clearToasts }}>
      {children}

      {/* Toast Container */}
      {toasts.length > 0 && (
        <div
          className={cn(
            'fixed z-[100] flex flex-col gap-2',
            positionStyles[position]
          )}
          aria-live="polite"
          aria-atomic="false"
        >
          {toasts.map((toast) => (
            <ToastItem
              key={toast.id}
              toast={toast}
              onDismiss={() => removeToast(toast.id)}
            />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
};

/**
 * Standalone toast function for use outside React components
 * Note: Requires ToastProvider to be mounted
 */
let globalAddToast: ((toast: Omit<Toast, 'id'>) => string) | null = null;

export const setGlobalToast = (addToast: (toast: Omit<Toast, 'id'>) => string) => {
  globalAddToast = addToast;
};

export const toast = {
  success: (message: string, title?: string) =>
    globalAddToast?.({ message, title, variant: 'success' }),
  error: (message: string, title?: string) =>
    globalAddToast?.({ message, title, variant: 'error', duration: 6000 }),
  warning: (message: string, title?: string) =>
    globalAddToast?.({ message, title, variant: 'warning' }),
  info: (message: string, title?: string) =>
    globalAddToast?.({ message, title, variant: 'info' }),
  loading: (message: string, title?: string) =>
    globalAddToast?.({ message, title, variant: 'loading', duration: 0, dismissible: false }),
  custom: (options: Omit<Toast, 'id'>) => globalAddToast?.(options),
};

export default ToastProvider;
