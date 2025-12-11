const { Client } = require('pg');

async function seedFieldTypes() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'admin',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'eam_global',
  });

  try {
    await client.connect();
    console.log('✅ Database connection established');

    const types = [
      { code: 'string', label: 'String', category: 'primitive', backend_type: 'text', ui_widget: 'text', validators: { max_length: 255 } },
      { code: 'integer', label: 'Integer', category: 'primitive', backend_type: 'int', ui_widget: 'number', validators: { min: 0 } },
      { code: 'boolean', label: 'Boolean', category: 'primitive', backend_type: 'boolean', ui_widget: 'checkbox', validators: {} },
      { code: 'date', label: 'Date', category: 'primitive', backend_type: 'date', ui_widget: 'date', validators: {} },
      { code: 'datetime', label: 'DateTime', category: 'primitive', backend_type: 'timestamp', ui_widget: 'datetime', validators: {} },
      { code: 'choice', label: 'Choice', category: 'choice', backend_type: 'text', ui_widget: 'dropdown', validators: {} },
      { code: 'reference', label: 'Reference', category: 'reference', backend_type: 'uuid', ui_widget: 'reference', validators: {}, flags: { is_reference: true } },
      { code: 'json', label: 'JSON', category: 'custom', backend_type: 'jsonb', ui_widget: 'json', validators: {} },
    ];

    for (const t of types) {
      await client.query(`
        INSERT INTO model_field_type (
          id, code, label, category, backend_type, ui_widget, validators, storage_config, flags
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, '{}', $7
        )
        ON CONFLICT (code) DO UPDATE SET
          label = EXCLUDED.label,
          category = EXCLUDED.category,
          backend_type = EXCLUDED.backend_type,
          ui_widget = EXCLUDED.ui_widget,
          validators = EXCLUDED.validators,
          flags = EXCLUDED.flags,
          updated_at = now();
      `, [t.code, t.label, t.category, t.backend_type, t.ui_widget, t.validators, t.flags || {}]);
      console.log(`✅ Seeded type: ${t.code}`);
    }

    console.log('✅ All field types seeded successfully!');

  } catch (error) {
    console.error('❌ Error seeding types:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seedFieldTypes();
