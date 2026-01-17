import React from 'react';
import { GlassSurface, GlassSurfaceProps } from './GlassSurface';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion } from 'framer-motion';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface GlassCardProps extends GlassSurfaceProps {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  bodyClassName?: string;
}

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ children, header, footer, className, bodyClassName, ...props }, ref) => {
    return (
      <GlassSurface
        ref={ref}
        className={cn('rounded-xl flex flex-col', className)}
        elevation="low"
        bordered
        {...props}
      >
        {header && (
          <div className="px-6 py-4 border-b border-[var(--glass-border)]">
            {typeof header === 'string' ? (
              <h3 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
                {header}
              </h3>
            ) : (
              header
            )}
          </div>
        )}
        
        <motion.div className={cn('p-6 flex-1', bodyClassName)}>
          {children}
        </motion.div>

        {footer && (
          <div className="px-6 py-4 bg-[var(--bg-surface-secondary)]/30 border-t border-[var(--glass-border)]">
            {footer}
          </div>
        )}
      </GlassSurface>
    );
  }
);

GlassCard.displayName = 'GlassCard';
