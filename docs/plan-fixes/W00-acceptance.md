# W0 Acceptance — 2026-05-09

Wave 0 (Foundation: Make Scanners Truthful) has shipped. This document records the deliverables, surfaced findings, and items handed to later waves.

## Findings Closed

| ID | Finding | Resolution | Commit |
|---|---|---|---|
| **F018** | `authz-bypass-check.ts` only scans svc-data | Extended SERVICE_ROOTS to all 11 instance services with documented control-plane carve-out (canon §18) | `5204617` |
| **F056** | service-boundary scanner has no AutomationRule write rule | Added secondary detection for `getRepository('table_name')` and raw SQL `INSERT/UPDATE/DELETE` patterns. Import-topology rule already existed; combined now blocks all known bypass routes | `def8b15` |
| **F104** | ESLint enforces almost nothing canon §21 claims | New rules at error severity: no-warning-comments, @typescript-eslint/no-unused-vars, hw/no-versioned-identifier (custom). Deferred: react-hooks/rules-of-hooks (W1), naming-convention (W4) | `bdbe876` |
| **F105** | PUBLIC_ALLOWLIST drift + cross-platform path bug + commented-references false-positive | Reconciled to 27 entries in 5 categories; fixed Windows backslash-in-`/src/app/`-filter; tightened detection to ignore JSDoc/block-comment references | `e4cee2b` |
| **F106** | CD bypasses CI gates | CD now uses `workflow_run` trigger gated on CI success; checkouts pinned to upstream `head_sha`; `cicd:check` scanner enforces wiring | `4b3377e` |
| **F119** | No SBOM, license-scan, or secret-scan in CI | gitleaks, anchore/syft + grype, npx license-checker + tools/validate-licenses.ts; required CI gates | `fc4c440`, `e4aeb71` |
| **D.6** | Anti-resurrection scanner | `tools/dead-code-check.ts` + 12-entry W4-attributed allowlist + 11-assertion self-test | `8c11160` |

## Findings Newly Surfaced (Tracked for Later Waves)

| ID | Finding | Owning Wave |
|---|---|---|
| **F151** | `compliance:check` was broken — `glob` dep missing; replaced with native fs walk | (closed in W0 task 1.5: `a2ee9dc`) |
| **F152** | `compliance:check:strict` exits 0 even with 7 errors — strict-mode exit logic broken | W4 |
| **F153** | TODO: Implement property deletion via API (PropertiesPage.tsx:62) | W7 |
| **F154** | TODO: Pre-populate PropertyEditor with suggested type and options (PropertiesPage.tsx:71) | W9 |

## Findings Reconciled Against Reality (Master Roadmap Revisions)

The W0 baseline (`docs/plan-fixes/W00-baseline-2026-05-09.md`) revised several audit findings against the actual code state:

- **F055** RESOLVED-PRE-W0 — Plan Fix 1 (commit `e575a76`, 2026-05-04) consolidated svc-data automation correctly. Audit reviewer's claim of 17 files was incorrect; only `sync-trigger-client.service.ts` + spec remain.
- **F058, F059, F071** likely-resolved with F055 — to be re-verified at W4 start.
- **F107** narrowed — only `bcrypt` remains; node-cache and @hello-pangea/dnd were already removed.

## Scanner Coverage

8 architectural scanners + 1 lint enforcement framework, all CI-gated:

| Scanner | Self-test assertions | Status |
|---|---|---|
| `compliance:check` | (no self-test yet — covered by `selftest:framework` runScannerOnFixture pattern; hand-verified) | ok (7 errors, F152 tracked) |
| `authz:check` | 7/7 | ok (1 entry tracked → W2/F146) |
| `audit:check` | (no self-test yet) | ok |
| `security:check` | 7/7 | ok |
| `service-boundary:check` | 12/12 | ok (4 ownership + 4 write-bypass rules + 7 allowlisted reads) |
| `deps:check` | (no self-test yet) | ok (1 entry tracked → W4/bcrypt) |
| `cicd:check` | (no self-test yet) | ok |
| `dead-code:check` | 11/11 | ok (12 entries tracked → W4) |
| `hw/no-versioned-identifier` (custom ESLint rule) | 14 valid + 7 invalid cases | ok |

