import { escapeLdapFilter } from './ldap-filter-escape';

const NUL = String.fromCharCode(0);
const BACKSLASH = String.fromCharCode(92);

describe('escapeLdapFilter (F011)', () => {
  it('passes through values with no reserved characters', () => {
    expect(escapeLdapFilter('alice')).toBe('alice');
    expect(escapeLdapFilter('bob.smith@example.com')).toBe('bob.smith@example.com');
    expect(escapeLdapFilter('UserName123')).toBe('UserName123');
  });

  it('escapes wildcard *', () => {
    expect(escapeLdapFilter('*')).toBe('\\2a');
    expect(escapeLdapFilter('a*b')).toBe('a\\2ab');
  });

  it('escapes opening parenthesis (', () => {
    expect(escapeLdapFilter('(')).toBe('\\28');
    expect(escapeLdapFilter('a(b')).toBe('a\\28b');
  });

  it('escapes closing parenthesis )', () => {
    expect(escapeLdapFilter(')')).toBe('\\29');
    expect(escapeLdapFilter('a)b')).toBe('a\\29b');
  });

  it('escapes backslash FIRST (so other escapes are not double-escaped)', () => {
    expect(escapeLdapFilter(BACKSLASH)).toBe('\\5c');
    // 'a\b' becomes 'a\5cb', NOT 'a\5c5cb'
    expect(escapeLdapFilter('a' + BACKSLASH + 'b')).toBe('a\\5cb');
    // '*\\' becomes '\\2a\\5c', NOT '\\5c2a\\5c5c' (which would
    // happen if backslash were escaped LAST and then re-matched).
    expect(escapeLdapFilter('*' + BACKSLASH)).toBe('\\2a\\5c');
  });

  it('escapes NUL', () => {
    expect(escapeLdapFilter(NUL)).toBe('\\00');
    expect(escapeLdapFilter('a' + NUL + 'b')).toBe('a\\00b');
  });

  it('blocks the canonical injection payload `*)(uid=*`', () => {
    // Audit cited input: an attacker tries to inject filter logic
    // by closing the existing assertion and opening a new one.
    // After escape, every metacharacter is neutralized.
    const escaped = escapeLdapFilter('*)(uid=*');
    expect(escaped).toBe('\\2a\\29\\28uid=\\2a');
    // The escaped form, plugged into `(uid=${escaped})`, yields
    // `(uid=\2a\29\28uid=\2a)` — a single assertion that searches
    // for the literal string, not a compound filter.
  });

  it('blocks chained-escape payloads', () => {
    // `\)` could otherwise be mis-parsed as an escaped literal `)`
    // followed by an unescaped `)` if the order were wrong.
    expect(escapeLdapFilter(BACKSLASH + ')')).toBe('\\5c\\29');
  });
});
