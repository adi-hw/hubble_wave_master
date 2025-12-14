import { useEffect, useRef, ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useSwipe } from '../../hooks/useSwipe';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  position?: 'left' | 'right' | 'bottom';
  className?: string;
}

export function MobileDrawer({
  isOpen,
  onClose,
  children,
  title,
  position = 'left',
  className,
}: MobileDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Handle swipe to close
  const swipeHandlers = useSwipe({
    onSwipeLeft: position === 'left' ? onClose : undefined,
    onSwipeRight: position === 'right' ? onClose : undefined,
    onSwipeDown: position === 'bottom' ? onClose : undefined,
    threshold: 50,
  });

  // Lock body scroll when drawer is open
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

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Focus trap
  useEffect(() => {
    if (isOpen && drawerRef.current) {
      drawerRef.current.focus();
    }
  }, [isOpen]);

  const positionClasses = {
    left: {
      container: 'inset-y-0 left-0',
      transform: isOpen ? 'translate-x-0' : '-translate-x-full',
      size: 'w-[85vw] max-w-sm h-full',
    },
    right: {
      container: 'inset-y-0 right-0',
      transform: isOpen ? 'translate-x-0' : 'translate-x-full',
      size: 'w-[85vw] max-w-sm h-full',
    },
    bottom: {
      container: 'inset-x-0 bottom-0',
      transform: isOpen ? 'translate-y-0' : 'translate-y-full',
      size: 'w-full h-[85vh] max-h-[600px] rounded-t-2xl',
    },
  };

  const posStyle = positionClasses[position];

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 transition-opacity duration-300',
          isOpen
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Drawer'}
        tabIndex={-1}
        className={cn(
          'fixed z-50',
          posStyle.container,
          posStyle.size,
          posStyle.transform,
          'bg-white dark:bg-slate-900',
          'shadow-2xl',
          'transition-transform duration-300 ease-out',
          'flex flex-col',
          'outline-none',
          className
        )}
        {...swipeHandlers}
      >
        {/* Drag handle for bottom drawer */}
        {position === 'bottom' && (
          <div className="flex justify-center py-3">
            <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full" />
          </div>
        )}

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-2 -mr-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
              aria-label="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </>
  );
}
