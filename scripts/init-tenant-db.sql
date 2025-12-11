-- Initializes per-tenant database schema for dynamic tables/data/forms/workflows.
-- Run against each tenant database, e.g.:
--   createdb -h localhost -U admin eam_tenant_acme
--   psql -h localhost -U admin -d eam_tenant_acme -f scripts/init-tenant-db.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS data_objects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "tableName" TEXT NOT NULL,
  attributes JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_data_objects_table ON data_objects("tableName");

CREATE TABLE IF NOT EXISTS modules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT NULL,
  route TEXT NULL,
  icon TEXT NULL,
  category TEXT NULL,
  "sortOrder" INT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_modules_slug UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS form_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "tenantId" UUID NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT NULL,
  "currentVersion" INT NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_form_definitions_tenant_slug UNIQUE ("tenantId", slug)
);

CREATE TABLE IF NOT EXISTS form_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "formId" UUID NOT NULL REFERENCES form_definitions(id) ON DELETE CASCADE,
  version INT NOT NULL,
  schema JSONB NOT NULL DEFAULT '{}',
  status VARCHAR NOT NULL DEFAULT 'draft',
  "createdBy" UUID NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "tenantId" UUID NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT NULL,
  "triggerType" VARCHAR NOT NULL DEFAULT 'manual',
  "triggerConfig" JSONB NOT NULL DEFAULT '{}',
  steps JSONB NOT NULL DEFAULT '[]',
  status VARCHAR NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_workflow_definitions_tenant_slug UNIQUE ("tenantId", slug)
);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "workflowId" UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  status VARCHAR NOT NULL DEFAULT 'queued',
  input JSONB NULL,
  output JSONB NULL,
  error TEXT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "startedAt" TIMESTAMPTZ NULL,
  "finishedAt" TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS model_field_type (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  category TEXT NOT NULL,
  backend_type TEXT NOT NULL,
  ui_widget TEXT NOT NULL,
  description TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  validators JSONB NOT NULL DEFAULT '{}',
  storage_config JSONB NOT NULL DEFAULT '{}',
  flags JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS model_table (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  category TEXT NOT NULL,
  storage_schema TEXT NOT NULL DEFAULT 'public',
  storage_table TEXT NOT NULL,
  extends_table_id UUID NULL REFERENCES model_table(id),
  flags JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS model_field (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_id UUID NOT NULL REFERENCES model_table(id) ON DELETE CASCADE,
  field_type_id UUID NOT NULL REFERENCES model_field_type(id),
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  nullable BOOLEAN NOT NULL DEFAULT TRUE,
  is_unique BOOLEAN NOT NULL DEFAULT FALSE,
  default_value TEXT NULL,
  storage_path TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_model_field_table_code UNIQUE (table_id, code)
);

CREATE TABLE IF NOT EXISTS model_form_layout (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "tableId" UUID NOT NULL REFERENCES model_table(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  layout JSONB NOT NULL,
  CONSTRAINT uq_model_form_layout_table_name UNIQUE ("tableId", name)
);
CREATE INDEX IF NOT EXISTS idx_model_form_layout_table ON model_form_layout("tableId");

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "tableName" TEXT NOT NULL,
  "recordId" TEXT NOT NULL,
  action TEXT NOT NULL,
  diff JSONB NULL,
  "performedBy" TEXT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_table ON audit_log("tableName");
CREATE INDEX IF NOT EXISTS idx_audit_log_record ON audit_log("recordId");
