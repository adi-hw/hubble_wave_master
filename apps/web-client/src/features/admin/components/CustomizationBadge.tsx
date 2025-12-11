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
    bgColor: 'bg-slate-100',
    textColor: 'text-slate-600',
    description: 'Platform default configuration',
  },
  override: {
    label: 'Override',
    icon: ArrowUpRight,
    bgColor: 'bg-amber-100',
    textColor: 'text-amber-700',
    description: 'Overrides platform default',
  },
  extend: {
    label: 'Extended',
    icon: Sparkles,
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    description: 'Extends platform configuration',
  },
  custom: {
    label: 'Custom',
    icon: Sparkles,
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
    description: 'Custom tenant configuration',
  },
  locked: {
    label: 'Locked',
    icon: Lock,
    bgColor: 'bg-slate-200',
    textColor: 'text-slate-500',
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
  source: 'platform' | 'module' | 'tenant';
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
    case 'tenant':
      return <CustomizationBadge type="custom" className={className} />;
    default:
      return <CustomizationBadge type="platform" className={className} />;
  }
};
