#!/usr/bin/env ts-node
/**
 * License validator (W0 task 9 / F119).
 *
 * Reads `licenses.json` (output of `npx license-checker --json`), checks
 * every package's license against `tools/license-allowlist.json`, and
 * fails non-zero on any:
 *   - blocked license (GPL family by default)
 *   - unknown license (neither in `allowed` nor in `exceptions`)
 *
 * Exceptions require structured justification: { package, license,
 * reason, addedBy, addedAt }. The convention is the same as the other
 * scanner allowlists in this repo — make every carve-out reviewable.
 *
 * Usage:
 *   npx license-checker --production --json > licenses.json
 *   npx ts-node tools/validate-licenses.ts licenses.json tools/license-allowlist.json
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

interface LicenseInfo {
  licenses: string | string[];
  repository?: string;
  publisher?: string;
  url?: string;
  path?: string;
  licenseFile?: string;
}

interface Allowlist {
  allowed: string[];
  blocked: string[];
  exceptions: Array<{
    package: string;
    license: string;
    reason: string;
    addedBy: string;
    addedAt: string;
  }>;
}

const [, , licensesPathArg, allowlistPathArg] = process.argv;

if (!licensesPathArg || !allowlistPathArg) {
  console.error(
    'Usage: validate-licenses.ts <licenses.json> <license-allowlist.json>',
  );
  process.exit(2);
}

const licensesPath = resolve(process.cwd(), licensesPathArg);
const allowlistPath = resolve(process.cwd(), allowlistPathArg);

if (!existsSync(licensesPath)) {
  console.error(`licenses.json not found: ${licensesPath}`);
  process.exit(2);
}
if (!existsSync(allowlistPath)) {
  console.error(`license-allowlist.json not found: ${allowlistPath}`);
  process.exit(2);
}

const licenses = JSON.parse(readFileSync(licensesPath, 'utf-8')) as Record<
  string,
  LicenseInfo
>;
const allowlist = JSON.parse(readFileSync(allowlistPath, 'utf-8')) as Allowlist;

interface Violation {
  package: string;
  license: string;
  kind: 'blocked' | 'unknown';
}

const violations: Violation[] = [];

function licenseStrings(info: LicenseInfo): string[] {
  if (Array.isArray(info.licenses)) {
    return info.licenses.filter(Boolean);
  }
  if (typeof info.licenses === 'string' && info.licenses) {
    // Support compound notations like `(MIT OR Apache-2.0)` — split on
    // OR/AND and return all parts. Compound parens are stripped.
    const stripped = info.licenses.replace(/[()]/g, '').trim();
    return stripped.split(/\s+(?:OR|AND)\s+/i).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function matchesAny(license: string, list: string[]): boolean {
  const lower = license.toLowerCase();
  return list.some((l) => lower.includes(l.toLowerCase()));
}

function findException(pkg: string): Allowlist['exceptions'][number] | undefined {
  // Match either by exact name (e.g., "jszip") or with version suffix
  // ("jszip@3.10.1"). The license-checker output keys are
  // `<name>@<version>` so exception entries may name the bare package.
  return allowlist.exceptions.find(
    (e) => pkg === e.package || pkg.startsWith(e.package + '@'),
  );
}

for (const [pkg, info] of Object.entries(licenses)) {
  const lics = licenseStrings(info);

  if (lics.length === 0) {
    if (!findException(pkg)) {
      violations.push({ package: pkg, license: '(none declared)', kind: 'unknown' });
    }
    continue;
  }

  // Compound licenses are valid if AT LEAST ONE part is allowed and
  // NONE are blocked — UNLESS an explicit exception covers the package.
  // Exceptions override both blocked and unknown verdicts: they ARE
  // the team's record of "we examined this and accept it." Without
  // override semantics, dual-licensed packages like jszip (MIT OR GPL)
  // would be permanently blocked.
  let blockedHit: string | null = null;
  let anyAllowed = false;
  for (const lic of lics) {
    if (matchesAny(lic, allowlist.blocked)) {
      blockedHit = lic;
      break;
    }
    if (matchesAny(lic, allowlist.allowed)) {
      anyAllowed = true;
    }
  }

  if (blockedHit) {
    if (!findException(pkg)) {
      violations.push({ package: pkg, license: blockedHit, kind: 'blocked' });
    }
    continue;
  }

  if (!anyAllowed && !findException(pkg)) {
    violations.push({ package: pkg, license: lics.join(' / '), kind: 'unknown' });
  }
}

if (violations.length > 0) {
  console.error(`License audit FAILED (${violations.length} violation(s)):`);
  for (const v of violations) {
    const prefix = v.kind === 'blocked' ? 'BLOCKED' : 'UNKNOWN';
    console.error(`  [${prefix}] ${v.package}: ${v.license}`);
  }
  console.error(
    '\nResolution: add an entry to tools/license-allowlist.json under "exceptions" ' +
      'with reason+addedBy+addedAt, or replace the dependency.',
  );
  process.exit(1);
}

console.log(
  `License audit OK (${Object.keys(licenses).length} package(s) checked, ` +
    `${allowlist.exceptions.length} exception(s) tracked).`,
);
