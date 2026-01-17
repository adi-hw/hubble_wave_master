import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { assertSecureConfig } from '@hubblewave/shared-types';

// Create Winston logger that excludes passwords/tokens
const winstonLogger = WinstonModule.createLogger({
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize(),
        winston.format.printf(
          ({ timestamp, level, message, context, ...meta }) => {
            // Filter out sensitive data
            const sanitizedMeta = JSON.stringify(meta, (key, value) => {
              if (
                [
                  'password',
                  'passwordHash',
                  'token',
                  'secret',
                  'accessToken',
                  'refreshToken',
                ].includes(key)
              ) {
                return '[REDACTED]';
              }
              return value;
            });
            return `${timestamp} [${context || 'App'}] ${level}: ${message} ${
              sanitizedMeta !== '{}' ? sanitizedMeta : ''
            }`;
          }
        )
      ),
    }),
  ],
});

async function bootstrap() {
  const isProd = process.env.NODE_ENV === 'production';

  // SECURITY: Validate configuration before starting
  // This will throw in production if insecure defaults are detected
  assertSecureConfig();

  // Validate JWT_SECRET is configured - REQUIRED in all environments
  const jwtSecret = process.env.JWT_SECRET || process.env.IDENTITY_JWT_SECRET;
  if (!jwtSecret) {
    throw new Error(
      'SECURITY ERROR: JWT_SECRET environment variable must be set. ' +
      'Generate a secure secret with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
    );
  }
  process.env.JWT_SECRET = jwtSecret;

  const app = await NestFactory.create(AppModule, {
    logger: winstonLogger,
  });

  // CORS first so OPTIONS/preflight gets headers
  const allowedOrigins = (process.env.CORS_ORIGINS ?? '').split(',').filter(Boolean);

  // Build regex patterns for wildcard subdomain support (e.g., *.localhost:4200)
  const originPatterns: (string | RegExp)[] = allowedOrigins.map((origin) => {
    if (origin.includes('*')) {
      // Convert wildcard pattern to regex: http://*.localhost:4200 -> /^http:\/\/[^.]+\.localhost:4200$/
      const escaped = origin
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape regex special chars except *
        .replace(/\*/g, '[a-z0-9-]+'); // Replace * with pattern for subdomain
      return new RegExp(`^${escaped}$`);
    }
    return origin;
  });

  // Also support *.localhost patterns for instance subdomains in development
  // and localhost with any port
  if (!isProd) {
    originPatterns.push(/^http:\/\/[a-z0-9-]+\.localhost:\d+$/);
    originPatterns.push(/^http:\/\/localhost:\d+$/);
  }

  app.enableCors({
    origin:
      allowedOrigins.length > 0 || !isProd
        ? (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
            // Allow tools like Postman with no origin
            if (!origin) {
              cb(null, true);
              return;
            }
            // Check against exact matches and regex patterns
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
      'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Instance-Slug, X-XSRF-TOKEN',
    optionsSuccessStatus: 204,
  });
  Logger.log(`CORS enabled for origins: ${allowedOrigins.join(', ')} (+ subdomain patterns in dev)`, 'Bootstrap');

  // Cookie parser for reading cookies (required for CSRF and refresh tokens)
  app.use(cookieParser());

  // Security headers with Helmet (after CORS)
  const styleSrc = isProd ? ["'self'"] : ["'self'", "'unsafe-inline'"];

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc,
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      frameguard: {
        action: 'deny',
      },
      noSniff: true,
      xssFilter: true,
    })
  );
  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  // Swagger Configuration (disable in prod unless explicitly enabled)
  const swaggerEnabled =
    process.env.SWAGGER_ENABLED === 'true' ||
    (process.env.NODE_ENV !== 'production' && process.env.SWAGGER_ENABLED !== 'false');

  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('HubbleWave Platform API')
      .setDescription('HubbleWave Platform API documentation')
      .setVersion('1.0')
      .addBearerAuth()
      .addApiKey({ type: 'apiKey', name: 'X-API-KEY', in: 'header' }, 'X-API-KEY')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(`${globalPrefix}/docs`, app, document);
  } else {
    Logger.log('Swagger disabled (set SWAGGER_ENABLED=true to enable)', 'Bootstrap');
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`
  );
  Logger.log(
    `📄 Swagger Documentation: http://localhost:${port}/${globalPrefix}/docs`
  );
}

bootstrap();
