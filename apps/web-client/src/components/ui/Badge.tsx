import React from 'react';

export type BadgeVariant =
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'neutral'
  | 'info';

export type ConfigType =
  | 'table'
  | 'field'
  | 'workflow'
  | 'acl'
  | 'script'
  | 'approval'
  | 'notification'
  | 'event'
  | 'business_rule';

export type CustomizationType = 'override' | 'extend' | 'new';

export type ImpactSeverity = 'critical' | 'high' | 'medium' | 'low' | 'none';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'md',
  dot = false,
  className = '',
  children,
  ...props
}) => {
  const variantClasses: Record<BadgeVariant, string> = {
    primary: 'badge-primary',
    success: 'badge-success',
    warning: 'badge-warning',
    danger: 'badge-danger',
    neutral: 'badge-neutral',
    info: 'badge-primary',
  };

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0',
    md: 'text-xs px-2 py-0.5',
  };

  return (
    <span
      className={`${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {dot && (
        <span
          className="w-1.5 h-1.5 rounded-full mr-1.5"
          style={{ backgroundColor: 'currentColor' }}
        />
      )}
      {children}
    </span>
  );
};

export interface ConfigTypeBadgeProps {
  type: ConfigType;
  className?: string;
}

export const ConfigTypeBadge: React.FC<ConfigTypeBadgeProps> = ({
  type,
  className = '',
}) => {
  const configLabels: Record<ConfigType, string> = {
    table: 'Table',
    field: 'Field',
    workflow: 'Workflow',
    acl: 'ACL',
    script: 'Script',
    approval: 'Approval',
    notification: 'Notification',
    event: 'Event',
    business_rule: 'Business Rule',
  };

  const configClasses: Record<ConfigType, string> = {
    table: 'badge-config-table',
    field: 'badge-config-field',
    workflow: 'badge-config-workflow',
    acl: 'badge-config-acl',
    script: 'badge-config-script',
    approval: 'badge-warning',
    notification: 'badge-primary',
    event: 'badge-success',
    business_rule: 'badge-danger',
  };

  return (
    <span className={`${configClasses[type]} ${className}`}>
      {configLabels[type]}
    </span>
  );
};

export interface CustomizationTypeBadgeProps {
  type: CustomizationType;
  className?: string;
}

export const CustomizationTypeBadge: React.FC<CustomizationTypeBadgeProps> = ({
  type,
  className = '',
}) => {
  const labels: Record<CustomizationType, string> = {
    override: 'Override',
    extend: 'Extend',
    new: 'New',
  };

  const classes: Record<CustomizationType, string> = {
    override: 'badge-override',
    extend: 'badge-extend',
    new: 'badge-new',
  };

  return (
    <span className={`${classes[type]} ${className}`}>
      {labels[type]}
    </span>
  );
};

export interface ImpactSeverityBadgeProps {
  severity: ImpactSeverity;
  className?: string;
}

export const ImpactSeverityBadge: React.FC<ImpactSeverityBadgeProps> = ({
  severity,
  className = '',
}) => {
  const labels: Record<ImpactSeverity, string> = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    none: 'None',
  };

  const classes: Record<ImpactSeverity, string> = {
    critical: 'badge-impact-critical',
    high: 'badge-impact-high',
    medium: 'badge-impact-medium',
    low: 'badge-impact-low',
    none: 'badge-neutral',
  };

  return (
    <span className={`${classes[severity]} ${className}`}>
      {labels[severity]}
    </span>
  );
};

export default Badge;
