import {
  validateOutboundUrl,
  isPrivateIpLiteral,
  ipv4InCidr,
  ipv6InCidr,
  ipInCidr,
} from './url-validator';

describe('validateOutboundUrl', () => {
  const originalEnv = process.env['OUTBOUND_HOST_ALLOWLIST'];

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env['OUTBOUND_HOST_ALLOWLIST'];
    } else {
      process.env['OUTBOUND_HOST_ALLOWLIST'] = originalEnv;
    }
  });

  it('accepts a valid public https URL when no allowlist is configured', () => {
    delete process.env['OUTBOUND_HOST_ALLOWLIST'];
    const url = validateOutboundUrl('https://api.example.com/v1/widgets');
    expect(url.hostname).toBe('api.example.com');
  });

  it('rejects malformed URLs', () => {
    expect(() => validateOutboundUrl('not a url')).toThrow(/not a valid URL/);
  });

  it('rejects http when default scheme allowlist applies', () => {
    expect(() => validateOutboundUrl('http://api.example.com')).toThrow(/scheme/);
  });

  it('rejects file:// scheme', () => {
    expect(() => validateOutboundUrl('file:///etc/passwd')).toThrow(/scheme/);
  });

  it('rejects gopher:// scheme', () => {
    expect(() => validateOutboundUrl('gopher://example.com')).toThrow(/scheme/);
  });

  it('rejects literal private IPv4 (127.0.0.1)', () => {
    expect(() => validateOutboundUrl('https://127.0.0.1/foo')).toThrow(
      /private network/,
    );
  });

  it('rejects literal private IPv4 (10.0.0.5)', () => {
    expect(() => validateOutboundUrl('https://10.0.0.5/foo')).toThrow(
      /private network/,
    );
  });

  it('rejects literal private IPv4 (172.16.0.1)', () => {
    expect(() => validateOutboundUrl('https://172.16.0.1/foo')).toThrow(
      /private network/,
    );
  });

  it('rejects literal private IPv4 (192.168.1.1)', () => {
    expect(() => validateOutboundUrl('https://192.168.1.1/foo')).toThrow(
      /private network/,
    );
  });

  it('rejects literal link-local IPv4 (169.254.169.254)', () => {
    expect(() => validateOutboundUrl('https://169.254.169.254/latest/meta-data')).toThrow(
      /private network/,
    );
  });

  it('rejects literal IPv6 loopback ([::1])', () => {
    expect(() => validateOutboundUrl('https://[::1]/foo')).toThrow(/private network/);
  });

  it('rejects literal IPv6 unique-local (fc00::1)', () => {
    expect(() => validateOutboundUrl('https://[fc00::1]/foo')).toThrow(
      /private network/,
    );
  });

  it('rejects literal IPv6 link-local (fe80::1)', () => {
    expect(() => validateOutboundUrl('https://[fe80::1]/foo')).toThrow(
      /private network/,
    );
  });

  it('accepts a public IPv4 (1.1.1.1)', () => {
    const url = validateOutboundUrl('https://1.1.1.1/health');
    expect(url.hostname).toBe('1.1.1.1');
  });

  it('enforces explicit allowlist passed via options', () => {
    expect(() =>
      validateOutboundUrl('https://evil.com/foo', { allowedHosts: ['api.example.com'] }),
    ).toThrow(/not in allowlist/);
  });

  it('matches wildcard patterns at any depth', () => {
    expect(
      validateOutboundUrl('https://foo.example.com/x', {
        allowedHosts: ['*.example.com'],
      }).hostname,
    ).toBe('foo.example.com');
    expect(
      validateOutboundUrl('https://a.b.example.com/x', {
        allowedHosts: ['*.example.com'],
      }).hostname,
    ).toBe('a.b.example.com');
  });

  it('rejects sibling host with wildcard pattern', () => {
    expect(() =>
      validateOutboundUrl('https://example.com.evil.com/x', {
        allowedHosts: ['*.example.com'],
      }),
    ).toThrow(/not in allowlist/);
  });

  it('reads allowlist from OUTBOUND_HOST_ALLOWLIST env when options.allowedHosts is omitted', () => {
    process.env['OUTBOUND_HOST_ALLOWLIST'] = 'api.example.com,*.partner.io';
    expect(validateOutboundUrl('https://api.example.com/foo').hostname).toBe(
      'api.example.com',
    );
    expect(validateOutboundUrl('https://x.partner.io/foo').hostname).toBe('x.partner.io');
    expect(() => validateOutboundUrl('https://other.com/foo')).toThrow(/not in allowlist/);
  });

  it('respects allowPrivateIps for development tooling', () => {
    const url = validateOutboundUrl('https://127.0.0.1/foo', { allowPrivateIps: true });
    expect(url.hostname).toBe('127.0.0.1');
  });

  it('respects custom allowedSchemes', () => {
    const url = validateOutboundUrl('http://api.example.com/x', {
      allowedSchemes: ['http:', 'https:'],
    });
    expect(url.protocol).toBe('http:');
  });
});

