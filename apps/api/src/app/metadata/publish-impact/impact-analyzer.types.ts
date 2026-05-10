import type { ImpactClassification, PropertyChangeKind } from './publish-impact.types';

/**
 * What an analyzer is given when asked to find dependents. The list of
 * property changes is the same set the classifier already produced —
 * each analyzer only needs propertyCode + classification to decide
 * what to scan and how to weight the result.
 */
export interface AnalyzerInput {
  collectionId: string;
  collectionCode: string;
  propertyChanges: ReadonlyArray<{
    propertyCode: string;
    propertyId?: string;
    changeKind: PropertyChangeKind;
    classification: ImpactClassification;
  }>;
}

export interface DependentMatch {
  /** Property code this dependent is affected by — links the match
   *  back to its propertyChange in the report. */
  propertyCode: string;
  /** Stable type slug, e.g. 'view', 'form', 'process_flow',
   *  'automation_rule'. Surfaced as a category in the dependents
   *  pane and used for the dashboard's queue grouping. */
  entityType: string;
  /** Persistent id of the dependent entity. */
  entityId: string;
  /** Human-readable label rendered in the dependents list. */
  entityLabel: string;
  /** Optional Studio route admins can follow to fix the dependent. */
  href?: string;
  /** Brief explanation: "uses this property in column 3", "references
   *  it in trigger condition", etc. */
  reason: string;
}

/**
 * Contract every analyzer implements. ADR-17 calls this out as the
 * extension point — Phase 3b (Decision Tables), Phase 5 (Workspaces),
 * and Phase 6 (Change Packages) will each register an analyzer
 * without changing the publish endpoint contract or the registry
 * itself.
 */
export interface ImpactAnalyzer {
  readonly entityType: string;
  analyze(input: AnalyzerInput): Promise<DependentMatch[]>;
}

/** DI token used by the registry's factory to gather analyzers. */
export const IMPACT_ANALYZERS = Symbol('IMPACT_ANALYZERS');
