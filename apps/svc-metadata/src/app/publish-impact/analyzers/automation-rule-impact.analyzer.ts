import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AutomationRule } from '@hubblewave/instance-db';
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
 * Scans every active AutomationRule whose collectionId matches.
 * Automation Rules reference properties through:
 *   - watchProperties: explicit string[] of property codes the rule
 *     watches for change-driven evaluation
 *   - condition: structured filter referencing properties by code
 *   - actions: structured action list (SetField, CreateRecord, etc.)
 *     whose payloads carry property codes
 *   - conditionScript: free-text expression that may name properties
 *
 * `watchProperties` gets a precise array-membership check before
 * falling back to JSON word-boundary search — when present, it's the
 * authoritative list and we want exact matches.
 */
@Injectable()
export class AutomationRuleImpactAnalyzer implements ImpactAnalyzer {
  readonly entityType = 'automation_rule';

  constructor(
    @InjectRepository(AutomationRule)
    private readonly ruleRepo: Repository<AutomationRule>,
  ) {}

  async analyze(input: AnalyzerInput): Promise<DependentMatch[]> {
    const rules = await this.ruleRepo.find({
      where: { collectionId: input.collectionId, isActive: true },
    });
    if (rules.length === 0) return [];

    const matches: DependentMatch[] = [];
    for (const rule of rules) {
      const watchSet = new Set(rule.watchProperties ?? []);
      const otherHaystacks: unknown[] = [
        rule.condition,
        rule.actions,
        rule.conditionScript,
      ];
      for (const change of input.propertyChanges) {
        const watched = watchSet.has(change.propertyCode);
        const referenced =
          watched ||
          otherHaystacks.some((blob) => referencesCode(blob, change.propertyCode));
        if (!referenced) continue;
        matches.push({
          propertyCode: change.propertyCode,
          entityType: this.entityType,
          entityId: rule.id,
          entityLabel: rule.name,
          href: `/automation/${rule.id}`,
          reason: watched
            ? `Automation Rule "${rule.name}" watches "${change.propertyCode}" for change-driven execution`
            : `Automation Rule "${rule.name}" references "${change.propertyCode}" in its condition or actions`,
        });
      }
    }
    return matches;
  }
}
