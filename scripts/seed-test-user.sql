-- Create test tenant
INSERT INTO tenants (id, name, slug, status, "createdAt", "updatedAt")
VALUES ('11111111-1111-1111-1111-111111111111', 'Test Company', 'test', 'ACTIVE', NOW(), NOW())
ON CONFLICT (slug) DO NOTHING;

-- Create admin role
INSERT INTO roles (id, name, description, "tenantId", "createdAt", "updatedAt")
VALUES ('22222222-2222-2222-2222-222222222222', 'admin', 'Administrator role', '11111111-1111-1111-1111-111111111111', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Create admin user (password is "Admin123!" hashed with argon2id)
INSERT INTO user_accounts (id, username, email, "displayName", "authSource", "passwordHash", "tenantId", status, "emailVerified", "failedLoginCount", "createdAt", "updatedAt")
VALUES (
  '33333333-3333-3333-3333-333333333333',
  'admin',
  'admin@test.com',
  'Admin User',
  'LOCAL',
  '$argon2id$v=19$m=65536,t=3,p=4$18eaN4xMMMsRmXuOaEcTpQ$QaBb2snf6LT0ntx7t7WP9L8I1oCGUxsQ4N4T4B0gHjA',
  '11111111-1111-1111-1111-111111111111',
  'ACTIVE',
  true,
  0,
  NOW(),
  NOW()
)
ON CONFLICT ("tenantId", username) DO NOTHING;

-- Assign admin role to user
INSERT INTO user_role_assignments (id, "userId", "roleId")
VALUES ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222')
ON CONFLICT DO NOTHING;
-- @deprecated: replaced by TypeScript seeder (seed-test-user.ts); safe to delete after 2025-01-01
