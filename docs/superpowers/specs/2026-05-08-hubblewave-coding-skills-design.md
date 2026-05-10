# HubbleWave Coding Skills — Design Spec

**Date:** 2026-05-08
**Author:** brainstorming session, adi-hw + Claude Opus 4.7 (1M context)
**Status:** Approved (design); pending implementation
**Implementation skill:** `superpowers:writing-skills` (TDD for skills)

---

## 1. Motivation

Agents (Claude and otherwise) coding on HubbleWave repeatedly violate four classes of rule that the canon (CLAUDE.md) makes explicit but the compiler/linter cannot catch:

- **B.** TODO/FIXME comments, "for now" / "temporary" language, V1/V2/legacy/migration references
- **D.** Cross-service boundary violations — putting automation logic in svc-data, leaking `customerId` into instance services, control-plane reaching into instance DBs
- **E.** Plan-Fix workflow drift — wrong naming, scanner allowlists growing without justification, canon changes landing without §24 amendment
- **F.** Speculative scaffolding — features beyond the task, premature abstractions, "just in case" validation, unused params/feature flags

These are *discipline* and *structural* failures, not bugs. They survive code review when the reviewer is rushed. They erode the canon's "execution contract" framing (Part IV §22–§23) one PR at a time.

Skills are the right intervention because they:
1. Sit in agent context at decision time (not after-the-fact in code review)
2. Can encode rationalization counters that linters cannot
3. Are reusable across every coding session in the repo

## 2. Skill Set

Three skills. Personal-first deployment to `~/.claude/skills/{name}/SKILL.md`, promoted to repo (`.claude/skills/` at repo root) only after pressure-testing in real sessions.

### 2.1 `hubblewave-greenfield-discipline` — Discipline skill

**Frontmatter description:**
> Use when adding or editing code in a HubbleWave service or library — every change ships to production today; no TODOs/FIXMEs, no "for now"/"temporary"/"legacy" language, no V1/V2/migration references, no speculative scaffolding, no abstractions for hypothetical needs.

**In scope (combines failure modes B + F):**
- Canon §1 absolutes: no V1/V2/legacy refs; no `temporary`/`replace later`/`for now`/`legacy workaround` comments; no TODO/FIXME/commented-out code/dead branches; no speculative scaffolding
- Canon §2: naming intentional and final (no "Helper", "Utils", "Manager" without domain meaning)
- Canon §15: speed never justifies decay
- System-prompt anti-speculation rule: three similar lines beats premature abstraction; no error handling for impossible cases; no validation outside system boundaries; no unused params/feature flags "just in case"
- The legitimate exception path: explicit allowlist entry in a CI scanner with comment + Plan-Fix link, **never** a TODO
- Rationalization counter-table built from RED-phase pressure-tests
- Red flags list

**Out of scope:** service boundaries (Skill 2), Plan-Fix process (Skill 3), authz/audit specifics (covered by existing CI scanners outside this skill set)

### 2.2 `hubblewave-service-boundaries` — Technique skill

**Frontmatter description:**
> Use when adding a feature, endpoint, or DB write in HubbleWave — picks the correct service before coding; svc-automation owns automation tables, svc-data owns business records, instance services never use `customerId`, control-plane never reaches into instance DBs.

**In scope (failure mode D):**
- Plane separation (Canon §17–§19): Control Plane = multi-tenant SaaS (`customerId` allowed); Customer Instance = single-tenant (no tenant ID in business logic)
- Service ownership matrix:
  - `svc-automation` — `AutomationRule`, `AutomationExecutionLog`, scheduling, AVA bridge, runtime (post Plan-Fix-1)
  - `svc-data` — business records (rows in user collections); thin HTTP client to svc-automation
  - `svc-metadata` — schema/properties/views/forms/`PropertyReferenceScanner`
  - `svc-identity` — users, sessions, tokens
  - `svc-workflow` — long-running, stateful, human-aware (≠ automation)
  - `svc-ava` — AI reasoning + proposal state machine (Plan Fix 16)
  - `svc-control-plane` — customer registry, instance lifecycle, license (multi-tenant by design)
  - `svc-notify` — outbound notifications
  - `svc-insights` — analytics
  - `svc-instance-api` — public API gateway for an instance
  - `svc-view-engine` — view rendering
  - `svc-migrations` — TypeORM migration runner
- Cross-service rules: HTTP client pattern (no direct DB writes across services); Control-Plane → Instance only via versioned, audited APIs
- Decision aid: "I want to add X — where does it go?" mini-flowchart
- Reference scanner: `npm run service-boundary:check` (currently 0 violations after W5.D)

**Out of scope:** internal architecture of any single service; exhaustive `libs/*` ownership

### 2.3 `hubblewave-plan-fix-workflow` — Reference skill

**Frontmatter description:**
> Use when starting architectural remediation on HubbleWave — names work as W{wave}.{letter}, runs the six scanners, updates KNOWN_*_OFFENDERS allowlists responsibly, amends Canon §24 when architecture shifts.

**In scope (failure mode E):**
- Naming: `W{wave}.{letter}` (e.g., `W6.A`, `W7.D`); plan-fix docs at `docs/plan-fixes/NN-name.md`
- The six scanners — what each blocks, when to run:
  - `npm run authz:check` (W1.2)
  - `npm run audit:check` (W1.6)
  - `npm run security:check`
  - `npm run service-boundary:check` (W5.D)
  - `npm run deps:check` (W6.D)
  - `npm run compliance:check`
