'use strict';

/**
 * Stub entry point for the Nx eslint-plugin's workspace-rules
 * resolution. Nx auto-detects this directory and tries to register
 * rules from index.js; we register our custom rules via the flat-config
 * eslint.config.mjs directly (so they bind under the `hw/` plugin
 * namespace), so this file deliberately exports nothing.
 *
 * Without this file, Nx's `resolve-workspace-rules.js` throws
 * MODULE_NOT_FOUND and the entire ESLint run aborts. With it present
 * but empty, Nx's resolver succeeds and the actual rule wiring happens
 * in eslint.config.mjs.
 */

module.exports = { rules: {} };
