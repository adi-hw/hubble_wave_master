/**
 * ADR-17 publish-impact contract — shared between the classifier, the
 * service that loads draft-vs-published payloads, the controller
 * endpoint, and (post-deserialization) the web-client frontend.
 *
 * The three classifications drive distinct UX paths:
 * - `cosmetic`  — publish proceeds silently; no dialog
 * - `structural` — publish proceeds; affected dependents are flagged
 *                  for review in a queue (B6c)
 * - `breaking`  — publish blocks behind an explicit confirm dialog
 *                  enumerating each affected dependent (B6d)
 */

export type ImpactClassification = 'cosmetic' | 'structural' | 'breaking';

export type PropertyChangeKind = 'added' | 'modified' | 'removed';

export interface FieldChange {
  field: string;
  classification: ImpactClassification;
  /** Absent for added properties (no prior value). */
  from?: unknown;
  /** Absent for removed properties (no new value). */
  to?: unknown;
  reason: string;
}

export interface DependentSummary {
  entityType: string;
  entityId: string;
  entityLabel: string;
  href?: string;
  reason: string;
}

export interface PropertyImpactReport {
  /** Property id when known. Absent for `removed` since the row no
   *  longer exists in the database. */
  propertyId?: string;
  propertyCode: string;
  propertyLabel?: string;
  changeKind: PropertyChangeKind;
  classification: ImpactClassification;
  fieldChanges: FieldChange[];
  reasons: string[];
  /** Entities that reference this property (forms, views, flows,
   *  etc.) and need attention if the change is structural or
   *  breaking. Populated by the analyzer registry; empty when no
   *  analyzers match. */
  dependents: DependentSummary[];
}

export interface PublishImpactReport {
  collectionId: string;
  collectionCode: string;
  /** Worst-case across all property changes. `'no_changes'` is a
   *  distinct fourth value so the UI can short-circuit straight to
   *  publish without prompting. */
  classification: ImpactClassification | 'no_changes';
  propertyChanges: PropertyImpactReport[];
  generatedAt: string;
}

export const ORDER: Record<ImpactClassification, number> = {
  cosmetic: 0,
  structural: 1,
  breaking: 2,
};

export const worse = (
  a: ImpactClassification,
  b: ImpactClassification,
): ImpactClassification => (ORDER[a] >= ORDER[b] ? a : b);
