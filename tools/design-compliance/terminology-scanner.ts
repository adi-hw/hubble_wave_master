#!/usr/bin/env ts-node
/**
 * HubbleWave Design Compliance Scanner
 *
 * Scans the codebase to ensure consistent use of HubbleWave terminology.
 * This enforces the platform's naming conventions and prevents confusion
 * with generic or competitor terminology.
 *
 * Usage:
 *   npx ts-node tools/design-compliance/terminology-scanner.ts [--fix] [--strict]
 *
 * Options:
 *   --fix     Attempt to auto-fix terminology violations
 *   --strict  Exit with error code if any violations found
 *   --json    Output results as JSON
 */

import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';

// =============================================================================
// TERMINOLOGY RULES
// =============================================================================

interface TerminologyRule {
  incorrect: string | RegExp;
  correct: string;
  context: string;
  severity: 'error' | 'warning' | 'info';
  exceptions?: string[];
  autofix?: boolean;
}

const TERMINOLOGY_RULES: TerminologyRule[] = [
  // Core Entity Terminology
  {
    incorrect: /\b(?<!database_?)table(?![-_]?name|[-_]?schema|[-_]?alias)\b/gi,
    correct: 'Collection',
    context:
      'Use "Collection" instead of "table" for user-facing data containers',
    severity: 'warning',
    exceptions: ['database table', 'SQL table', 'TypeORM', '@Entity', 'migrations'],
    autofix: false,
  },
  {
    incorrect: /\btenant(?![-_]?db|[-_]?database|[-_]?connection)\b/gi,
    correct: 'Instance',
    context:
      'Use "Instance" instead of "tenant" - HubbleWave uses Single-Instance-Per-Customer architecture',
    severity: 'error',
    exceptions: ['tenant-db', 'tenantId in migrations', 'multi-tenant'],
    autofix: false,
  },
  {
    incorrect: /\bmulti[-_]?tenant/gi,
    correct: 'Single-Instance-Per-Customer',
    context:
      'HubbleWave is NOT multi-tenant. Use "Single-Instance-Per-Customer" or "dedicated instance"',
    severity: 'error',
    autofix: false,
  },

  // Field/Column Terminology
  {
    incorrect: /\bcolumn\b(?![-_]?type|[-_]?name|[-_]?definition)/gi,
    correct: 'Property',
    context: 'Use "Property" instead of "column" for Collection fields',
    severity: 'warning',
    exceptions: ['TypeORM', '@Column', 'database column', 'SQL'],
    autofix: false,
  },
  {
    incorrect: /\bfield\b(?![-_]?type|[-_]?validation)/gi,
    correct: 'Property',
    context: 'Use "Property" instead of "field" for Collection fields',
    severity: 'info',
    exceptions: ['form field', 'input field', 'GraphQL field'],
    autofix: false,
  },

  // Record Terminology
  {
    incorrect: /\brow\b(?![-_]?count|[-_]?number|[-_]?index)/gi,
    correct: 'Record',
    context: 'Use "Record" instead of "row" for Collection entries',
    severity: 'warning',
    exceptions: ['database row', 'table row', 'grid row', 'CSS'],
    autofix: false,
  },

  // User Interface Terminology
  {
    incorrect: /\bdashboard\b/gi,
    correct: 'Workspace',
    context: 'Use "Workspace" instead of "dashboard" for main user areas',
    severity: 'info',
    exceptions: ['admin dashboard', 'analytics dashboard', 'control plane'],
  },

  // AI Assistant Terminology
  {
    incorrect: /\bchatbot\b/gi,
    correct: 'AVA',
    context: 'Use "AVA" (Autonomous Virtual Assistant) for the AI assistant',
    severity: 'warning',
    autofix: false,
  },
  {
    incorrect: /\bAI\s+assistant\b/gi,
    correct: 'AVA',
    context: 'Use "AVA" instead of generic "AI assistant"',
    severity: 'info',
    autofix: false,
  },

  // Architecture Terminology
  {
    incorrect: /\bmicroservices?\b/gi,
    correct: 'services',
    context:
      'HubbleWave uses a service-oriented architecture, not microservices',
    severity: 'info',
    exceptions: ['microservices pattern', 'microservices architecture docs'],
  },

  // Licensing
  {
    incorrect: /\bsubscription\s+plan\b/gi,
    correct: 'License Tier',
    context: 'Use "License Tier" for pricing/subscription levels',
    severity: 'warning',
  },

  // Workflow Engine
  {
    incorrect: /\bpipeline\b(?![-_]?operator)/gi,
    correct: 'Flow',
    context: 'Use "Flow" for workflow/automation pipelines',
    severity: 'info',
    exceptions: ['CI/CD pipeline', 'data pipeline', 'GraphQL'],
  },
];

// =============================================================================
// FILE PATTERNS
// =============================================================================

const SCAN_PATTERNS = [
  'apps/**/*.{ts,tsx,js,jsx}',
  'libs/**/*.{ts,tsx,js,jsx}',
  'src/**/*.{ts,tsx,js,jsx}',
];

const EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/coverage/**',
  '**/*.spec.ts',
  '**/*.test.ts',
  '**/*.e2e-spec.ts',
  '**/migrations/**',
  '**/__mocks__/**',
  '**/jest.config.*',
  '**/vitest.config.*',
];

