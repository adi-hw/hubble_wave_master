import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { InstanceDbModule, CollectionAccessRule, PropertyAccessRule, PackReleaseRecord } from '@hubblewave/instance-db';
import { AuthGuardModule } from '@hubblewave/auth-guard';
import {
  AuthorizationModule,
  COLLECTION_ACL_REPOSITORY,
  PROPERTY_ACL_REPOSITORY,
} from '@hubblewave/authorization';
import { RedisModule } from '@hubblewave/redis';
import { HealthController } from './health.controller';
import { PacksController } from './packs/packs.controller';
import { PacksService } from './packs/packs.service';
import { IdentityModule } from './identity/identity.module';

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
    TypeOrmModule.forFeature([CollectionAccessRule, PropertyAccessRule, PackReleaseRecord]),
    AuthorizationModule.forRoot({
      enableCaching: true,
    }),
    RedisModule.forRoot(),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    IdentityModule,
  ],
  controllers: [
    HealthController,
    PacksController,
  ],
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
    PacksService,
  ],
})
export class AppModule implements NestModule {
  configure(_consumer: MiddlewareConsumer) {
    // Middleware configuration can be added here
  }
}
