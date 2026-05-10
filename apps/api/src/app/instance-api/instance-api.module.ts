import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { InstanceDbModule, CollectionAccessRule, PropertyAccessRule } from '@hubblewave/instance-db';
import { AuthGuardModule, GlobalGuardsModule } from '@hubblewave/auth-guard';
import {
  AuthorizationModule,
  COLLECTION_ACL_REPOSITORY,
  PROPERTY_ACL_REPOSITORY,
} from '@hubblewave/authorization';
import { RedisModule } from '@hubblewave/redis';
import { IdentityModule } from './identity/identity.module';
import { InstanceApiHealthController } from './instance-api-health.controller';

/**
 * InstanceApiModule is the full fold-in of svc-instance-api into apps/api
 * per ARC-W1 Task 3. It owns the instance-plane auth-flow surface
 * (login/logout/refresh/SSO config) and pack install token guard.
 *
 * The IdentityModule imported here is the instance-api auth-flow wrapper at
 * ./identity/identity.module.ts — distinct from the canonical svc-identity
 * IdentityModule at apps/api/src/app/identity/identity.module.ts. The two
 * classes coexist in separate scopes; only the canonical one is imported
 * directly by the root AppModule.
 *
 * Global infrastructure (ThrottlerModule, InstanceDbModule, AuthGuardModule,
 * GlobalGuardsModule, AuthorizationModule, RedisModule, ScheduleModule,
 * EventEmitterModule) mirrors the original svc-instance-api app.module.ts
 * exactly so the parallel-deployment thin adapter continues to work
 * without any runtime delta.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ([{
        ttl: config.get<number>('RATE_LIMIT_TTL', 60000),
        limit: config.get<number>('RATE_LIMIT_MAX', 100),
      }]),
    }),
    InstanceDbModule,
    AuthGuardModule,
    GlobalGuardsModule,
    TypeOrmModule.forFeature([CollectionAccessRule, PropertyAccessRule]),
    AuthorizationModule.forRoot({
      enableCaching: true,
    }),
    RedisModule.forRoot(),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    IdentityModule,
  ],
  controllers: [InstanceApiHealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: COLLECTION_ACL_REPOSITORY,
      useFactory: (repo: Repository<CollectionAccessRule>) => repo,
      inject: [getRepositoryToken(CollectionAccessRule)],
    },
    {
      provide: PROPERTY_ACL_REPOSITORY,
      useFactory: (repo: Repository<PropertyAccessRule>) => repo,
      inject: [getRepositoryToken(PropertyAccessRule)],
    },
  ],
  exports: [],
})
export class InstanceApiModule {}
