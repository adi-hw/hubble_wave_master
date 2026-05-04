import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ViewDefinition, ViewDefinitionRevision } from '@hubblewave/instance-db';
import type {
  AnalyzerInput,
  DependentMatch,
  ImpactAnalyzer,
} from '../impact-analyzer.types';

const MIN_CODE_LENGTH = 2;

/**
 * Heuristic word-boundary scan: a property code is "referenced" by a
 * layout if its identifier appears as a discrete token in the
 * stringified JSON. Covers column/field references regardless of
 * nesting depth without forcing the analyzer to know each layout
 * shape (which differs across kind=form|list|page).
 *
 * Trade-off: this can over-match for short codes that collide with
 * common JSON keys (e.g. "id"). The dependents pane lets admins
 * dismiss false positives — a structured per-kind parser is the
 * follow-up refinement once we have telemetry on real false-positive
 * rates.
 */
const referencesCode = (json: unknown, code: string): boolean => {
  if (!code || code.length < MIN_CODE_LENGTH) return false;
  const haystack = JSON.stringify(json ?? '');
  if (!haystack) return false;
  const safe = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|[^A-Za-z0-9_])${safe}([^A-Za-z0-9_]|$)`);
  return re.test(haystack);
};

/**
 * Scans every active ViewDefinition whose targetCollectionCode
 * matches the collection under publish. For each view, reads the
 * latest published revision's layout (and widget bindings, which can
 * also reference properties) and flags views whose payload mentions
 * the changed property code.
 */
@Injectable()
export class ViewImpactAnalyzer implements ImpactAnalyzer {
  readonly entityType = 'view';

  constructor(
    @InjectRepository(ViewDefinition)
    private readonly viewRepo: Repository<ViewDefinition>,
    @InjectRepository(ViewDefinitionRevision)
    private readonly revisionRepo: Repository<ViewDefinitionRevision>,
  ) {}

  async analyze(input: AnalyzerInput): Promise<DependentMatch[]> {
    const views = await this.viewRepo.find({
      where: { targetCollectionCode: input.collectionCode, isActive: true },
    });
    if (views.length === 0) return [];

    const revisions = await this.loadLatestPublishedRevisions(views.map((v) => v.id));

    const matches: DependentMatch[] = [];
    for (const view of views) {
      const rev = revisions.get(view.id);
      if (!rev) continue;
      const haystacks: unknown[] = [rev.layout, rev.widgetBindings, rev.actions];
      for (const change of input.propertyChanges) {
        if (haystacks.some((blob) => referencesCode(blob, change.propertyCode))) {
          matches.push({
            propertyCode: change.propertyCode,
            entityType: this.entityType,
            entityId: view.id,
            entityLabel: view.name,
            href: `/studio/views/${view.id}`,
            reason: `View "${view.name}" (${view.kind}) references "${change.propertyCode}" in its layout`,
          });
        }
      }
    }
    return matches;
  }

  private async loadLatestPublishedRevisions(
    viewIds: string[],
  ): Promise<Map<string, ViewDefinitionRevision>> {
    const map = new Map<string, ViewDefinitionRevision>();
    if (viewIds.length === 0) return map;
    const rows = await this.revisionRepo
      .createQueryBuilder('rev')
      .distinctOn(['rev.view_definition_id'])
      .where('rev.view_definition_id IN (:...ids)', { ids: viewIds })
      .andWhere(`rev.status = 'published'`)
      .orderBy('rev.view_definition_id', 'ASC')
      .addOrderBy('rev.revision', 'DESC')
      .getMany();
    for (const row of rows) map.set(row.definitionId, row);
    return map;
  }
}
