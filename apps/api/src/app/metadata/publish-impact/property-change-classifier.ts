import {
  type FieldChange,
  type ImpactClassification,
  type PropertyChangeKind,
  type PropertyImpactReport,
  worse,
} from './publish-impact.types';

/**
 * Pure-function classification rules for ADR-17. Decoupled from the
 * service that loads payloads so it can be unit-tested in isolation
 * without a database fixture.
 *
 * Rule structure: a per-field map declares the classification that
 * applies when the field's value differs between the two payloads.
 * Some fields use a function variant when the answer depends on the
 * specific transition (e.g., isRequired false→true is breaking;
 * true→false is structural).
 */

type Rule =
  | { kind: 'fixed'; classification: ImpactClassification; reason: string }
  | {
      kind: 'transition';
      classify: (from: unknown, to: unknown) => { classification: ImpactClassification; reason: string };
    };

const cosmeticReason = (field: string) => `${field} changed (display-only)`;
const structuralReason = (field: string) => `${field} changed (alters property surface)`;
const breakingReason = (field: string) => `${field} changed (affects existing data or column)`;

const FIELD_RULES: Record<string, Rule> = {
  name: { kind: 'fixed', classification: 'cosmetic', reason: cosmeticReason('name') },
  description: { kind: 'fixed', classification: 'cosmetic', reason: cosmeticReason('description') },
  helpText: { kind: 'fixed', classification: 'cosmetic', reason: cosmeticReason('helpText') },
  placeholder: { kind: 'fixed', classification: 'cosmetic', reason: cosmeticReason('placeholder') },
  displayFormat: { kind: 'fixed', classification: 'cosmetic', reason: cosmeticReason('displayFormat') },
  position: { kind: 'fixed', classification: 'cosmetic', reason: cosmeticReason('position') },
  isVisible: { kind: 'fixed', classification: 'cosmetic', reason: cosmeticReason('isVisible') },
  isSearchable: { kind: 'fixed', classification: 'cosmetic', reason: cosmeticReason('isSearchable') },
  isSortable: { kind: 'fixed', classification: 'cosmetic', reason: cosmeticReason('isSortable') },
  isFilterable: { kind: 'fixed', classification: 'cosmetic', reason: cosmeticReason('isFilterable') },

  isReadonly: { kind: 'fixed', classification: 'structural', reason: structuralReason('isReadonly') },
  isIndexed: { kind: 'fixed', classification: 'structural', reason: structuralReason('isIndexed') },
  validationRules: { kind: 'fixed', classification: 'structural', reason: structuralReason('validationRules') },
  defaultValue: { kind: 'fixed', classification: 'structural', reason: structuralReason('defaultValue') },
  defaultValueType: { kind: 'fixed', classification: 'structural', reason: structuralReason('defaultValueType') },
  isPhi: { kind: 'fixed', classification: 'structural', reason: structuralReason('isPhi') },
  isPii: { kind: 'fixed', classification: 'structural', reason: structuralReason('isPii') },
  isSensitive: { kind: 'fixed', classification: 'structural', reason: structuralReason('isSensitive') },
  maskingStrategy: { kind: 'fixed', classification: 'structural', reason: structuralReason('maskingStrategy') },
  maskValue: { kind: 'fixed', classification: 'structural', reason: structuralReason('maskValue') },
  requiresBreakGlass: { kind: 'fixed', classification: 'structural', reason: structuralReason('requiresBreakGlass') },
  referenceDisplayProperty: { kind: 'fixed', classification: 'structural', reason: structuralReason('referenceDisplayProperty') },
  referenceFilter: { kind: 'fixed', classification: 'structural', reason: structuralReason('referenceFilter') },
  config: { kind: 'fixed', classification: 'structural', reason: structuralReason('config') },

  code: { kind: 'fixed', classification: 'breaking', reason: breakingReason('code') },
  columnName: { kind: 'fixed', classification: 'breaking', reason: breakingReason('columnName') },
  propertyTypeId: { kind: 'fixed', classification: 'breaking', reason: breakingReason('propertyTypeId') },
  referenceCollectionId: { kind: 'fixed', classification: 'breaking', reason: breakingReason('referenceCollectionId') },
  choiceListId: { kind: 'fixed', classification: 'breaking', reason: breakingReason('choiceListId') },

  isRequired: {
    kind: 'transition',
    classify: (from, to) => {
      if (!from && to) {
        return {
          classification: 'breaking',
          reason: 'isRequired flipped on — existing rows without a default value would violate NOT NULL',
        };
      }
      return {
        classification: 'structural',
        reason: 'isRequired relaxed — column nullability eased',
      };
    },
  },
  isUnique: {
    kind: 'transition',
    classify: (from, to) => {
      if (!from && to) {
        return {
          classification: 'breaking',
          reason: 'isUnique flipped on — existing duplicate values would block index creation',
        };
      }
      return {
        classification: 'structural',
        reason: 'isUnique relaxed — unique index dropped',
      };
    },
  },
};

