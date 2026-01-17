/**
 * AVA Module
 * HubbleWave Platform - Phase 6
 *
 * Registers all AVA services and controllers.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AVAConversation,
  AVAMessage,
  AVAIntent,
  AVAContext,
  AVAPrediction,
  AVAAnomaly,
  AVASuggestion,
  AVAFeedback,
  AVAKnowledgeEmbedding,
  AVAUsageMetrics,
  AVAAuditTrail,
  AVAPermissionConfig,
  AVAGlobalSettings,
} from '@hubblewave/instance-db';

import { AVACoreService } from './ava-core.service';
import { LLMProviderService } from './llm-provider.service';
import { AVAController } from './ava.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      // Core AVA entities
      AVAAuditTrail,
      AVAPermissionConfig,
      AVAGlobalSettings,
      // Phase 6: Conversations & Context
      AVAConversation,
      AVAMessage,
      AVAIntent,
      AVAContext,
      // Phase 6: Predictive Analytics
      AVAPrediction,
      AVAAnomaly,
      // Phase 6: Smart Suggestions & Learning
      AVASuggestion,
      AVAFeedback,
      AVAKnowledgeEmbedding,
      AVAUsageMetrics,
    ]),
  ],
  controllers: [AVAController],
  providers: [AVACoreService, LLMProviderService],
  exports: [AVACoreService, LLMProviderService],
})
export class AVAModule {}
