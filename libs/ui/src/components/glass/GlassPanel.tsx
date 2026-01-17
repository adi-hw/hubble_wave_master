import React from 'react';
import { GlassSurface, GlassSurfaceProps } from './GlassSurface';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface GlassPanelProps extends GlassSurfaceProps {
  // Panel specific props can go here
}

export const GlassPanel = React.forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <GlassSurface
        ref={ref}
        className={cn('h-full w-full bg-[var(--bg-surface-secondary)]/80 backdrop-blur-2xl', className)}
        elevation="mid"
        bordered={false} // Panels usually handle borders via layout context
        {...props}
      >
        {children}
      </GlassSurface>
    );
  }
);

GlassPanel.displayName = 'GlassPanel';
