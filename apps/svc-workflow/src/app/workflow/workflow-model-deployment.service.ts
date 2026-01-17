import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AuditLog,
  AnalyticsEvent,
  ModelDeployment,
  ModelDeploymentStatus,
  ProcessFlowDefinition,
  ProcessFlowInstance,
} from '@hubblewave/instance-db';

type ProcessFlowStartedPayload = {
  instanceId: string;
  processFlowCode?: string;
  input?: Record<string, unknown>;
};

type ProcessFlowCompletedPayload = {
  instanceId: string;
  output?: Record<string, unknown>;
};

type ProcessFlowFailedPayload = {
  instanceId: string;
};

const DEPLOYMENT_WORKFLOW_CODE = 'model_deployment_approval';

@Injectable()
export class WorkflowModelDeploymentService {
  private readonly terminalStatuses = new Set<ModelDeploymentStatus>([
    'approved',
    'rejected',
    'failed',
    'active',
    'inactive',
  ]);

  constructor(
    @InjectRepository(ModelDeployment)
    private readonly deploymentRepo: Repository<ModelDeployment>,
    @InjectRepository(ProcessFlowInstance)
    private readonly instanceRepo: Repository<ProcessFlowInstance>,
    @InjectRepository(ProcessFlowDefinition)
    private readonly definitionRepo: Repository<ProcessFlowDefinition>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(AnalyticsEvent)
    private readonly analyticsRepo: Repository<AnalyticsEvent>,
  ) {}

  @OnEvent('processFlow.started')
  async handleProcessFlowStarted(payload: ProcessFlowStartedPayload): Promise<void> {
    if (payload.processFlowCode !== DEPLOYMENT_WORKFLOW_CODE) {
      return;
    }
    const deploymentId = this.readDeploymentId(payload.input);
    if (!deploymentId) {
      return;
    }

    const deployment = await this.deploymentRepo.findOne({ where: { id: deploymentId } });
    if (!deployment || this.terminalStatuses.has(deployment.status)) {
      return;
    }

    const previous = { status: deployment.status, workflowInstanceId: deployment.workflowInstanceId };
    deployment.workflowInstanceId = payload.instanceId;
    deployment.status = 'pending_approval';
    await this.deploymentRepo.save(deployment);
    await this.logStatus(deployment.id, previous, {
      status: deployment.status,
      workflowInstanceId: deployment.workflowInstanceId,
    });
  }

  @OnEvent('processFlow.completed')
  async handleProcessFlowCompleted(payload: ProcessFlowCompletedPayload): Promise<void> {
    const deployment = await this.resolveDeployment(payload.instanceId);
    if (!deployment || this.terminalStatuses.has(deployment.status)) {
      return;
    }

    const approved = this.readApproval(payload.output);
    const nextStatus: ModelDeploymentStatus = approved === false ? 'rejected' : 'approved';
    const previous = { status: deployment.status, approvedBy: deployment.approvedBy };
    deployment.status = nextStatus;
    deployment.approvedBy = this.readApprover(payload.output) || deployment.approvedBy || null;
    await this.deploymentRepo.save(deployment);
    await this.logStatus(deployment.id, previous, {
      status: deployment.status,
      approvedBy: deployment.approvedBy,
    });
    await this.logAnalytics(
      nextStatus === 'approved'
        ? 'modelops.deployment.approved'
        : 'modelops.deployment.rejected',
      deployment.approvedBy || undefined,
      {
        deploymentId: deployment.id,
        modelArtifactId: deployment.modelArtifactId,
        status: deployment.status,
      },
    );
  }

  @OnEvent('processFlow.failed')
  async handleProcessFlowFailed(payload: ProcessFlowFailedPayload): Promise<void> {
    const deployment = await this.resolveDeployment(payload.instanceId);
    if (!deployment || this.terminalStatuses.has(deployment.status)) {
      return;
    }

    const previous = { status: deployment.status };
    deployment.status = 'failed';
    await this.deploymentRepo.save(deployment);
    await this.logStatus(deployment.id, previous, { status: deployment.status });
    await this.logAnalytics('modelops.deployment.failed', undefined, {
      deploymentId: deployment.id,
      modelArtifactId: deployment.modelArtifactId,
      status: deployment.status,
    });
  }

  private async resolveDeployment(instanceId: string): Promise<ModelDeployment | null> {
    const instance = await this.instanceRepo.findOne({ where: { id: instanceId } });
    if (!instance) {
      return null;
    }

    const definition = await this.definitionRepo.findOne({ where: { id: instance.processFlowId } });
    if (!definition || definition.code !== DEPLOYMENT_WORKFLOW_CODE) {
      return null;
    }

    const input = (instance.context as Record<string, unknown> | undefined)?.input as
      | Record<string, unknown>
      | undefined;
    const deploymentId = this.readDeploymentId(input);
    if (deploymentId) {
      return this.deploymentRepo.findOne({ where: { id: deploymentId } });
    }

    return this.deploymentRepo.findOne({ where: { workflowInstanceId: instanceId } });
  }

  private readDeploymentId(input?: Record<string, unknown>): string | null {
    if (!input) return null;
    const candidate = input['deploymentId'] ?? input['deployment_id'];
    if (typeof candidate !== 'string') {
      return null;
    }
    const trimmed = candidate.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private readApproval(output?: Record<string, unknown>): boolean | null {
    if (!output) return null;
    const approved = output['approved'];
    if (typeof approved === 'boolean') {
      return approved;
    }
    if (typeof approved === 'string') {
      const normalized = approved.trim().toLowerCase();
      if (normalized === 'true') return true;
      if (normalized === 'false') return false;
    }
    return null;
  }

  private readApprover(output?: Record<string, unknown>): string | null {
    if (!output) return null;
    const candidate = output['approvedBy'] ?? output['approverId'] ?? output['approved_by'];
    if (typeof candidate !== 'string') {
      return null;
    }
    const trimmed = candidate.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private async logStatus(
    recordId: string,
    oldValues: Record<string, unknown>,
    newValues: Record<string, unknown>,
  ): Promise<void> {
    const log = this.auditRepo.create({
      userId: null,
      action: 'modelops.deployment.status',
      collectionCode: 'model_deployments',
      recordId,
      oldValues,
      newValues,
    });
    await this.auditRepo.save(log);
  }

  private async logAnalytics(
    eventType: string,
    userId: string | undefined,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    const event = this.analyticsRepo.create({
      userId: userId || null,
      eventType,
      eventCategory: 'modelops',
      eventAction: eventType.split('.').pop(),
      metadata,
      timestamp: new Date(),
    });
    await this.analyticsRepo.save(event);
  }
}
