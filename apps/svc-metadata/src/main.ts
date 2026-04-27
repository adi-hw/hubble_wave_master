import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { assertSecureConfig } from '@hubblewave/shared-types';

async function bootstrap() {
  // SECURITY: Validate configuration before starting
  assertSecureConfig();

  // Ensure JWT secret is set BEFORE module initialization so AuthGuardModule picks it up
  process.env.JWT_SECRET = process.env.JWT_SECRET || process.env.IDENTITY_JWT_SECRET;
  if (!process.env.JWT_SECRET) {
    throw new Error('REQUIRED env var JWT_SECRET (or IDENTITY_JWT_SECRET) not set');
  }

  const app = await NestFactory.create(AppModule);
  const isProd = process.env.NODE_ENV === 'production';

  const allowedOrigins = (process.env.CORS_ORIGINS ?? '').split(',').filter(Boolean);

  // Build regex patterns for wildcard subdomain support (e.g., *.localhost:4200)
  const originPatterns: (string | RegExp)[] = allowedOrigins.map((origin) => {
    if (origin.includes('*')) {
      const escaped = origin
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '[a-z0-9-]+');
      return new RegExp(`^${escaped}$`);
    }
    return origin;
  });

  // Support *.localhost patterns for instance subdomains in development
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

  const globalPrefix = 'api/metadata';
  app.setGlobalPrefix(globalPrefix);

  // Add health check endpoint at /api/health for ALB health checks
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/api/health', (_req: any, res: any) => {
    res.status(200).json({ status: 'ok', service: 'svc-metadata' });
  });

  // Prefer service-specific port vars and fall back to 3003
  const port =
    process.env.PORT ||
    process.env.METADATA_PORT ||
    process.env.PORT_METADATA ||
    process.env.PORT_SVC_METADATA ||
    3003;

  await app.listen(port);
  Logger.log(
    `Metadata service running on: http://localhost:${port}/${globalPrefix}`
  );
}

bootstrap();
