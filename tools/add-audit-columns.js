/**
 * Ensures all model_table storage tables have created_at/updated_at columns.
 * Also cleans up missing/legacy table_definitions catalog entry.
 */
const { Client } = require('pg');
require('dotenv').config();

const TENANT_DB = process.env.DB_NAME || process.env.TENANT_DB_NAME || 'eam_tenant_acme';
const cfg = {
  host: process.env.TENANT_DB_HOST || 'localhost',
  port: parseInt(process.env.TENANT_DB_PORT || '5432', 10),
  user: process.env.TENANT_DB_USER || 'admin',
  password: process.env.TENANT_DB_PASSWORD || 'password',
  database: TENANT_DB,
};

async function main() {
  const c = new Client(cfg);
  await c.connect();
  console.log(`Connected to ${TENANT_DB}`);

  // Drop stale catalog row for table_definitions (table is gone)
  await c.query(`DELETE FROM model_table WHERE storage_table = 'table_definitions'`);

  const tables = await c.query('SELECT code, storage_schema, storage_table FROM model_table');
  for (const t of tables.rows) {
    const schema = t.storage_schema || 'public';
    const table = t.storage_table;
    for (const col of ['created_at', 'updated_at']) {
      const sql = `ALTER TABLE "${schema}"."${table}" ADD COLUMN IF NOT EXISTS ${col} TIMESTAMPTZ NOT NULL DEFAULT now()`;
      try {
        await c.query(sql);
        console.log('OK', table, col);
      } catch (e) {
        console.error('ERR', table, col, e.message);
      }
    }
  }

  await c.end();
  console.log('Audit columns ensured for all model tables');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
