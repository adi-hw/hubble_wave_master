import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ProcessFlowDefinition,
  ProcessFlowDefinitionRevision,
  ProcessFlowInstance,
  ProcessFlowExecutionHistory,
  Approval,
  Connector,
  DecisionInput,
  DecisionRow,
  DecisionTable,
  InstanceEventOutbox,
  TranslationRequest,
  ModelDeployment,
  AnalyticsEvent,
  AuditLog,
  CollectionDefinition,
  PropertyDefinition,
  User,
} from '@hubblewave/instance-db';
import { WorkflowDefinitionsController } from './workflow-definitions.controller';
import { WorkflowInstancesController } from './workflow-instances.controller';
import { WorkflowApprovalsController } from './workflow-approvals.controller';
import { WorkflowWebhookController } from './workflow-webhook.controller';
import { WorkflowDefinitionService } from './workflow-definition.service';
import { WorkflowInstanceService } from './workflow-instance.service';
import { WorkflowApprovalService } from './workflow-approval.service';
import { WorkflowActionService } from './workflow-action.service';
import { WorkflowOutboxProcessor } from './workflow-outbox-processor.service';
import { WorkflowAuditService } from './workflow-audit.service';
import { RecordMutationService } from './record-mutation.service';
import { OutboxPublisherService } from './outbox-publisher.service';
import { WorkflowSlaService } from './workflow-sla.service';
import { WorkflowTranslationRequestService } from './workflow-translation-request.service';
import { WorkflowModelDeploymentService } from './workflow-model-deployment.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProcessFlowDefinition,
      ProcessFlowDefinitionRevision,
      ProcessFlowInstance,
      ProcessFlowExecutionHistory,
      Approval,
      Connector,
      DecisionTable,
      DecisionInput,
      DecisionRow,
      InstanceEventOutbox,
      TranslationRequest,
      ModelDeployment,
      AnalyticsEvent,
      AuditLog,
      CollectionDefinition,
      PropertyDefinition,
      User,
    ]),
  ],
  controllers: [
    WorkflowDefinitionsController,
    WorkflowInstancesController,
    WorkflowApprovalsController,
    WorkflowWebhookController,
  ],
  providers: [
    WorkflowDefinitionService,
    WorkflowInstanceService,
    WorkflowApprovalService,
    WorkflowActionService,
    WorkflowOutboxProcessor,
    WorkflowAuditService,
    WorkflowSlaService,
    WorkflowTranslationRequestService,
    WorkflowModelDeploymentService,
    RecordMutationService,
    OutboxPublisherService,
  ],
})
export class WorkflowModule {}
