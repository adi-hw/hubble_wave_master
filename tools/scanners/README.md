# Scanner Conventions

All scanners under this directory follow these rules:

- Exit non-zero on violation.
- Support CI mode (`--ci`, structured output) + local mode (default, human-readable).
- Emit both machine-readable JSON (`--json` or `--ci`) and human-readable summaries (default).
- Allowlists live alongside the scanner: `tools/scanners/<scanner-name>-allowlist.json`.
- Allowlist files have shape `{ "$schema": "./allowlist-schema.json", "entries": [...] }`.
- Every allowlist entry requires `rationale`, `addedBy`, `addedAt` PLUS either `target` (single-identifier form) or both `from` and `to` (relational form). Bare entries fail the scanner.
- Prelude scanners become permanent CI gates unless explicitly retired in a documented spec amendment.

Scanners introduced by Prelude:
- `entity-schema-ownership-check.ts` (Task 2)
- `cross-domain-import-check.ts` (Task 3)
- `migration-filename-check.ts` (Task 4)
- `permissions-annotation-coverage.ts` (Task 19)
- `abac-coverage-check.ts` (Task 20)
