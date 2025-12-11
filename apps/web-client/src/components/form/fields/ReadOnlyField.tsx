import React from 'react';
import { FieldComponentProps } from '../types';
import { FieldWrapper } from './FieldWrapper';
import { Lock, Calculator, GitBranch, Code, Workflow, Binary, Fingerprint, Shield, Key, MapPin, Languages } from 'lucide-react';

// Icons for different read-only field types
const fieldTypeIcons: Record<string, React.ElementType> = {
  formula: Calculator,
  condition: GitBranch,
  script_ref: Code,
  workflow_stage: Workflow,
  auto_number: Binary,
  guid: Fingerprint,
  password_hashed: Key,
  secret_encrypted: Shield,
  domain_scope: Shield,
  geo_point: MapPin,
  translated_string: Languages,
  translated_rich_text: Languages,
};

export const ReadOnlyField: React.FC<FieldComponentProps<any>> = ({
  field,
  value,
}) => {
  const Icon = fieldTypeIcons[field.type] || Lock;

  const formatValue = (val: any): string => {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'object') {
      try {
        return JSON.stringify(val, null, 2);
      } catch {
        return String(val);
      }
    }
    // Mask sensitive fields
    if (field.type === 'password_hashed' || field.type === 'secret_encrypted') {
      return '••••••••';
    }
    return String(val);
  };

  const getTypeLabel = () => {
    switch (field.type) {
      case 'formula': return 'Calculated';
      case 'condition': return 'Condition';
      case 'script_ref': return 'Script Reference';
      case 'workflow_stage': return 'Workflow Stage';
      case 'auto_number': return 'Auto-generated';
      case 'guid': return 'System ID';
      case 'password_hashed': return 'Encrypted';
      case 'secret_encrypted': return 'Encrypted';
      case 'domain_scope': return 'Domain';
      case 'geo_point': return 'Coordinates';
      case 'translated_string': return 'Translatable';
      case 'translated_rich_text': return 'Translatable';
      default: return 'Read-only';
    }
  };

  return (
    <FieldWrapper
      label={field.label}
      required={false}
      helpText={field.config?.helpText}
    >
      <div className="flex items-start gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg">
        <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0">
          <Icon className="h-4 w-4 text-slate-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-700 break-words font-mono">
            {formatValue(value)}
          </p>
          <p className="text-xs text-slate-400 mt-1">{getTypeLabel()}</p>
        </div>
      </div>
    </FieldWrapper>
  );
};
