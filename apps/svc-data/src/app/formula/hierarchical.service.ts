import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

const MAX_DEPTH = 64;
const IDENT_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const PATH_SEPARATOR = '/';

interface HierarchicalContext {
  /** Collection storage table name. Validated against IDENT_PATTERN. */
  tableName: string;
  /** Property column name used to point at the parent record. */
  parentColumn: string;
  /** Property column name where the materialized path is stored. */
  pathColumn: string;
}

/**
 * Plan §6.5 hierarchical executor — maintains a materialized path
 * column on save and detects cycles before allowing a parent
 * assignment.
 *
 * Path encoding: each row's path column stores the slash-joined ids
 * from root to self, e.g., "<root_id>/<gp_id>/<parent_id>/<self_id>".
 * Reading the path column gives O(1) ancestor traversal without a
 * recursive CTE; writing requires updating all descendants whenever
 * a row is reparented (handled by `reparent`).
 *
 * Cycle detection: walks parents chain from the proposed new parent
 * upward; rejects if the moving record's id appears anywhere in the
 * chain. The walk is bounded by MAX_DEPTH to prevent runaway loops
 * caused by data corruption.
 */
@Injectable()
export class HierarchicalService {
  private readonly logger = new Logger(HierarchicalService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Throws BadRequestException if assigning `newParentId` as the parent
   * of `recordId` would create a cycle. Returns silently when safe.
   */
  async assertNoCycle(
    ctx: HierarchicalContext,
    recordId: string,
    newParentId: string | null,
  ): Promise<void> {
    if (!newParentId) return;
    if (newParentId === recordId) {
      throw new BadRequestException('A record cannot be its own parent');
    }
    this.assertSafeIdentifier(ctx.tableName);
    this.assertSafeIdentifier(ctx.parentColumn);

    let cursor = newParentId;
    for (let depth = 0; depth < MAX_DEPTH; depth++) {
      const rows: Array<{ id: string; parent: string | null }> = await this.dataSource.query(
        `SELECT id, ${ctx.parentColumn} AS parent FROM ${ctx.tableName} WHERE id = $1 LIMIT 1`,
        [cursor],
      );
      if (rows.length === 0) return;
      const parent = rows[0].parent;
      if (!parent) return;
      if (parent === recordId) {
        throw new BadRequestException(
          `Reparenting would create a cycle (${recordId} appears in the ancestor chain)`,
        );
      }
      cursor = parent;
    }
    throw new BadRequestException(
      `Hierarchical chain exceeded ${MAX_DEPTH} levels — likely a data corruption cycle`,
    );
  }

  /**
   * Compute the materialized path for a record given its parent id.
   * For a root record (no parent), returns just the record id.
   */
  async computePath(
    ctx: HierarchicalContext,
    recordId: string,
    parentId: string | null,
  ): Promise<string> {
    if (!parentId) return recordId;
    this.assertSafeIdentifier(ctx.tableName);
    this.assertSafeIdentifier(ctx.pathColumn);
    const rows: Array<{ path: string | null }> = await this.dataSource.query(
      `SELECT ${ctx.pathColumn} AS path FROM ${ctx.tableName} WHERE id = $1 LIMIT 1`,
      [parentId],
    );
    if (rows.length === 0) {
      throw new BadRequestException(`Parent record ${parentId} not found`);
    }
    const parentPath = rows[0].path ?? parentId;
    return `${parentPath}${PATH_SEPARATOR}${recordId}`;
  }

  /**
   * Reparent a record: update its path column AND every descendant's
   * path column atomically. Always validates the move via
   * `assertNoCycle` first as a defensive check — a concurrent
   * reparent or a malformed payload could otherwise trigger the
   * descendant REPLACE pass and corrupt an entire subtree silently.
   */
  async reparent(
    ctx: HierarchicalContext,
    recordId: string,
    newParentId: string | null,
  ): Promise<void> {
    this.assertSafeIdentifier(ctx.tableName);
    this.assertSafeIdentifier(ctx.parentColumn);
    this.assertSafeIdentifier(ctx.pathColumn);

    await this.assertNoCycle(ctx, recordId, newParentId);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const oldRows: Array<{ path: string | null }> = await queryRunner.query(
        `SELECT ${ctx.pathColumn} AS path FROM ${ctx.tableName} WHERE id = $1 LIMIT 1`,
        [recordId],
      );
      if (oldRows.length === 0) {
        throw new BadRequestException(`Record ${recordId} not found`);
      }
      const oldPath = oldRows[0].path ?? recordId;
      const newPath = await this.computePath(ctx, recordId, newParentId);

      await queryRunner.query(
        `UPDATE ${ctx.tableName}
            SET ${ctx.parentColumn} = $1,
                ${ctx.pathColumn} = $2
          WHERE id = $3`,
        [newParentId, newPath, recordId],
      );

      await queryRunner.query(
        `UPDATE ${ctx.tableName}
            SET ${ctx.pathColumn} = REPLACE(${ctx.pathColumn}, $1, $2)
          WHERE ${ctx.pathColumn} LIKE $3`,
        [oldPath, newPath, `${oldPath}${PATH_SEPARATOR}%`],
      );

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  private assertSafeIdentifier(name: string): void {
    if (!IDENT_PATTERN.test(name)) {
      this.logger.error(`Refused unsafe identifier: ${name}`);
      throw new BadRequestException(`Invalid identifier: ${name}`);
    }
  }
}
