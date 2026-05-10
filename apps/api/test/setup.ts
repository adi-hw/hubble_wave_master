/**
 * Global Jest setup for apps/api tests.
 *
 * Loaded via apps/api/jest.config.ts `setupFilesAfterEach` setting.
 * Currently a no-op; per-test database lifecycle is handled by individual
 * tests using createTestDataSource() from helpers/test-database.ts.
 */

// Increase default timeout for integration tests that spin up Postgres.
jest.setTimeout(30_000);
