/**
 * Skeleton Loading Components
 * HubbleWave Platform - Phase 1
 *
 * Production-ready skeleton loading states with:
 * - Theme-aware styling using CSS variables
 * - Smooth pulse animation
 * - WCAG 2.1 AA accessibility compliance
 * - Multiple variants for different content types
 */

import React from 'react';
import { cn } from '../../lib/utils';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full';
}

const roundedClasses = {
  none: 'rounded-none',
  sm: 'rounded',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
};

/**
 * Base skeleton component with pulse animation
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  width,
  height,
  rounded = 'md',
}) => {
  const widthStyle = width ? (typeof width === 'number' ? `${width}px` : width) : undefined;
  const heightStyle = height ? (typeof height === 'number' ? `${height}px` : height) : undefined;

  return (
    <div
      className={cn(
        'animate-pulse bg-muted',
        roundedClasses[rounded],
        className
      )}
      style={widthStyle || heightStyle ? { width: widthStyle, height: heightStyle } : undefined}
      aria-hidden="true"
    />
  );
};

/**
 * Skeleton text line
 */
export const SkeletonText: React.FC<{
  lines?: number;
  className?: string;
}> = ({ lines = 1, className }) => {
  return (
    <div className={cn('space-y-2', className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={16}
          width={i === lines - 1 && lines > 1 ? '70%' : '100%'}
        />
      ))}
    </div>
  );
};

/**
 * Skeleton avatar
 */
export const SkeletonAvatar: React.FC<{
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}> = ({ size = 'md', className }) => {
  const sizes = {
    sm: 32,
    md: 40,
    lg: 48,
    xl: 64,
  };

  return (
    <Skeleton
      width={sizes[size]}
      height={sizes[size]}
      rounded="full"
      className={className}
    />
  );
};

/**
 * Skeleton card
 */
export const SkeletonCard: React.FC<{
  className?: string;
  showImage?: boolean;
  showAvatar?: boolean;
}> = ({ className, showImage = false, showAvatar = false }) => {
  return (
    <div
      className={cn('rounded-xl p-4 bg-card border border-border', className)}
      aria-hidden="true"
    >
      {showImage && (
        <Skeleton height={160} className="w-full mb-4" rounded="lg" />
      )}
      <div className="flex items-start gap-3">
        {showAvatar && <SkeletonAvatar size="md" />}
        <div className="flex-1 space-y-3">
          <Skeleton height={20} width="60%" />
          <SkeletonText lines={2} />
        </div>
      </div>
    </div>
  );
};

/**
 * Skeleton table row
 */
export const SkeletonTableRow: React.FC<{
  columns?: number;
  className?: string;
}> = ({ columns = 5, className }) => {
  return (
    <div
      className={cn('flex items-center gap-4 px-4 py-3 border-b border-border', className)}
      aria-hidden="true"
    >
      {/* Checkbox placeholder */}
      <Skeleton width={20} height={20} rounded="sm" />

      {/* Column placeholders */}
      {Array.from({ length: columns }).map((_, i) => (
        <div key={i} className="flex-1">
          <Skeleton
            height={16}
            width={i === 0 ? '80%' : i === columns - 1 ? '50%' : '70%'}
          />
        </div>
      ))}
    </div>
  );
};

/**
 * Skeleton table - full table loading state
 */
export const SkeletonTable: React.FC<{
  rows?: number;
  columns?: number;
  className?: string;
}> = ({ rows = 5, columns = 5, className }) => {
  return (
    <div
      className={cn('rounded-xl overflow-hidden bg-card border border-border', className)}
      role="status"
      aria-label="Loading table data"
    >
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-3 bg-muted border-b border-border">
        <Skeleton width={20} height={20} rounded="sm" />
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="flex-1">
            <Skeleton height={14} width="60%" />
          </div>
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonTableRow key={i} columns={columns} />
      ))}

      {/* Screen reader text */}
      <span className="sr-only">Loading table data, please wait...</span>
    </div>
  );
};

/**
 * Skeleton list item
 */
