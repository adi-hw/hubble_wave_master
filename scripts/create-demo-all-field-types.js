const { Client } = require('pg');

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'eam_tenant_acme',
});

const TABLE_CODE = 'demo_all_types';
const TABLE_LABEL = 'Demo: All Field Types';
const STORAGE_TABLE = 'demo_all_types';

// Order drives display_order in model_field and column creation
const FIELD_CODES = [
  'string',
  'text',
  'rich_text',
  'boolean',
  'integer',
  'long',
  'decimal',
  'currency',
  'percent',
  'date',
  'datetime',
  'time',
  'duration',
  'choice',
  'multi_choice',
  'tags',
  'reference',
  'multi_reference',
  'user_reference',
  'json',
  'key_value',
  'file',
  'image',
  'email',
  'phone',
  'url',
  'ip_address',
  'color',
  'auto_number',
  'guid',
  'password_hashed',
  'secret_encrypted',
  'formula',
  'condition',
  'workflow_stage',
  'translated_string',
  'translated_rich_text',
  'geo_point',
  'location_reference',
  'domain_scope',
];

const typeMap = (backendType) => {
  switch (backendType) {
    case 'text':
      return 'text';
    case 'integer':
      return 'integer';
    case 'bigint':
      return 'bigint';
    case 'decimal':
    case 'numeric':
      return 'numeric(18,6)';
    case 'boolean':
      return 'boolean';
    case 'date':
      return 'date';
    case 'time':
      return 'time';
    case 'timestamp':
    case 'timestamptz':
      return 'timestamptz';
    case 'json':
    case 'jsonb':
      return 'jsonb';
    case 'bytea':
      return 'bytea';
    default:
      return 'text';
  }
};

async function main() {
  await client.connect();
  const tx = client;
  try {
    console.log('Loading field types...');
    const { rows: fieldTypes } = await tx.query('SELECT id, code, backend_type FROM model_field_type');
    const byCode = Object.fromEntries(fieldTypes.map((f) => [f.code, f]));

    // Build columns SQL
    const columns = [`id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`];
    FIELD_CODES.forEach((code) => {
      const ft = byCode[code];
      if (!ft) return;
      const colType = typeMap(ft.backend_type);
      columns.push(`"${code}" ${colType}`);
    });

    console.log('Creating storage table...');
    await tx.query(`DROP TABLE IF EXISTS "${STORAGE_TABLE}" CASCADE`);
    await tx.query(`CREATE TABLE "${STORAGE_TABLE}" (${columns.join(',\n  ')})`);

    console.log('Upserting model_table...');
    const { rows: tableRows } = await tx.query(
      `
      INSERT INTO model_table (code, label, category, storage_schema, storage_table, flags)
      VALUES ($1, $2, 'demo', 'public', $3, '{}'::jsonb)
      ON CONFLICT (code) DO UPDATE
        SET label = EXCLUDED.label,
            category = EXCLUDED.category,
            storage_schema = EXCLUDED.storage_schema,
            storage_table = EXCLUDED.storage_table,
            updated_at = now()
      RETURNING id;
    `,
      [TABLE_CODE, TABLE_LABEL, STORAGE_TABLE],
    );
    const tableId = tableRows[0].id;

    console.log('Upserting model_field rows...');
    let order = 1;
    for (const code of FIELD_CODES) {
      const ft = byCode[code];
      if (!ft) {
        console.warn(`Skipping missing field type ${code}`);
        continue;
      }
      await tx.query(
        `
        INSERT INTO model_field (table_id, field_type_id, code, label, nullable, is_unique, storage_path, display_order)
        VALUES ($1, $2, $3, $4, true, false, $5, $6)
        ON CONFLICT (table_id, code) DO UPDATE
          SET field_type_id = EXCLUDED.field_type_id,
              label = EXCLUDED.label,
              nullable = EXCLUDED.nullable,
              is_unique = EXCLUDED.is_unique,
              storage_path = EXCLUDED.storage_path,
              display_order = EXCLUDED.display_order,
              updated_at = now();
      `,
        [tableId, ft.id, code, ft.label || code, `column:${code}`, order],
      );
      order += 1;
    }

    console.log('Done. Table created:', STORAGE_TABLE);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Failed to create demo all-field-types table:', err);
  process.exit(1);
});
// @deprecated: superseded by seed-demo-all-field-types.js; safe to delete after 2025-01-01
