/**
 * RFC 4515 LDAP filter assertion-value escape (F011 / W1 task 4).
 *
 * The five characters reserved by RFC 4515 §3 must be escaped to their
 * `\HH` hex form when interpolated into an LDAP filter:
 *
 *   *   -> \2a   (wildcard; without escape, an attacker can broaden
 *                the filter to (uid=*) and bypass the user lookup)
 *   (   -> \28   (filter delimiter; opens a new sub-filter)
 *   )   -> \29   (filter delimiter; closes the current sub-filter)
 *   \   -> \5c   (escape character; without escape, attacker-supplied
 *                escape sequences chain into the next char)
 *   NUL -> \00   (some directory servers truncate at NUL, yielding a
 *                different effective filter than the parser sees)
 *
 * The backslash MUST be replaced first; otherwise the `\HH` sequences
 * we emit for the other four characters would themselves be re-escaped.
 *
 * NUL handling: instead of a regex literal containing a NUL byte (which
 * (a) ESLint's no-control-regex rejects and (b) doesn't survive most
 * JSON-based file write paths), the NUL replace is built dynamically
 * via `new RegExp(String.fromCharCode(0), 'g')`. Same runtime semantic,
 * no control byte in source.
 */
const NUL_RE = new RegExp(String.fromCharCode(0), 'g');

export function escapeLdapFilter(value: string): string {
  return value
    .replace(/\\/g, '\\5c')
    .replace(/\*/g, '\\2a')
    .replace(/\(/g, '\\28')
    .replace(/\)/g, '\\29')
    .replace(NUL_RE, '\\00');
}
