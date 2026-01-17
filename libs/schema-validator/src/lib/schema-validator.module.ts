/**
 * Schema Validator Module
 * HubbleWave Platform - Phase 2
 *
 * NestJS module for schema validation services.
 */

import { Module, Global } from '@nestjs/common';
import { SchemaValidatorService } from './schema-validator.service';

@Global()
@Module({
  providers: [SchemaValidatorService],
  exports: [SchemaValidatorService],
})
export class SchemaValidatorModule {}
