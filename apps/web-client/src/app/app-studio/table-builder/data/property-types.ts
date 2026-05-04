import {
  AtSign,
  Calendar,
  CheckSquare,
  Clock,
  Code,
  DollarSign,
  FileText,
  Hash,
  Image,
  Link,
  List,
  type LucideIcon,
  Percent,
  Phone,
  Type,
  User,
} from 'lucide-react';

export interface PropertyTypeDefinition {
  /** Stable identifier persisted in PropertyDefinition.dataType. */
  value: string;
  /** Human label rendered in the type selector. */
  label: string;
  /** One-line hint shown beside the label. */
  description: string;
  icon: LucideIcon;
  /** CSS color used for the type swatch. */
  color: string;
}

/**
 * Canonical registry of property types the visual builders surface. The
 * value strings match what svc-metadata persists; backend-side seeded
 * type rows use the same codes (`text`, `choice`, `reference`, etc.).
 *
 * Computed types (`formula`, `rollup`, `lookup`, `hierarchical`) are
 * deliberately omitted from this registry — they are introduced by
 * Slice B3 once the computed-property executor lands (plan §6.5). Adding
 * them to the dropdown before the executor would surface non-functional
 * options.
 */
export const PROPERTY_TYPES: PropertyTypeDefinition[] = [
  {
    value: 'text',
    label: 'Single Line Text',
    description: 'Short text values like names or titles.',
    icon: Type,
    color: '#2196F3',
  },
  {
    value: 'long_text',
    label: 'Long Text',
    description: 'Multi-line text areas.',
    icon: FileText,
    color: '#2196F3',
  },
  {
    value: 'number',
    label: 'Number',
    description: 'Integers or decimals.',
    icon: Hash,
    color: '#4CAF50',
  },
  {
    value: 'currency',
    label: 'Currency',
    description: 'Monetary values.',
    icon: DollarSign,
    color: '#4CAF50',
  },
  {
    value: 'percentage',
    label: 'Percentage',
    description: 'Values between 0 and 100.',
    icon: Percent,
    color: '#4CAF50',
  },
  {
    value: 'date',
    label: 'Date',
    description: 'Calendar date.',
    icon: Calendar,
    color: '#9C27B0',
  },
  {
    value: 'datetime',
    label: 'Date & Time',
    description: 'Date with time component.',
    icon: Clock,
    color: '#9C27B0',
  },
  {
    value: 'checkbox',
    label: 'Checkbox',
    description: 'Boolean true / false.',
    icon: CheckSquare,
    color: '#FF9800',
  },
  {
    value: 'choice',
    label: 'Choice',
    description: 'Select one option from a list.',
    icon: List,
    color: '#FF9800',
  },
  {
    value: 'multi_choice',
    label: 'Multi Choice',
    description: 'Select multiple options from a list.',
    icon: List,
    color: '#FF9800',
  },
  {
    value: 'url',
    label: 'URL',
    description: 'Web link.',
    icon: Link,
    color: '#00BCD4',
  },
  {
    value: 'email',
    label: 'Email',
    description: 'Email address.',
    icon: AtSign,
    color: '#00BCD4',
  },
  {
    value: 'phone',
    label: 'Phone',
    description: 'Phone number.',
    icon: Phone,
    color: '#00BCD4',
  },
  {
    value: 'reference',
    label: 'Reference',
    description: 'Link to a record in another Collection.',
    icon: Link,
    color: '#795548',
  },
  {
    value: 'user',
    label: 'User',
    description: 'System user reference.',
    icon: User,
    color: '#607D8B',
  },
  {
    value: 'attachment',
    label: 'Attachment',
    description: 'Files and images.',
    icon: Image,
    color: '#F44336',
  },
  {
    value: 'json',
    label: 'JSON',
    description: 'Raw JSON document.',
    icon: Code,
    color: '#607D8B',
  },
];

const PROPERTY_TYPE_INDEX = new Map<string, PropertyTypeDefinition>(
  PROPERTY_TYPES.map((t) => [t.value, t]),
);

export const getPropertyType = (value: string | undefined): PropertyTypeDefinition | undefined =>
  value ? PROPERTY_TYPE_INDEX.get(value) : undefined;

export const propertyTypeLabel = (value: string | undefined): string =>
  getPropertyType(value)?.label ?? value ?? 'Unknown';
