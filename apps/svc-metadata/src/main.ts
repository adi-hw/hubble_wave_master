import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

async function bootstrap() {
  if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }

  // Ensure JWT secret is set BEFORE module initialization so AuthGuardModule picks it up (dev fallback only)
  process.env.JWT_SECRET =
    process.env.JWT_SECRET ||
    process.env.IDENTITY_JWT_SECRET ||
    (process.env.NODE_ENV !== 'production' ? 'dev-only-insecure-secret' : undefined);

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

  // Support *.localhost patterns for tenant subdomains in development
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
      'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Tenant-Slug',
  });

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  // Prefer service-specific port vars and fall back to 3333 to avoid clashing with svc-identity (3000)
  const port =
    process.env.METADATA_PORT ||
    process.env.PORT_METADATA ||
    process.env.PORT_SVC_METADATA ||
    3333;

  await app.listen(port);
  Logger.log(
    `Metadata service running on: http://localhost:${port}/${globalPrefix}`
  );
}

bootstrap();
