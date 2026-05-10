import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';

import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });

  // BullMQ consumers and scheduled-job processors are registered as Nest
  // providers in the worker's modules. They start automatically as part of
  // application initialization.

  Logger.log('apps/worker started; BullMQ consumers active', 'Bootstrap');

  // Graceful shutdown on SIGTERM/SIGINT
  process.on('SIGTERM', async () => {
    Logger.log('SIGTERM received; shutting down', 'Bootstrap');
    await app.close();
    process.exit(0);
  });
  process.on('SIGINT', async () => {
    Logger.log('SIGINT received; shutting down', 'Bootstrap');
    await app.close();
    process.exit(0);
  });
}

bootstrap();