/**
 * Fields we deliberately do not classify because they are
 * server-managed bookkeeping (timestamps, denormalized FKs, audit
 * trails). Differences here never indicate a user-visible change.
 */
const IGNORED_FIELDS = new Set([
  'metadata',
  'collectionId',
  'applicationId',
  'ownerType',
  'isSystem',
  'isActive',
]);

const valuesEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (a == null || b == null) return a == null && b == null;
  if (typeof a === 'object' && typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
};

/**
 * Classify the diff between an existing-published payload and a
 * proposed payload. Either side can be null:
 *   - oldPayload null  → property is being added
 *   - newPayload null  → property is being removed
 */
export const classifyPropertyChange = (
  propertyCode: string,
  oldPayload: Record<string, unknown> | null,
  newPayload: Record<string, unknown> | null,
  propertyLabel?: string,
  propertyId?: string,
): PropertyImpactReport => {
  if (!oldPayload && !newPayload) {
    throw new Error('classifyPropertyChange called with both payloads null');
  }

  let changeKind: PropertyChangeKind;
  let classification: ImpactClassification;
  const fieldChanges: FieldChange[] = [];
  const reasons: string[] = [];

  if (!oldPayload && newPayload) {
    changeKind = 'added';
    const isRequired = !!newPayload.isRequired;
    const hasDefault =
      newPayload.defaultValue != null && newPayload.defaultValue !== '';
    if (isRequired && !hasDefault) {
      classification = 'breaking';
      reasons.push(
        'New property is required but has no default value — inserting into existing rows would fail',
      );
    } else {
      classification = 'structural';
      reasons.push('New property added — existing rows back-fill with default or NULL');
    }
  } else if (oldPayload && !newPayload) {
    changeKind = 'removed';
    classification = 'breaking';
    reasons.push('Property removed — column drop discards existing column data');
  } else {
    changeKind = 'modified';
    let worst: ImpactClassification = 'cosmetic';
    let anyChange = false;
    const allKeys = new Set<string>([
      ...Object.keys(oldPayload as object),
      ...Object.keys(newPayload as object),
    ]);
    for (const key of allKeys) {
      if (IGNORED_FIELDS.has(key)) continue;
      const fromVal = (oldPayload as Record<string, unknown>)[key];
      const toVal = (newPayload as Record<string, unknown>)[key];
      if (valuesEqual(fromVal, toVal)) continue;
      anyChange = true;
      const rule = FIELD_RULES[key];
      let fieldClassification: ImpactClassification;
      let reason: string;
      if (!rule) {
        fieldClassification = 'structural';
        reason = `${key} changed (no specific rule — defaulting to structural)`;
      } else if (rule.kind === 'fixed') {
        fieldClassification = rule.classification;
        reason = rule.reason;
      } else {
        const result = rule.classify(fromVal, toVal);
        fieldClassification = result.classification;
        reason = result.reason;
      }
      fieldChanges.push({ field: key, classification: fieldClassification, from: fromVal, to: toVal, reason });
      worst = worse(worst, fieldClassification);
      reasons.push(reason);
    }
    if (!anyChange) {
      classification = 'cosmetic';
      reasons.push('No detectable changes between published and current state');
    } else {
      classification = worst;
    }
  }

  return {
    propertyId,
    propertyCode,
    propertyLabel,
    changeKind,
    classification,
    fieldChanges,
    reasons,
    dependents: [],
  };
};
