import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { assertSecureConfig } from '@hubblewave/shared-types';

async function bootstrap() {
  assertSecureConfig();

  const jwtSecret = process.env.JWT_SECRET || process.env.IDENTITY_JWT_SECRET;
  if (!jwtSecret) {
    throw new Error(
      'JWT_SECRET or IDENTITY_JWT_SECRET environment variable is required. ' +
      'Set one of these to a secure random string before starting the application.'
    );
  }
  process.env.JWT_SECRET = jwtSecret;

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

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  const port =
    process.env.PORT ||
    process.env.WORKFLOW_PORT ||
    process.env.PORT_WORKFLOW ||
    process.env.PORT_SVC_WORKFLOW ||
    3007;

  await app.listen(port);
  Logger.log(`Workflow service running on: http://localhost:${port}/${globalPrefix}`);
}

bootstrap();
