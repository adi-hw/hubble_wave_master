-- RBAC: groups
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NULL,
  name TEXT NOT NULL,
  description TEXT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_groups_tenant_name UNIQUE ("tenantId", name)
);

-- RBAC: user_groups
CREATE TABLE IF NOT EXISTS user_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  "groupId" UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_groups UNIQUE ("userId", "groupId")
);

-- RBAC: group_roles
CREATE TABLE IF NOT EXISTS group_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "groupId" UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  "roleId" UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_group_roles UNIQUE ("groupId", "roleId")
);

-- ABAC policies
CREATE TABLE IF NOT EXISTS abac_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NULL,
  name TEXT NOT NULL,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  effect TEXT NOT NULL DEFAULT 'allow',
  conditions JSONB NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_abac_policies_tenant_resource_action
  ON abac_policies("tenantId", resource, action);

-- Config settings (system/tenant/app)
CREATE TABLE IF NOT EXISTS config_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL, -- system | tenant | app
  "tenantId" UUID NULL,
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  type TEXT NOT NULL, -- string | boolean | number | json | list
  value JSONB NOT NULL,
  version INT NOT NULL DEFAULT 1,
  "createdBy" UUID NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_config_settings UNIQUE (scope, "tenantId", key)
);
CREATE INDEX IF NOT EXISTS idx_config_settings_scope_tenant
  ON config_settings(scope, "tenantId");
