-- Tenant theme table for design tokens
CREATE TABLE IF NOT EXISTS tenant_theme (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text,
  tokens jsonb NOT NULL DEFAULT '{}'::jsonb,
  nav_variant text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

CREATE INDEX IF NOT EXISTS idx_tenant_theme_tenant ON tenant_theme (tenant_id);

-- Navigation profile tables
CREATE TABLE IF NOT EXISTS nav_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nav_profile_tenant ON nav_profile (tenant_id, is_default);

CREATE TABLE IF NOT EXISTS nav_profile_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES nav_profile(id) ON DELETE CASCADE,
  code text NOT NULL,
  label text,
  section text,
  "order" int NOT NULL DEFAULT 999,
  visible boolean NOT NULL DEFAULT true,
  pinned boolean NOT NULL DEFAULT false,
  icon text
);

CREATE INDEX IF NOT EXISTS idx_nav_profile_item_profile ON nav_profile_item (profile_id);

-- Mark a single default profile per tenant (optional enforcement)
CREATE UNIQUE INDEX IF NOT EXISTS uq_nav_profile_default_per_tenant
  ON nav_profile (tenant_id, is_default)
  WHERE is_default = true;
