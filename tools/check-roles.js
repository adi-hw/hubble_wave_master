const { Client } = require('pg');

async function main() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'admin',
    password: 'password',
    database: 'eam_global',
  });

  await client.connect();

  const result = await client.query(`
    SELECT
      ua.primary_email,
      tum.is_tenant_admin,
      r.name as role_name,
      r.slug as role_slug
    FROM user_account ua
    JOIN tenant_user_membership tum ON tum.user_id = ua.id
    LEFT JOIN user_role_assignment ura ON ura.tenant_user_membership_id = tum.id
    LEFT JOIN role r ON r.id = ura.role_id
    WHERE ua.primary_email = 'admin@acme.com'
  `);

  console.log('User roles for admin@acme.com:');
  console.table(result.rows);

  await client.end();
}

main().catch(console.error);
