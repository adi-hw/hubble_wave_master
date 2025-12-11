/**
 * Adds alias entries to model_table and copies fields from a base table.
 * Currently seeds:
 *  - alias "users" -> storage_table "user_accounts"
 *  - alias "tables" -> storage_table "model_table"
 */
const { Client } = require('pg');
require('dotenv').config();

const TENANT_DB = process.env.DB_NAME || process.env.TENANT_DB_NAME || 'eam_tenant_acme';
const DB_CONFIG = {
  host: process.env.TENANT_DB_HOST || 'localhost',
  port: parseInt(process.env.TENANT_DB_PORT || '5432', 10),
  user: process.env.TENANT_DB_USER || 'admin',
  password: process.env.TENANT_DB_PASSWORD || 'password',
  database: TENANT_DB,
};

async function upsertUsersAlias(client) {
  const c = new Client(DB_CONFIG);
  await c.connect();
  console.log(`Connected to ${TENANT_DB}`);

  const base = await c.query('SELECT * FROM model_table WHERE code = $1', ['user_accounts']);
  if (!base.rows.length) {
    console.warn('Base model_table "user_accounts" not found; skipping alias');
    await c.end();
    return;
  }
  const baseTable = base.rows[0];

  let alias = await c.query('SELECT * FROM model_table WHERE code = $1', ['users']);
  if (!alias.rows.length) {
    const insert = await c.query(
      `INSERT INTO model_table (code, label, category, storage_schema, storage_table, extends_table_id, flags)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        'users',
        'Users',
        baseTable.category || 'system',
        baseTable.storage_schema || 'public',
        baseTable.storage_table || 'user_accounts',
        baseTable.extends_table_id || null,
        baseTable.flags || {},
      ]
    );
    alias = { rows: insert.rows };
    console.log('Created model_table alias "users" pointing to user_accounts');
  } else {
    console.log('Alias model_table "users" already exists');
  }

  const aliasId = alias.rows[0].id;
  const existingFields = await c.query('SELECT code FROM model_field WHERE table_id = $1', [aliasId]);
  const existingCodes = new Set(existingFields.rows.map((r) => r.code));

  const baseFields = await c.query('SELECT * FROM model_field WHERE table_id = $1', [baseTable.id]);
  let copied = 0;
  for (const f of baseFields.rows) {
    if (existingCodes.has(f.code)) continue;
    await c.query(
      `INSERT INTO model_field (table_id, field_type_id, code, label, nullable, is_unique, default_value, storage_path, config, display_order, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now())
       ON CONFLICT DO NOTHING`,
      [
        aliasId,
        f.field_type_id,
        f.code,
        f.label,
        f.nullable,
        f.is_unique,
        f.default_value,
        f.storage_path,
        f.config || {},
        f.display_order || 0,
      ]
    );
    copied++;
  }
  console.log(`Copied ${copied} fields to alias "users"`);

  await c.end();
  console.log('Done seeding aliases');
}

async function upsertTablesAlias(client) {
  const c = new Client(DB_CONFIG);
  await c.connect();
  console.log(`Connected to ${TENANT_DB}`);

  const base = await c.query('SELECT * FROM model_table WHERE code = $1', ['model_table']);
  if (!base.rows.length) {
    console.warn('Base model_table "model_table" not found; skipping alias');
    await c.end();
    return;
  }
  const baseTable = base.rows[0];

  let alias = await c.query('SELECT * FROM model_table WHERE code = $1', ['tables']);
  if (!alias.rows.length) {
    const insert = await c.query(
      `INSERT INTO model_table (code, label, category, storage_schema, storage_table, extends_table_id, flags)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        'tables',
        'Tables',
        baseTable.category || 'system',
        baseTable.storage_schema || 'public',
        baseTable.storage_table || 'model_table',
        baseTable.extends_table_id || null,
        baseTable.flags || {},
      ]
    );
    alias = { rows: insert.rows };
    console.log('Created model_table alias "tables" pointing to model_table');
  } else {
    console.log('Alias model_table "tables" already exists');
  }

  const aliasId = alias.rows[0].id;
  const existingFields = await c.query('SELECT code FROM model_field WHERE table_id = $1', [aliasId]);
  const existingCodes = new Set(existingFields.rows.map((r) => r.code));

  const baseFields = await c.query('SELECT * FROM model_field WHERE table_id = $1', [baseTable.id]);
  let copied = 0;
  for (const f of baseFields.rows) {
    if (existingCodes.has(f.code)) continue;
    await c.query(
      `INSERT INTO model_field (table_id, field_type_id, code, label, nullable, is_unique, default_value, storage_path, config, display_order, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now())
       ON CONFLICT DO NOTHING`,
      [
        aliasId,
        f.field_type_id,
        f.code,
        f.label,
        f.nullable,
        f.is_unique,
        f.default_value,
        f.storage_path,
        f.config || {},
        f.display_order || 0,
      ]
    );
    copied++;
  }
  console.log(`Copied ${copied} fields to alias "tables"`);

  await c.end();
}

async function main() {
  await upsertUsersAlias();
  await upsertTablesAlias();
  console.log('Done seeding aliases');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
