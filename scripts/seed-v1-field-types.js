const { Client } = require('pg');

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'eam_tenant_acme',
});

const FIELD_TYPES = [
  // 1.1 Scalar & text types
  {
    code: 'string',
    label: 'Short Text',
    category: 'primitive',
    backend_type: 'text',
    ui_widget: 'text',
    description: 'Short text (up to ~255 chars)',
    is_active: true,
  },
  {
    code: 'text',
    label: 'Long Text',
    category: 'content',
    backend_type: 'text',
    ui_widget: 'textarea',
    description: 'Multi-line text field for descriptions and notes',
    is_active: true,
  },
  {
    code: 'rich_text',
    label: 'Rich Text (HTML)',
    category: 'content',
    backend_type: 'text',
    ui_widget: 'richtext',
    description: 'WYSIWYG HTML editor',
    is_active: true,
  },
  {
    code: 'boolean',
    label: 'Boolean',
    category: 'primitive',
    backend_type: 'boolean',
    ui_widget: 'checkbox',
    description: 'True/false flag',
    is_active: true,
  },
  {
    code: 'integer',
    label: 'Integer',
    category: 'primitive',
    backend_type: 'integer',
    ui_widget: 'number',
    description: 'Standard 32-bit integer',
    is_active: true,
  },
  {
    code: 'long',
    label: 'Long Integer',
    category: 'primitive',
    backend_type: 'bigint',
    ui_widget: 'number',
    description: 'Large integer values (64-bit)',
    is_active: true,
  },
  {
    code: 'decimal',
    label: 'Decimal',
    category: 'primitive',
    backend_type: 'decimal',
    ui_widget: 'number',
    description: 'High-precision decimal number',
    is_active: true,
  },
  {
    code: 'currency',
    label: 'Currency',
    category: 'primitive',
    backend_type: 'decimal',
    ui_widget: 'currency',
    description: 'Monetary value with currency code',
    is_active: true,
  },
  {
    code: 'percent',
    label: 'Percentage',
    category: 'primitive',
    backend_type: 'decimal',
    ui_widget: 'percent',
    description: 'Percentage value (0-100)',
    is_active: true,
  },

  // 1.2 Time & date types
  {
    code: 'date',
    label: 'Date',
    category: 'primitive',
    backend_type: 'date',
    ui_widget: 'date',
    description: 'Calendar date',
    is_active: true,
  },
  {
    code: 'datetime',
    label: 'Date/Time',
    category: 'primitive',
    backend_type: 'timestamp',
    ui_widget: 'datetime',
    description: 'Date and time',
    is_active: true,
  },
  {
    code: 'time',
    label: 'Time',
    category: 'primitive',
    backend_type: 'time',
    ui_widget: 'time',
    description: 'Time of day (HH:mm:ss)',
    is_active: true,
  },
  {
    code: 'duration',
    label: 'Duration',
    category: 'primitive',
    backend_type: 'text', // ISO 8601 duration string
    ui_widget: 'duration',
    description: 'Time span or duration',
    is_active: true,
  },

  // 1.3 Choice & list types
  {
    code: 'choice',
    label: 'Choice',
    category: 'choice',
    backend_type: 'text',
    ui_widget: 'dropdown',
    description: 'Single select from a fixed list',
    is_active: true,
  },
  {
    code: 'multi_choice',
    label: 'Multiple Choice',
    category: 'choice',
    backend_type: 'jsonb',
    ui_widget: 'multiselect',
    description: 'Select multiple options from a list',
    is_active: true,
  },
  {
    code: 'tags',
    label: 'Tags',
    category: 'choice',
    backend_type: 'jsonb',
    ui_widget: 'tags',
    description: 'Free-form tagging',
    is_active: true,
  },

  // 1.4 Reference & relationship types
  {
    code: 'reference',
    label: 'Reference',
    category: 'reference',
    backend_type: 'uuid',
    ui_widget: 'reference',
    description: 'Link to a single record in another table',
    is_active: true,
  },
  {
    code: 'multi_reference',
    label: 'Multiple Reference',
    category: 'reference',
    backend_type: 'jsonb',
    ui_widget: 'multireference',
    description: 'Link to multiple records in another table',
    is_active: true,
  },
  {
    code: 'user_reference',
    label: 'User',
    category: 'reference',
    backend_type: 'uuid',
    ui_widget: 'userpicker',
    description: 'Link to a system user',
    is_active: true,
  },
  {
    code: 'group_reference',
    label: 'Group',
    category: 'reference',
    backend_type: 'uuid',
    ui_widget: 'grouppicker',
    description: 'Link to a group/role entity',
    is_active: true,
  },

  // 1.5 Structured & JSON types
  {
    code: 'json',
    label: 'JSON',
    category: 'structured',
    backend_type: 'jsonb',
    ui_widget: 'json',
    description: 'Arbitrary JSON blob',
    is_active: true,
  },
  {
    code: 'key_value',
    label: 'Key/Value Map',
    category: 'structured',
    backend_type: 'jsonb',
    ui_widget: 'keyvalue',
    description: 'Simple map of key-value pairs',
    is_active: true,
  },

  // 1.6 Files & media
  {
    code: 'file',
    label: 'File Attachment',
    category: 'content',
    backend_type: 'jsonb', // Stores {id, name, url, size, type}
    ui_widget: 'file',
    description: 'Upload a file attachment',
    is_active: true,
  },
  {
    code: 'image',
    label: 'Image',
    category: 'content',
    backend_type: 'jsonb',
    ui_widget: 'image',
    description: 'Upload an image with preview',
    is_active: true,
  },

  // 1.7 Communication & links
  {
    code: 'email',
    label: 'Email',
    category: 'communication',
    backend_type: 'text',
    ui_widget: 'email',
    description: 'Email address with validation',
    is_active: true,
  },
  {
    code: 'phone',
    label: 'Phone',
    category: 'communication',
    backend_type: 'text',
    ui_widget: 'phone',
    description: 'Phone number with formatting',
    is_active: true,
  },
  {
    code: 'url',
    label: 'URL',
    category: 'communication',
    backend_type: 'text',
    ui_widget: 'url',
    description: 'Web link/URL',
    is_active: true,
  },
  {
    code: 'ip_address',
    label: 'IP Address',
    category: 'communication',
    backend_type: 'text',
    ui_widget: 'ip',
    description: 'IPv4/IPv6 address',
    is_active: true,
  },
  {
    code: 'color',
    label: 'Color',
    category: 'communication',
    backend_type: 'text',
    ui_widget: 'color',
    description: 'CSS color value with preview',
    is_active: true,
  },

  // 1.8 Security / identity / special
  {
    code: 'auto_number',
    label: 'Auto Number',
    category: 'security',
    backend_type: 'text',
    ui_widget: 'readonly',
    description: 'System-generated unique identifier',
    is_active: true,
  },
  {
    code: 'guid',
    label: 'GUID',
    category: 'security',
    backend_type: 'uuid',
    ui_widget: 'readonly',
    description: 'Globally Unique Identifier',
    is_active: true,
  },
  {
    code: 'password_hashed',
    label: 'Password (Hashed)',
    category: 'security',
    backend_type: 'text',
    ui_widget: 'password',
    description: 'One-way hashed password',
    is_active: true,
  },
  {
    code: 'secret_encrypted',
    label: 'Secret (Encrypted)',
    category: 'security',
    backend_type: 'text',
    ui_widget: 'secret',
    description: 'Encrypted secret or API token',
    is_active: true,
  },
  {
    code: 'domain_scope',
    label: 'Domain Scope',
    category: 'security',
    backend_type: 'text',
    ui_widget: 'domain',
    description: 'Domain/partition identifier for domain separation',
    is_active: true,
  },

  // 1.9 Workflow / calculation / dynamic
  {
    code: 'formula',
    label: 'Formula',
    category: 'workflow',
    backend_type: 'text',
    ui_widget: 'computed',
    description: 'Computed value defined by an expression',
    is_active: true,
  },
  {
    code: 'condition',
    label: 'Condition',
    category: 'workflow',
    backend_type: 'jsonb',
    ui_widget: 'condition-builder',
    description: 'Serialized condition for rules/workflows',
    is_active: true,
  },
  {
    code: 'workflow_stage',
    label: 'Workflow Stage',
    category: 'workflow',
    backend_type: 'text',
    ui_widget: 'stage',
    description: 'Stage/progress indicator for flows',
    is_active: true,
  },

  // 1.10 Localization
  {
    code: 'translated_string',
    label: 'Translated String',
    category: 'i18n',
    backend_type: 'text',
    ui_widget: 'i18n-string',
    description: 'String with localized variants',
    is_active: true,
  },
  {
    code: 'translated_rich_text',
    label: 'Translated Rich Text',
    category: 'i18n',
    backend_type: 'text',
    ui_widget: 'i18n-richtext',
    description: 'Rich text with localized variants',
    is_active: true,
  },

  // 1.11 Geo & location
  {
    code: 'geo_point',
    label: 'Geo Point',
    category: 'location',
    backend_type: 'jsonb',
    ui_widget: 'geopoint',
    description: 'Latitude/longitude pair',
    is_active: true,
  },
  {
    code: 'location_reference',
    label: 'Location Reference',
    category: 'location',
    backend_type: 'uuid',
    ui_widget: 'locationpicker',
    description: 'Reference to a location record',
    is_active: true,
  },
];

async function seed() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Ensure newer columns exist for older schemas
    await client.query('ALTER TABLE model_field_type ADD COLUMN IF NOT EXISTS description TEXT;');
    await client.query('ALTER TABLE model_field_type ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;');

    for (const type of FIELD_TYPES) {
      const query = `
        INSERT INTO model_field_type (
          code, label, category, backend_type, ui_widget, description, is_active
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7
        )
        ON CONFLICT (code) DO UPDATE SET
          label = EXCLUDED.label,
          category = EXCLUDED.category,
          backend_type = EXCLUDED.backend_type,
          ui_widget = EXCLUDED.ui_widget,
          description = EXCLUDED.description,
          is_active = EXCLUDED.is_active;
      `;

      await client.query(query, [
        type.code,
        type.label,
        type.category,
        type.backend_type,
        type.ui_widget,
        type.description,
        type.is_active,
      ]);

      console.log(`Seeded field type: ${type.code}`);
    }

    console.log('Done seeding field types');
  } catch (err) {
    console.error('Error seeding field types:', err);
  } finally {
    await client.end();
  }
}

seed();
// @deprecated: legacy PoC for v1 metadata field types; safe to delete after 2025-01-01
