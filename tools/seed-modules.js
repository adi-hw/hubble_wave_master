/**
 * Seed baseline modules (Tables, Users, Groups) into the tenant modules table.
 */
const { Client } = require('pg');
require('dotenv').config();

const TENANT_DB = process.env.DB_NAME || process.env.TENANT_DB_NAME || 'eam_tenant_acme';
const client = new Client({
  host: process.env.TENANT_DB_HOST || 'localhost',
  port: parseInt(process.env.TENANT_DB_PORT || '5432', 10),
  user: process.env.TENANT_DB_USER || 'admin',
  password: process.env.TENANT_DB_PASSWORD || 'password',
  database: TENANT_DB,
});

const MODULES = [
  { name: 'Tables', slug: 'tables', route: '/ui/tables', icon: 'Table2', category: 'Platform', sortOrder: 10 },
  { name: 'Users', slug: 'users', route: '/ui/users', icon: 'Users', category: 'Platform', sortOrder: 20 },
  { name: 'Groups', slug: 'groups', route: '/ui/groups', icon: 'UserCog', category: 'Platform', sortOrder: 30 },
];

async function main() {
  await client.connect();
  console.log(`Connected to ${TENANT_DB}`);

for (const m of MODULES) {
  await client.query(
    `
      INSERT INTO modules (name, slug, route, icon, category, "sortOrder")
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        route = EXCLUDED.route,
        icon = EXCLUDED.icon,
        category = EXCLUDED.category,
        "sortOrder" = EXCLUDED."sortOrder"
    `,
      [m.name, m.slug, m.route, m.icon, m.category, m.sortOrder]
    );
    console.log(`Upserted module ${m.slug}`);
  }

  await client.end();
  console.log('Done seeding modules');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