- `KNOWN_DEFERRED_OFFENDERS` / `KNOWN_VIOLATIONS` allowlist hygiene:
  - Only when there's a tracked plan to fix
  - Entry must include comment with reason + Plan-Fix number
  - Allowlists shrink over time, never grow casually
  - Removing entries when work lands (e.g., W2.E zeroed offenders, W5.D zeroed violations)
- Canon §24 amendments: date, fix code, 1-line summary; PR-only, never silent
- Commit conventions: `feat(area): description (W7.X / Plan Fix N)` and `Merge W7.X: …`
- Acceptance: green branches must have 0 scanner violations

**Out of scope:** writing scanner code; semantics each scanner detects (covered by Skill 1 + scanner sources)

## 3. Build Sequence

```
1. hubblewave-greenfield-discipline  →  full RED-GREEN-REFACTOR
2. hubblewave-service-boundaries     →  application test
3. hubblewave-plan-fix-workflow      →  retrieval test
```

Greenfield first — highest leverage, most pressure-prone, lessons inform the others. Service boundaries second — depends on no other skill but benefits from greenfield's anti-over-engineering frame. Plan-Fix last — reference content, cheapest to validate.

## 4. Testing Strategy

### Skill 1 (Greenfield) — full TDD

1. **RED.** Spawn `general-purpose` subagent without skill loaded. Run 3 pressure scenarios (time, sunk-cost, hypothetical-future). The canon §1/§2/§15 snippet is in their context (so "I didn't know" is unavailable); the pressure is on. Capture verbatim rationalizations.
2. **GREEN.** Write SKILL.md targeting those exact rationalizations. Each rationalization = one row in counter-table. Each canon clause = one rule.
3. **GREEN verify.** Spawn fresh subagent with skill. Same 3 scenarios. Agent should refuse rationalization and reach for allowlist mechanism (or refuse the request).
4. **REFACTOR.** New rationalization → add counter → re-test. Stop when 2 consecutive runs produce no new rationalizations.

### Skill 2 (Service Boundaries) — application test

1. Write skill from canon §17–§19, service inventory, service-boundary scanner rules.
2. Spawn subagent with skill. Run 2 application scenarios:
   - "I want to add a 'pause automation' API. Where does the endpoint live? Where does the DB write happen?"
   - "I'm in svc-control-plane and need a customer's record count. How do I get it?"
3. Verify answers match the ownership matrix.
4. Wrong answer → sharpen matrix or decision aid → re-test.

### Skill 3 (Plan Fix Workflow) — retrieval test

1. Write skill from canon §24 amendment history, plan-fix docs, package.json scanner scripts.
2. Spawn subagent with skill. Ask 3 procedural questions:
   - "I'm starting Plan Fix 24. What's the wave/letter naming convention?"
   - "I added a temporary scanner exception. How do I track it without breaking discipline?"
   - "Did this architectural change need a canon amendment? Where does it go?"
3. Verify factual accuracy.

### Subagent dispatch detail (RED phase, Skill 1)

Each pressure prompt uses this shape:
> *"You're working on the HubbleWave repo. [Concrete urgent context that creates pressure]. Here's the canon snippet [§1, §2, §15 only — no skill]. The user just asked you to [task]. What do you do? Show your reasoning."*

Failure modes to expect: rationalize the rule away ("the canon says no TODOs but this case is different"), pretend to comply while slipping ("I'll add a comment that's not technically a TODO"), invent escape hatches not in the canon.

## 5. Acceptance Criteria

| Skill | Passes when… |
|-------|--------------|
| Greenfield | 2 consecutive subagent runs across 3+ pressure scenarios produce no new rationalizations and reach for the allowlist mechanism (or refuse) when an exception is genuinely needed |
| Service Boundaries | Subagent correctly answers 2/2 application scenarios from the ownership matrix without hallucinating service responsibilities |
| Plan Fix Workflow | Subagent correctly answers 3/3 retrieval questions; cites canon §24 + plan-fix doc location accurately |

## 6. Deliverables

- 3 SKILL.md files at `~/.claude/skills/{skill-name}/SKILL.md`
- Test transcripts (RED failure + GREEN pass for Skill 1; application/retrieval passes for 2 and 3) recorded in this spec or an adjacent transcript file
- This spec doc committed to the repo

## 7. Out of Scope (this session)

- Other candidate skills (authz/audit/AVA/control-plane-vs-instance) — backlog
- Repo-promotion to `.claude/skills/`
- CI integration of skill discovery

## 8. Risks

- **Subagent baseline may not reproduce real-world failures.** Mitigation: scenarios drawn from concrete recent commits and `KNOWN_*_OFFENDERS` allowlist history during RED phase.
- **Three skills in one session may dilute rigor.** Mitigation: calibrated rigor per skill type; if Skill 1 takes longer than budgeted, defer 2/3 to a follow-up session rather than rush them.
- **Canon evolution may stale the skills.** Mitigation: skills cite canon section numbers (§1, §17–§19, §24) — the canon stays the source of truth, skills are reference indices into it.

## 9. Open Questions

None. Design approved end-to-end via brainstorming session 2026-05-08.
