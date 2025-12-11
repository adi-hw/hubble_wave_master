const { Client } = require('pg');

async function seedAssetMetadata() {
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

    // 1. Create Model Table
    console.log('Seeding model_table for asset...');
    const tableResult = await client.query(`
      INSERT INTO model_table (
        id, code, label, category, storage_schema, storage_table, flags
      ) VALUES (
        gen_random_uuid(), 'asset', 'Asset', 'application', 'public', 'app_asset', '{"extendable": true}'
      )
      ON CONFLICT (code) DO UPDATE SET
        label = EXCLUDED.label,
        storage_table = EXCLUDED.storage_table
      RETURNING id;
    `);
    const tableId = tableResult.rows[0].id;

    // 2. Get Field Type IDs
    const typesRes = await client.query('SELECT code, id FROM model_field_type');
    const types = {};
    typesRes.rows.forEach(r => types[r.code] = r.id);

    // 3. Create Model Fields
    const fields = [
      { code: 'serial_number', label: 'Serial Number', type: 'string', storage: 'column:serial_number', nullable: true },
      { code: 'status', label: 'Status', type: 'choice', storage: 'column:status', nullable: true, config: { choices: [{ value: 'active', label: 'Active' }, { value: 'retired', label: 'Retired' }] } },
      { code: 'location', label: 'Location', type: 'reference', storage: 'column:location_id', nullable: true },
      { code: 'u_modality', label: 'Modality', type: 'string', storage: 'json:custom_data.u_modality', nullable: true, config: { widget: 'dropdown', choices: [{ value: 'CT', label: 'CT' }, { value: 'MRI', label: 'MRI' }] } },
    ];

    for (const f of fields) {
      await client.query(`
        INSERT INTO model_field (
          id, table_id, field_type_id, code, label, nullable, storage_path, config
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7
        )
        ON CONFLICT (table_id, code) DO UPDATE SET
          label = EXCLUDED.label,
          nullable = EXCLUDED.nullable,
          storage_path = EXCLUDED.storage_path,
          config = EXCLUDED.config;
      `, [tableId, types[f.type], f.code, f.label, f.nullable, f.storage, f.config || {}]);
      console.log(`✅ Seeded field: ${f.code}`);
    }

    console.log('✅ Asset metadata seeded successfully!');

  } catch (error) {
    console.error('❌ Error seeding metadata:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seedAssetMetadata();
