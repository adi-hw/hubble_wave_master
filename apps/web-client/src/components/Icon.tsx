import React from 'react';
import * as Lucide from 'lucide-react';

interface IconProps {
  name: string;
  className?: string;
  style?: React.CSSProperties;
  size?: number | string;
}

/**
 * Converts kebab-case icon names to PascalCase for Lucide lookup.
 * Examples: 'home' -> 'Home', 'settings-2' -> 'Settings2', 'arrow-left-right' -> 'ArrowLeftRight'
 */
function toPascalCase(str: string): string {
  return str
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

export const Icon: React.FC<IconProps> = ({ name, className, style, size }) => {
  const pascalName = toPascalCase(name);
  const LucideIcon = (Lucide as unknown as Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties; size?: number | string }>>)[pascalName] ?? Lucide.Circle;
  return <LucideIcon className={className} style={style} size={size} />;
};
