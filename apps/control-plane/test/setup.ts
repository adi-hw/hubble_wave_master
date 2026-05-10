/**
 * Global Jest setup for apps/control-plane tests.
 *
 * Loaded via apps/control-plane/jest.config.cts `setupFilesAfterEnv` setting.
 * Currently a no-op; per-test database lifecycle is handled by individual
 * tests using createTestDataSource() from helpers/test-database.ts.
 */

// Increase default timeout for integration tests that spin up Postgres.
jest.setTimeout(30_000);
