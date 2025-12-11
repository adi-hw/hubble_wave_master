import React, { useEffect, useState } from 'react';
import { createApiClient } from '../../services/api';
import type { AuthorizedFieldMeta } from './types';
import {
  Type,
  FileText,
  Hash,
  ToggleLeft,
  Calendar,
  Link2,
  List,
  Braces,
  Eye,
  EyeOff,
  Lock,
  Plus,
  Trash2,
  GripVertical,
  AlertCircle,
  Check,
  Clock,
  Timer,
  DollarSign,
  Percent,
  User,
  Users,
  Paperclip,
  Image,
  Music,
  Video,
  Mail,
  Phone,
  Globe,
  Wifi,
  Palette,
  Key,
  Shield,
  Fingerprint,
  Calculator,
  GitBranch,
  Code,
  Workflow,
  Languages,
  MapPin,
  Tag,
  Binary,
  Database,
  Zap,
  Settings,
  ChevronDown,
  ChevronUp,
  Network,
  Regex,
  CalendarRange,
  Layers,
  Info,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

const METADATA_API_URL = import.meta.env.VITE_METADATA_API_URL ?? '/api/metadata';
const metadataApi = createApiClient(METADATA_API_URL);

interface Props {
  open: boolean;
  mode: 'create' | 'edit';
  tableCode: string;
  field: AuthorizedFieldMeta | null;
  onClose: () => void;
  onSaved?: () => void;
  availableTables?: Array<{ code: string; label: string }>;
}

type FieldType = string; // Dynamic from database

interface ChoiceOption {
  value: string;
  label: string;
}

interface FieldConfig {
  // Choice configuration
  choices?: ChoiceOption[];
  allowCustomValues?: boolean;

  // Reference configuration
  referenceTable?: string;
  referenceDisplayField?: string;
  multiSelect?: boolean;
  onDeleteAction?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
  onUpdateAction?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';

  // Text constraints
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  patternMessage?: string;

  // Numeric constraints
  minValue?: number;
  maxValue?: number;
  precision?: number;
  scale?: number;
  currencyCode?: string;

  // Date constraints
  minDate?: string;
  maxDate?: string;
  dateFormat?: string;

  // Array support
  isArray?: boolean;
  arrayMinItems?: number;
  arrayMaxItems?: number;

  // Index configuration
  indexType?: 'btree' | 'hash' | 'gin' | 'gist' | 'brin';
  indexName?: string;

  // Check constraints
  checkExpression?: string;
  checkName?: string;

  // Display/Format
  format?: string;
  placeholder?: string;
  helpText?: string;

  // Computed fields
  computeExpression?: string;
  computeLanguage?: 'sql' | 'plpgsql';
  isGenerated?: boolean;
  generatedType?: 'STORED' | 'VIRTUAL';

  // Collation
  collation?: string;

  // Validators
  validators?: {
    required?: boolean;
    email?: boolean;
    url?: boolean;
    phone?: boolean;
    ipAddress?: boolean;
    macAddress?: boolean;
    uuid?: boolean;
    json?: boolean;
    customError?: string;
  };
}

interface FieldTypeInfo {
  icon: React.ReactNode;
  label: string;
  description: string;
  color: string;
  category: string;
  needsConfig?: 'choices' | 'reference';
}

// Field types organized by category
const fieldTypesByCategory: Record<string, { label: string; color: string; types: Record<string, FieldTypeInfo> }> = {
  text: {
    label: 'Text',
    color: 'var(--hw-primary)',
    types: {
      string: { icon: <Type className="h-4 w-4" />, label: 'String', description: 'Short text up to 255 chars', color: 'var(--hw-primary)', category: 'text' },
      text: { icon: <FileText className="h-4 w-4" />, label: 'Long Text', description: 'Multi-line text', color: 'var(--hw-primary)', category: 'text' },
      rich_text: { icon: <FileText className="h-4 w-4" />, label: 'Rich Text', description: 'WYSIWYG HTML editor', color: 'var(--hw-primary)', category: 'text' },
    },
  },
  numeric: {
    label: 'Numbers',
    color: '#8b5cf6',
    types: {
      integer: { icon: <Hash className="h-4 w-4" />, label: 'Integer', description: 'Whole numbers', color: '#8b5cf6', category: 'numeric' },
      long: { icon: <Hash className="h-4 w-4" />, label: 'Long', description: 'Large integers', color: '#8b5cf6', category: 'numeric' },
      decimal: { icon: <Hash className="h-4 w-4" />, label: 'Decimal', description: 'Precision decimals', color: '#8b5cf6', category: 'numeric' },
      currency: { icon: <DollarSign className="h-4 w-4" />, label: 'Currency', description: 'Money values', color: '#8b5cf6', category: 'numeric' },
      percent: { icon: <Percent className="h-4 w-4" />, label: 'Percent', description: '0-100 percentage', color: '#8b5cf6', category: 'numeric' },
    },
  },
  primitive: {
    label: 'Basic',
    color: '#f59e0b',
    types: {
      boolean: { icon: <ToggleLeft className="h-4 w-4" />, label: 'Boolean', description: 'True/false', color: '#f59e0b', category: 'primitive' },
    },
  },
  datetime: {
    label: 'Date & Time',
    color: '#10b981',
    types: {
      date: { icon: <Calendar className="h-4 w-4" />, label: 'Date', description: 'Date only', color: '#10b981', category: 'datetime' },
      datetime: { icon: <Calendar className="h-4 w-4" />, label: 'Date & Time', description: 'Date with time', color: '#10b981', category: 'datetime' },
      time: { icon: <Clock className="h-4 w-4" />, label: 'Time', description: 'Time of day', color: '#10b981', category: 'datetime' },
      duration: { icon: <Timer className="h-4 w-4" />, label: 'Duration', description: 'Time interval', color: '#10b981', category: 'datetime' },
    },
  },
  choice: {
    label: 'Choices',
    color: '#06b6d4',
    types: {
      choice: { icon: <List className="h-4 w-4" />, label: 'Choice', description: 'Single select', color: '#06b6d4', category: 'choice', needsConfig: 'choices' },
      multi_choice: { icon: <List className="h-4 w-4" />, label: 'Multi-Choice', description: 'Multi-select', color: '#06b6d4', category: 'choice', needsConfig: 'choices' },
      tags: { icon: <Tag className="h-4 w-4" />, label: 'Tags', description: 'Tagging system', color: '#06b6d4', category: 'choice' },
    },
  },
  reference: {
    label: 'References',
    color: '#ec4899',
    types: {
      reference: { icon: <Link2 className="h-4 w-4" />, label: 'Reference', description: 'Link to table', color: '#ec4899', category: 'reference', needsConfig: 'reference' },
      multi_reference: { icon: <Link2 className="h-4 w-4" />, label: 'Multi-Reference', description: 'Multiple links', color: '#ec4899', category: 'reference', needsConfig: 'reference' },
      user_reference: { icon: <User className="h-4 w-4" />, label: 'User', description: 'User picker', color: '#ec4899', category: 'reference' },
      group_reference: { icon: <Users className="h-4 w-4" />, label: 'Group', description: 'Group picker', color: '#ec4899', category: 'reference' },
    },
  },
  media: {
    label: 'Files & Media',
    color: '#f97316',
    types: {
      file: { icon: <Paperclip className="h-4 w-4" />, label: 'File', description: 'File attachment', color: '#f97316', category: 'media' },
      image: { icon: <Image className="h-4 w-4" />, label: 'Image', description: 'Image with preview', color: '#f97316', category: 'media' },
      audio: { icon: <Music className="h-4 w-4" />, label: 'Audio', description: 'Audio file', color: '#f97316', category: 'media' },
      video: { icon: <Video className="h-4 w-4" />, label: 'Video', description: 'Video file', color: '#f97316', category: 'media' },
    },
  },
  communication: {
    label: 'Communication',
    color: '#3b82f6',
    types: {
      email: { icon: <Mail className="h-4 w-4" />, label: 'Email', description: 'Email address', color: '#3b82f6', category: 'communication' },
      phone: { icon: <Phone className="h-4 w-4" />, label: 'Phone', description: 'Phone number', color: '#3b82f6', category: 'communication' },
      url: { icon: <Globe className="h-4 w-4" />, label: 'URL', description: 'Web link', color: '#3b82f6', category: 'communication' },
      ip_address: { icon: <Wifi className="h-4 w-4" />, label: 'IP Address', description: 'IPv4/IPv6', color: '#3b82f6', category: 'communication' },
      mac_address: { icon: <Network className="h-4 w-4" />, label: 'MAC Address', description: 'Hardware address', color: '#3b82f6', category: 'communication' },
      color: { icon: <Palette className="h-4 w-4" />, label: 'Color', description: 'Color picker', color: '#3b82f6', category: 'communication' },
    },
  },
  structured: {
    label: 'Structured',
    color: '#6366f1',
    types: {
      json: { icon: <Braces className="h-4 w-4" />, label: 'JSON', description: 'JSON data', color: '#6366f1', category: 'structured' },
      key_value: { icon: <Braces className="h-4 w-4" />, label: 'Key-Value', description: 'Key-value pairs', color: '#6366f1', category: 'structured' },
    },
  },
  identity: {
    label: 'Identity',
    color: '#14b8a6',
    types: {
      auto_number: { icon: <Binary className="h-4 w-4" />, label: 'Auto Number', description: 'Auto-generated ID', color: '#14b8a6', category: 'identity' },
      guid: { icon: <Fingerprint className="h-4 w-4" />, label: 'GUID', description: 'Unique identifier', color: '#14b8a6', category: 'identity' },
    },
  },
  security: {
    label: 'Security',
    color: '#ef4444',
    types: {
      password_hashed: { icon: <Key className="h-4 w-4" />, label: 'Password', description: 'Hashed password', color: '#ef4444', category: 'security' },
      secret_encrypted: { icon: <Shield className="h-4 w-4" />, label: 'Secret', description: 'Encrypted value', color: '#ef4444', category: 'security' },
      domain_scope: { icon: <Shield className="h-4 w-4" />, label: 'Domain Scope', description: 'Domain separation', color: '#ef4444', category: 'security' },
    },
  },
  computed: {
    label: 'Computed',
    color: '#a855f7',
    types: {
      formula: { icon: <Calculator className="h-4 w-4" />, label: 'Formula', description: 'Computed value', color: '#a855f7', category: 'computed' },
      condition: { icon: <GitBranch className="h-4 w-4" />, label: 'Condition', description: 'Condition builder', color: '#a855f7', category: 'computed' },
      script_ref: { icon: <Code className="h-4 w-4" />, label: 'Script Ref', description: 'Script reference', color: '#a855f7', category: 'computed' },
    },
  },
  workflow: {
    label: 'Workflow',
    color: '#84cc16',
    types: {
      workflow_stage: { icon: <Workflow className="h-4 w-4" />, label: 'Stage', description: 'Workflow progress', color: '#84cc16', category: 'workflow' },
    },
  },
  localization: {
    label: 'Localization',
    color: '#0ea5e9',
    types: {
      translated_string: { icon: <Languages className="h-4 w-4" />, label: 'Translated Text', description: 'Translatable text', color: '#0ea5e9', category: 'localization' },
      translated_rich_text: { icon: <Languages className="h-4 w-4" />, label: 'Translated Rich', description: 'Translatable HTML', color: '#0ea5e9', category: 'localization' },
    },
  },
  location: {
    label: 'Location',
    color: '#22c55e',
    types: {
      geo_point: { icon: <MapPin className="h-4 w-4" />, label: 'Geo Point', description: 'Lat/long coords', color: '#22c55e', category: 'location' },
      location_reference: { icon: <MapPin className="h-4 w-4" />, label: 'Location Ref', description: 'Location picker', color: '#22c55e', category: 'location' },
    },
  },
};

// Flat map for quick lookups
const allFieldTypes: Record<string, FieldTypeInfo> = Object.values(fieldTypesByCategory).reduce((acc, cat) => ({ ...acc, ...cat.types }), {});

const getFieldTypeInfo = (type: string): FieldTypeInfo => {
  return allFieldTypes[type] || { icon: <Type className="h-4 w-4" />, label: type, description: '', color: 'var(--hw-text-muted)', category: 'unknown' };
};

// Collapsible section component
const CollapsibleSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, icon, defaultOpen = false, children }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border rounded-lg overflow-hidden" style={{ borderColor: 'var(--hw-border-subtle)' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50/50 transition-colors"
        style={{ backgroundColor: 'var(--hw-bg-subtle)' }}
      >
        <div className="flex items-center gap-2">
          <div style={{ color: 'var(--hw-text-muted)' }}>{icon}</div>
          <span className="text-sm font-medium" style={{ color: 'var(--hw-text)' }}>{title}</span>
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4" style={{ color: 'var(--hw-text-muted)' }} />
        ) : (
          <ChevronDown className="h-4 w-4" style={{ color: 'var(--hw-text-muted)' }} />
        )}
      </button>
      {isOpen && (
        <div className="px-4 py-4 space-y-4 border-t" style={{ borderColor: 'var(--hw-border-subtle)' }}>
          {children}
        </div>
      )}
    </div>
  );
};

