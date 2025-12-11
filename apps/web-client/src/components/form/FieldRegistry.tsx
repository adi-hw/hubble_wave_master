import React from 'react';
import type { FieldComponentProps } from './types';
import { TextInputField } from './fields/TextInputField';
import { TextAreaField } from './fields/TextAreaField';
import { JsonField } from './fields/JsonField';
import { CheckboxField } from './fields/CheckboxField';
import { NumberField } from './fields/NumberField';
import { ChoiceField } from './fields/ChoiceField';
import { MultiChoiceField } from './fields/MultiChoiceField';
import { ReferenceField } from './fields/ReferenceField';
import { MultiReferenceField } from './fields/MultiReferenceField';
import { UserPickerField } from './fields/UserPickerField';
import { GroupPickerField } from './fields/GroupPickerField';
import { DateField } from './fields/DateField';
import { DateTimeField } from './fields/DateTimeField';
import { TimeField } from './fields/TimeField';
import { DurationField } from './fields/DurationField';
import { RichTextField } from './fields/RichTextField';
import { FileField } from './fields/FileField';
import { ColorField } from './fields/ColorField';
import { IpAddressField } from './fields/IpAddressField';
import { MacAddressField } from './fields/MacAddressField';
import { KeyValueField } from './fields/KeyValueField';
import { ReadOnlyField } from './fields/ReadOnlyField';
import { NotImplementedField } from './fields/NotImplementedField';

type FieldRenderer = React.FC<FieldComponentProps<any>>;

/**
 * Complete field type registry mapping all 45 field types to their renderers.
 * Organized by category for maintainability.
 */
const registry: Record<string, FieldRenderer> = {
  // ═══════════════════════════════════════════════════════════════════════════
  // TEXT TYPES
  // ═══════════════════════════════════════════════════════════════════════════
  string: TextInputField,
  text: TextAreaField,
  rich_text: RichTextField,

  // ═══════════════════════════════════════════════════════════════════════════
  // NUMERIC TYPES
  // ═══════════════════════════════════════════════════════════════════════════
  integer: NumberField,
  long: NumberField,
  decimal: NumberField,
  number: NumberField,
  currency: NumberField,
  percent: NumberField,

  // ═══════════════════════════════════════════════════════════════════════════
  // BOOLEAN
  // ═══════════════════════════════════════════════════════════════════════════
  boolean: CheckboxField,

  // ═══════════════════════════════════════════════════════════════════════════
  // DATE & TIME TYPES
  // ═══════════════════════════════════════════════════════════════════════════
  date: DateField,
  datetime: DateTimeField,
  time: TimeField,
  duration: DurationField,

  // ═══════════════════════════════════════════════════════════════════════════
  // CHOICE TYPES
  // ═══════════════════════════════════════════════════════════════════════════
  choice: ChoiceField,
  multi_choice: MultiChoiceField,
  tags: MultiChoiceField,

  // ═══════════════════════════════════════════════════════════════════════════
  // REFERENCE TYPES
  // ═══════════════════════════════════════════════════════════════════════════
  reference: ReferenceField,
  multi_reference: MultiReferenceField,
  user_reference: UserPickerField,
  group_reference: GroupPickerField,

  // ═══════════════════════════════════════════════════════════════════════════
  // MEDIA TYPES
  // ═══════════════════════════════════════════════════════════════════════════
  file: FileField,
  image: FileField,
  audio: FileField,
  video: FileField,

  // ═══════════════════════════════════════════════════════════════════════════
  // COMMUNICATION TYPES
  // ═══════════════════════════════════════════════════════════════════════════
  email: TextInputField,
  phone: TextInputField,
  url: TextInputField,
  ip_address: IpAddressField,
  mac_address: MacAddressField,
  color: ColorField,

  // ═══════════════════════════════════════════════════════════════════════════
  // STRUCTURED TYPES
  // ═══════════════════════════════════════════════════════════════════════════
  json: JsonField,
  key_value: KeyValueField,

  // ═══════════════════════════════════════════════════════════════════════════
  // IDENTITY TYPES (Read-only / Auto-generated)
  // ═══════════════════════════════════════════════════════════════════════════
  auto_number: ReadOnlyField,
  guid: ReadOnlyField,

  // ═══════════════════════════════════════════════════════════════════════════
  // SECURITY TYPES (Read-only / Encrypted)
  // ═══════════════════════════════════════════════════════════════════════════
  password_hashed: ReadOnlyField,
  secret_encrypted: ReadOnlyField,
  domain_scope: ReadOnlyField,

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPUTED TYPES (Read-only / Calculated)
  // ═══════════════════════════════════════════════════════════════════════════
  formula: ReadOnlyField,
  condition: ReadOnlyField,
  script_ref: ReadOnlyField,

  // ═══════════════════════════════════════════════════════════════════════════
  // WORKFLOW TYPE
  // ═══════════════════════════════════════════════════════════════════════════
  workflow_stage: ReadOnlyField,

  // ═══════════════════════════════════════════════════════════════════════════
  // LOCALIZATION TYPES
  // ═══════════════════════════════════════════════════════════════════════════
  translated_string: ReadOnlyField,
  translated_rich_text: ReadOnlyField,

  // ═══════════════════════════════════════════════════════════════════════════
  // LOCATION TYPES
  // ═══════════════════════════════════════════════════════════════════════════
  geo_point: ReadOnlyField,
  location_reference: ReferenceField,
};

export const resolveFieldRenderer = (fieldType: string): FieldRenderer =>
  registry[fieldType] ?? NotImplementedField;
