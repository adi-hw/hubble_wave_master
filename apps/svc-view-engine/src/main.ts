import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { assertSecureConfig, assertJwtConfig } from '@hubblewave/shared-types';

async function bootstrap() {
  assertSecureConfig();
  assertJwtConfig();

  process.env.JWT_SECRET = process.env.JWT_SECRET || process.env.IDENTITY_JWT_SECRET;
  if (!process.env.JWT_SECRET) {
    throw new Error('REQUIRED env var JWT_SECRET (or IDENTITY_JWT_SECRET) not set');
  }

  const app = await NestFactory.create(AppModule);
  const isProd = process.env.NODE_ENV === 'production';

  const allowedOrigins = (process.env.CORS_ORIGINS ?? '').split(',').filter(Boolean);

  const originPatterns: (string | RegExp)[] = allowedOrigins.map((origin) => {
    if (origin.includes('*')) {
      const escaped = origin
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '[a-z0-9-]+');
      return new RegExp(`^${escaped}$`);
    }
    return origin;
  });

  if (!isProd) {
    originPatterns.push(/^http:\/\/[a-z0-9-]+\.localhost:\d+$/);
    originPatterns.push(/^http:\/\/localhost:\d+$/);
    originPatterns.push(/^http:\/\/127\.0\.0\.1:\d+$/);
    originPatterns.push(/^http:\/\/\[::1\]:\d+$/);
  }

  app.enableCors({
    origin:
      allowedOrigins.length > 0 || !isProd
        ? (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
            if (!origin) {
              cb(null, true);
              return;
            }
            const isAllowed = originPatterns.some((pattern) => {
              if (typeof pattern === 'string') {
                return pattern === origin;
              }
              return pattern.test(origin);
            });
            if (isAllowed) {
              cb(null, true);
            } else {
              Logger.warn(`CORS blocked origin: ${origin}`, 'CORS');
              cb(new Error('Not allowed by CORS'));
            }
          }
        : true,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders:
      process.env.CORS_ALLOWED_HEADERS ??
      'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Instance-Slug',
  });

  const globalPrefix = 'api/view-engine';
  app.setGlobalPrefix(globalPrefix);

  const port =
    process.env.PORT ||
    process.env.VIEW_ENGINE_PORT ||
    process.env.PORT_VIEW_ENGINE ||
    process.env.PORT_SVC_VIEW_ENGINE ||
    3006;

  await app.listen(port);
  Logger.log(
    `View Engine service running on: http://localhost:${port}/${globalPrefix}`
  );
}

bootstrap();
