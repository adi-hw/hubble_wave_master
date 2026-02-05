/**
 * HubbleWave AVA Service
 * Self-hosted AVA inference with instance-isolated RAG
 */

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app/app.module';
import { DataSource } from 'typeorm';
import { VectorStoreService } from '@hubblewave/ai';
import { assertSecureConfig } from '@hubblewave/shared-types';

async function bootstrap() {
  // SECURITY: Validate configuration before starting
  assertSecureConfig();

  const app = await NestFactory.create(AppModule);

  // Security
  app.use(helmet());
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:4200',
    credentials: true,
  });

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    })
  );

  // Global prefix for all routes
  const globalPrefix = 'api/ai';
  app.setGlobalPrefix(globalPrefix, {
    exclude: ['api/health'],
  });

  // Add health check endpoint at /api/health for ALB health checks
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/api/health', (_req: unknown, res: { status: (code: number) => { json: (body: unknown) => void } }) => {
    res.status(200).json({ status: 'ok', service: 'svc-ava' });
  });

  // Swagger API documentation
  const config = new DocumentBuilder()
    .setTitle('HubbleWave AVA Service')
    .setDescription(
      'Self-hosted AVA service with RAG, embeddings, and LLM inference'
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('AVA Chat', 'Chat completion and RAG endpoints')
    .addTag('AVA Embeddings', 'Vector store and embedding management')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(`${globalPrefix}/docs`, app, document);

  // Initialize AI tables
  const dataSource = app.get(DataSource);
  const vectorStore = app.get(VectorStoreService);
  await vectorStore.initializeVectorStore(dataSource);

  const port = process.env.AI_PORT || process.env.PORT || 3004;
  await app.listen(port);

  Logger.log(`AVA Service running on: http://localhost:${port}`);
  Logger.log(`API Docs: http://localhost:${port}/api/docs`);
}

bootstrap();
