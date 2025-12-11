import React from 'react';
import * as Lucide from 'lucide-react';

interface IconProps {
  name: string;
  className?: string;
}

export const Icon: React.FC<IconProps> = ({ name, className }) => {
  const LucideIcon = (Lucide as unknown as Record<string, React.ComponentType<any>>)[name] ?? Lucide.Circle;
  return <LucideIcon className={className} />;
};
