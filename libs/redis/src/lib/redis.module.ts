import { Module, Global, DynamicModule, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisService } from './redis.service';
import { REDIS_CLIENT } from './redis.constants';

export interface RedisModuleOptions {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}

@Global()
@Module({})
export class RedisModule {
  private static readonly logger = new Logger('RedisModule');

  /**
   * Register Redis module with configuration from environment variables
   */
  static forRoot(): DynamicModule {
    return {
      module: RedisModule,
      providers: [
        {
          provide: REDIS_CLIENT,
          useFactory: (configService: ConfigService) => {
            const host = configService.get<string>('REDIS_HOST', 'localhost');
            const port = configService.get<number>('REDIS_PORT', 6379);
            const password = configService.get<string>('REDIS_PASSWORD');
            const db = configService.get<number>('REDIS_DB', 0);
            const useTls = configService.get<string>('REDIS_TLS', 'false') === 'true';

            this.logger.log(`Connecting to Redis at ${host}:${port} (db: ${db}, tls: ${useTls})`);

            const redis = new Redis({
              host,
              port,
              password: password || undefined,
              db,
              keyPrefix: 'hw:', // HubbleWave prefix for all keys
              tls: useTls ? {} : undefined,
              retryStrategy: (times) => {
                if (times > 10) {
                  this.logger.error('Redis connection failed after 10 retries');
                  return null; // Stop retrying
                }
                const delay = Math.min(times * 100, 3000);
                this.logger.warn(`Redis reconnecting in ${delay}ms (attempt ${times})`);
                return delay;
              },
              maxRetriesPerRequest: 3,
              enableReadyCheck: true,
              lazyConnect: false,
            });

            redis.on('connect', () => {
              this.logger.log('Redis connected');
            });

            redis.on('ready', () => {
              this.logger.log('Redis ready');
            });

            redis.on('error', (error) => {
              this.logger.error('Redis error:', error.message);
            });

            redis.on('close', () => {
              this.logger.warn('Redis connection closed');
            });

            redis.on('reconnecting', () => {
              this.logger.log('Redis reconnecting...');
            });

            return redis;
          },
          inject: [ConfigService],
        },
        RedisService,
      ],
      exports: [REDIS_CLIENT, RedisService],
    };
  }

  /**
   * Register Redis module with custom options
   */
  static forRootAsync(options: RedisModuleOptions): DynamicModule {
    return {
      module: RedisModule,
      providers: [
        {
          provide: REDIS_CLIENT,
          useFactory: () => {
            const host = options.host || 'localhost';
            const port = options.port || 6379;

            this.logger.log(`Connecting to Redis at ${host}:${port}`);

            const redis = new Redis({
              host,
              port,
              password: options.password,
              db: options.db || 0,
              keyPrefix: options.keyPrefix || 'hw:',
              retryStrategy: (times) => {
                if (times > 10) return null;
                return Math.min(times * 100, 3000);
              },
              maxRetriesPerRequest: 3,
            });

            redis.on('connect', () => this.logger.log('Redis connected'));
            redis.on('error', (err) => this.logger.error('Redis error:', err.message));

            return redis;
          },
        },
        RedisService,
      ],
      exports: [REDIS_CLIENT, RedisService],
    };
  }
}
