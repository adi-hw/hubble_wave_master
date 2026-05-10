import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AuditLog,
  Locale,
  LocalizationBundle,
  TranslationKey,
  TranslationValue,
  TranslationRequest,
  InstanceEventOutbox,
  ProcessFlowDefinition,
} from '@hubblewave/instance-db';
import { LocalizationController } from './localization.controller';
import { LocalizationService } from './localization.service';
import { LocalizationRequestService } from './localization-request.service';
import { LocalizationStudioService } from './localization-studio.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Locale,
      TranslationKey,
      TranslationValue,
      LocalizationBundle,
      TranslationRequest,
      InstanceEventOutbox,
      ProcessFlowDefinition,
      AuditLog,
    ]),
  ],
  controllers: [LocalizationController],
  providers: [LocalizationService, LocalizationRequestService, LocalizationStudioService],
  exports: [LocalizationService, LocalizationRequestService, LocalizationStudioService],
})
export class LocalizationModule {}
