import { isIP } from 'net';

/**
 * Centralized outbound URL validator used by every HubbleWave service that
 * issues an HTTP request to a customer-supplied URL (webhook delivery,
 * connector sync, pack artifact download, generic integration HTTP client).
 *
 * Goals:
 *  - block SSRF against link-local, loopback, RFC1918, and IPv6 ULA/loopback ranges
 *  - restrict scheme to https (or whatever the caller explicitly opts into)
 *  - optionally restrict hostnames to a per-integration allowlist
 *
 * Note: This guards against literal-IP SSRF only. DNS-rebind/SSRF-via-resolution
 * is not solved here — that is a separate runtime concern (custom resolver,
 * post-resolution check, or HTTP client integration). DNS protections will be
 * added at the transport layer.
 */

export interface ValidateOutboundUrlOptions {
  /**
   * Hostname allowlist. Each entry may be a literal hostname, a single-level
   * wildcard (`*.example.com` matches `foo.example.com` and any deeper subdomain
   * of `example.com`), or a multi-level wildcard (`**.example.com`, equivalent
   * to `*.example.com` here — both interpret `*` as "any depth").
   *
   * If omitted, the env var `OUTBOUND_HOST_ALLOWLIST` is consulted (comma-
   * separated). If that is also empty, no host allowlist is enforced and any
   * publicly-routable hostname is accepted.
   */
  allowedHosts?: string[];
  /**
   * URL schemes accepted. Defaults to `['https:']`.
   */
  allowedSchemes?: string[];
  /**
   * Permit literal private/loopback/link-local IPs. Defaults to false. Only
   * set this to true for development tooling — never in production paths.
   */
  allowPrivateIps?: boolean;
}

const DEFAULT_ALLOWED_SCHEMES = ['https:'];

export function validateOutboundUrl(
  url: string,
  options: ValidateOutboundUrlOptions = {},
): URL {
  const allowedSchemes =
    options.allowedSchemes && options.allowedSchemes.length > 0
      ? options.allowedSchemes.map((s) => s.toLowerCase())
      : DEFAULT_ALLOWED_SCHEMES;

  const allowedHosts =
    options.allowedHosts !== undefined
      ? options.allowedHosts.map((h) => h.trim().toLowerCase()).filter((h) => h.length > 0)
      : parseEnvAllowlist(process.env['OUTBOUND_HOST_ALLOWLIST']);

  const allowPrivateIps = options.allowPrivateIps === true;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Outbound URL invalid: not a valid URL');
  }

  const scheme = parsed.protocol.toLowerCase();
  if (!allowedSchemes.includes(scheme)) {
    throw new Error(
      `Outbound URL invalid: scheme '${scheme}' not in [${allowedSchemes.join(', ')}]`,
    );
  }

  const hostname = (parsed.hostname || '').toLowerCase();
  if (!hostname) {
    throw new Error('Outbound URL invalid: missing hostname');
  }

  if (!allowPrivateIps && isPrivateIpLiteral(hostname)) {
    throw new Error('Outbound URL invalid: hostname resolves to private network');
  }

  if (allowedHosts.length > 0 && !hostMatchesAny(hostname, allowedHosts)) {
    throw new Error(`Outbound URL invalid: hostname '${hostname}' not in allowlist`);
  }

  return parsed;
}

function parseEnvAllowlist(raw: string | undefined): string[] {
  if (!raw || !raw.trim()) {
    return [];
  }
  return raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

function hostMatchesAny(hostname: string, patterns: string[]): boolean {
  return patterns.some((pattern) => hostMatches(hostname, pattern));
}

function hostMatches(hostname: string, pattern: string): boolean {
  if (pattern === hostname) {
    return true;
  }
  // `**.example.com` and `*.example.com` both mean "example.com or any subdomain".
  if (pattern.startsWith('**.')) {
    const suffix = pattern.slice(2); // ".example.com"
    return hostname.endsWith(suffix) && hostname.length > suffix.length;
  }
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(1); // ".example.com"
    return hostname.endsWith(suffix) && hostname.length > suffix.length;
  }
  return false;
}

/**
 * Returns true if the supplied hostname is a literal IP address inside a
 * blocked range. Returns false for hostnames that are not IP literals (DNS
 * protection is handled separately).
 */
