import { Entity, PrimaryColumn, Column, Index } from 'typeorm';

/**
 * PlatformPermission entity — maps to identity.platform_permissions.
 *
 * Code-keyed (PRIMARY KEY (code)) per W2 spec §2.2. Replaces the pre-W2
 * UUID-keyed `identity.permissions` table. The `code` column is the
 * stable identifier referenced by `identity.role_permissions.permission_code`
 * — the FK relationship is by code, not UUID.
 *
 * Code format per W2 spec §2.1 (enforced by the future
 * `permission-registry-sync-check` scanner, not by the column type):
 *   ^[a-z][a-z_]*(:[a-z_]+){1,2}$
 * That is, two- or three-segment colon-separated identifiers
 * (`<domain>:<action>` or `<domain>:<resource>:<action>`), all lowercase,
 * underscores allowed within segments, no dots, no wildcards. The DB
 * column is plain `text` so historical / non-conforming codes can be
 * cleaned up by the scanner rather than rejected at insert time.
 *
 * Action vocabulary is a fixed enum per W2 spec §2.1:
 *   read | manage | export | configure | admin | invoke | approve
 *
 * Per W2 spec §2.3 this table is empty at Pre-W2 baseline. Rows are
 * materialized by `scripts/seed-permission-registry-sync.ts` (Stream 2
 * PR3) reading the `PERMISSION_REGISTRY` TypeScript constant.
 */
@Entity({ name: 'platform_permissions', schema: 'identity' })
@Index(['plane'])
@Index(['domain'])
export class PlatformPermission {
  /** Stable identifier; colon-separated per W2 §2.1. */
  @PrimaryColumn({ type: 'text' })
  code!: string;

  /** Which plane the permission applies to. CHECK constraint enforces values. */
  @Column({ type: 'text' })
  plane!: 'instance' | 'control-plane';

  /** Domain segment of the code (e.g., 'work_order'). */
  @Column({ type: 'text' })
  domain!: string;

  /** Optional resource segment for three-segment codes. */
  @Column({ type: 'text', nullable: true })
  resource?: string | null;

  /** Action segment; must be in the W2 §2.1 PermissionAction enum. */
  @Column({ type: 'text' })
  action!: string;

  /** Marks codes that should require operator-confirmation in UIs. */
  @Column({ type: 'boolean', default: false })
  dangerous!: boolean;

  /** Human-readable description for admin tooling. */
  @Column({ type: 'text' })
  description!: string;
}