// =============================================================================
// SCANNER IMPLEMENTATION
// =============================================================================

interface Violation {
  file: string;
  line: number;
  column: number;
  match: string;
  rule: TerminologyRule;
  context: string;
}

interface ScanResult {
  totalFiles: number;
  filesWithViolations: number;
  violations: Violation[];
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };
}

function shouldExcludeLine(line: string, rule: TerminologyRule): boolean {
  if (!rule.exceptions) return false;

  const lowerLine = line.toLowerCase();
  return rule.exceptions.some((exception) =>
    lowerLine.includes(exception.toLowerCase())
  );
}

function scanFile(filePath: string): Violation[] {
  const violations: Violation[] = [];

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, lineIndex) => {
      // Skip comments and imports
      const trimmed = line.trim();
      if (
        trimmed.startsWith('//') ||
        trimmed.startsWith('/*') ||
        trimmed.startsWith('*') ||
        trimmed.startsWith('import ')
      ) {
        return;
      }

      TERMINOLOGY_RULES.forEach((rule) => {
        const regex =
          rule.incorrect instanceof RegExp
            ? rule.incorrect
            : new RegExp(`\\b${rule.incorrect}\\b`, 'gi');

        // Reset regex lastIndex for global patterns
        regex.lastIndex = 0;

        let match;
        while ((match = regex.exec(line)) !== null) {
          // Check if this line should be excluded
          if (shouldExcludeLine(line, rule)) {
            continue;
          }

          violations.push({
            file: filePath,
            line: lineIndex + 1,
            column: match.index + 1,
            match: match[0],
            rule,
            context: line.trim().substring(0, 80),
          });
        }
      });
    });
  } catch (error) {
    console.error(`Error scanning file ${filePath}:`, error);
  }

  return violations;
}

function formatViolation(v: Violation): string {
  const severityColors: Record<string, string> = {
    error: '\x1b[31m', // Red
    warning: '\x1b[33m', // Yellow
    info: '\x1b[36m', // Cyan
  };
  const reset = '\x1b[0m';
  const bold = '\x1b[1m';

  const color = severityColors[v.rule.severity];
  const severityLabel = v.rule.severity.toUpperCase().padEnd(7);

  return `${color}${severityLabel}${reset} ${bold}${v.file}:${v.line}:${v.column}${reset}
  Found: "${v.match}" → Use: "${v.rule.correct}"
  ${v.rule.context}
  Context: ${v.context}
`;
}

async function scan(): Promise<ScanResult> {
  const rootDir = process.cwd();
  const files: string[] = [];

  // Collect all files to scan
  for (const pattern of SCAN_PATTERNS) {
    const matches = glob.sync(pattern, {
      cwd: rootDir,
      ignore: EXCLUDE_PATTERNS,
      absolute: true,
    });
    files.push(...matches);
  }

  // Remove duplicates
  const uniqueFiles = [...new Set(files)];

  console.log(`\n🔍 Scanning ${uniqueFiles.length} files for terminology compliance...\n`);

  const allViolations: Violation[] = [];

  for (const file of uniqueFiles) {
    const violations = scanFile(file);
    allViolations.push(...violations);
  }

  // Sort violations by severity
  const severityOrder = { error: 0, warning: 1, info: 2 };
  allViolations.sort(
    (a, b) => severityOrder[a.rule.severity] - severityOrder[b.rule.severity]
  );

  const filesWithViolations = new Set(allViolations.map((v) => v.file)).size;

  return {
    totalFiles: uniqueFiles.length,
    filesWithViolations,
    violations: allViolations,
    summary: {
      errors: allViolations.filter((v) => v.rule.severity === 'error').length,
      warnings: allViolations.filter((v) => v.rule.severity === 'warning')
        .length,
      info: allViolations.filter((v) => v.rule.severity === 'info').length,
    },
  };
}

async function main() {
  const args = process.argv.slice(2);
  const strict = args.includes('--strict');
  const json = args.includes('--json');

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  HubbleWave Design Compliance Scanner - Terminology Check');
  console.log('═══════════════════════════════════════════════════════════════');

  const result = await scan();

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.summary.errors > 0 && strict ? 1 : 0);
    return;
  }

  // Print violations
  if (result.violations.length > 0) {
    console.log('\n📋 Terminology Violations Found:\n');
    result.violations.forEach((v) => {
      console.log(formatViolation(v));
    });
  }

  // Print summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  Summary');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Total files scanned:    ${result.totalFiles}`);
  console.log(`  Files with violations:  ${result.filesWithViolations}`);
  console.log(`  Total violations:       ${result.violations.length}`);
  console.log('');
  console.log(`  \x1b[31mErrors:   ${result.summary.errors}\x1b[0m`);
  console.log(`  \x1b[33mWarnings: ${result.summary.warnings}\x1b[0m`);
  console.log(`  \x1b[36mInfo:     ${result.summary.info}\x1b[0m`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (result.violations.length === 0) {
    console.log('✅ All files comply with HubbleWave terminology standards!\n');
  } else {
    console.log('💡 Refer to docs/HUBBLEWAVE_MASTER_ARCHITECTURE.md for terminology guide.\n');
  }

  // Exit with error in strict mode if there are errors
  if (strict && result.summary.errors > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Scanner error:', error);
  process.exit(1);
});
