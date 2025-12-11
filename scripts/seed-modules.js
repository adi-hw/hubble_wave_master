const { Client } = require('pg');

async function seedModules() {
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

    // Get acme tenant ID
    const tenantResult = await client.query(`SELECT id FROM tenants WHERE slug = 'acme' LIMIT 1`);
    if (tenantResult.rows.length === 0) {
      throw new Error('No tenant with slug "acme" found.');
    }
    const tenantId = tenantResult.rows[0].id;
    console.log(`✅ Found tenant: ${tenantId}`);

    // Define modules to seed
    const modules = [
      { name: 'Dashboard', slug: 'dashboard', route: '/', icon: 'Home', category: 'Core', sortOrder: 1 },
      { name: 'Studio', slug: 'studio', route: '/schema', icon: 'Table2', category: 'Core', sortOrder: 2 },
      { name: 'Analytics', slug: 'analytics', route: '/analytics', icon: 'BarChart3', category: 'Insights', sortOrder: 3 },
      { name: 'Assets', slug: 'assets', route: '/assets', icon: 'Package', category: 'Operations', sortOrder: 4 },
      { name: 'Maintenance', slug: 'maintenance', route: '/maintenance', icon: 'Wrench', category: 'Operations', sortOrder: 5 },
      { name: 'Users', slug: 'users', route: '/users', icon: 'Users', category: 'Admin', sortOrder: 6 },
      { name: 'Settings', slug: 'settings', route: '/settings', icon: 'Settings', category: 'Admin', sortOrder: 7 },
    ];

    // Insert modules
    for (const module of modules) {
      await client.query(
        `INSERT INTO modules (id, "tenantId", name, slug, route, icon, category, "sortOrder", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         ON CONFLICT ("tenantId", slug) DO UPDATE
         SET name = EXCLUDED.name, route = EXCLUDED.route, icon = EXCLUDED.icon, category = EXCLUDED.category, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = NOW()`,
        [tenantId, module.name, module.slug, module.route, module.icon, module.category, module.sortOrder]
      );
      console.log(`✅ Created/Updated module: ${module.name}`);
    }

    console.log('\n✅ All modules seeded successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seedModules();
