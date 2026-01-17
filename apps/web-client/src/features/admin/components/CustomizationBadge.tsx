import React from 'react';
import { Layers, ArrowUpRight, Lock, Sparkles } from 'lucide-react';

export type CustomizationType = 'platform' | 'override' | 'extend' | 'custom' | 'locked';

interface CustomizationBadgeProps {
  type: CustomizationType;
  showLabel?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

const badgeConfig: Record<CustomizationType, {
  label: string;
  icon: React.FC<{ className?: string }>;
  bgColor: string;
  textColor: string;
  description: string;
}> = {
  platform: {
    label: 'Platform',
    icon: Layers,
    bgColor: 'bg-muted',
    textColor: 'text-muted-foreground',
    description: 'Platform default configuration',
  },
  override: {
    label: 'Override',
    icon: ArrowUpRight,
    bgColor: 'bg-warning-subtle',
    textColor: 'text-warning-text',
    description: 'Overrides platform default',
  },
  extend: {
    label: 'Extended',
    icon: Sparkles,
    bgColor: 'bg-info-subtle',
    textColor: 'text-info-text',
    description: 'Extends platform configuration',
  },
  custom: {
    label: 'Custom',
    icon: Sparkles,
    bgColor: 'bg-success-subtle',
    textColor: 'text-success-text',
    description: 'Custom instance configuration',
  },
  locked: {
    label: 'Locked',
    icon: Lock,
    bgColor: 'bg-muted-foreground/20',
    textColor: 'text-muted-foreground',
    description: 'System locked - cannot be modified',
  },
};

export const CustomizationBadge: React.FC<CustomizationBadgeProps> = ({
  type,
  showLabel = true,
  size = 'md',
  className = '',
}) => {
  const config = badgeConfig[type];
  const Icon = config.icon;

  const sizeClasses = size === 'sm'
    ? 'text-xs px-1.5 py-0.5 gap-1'
    : 'text-xs px-2 py-1 gap-1.5';

  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';

  return (
    <span
      className={`
        inline-flex items-center rounded-full font-medium
        ${config.bgColor} ${config.textColor} ${sizeClasses} ${className}
      `}
      title={config.description}
    >
      <Icon className={iconSize} />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
};

interface SourceIndicatorProps {
  source: 'platform' | 'module' | 'instance';
  isModified?: boolean;
  className?: string;
}

export const SourceIndicator: React.FC<SourceIndicatorProps> = ({
  source,
  isModified = false,
  className = '',
}) => {
  if (isModified) {
    return <CustomizationBadge type="override" className={className} />;
  }

  switch (source) {
    case 'platform':
      return <CustomizationBadge type="platform" className={className} />;
    case 'instance':
      return <CustomizationBadge type="custom" className={className} />;
    default:
      return <CustomizationBadge type="platform" className={className} />;
  }
};
