-- Seed tenant and admin if not present (Acme)
INSERT INTO tenants (id, name, slug, status, "createdAt", "updatedAt")
VALUES ('4db337a2-d4a6-48e5-ad7a-51439a075678', 'Acme Corp', 'acme', 'ACTIVE', NOW(), NOW())
ON CONFLICT (slug) DO NOTHING;

-- Roles with permissions
INSERT INTO roles (id, name, description, "tenantId", permissions, "createdAt", "updatedAt")
VALUES 
  ('22222222-2222-2222-2222-222222222222', 'admin', 'Full access', '4db337a2-d4a6-48e5-ad7a-51439a075678', 'manage:*', NOW(), NOW()),
  ('22222222-2222-2222-2222-222222222223', 'viewer', 'Read-only access', '4db337a2-d4a6-48e5-ad7a-51439a075678', 'read:*', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Groups
INSERT INTO groups (id, "tenantId", name, description, "createdAt", "updatedAt")
VALUES 
  ('33333333-3333-3333-3333-333333333333', '4db337a2-d4a6-48e5-ad7a-51439a075678', 'Admins', 'Admin group', NOW(), NOW()),
  ('33333333-3333-3333-3333-333333333334', '4db337a2-d4a6-48e5-ad7a-51439a075678', 'Viewers', 'Viewer group', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Users (argon2 hashed password "Admin123!")
INSERT INTO user_accounts (id, username, email, "displayName", "authSource", "passwordHash", "tenantId", status, "emailVerified", "failedLoginCount", "createdAt", "updatedAt")
VALUES (
  'edb4a1a2-28f1-4cc4-acbb-087cb9d4eed6',
  'admin',
  'admin@acme.com',
  'Admin User',
  'LOCAL',
  '$argon2id$v=19$m=65536,t=3,p=4$aQp1P/Oc9QyvoeGHgxAZ4Q$Mn88sHCseP52t1yrPu4vCRZnBDJuKFASrKo3kuwOHfA',
  '4db337a2-d4a6-48e5-ad7a-51439a075678',
  'ACTIVE',
  true,
  0,
  NOW(),
  NOW()
)
ON CONFLICT ("tenantId", username) DO NOTHING;

-- Group membership
INSERT INTO user_groups (id, "userId", "groupId", "createdAt")
VALUES 
  ('55555555-5555-5555-5555-555555555555', 'edb4a1a2-28f1-4cc4-acbb-087cb9d4eed6', '33333333-3333-3333-3333-333333333333', NOW())
ON CONFLICT DO NOTHING;

-- Group → role assignments
INSERT INTO group_roles (id, "groupId", "roleId", "createdAt")
VALUES 
  ('66666666-6666-6666-6666-666666666666', '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', NOW())
ON CONFLICT DO NOTHING;

-- Direct user → role assignment (optional)
INSERT INTO user_role_assignments (id, "userId", "roleId")
VALUES ('77777777-7777-7777-7777-777777777777', 'edb4a1a2-28f1-4cc4-acbb-087cb9d4eed6', '22222222-2222-2222-2222-222222222222')
ON CONFLICT DO NOTHING;

-- ABAC policy example: allow read on resource "asset" for tenant users
INSERT INTO abac_policies (id, "tenantId", name, resource, action, effect, conditions, "createdAt", "updatedAt")
VALUES (
  '88888888-8888-8888-8888-888888888888',
  '4db337a2-d4a6-48e5-ad7a-51439a075678',
  'Tenant assets read',
  'asset',
  'read',
  'allow',
  '{"equals": {"tenantId": "4db337a2-d4a6-48e5-ad7a-51439a075678"}}',
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING;

-- ABAC policies for admin access to RBAC and Config (tenant scope)
INSERT INTO abac_policies (id, "tenantId", name, resource, action, effect, conditions, "createdAt", "updatedAt")
VALUES 
  ('88888888-8888-8888-8888-888888888889', '4db337a2-d4a6-48e5-ad7a-51439a075678', 'RBAC read', 'rbac', 'read', 'allow', '{"equals": {"tenantId": "4db337a2-d4a6-48e5-ad7a-51439a075678"}}', NOW(), NOW()),
  ('88888888-8888-8888-8888-888888888890', '4db337a2-d4a6-48e5-ad7a-51439a075678', 'RBAC update', 'rbac', 'update', 'allow', '{"equals": {"tenantId": "4db337a2-d4a6-48e5-ad7a-51439a075678"}}', NOW(), NOW()),
  ('88888888-8888-8888-8888-888888888891', '4db337a2-d4a6-48e5-ad7a-51439a075678', 'Config read', 'config', 'read', 'allow', '{"equals": {"tenantId": "4db337a2-d4a6-48e5-ad7a-51439a075678"}}', NOW(), NOW()),
  ('88888888-8888-8888-8888-888888888892', '4db337a2-d4a6-48e5-ad7a-51439a075678', 'Config update', 'config', 'update', 'allow', '{"equals": {"tenantId": "4db337a2-d4a6-48e5-ad7a-51439a075678"}}', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Config examples
INSERT INTO config_settings (id, scope, "tenantId", category, key, type, value, version, "createdBy", "createdAt", "updatedAt")
VALUES 
  ('99999999-9999-9999-9999-999999999999', 'system', NULL, 'Security', 'password_min_length', 'number', '8', 1, NULL, NOW(), NOW()),
  ('99999999-9999-9999-9999-999999999998', 'tenant', '4db337a2-d4a6-48e5-ad7a-51439a075678', 'Email', 'support_email', 'string', '"support@test.com"', 1, NULL, NOW(), NOW())
ON CONFLICT DO NOTHING;
