INSERT INTO modules (id, "tenantId", name, slug, description, route, icon, category, "sortOrder", "createdAt", "updatedAt")
VALUES 
  ('10101010-0000-0000-0000-000000000001', NULL, 'Tables', 'tables', 'Manage table definitions', '/tables', 'Table2', 'Platform', 1, NOW(), NOW()),
  ('10101010-0000-0000-0000-000000000002', '4db337a2-d4a6-48e5-ad7a-51439a075678', 'Users', 'users', 'Manage users', '/access-control', 'Users', 'Platform', 2, NOW(), NOW()),
  ('10101010-0000-0000-0000-000000000003', '4db337a2-d4a6-48e5-ad7a-51439a075678', 'Groups', 'groups', 'Manage groups', '/access-control', 'Users', 'Platform', 3, NOW(), NOW()),
  ('10101010-0000-0000-0000-000000000004', '4db337a2-d4a6-48e5-ad7a-51439a075678', 'Roles', 'roles', 'Manage roles and permissions', '/access-control', 'Shield', 'Platform', 4, NOW(), NOW())
ON CONFLICT ("tenantId", slug) DO NOTHING;
