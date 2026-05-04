import type { PropertyDefinition } from '../../../../services/propertyApi';

/**
 * Locally tracked editable shape of a property row in the canvas. Mirrors
 * the persisted PropertyDefinition but reduced to the fields the
 * spreadsheet-like grid edits inline. Advanced fields (choiceList,
 * reference target, validation rules, behavioral attributes) flow through
 * the existing PropertyEditor modal and round-trip via the full
 * PropertyDefinition.
 */
export interface PropertyDraft {
  /** Server-assigned id; absent on rows that were just added in the UI. */
  id?: string;
  /** Stable code persisted in storage. Editable until first save. */
  code: string;
  /** Human label displayed in forms and lists. */
  label: string;
  /** Property type code from PROPERTY_TYPES. */
  dataType: string;
  /** Type-specific settings, including AVA-detected format options. */
  config?: Record<string, unknown>;
  isRequired: boolean;
  isUnique: boolean;
  isReadonly: boolean;
  isSystem: boolean;
  /** Sort order within the Collection. */
  displayOrder: number;
  /**
   * For dataType='reference': UUID of the target Collection. The row is
   * considered "incomplete" (not safely savable) until this is set.
   */
  referenceCollectionId?: string | null;
  /**
   * For dataType='reference': property code on the target Collection
   * shown in the reference picker. Defaults to 'id' on the backend if
   * omitted.
   */
  referenceDisplayProperty?: string | null;
}

/**
 * Per-row editing state tracked by useTableBuilder. The grid distinguishes
 * "clean" rows (server matches local) from "dirty" (local diverged) and
 * "new" (created in UI, not yet persisted) so the save bar can surface
 * an accurate change count.
 */
export type RowStatus = 'clean' | 'dirty' | 'new' | 'deleted';

export interface RowEntry {
  draft: PropertyDraft;
  /** Server-side snapshot last loaded, kept for diff detection. */
  baseline: PropertyDraft | null;
  status: RowStatus;
  /**
   * Synthetic stable key used as React key for new rows that have no
   * id yet. Never sent to the server.
   */
  localKey: string;
}

const PROPERTY_CODE_MAX_LENGTH = 100;

export const toPropertyCode = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
    .slice(0, PROPERTY_CODE_MAX_LENGTH);

export const fromPropertyDefinition = (def: PropertyDefinition, order: number): PropertyDraft => ({
  id: def.id,
  code: def.code,
  label: def.label,
  dataType: def.dataType,
  config: (def.config as Record<string, unknown> | undefined) ?? {},
  isRequired: def.isRequired,
  isUnique: def.isUnique,
  isReadonly: def.isReadonly,
  isSystem: def.isSystem,
  displayOrder: def.displayOrder ?? order,
  referenceCollectionId: (def.referenceCollectionId as string | undefined) ?? null,
  referenceDisplayProperty: (def.referenceDisplayProperty as string | undefined) ?? null,
});

/**
 * A reference-typed row needs a target Collection before it can be
 * safely saved. The save bar uses this to surface a warning before
 * accepting the save call.
 */
export const isIncompleteReference = (draft: PropertyDraft): boolean =>
  draft.dataType === 'reference' && !draft.referenceCollectionId;
