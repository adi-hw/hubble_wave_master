import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProcessFlowDefinition } from '@hubblewave/instance-db';
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
 * Scans every active ProcessFlowDefinition whose collectionId matches.
 * Process Flows reference properties through three structurally
 * distinct surfaces — the canvas (data-pill bindings on nodes), the
 * trigger filter (which records fire the flow), and trigger conditions
 * (when the flow may run) — so all three jsonb columns are searched.
 *
 * Inactive (`isActive = false`) flows are skipped: their references
 * don't run at runtime so a property change can't break them in
 * production. They will surface again when re-activated.
 */
@Injectable()
export class ProcessFlowImpactAnalyzer implements ImpactAnalyzer {
  readonly entityType = 'process_flow';

  constructor(
    @InjectRepository(ProcessFlowDefinition)
    private readonly flowRepo: Repository<ProcessFlowDefinition>,
  ) {}

  async analyze(input: AnalyzerInput): Promise<DependentMatch[]> {
    const flows = await this.flowRepo.find({
      where: { collectionId: input.collectionId, isActive: true },
    });
    if (flows.length === 0) return [];

    const matches: DependentMatch[] = [];
    for (const flow of flows) {
      const haystacks: unknown[] = [
        flow.canvas,
        flow.triggerFilter,
        flow.triggerConditions,
      ];
      for (const change of input.propertyChanges) {
        if (haystacks.some((blob) => referencesCode(blob, change.propertyCode))) {
          matches.push({
            propertyCode: change.propertyCode,
            entityType: this.entityType,
            entityId: flow.id,
            entityLabel: flow.name,
            href: `/process-flows/${flow.id}`,
            reason: `Process Flow "${flow.name}" references "${change.propertyCode}" in its canvas or trigger`,
          });
        }
      }
    }
    return matches;
  }
}
