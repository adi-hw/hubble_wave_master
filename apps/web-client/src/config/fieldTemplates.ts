export interface FieldTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  defaults: {
    fieldType: string;
    validators?: any;
    config?: any;
    storageType?: 'column' | 'json';
  };
}

export const FIELD_TEMPLATES: FieldTemplate[] = [
  {
    id: 'email',
    name: 'Email Address',
    icon: '📧',
    description: 'Email with validation',
    defaults: {
      fieldType: 'string',
      validators: {
        pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
        maxLength: 255,
      },
      config: {
        widget: 'email',
        placeholder: 'user@example.com',
      },
      storageType: 'json',
    },
  },
  {
    id: 'phone',
    name: 'Phone Number',
    icon: '📱',
    description: 'Phone number with formatting',
    defaults: {
      fieldType: 'string',
      validators: {
        pattern: '^[0-9+\\-\\(\\)\\s]+$',
        minLength: 10,
        maxLength: 20,
      },
      config: {
        widget: 'tel',
        placeholder: '+1 (555) 123-4567',
      },
      storageType: 'json',
    },
  },
  {
    id: 'currency',
    name: 'Currency Amount',
    icon: '💰',
    description: 'Monetary value with decimal precision',
    defaults: {
      fieldType: 'integer',
      validators: {
        min: 0,
      },
      config: {
        widget: 'currency',
        currency: 'USD',
        decimals: 2,
      },
      storageType: 'json',
    },
  },
  {
    id: 'url',
    name: 'URL/Website',
    icon: '🔗',
    description: 'Web address with validation',
    defaults: {
      fieldType: 'string',
      validators: {
        pattern: '^https?:\\/\\/(www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b',
        maxLength: 500,
      },
      config: {
        widget: 'url',
        placeholder: 'https://example.com',
      },
      storageType: 'json',
    },
  },
  {
    id: 'percentage',
    name: 'Percentage',
    icon: '📊',
    description: 'Percentage value (0-100)',
    defaults: {
      fieldType: 'integer',
      validators: {
        min: 0,
        max: 100,
      },
      config: {
        widget: 'percentage',
        suffix: '%',
      },
      storageType: 'json',
    },
  },
  {
    id: 'date_of_birth',
    name: 'Date of Birth',
    icon: '🎂',
    description: 'Birth date with age validation',
    defaults: {
      fieldType: 'date',
      validators: {
        maxDate: 'today',
        minDate: '1900-01-01',
      },
      config: {
        widget: 'date',
        placeholder: 'MM/DD/YYYY',
      },
      storageType: 'json',
    },
  },
];