describe('isPrivateIpLiteral', () => {
  it('returns false for non-IP hostnames', () => {
    expect(isPrivateIpLiteral('example.com')).toBe(false);
  });
  it('returns true for IPv4 loopback', () => {
    expect(isPrivateIpLiteral('127.0.0.1')).toBe(true);
  });
  it('returns true for IPv6 ULA', () => {
    expect(isPrivateIpLiteral('fd00::1')).toBe(true);
  });
});

describe('ipv4InCidr', () => {
  it('matches a host inside a /24', () => {
    expect(ipv4InCidr('192.168.1.42', '192.168.1.0/24')).toBe(true);
  });
  it('rejects a host outside a /24', () => {
    expect(ipv4InCidr('192.168.2.42', '192.168.1.0/24')).toBe(false);
  });
  it('matches a /32 exactly', () => {
    expect(ipv4InCidr('10.0.0.5', '10.0.0.5/32')).toBe(true);
    expect(ipv4InCidr('10.0.0.6', '10.0.0.5/32')).toBe(false);
  });
  it('matches /8', () => {
    expect(ipv4InCidr('10.255.255.255', '10.0.0.0/8')).toBe(true);
    expect(ipv4InCidr('11.0.0.0', '10.0.0.0/8')).toBe(false);
  });
  it('matches /0 (all)', () => {
    expect(ipv4InCidr('1.2.3.4', '0.0.0.0/0')).toBe(true);
  });
  it('rejects malformed input', () => {
    expect(ipv4InCidr('not.an.ip', '10.0.0.0/8')).toBe(false);
    expect(ipv4InCidr('10.0.0.1', 'not.an.ip/8')).toBe(false);
  });
  it('correctly handles the audit-bug case (192.168.0.0/24 must not match 192.168.1.x)', () => {
    expect(ipv4InCidr('192.168.0.5', '192.168.0.0/24')).toBe(true);
    expect(ipv4InCidr('192.168.1.5', '192.168.0.0/24')).toBe(false);
  });
});

describe('ipv6InCidr', () => {
  it('matches /64', () => {
    expect(ipv6InCidr('2001:db8::1', '2001:db8::/32')).toBe(true);
    expect(ipv6InCidr('2001:db9::1', '2001:db8::/32')).toBe(false);
  });
  it('matches loopback /128', () => {
    expect(ipv6InCidr('::1', '::1/128')).toBe(true);
  });
});

describe('ipInCidr', () => {
  it('dispatches to v4', () => {
    expect(ipInCidr('10.0.0.1', '10.0.0.0/8')).toBe(true);
  });
  it('dispatches to v6', () => {
    expect(ipInCidr('fd00::5', 'fc00::/7')).toBe(true);
  });
  it('returns false on family mismatch', () => {
    expect(ipInCidr('10.0.0.1', 'fc00::/7')).toBe(false);
  });
});