**Total scanner self-test surface: 44 assertions across 5 suites (framework + security + authz + service-boundary + dead-code) + 21 ESLint rule assertions = 65 verifications running on every CI.**

Remaining scanners without self-tests (`compliance`, `audit`, `deps`, `cicd`) are the lower-leverage targets where a regression would still surface via `selftest:framework`'s contract test on fixture-based scanner output. Adding per-scanner selftests for these is W11 verification work.

## CI Gate Configuration

Scanners now wired into `.github/workflows/ci.yml` `scanners` job in this order:

1. authz:check
2. audit:check
3. security:check
4. compliance:check:strict
5. service-boundary:check
6. deps:check
7. cicd:check (NEW W0 task 7)
8. dead-code:check (NEW W0 task 10)
9. selftest:scanners (NEW W0 task 2)

Plus separate jobs:
- `gitleaks` (W0 task 8)
- `sbom` (W0 task 9 — anchore/syft + grype)
- `license-audit` (W0 task 9 — license-checker + tools/validate-licenses.ts)

Required-status-check configuration is documented in `docs/plan-fixes/W00-required-status-checks.md` for the repo admin to apply post-merge.

## Verification Sweep (2026-05-09 HEAD `bdbe876`)

```
=== compliance:check === errors=7 warnings=2409 info=1115 (F152 strict-mode bug)
=== authz:check === ok (1 tracked → W2/F146)
=== audit:check === ok
=== security:check === ok
=== service-boundary:check === ok (4+4 rules, 7 reads tracked)
=== deps:check === ok (1 legacy → W4/bcrypt)
=== cicd:check === ok
=== dead-code:check === ok (12 tracked → W4)
=== selftest:scanners === 44/44 assertions passed
=== selftest:eslint-rules === 21 cases passed
```

## Risks Carried Forward

1. **Required-status-check configuration is a repo-admin operation** — gates exist in CI but won't block merges until the admin applies the `W00-required-status-checks.md` runbook. Track via the GitHub issue created at PR open.
2. **F111 (live private key in `SECRETS_ROTATION.md:155-168`)** — gitleaks now CATCHES this on every PR but the rotation + history-rewrite is W1 P0. Do not delay W1.
3. **89 pre-existing ESLint errors in unchanged files** (no-unused-vars, no-case-declarations, no-inferrable-types, etc.) do not currently fail CI because lint runs `nx affected`. Touched files surface them and require cleanup before merge — this is the intended ratchet.
4. **F121 + F153 + F154** are TODO comments now allowlisted with structured finding/wave references; W7 + W9 will drive these to zero.
5. **F146** (svc-insights dashboard authz bypass) is now visibly tracked on every CI run via the authz scanner's success-output. W2 will fix.
6. **W4 backlog** is now CI-visible: 12 dead-code-check entries + 7 service-boundary read crossings + 1 deps:check legacy + ~3500 compliance:check terminology violations all surface on each run.

## Wave 1 Hand-off

W1 (Stop-the-Bleeding) can begin immediately. The W0 work means:
- gitleaks is wired and will surface the SECRETS_ROTATION.md private key on first run.
- ESLint is real, so any W1 fixes that touch a file with pre-existing lint errors must clean them up.
- `dead-code-check.ts` will catch new dead code introduced by W1 work.
- `service-boundary-check.ts` will enforce the entity ownership canon.

## Files Changed in W0

12 commits, totaling ~6500 LOC additions / ~50 LOC deletions across:

- 5 new scanners + their self-tests (`tools/`)
- 1 new custom ESLint rule + spec (`tools/eslint-rules/`)
- 5 new CI/CD config files / extensions (`.github/`, `.gitleaks.toml`, `eslint.config.mjs`)
- 4 new docs (`docs/plan-fixes/00-master-remediation-roadmap.md`, `W00-foundation.md`, `W00-baseline-2026-05-09.md`, `W00-required-status-checks.md`, this acceptance doc)
- 5 small inline fixes (3 unused-error renames, 2 prefer-const, 2 no-useless-escape, 4 no-warning-comments allowlist comments)
- 12-entry dead-code-allowlist + 2-entry license-allowlist + reconciled deps:check legacy to 1 entry
