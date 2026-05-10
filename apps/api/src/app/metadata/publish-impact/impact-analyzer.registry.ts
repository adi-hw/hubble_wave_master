import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  IMPACT_ANALYZERS,
  type AnalyzerInput,
  type DependentMatch,
  type ImpactAnalyzer,
} from './impact-analyzer.types';

/**
 * Aggregates every registered ImpactAnalyzer. The registry is the
 * single integration point PublishImpactService talks to — adding a
 * new analyzer (Phase 3b Decision Tables, Phase 5 Workspaces, Phase 6
 * Change Packages) means appending a provider to the publish-impact
 * module's IMPACT_ANALYZERS factory; service-side code does not
 * change.
 *
 * Analyzers run in parallel. A failure in one analyzer is logged but
 * does not block the others — the publish-preview endpoint should
 * always return a usable report even if a particular analyzer can't
 * answer (e.g., transient DB error). Callers see fewer dependents in
 * that case, which is the safe default.
 */
@Injectable()
export class ImpactAnalyzerRegistry {
  private readonly logger = new Logger(ImpactAnalyzerRegistry.name);

  constructor(
    @Inject(IMPACT_ANALYZERS)
    private readonly analyzers: ImpactAnalyzer[],
  ) {}

  async runAll(input: AnalyzerInput): Promise<DependentMatch[]> {
    if (input.propertyChanges.length === 0) return [];
    const results = await Promise.all(
      this.analyzers.map(async (analyzer) => {
        try {
          return await analyzer.analyze(input);
        } catch (err) {
          this.logger.warn(
            `Analyzer ${analyzer.entityType} failed for collection ${input.collectionCode}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
          return [] as DependentMatch[];
        }
      }),
    );
    return results.flat();
  }
}
