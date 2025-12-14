/**
 * HubbleWave AI Service
 * Self-hosted LLM inference with tenant-isolated RAG
 */

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app/app.module';

async function bootstrap() {
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

  // Swagger API documentation
  const config = new DocumentBuilder()
    .setTitle('HubbleWave AI Service')
    .setDescription(
      'Self-hosted AI service with RAG, embeddings, and LLM inference'
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('AI Chat', 'Chat completion and RAG endpoints')
    .addTag('AI Embeddings', 'Vector store and embedding management')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3003;
  await app.listen(port);

  Logger.log(`AI Service running on: http://localhost:${port}`);
  Logger.log(`API Docs: http://localhost:${port}/api/docs`);
}

bootstrap();
