import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RemoveOrphanStudioViewsNavNode1943000000000
 *
 * Removes the `studio.views` navigation node from all published
 * navigation_module_revisions. The node was seeded by migration
 * 1819000000000-seed-default-navigation-module.ts and points to
 * `/studio/views`, a route that does not exist in the web client.
 * Views are accessed per-collection at `/studio/collections/:id/views`.
 * An orphan nav node produces a dead sidebar entry that navigates to a 404.
 *
 * The SQL targets the `studio` group's `children` array within the
 * `layout.nodes` JSONB and removes any child whose `key` is `studio.views`.
 * All other nodes are preserved unchanged.
 *
 * Per Phase 3 Prelude Stream 3 deletion ledger item C1.
 */
export class RemoveOrphanStudioViewsNavNode1943000000000
  implements MigrationInterface
{
  name = 'RemoveOrphanStudioViewsNavNode1943000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Remove studio.views from the children array of every node in
    // layout->nodes that has key = 'studio' and carries the orphan child.
    // Uses a CTE to identify the target node index and jsonb_agg to rebuild
    // the children array without the studio.views entry.
    await queryRunner.query(`
      UPDATE navigation_module_revisions
         SET layout = jsonb_set(
           layout,
           ARRAY['nodes', node_idx::text, 'children'],
           (
             SELECT COALESCE(
               jsonb_agg(child ORDER BY child_ord),
               '[]'::jsonb
             )
               FROM jsonb_array_elements(layout -> 'nodes' -> node_idx -> 'children')
                    WITH ORDINALITY AS t(child, child_ord)
              WHERE child ->> 'key' != 'studio.views'
           )
         )
        FROM (
          SELECT nmr.id,
                 (idx - 1) AS node_idx
            FROM navigation_module_revisions nmr,
                 jsonb_array_elements(nmr.layout -> 'nodes')
                 WITH ORDINALITY AS t(node, idx)
           WHERE node ->> 'key' = 'studio'
             AND node -> 'children' @> '[{"key": "studio.views"}]'::jsonb
        ) target
       WHERE navigation_module_revisions.id = target.id
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore the studio.views child after the studio.audit node in every
    // studio group that is missing it (idempotent — skips if already present).
    await queryRunner.query(`
      UPDATE navigation_module_revisions
         SET layout = jsonb_set(
           layout,
           ARRAY['nodes', node_idx::text, 'children'],
           (layout -> 'nodes' -> node_idx -> 'children')
             || '[{"key": "studio.views", "type": "module", "label": "Views", "icon": "layout", "route": "/studio/views"}]'::jsonb
         )
        FROM (
          SELECT nmr.id,
                 (idx - 1) AS node_idx
            FROM navigation_module_revisions nmr,
                 jsonb_array_elements(nmr.layout -> 'nodes')
                 WITH ORDINALITY AS t(node, idx)
           WHERE node ->> 'key' = 'studio'
             AND NOT (node -> 'children' @> '[{"key": "studio.views"}]'::jsonb)
        ) target
       WHERE navigation_module_revisions.id = target.id
    `);
  }
}
