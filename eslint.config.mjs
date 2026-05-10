import nx from '@nx/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import { createRequire } from 'module';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load the custom CJS rule synchronously via require — flat-config plays
// fine with this. Avoids forcing tools/eslint-rules/ into ESM.
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rulePath = resolve(__dirname, './tools/eslint-rules/no-versioned-identifier.cjs');
const noVersionedIdentifier = existsSync(rulePath) ? require(rulePath) : null;

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: [
      '**/dist',
      '**/out-tsc',
      '**/vite.config.*.timestamp*',
      // Self-test fixtures plant TODO/FIXME-shaped strings AS DATA;
      // exclude them so they don't trip no-warning-comments.
      '**/__selftest_fixture__/**',
      '**/__fixture__/**',
      'tools/dead-code-allowlist.json',
      'tools/eslint-rules/no-versioned-identifier.spec.cjs',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*'],
            },
          ],
        },
      ],
    },
  },
  // ----------------------------------------------------------------
  // Enforcement model:
  //
  // CI uses `nx affected --target=lint` (see .github/workflows/ci.yml
  // "lint" job), which runs ESLint on files changed in the current PR
  // — not the entire repo. The implication: new rules below apply
  // immediately to any file touched by any future PR. Pre-existing
  // rule violations in unchanged files (89 across apps/+libs/ as of
  // 2026-05-09: 23 no-unused-vars, 17 no-case-declarations, 17
  // no-inferrable-types, 10 no-useless-escape, etc.) do NOT fail CI
  // until those files are next modified, at which point the affected-
  // file lint will surface them and they must be cleaned up before
  // merge. The pre-existing backlog is tracked by W4 ("delete
  // ruthlessly" includes lint debt).
  //
  // Trade-off: a one-shot full-repo cleanup of 89 errors would be ~2
  // days of mechanical work that doesn't move the needle on any
  // architectural finding. Catching new violations + cleaning as we
  // go is consistent with the master roadmap's "do not block waves
  // on cleanup outside their scope" principle.
  // ----------------------------------------------------------------
  // Canon §21 enforcement (W0 task 6 / F104).
  //
  // Rules that previously existed only in canon prose are now lint-
  // enforced. Per-rule rollout strategy:
  //
  //   - no-warning-comments: error. Catches TODO/FIXME/XXX/HACK. The
  //     4 known existing TODOs each carry an inline
  //     `// eslint-disable-next-line no-warning-comments -- F<id>/W<wave>`
  //     comment that links them to a tracked finding + owning wave.
  //
  //   - hw/no-versioned-identifier: error. Custom rule defined at
  //     tools/eslint-rules/no-versioned-identifier.cjs; spec at the
  //     adjacent .spec.cjs. Detects V<digits>$, Deprecated*, old*,
  //     Temp*. Intentionally does NOT match `legacy*` because that
  //     prefix describes domain concepts in this codebase ('legacyPack'
  //     = 'pack code recorded in a prior entity version'); rename to
  //     'priorPack' etc. is W4 cleanup work per master roadmap §D.3.
  //
  //   - @typescript-eslint/no-unused-vars: error with
  //     argsIgnorePattern: '^_'. Catches the obvious dead-code class
  //     inside files. Args prefixed with _ remain valid (pattern
  //     supports the "intentionally unused" idiom).
  //
  //   - react-hooks/rules-of-hooks: DEFERRED to W1 (owns F088 fix
  //     + the related plugin install). Adding the rule now without
  //     fixing F088 first would error on master immediately.
  //
  //   - @typescript-eslint/naming-convention: DEFERRED. Surface area
  //     is huge across 1000+ files; W0 ships the high-leverage rules
  //     and a separate pass will handle naming systematically.
  //
  //   - no-restricted-syntax for "no commented-out code": DEFERRED.
  //     Reliable detection requires AST-level analysis; the simpler
  //     no-warning-comments + dead-code-check covers the most common
  //     vectors today.
  // ----------------------------------------------------------------
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    plugins: {
      ...(noVersionedIdentifier && {
        hw: {
          rules: {
            'no-versioned-identifier': noVersionedIdentifier,
          },
        },
      }),
      'react-hooks': reactHooks,
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      ...(noVersionedIdentifier && {
        'no-warning-comments': [
          'error',
          // location: 'start' (eslint default) — the term must appear at
          // the start of the comment text. This avoids false positives
          // for comments that EXPLAIN a literal containing those terms
          // (e.g., "// US format: (XXX) XXX-XXXX" describes a digit
          // mask, not a 'XXX' hack-comment marker). Standard TODO/FIXME/
          // XXX/HACK usage is comment-leading anyway.
          { terms: ['todo', 'fixme', 'xxx', 'hack'], location: 'start' },
        ],
        '@typescript-eslint/no-unused-vars': [
          'error',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            caughtErrorsIgnorePattern: '^_',
            ignoreRestSiblings: true,
          },
        ],
        'hw/no-versioned-identifier': 'error',
      }),
      // F088 / W1 task 2: hooks must be called unconditionally so the
      // hook count stays stable across renders. Catches the
      // ProtectedRoute / PermissionGate pattern that crashed the
      // subtree under StrictMode.
      'react-hooks/rules-of-hooks': 'error',
      // exhaustive-deps stays at 'warn' for now — deferred to a
      // dedicated cleanup wave because the violation surface in the
      // existing React tree is large.
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  // ----------------------------------------------------------------
  // Spec / test files: relaxed rules.
  //
  // - no-unused-vars: tests routinely declare unused locals while
  //   exercising patterns; full enforcement here surfaces noise
  //   without security value.
  // - no-warning-comments: handled per-line at the 2 known F121 sites.
  // ----------------------------------------------------------------
  {
    files: [
      '**/*.spec.ts',
      '**/*.spec.tsx',
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/e2e/**/*.ts',
    ],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
];
