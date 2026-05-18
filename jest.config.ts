import type { Config } from 'jest';
import { getJestProjectsAsync } from '@nx/jest';

/**
 * Root Jest configuration.
 *
 * `getJestProjectsAsync` walks the Nx project graph and returns every
 * jest.config the workspace declares. Nested git worktrees rooted
 * under the repo (e.g. `phase4-wt/`) carry duplicate `apps/` and
 * `libs/` entries that would fire as "Apparent project name collision
 * detected" because Nx ingests them as parallel projects. The
 * `.nxignore` file at the repo root excludes those paths from the
 * project graph; this config adds a defense-in-depth `testPathIgnorePatterns`
 * sweep so even a project that slips through Nx's filter cannot poison
 * a root `jest` invocation.
 */
export default async (): Promise<Config> => ({
  projects: await getJestProjectsAsync(),
  // Mirror `.nxignore`'s `*-wt/` rule. Any path containing a `-wt/`
  // worktree-suffix directory is skipped regardless of which project
  // claims it.
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/phase4-wt/',
    '-wt/',
  ],
});
