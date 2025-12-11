const { Client } = require('pg');

async function createPlatformTables() {
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

    // 1. model_field_type
    console.log('Creating model_field_type table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS model_field_type (
        id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code           text UNIQUE NOT NULL,
        label          text NOT NULL,
        category       text NOT NULL,
        backend_type   text NOT NULL,
        ui_widget      text NOT NULL,
        validators     jsonb DEFAULT '{}',
        storage_config jsonb DEFAULT '{}',
        flags          jsonb DEFAULT '{}',
        created_at     timestamptz DEFAULT now(),
        updated_at     timestamptz DEFAULT now()
      );
    `);

    // 2. model_table
    console.log('Creating model_table table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS model_table (
        id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code           text UNIQUE NOT NULL,
        label          text NOT NULL,
        category       text NOT NULL,
        storage_schema text NOT NULL DEFAULT 'public',
        storage_table  text NOT NULL,
        extends_table_id uuid REFERENCES model_table(id),
        flags          jsonb NOT NULL DEFAULT '{}',
        created_at     timestamptz DEFAULT now(),
        updated_at     timestamptz DEFAULT now()
      );
    `);

    // 3. model_field
    console.log('Creating model_field table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS model_field (
        id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        table_id       uuid REFERENCES model_table(id) NOT NULL,
        field_type_id  uuid REFERENCES model_field_type(id) NOT NULL,
        code           text NOT NULL,
        label          text NOT NULL,
        nullable       boolean NOT NULL DEFAULT true,
        is_unique      boolean NOT NULL DEFAULT false,
        default_value  text,
        storage_path   text NOT NULL,
        config         jsonb NOT NULL DEFAULT '{}',
        display_order  integer DEFAULT 0,
        created_at     timestamptz DEFAULT now(),
        updated_at     timestamptz DEFAULT now(),
        UNIQUE(table_id, code)
      );
    `);

    console.log('✅ Platform tables created successfully!');

  } catch (error) {
    console.error('❌ Error creating tables:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

createPlatformTables();
