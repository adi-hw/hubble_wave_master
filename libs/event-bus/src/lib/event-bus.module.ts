import { DynamicModule, Global, Logger, Module, Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';

import {
  DEFAULT_EVENT_BUS_CHANNEL_PREFIX,
  EVENT_BUS_CHANNEL_PREFIX,
  EVENT_BUS_PUBLISHER,
  EVENT_BUS_SUBSCRIBER,
} from './event-bus.constants';
import { EventBusService } from './event-bus.service';

/**
 * Internal cross-service event bus on Redis pub/sub.
 *
 * Uses the same Redis connection settings as `RedisModule` (REDIS_HOST,
 * REDIS_PORT, REDIS_PASSWORD, REDIS_DB, REDIS_TLS) so a single Redis instance
 * carries both caches and events. The bus opens its own dedicated connections
 * because ioredis cannot multiplex pub/sub with regular commands on one
 * client — `RedisModule`'s connection is reserved for caching/sessions.
 *
 * Channel prefix defaults to `hw:events:` and may be overridden via
 * `EVENT_BUS_CHANNEL_PREFIX` for environments that share a Redis with other
 * services.
 */
@Global()
@Module({})
export class EventBusModule {
  private static readonly logger = new Logger('EventBusModule');

  static forRoot(): DynamicModule {
    const publisherProvider: Provider = {
      provide: EVENT_BUS_PUBLISHER,
      useFactory: (configService: ConfigService) =>
        EventBusModule.createClient(configService, 'publisher'),
      inject: [ConfigService],
    };

    const subscriberProvider: Provider = {
      provide: EVENT_BUS_SUBSCRIBER,
      useFactory: (configService: ConfigService) =>
        EventBusModule.createClient(configService, 'subscriber'),
      inject: [ConfigService],
    };

    const channelPrefixProvider: Provider = {
      provide: EVENT_BUS_CHANNEL_PREFIX,
      useFactory: (configService: ConfigService) =>
        configService.get<string>(
          'EVENT_BUS_CHANNEL_PREFIX',
          DEFAULT_EVENT_BUS_CHANNEL_PREFIX,
        ),
      inject: [ConfigService],
    };

    return {
      module: EventBusModule,
      imports: [ConfigModule],
      providers: [
        publisherProvider,
        subscriberProvider,
        channelPrefixProvider,
        EventBusService,
      ],
      exports: [EventBusService],
    };
  }

  private static createClient(
    configService: ConfigService,
    role: 'publisher' | 'subscriber',
  ): Redis {
    const host = configService.get<string>('REDIS_HOST', 'localhost');
    const port = configService.get<number>('REDIS_PORT', 6379);
    const password = configService.get<string>('REDIS_PASSWORD');
    const db = configService.get<number>('REDIS_DB', 0);
    const useTls = configService.get<string>('REDIS_TLS', 'false') === 'true';

    const options: RedisOptions = {
      host,
      port,
      password: password || undefined,
      db,
      tls: useTls ? {} : undefined,
      retryStrategy: (times) => {
        if (times > 10) {
          EventBusModule.logger.error(
            `Event bus ${role} failed to reconnect after 10 retries`,
          );
          return null;
        }
        return Math.min(times * 100, 3000);
      },
      // The subscriber must not have maxRetriesPerRequest set — ioredis
      // rejects subscribe-mode commands once the limit is reached.
      maxRetriesPerRequest: role === 'subscriber' ? null : 3,
      enableReadyCheck: true,
      lazyConnect: false,
    };

    const client = new Redis(options);

    client.on('connect', () =>
      EventBusModule.logger.log(`Event bus ${role} connected`),
    );
    client.on('error', (err: Error) =>
      EventBusModule.logger.error(
        `Event bus ${role} error: ${err.message}`,
      ),
    );
    client.on('close', () =>
      EventBusModule.logger.warn(`Event bus ${role} connection closed`),
    );

    return client;
  }
}
