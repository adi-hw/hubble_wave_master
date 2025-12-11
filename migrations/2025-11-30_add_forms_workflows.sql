-- Forms
CREATE TABLE IF NOT EXISTS form_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT NULL,
  "currentVersion" INT NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_form_slug UNIQUE ("tenantId", slug)
);

CREATE TABLE IF NOT EXISTS form_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "formId" UUID NOT NULL REFERENCES form_definitions(id) ON DELETE CASCADE,
  version INT NOT NULL,
  schema JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  "createdBy" UUID NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Workflows
CREATE TABLE IF NOT EXISTS workflow_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT NULL,
  "triggerType" TEXT NOT NULL DEFAULT 'manual',
  "triggerConfig" JSONB NOT NULL DEFAULT '{}',
  steps JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_workflow_slug UNIQUE ("tenantId", slug)
);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "workflowId" UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued',
  input JSONB NULL,
  output JSONB NULL,
  error TEXT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "startedAt" TIMESTAMPTZ NULL,
  "finishedAt" TIMESTAMPTZ NULL
);