// Advanced PostgreSQL Options Section
const AdvancedOptionsSection: React.FC<{
  config: FieldConfig;
  setConfig: React.Dispatch<React.SetStateAction<FieldConfig>>;
  type: string;
  isEdit: boolean;
}> = ({ config, setConfig, type, isEdit }) => {
  const updateConfig = (key: keyof FieldConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const isTextType = ['string', 'text', 'rich_text', 'email', 'phone', 'url'].includes(type);
  const isNumericType = ['integer', 'long', 'decimal', 'number', 'currency', 'percent'].includes(type);
  const isDateType = ['date', 'datetime', 'timestamp', 'time'].includes(type);
  const isReferenceType = ['reference', 'multi_reference'].includes(type);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

      {/* Text Constraints */}
      {isTextType && (
        <CollapsibleSection title="Text Constraints" icon={<Type className="h-4 w-4" />}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--hw-text-secondary)' }}>
                Min Length
              </label>
              <input
                type="number"
                min="0"
                value={config.minLength ?? ''}
                onChange={(e) => updateConfig('minLength', e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ backgroundColor: 'var(--hw-bg)', borderColor: 'var(--hw-border)', color: 'var(--hw-text)' }}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--hw-text-secondary)' }}>
                Max Length
              </label>
              <input
                type="number"
                min="0"
                value={config.maxLength ?? ''}
                onChange={(e) => updateConfig('maxLength', e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ backgroundColor: 'var(--hw-bg)', borderColor: 'var(--hw-border)', color: 'var(--hw-text)' }}
                placeholder="255"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--hw-text-secondary)' }}>
              Regex Pattern
            </label>
            <div className="flex items-center gap-2">
              <Regex className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--hw-text-muted)' }} />
              <input
                type="text"
                value={config.pattern ?? ''}
                onChange={(e) => updateConfig('pattern', e.target.value || undefined)}
                className="flex-1 px-3 py-2 rounded-lg border text-sm font-mono"
                style={{ backgroundColor: 'var(--hw-bg)', borderColor: 'var(--hw-border)', color: 'var(--hw-text)' }}
                placeholder="^[A-Z]{2}[0-9]{4}$"
              />
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--hw-text-muted)' }}>
              PostgreSQL regex pattern for validation
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--hw-text-secondary)' }}>
              Pattern Error Message
            </label>
            <input
              type="text"
              value={config.patternMessage ?? ''}
              onChange={(e) => updateConfig('patternMessage', e.target.value || undefined)}
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{ backgroundColor: 'var(--hw-bg)', borderColor: 'var(--hw-border)', color: 'var(--hw-text)' }}
              placeholder="Value must match the required format"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--hw-text-secondary)' }}>
              Collation
            </label>
            <select
              value={config.collation ?? ''}
              onChange={(e) => updateConfig('collation', e.target.value || undefined)}
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{ backgroundColor: 'var(--hw-bg)', borderColor: 'var(--hw-border)', color: 'var(--hw-text)' }}
            >
              <option value="">Default (database collation)</option>
              <option value="C">C (byte-by-byte comparison)</option>
              <option value="POSIX">POSIX (same as C)</option>
              <option value="en_US.UTF-8">en_US.UTF-8 (English, UTF-8)</option>
              <option value="en_US">en_US (English)</option>
              <option value="und-x-icu">ICU Default</option>
            </select>
          </div>
        </CollapsibleSection>
      )}

      {/* Numeric Constraints */}
      {isNumericType && (
        <CollapsibleSection title="Numeric Constraints" icon={<Hash className="h-4 w-4" />}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--hw-text-secondary)' }}>
                Min Value
              </label>
              <input
                type="number"
                value={config.minValue ?? ''}
                onChange={(e) => updateConfig('minValue', e.target.value ? parseFloat(e.target.value) : undefined)}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ backgroundColor: 'var(--hw-bg)', borderColor: 'var(--hw-border)', color: 'var(--hw-text)' }}
                placeholder="No minimum"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--hw-text-secondary)' }}>
                Max Value
              </label>
              <input
                type="number"
                value={config.maxValue ?? ''}
                onChange={(e) => updateConfig('maxValue', e.target.value ? parseFloat(e.target.value) : undefined)}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ backgroundColor: 'var(--hw-bg)', borderColor: 'var(--hw-border)', color: 'var(--hw-text)' }}
                placeholder="No maximum"
              />
            </div>
          </div>
          {(type === 'decimal' || type === 'currency') && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--hw-text-secondary)' }}>
                  Precision (total digits)
                </label>
                <input
                  type="number"
                  min="1"
                  max="131072"
                  value={config.precision ?? ''}
                  onChange={(e) => updateConfig('precision', e.target.value ? parseInt(e.target.value) : undefined)}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ backgroundColor: 'var(--hw-bg)', borderColor: 'var(--hw-border)', color: 'var(--hw-text)' }}
                  placeholder="10"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--hw-text-secondary)' }}>
                  Scale (decimal places)
                </label>
                <input
                  type="number"
                  min="0"
                  value={config.scale ?? ''}
                  onChange={(e) => updateConfig('scale', e.target.value ? parseInt(e.target.value) : undefined)}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ backgroundColor: 'var(--hw-bg)', borderColor: 'var(--hw-border)', color: 'var(--hw-text)' }}
                  placeholder="2"
                />
              </div>
            </div>
          )}
          {type === 'currency' && (
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--hw-text-secondary)' }}>
                Currency Code
              </label>
              <select
                value={config.currencyCode ?? 'USD'}
                onChange={(e) => updateConfig('currencyCode', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ backgroundColor: 'var(--hw-bg)', borderColor: 'var(--hw-border)', color: 'var(--hw-text)' }}
              >
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - British Pound</option>
                <option value="JPY">JPY - Japanese Yen</option>
                <option value="CAD">CAD - Canadian Dollar</option>
                <option value="AUD">AUD - Australian Dollar</option>
                <option value="CHF">CHF - Swiss Franc</option>
                <option value="CNY">CNY - Chinese Yuan</option>
                <option value="INR">INR - Indian Rupee</option>
              </select>
            </div>
          )}
        </CollapsibleSection>
      )}

      {/* Date Constraints */}
      {isDateType && (
        <CollapsibleSection title="Date/Time Constraints" icon={<CalendarRange className="h-4 w-4" />}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--hw-text-secondary)' }}>
                Min Date
              </label>
              <input
                type={type === 'time' ? 'time' : type === 'datetime' || type === 'timestamp' ? 'datetime-local' : 'date'}
                value={config.minDate ?? ''}
                onChange={(e) => updateConfig('minDate', e.target.value || undefined)}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ backgroundColor: 'var(--hw-bg)', borderColor: 'var(--hw-border)', color: 'var(--hw-text)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--hw-text-secondary)' }}>
                Max Date
              </label>
              <input
                type={type === 'time' ? 'time' : type === 'datetime' || type === 'timestamp' ? 'datetime-local' : 'date'}
                value={config.maxDate ?? ''}
                onChange={(e) => updateConfig('maxDate', e.target.value || undefined)}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ backgroundColor: 'var(--hw-bg)', borderColor: 'var(--hw-border)', color: 'var(--hw-text)' }}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--hw-text-secondary)' }}>
              Display Format
            </label>
            <select
              value={config.dateFormat ?? ''}
              onChange={(e) => updateConfig('dateFormat', e.target.value || undefined)}
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{ backgroundColor: 'var(--hw-bg)', borderColor: 'var(--hw-border)', color: 'var(--hw-text)' }}
            >
              <option value="">Default</option>
              <option value="YYYY-MM-DD">ISO (2024-01-15)</option>
              <option value="DD/MM/YYYY">European (15/01/2024)</option>
              <option value="MM/DD/YYYY">US (01/15/2024)</option>
              <option value="DD MMM YYYY">Short (15 Jan 2024)</option>
              <option value="MMMM DD, YYYY">Long (January 15, 2024)</option>
            </select>
          </div>
        </CollapsibleSection>
      )}

      {/* Reference Options */}
      {isReferenceType && (
        <CollapsibleSection title="Referential Integrity" icon={<Link2 className="h-4 w-4" />}>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--hw-text-secondary)' }}>
              Display Field
            </label>
            <input
              type="text"
              value={config.referenceDisplayField ?? ''}
              onChange={(e) => updateConfig('referenceDisplayField', e.target.value || undefined)}
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{ backgroundColor: 'var(--hw-bg)', borderColor: 'var(--hw-border)', color: 'var(--hw-text)' }}
              placeholder="name (field code to display)"
            />
            <p className="text-xs mt-1" style={{ color: 'var(--hw-text-muted)' }}>
              Field from referenced table to show instead of ID
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--hw-text-secondary)' }}>
                On Delete
              </label>
              <select
                value={config.onDeleteAction ?? 'SET NULL'}
                onChange={(e) => updateConfig('onDeleteAction', e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ backgroundColor: 'var(--hw-bg)', borderColor: 'var(--hw-border)', color: 'var(--hw-text)' }}
              >
                <option value="SET NULL">Set NULL</option>
                <option value="CASCADE">Cascade (delete this record too)</option>
                <option value="RESTRICT">Restrict (prevent deletion)</option>
                <option value="NO ACTION">No Action</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--hw-text-secondary)' }}>
                On Update
              </label>
              <select
                value={config.onUpdateAction ?? 'CASCADE'}
                onChange={(e) => updateConfig('onUpdateAction', e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ backgroundColor: 'var(--hw-bg)', borderColor: 'var(--hw-border)', color: 'var(--hw-text)' }}
              >
                <option value="CASCADE">Cascade (update reference)</option>
                <option value="SET NULL">Set NULL</option>
                <option value="RESTRICT">Restrict (prevent update)</option>
                <option value="NO ACTION">No Action</option>
              </select>
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Array Support */}
      <CollapsibleSection title="Array / Multi-Value" icon={<Layers className="h-4 w-4" />}>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={config.isArray ?? false}
            onChange={(e) => updateConfig('isArray', e.target.checked)}
            className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            disabled={isEdit}
          />
          <div>
            <span className="text-sm font-medium" style={{ color: 'var(--hw-text)' }}>
              Store as array
            </span>
            <p className="text-xs" style={{ color: 'var(--hw-text-muted)' }}>
              Allow multiple values (PostgreSQL array type)
            </p>
          </div>
        </label>
        {config.isArray && (
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--hw-text-secondary)' }}>
                Min Items
              </label>
              <input
                type="number"
                min="0"
                value={config.arrayMinItems ?? ''}
                onChange={(e) => updateConfig('arrayMinItems', e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ backgroundColor: 'var(--hw-bg)', borderColor: 'var(--hw-border)', color: 'var(--hw-text)' }}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--hw-text-secondary)' }}>
                Max Items
              </label>
              <input
                type="number"
                min="1"
                value={config.arrayMaxItems ?? ''}
                onChange={(e) => updateConfig('arrayMaxItems', e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ backgroundColor: 'var(--hw-bg)', borderColor: 'var(--hw-border)', color: 'var(--hw-text)' }}
                placeholder="No limit"
              />
            </div>
          </div>
        )}
      </CollapsibleSection>

      {/* Index Configuration */}
      <CollapsibleSection title="Index & Performance" icon={<Zap className="h-4 w-4" />}>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--hw-text-secondary)' }}>
            Index Type
          </label>
          <select
            value={config.indexType ?? ''}
            onChange={(e) => updateConfig('indexType', e.target.value as any || undefined)}
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={{ backgroundColor: 'var(--hw-bg)', borderColor: 'var(--hw-border)', color: 'var(--hw-text)' }}
          >
            <option value="">No index</option>
            <option value="btree">B-Tree (default, for equality and range)</option>
            <option value="hash">Hash (equality comparisons only)</option>
            <option value="gin">GIN (for arrays, JSONB, full-text)</option>
            <option value="gist">GiST (geometric, full-text, ranges)</option>
            <option value="brin">BRIN (large tables, sequential data)</option>
          </select>
          <p className="text-xs mt-1" style={{ color: 'var(--hw-text-muted)' }}>
            Indexes improve query performance but add write overhead
          </p>
        </div>
        {config.indexType && (
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--hw-text-secondary)' }}>
              Index Name (optional)
            </label>
            <input
              type="text"
              value={config.indexName ?? ''}
              onChange={(e) => updateConfig('indexName', e.target.value || undefined)}
              className="w-full px-3 py-2 rounded-lg border text-sm font-mono"
              style={{ backgroundColor: 'var(--hw-bg)', borderColor: 'var(--hw-border)', color: 'var(--hw-text)' }}
              placeholder="Auto-generated if empty"
            />
          </div>
        )}
      </CollapsibleSection>

      {/* Check Constraint */}
      <CollapsibleSection title="Check Constraint" icon={<Shield className="h-4 w-4" />}>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--hw-text-secondary)' }}>
            Check Expression (SQL)
          </label>
          <textarea
            value={config.checkExpression ?? ''}
            onChange={(e) => updateConfig('checkExpression', e.target.value || undefined)}
            className="w-full px-3 py-2 rounded-lg border text-sm font-mono"
            style={{ backgroundColor: 'var(--hw-bg)', borderColor: 'var(--hw-border)', color: 'var(--hw-text)' }}
            placeholder="value > 0 AND value <= 100"
            rows={2}
          />
          <p className="text-xs mt-1" style={{ color: 'var(--hw-text-muted)' }}>
            PostgreSQL expression that must evaluate to true. Use "value" to reference this field.
          </p>
        </div>
        {config.checkExpression && (
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--hw-text-secondary)' }}>
              Constraint Name
            </label>
            <input
              type="text"
              value={config.checkName ?? ''}
              onChange={(e) => updateConfig('checkName', e.target.value || undefined)}
              className="w-full px-3 py-2 rounded-lg border text-sm font-mono"
              style={{ backgroundColor: 'var(--hw-bg)', borderColor: 'var(--hw-border)', color: 'var(--hw-text)' }}
              placeholder="chk_fieldname_range"
            />
          </div>
        )}
      </CollapsibleSection>

      {/* Computed Columns - Full Width */}
      <div className="lg:col-span-2">
        <CollapsibleSection title="Computed / Generated Column" icon={<Calculator className="h-4 w-4" />}>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.isGenerated ?? false}
              onChange={(e) => updateConfig('isGenerated', e.target.checked)}
              className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              disabled={isEdit}
            />
            <div>
              <span className="text-sm font-medium" style={{ color: 'var(--hw-text)' }}>
                Generated column
              </span>
              <p className="text-xs" style={{ color: 'var(--hw-text-muted)' }}>
                Value is computed from an expression (PostgreSQL 12+)
              </p>
            </div>
          </label>
          {config.isGenerated && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--hw-text-secondary)' }}>
                  Generation Type
                </label>
                <select
                  value={config.generatedType ?? 'STORED'}
                  onChange={(e) => updateConfig('generatedType', e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ backgroundColor: 'var(--hw-bg)', borderColor: 'var(--hw-border)', color: 'var(--hw-text)' }}
                >
                  <option value="STORED">Stored (computed on write, stored on disk)</option>
                  <option value="VIRTUAL">Virtual (computed on read) - PG 17+</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--hw-text-secondary)' }}>
                  Expression
                </label>
                <textarea
                  value={config.computeExpression ?? ''}
                  onChange={(e) => updateConfig('computeExpression', e.target.value || undefined)}
                  className="w-full px-3 py-2 rounded-lg border text-sm font-mono"
                  style={{ backgroundColor: 'var(--hw-bg)', borderColor: 'var(--hw-border)', color: 'var(--hw-text)' }}
                  placeholder="first_name || ' ' || last_name"
                  rows={2}
                />
                <p className="text-xs mt-1" style={{ color: 'var(--hw-text-muted)' }}>
                  SQL expression referencing other columns in this table
                </p>
              </div>
            </div>
          )}
        </CollapsibleSection>
      </div>
    </div>
  );
};

