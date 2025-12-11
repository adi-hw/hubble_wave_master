-- Align user_role_assignments with entity definition
-- Adds missing tenantId column, backfills existing rows, and enforces FK/index

ALTER TABLE user_role_assignments
ADD COLUMN IF NOT EXISTS "tenantId" UUID;

-- Backfill from user_accounts
UPDATE user_role_assignments ura
SET "tenantId" = ua."tenantId"
FROM user_accounts ua
WHERE ura."userId" = ua.id
  AND ura."tenantId" IS NULL;

-- Fallback backfill from roles (in case user join is missing)
UPDATE user_role_assignments ura
SET "tenantId" = r."tenantId"
FROM roles r
WHERE ura."roleId" = r.id
  AND ura."tenantId" IS NULL;

-- Enforce not-null once populated
ALTER TABLE user_role_assignments
ALTER COLUMN "tenantId" SET NOT NULL;

-- Add FK (guarded for reruns)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_user_role_assignments_tenant'
      AND conrelid = 'user_role_assignments'::regclass
  ) THEN
    ALTER TABLE user_role_assignments
    ADD CONSTRAINT fk_user_role_assignments_tenant
    FOREIGN KEY ("tenantId") REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END$$;

-- Helpful index for lookups by tenant/user
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_tenant_user
  ON user_role_assignments("tenantId", "userId");
