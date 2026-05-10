import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import { ControlPlaneModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(ControlPlaneModule, { bufferLogs: true });

  app.use(helmet());
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  // Control Plane runs on port 3100 by default, distinct from the instance plane (3000).
  const port = parseInt(process.env.CONTROL_PLANE_PORT ?? '3100', 10);
  await app.listen(port);

  Logger.log(`apps/control-plane listening on http://localhost:${port}/${globalPrefix}`, 'Bootstrap');
}

bootstrap();
