import React from 'react';
import * as Lucide from 'lucide-react';

interface IconProps {
  name: string;
  className?: string;
  style?: React.CSSProperties;
  size?: number | string;
}

export const Icon: React.FC<IconProps> = ({ name, className, style, size }) => {
  const LucideIcon = (Lucide as unknown as Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties; size?: number | string }>>)[name] ?? Lucide.Circle;
  return <LucideIcon className={className} style={style} size={size} />;
};
