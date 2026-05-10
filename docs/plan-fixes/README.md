# Plan Fixes — Status Index

Tracks architectural remediation efforts referenced in `CLAUDE.md`. Each fix has its own design doc when it has one.

## Status as of 2026-05-09 (Architecture v3 amendment)

| # | Title | Status | Notes |
|---|---|---|---|
| 1 | Automation engine consolidation | **Done** | Completed 2026-05; svc-automation owns the runtime. See `01-automation-consolidation.md`. |
| 8 | (TBD historical) | Active | Referenced in CLAUDE.md amendment log; no design doc yet. |
| 11 | Cache consolidation | **Done** | Completed in W5.C remediation wave. |
| 12 | Service-boundary scanner | **Superseded by Architecture v3** | The monolith makes cross-service entity ownership a non-issue at the language level. Scanner deletion is part of W1 final cleanup (after all 18 modules consolidate). |
| 13 | Canon §5/§10/§12/§14 amendments | **Done** | Completed in W5.B / 2026-05. |
| 14 | Per-automation rate limiting | **Done** | Completed in W7.C. |
| 15 | Approved-deps registry | **Done** | Completed in W6.D. |
| 16 | AVA proposal state machine | **Deferred (Architecture v3)** | Per canon §12 PER-FEATURE: the trust progression applies per AI feature when customer enables autonomous action. Activate per-feature when needed; not a platform-wide framework. |
| 24 | Per-service entity sets | **Superseded by Architecture v3** | The modular monolith uses one shared entity set inside `apps/api`. The "god-package" `libs/instance-db/src/lib/entities/index.ts` becomes the single source of truth for the API process; per-service splitting is no longer needed. |

## Active fixes after Architecture v3

The architectural shift introduces new tracked items:
- **ARC-W0** — canon amendments + scaffolds (this plan: `docs/superpowers/plans/2026-05-09-platform-w0-w1-foundation.md`)
- **ARC-W1** — API consolidation (this plan covers foundation modules; remaining modules in a follow-on plan)
- **ARC-W2** through **ARC-W8** — see spec §8

Refs spec: `docs/superpowers/specs/2026-05-09-platform-architecture-design.md`.
