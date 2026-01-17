import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, HTMLMotionProps } from 'framer-motion';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface GlassSurfaceProps extends HTMLMotionProps<'div'> {
  elevation?: 'flat' | 'cloud' | 'low' | 'mid' | 'high';
  bordered?: boolean;
  interactive?: boolean;
}

/**
 * GlassSurface - The atomic primitive for the 2070 aesthetic.
 * 
 * Implements:
 * - Backdrop blur
 * - Translucent backgrounds
 * - Subtle borders
 * - Optional interactivity (glow on hover)
 */
export const GlassSurface = React.forwardRef<HTMLDivElement, GlassSurfaceProps>(
  ({ className, elevation = 'low', bordered = true, interactive = false, children, ...props }, ref) => {
    
    // Map elevation to background opacity/blur
    const elevationStyles = {
      flat: 'bg-transparent backdrop-blur-none',
      cloud: 'bg-white/[0.02] backdrop-blur-sm',
      low: 'bg-[var(--glass-bg)] backdrop-blur-md',
      mid: 'bg-[var(--glass-bg)] backdrop-blur-lg',
      high: 'bg-[var(--glass-bg-active)] backdrop-blur-xl shadow-lg',
    };

    return (
      <motion.div
        ref={ref}
        className={cn(
          // Base
          'relative overflow-hidden transition-all duration-300',
          
          // Glass Effect
          elevationStyles[elevation],
          
          // Borders
          bordered && 'border border-[var(--glass-border)]',
          
          // Interactive (Hover/Focus)
          interactive && [
            'hover:bg-[var(--glass-bg-hover)]',
            'hover:border-[var(--glass-border-hover)]',
            'hover:shadow-[var(--shadow-glow-primary)]',
            'active:scale-[0.99]',
            'cursor-pointer',
          ],
          
          className
        )}
        {...props}
      >
        {/* Noise Texture Overlay (Optional, adds grit) */}
        {elevation !== 'flat' && (
          <div 
            className="absolute inset-0 opacity-[0.02] pointer-events-none z-0 mix-blend-overlay"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
          />
        )}
        
        {/* Content */}
        <motion.div className="relative z-10">
          {children}
        </motion.div>
      </motion.div>
    );
  }
);

GlassSurface.displayName = 'GlassSurface';
