/**
 * Spec for hw/no-versioned-identifier (W0 task 6 / F104).
 *
 * Run: npm run selftest:eslint-rules
 *
 * Uses ESLint's built-in RuleTester so we don't need jest for the
 * tools/ directory. CommonJS to match the rule itself.
 */

'use strict';

const { RuleTester } = require('eslint');
const rule = require('./no-versioned-identifier.cjs');

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

ruleTester.run('no-versioned-identifier', rule, {
  valid: [
    // Final, non-versioned names — must pass.
    { code: 'const userService = new UserService();' },
    { code: 'export class CustomerRepository {}' },
    { code: 'function getRecord() {}' },
    { code: 'const template = "x";' },             // not Temp[A-Z]
    { code: 'const temperature = 25;' },           // not Temp[A-Z]
    { code: 'const olderUser = {};' },             // not Old[A-Z] (lower e)
    // `old*` was deliberately removed from the rule (see header):
    // canonical in diff/audit patterns (oldValues, oldParentId, etc.).
    { code: 'const oldUser = {};' },
    { code: 'const oldValues = {};' },
    { code: 'const oldParentId = "x";' },
    { code: 'const IPv4 = "127.0.0.1";' },         // explicit allowlist
    { code: 'const OAuth2Client = {};' },          // OAuth2 in allowlist
    { code: 'class HTTP3Server {}' },              // HTTP3 allowlisted
    // Names that contain `legacy` are intentionally NOT in the rule
    // (W4 cleanup).
    { code: 'const legacyPack = "x";' },
    { code: 'class LegacyOptions {}' },
  ],
  invalid: [
    // Versioned numeric suffixes.
    {
      code: 'const userServiceV1 = {};',
      errors: [{ messageId: 'versionedIdentifier' }],
    },
    {
      code: 'function processRecordV2() {}',
      errors: [{ messageId: 'versionedIdentifier' }],
    },
    {
      code: 'class FooV3 {}',
      errors: [{ messageId: 'versionedIdentifier' }],
    },
    // Deprecated prefix.
    {
      code: 'const deprecatedHandler = () => {};',
      errors: [{ messageId: 'versionedIdentifier' }],
    },
    {
      code: 'class DeprecatedAuthService {}',
      errors: [{ messageId: 'versionedIdentifier' }],
    },
    // (oldUser test removed — `old*` is no longer in the rule.)
    // Temp prefix with uppercase next char.
    {
      code: 'const tempCache = new Map();',
      errors: [{ messageId: 'versionedIdentifier' }],
    },
    {
      code: 'class TempStore {}',
      errors: [{ messageId: 'versionedIdentifier' }],
    },
  ],
});

console.log('hw/no-versioned-identifier: 14 valid + 7 invalid cases passed.');
