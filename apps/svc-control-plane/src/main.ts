/**
 * HubbleWave Control Plane API
 * Manages customer provisioning, instances, licenses, and platform operations
 */

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app/app.module';
import { ConfigService } from '@nestjs/config';
import { assertSecureConfig } from '@hubblewave/shared-types';

async function bootstrap() {
  // SECURITY: Validate configuration before starting
  // This will throw in production if insecure defaults are detected
  assertSecureConfig();

  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Security middleware
  app.use(helmet());

  const corsOrigins =
    config.get<string>('CONTROL_PLANE_UI_URL') ||
    config.get<string>('CONTROL_PLANE_CORS_ORIGINS', '');
  const parsedOrigins = corsOrigins
    ? corsOrigins.split(',').map((o) => o.trim()).filter(Boolean)
    : ['http://localhost:4200', 'http://localhost:4300'];

  app.enableCors({
    origin: parsedOrigins,
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  const httpEnabled = config.get<string>('CONTROL_PLANE_HTTP_ENABLED', 'true') !== 'false';
  if (httpEnabled) {
    // Control Plane runs on port 3100 by default
    const port = config.get<number>('CONTROL_PLANE_PORT', 3100);
    await app.listen(port);

    Logger.log(
      `Control Plane API is running on: http://localhost:${port}/${globalPrefix}`,
      'Bootstrap',
    );
  } else {
    await app.init();
    Logger.log('Control Plane runtime started without HTTP listener', 'Bootstrap');
  }
}

bootstrap();