export function isPrivateIpLiteral(hostname: string): boolean {
  // URL parser strips brackets from IPv6 hostnames, but be defensive.
  const candidate =
    hostname.startsWith('[') && hostname.endsWith(']')
      ? hostname.slice(1, -1)
      : hostname;
  const family = isIP(candidate);
  if (family === 0) {
    return false;
  }
  if (family === 4) {
    return isPrivateIPv4(candidate);
  }
  return isPrivateIPv6(candidate);
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true; // malformed — treat as unsafe
  }
  const [a, b] = parts;
  if (a === 10) return true;                          // 10.0.0.0/8
  if (a === 127) return true;                         // 127.0.0.0/8
  if (a === 169 && b === 254) return true;            // 169.254.0.0/16
  if (a === 172 && b >= 16 && b <= 31) return true;   // 172.16.0.0/12
  if (a === 192 && b === 168) return true;            // 192.168.0.0/16
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const expanded = expandIPv6(ip);
  if (!expanded) {
    return true; // malformed — treat as unsafe
  }
  // ::1 loopback
  if (ipv6PrefixMatches(expanded, '::1', 128)) return true;
  // fc00::/7 (unique local)
  if (ipv6PrefixMatches(expanded, 'fc00::', 7)) return true;
  // fe80::/10 (link-local)
  if (ipv6PrefixMatches(expanded, 'fe80::', 10)) return true;
  return false;
}

/**
 * Expand a (possibly compressed) IPv6 address into a 128-bit BigInt. Returns
 * null if the address is malformed.
 */
function expandIPv6(ip: string): bigint | null {
  // Handle IPv4-mapped form like ::ffff:1.2.3.4 by converting tail.
  let work = ip.toLowerCase();
  const v4Tail = /:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(work);
  if (v4Tail) {
    const v4 = v4Tail[1].split('.').map((n) => Number(n));
    if (v4.length !== 4 || v4.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
      return null;
    }
    const high = ((v4[0] << 8) | v4[1]).toString(16);
    const low = ((v4[2] << 8) | v4[3]).toString(16);
    work = work.slice(0, v4Tail.index) + ':' + high + ':' + low;
  }

  let head: string[];
  let tail: string[];
  if (work.includes('::')) {
    const [h, t] = work.split('::');
    head = h ? h.split(':') : [];
    tail = t ? t.split(':') : [];
    const fillCount = 8 - head.length - tail.length;
    if (fillCount < 0) return null;
    const fill = new Array<string>(fillCount).fill('0');
    head = [...head, ...fill, ...tail];
  } else {
    head = work.split(':');
  }
  if (head.length !== 8) return null;

  let result = BigInt(0);
  const sixteen = BigInt(16);
  for (const group of head) {
    if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
    result = (result << sixteen) | BigInt(parseInt(group, 16));
  }
  return result;
}

function ipv6PrefixMatches(addr: bigint, prefix: string, prefixBits: number): boolean {
  const prefixAddr = expandIPv6(prefix);
  if (prefixAddr === null) return false;
  if (prefixBits === 0) return true;
  const shift = BigInt(128 - prefixBits);
  return (addr >> shift) === (prefixAddr >> shift);
}

/**
 * IPv4 CIDR membership test. Accepts `cidr` in the form `<ip>/<bits>` or a
 * literal `<ip>` (treated as /32). Returns false if either argument is not a
 * valid IPv4 address.
 */
export function ipv4InCidr(ip: string, cidr: string): boolean {
  const [rangeIp, bitsRaw] = cidr.includes('/') ? cidr.split('/') : [cidr, '32'];
  const bits = Number(bitsRaw);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const ipInt = ipv4ToUint32(ip);
  const rangeInt = ipv4ToUint32(rangeIp);
  if (ipInt === null || rangeInt === null) return false;
  if (bits === 0) return true;
  const mask = bits === 32 ? 0xffffffff : (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (rangeInt & mask);
}

function ipv4ToUint32(ip: string): number | null {
  if (isIP(ip) !== 4) return null;
  const parts = ip.split('.').map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return null;
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

/**
 * IPv6 CIDR membership test. Accepts `cidr` in the form `<ip>/<bits>` or a
 * literal `<ip>` (treated as /128). Returns false if either argument is not a
 * valid IPv6 address.
 */
export function ipv6InCidr(ip: string, cidr: string): boolean {
  const [rangeIp, bitsRaw] = cidr.includes('/') ? cidr.split('/') : [cidr, '128'];
  const bits = Number(bitsRaw);
  if (!Number.isInteger(bits) || bits < 0 || bits > 128) return false;
  if (isIP(ip) !== 6 || isIP(rangeIp) !== 6) return false;
  const ipInt = expandIPv6(ip);
  const rangeInt = expandIPv6(rangeIp);
  if (ipInt === null || rangeInt === null) return false;
  if (bits === 0) return true;
  const shift = BigInt(128 - bits);
  return (ipInt >> shift) === (rangeInt >> shift);
}

/**
 * Generic CIDR membership test, dispatches on IP family. Returns false on
 * malformed input or family mismatch.
 */
export function ipInCidr(ip: string, cidr: string): boolean {
  const rangeIp = cidr.includes('/') ? cidr.split('/')[0] : cidr;
  const family = isIP(rangeIp);
  if (family === 4) return ipv4InCidr(ip, cidr);
  if (family === 6) return ipv6InCidr(ip, cidr);
  return false;
}
