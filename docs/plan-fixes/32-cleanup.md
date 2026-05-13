# Plan Fix 32 — Cleanup

**Status:** Complete (single PR)
**Owner:** adi-hw
**Effort:** 1 PR (doc-only)
**Related canon clauses:** §1, §10, §24
**Triggering audit:** post-W5/W6 wave cleanup of loose ends

## Context

Three small loose ends from the W5 audit wave + the PR #48 accidental merge:
1. W5.J allowlist entry in silent-skip-check.ts needs final disposition
2. Plan Fix 25 doc still says "In progress" despite the wave completing across PRs #35/#37/#42/#46
3. §24 amendment order has Plan Fix 30 PR-2 above Plan Fix 31; per commit-landing dates, Plan Fix 31 is more recent

## Actions

1. **W5.J finalized** — `tools/silent-skip-check.ts` `KNOWN_DEFERRED_OFFENDERS` entry for
   `libs/enterprise/src/lib/audit.service.ts` updated: `followUp` changed from `'W5.J'` to
   `'permanent'`; `rationale` field added documenting that `continue` filters disabled rules
   (not an error path) and `logger.warn` is on the success path (alert matched). No code change
   required; this is a confirmed false-positive.

2. **Plan Fix 25 marked Complete** — Status header updated to reflect wave completion across
   PRs #35 (W5.A), #37 (W5.B), #42 (W5.G), #46 (W5.I). Completion summary section added with
   per-PR outcomes and note that W5.B reconciliation to master is tracked separately.

3. **§24 reorder** — Plan Fix 31 entry moved above Plan Fix 30 PR-2 entry in CLAUDE.md to
   restore strict commit-landing chronological order. Plan Fix 32 amendment entry added at top.

## Acceptance

- `tools/silent-skip-check.ts` KNOWN_DEFERRED_OFFENDERS entry has `followUp: 'permanent'`
  and a `rationale` field — no active deferred work remains
- `docs/plan-fixes/25-audit-transaction-sweep.md` Status header reads "Complete"
- §24 amendment list has Plan Fix 31 above Plan Fix 30 PR-2

## Out of scope

- W5.B reconciliation to master (separate concern)
- Other §24 ordering reviews
- Any code changes to service files or scanners beyond the allowlist entry metadata