// Tab definitions for the field editor
type EditorTab = 'basics' | 'type' | 'validation' | 'advanced' | 'display';

const editorTabs: { id: EditorTab; label: string; icon: React.ReactNode }[] = [
  { id: 'basics', label: 'Basics', icon: <Type className="h-4 w-4" /> },
  { id: 'type', label: 'Field Type', icon: <Database className="h-4 w-4" /> },
  { id: 'validation', label: 'Validation', icon: <Shield className="h-4 w-4" /> },
  { id: 'advanced', label: 'Advanced', icon: <Settings className="h-4 w-4" /> },
  { id: 'display', label: 'Display', icon: <Eye className="h-4 w-4" /> },
];

export const FieldDrawer: React.FC<Props> = ({ open, mode, tableCode, field, onClose, onSaved, availableTables = [] }) => {
  const [activeTab, setActiveTab] = useState<EditorTab>('basics');
  const [label, setLabel] = useState('');
  const [code, setCode] = useState('');
  const [type, setType] = useState<FieldType>('string');
  const [required, setRequired] = useState(false);
  const [isUnique, setIsUnique] = useState(false);
  const [defaultValue, setDefaultValue] = useState('');
  const [showInForms, setShowInForms] = useState(true);
  const [showInLists, setShowInLists] = useState(true);
  const [isInternal, setIsInternal] = useState(false);
  const [config, setConfig] = useState<FieldConfig>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tables, setTables] = useState<Array<{ code: string; label: string }>>(availableTables);

  // Choice options state
  const [choices, setChoices] = useState<ChoiceOption[]>([]);
  const [newChoiceValue, setNewChoiceValue] = useState('');
  const [newChoiceLabel, setNewChoiceLabel] = useState('');

  // Reference state
  const [referenceTable, setReferenceTable] = useState('');

  // Load available tables for reference fields
  useEffect(() => {
    if (open && tables.length === 0) {
      metadataApi.get('/studio/tables').then((res) => {
        setTables(res.data.items || []);
      }).catch(() => {
        // Ignore errors
      });
    }
  }, [open, tables.length]);

  useEffect(() => {
    if (mode === 'edit' && field) {
      setLabel(field.label);
      setCode(field.code);
      setType(field.type as FieldType);
      setRequired(!field.nullable);
      setIsUnique(field.isUnique || false);
      setDefaultValue(field.defaultValue || '');
      setShowInForms(field.showInForms);
      setShowInLists(field.showInLists);
      setIsInternal(field.isInternal);
      const fieldConfig = (field as any).config || {};
      setConfig(fieldConfig);
      setChoices(fieldConfig.choices || []);
      setReferenceTable(fieldConfig.referenceTable || '');
    }
    if (mode === 'create') {
      setLabel('');
      setCode('');
      setType('string');
      setRequired(false);
      setIsUnique(false);
      setDefaultValue('');
      setShowInForms(true);
      setShowInLists(true);
      setIsInternal(false);
      setConfig({});
      setChoices([]);
      setReferenceTable('');
      setNewChoiceValue('');
      setNewChoiceLabel('');
      setActiveTab('basics');
    }
    setError(null);
  }, [mode, field, open]);

  if (!open) return null;

  const isEdit = mode === 'edit';
  const currentTypeInfo = getFieldTypeInfo(type);

  const onLabelChange = (value: string) => {
    setLabel(value);
    if (!isEdit) {
      const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      setCode(slug);
    }
  };

  const addChoice = () => {
    if (!newChoiceValue.trim()) return;
    const newChoice: ChoiceOption = {
      value: newChoiceValue.trim(),
      label: newChoiceLabel.trim() || newChoiceValue.trim(),
    };
    setChoices([...choices, newChoice]);
    setNewChoiceValue('');
    setNewChoiceLabel('');
  };

  const removeChoice = (index: number) => {
    setChoices(choices.filter((_, i) => i !== index));
  };

  // Render type-specific configuration UI (beyond the basic choice/reference)
  const renderTypeSpecificConfig = () => {
    // IP Address and MAC Address get validation hints
    if (type === 'ip_address') {
      return (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--hw-text)' }}>
            IP Address Configuration
          </h3>
          <Card variant="default" padding="md">
            <div className="flex items-start gap-3">
              <Info className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--hw-primary)' }} />
              <div>
                <p className="text-sm" style={{ color: 'var(--hw-text)' }}>
                  Accepts both IPv4 and IPv6 addresses
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--hw-text-muted)' }}>
                  Examples: 192.168.1.1, 10.0.0.0/8, ::1, 2001:db8::1
                </p>
              </div>
            </div>
          </Card>
        </div>
      );
    }

    if (type === 'mac_address') {
      return (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--hw-text)' }}>
            MAC Address Configuration
          </h3>
          <Card variant="default" padding="md">
            <div className="flex items-start gap-3">
              <Network className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--hw-primary)' }} />
              <div>
                <p className="text-sm" style={{ color: 'var(--hw-text)' }}>
                  Accepts MAC-48/EUI-48 addresses
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--hw-text-muted)' }}>
                  Auto-formats as AA:BB:CC:DD:EE:FF
                </p>
              </div>
            </div>
          </Card>
        </div>
      );
    }

    if (type === 'json') {
      return (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--hw-text)' }}>
            JSON Configuration
          </h3>
          <Card variant="default" padding="md">
            <div className="flex items-start gap-3">
              <Braces className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: '#6366f1' }} />
              <div>
                <p className="text-sm" style={{ color: 'var(--hw-text)' }}>
                  Stored as PostgreSQL JSONB for efficient querying
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--hw-text-muted)' }}>
                  Supports indexing with GIN for fast JSON path queries
                </p>
              </div>
            </div>
          </Card>
        </div>
      );
    }

    if (type === 'geo_point') {
      return (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--hw-text)' }}>
            Geographic Point Configuration
          </h3>
          <Card variant="default" padding="md">
            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: '#22c55e' }} />
              <div>
                <p className="text-sm" style={{ color: 'var(--hw-text)' }}>
                  Stores latitude/longitude coordinates
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--hw-text-muted)' }}>
                  Uses PostgreSQL POINT type with PostGIS support
                </p>
              </div>
            </div>
          </Card>
        </div>
      );
    }

    if (type === 'password_hashed') {
      return (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--hw-text)' }}>
            Password Field Configuration
          </h3>
          <Card variant="default" padding="md" className="border-amber-200 bg-amber-50/50">
            <div className="flex items-start gap-3">
              <Key className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: '#f59e0b' }} />
              <div>
                <p className="text-sm font-medium" style={{ color: '#92400e' }}>
                  Security Notice
                </p>
                <p className="text-xs mt-1" style={{ color: '#a16207' }}>
                  Passwords are hashed using bcrypt before storage. The original value cannot be retrieved.
                </p>
              </div>
            </div>
          </Card>
        </div>
      );
    }

    if (type === 'secret_encrypted') {
      return (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--hw-text)' }}>
            Encrypted Secret Configuration
          </h3>
          <Card variant="default" padding="md" className="border-amber-200 bg-amber-50/50">
            <div className="flex items-start gap-3">
              <Shield className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: '#f59e0b' }} />
              <div>
                <p className="text-sm font-medium" style={{ color: '#92400e' }}>
                  Encryption Notice
                </p>
                <p className="text-xs mt-1" style={{ color: '#a16207' }}>
                  Values are encrypted at rest using AES-256. Access is controlled by tenant encryption keys.
                </p>
              </div>
            </div>
          </Card>
        </div>
      );
    }

    if (type === 'auto_number') {
      return (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--hw-text)' }}>
            Auto Number Configuration
          </h3>
          <Card variant="default" padding="md">
            <Input
              label="Number Format"
              placeholder="ASSET-{YYYY}-{####}"
              value={config.format ?? ''}
              onChange={(e) => setConfig({ ...config, format: e.target.value })}
              hint="Use {####} for sequence, {YYYY} for year, {MM} for month"
            />
          </Card>
        </div>
      );
    }

    return null;
  };

  const handleSave = async () => {
    if (!label.trim()) {
      setError('Label is required');
      return;
    }
    if (!code.trim()) {
      setError('Field code is required');
      return;
    }

    // Validate type-specific requirements
    const typeInfo = getFieldTypeInfo(type);
    if (typeInfo.needsConfig === 'choices' && choices.length === 0) {
      setError('Choice fields require at least one option');
      return;
    }
    if (typeInfo.needsConfig === 'reference' && !referenceTable) {
      setError('Reference fields require a target table');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const fieldConfig: FieldConfig = { ...config };

      if (typeInfo.needsConfig === 'choices') {
        fieldConfig.choices = choices;
      }
      if (typeInfo.needsConfig === 'reference') {
        fieldConfig.referenceTable = referenceTable;
      }

      const payload = {
        label,
        code,
        type,
        required,
        isUnique,
        defaultValue: defaultValue || undefined,
        showInForms,
        showInLists,
        isInternal,
        config: fieldConfig,
      };

      if (isEdit && field) {
        await metadataApi.patch(`/studio/tables/${tableCode}/fields/${field.code}`, payload);
      } else {
        await metadataApi.post(`/studio/tables/${tableCode}/fields`, payload);
      }

      onSaved?.();
      onClose();
    } catch (err: unknown) {
      const message = (err as any)?.response?.data?.message || 'Failed to save field. Please try again.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  // Render tab content based on active tab
  const renderTabContent = () => {
    switch (activeTab) {
      case 'basics':
        return (
          <div className="space-y-8">
            {/* Basic Info Section */}
            <div>
              <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--hw-text)' }}>
                Basic Information
              </h3>
              <p className="text-sm mb-6" style={{ color: 'var(--hw-text-muted)' }}>
                Define the core properties of your field
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Input
                    label="Label"
                    placeholder="e.g., Asset Name"
                    value={label}
                    onChange={(e) => onLabelChange(e.target.value)}
                    hint="The display name shown in the UI"
                  />
                </div>
                <div>
                  <Input
                    label="Field Code"
                    placeholder="e.g., asset_name"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    disabled={isEdit}
                    hint="Used as column name in database and APIs"
                  />
                </div>
              </div>
            </div>

            {/* Default Value */}
            {type !== 'reference' && type !== 'json' && (
              <div>
                <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--hw-text)' }}>
                  Default Value
                </h3>
                <p className="text-sm mb-6" style={{ color: 'var(--hw-text-muted)' }}>
                  Value used when no value is provided
                </p>
                <div className="max-w-xl">
                  <Input
                    placeholder={type === 'boolean' ? 'true or false' : 'Enter default value...'}
                    value={defaultValue}
                    onChange={(e) => setDefaultValue(e.target.value)}
                    hint="Supports PostgreSQL expressions like now(), uuid_generate_v4(), etc."
                  />
                </div>
              </div>
            )}

            {/* Quick Summary */}
            <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--hw-bg-subtle)' }}>
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: `${currentTypeInfo.color}15` }}
                >
                  <div style={{ color: currentTypeInfo.color }}>{currentTypeInfo.icon}</div>
                </div>
                <div>
                  <p className="font-medium" style={{ color: 'var(--hw-text)' }}>
                    {currentTypeInfo.label}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--hw-text-muted)' }}>
                    {currentTypeInfo.description}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {required && <Badge variant="danger" size="sm">Required</Badge>}
                {isUnique && <Badge variant="primary" size="sm">Unique</Badge>}
                {showInLists && <Badge variant="success" size="sm">Shown in Lists</Badge>}
                {showInForms && <Badge variant="success" size="sm">Shown in Forms</Badge>}
                {isInternal && <Badge variant="warning" size="sm">Internal</Badge>}
              </div>
            </div>
          </div>
        );

      case 'type':
        return (
          <div className="space-y-8">
            {/* Field Type Selection */}
            <div>
              <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--hw-text)' }}>
                Select Field Type
              </h3>
              <p className="text-sm mb-6" style={{ color: 'var(--hw-text-muted)' }}>
                Choose the data type that best fits your needs
                {isEdit && <span className="text-amber-600 ml-2">(Cannot be changed after creation)</span>}
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {Object.entries(fieldTypesByCategory).map(([catKey, category]) => (
                  <div key={catKey} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: category.color }} />
                      <p className="text-sm font-semibold" style={{ color: category.color }}>
                        {category.label}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      {Object.entries(category.types).map(([typeKey, typeConf]) => (
                        <button
                          key={typeKey}
                          type="button"
                          disabled={isEdit}
                          onClick={() => setType(typeKey)}
                          className={`
                            w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left
                            ${isEdit ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:shadow-sm'}
                          `}
                          style={{
                            borderColor: type === typeKey ? typeConf.color : 'var(--hw-border-subtle)',
                            backgroundColor: type === typeKey ? `${typeConf.color}08` : 'var(--hw-bg)',
                            boxShadow: type === typeKey ? `0 0 0 1px ${typeConf.color}` : 'none',
                          }}
                        >
                          <div
                            className="p-2 rounded-lg flex-shrink-0"
                            style={{ backgroundColor: `${typeConf.color}15` }}
                          >
                            <div style={{ color: typeConf.color }}>{typeConf.icon}</div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium" style={{ color: 'var(--hw-text)' }}>
                              {typeConf.label}
                            </div>
                            <div className="text-xs" style={{ color: 'var(--hw-text-muted)' }}>
                              {typeConf.description}
                            </div>
                          </div>
                          {type === typeKey && (
                            <Check className="h-5 w-5 flex-shrink-0" style={{ color: typeConf.color }} />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Type-specific configuration */}
            {(currentTypeInfo.needsConfig === 'choices' || currentTypeInfo.needsConfig === 'reference') && (
              <div className="border-t pt-8" style={{ borderColor: 'var(--hw-border-subtle)' }}>
                {/* Choice Options Configuration */}
                {currentTypeInfo.needsConfig === 'choices' && (
                  <div>
                    <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--hw-text)' }}>
                      Choice Options
                    </h3>
                    <p className="text-sm mb-6" style={{ color: 'var(--hw-text-muted)' }}>
                      Define the available options for this choice field
                    </p>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Add new choice */}
                      <Card variant="default" padding="lg">
                        <h4 className="text-sm font-medium mb-4" style={{ color: 'var(--hw-text)' }}>
                          Add New Option
                        </h4>
                        <div className="space-y-4">
                          <Input
                            label="Value"
                            placeholder="e.g., active"
                            value={newChoiceValue}
                            onChange={(e) => setNewChoiceValue(e.target.value)}
                            hint="The stored value (lowercase, no spaces)"
                          />
                          <Input
                            label="Label"
                            placeholder="e.g., Active"
                            value={newChoiceLabel}
                            onChange={(e) => setNewChoiceLabel(e.target.value)}
                            hint="The display label (optional)"
                          />
                          <Button
                            variant="primary"
                            onClick={addChoice}
                            disabled={!newChoiceValue.trim()}
                            leftIcon={<Plus className="h-4 w-4" />}
                            className="w-full"
                          >
                            Add Option
                          </Button>
                        </div>
                      </Card>

                      {/* Existing choices */}
                      <div>
                        <h4 className="text-sm font-medium mb-4" style={{ color: 'var(--hw-text)' }}>
                          Current Options ({choices.length})
                        </h4>
                        {choices.length === 0 ? (
                          <div
                            className="flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed"
                            style={{ borderColor: 'var(--hw-border-subtle)' }}
                          >
                            <List className="h-8 w-8 mb-2" style={{ color: 'var(--hw-text-muted)' }} />
                            <p className="text-sm" style={{ color: 'var(--hw-text-muted)' }}>
                              No options added yet
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-[300px] overflow-auto">
                            {choices.map((choice, index) => (
                              <div
                                key={index}
                                className="flex items-center gap-3 p-3 rounded-lg"
                                style={{ backgroundColor: 'var(--hw-bg-subtle)' }}
                              >
                                <GripVertical className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--hw-text-muted)' }} />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium" style={{ color: 'var(--hw-text)' }}>
                                    {choice.label}
                                  </div>
                                  <code className="text-xs" style={{ color: 'var(--hw-text-muted)' }}>
                                    {choice.value}
                                  </code>
                                </div>
                                <button
                                  onClick={() => removeChoice(index)}
                                  className="p-2 rounded-lg hover:bg-red-100 transition-colors"
                                  style={{ color: '#ef4444' }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Reference Table Configuration */}
                {currentTypeInfo.needsConfig === 'reference' && (
                  <div>
                    <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--hw-text)' }}>
                      Reference Configuration
                    </h3>
                    <p className="text-sm mb-6" style={{ color: 'var(--hw-text-muted)' }}>
                      Configure the table relationship for this reference field
                    </p>

                    <div className="max-w-xl">
                      <Card variant="default" padding="lg">
                        <div className="space-y-4">
                          <div>
                            <label
                              className="block text-sm font-medium mb-2"
                              style={{ color: 'var(--hw-text)' }}
                            >
                              Target Table
                            </label>
                            <select
                              value={referenceTable}
                              onChange={(e) => setReferenceTable(e.target.value)}
                              className="w-full px-4 py-3 rounded-lg border text-sm"
                              style={{
                                backgroundColor: 'var(--hw-bg)',
                                borderColor: 'var(--hw-border)',
                                color: 'var(--hw-text)',
                              }}
                            >
                              <option value="">Select a table...</option>
                              {tables.map((t) => (
                                <option key={t.code} value={t.code}>
                                  {t.label} ({t.code})
                                </option>
                              ))}
                            </select>
                            <p className="text-xs mt-2" style={{ color: 'var(--hw-text-muted)' }}>
                              The table that this field will reference
                            </p>
                          </div>

                          {referenceTable && (
                            <div
                              className="flex items-center gap-3 p-3 rounded-lg"
                              style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)' }}
                            >
                              <Check className="h-5 w-5" style={{ color: '#22c55e' }} />
                              <span className="text-sm font-medium" style={{ color: '#22c55e' }}>
                                Linked to: {tables.find(t => t.code === referenceTable)?.label || referenceTable}
                              </span>
                            </div>
                          )}
                        </div>
                      </Card>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Type-Specific Info */}
            {renderTypeSpecificConfig()}
          </div>
        );

      case 'validation':
        return (
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--hw-text)' }}>
                Validation Rules
              </h3>
              <p className="text-sm mb-6" style={{ color: 'var(--hw-text-muted)' }}>
                Define constraints and validation rules for this field
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Core Validation */}
                <Card variant="default" padding="lg">
                  <h4 className="text-sm font-semibold mb-4" style={{ color: 'var(--hw-text)' }}>
                    Core Validation
                  </h4>
                  <div className="space-y-4">
                    {/* Required */}
                    <label className="flex items-center gap-4 cursor-pointer p-3 rounded-lg hover:bg-slate-50/50 transition-colors">
                      <div
                        className="p-2 rounded-lg"
                        style={{ backgroundColor: required ? 'rgba(239, 68, 68, 0.1)' : 'var(--hw-bg-subtle)' }}
                      >
                        <AlertCircle
                          className="h-5 w-5"
                          style={{ color: required ? '#ef4444' : 'var(--hw-text-muted)' }}
                        />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium" style={{ color: 'var(--hw-text)' }}>
                          Required Field
                        </div>
                        <div className="text-xs" style={{ color: 'var(--hw-text-muted)' }}>
                          Users must provide a value
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={required}
                        onChange={(e) => setRequired(e.target.checked)}
                        className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </label>

                    {/* Unique */}
                    <label className="flex items-center gap-4 cursor-pointer p-3 rounded-lg hover:bg-slate-50/50 transition-colors">
                      <div
                        className="p-2 rounded-lg"
                        style={{ backgroundColor: isUnique ? 'rgba(139, 92, 246, 0.1)' : 'var(--hw-bg-subtle)' }}
                      >
                        <Fingerprint
                          className="h-5 w-5"
                          style={{ color: isUnique ? '#8b5cf6' : 'var(--hw-text-muted)' }}
                        />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium" style={{ color: 'var(--hw-text)' }}>
                          Unique Values
                        </div>
                        <div className="text-xs" style={{ color: 'var(--hw-text-muted)' }}>
                          No two records can share this value
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={isUnique}
                        onChange={(e) => setIsUnique(e.target.checked)}
                        className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </label>
                  </div>
                </Card>

                {/* Type-specific validation preview */}
                <Card variant="default" padding="lg">
                  <h4 className="text-sm font-semibold mb-4" style={{ color: 'var(--hw-text)' }}>
                    Type-Specific Constraints
                  </h4>
                  <div className="space-y-3">
                    {['string', 'text', 'rich_text', 'email', 'phone', 'url'].includes(type) && (
                      <>
                        <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--hw-bg-subtle)' }}>
                          <span className="text-sm" style={{ color: 'var(--hw-text)' }}>Min Length</span>
                          <span className="text-sm font-mono" style={{ color: 'var(--hw-text-muted)' }}>
                            {config.minLength ?? 'Not set'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--hw-bg-subtle)' }}>
                          <span className="text-sm" style={{ color: 'var(--hw-text)' }}>Max Length</span>
                          <span className="text-sm font-mono" style={{ color: 'var(--hw-text-muted)' }}>
                            {config.maxLength ?? 'Not set'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--hw-bg-subtle)' }}>
                          <span className="text-sm" style={{ color: 'var(--hw-text)' }}>Regex Pattern</span>
                          <span className="text-sm font-mono" style={{ color: 'var(--hw-text-muted)' }}>
                            {config.pattern ? 'Configured' : 'Not set'}
                          </span>
                        </div>
                      </>
                    )}
                    {['integer', 'long', 'decimal', 'number', 'currency', 'percent'].includes(type) && (
                      <>
                        <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--hw-bg-subtle)' }}>
                          <span className="text-sm" style={{ color: 'var(--hw-text)' }}>Min Value</span>
                          <span className="text-sm font-mono" style={{ color: 'var(--hw-text-muted)' }}>
                            {config.minValue ?? 'Not set'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--hw-bg-subtle)' }}>
                          <span className="text-sm" style={{ color: 'var(--hw-text)' }}>Max Value</span>
                          <span className="text-sm font-mono" style={{ color: 'var(--hw-text-muted)' }}>
                            {config.maxValue ?? 'Not set'}
                          </span>
                        </div>
                      </>
                    )}
                    {config.checkExpression && (
                      <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--hw-bg-subtle)' }}>
                        <span className="text-sm" style={{ color: 'var(--hw-text)' }}>Check Constraint</span>
                        <span className="text-sm font-mono" style={{ color: '#22c55e' }}>Configured</span>
                      </div>
                    )}
                    <p className="text-xs mt-2" style={{ color: 'var(--hw-text-muted)' }}>
                      Configure detailed constraints in the Advanced tab
                    </p>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        );

      case 'advanced':
        return (
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--hw-text)' }}>
                Advanced PostgreSQL Options
              </h3>
              <p className="text-sm mb-6" style={{ color: 'var(--hw-text-muted)' }}>
                Configure database-level constraints and optimizations
              </p>

              <AdvancedOptionsSection
                config={config}
                setConfig={setConfig}
                type={type}
                isEdit={isEdit}
              />
            </div>
          </div>
        );

      case 'display':
        return (
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--hw-text)' }}>
                Display Settings
              </h3>
              <p className="text-sm mb-6" style={{ color: 'var(--hw-text-muted)' }}>
                Control how and where this field appears in the application
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Visibility Settings */}
                <Card variant="default" padding="lg">
                  <h4 className="text-sm font-semibold mb-4" style={{ color: 'var(--hw-text)' }}>
                    Visibility
                  </h4>
                  <div className="space-y-4">
                    {/* Show in Lists */}
                    <label className="flex items-center gap-4 cursor-pointer p-3 rounded-lg hover:bg-slate-50/50 transition-colors">
                      <div
                        className="p-2 rounded-lg"
                        style={{ backgroundColor: showInLists ? 'rgba(34, 197, 94, 0.1)' : 'var(--hw-bg-subtle)' }}
                      >
                        {showInLists ? (
                          <Eye className="h-5 w-5" style={{ color: '#22c55e' }} />
                        ) : (
                          <EyeOff className="h-5 w-5" style={{ color: 'var(--hw-text-muted)' }} />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium" style={{ color: 'var(--hw-text)' }}>
                          Show in List Views
                        </div>
                        <div className="text-xs" style={{ color: 'var(--hw-text-muted)' }}>
                          Display as a column in table lists
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={showInLists}
                        onChange={(e) => setShowInLists(e.target.checked)}
                        className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </label>

                    {/* Show in Forms */}
                    <label className="flex items-center gap-4 cursor-pointer p-3 rounded-lg hover:bg-slate-50/50 transition-colors">
                      <div
                        className="p-2 rounded-lg"
                        style={{ backgroundColor: showInForms ? 'rgba(34, 197, 94, 0.1)' : 'var(--hw-bg-subtle)' }}
                      >
                        {showInForms ? (
                          <FileText className="h-5 w-5" style={{ color: '#22c55e' }} />
                        ) : (
                          <EyeOff className="h-5 w-5" style={{ color: 'var(--hw-text-muted)' }} />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium" style={{ color: 'var(--hw-text)' }}>
                          Show in Forms
                        </div>
                        <div className="text-xs" style={{ color: 'var(--hw-text-muted)' }}>
                          Display in create and edit forms
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={showInForms}
                        onChange={(e) => setShowInForms(e.target.checked)}
                        className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </label>

                    {/* Internal Field */}
                    <label className="flex items-center gap-4 cursor-pointer p-3 rounded-lg hover:bg-slate-50/50 transition-colors">
                      <div
                        className="p-2 rounded-lg"
                        style={{ backgroundColor: isInternal ? 'rgba(239, 68, 68, 0.1)' : 'var(--hw-bg-subtle)' }}
                      >
                        <Lock
                          className="h-5 w-5"
                          style={{ color: isInternal ? '#ef4444' : 'var(--hw-text-muted)' }}
                        />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium" style={{ color: 'var(--hw-text)' }}>
                          Internal Field
                        </div>
                        <div className="text-xs" style={{ color: 'var(--hw-text-muted)' }}>
                          Hidden from tenant users, admin only
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={isInternal}
                        onChange={(e) => setIsInternal(e.target.checked)}
                        className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </label>
                  </div>
                </Card>

                {/* UI Configuration */}
                <Card variant="default" padding="lg">
                  <h4 className="text-sm font-semibold mb-4" style={{ color: 'var(--hw-text)' }}>
                    UI Configuration
                  </h4>
                  <div className="space-y-4">
                    <Input
                      label="Placeholder Text"
                      placeholder="Enter value..."
                      value={config.placeholder ?? ''}
                      onChange={(e) => setConfig({ ...config, placeholder: e.target.value || undefined })}
                      hint="Text shown when field is empty"
                    />
                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--hw-text)' }}>
                        Help Text
                      </label>
                      <textarea
                        value={config.helpText ?? ''}
                        onChange={(e) => setConfig({ ...config, helpText: e.target.value || undefined })}
                        className="w-full px-3 py-2 rounded-lg border text-sm"
                        style={{ backgroundColor: 'var(--hw-bg)', borderColor: 'var(--hw-border)', color: 'var(--hw-text)' }}
                        placeholder="Helpful description for users..."
                        rows={3}
                      />
                      <p className="text-xs mt-1" style={{ color: 'var(--hw-text-muted)' }}>
                        Appears below the field to guide users
                      </p>
                    </div>
                    <Input
                      label="Display Format"
                      placeholder="###-###-#### (for phone)"
                      value={config.format ?? ''}
                      onChange={(e) => setConfig({ ...config, format: e.target.value || undefined })}
                      hint="Format pattern for display (not validation)"
                    />
                  </div>
                </Card>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative flex flex-col w-full h-full max-w-6xl max-h-[90vh] m-4 rounded-2xl shadow-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--hw-bg)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
          style={{ borderColor: 'var(--hw-border-subtle)' }}
        >
          <div className="flex items-center gap-4">
            <div
              className="p-3 rounded-xl"
              style={{ backgroundColor: `${currentTypeInfo.color}15` }}
            >
              <div style={{ color: currentTypeInfo.color }}>
                {currentTypeInfo.icon}
              </div>
            </div>
            <div>
              <h2 className="text-xl font-semibold" style={{ color: 'var(--hw-text)' }}>
                {isEdit ? 'Edit Field' : 'Create New Field'}
              </h2>
              <p className="text-sm" style={{ color: 'var(--hw-text-muted)' }}>
                {tableCode}{label ? ` • ${label}` : ''}{isEdit && field ? ` (${field.code})` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => void handleSave()}
              loading={saving}
            >
              {isEdit ? 'Save Changes' : 'Create Field'}
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div
          className="flex items-center gap-1 px-6 py-2 border-b overflow-x-auto flex-shrink-0"
          style={{ borderColor: 'var(--hw-border-subtle)', backgroundColor: 'var(--hw-bg-subtle)' }}
        >
          {editorTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap
                ${activeTab === tab.id
                  ? 'bg-white shadow-sm'
                  : 'hover:bg-white/50'
                }
              `}
              style={{
                color: activeTab === tab.id ? 'var(--hw-primary)' : 'var(--hw-text-muted)',
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <div className="px-6 pt-4 flex-shrink-0">
            <Card variant="default" padding="sm" className="border-red-200 bg-red-50/50">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            </Card>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto px-6 py-6">
          {renderTabContent()}
        </div>

        {/* Footer - Navigation Only */}
        <div
          className="flex items-center justify-between px-6 py-3 border-t flex-shrink-0"
          style={{ borderColor: 'var(--hw-border-subtle)', backgroundColor: 'var(--hw-bg-subtle)' }}
        >
          <div>
            {activeTab !== 'basics' && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const currentIndex = editorTabs.findIndex(t => t.id === activeTab);
                  if (currentIndex > 0) {
                    setActiveTab(editorTabs[currentIndex - 1].id);
                  }
                }}
              >
                ← Previous
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--hw-text-muted)' }}>
            <span>{editorTabs.findIndex(t => t.id === activeTab) + 1}</span>
            <span>/</span>
            <span>{editorTabs.length}</span>
          </div>
          <div>
            {activeTab !== 'display' && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const currentIndex = editorTabs.findIndex(t => t.id === activeTab);
                  if (currentIndex < editorTabs.length - 1) {
                    setActiveTab(editorTabs[currentIndex + 1].id);
                  }
                }}
              >
                Next →
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
