const { Client } = require('pg');

async function createAppAsset() {
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

    console.log('Creating app_asset table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_asset (
        id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        serial_number   text,
        status          text,
        location_id     uuid,
        custom_data     jsonb NOT NULL DEFAULT '{}',
        created_at      timestamptz DEFAULT now(),
        updated_at      timestamptz DEFAULT now()
      );
    `);

    console.log('✅ app_asset table created successfully!');

  } catch (error) {
    console.error('❌ Error creating app_asset:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

createAppAsset();
