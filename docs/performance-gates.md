# Performance Gates

Plan §12.4 — performance gates alongside correctness gates. Each phase
ships a load-test fixture that gates merge to main. Fixtures live in
this directory; CI runs them on tagged releases.

| Phase | Gate | Fixture | Owner |
|---|---|---|---|
| Phase 1 | Rollup recompute on a parent with 1k children completes within 30s p95 | `bench/rollup-recompute.fixture.ts` | svc-data |
| Phase 3a | 1k flow executions / minute sustained for 5 minutes | `bench/flow-throughput.fixture.ts` | svc-workflow |
| Phase 5 | Workspace render under 500ms p95 with 5 panels (RecordList + RecordDetail + Metrics + RelatedList + ActivityFeed) | `bench/workspace-render.fixture.ts` | web-client |

## Running the fixtures

```
# Local
npx ts-node bench/rollup-recompute.fixture.ts
npx ts-node bench/flow-throughput.fixture.ts
npx playwright test bench/workspace-render.fixture.ts

# CI (release branch only, gated by RELEASE_PERF_GATE=true)
npm run perf:rollup
npm run perf:flows
npm run perf:workspace
```

## Verification policy

A perf gate failure on a release branch blocks the merge. Drift on
main triggers a regression issue but does not auto-revert — perf
fixes ship as their own slice with a re-run of the fixture in the
PR description.

## Fixture seeds

Each fixture provisions its own data via the platform APIs (no raw
SQL) and tears down on completion. Seeds use deterministic UUIDv5
namespaces so runs are reproducible.

| Fixture | Seed scale | Cleanup |
|---|---|---|
| `rollup-recompute` | 1× parent collection, 1× rollup property, 1k child records | Drops child rows + parent at teardown |
| `flow-throughput` | 1× published flow with 5 nodes (Start → SetFieldValue → CreateRecord → SendNotification → End), no external connectors | Cancels in-flight instances, archives history |
| `workspace-render` | 1× published+active workspace with 5 panels bound to a 1k-row record collection | Deactivates workspace at teardown |
