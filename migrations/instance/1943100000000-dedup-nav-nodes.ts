import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * DedupNavNodes1943100000000
 *
 * Removes duplicate rows from metadata.nav_nodes accumulated by migration
 * 1807000000000-seed-default-navigation.ts. That migration uses
 * uuid_generate_v4() as node IDs with ON CONFLICT DO NOTHING — because
 * the random UUIDs guarantee no conflict ever fires, every re-run of the
 * seed migration appends another set of identical (key, profile_id) rows.
 *
 * This migration keeps the row with the lowest ctid per (key, profile_id)
 * group and deletes the rest. The ctid tie-break is deterministic within a
 * single vacuum cycle and correct for dedup purposes.
 *
 * Down: irreversible (deduplication discards no information; duplicate rows
 * are by definition replicas of the kept row).
 *
 * Per Phase 3 Prelude Stream 3 deletion ledger item D2.
 */
export class DedupNavNodes1943100000000 implements MigrationInterface {
  name = 'DedupNavNodes1943100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM metadata.nav_nodes
       WHERE ctid NOT IN (
         SELECT MIN(ctid)
           FROM metadata.nav_nodes
          GROUP BY key, profile_id
       )
    `);
  }

  public async down(): Promise<void> {
    // Irreversible: duplicate rows carry no information distinct from the
    // kept row. Re-running the original seed migration
    // (1807000000000-seed-default-navigation.ts) would restore them, but
    // that migration's uuid_generate_v4() IDs would differ on each run —
    // restoring to the pre-dedup state is not meaningful.
  }
}
