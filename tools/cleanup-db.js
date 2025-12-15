const { Client } = require('pg');

async function cleanup() {
  console.log('Starting DB Cleanup...');

  // Configuration - Adjust if needed
  const config = {
    user: 'admin',      // Default from PlatformDbModule
    host: 'localhost',
    database: 'eam_tenant_acme', // Targeting Acme tenant
    password: 'password', // Default from PlatformDbModule
    port: 5432,
  };

  const client = new Client(config);

  try {
    await client.connect();
    console.log(`Connected to database: ${config.database}`);

    const queries = [
      // 1. Drop Illustrative Application Tables
      'DROP TABLE IF EXISTS app_assets CASCADE',
      'DROP TABLE IF EXISTS app_work_orders CASCADE',
      'DROP TABLE IF EXISTS app_technicians CASCADE',
      'DROP TABLE IF EXISTS app_inventory CASCADE',

      // 2. Drop Legacy Metadata Tables
      'DROP TABLE IF EXISTS model_table CASCADE',
      'DROP TABLE IF EXISTS model_field CASCADE',
      'DROP TABLE IF EXISTS model_field_type CASCADE',
      'DROP TABLE IF EXISTS model_form_layout CASCADE',
    ];

    for (const query of queries) {
        try {
            await client.query(query);
            console.log(`Executed: ${query}`);
        } catch (err) {
            console.error(`Error executing ${query}: ${err.message}`);
        }
    }

    console.log('Cleanup completed successfully.');

  } catch (err) {
    console.error('Connection error:', err.message);
    console.log('Ensure you have a tenant database named "eam_tenant_acme" reachable at localhost:5432 with user "admin" and password "password".');
  } finally {
    await client.end();
  }
}

cleanup();
