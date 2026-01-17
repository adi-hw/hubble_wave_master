import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageConfig, loadStorageConfig } from './storage.config';
import { STORAGE_CLIENT } from './storage.client';
import { createMinioClient } from './minio/minio.client';
import { S3StorageClient } from './s3/s3.client';

export const STORAGE_CONFIG = 'STORAGE_CONFIG';

@Module({})
export class StorageModule {
  static forRoot(): DynamicModule {
    return {
      module: StorageModule,
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        {
          provide: STORAGE_CONFIG,
          useFactory: (): StorageConfig => loadStorageConfig(),
        },
        {
          provide: STORAGE_CLIENT,
          useFactory: (config: StorageConfig) =>
            config.provider === 'minio'
              ? createMinioClient(config)
              : new S3StorageClient(config),
          inject: [STORAGE_CONFIG],
        },
      ],
      exports: [STORAGE_CLIENT, STORAGE_CONFIG],
    };
  }
}
