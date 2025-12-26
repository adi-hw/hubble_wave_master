import React from 'react';
import { cn } from '../../lib/utils';

export type BadgeVariant =
  | 'primary'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral';

export type ConfigType =
  | 'collection'
  | 'property'
  | 'workflow'
  | 'access_rule'
  | 'script'
  | 'approval'
  | 'notification'
  | 'event'
  | 'automation_rule';

export type CustomizationType = 'override' | 'extend' | 'new';

export type ImpactSeverity = 'critical' | 'high' | 'medium' | 'low' | 'none';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Visual variant */
  variant?: BadgeVariant;
  /** Size of the badge */
  size?: 'sm' | 'md' | 'lg';
  /** Show a colored dot before the text */
  dot?: boolean;
  /** Use solid background instead of subtle */
  solid?: boolean;
  /** Make the badge rounded-full (pill) */
  pill?: boolean;
}

/**
 * Badge component for status indicators and labels.
 * Uses the HubbleWave design system tokens.
 *
 * @example
 * <Badge variant="success">Active</Badge>
 *
 * @example
 * <Badge variant="danger" dot>Error</Badge>
 *
 * @example
 * <Badge variant="primary" solid>New</Badge>
 */
export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'md',
  dot = false,
  solid = false,
  pill = true,
  className = '',
  children,
  ...props
}) => {
  const baseClasses = solid
    ? {
        primary: 'badge-primary-solid',
        accent: 'badge-accent-solid',
        success: 'badge-success-solid',
        warning: 'badge bg-warning text-warning-foreground',
        danger: 'badge-danger-solid',
        info: 'badge bg-info text-info-foreground',
        neutral: 'badge bg-neutral-700 text-white',
      }
    : {
        primary: 'badge-primary',
        accent: 'badge-accent',
        success: 'badge-success',
        warning: 'badge-warning',
        danger: 'badge-danger',
        info: 'badge-info',
        neutral: 'badge-neutral',
      };

  const sizeClasses = {
    sm: 'text-2xs px-1.5 py-0',
    md: '',
    lg: 'text-sm px-3 py-1',
  };

  const dotColorClasses: Record<BadgeVariant, string> = {
    primary: 'bg-primary',
    accent: 'bg-accent',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
    info: 'bg-info',
    neutral: 'bg-neutral-400',
  };

  return (
    <span
      className={cn(
        baseClasses[variant],
        sizeClasses[size],
        !pill && 'rounded-md',
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn('w-1.5 h-1.5 rounded-full mr-1.5', dotColorClasses[variant])}
        />
      )}
      {children}
    </span>
  );
};

// ============================================
// CONFIG TYPE BADGE
// ============================================

export interface ConfigTypeBadgeProps {
  type: ConfigType;
  className?: string;
}

const configLabels: Record<ConfigType, string> = {
  collection: 'Collection',
  property: 'Property',
  workflow: 'Workflow',
  access_rule: 'Access Rule',
  script: 'Script',
  approval: 'Approval',
  notification: 'Notification',
  event: 'Event',
  automation_rule: 'Automation Rule',
};

const configVariants: Record<ConfigType, BadgeVariant> = {
  collection: 'primary',
  property: 'accent',
  workflow: 'success',
  access_rule: 'warning',
  script: 'danger',
  approval: 'warning',
  notification: 'info',
  event: 'success',
  automation_rule: 'danger',
};

export const ConfigTypeBadge: React.FC<ConfigTypeBadgeProps> = ({
  type,
  className = '',
}) => {
  return (
    <Badge variant={configVariants[type]} className={className}>
      {configLabels[type]}
    </Badge>
  );
};

// ============================================
// CUSTOMIZATION TYPE BADGE
// ============================================

export interface CustomizationTypeBadgeProps {
  type: CustomizationType;
  className?: string;
}

const customizationLabels: Record<CustomizationType, string> = {
  override: 'Override',
  extend: 'Extend',
  new: 'New',
};

const customizationVariants: Record<CustomizationType, BadgeVariant> = {
  override: 'warning',
  extend: 'primary',
  new: 'success',
};

export const CustomizationTypeBadge: React.FC<CustomizationTypeBadgeProps> = ({
  type,
  className = '',
}) => {
  return (
    <Badge variant={customizationVariants[type]} className={className}>
      {customizationLabels[type]}
    </Badge>
  );
};

// ============================================
// IMPACT SEVERITY BADGE
// ============================================

export interface ImpactSeverityBadgeProps {
  severity: ImpactSeverity;
  className?: string;
}

const severityLabels: Record<ImpactSeverity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  none: 'None',
};

const severityVariants: Record<ImpactSeverity, BadgeVariant> = {
  critical: 'danger',
  high: 'warning',
  medium: 'info',
  low: 'success',
  none: 'neutral',
};

export const ImpactSeverityBadge: React.FC<ImpactSeverityBadgeProps> = ({
  severity,
  className = '',
}) => {
  return (
    <Badge
      variant={severityVariants[severity]}
      className={cn(severity === 'critical' && 'font-semibold', className)}
    >
      {severityLabels[severity]}
    </Badge>
  );
};

// ============================================
// STATUS BADGE (with dot indicator)
// ============================================

export interface StatusBadgeProps {
  status: 'online' | 'offline' | 'busy' | 'away' | 'active' | 'inactive' | 'pending';
  label?: string;
  className?: string;
}

const statusConfig: Record<StatusBadgeProps['status'], { variant: BadgeVariant; label: string }> = {
  online: { variant: 'success', label: 'Online' },
  offline: { variant: 'neutral', label: 'Offline' },
  busy: { variant: 'danger', label: 'Busy' },
  away: { variant: 'warning', label: 'Away' },
  active: { variant: 'success', label: 'Active' },
  inactive: { variant: 'neutral', label: 'Inactive' },
  pending: { variant: 'warning', label: 'Pending' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  className = '',
}) => {
  const config = statusConfig[status];
  return (
    <Badge variant={config.variant} dot className={className}>
      {label || config.label}
    </Badge>
  );
};

export default Badge;
