/**
 * Extracts the tenant slug from a host header.
 * Examples:
 *   acme.yourplatform.com -> acme
 *   acme.lvh.me:4200      -> acme
 *   acme.localhost:4200   -> acme (dev convenience)
 * Returns null if the host does not look like a subdomain.
 */
export function extractTenantSlug(host?: string | null): string | null {
  if (!host) return null;
  const [hostWithoutPort] = host.split(':');
  const parts = hostWithoutPort.split('.');

  // Dev convenience: acme.localhost -> ['acme','localhost']
  if (parts.length === 2 && parts[1] === 'localhost') {
    return parts[0] || null;
  }

  if (parts.length < 3) return null;
  return parts[0] || null;
}