export const SkeletonListItem: React.FC<{
  showAvatar?: boolean;
  showSecondaryText?: boolean;
  className?: string;
}> = ({ showAvatar = true, showSecondaryText = true, className }) => {
  return (
    <div
      className={cn('flex items-center gap-3 px-4 py-3 border-b border-border', className)}
      aria-hidden="true"
    >
      {showAvatar && <SkeletonAvatar size="md" />}
      <div className="flex-1 space-y-2">
        <Skeleton height={18} width="50%" />
        {showSecondaryText && <Skeleton height={14} width="70%" />}
      </div>
      <Skeleton width={80} height={32} rounded="lg" />
    </div>
  );
};

/**
 * Skeleton list
 */
export const SkeletonList: React.FC<{
  items?: number;
  showAvatar?: boolean;
  className?: string;
}> = ({ items = 5, showAvatar = true, className }) => {
  return (
    <div
      className={cn('rounded-xl overflow-hidden bg-card border border-border', className)}
      role="status"
      aria-label="Loading list"
    >
      {Array.from({ length: items }).map((_, i) => (
        <SkeletonListItem key={i} showAvatar={showAvatar} />
      ))}
      <span className="sr-only">Loading list, please wait...</span>
    </div>
  );
};

/**
 * Skeleton detail view / form
 */
export const SkeletonDetailView: React.FC<{
  fields?: number;
  className?: string;
}> = ({ fields = 6, className }) => {
  return (
    <div
      className={cn('rounded-xl p-6 bg-card border border-border', className)}
      role="status"
      aria-label="Loading details"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
        <div className="space-y-2">
          <Skeleton height={28} width={200} />
          <Skeleton height={16} width={120} />
        </div>
        <div className="flex gap-2">
          <Skeleton width={80} height={36} rounded="lg" />
          <Skeleton width={80} height={36} rounded="lg" />
        </div>
      </div>

      {/* Fields grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton height={14} width={80} />
            <Skeleton height={40} className="w-full" rounded="lg" />
          </div>
        ))}
      </div>

      <span className="sr-only">Loading details, please wait...</span>
    </div>
  );
};

/**
 * Skeleton kanban card
 */
export const SkeletonKanbanCard: React.FC<{
  className?: string;
}> = ({ className }) => {
  return (
    <div
      className={cn('rounded-lg p-3 bg-card border border-border shadow-sm', className)}
      aria-hidden="true"
    >
      <div className="space-y-3">
        <Skeleton height={18} width="80%" />
        <Skeleton height={14} width="60%" />
        <div className="flex items-center justify-between pt-2">
          <SkeletonAvatar size="sm" />
          <Skeleton height={20} width={60} rounded="full" />
        </div>
      </div>
    </div>
  );
};

/**
 * Skeleton kanban column
 */
export const SkeletonKanbanColumn: React.FC<{
  cards?: number;
  className?: string;
}> = ({ cards = 3, className }) => {
  return (
    <div
      className={cn('w-72 flex-shrink-0 rounded-xl p-3 bg-muted', className)}
      aria-hidden="true"
    >
      {/* Column header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <Skeleton height={18} width={100} />
        <Skeleton height={24} width={24} rounded="md" />
      </div>

      {/* Cards */}
      <div className="space-y-2">
        {Array.from({ length: cards }).map((_, i) => (
          <SkeletonKanbanCard key={i} />
        ))}
      </div>
    </div>
  );
};

/**
 * Skeleton dashboard widget
 */
export const SkeletonWidget: React.FC<{
  type?: 'chart' | 'stat' | 'list';
  className?: string;
}> = ({ type = 'stat', className }) => {
  return (
    <div
      className={cn('rounded-xl p-4 bg-card border border-border', className)}
      aria-hidden="true"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Skeleton height={16} width={120} />
        <Skeleton height={24} width={24} rounded="md" />
      </div>

      {type === 'stat' && (
        <div className="space-y-2">
          <Skeleton height={36} width={100} />
          <Skeleton height={14} width={80} />
        </div>
      )}

      {type === 'chart' && (
        <Skeleton height={180} className="w-full" rounded="lg" />
      )}

      {type === 'list' && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton height={14} width="60%" />
              <Skeleton height={14} width={50} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Skeleton;
