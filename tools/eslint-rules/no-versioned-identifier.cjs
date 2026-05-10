'use strict';

/**
 * Custom ESLint rule: hw/no-versioned-identifier (W0 task 6 / F104).
 *
 * Per canon §1, the codebase forbids identifiers that suggest a
 * temporary, versioned, or replaceable status. This rule catches:
 *   - `<word>V<digits>$` — e.g., FooV1, fooV2, processRecordV3
 *   - `^[Dd]eprecated[A-Z]...` — e.g., Deprecated*, deprecated*
 *   - `^[Tt]emp[A-Z]...` — e.g., tempCache (but NOT 'template')
 *
 * Intentionally NOT in this list:
 *
 *   - `^[Ll]egacy*` — `legacy*` in this codebase often describes
 *     DOMAIN concepts ("legacyPack" = "pack code recorded in a prior
 *     version of the entity") rather than "code we'll fix someday."
 *     Renaming tracked as W4 cleanup in master roadmap §D.3.
 *
 *   - `^old[A-Z]*` — `old*` is canonical English in diff / audit-trail
 *     patterns (`oldValues` vs `newValues`, `oldParentId` vs
 *     `newParentId`, `oldRows` vs `newRows`). The first lint pass on
 *     svc-data found 16 such matches, all in legitimate audit/change-
 *     capture contexts. Encoding "old*" as forbidden would push the
 *     team toward worse names like `previousValues` for what is
 *     standard event-sourcing terminology. The narrower rule of canon
 *     §1 — banning the language of impermanence — is well-served
 *     without `old*`.
 *
 * Allowlist (NAME_ALLOWLIST below) covers acronyms that contain
 * V+digit patterns naturally (IPv4, OAuth2, HTTP1, etc.).
 *
 * CommonJS source so it loads cleanly under both old eslint v8 and
 * flat-config v9.
 */

const VERSIONED_PATTERNS = [
  /^(?:[A-Za-z][A-Za-z0-9]*)V[0-9]+$/, // FooV1, fooV2
  /^[Dd]eprecated[A-Z][A-Za-z0-9]*$/,  // Deprecated*, deprecated*
  /^[Tt]emp[A-Z][A-Za-z0-9]*$/,         // tempThing, TempThing
];

const NAME_ALLOWLIST = new Set([
  'IPv4',
  'IPv6',
  'OAuth1',
  'OAuth2',
  'HTTP1',
  'HTTP2',
  'HTTP3',
  'TLS1',
  'TLS2',
  'SHA1',
  'SHA2',
  'SHA3',
  'MD5',
  'JSONv1',
  'JSONv2',
  'OpenAPIv3',
  // 'template', 'temperature' etc. are not matched by /^[Tt]emp[A-Z]/
  // because the next char is lowercase. Keep this allowlist minimal —
  // grow only on real false-positive evidence.
]);

function isVersioned(name) {
  if (!name || NAME_ALLOWLIST.has(name)) return false;
  return VERSIONED_PATTERNS.some((re) => re.test(name));
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'disallow versioned/deprecated/temporary identifiers per HubbleWave canon §1',
    },
    messages: {
      versionedIdentifier:
        'Identifier "{{name}}" suggests a versioned, deprecated, or temporary status. ' +
        'Per canon §1: no V1/V2/Deprecated*/old*/Temp* naming. Choose a final name.',
    },
    schema: [],
  },
  create(context) {
    function check(node) {
      if (!node || typeof node.name !== 'string') return;
      if (isVersioned(node.name)) {
        context.report({
          node,
          messageId: 'versionedIdentifier',
          data: { name: node.name },
        });
      }
    }
    return {
      Identifier: check,
    };
  },
};
