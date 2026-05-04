# CI Gates

Every PR opened against `master` (or `main` / `develop`) must pass the
checks defined in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).
Builds fail if violations exist (canon §21).

## Required jobs

1. **Architectural CI gates** (`scanners`) — six scripts that exit non-zero
   on canon violations, run sequentially in a single job:

   | Step                          | Script                          | Canon section / Wave |
   |-------------------------------|---------------------------------|----------------------|
   | Authorization bypass check    | `npm run authz:check`           | §9 / W1.2            |
   | Audit-in-transaction check    | `npm run audit:check`           | §10 / W1.6           |
   | Security bypass check         | `npm run security:check`        | §9                   |
   | Canon terminology compliance  | `npm run compliance:check:strict` | §1, §21            |
   | Service boundary check        | `npm run service-boundary:check`| §3 / W5.D            |
   | Approved-dependencies check   | `npm run deps:check`            | W6.D                 |

2. **Lint & Format** (`lint`) — `npx nx affected --target=lint --parallel=3`
   plus `npx nx format:check`.

3. **TypeScript Check** (`typecheck`) — `npx nx affected --target=build`.

4. **Unit Tests** (`unit-tests`) — `npx nx affected --target=test --coverage`
   against ephemeral Postgres and Redis services.

5. **E2E Tests** (`e2e-tests`) — `npx nx affected --target=e2e` with
   Playwright browsers installed.

6. **Security Scan** (`security`) — `npm audit --audit-level=high` and
   Trivy filesystem scan.

7. **Build All** (`build`) — `npx nx affected --target=build`. Depends on
   `lint`, `typecheck`, and `scanners`; only runs once those pass.

## Branch protection

The `master` branch protection rule SHOULD mark every job above as a
required status check. CI parses violations on the merge state, so a PR
that does not touch a violating file can still be blocked when the merge
base contains an existing canon violation — that is the point: the rule
does not allow new merges to silently inherit drift.

Configuring the protection rule itself is a GitHub-admin action and is
not performed by this workflow file.

## Adding a new scanner

When a future remediation wave introduces a new architectural scanner:

1. Add the script to `package.json` under `scripts`, exiting non-zero on
   violation.
2. Append a step to the `scanners` job in `.github/workflows/ci.yml`,
   labelled with the canon section it enforces and the originating wave.
3. Update the table above with the same metadata.
4. Verify the script exits 0 against `master` HEAD, or land the fix that
   makes it exit 0 in the same change.

The order of steps in the `scanners` job is the order in which violations
are reported. Cheap, fast checks should run first.
