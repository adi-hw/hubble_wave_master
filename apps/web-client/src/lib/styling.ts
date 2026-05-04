/**
 * Shared className constants for repeating App Studio surface patterns.
 *
 * Two clusters were duplicated across 12+ App Studio files:
 *
 *   1. Status pills - Active / Draft / Archived (or open / complete /
 *      applied for Change Packages). Each panel hand-rolled the same
 *      `border-emerald-200 bg-emerald-100 text-emerald-800` triplet,
 *      which made theme adjustments a 12-file find/replace.
 *
 *   2. Destructive icon buttons (delete row, remove rule, etc.) - the
 *      `text-rose-600 hover:bg-rose-50` triplet had at least three
 *      slight variations; consolidating eliminates the drift.
 *
 * Keep these as plain string constants (no `cn()` wrapping). Callers
 * compose with `cn()` so per-call modifiers compose cleanly.
 */

/** Status pill - used for Active / Published / Complete states. */
export const STATUS_PILL_SUCCESS =
  'border-emerald-200 bg-emerald-100 text-emerald-800';

/** Status pill - used for Draft / Open / Pending states. */
export const STATUS_PILL_PENDING =
  'border-amber-200 bg-amber-100 text-amber-800';

/** Status pill - used for Archived / Inactive / Applied states. */
export const STATUS_PILL_NEUTRAL =
  'border-slate-200 bg-slate-100 text-slate-700';

/** Status pill - used for Failed / Rejected / Error states. */
export const STATUS_PILL_DANGER =
  'border-rose-200 bg-rose-100 text-rose-800';

/**
 * Banner variants pair a softer background with the same status hue.
 * Used by PublishConfirmDialog and similar callout surfaces.
 */
export const STATUS_BANNER_SUCCESS =
  'border-emerald-200 bg-emerald-50 text-emerald-900';
export const STATUS_BANNER_PENDING =
  'border-amber-200 bg-amber-50 text-amber-900';
export const STATUS_BANNER_DANGER =
  'border-rose-200 bg-rose-50 text-rose-900';

/**
 * Destructive icon button - delete row, remove rule, etc. The base
 * sits as a muted icon and turns rose on hover so it does not visually
 * dominate the row until the user reaches for it. Composes with
 * `disabled:opacity-*` modifiers per-call for varying disabled levels.
 */
export const DESTRUCTIVE_ICON_BUTTON =
  'rounded p-1 text-muted-foreground transition-colors hover:bg-rose-100 hover:text-rose-700';

/** Standard neutral icon button for table row operations. */
export const NEUTRAL_ICON_BUTTON =
  'rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground';

/** Standard row dimming for inactive/draft lifecycle entries. */
export const INACTIVE_ROW_CLASS = 'opacity-60';

/**
 * Standard disabled state - applied via the `disabled:` modifier on
 * buttons and inputs so the platform reads consistently. 50% opacity
 * matches the WAI-ARIA "disabled" visual contract used across shadcn
 * and the Glass design system.
 */
export const DISABLED_OPACITY = 'disabled:opacity-50 disabled:cursor-not-allowed';
