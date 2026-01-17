/**
 * TypeSelector
 * HubbleWave Platform - Phase 3
 *
 * Grid of selectable property types for creating new properties.
 */

import React from 'react';
import {
  Type,
  FileText,
  Hash,
  DollarSign,
  Percent,
  Calendar,
  Clock,
  CheckSquare,
  List,
  Link,
  AtSign,
  Phone,
  User,
  Image,
  Code,
} from 'lucide-react';

interface TypeConfig {
  value: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  color: string;
}

const PROPERTY_TYPES: TypeConfig[] = [
  {
    value: 'text',
    label: 'Single Line Text',
    icon: <Type className="w-5 h-5" />,
    description: 'Short text values like names, titles',
    color: '#2196F3',
  },
  {
    value: 'long_text',
    label: 'Long Text',
    icon: <FileText className="w-5 h-5" />,
    description: 'Multi-line text areas',
    color: '#2196F3',
  },
  {
    value: 'number',
    label: 'Number',
    icon: <Hash className="w-5 h-5" />,
    description: 'Integers or decimals',
    color: '#4CAF50',
  },
  {
    value: 'currency',
    label: 'Currency',
    icon: <DollarSign className="w-5 h-5" />,
    description: 'Monetary values',
    color: '#4CAF50',
  },
  {
    value: 'percentage',
    label: 'Percentage',
    icon: <Percent className="w-5 h-5" />,
    description: 'Values from 0-100%',
    color: '#4CAF50',
  },
  {
    value: 'date',
    label: 'Date',
    icon: <Calendar className="w-5 h-5" />,
    description: 'Calendar date',
    color: '#9C27B0',
  },
  {
    value: 'datetime',
    label: 'Date & Time',
    icon: <Clock className="w-5 h-5" />,
    description: 'Date with time',
    color: '#9C27B0',
  },
  {
    value: 'checkbox',
    label: 'Checkbox',
    icon: <CheckSquare className="w-5 h-5" />,
    description: 'Boolean true/false',
    color: '#FF9800',
  },
  {
    value: 'choice',
    label: 'Choice',
    icon: <List className="w-5 h-5" />,
    description: 'Select one from a list',
    color: '#FF9800',
  },
  {
    value: 'multi_choice',
    label: 'Multi Choice',
    icon: <List className="w-5 h-5" />,
    description: 'Select multiple from a list',
    color: '#FF9800',
  },
  {
    value: 'url',
    label: 'URL',
    icon: <Link className="w-5 h-5" />,
    description: 'Web link',
    color: '#00BCD4',
  },
  {
    value: 'email',
    label: 'Email',
    icon: <AtSign className="w-5 h-5" />,
    description: 'Email address',
    color: '#00BCD4',
  },
  {
    value: 'phone',
    label: 'Phone',
    icon: <Phone className="w-5 h-5" />,
    description: 'Phone number',
    color: '#00BCD4',
  },
  {
    value: 'reference',
    label: 'Reference',
    icon: <Link className="w-5 h-5 rotate-45" />,
    description: 'Link to another record',
    color: '#795548',
  },
  {
    value: 'user',
    label: 'User',
    icon: <User className="w-5 h-5" />,
    description: 'System user',
    color: '#607D8B',
  },
  {
    value: 'attachment',
    label: 'Attachment',
    icon: <Image className="w-5 h-5" />,
    description: 'Files and images',
    color: '#F44336',
  },
  {
    value: 'json',
    label: 'JSON',
    icon: <Code className="w-5 h-5" />,
    description: 'Raw JSON data',
    color: '#607D8B',
  },
];

interface TypeSelectorProps {
  selectedType?: string;
  onSelect: (type: string) => void;
}

export const TypeSelector: React.FC<TypeSelectorProps> = ({ selectedType, onSelect }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {PROPERTY_TYPES.map((type) => {
        const isSelected = selectedType === type.value;
        const typeColorStyle = { '--type-color': type.color } as React.CSSProperties;
        return (
          <button
            key={type.value}
            type="button"
            onClick={() => onSelect(type.value)}
            className={`p-4 rounded-lg border-2 text-left transition-all hover:-translate-y-0.5 ${
              isSelected
                ? 'border-[--type-color] bg-[--type-color]/10 shadow-[0_2px_8px_var(--type-color,transparent)/20]'
                : 'bg-card border-border'
            }`}
            style={typeColorStyle}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded text-[--type-color] bg-[--type-color]/[0.15]">
                {type.icon}
              </div>
              <span className="font-medium text-sm text-foreground">
                {type.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {type.description}
            </p>
          </button>
        );
      })}
    </div>
  );
};
