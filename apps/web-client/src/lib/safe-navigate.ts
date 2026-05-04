/**
 * Safe Navigation Helpers
 *
 * Open-redirect protection for any user- or server-supplied navigation target.
 * The platform forbids navigating to attacker-controlled URLs. This module is
 * the single chokepoint every navigation target must pass through before being
 * handed to react-router, window.location, or service-worker openWindow.
 *
 * Allowed shapes:
 *   - Same-origin absolute URLs (http(s)://<window.location.hostname>/...)
 *   - Internal paths beginning with '/' (no traversal, no backslash, no NUL)
 *
 * Anything else returns null and the caller must refuse to navigate.
 */

/**
 * Validate a navigation target against the same-origin / internal-path policy.
 * Returns the safe target string when valid, null otherwise.
 */
export function validateInternalUrl(target: string | null | undefined): string | null {
  if (target === null || target === undefined) return null;
  if (typeof target !== 'string') return null;

  const trimmed = target.trim();
  if (trimmed.length === 0) return null;

  // Reject control characters and path-traversal markers up front.
  if (containsUnsafeMarkers(trimmed)) return null;

  // Absolute URL: must be same-origin.
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.hostname !== window.location.hostname) {
        return null;
      }
      // Re-emit as path+search+hash to drop any host info downstream consumers
      // might mishandle.
      return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/';
    } catch {
      return null;
    }
  }

  // Reject other schemes (javascript:, data:, mailto:, vbscript:, etc.)
  // by requiring a leading slash for relative targets.
  if (!trimmed.startsWith('/')) return null;

  // Reject protocol-relative URLs (//evil.com/foo).
  if (trimmed.startsWith('//')) return null;

  return trimmed;
}

function containsUnsafeMarkers(value: string): boolean {
  if (value.includes('\\')) return true;
  if (value.includes('\0')) return true;
  if (value.includes('..')) return true;
  return false;
}

/**
 * Convenience wrapper for callers that want a single navigation call site.
 * Returns true when navigation occurred, false when the target was rejected.
 */
export function safeNavigate(
  target: string | null | undefined,
  navigate: (path: string) => void
): boolean {
  const safe = validateInternalUrl(target);
  if (safe === null) {
     
    console.warn('[safeNavigate] Refused unsafe navigation target', { target });
    return false;
  }
  navigate(safe);
  return true;
}
