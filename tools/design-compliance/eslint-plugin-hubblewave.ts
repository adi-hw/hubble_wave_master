/**
 * ESLint Plugin for HubbleWave Terminology Compliance
 *
 * This plugin provides ESLint rules to enforce HubbleWave terminology
 * in code comments, strings, and identifiers.
 *
 * Usage in .eslintrc.js:
 *   plugins: ['hubblewave'],
 *   rules: {
 *     'hubblewave/terminology': 'warn',
 *   }
 */

import type { Rule } from 'eslint';

interface TerminologyMapping {
  pattern: RegExp;
  replacement: string;
  message: string;
}

const TERMINOLOGY_MAPPINGS: TerminologyMapping[] = [
  {
    pattern: /\btenant\b/gi,
    replacement: 'instance',
    message: 'Use "instance" instead of "tenant" (HubbleWave Single-Instance-Per-Customer)',
  },
  {
    pattern: /\bmulti[-_]?tenant/gi,
    replacement: 'single-instance',
    message: 'HubbleWave is Single-Instance-Per-Customer, not multi-tenant',
  },
  {
    pattern: /\btable\b/gi,
    replacement: 'collection',
    message: 'Use "collection" instead of "table" for data containers',
  },
  {
    pattern: /\bcolumn\b/gi,
    replacement: 'property',
    message: 'Use "property" instead of "column" for collection fields',
  },
  {
    pattern: /\brow\b/gi,
    replacement: 'record',
    message: 'Use "record" instead of "row" for collection entries',
  },
];

// Patterns that are exceptions (database operations, TypeORM decorators, etc.)
const EXCEPTION_PATTERNS = [
  /^import\s/,
  /@(Entity|Column|Table|PrimaryColumn)/,
  /typeorm/i,
  /database/i,
  /sql/i,
  /migration/i,
];

function shouldIgnore(text: string): boolean {
  return EXCEPTION_PATTERNS.some((pattern) => pattern.test(text));
}

const terminologyRule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce HubbleWave terminology conventions',
      recommended: true,
    },
    messages: {
      incorrectTerminology: '{{message}}. Found "{{found}}", use "{{replacement}}" instead.',
    },
    schema: [], // no options
  },
  create(context) {
    return {
      // Check string literals
      Literal(node) {
        if (typeof node.value !== 'string') return;
        const value = node.value;

        if (shouldIgnore(value)) return;

        for (const mapping of TERMINOLOGY_MAPPINGS) {
          const match = value.match(mapping.pattern);
          if (match) {
            context.report({
              node,
              messageId: 'incorrectTerminology',
              data: {
                message: mapping.message,
                found: match[0],
                replacement: mapping.replacement,
              },
            });
            break; // Report only first match per literal
          }
        }
      },

      // Check template literals
      TemplateLiteral(node) {
        for (const quasi of node.quasis) {
          const value = quasi.value.raw;

          if (shouldIgnore(value)) continue;

          for (const mapping of TERMINOLOGY_MAPPINGS) {
            const match = value.match(mapping.pattern);
            if (match) {
              context.report({
                node: quasi,
                messageId: 'incorrectTerminology',
                data: {
                  message: mapping.message,
                  found: match[0],
                  replacement: mapping.replacement,
                },
              });
              break;
            }
          }
        }
      },

      // Check JSX text
      JSXText(node) {
        const value = node.value;

        if (shouldIgnore(value)) return;

        for (const mapping of TERMINOLOGY_MAPPINGS) {
          const match = value.match(mapping.pattern);
          if (match) {
            context.report({
              node,
              messageId: 'incorrectTerminology',
              data: {
                message: mapping.message,
                found: match[0],
                replacement: mapping.replacement,
              },
            });
            break;
          }
        }
      },

      // Check comments
      Program() {
        const sourceCode = context.getSourceCode();
        const comments = sourceCode.getAllComments();

        for (const comment of comments) {
          const value = comment.value;

          if (shouldIgnore(value)) continue;

          for (const mapping of TERMINOLOGY_MAPPINGS) {
            const match = value.match(mapping.pattern);
            if (match) {
              context.report({
                loc: comment.loc!,
                messageId: 'incorrectTerminology',
                data: {
                  message: mapping.message,
                  found: match[0],
                  replacement: mapping.replacement,
                },
              });
              break;
            }
          }
        }
      },
    };
  },
};

// Export the plugin
const plugin = {
  rules: {
    terminology: terminologyRule,
  },
  configs: {
    recommended: {
      plugins: ['hubblewave'],
      rules: {
        'hubblewave/terminology': 'warn',
      },
    },
    strict: {
      plugins: ['hubblewave'],
      rules: {
        'hubblewave/terminology': 'error',
      },
    },
  },
};

export = plugin;
