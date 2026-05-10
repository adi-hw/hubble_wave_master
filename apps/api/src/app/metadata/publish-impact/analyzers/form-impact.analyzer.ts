import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { FormDefinition, FormVersion } from '@hubblewave/instance-db';
import type {
  AnalyzerInput,
  DependentMatch,
  ImpactAnalyzer,
} from '../impact-analyzer.types';

const MIN_CODE_LENGTH = 2;

const referencesCode = (json: unknown, code: string): boolean => {
  if (!code || code.length < MIN_CODE_LENGTH) return false;
  const haystack = JSON.stringify(json ?? '');
  if (!haystack) return false;
  const safe = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|[^A-Za-z0-9_])${safe}([^A-Za-z0-9_]|$)`);
  return re.test(haystack);
};

/**
 * Scans every FormDefinition under the collection. For forms with a
 * currentVersionId, loads that FormVersion's layout payload and flags
 * forms whose payload mentions a changed property code.
 *
 * Forms without a currentVersionId (never published) are skipped —
 * their drafts cannot break a publish since they don't bind to a
 * runtime user-visible surface yet.
 */
@Injectable()
export class FormImpactAnalyzer implements ImpactAnalyzer {
  readonly entityType = 'form';

  constructor(
    @InjectRepository(FormDefinition)
    private readonly formRepo: Repository<FormDefinition>,
    @InjectRepository(FormVersion)
    private readonly versionRepo: Repository<FormVersion>,
  ) {}

  async analyze(input: AnalyzerInput): Promise<DependentMatch[]> {
    const forms = await this.formRepo.find({
      where: { collectionId: input.collectionId },
    });
    if (forms.length === 0) return [];

    const versionIds = forms
      .map((f) => f.currentVersionId)
      .filter((id): id is string => !!id);
    const versions =
      versionIds.length === 0
        ? new Map<string, FormVersion>()
        : await this.loadVersions(versionIds);

    const matches: DependentMatch[] = [];
    for (const form of forms) {
      const version = form.currentVersionId
        ? versions.get(form.currentVersionId)
        : undefined;
      const layout = version?.layout ?? form.layout ?? null;
      if (!layout) continue;
      for (const change of input.propertyChanges) {
        if (referencesCode(layout, change.propertyCode)) {
          matches.push({
            propertyCode: change.propertyCode,
            entityType: this.entityType,
            entityId: form.id,
            entityLabel: form.name,
            href: `/studio/c/${input.collectionCode}/forms`,
            reason: `Form "${form.name}" references "${change.propertyCode}" in its layout`,
          });
        }
      }
    }
    return matches;
  }

  private async loadVersions(versionIds: string[]): Promise<Map<string, FormVersion>> {
    const rows = await this.versionRepo.find({
      where: { id: In(versionIds) },
    });
    const map = new Map<string, FormVersion>();
    for (const row of rows) map.set(row.id, row);
    return map;
  }
}
