const { Client } = require('pg');
require('dotenv').config();

async function seedTenantData() {
  console.log('🌱 Seeding acme tenant navigation data (Safe Mode)...\n');

  const client = new Client({
    host: process.env.TENANT_DB_HOST || process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.TENANT_DB_PORT || process.env.DB_PORT || '5432'),
    user: process.env.TENANT_DB_USER || process.env.DB_USER || 'admin',
    password: process.env.TENANT_DB_PASSWORD || process.env.DB_PASSWORD || 'password',
    database: 'eam_tenant_acme',
  });

  try {
    await client.connect();
    console.log('✓ Connected to tenant DB');

    // 1. Create Default Profile
    const profileSlug = 'default';
    let profileId;
    
    const profileRes = await client.query(
      `SELECT id FROM tenant_nav_profiles WHERE slug = $1`,
      [profileSlug]
    );

    if (profileRes.rows.length === 0) {
      const insertRes = await client.query(
        `INSERT INTO tenant_nav_profiles (slug, name, is_default, is_active, priority, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         RETURNING id`,
        [profileSlug, 'Default Profile', true, true, 0]
      );
      profileId = insertRes.rows[0].id;
      console.log('✓ Created Default Profile');
    } else {
      profileId = profileRes.rows[0].id;
      console.log('✓ Default Profile exists');
    }

    // 2. Create Modules
    const modules = [
      { key: 'eam.dashboard', label: 'Dashboard', type: 'dashboard', icon: 'dashboard', route: '/dashboard', applicationKey: 'eam' },
      { key: 'eam.assets', label: 'Assets', type: 'list', icon: 'inventory_2', route: '/assets', applicationKey: 'eam' },
      { key: 'eam.work_orders', label: 'Work Orders', type: 'list', icon: 'assignment', route: '/work-orders', applicationKey: 'eam' },
      { key: 'admin.settings', label: 'Settings', type: 'list', icon: 'settings', route: '/settings', applicationKey: 'admin' },
    ];

    for (const mod of modules) {
      const safeSlug = mod.key.replace(/[^a-z0-9]+/gi, '-');
      const safeName = `${mod.label} (${mod.key})`;

      const modRes = await client.query('SELECT id FROM modules WHERE key = $1', [mod.key]);
      
      if (modRes.rows.length === 0) {
        await client.query(
          `INSERT INTO modules (key, name, slug, label, type, icon, application_key, target_config, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
          [
            mod.key,
            safeName,
            safeSlug,
            mod.label,
            mod.type,
            mod.icon,
            mod.applicationKey,
            { route: mod.route, applicationKey: mod.applicationKey },
            true,
          ]
        );
      } else {
        // Ensure required legacy fields are populated
        await client.query(
          `UPDATE modules
             SET name = COALESCE(name, $2),
                 slug = COALESCE(slug, $3),
                 label = COALESCE(label, $4),
                 application_key = COALESCE(application_key, $5),
                 target_config = COALESCE(target_config, $6),
                 icon = COALESCE(icon, $7)
           WHERE key = $1`,
          [
            mod.key,
            safeName,
            safeSlug,
            mod.label,
            mod.applicationKey,
            { route: mod.route, applicationKey: mod.applicationKey },
            mod.icon,
          ]
        );
      }
    }
    console.log('✓ Modules ensured');

    // 3. Create Nav Items (Idempotent: Delete all for this profile and recreate)
    // This is safe because we just created/verified the profile
    await client.query('DELETE FROM tenant_nav_profile_items WHERE nav_profile_id = $1', [profileId]);

    const items = [
      { label: 'Dashboard', type: 'MODULE', moduleKey: 'eam.dashboard', order: 10 },
      { label: 'Assets', type: 'MODULE', moduleKey: 'eam.assets', order: 20 },
      { label: 'Work Orders', type: 'MODULE', moduleKey: 'eam.work_orders', order: 30 },
      { label: 'System', type: 'GROUP', order: 90, key: 'group.system' },
    ];

    for (const item of items) {
      const itemRes = await client.query(
        `INSERT INTO tenant_nav_profile_items (nav_profile_id, label, type, module_key, "order", is_visible, key, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         RETURNING id`,
        [profileId, item.label, item.type, item.moduleKey, item.order, true, item.key || item.label.toLowerCase()]
      );
      
      if (item.type === 'GROUP' && item.label === 'System') {
          const parentId = itemRes.rows[0].id;
          await client.query(
            `INSERT INTO tenant_nav_profile_items (nav_profile_id, parent_id, label, type, module_key, "order", is_visible, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
            [profileId, parentId, 'Settings', 'MODULE', 'admin.settings', 10, true]
          );
      }
    }
    console.log('✓ Navigation items recreated');

  } catch (err) {
    console.error('❌ Error seeding tenant data:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seedTenantData();
