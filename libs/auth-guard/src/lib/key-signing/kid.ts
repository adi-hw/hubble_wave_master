import { randomBytes } from 'crypto';

/**
 * Generate a canon-§29.2 `kid`: `hwk_YYYY_MM_DD_<8-hex>`.
 *
 * - Date prefix is operator-readable; aids root-cause investigation when a
 *   stale `kid` shows up in logs.
 * - 8-hex suffix (~32 bits entropy) defeats predictable-kid attacks; even
 *   if an attacker can guess the date, they still need to brute-force
 *   ~4 billion possibilities to land on a valid `kid`.
 * - The `kid` is the only public reference to the underlying signing
 *   material — KMS aliases/ARNs are never exposed in tokens.
 */
export function generateKid(now: Date = new Date()): string {
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const entropy = randomBytes(4).toString('hex');
  return `hwk_${yyyy}_${mm}_${dd}_${entropy}`;
}

/**
 * Validate a `kid` matches the canon-§29.2 format. Used in defensive
 * checks at the JWKS boundary so a malformed `kid` (e.g. from a
 * corrupted DB row) never makes it into a JWT header.
 */
const KID_RE = /^hwk_\d{4}_\d{2}_\d{2}_[0-9a-f]{8}$/;

export function isValidKid(kid: string): boolean {
  return KID_RE.test(kid);
}
