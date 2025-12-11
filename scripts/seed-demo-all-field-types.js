const { Client } = require('pg');
const { randomUUID } = require('crypto');

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'eam_tenant_acme',
});

async function main() {
  await client.connect();
  const now = new Date();
  const guid = randomUUID();
  const values = {
    string: 'Hello world',
    text: 'This is a longer block of text to exercise the long text field.',
    rich_text: '<p><strong>Rich</strong> text demo</p>',
    boolean: true,
    integer: 42,
    long: 9876543210,
    decimal: 123.456,
    currency: 99.99,
    percent: 75.5,
    date: '2025-01-01',
    datetime: now.toISOString(),
    time: '12:34:56',
    duration: 'PT1H30M',
    choice: 'option_a',
    multi_choice: JSON.stringify(['option_b', 'option_c']),
    tags: JSON.stringify(['alpha', 'beta']),
    reference: null,
    multi_reference: null,
    user_reference: null,
    json: { demo: true, note: 'json field' },
    key_value: { key1: 'value1', key2: 'value2' },
    file: null,
    image: null,
    email: 'demo@example.com',
    phone: '+1-555-0100',
    url: 'https://example.com',
    ip_address: '192.168.1.10',
    color: '#3366ff',
    auto_number: 'DEMO-0001',
    guid,
    password_hashed: '$2b$10$dummyhashforseed',
    secret_encrypted: 'encrypted-secret-placeholder',
    formula: '1 + 1',
    condition: '{"rule":true}',
    workflow_stage: 'stage-1',
    translated_string: 'Hello',
    translated_rich_text: '<p>Bonjour</p>',
    geo_point: { lat: 12.34, lng: 56.78 },
    location_reference: null,
    domain_scope: null,
  };

  const cols = Object.keys(values);
  const placeholders = cols.map((_, idx) => `$${idx + 1}`);
  const params = cols.map((c) => values[c]);

  const sql = `INSERT INTO demo_all_types (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders.join(
    ', ',
  )}) RETURNING id`;

  const { rows } = await client.query(sql, params);
  console.log('Inserted demo record with id:', rows[0].id);
  await client.end();
}

main().catch((err) => {
  console.error('Failed to seed demo_all_types:', err);
  process.exit(1);
});
