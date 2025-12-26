/**
 * GlassAvatar - Glassmorphic Avatar Component
 *
 * A modern avatar with status indicators and fallback initials.
 */

import React from 'react';
import { cn } from '../../../lib/utils';

export interface GlassAvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Image source */
  src?: string;
  /** Alt text for image */
  alt?: string;
  /** Fallback text (initials will be extracted) */
  fallback?: string;
  /** Avatar size */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  /** Status indicator */
  status?: 'online' | 'offline' | 'busy' | 'away' | 'idle';
  /** Whether to show a ring around the avatar */
  ring?: boolean;
  /** Ring color variant */
  ringColor?: 'primary' | 'accent' | 'success' | 'warning' | 'danger';
}

const sizeClasses = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-xl',
  '2xl': 'w-24 h-24 text-3xl',
};

const statusSizes = {
  xs: 'w-1.5 h-1.5 -right-0 -bottom-0',
  sm: 'w-2 h-2 right-0 bottom-0',
  md: 'w-2.5 h-2.5 right-0 bottom-0',
  lg: 'w-3 h-3 right-0 bottom-0',
  xl: 'w-4 h-4 right-0.5 bottom-0.5',
  '2xl': 'w-5 h-5 right-1 bottom-1',
};

const statusColors = {
  online: 'bg-[var(--bg-success)]',
  offline: 'bg-[var(--color-neutral-400)]',
  busy: 'bg-[var(--bg-danger)]',
  away: 'bg-[var(--bg-warning)]',
  idle: 'bg-[var(--color-neutral-400)]',
};

const ringColors = {
  primary: 'ring-[var(--color-primary-500)]',
  accent: 'ring-[var(--color-accent-500)]',
  success: 'ring-[var(--color-success-500)]',
  warning: 'ring-[var(--color-warning-500)]',
  danger: 'ring-[var(--color-danger-500)]',
};

const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
};

export const GlassAvatar = React.forwardRef<HTMLDivElement, GlassAvatarProps>(
  (
    {
      className,
      src,
      alt,
      fallback,
      size = 'md',
      status,
      ring = false,
      ringColor = 'primary',
      ...props
    },
    ref
  ) => {
    const [imageError, setImageError] = React.useState(false);
    const initials = fallback ? getInitials(fallback) : '?';
    const showImage = src && !imageError;

    return (
      <div
        ref={ref}
        className={cn(
          'relative inline-flex items-center justify-center rounded-full overflow-hidden flex-shrink-0',
          'font-semibold',
          sizeClasses[size],
          ring && `ring-2 ring-offset-2 ring-offset-[var(--bg-surface)] ${ringColors[ringColor]}`,
          className
        )}
        style={{
          background: showImage ? undefined : 'var(--gradient-brand)',
          color: 'white',
        }}
        {...props}
      >
        {showImage ? (
          <img
            src={src}
            alt={alt || fallback || 'Avatar'}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <span>{initials}</span>
        )}

        {status && (
          <span
            className={cn(
              'absolute rounded-full border-2',
              statusSizes[size],
              statusColors[status]
            )}
            style={{ borderColor: 'var(--bg-surface)' }}
          />
        )}
      </div>
    );
  }
);

GlassAvatar.displayName = 'GlassAvatar';

/**
 * AvatarGroup - A group of stacked avatars
 */
export interface AvatarGroupProps {
  /** Array of avatar props */
  avatars: Array<Omit<GlassAvatarProps, 'size'>>;
  /** Size of avatars */
  size?: GlassAvatarProps['size'];
  /** Maximum avatars to show */
  max?: number;
  /** Overlap amount */
  overlap?: 'sm' | 'md' | 'lg';
}

const overlapClasses = {
  sm: '-ml-1',
  md: '-ml-2',
  lg: '-ml-3',
};

export const AvatarGroup: React.FC<AvatarGroupProps> = ({
  avatars,
  size = 'md',
  max = 4,
  overlap = 'md',
}) => {
  const displayAvatars = avatars.slice(0, max);
  const remaining = avatars.length - max;

  return (
    <div className="flex items-center">
      {displayAvatars.map((avatarProps, index) => (
        <div
          key={index}
          className={cn(index > 0 && overlapClasses[overlap], 'relative')}
          style={{ zIndex: displayAvatars.length - index }}
        >
          <GlassAvatar
            {...avatarProps}
            size={size}
            className={cn('ring-2 ring-[var(--bg-surface)]', avatarProps.className)}
          />
        </div>
      ))}
      {remaining > 0 && (
        <div
          className={cn(
            overlapClasses[overlap],
            sizeClasses[size],
            'inline-flex items-center justify-center rounded-full',
            'text-xs font-medium',
            'ring-2 ring-[var(--bg-surface)]'
          )}
          style={{
            backgroundColor: 'var(--bg-surface-secondary)',
            color: 'var(--text-secondary)',
            zIndex: 0,
          }}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
};

export default GlassAvatar;
