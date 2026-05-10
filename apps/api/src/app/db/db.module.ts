import { Global, Module } from '@nestjs/common';
import { InstanceDbModule } from '@hubblewave/instance-db';

/**
 * DbModule provides the customer-instance Postgres datasource, TypeORM repositories,
 * the `withAudit` transaction helper, and audit/identity-cache subscribers. It wraps
 * the canonical `InstanceDbModule` from `@hubblewave/instance-db` (single source of
 * truth for the datasource configuration) so apps/api consumers can inject
 * `@InjectDataSource()`, `@InjectRepository(...)`, and `InstanceDbService` without
 * importing from libs directly.
 *
 * @Global so consumers don't need explicit DbModule imports.
 *
 * The canonical config lives in `libs/instance-db/src/lib/instance-db.module.ts`:
 * forRootAsync uses ConfigService to read DB_HOST, DB_PORT, DB_USER, DB_PASSWORD,
 * DB_NAME, DB_SSL, DB_LOGGING, pool settings. Subscribers wire in
 * AuditLogSubscriber + IdentityCacheInvalidationSubscriber. All instance entities
 * are loaded.
 */
@Global()
@Module({
  imports: [InstanceDbModule],
  exports: [InstanceDbModule],
})
export class DbModule {}
