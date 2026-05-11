/**
 * Field-level masking applied when the backend's resolved
 * fieldPermissions entry declares `maskingStrategy: 'PARTIAL' | 'FULL'`
 * (F091). The backend has already determined that the caller MAY see
 * the field at all (canRead) and whether they may edit it (canWrite);
 * masking is the additional protection layer for sensitive values
 * (SSN tails, card numbers, account identifiers, etc.) that the
 * principal is authorized to glance at but not to read in full.
 *
 *   NONE     — return value unchanged.
 *   FULL     — replace with a fixed bullet string. The masked field
 *              is also rendered read-only by the form (you can't
 *              safely round-trip an opaque mask through a save).
 *   PARTIAL  — for strings of length >= 4, preserve the last 4
 *              characters and bullet-mask the prefix. For shorter
 *              strings, full-mask (revealing 1–3 chars of a 4-char
 *              identifier is information leakage). For non-strings
 *              (numbers, booleans, dates, objects), partial masking
 *              is not safely defined, so it degrades to full mask.
 *
 * null and undefined pass through unchanged regardless of strategy so
 * the form-renderer's "N/A" placeholder still fires on empty fields.
 * An empty string also passes through because there's nothing to
 * reveal — masking an empty value yields a misleading bullet display.
 */

export type MaskingStrategy = 'NONE' | 'PARTIAL' | 'FULL';

const FULL_MASK = '••••••';
const PARTIAL_VISIBLE_CHARS = 4;

export function applyMask(value: unknown, strategy: MaskingStrategy): unknown {
  if (strategy === 'NONE') return value;
  if (value === null || value === undefined) return value;
  if (typeof value === 'string' && value.length === 0) return value;

  if (strategy === 'FULL') return FULL_MASK;

  // PARTIAL: only meaningful for strings. Anything else gets full-masked.
  if (typeof value !== 'string') return FULL_MASK;

  if (value.length < PARTIAL_VISIBLE_CHARS) return FULL_MASK;

  const tail = value.slice(-PARTIAL_VISIBLE_CHARS);
  return `${FULL_MASK}${tail}`;
}
