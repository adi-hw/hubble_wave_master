import { QueryRunner } from 'typeorm';

/**
 * Create an index using PostgreSQL's `CREATE INDEX CONCURRENTLY` so the index
 * build does not take an ACCESS EXCLUSIVE lock — concurrent writes proceed
 * while the index builds.
 *
 * Migrations that call this MUST be declared with `transaction: false` (see
 * the static `transaction = false` property on the migration class), because
 * CONCURRENTLY cannot run inside a transaction.
 *
 * `IF NOT EXISTS` makes the call idempotent — safe to re-run if a prior
 * attempt failed mid-build. Use `dropIndexConcurrent` for the down path.
 */
export async function createIndexConcurrent(
  queryRunner: QueryRunner,
  options: {
    indexName: string;
    tableName: string;
    columns: string[];               // e.g. ['user_id', 'created_at']
    using?: 'btree' | 'gin' | 'gist' | 'hash' | 'brin';
    where?: string;                  // optional partial-index predicate
    unique?: boolean;
  },
): Promise<void> {
  const using = options.using ? ` USING ${options.using}` : '';
  const unique = options.unique ? 'UNIQUE ' : '';
  const where = options.where ? ` WHERE ${options.where}` : '';
  const cols = options.columns.map((c) => `"${c}"`).join(', ');

  await queryRunner.query(
    `CREATE ${unique}INDEX CONCURRENTLY IF NOT EXISTS "${options.indexName}" ON "${options.tableName}"${using} (${cols})${where}`,
  );
}

/**
 * Drop an index using `DROP INDEX CONCURRENTLY` (no ACCESS EXCLUSIVE lock).
 * Idempotent via `IF EXISTS`.
 *
 * Same transaction constraint applies — host migration must be
 * `transaction = false`.
 */
export async function dropIndexConcurrent(
  queryRunner: QueryRunner,
  indexName: string,
): Promise<void> {
  await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "${indexName}"`);
}
