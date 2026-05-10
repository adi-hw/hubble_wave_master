import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AutomationRule,
  CollectionDefinition,
  DependentReviewQueueEntry,
  FormDefinition,
  FormVersion,
  ProcessFlowDefinition,
  PropertyDefinition,
  PropertyDefinitionRevision,
  ViewDefinition,
  ViewDefinitionRevision,
} from '@hubblewave/instance-db';
import { PublishImpactService } from './publish-impact.service';
import { DependentReviewQueueService } from './dependent-review-queue.service';
import { DependentReviewQueueController } from './dependent-review-queue.controller';
import { ImpactAnalyzerRegistry } from './impact-analyzer.registry';
import { IMPACT_ANALYZERS, type ImpactAnalyzer } from './impact-analyzer.types';
import { ViewImpactAnalyzer } from './analyzers/view-impact.analyzer';
import { FormImpactAnalyzer } from './analyzers/form-impact.analyzer';
import { ProcessFlowImpactAnalyzer } from './analyzers/process-flow-impact.analyzer';
import { AutomationRuleImpactAnalyzer } from './analyzers/automation-rule-impact.analyzer';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CollectionDefinition,
      PropertyDefinition,
      PropertyDefinitionRevision,
      ViewDefinition,
      ViewDefinitionRevision,
      FormDefinition,
      FormVersion,
      ProcessFlowDefinition,
      AutomationRule,
      DependentReviewQueueEntry,
    ]),
  ],
  controllers: [DependentReviewQueueController],
  providers: [
    PublishImpactService,
    DependentReviewQueueService,
    ImpactAnalyzerRegistry,
    ViewImpactAnalyzer,
    FormImpactAnalyzer,
    ProcessFlowImpactAnalyzer,
    AutomationRuleImpactAnalyzer,
    {
      provide: IMPACT_ANALYZERS,
      useFactory: (
        viewAnalyzer: ViewImpactAnalyzer,
        formAnalyzer: FormImpactAnalyzer,
        flowAnalyzer: ProcessFlowImpactAnalyzer,
        ruleAnalyzer: AutomationRuleImpactAnalyzer,
      ): ImpactAnalyzer[] => [viewAnalyzer, formAnalyzer, flowAnalyzer, ruleAnalyzer],
      inject: [
        ViewImpactAnalyzer,
        FormImpactAnalyzer,
        ProcessFlowImpactAnalyzer,
        AutomationRuleImpactAnalyzer,
      ],
    },
  ],
  exports: [PublishImpactService, DependentReviewQueueService],
})
export class PublishImpactModule {}
