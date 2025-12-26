export function extractTenantSlug(host: string): string | undefined {
  if (!host) return undefined;
  const hostname = host.split(':')[0];
  if (hostname === 'localhost' || hostname === '127.0.0.1') return undefined;
  
  const parts = hostname.split('.');
  if (parts.length > 1 && parts[0] !== 'www' && parts[0] !== 'api') {
    return parts[0];
  }
  return undefined;
}
