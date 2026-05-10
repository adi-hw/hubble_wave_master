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
      "ignores": [
        "**/dist",
        "**/out-tsc",
        "**/vite.config.*.timestamp*"
      ]
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
