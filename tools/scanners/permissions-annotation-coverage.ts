#!/usr/bin/env tsx
/**
 * permissions-annotation-coverage
 *
 * Reports how many `apps/api` controller handlers carry a permission
 * annotation versus how many are unannotated.  This output is human-
 * readable input for "when can we flip PermissionsGuard to deny-by-
 * default?".
 *
 * REPORTING ONLY — exits 0 regardless of coverage percentage.
 * The guard is currently warn-and-allow (Phase 3 Prelude transitional
 * posture); flipping to deny-by-default is a later wave decision gated
 * on 100 % coverage.
 *
 * Heuristic limitations (intentional — regex for prelude speed):
 * - An annotation is detected by scanning the 12 lines above the HTTP
 *   method decorator.  A handler with a class-level annotation that
 *   sits more than 12 lines above the decorator is reported as
 *   unannotated — a false positive.  The 12-line window covers all
 *   known real-world handler shapes in this codebase.
 * - Method name extraction uses a simple regex; abstract or highly
 *   decorated methods with unusual spacing may show as "<unknown>".
 * - The scanner does not resolve TypeScript imports, so inline re-
 *   exports at the decorator call site are not followed.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';

// Decorators that satisfy the permission-annotation requirement.
const ANNOTATIONS = ['@RequirePermission', '@Permissions', '@Roles', '@Public', '@AuthenticatedOnly'];

// NestJS HTTP method decorators that identify a handler boundary.
const HTTP_DECORATORS = ['@Get', '@Post', '@Put', '@Patch', '@Delete'];

// How many lines above an HTTP decorator to scan for an annotation.
const SCAN_WINDOW = 12;

interface ParsedArgs {
  root: string;
  ci: boolean;
  report?: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  let root = 'apps/api/src';
  let ci = false;
  let report: string | undefined;
  for (const arg of argv) {
    if (arg.startsWith('--root=')) root = arg.slice('--root='.length);
    else if (arg.startsWith('--report=')) report = arg.slice('--report='.length);
    else if (arg === '--ci') ci = true;
  }
  return { root, ci, report };
}

function findControllers(root: string): string[] {
  const out: string[] = [];
  function walk(dir: string): void {
    let entries: string[] = [];
    try { entries = readdirSync(dir); } catch { return; }
    for (const entry of entries) {
      const full = join(dir, entry);
      let s;
      try { s = statSync(full); } catch { continue; }
      if (s.isDirectory()) {
        if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue;
        walk(full);
      } else if (entry.endsWith('.controller.ts')) {
        out.push(full);
      }
    }
  }
  walk(root);
  return out;
}

interface Handler {
  file: string;
  line: number;
  method: string;
  className: string;
  annotated: boolean;
}

function extractHandlers(file: string): Handler[] {
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');
  const results: Handler[] = [];
  let className = '';
  const classRe = /^export\s+class\s+(\w+)/;

  for (let i = 0; i < lines.length; i++) {
    const cm = classRe.exec(lines[i]);
    if (cm) className = cm[1];

    for (const dec of HTTP_DECORATORS) {
      if (lines[i].trim().startsWith(dec)) {
        // Scan the window above this line for any permission annotation.
        let annotated = false;
        for (let j = Math.max(0, i - SCAN_WINDOW); j < i; j++) {
          if (ANNOTATIONS.some((a) => lines[j].includes(a))) {
            annotated = true;
            break;
          }
        }

        // Extract the method name from the first function-signature line after the decorator.
        const methodLine = lines.slice(i + 1).find((l) => /^\s*(?:async\s+)?\w+\s*\(/.test(l));
        const methodMatch = methodLine ? /^\s*(?:async\s+)?(\w+)\s*\(/.exec(methodLine) : null;
        const method = methodMatch ? methodMatch[1] : '<unknown>';

        results.push({ file, line: i + 1, method, className, annotated });
        break; // Only one HTTP decorator match per line is possible.
      }
    }
  }
  return results;
}

function main(): void {
  const { root, ci, report } = parseArgs(process.argv.slice(2));
  const files = findControllers(root);
  const all: Handler[] = [];
  for (const f of files) all.push(...extractHandlers(f));

  const annotatedHandlers = all.filter((h) => h.annotated);
  const unannotatedHandlers = all.filter((h) => !h.annotated);
  const coveragePct =
    all.length === 0 ? 100 : Math.round((annotatedHandlers.length / all.length) * 1000) / 10;

  const summary = {
    total: all.length,
    annotated: annotatedHandlers.length,
    unannotated: unannotatedHandlers.length,
    coverage_pct: coveragePct,
    unannotated_handlers: unannotatedHandlers.map(
      (h) => `${h.file}:${h.line} (${h.className}.${h.method})`,
    ),
  };

  if (ci) {
    console.log(JSON.stringify(summary));
  } else {
    console.log(
      `PermissionsGuard annotation coverage: ${summary.annotated}/${summary.total} (${summary.coverage_pct}%)`,
    );
    if (summary.unannotated > 0) {
      console.log('\nUnannotated handlers:');
      for (const u of summary.unannotated_handlers.slice(0, 30)) console.log(`  ${u}`);
      if (summary.unannotated_handlers.length > 30) {
        console.log(`  ...and ${summary.unannotated_handlers.length - 30} more`);
      }
    }
  }

  if (report) {
    const md = [
      '# PermissionsGuard Annotation Rollout Coverage',
      '',
      `_Last updated_: ${new Date().toISOString()}`,
      '',
      `- **Total handlers:** ${summary.total}`,
      `- **Annotated:** ${summary.annotated}`,
      `- **Unannotated:** ${summary.unannotated}`,
      `- **Coverage:** ${summary.coverage_pct}%`,
      '',
      'The deny-by-default flip is gated by 100% coverage. See the Phase 3',
      'Prelude design spec (Stream 2 — Compatibility Shim Removal).',
    ].join('\n');
    writeFileSync(report, md + '\n');
  }

  // Reporting only: exits 0 regardless of coverage. The guard is currently
  // warn-and-allow; enforcing 100% coverage as a CI gate is a later wave
  // decision made once annotating every handler is verified complete.
  process.exit(0);
}

main();
