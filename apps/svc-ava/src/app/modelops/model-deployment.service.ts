import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AuditLog,
  AnalyticsEvent,
  InstanceEventOutbox,
  ModelArtifact,
  ModelDeployment,
  ProcessFlowDefinition,
} from '@hubblewave/instance-db';
import { ModelDeploymentRequest, ModelDeploymentUpdate } from './model-deployment.types';

const DEPLOYMENT_WORKFLOW_CODE = 'model_deployment_approval';

@Injectable()
export class ModelDeploymentService {
  constructor(
    @InjectRepository(ModelDeployment)
    private readonly deploymentRepo: Repository<ModelDeployment>,
    @InjectRepository(ModelArtifact)
    private readonly artifactRepo: Repository<ModelArtifact>,
    @InjectRepository(ProcessFlowDefinition)
    private readonly workflowRepo: Repository<ProcessFlowDefinition>,
    @InjectRepository(InstanceEventOutbox)
    private readonly outboxRepo: Repository<InstanceEventOutbox>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(AnalyticsEvent)
    private readonly analyticsRepo: Repository<AnalyticsEvent>,
  ) {}

  async listDeployments(): Promise<ModelDeployment[]> {
    return this.deploymentRepo.find({ order: { createdAt: 'DESC' } });
  }

  async getDeployment(id: string): Promise<ModelDeployment> {
    const deployment = await this.deploymentRepo.findOne({ where: { id } });
    if (!deployment) {
      throw new NotFoundException('Model deployment not found');
    }
    return deployment;
  }

  async createDeployment(payload: ModelDeploymentRequest, actorId?: string): Promise<ModelDeployment> {
    this.validateCreate(payload);
    const artifact = await this.artifactRepo.findOne({ where: { id: payload.modelArtifactId } });
    if (!artifact) {
      throw new NotFoundException('Model artifact not found');
    }
    if (artifact.status !== 'registered') {
      throw new BadRequestException('Model artifact is not registered');
    }

    const approvers = this.normalizeApprovers(payload.approverIds);
    if (!approvers.length) {
      throw new BadRequestException('At least one approver is required');
    }

    const metadata = this.mergeMetadata(payload.metadata, approvers);
    const deployment = this.deploymentRepo.create({
      modelArtifactId: artifact.id,
      targetType: payload.targetType.trim(),
      targetConfig: payload.targetConfig || {},
      status: 'pending_approval',
      requestedBy: actorId || null,
      metadata,
    });

    const saved = await this.deploymentRepo.save(deployment);
    const workflow = await this.ensureWorkflowDefinition(actorId);
    await this.enqueueApproval(saved, workflow.id, approvers, actorId);
    await this.logAudit('modelops.deployment.create', actorId, saved.id, null, {
      modelArtifactId: saved.modelArtifactId,
      targetType: saved.targetType,
      status: saved.status,
    });
    await this.logAnalytics('modelops.deployment.requested', actorId, {
      deploymentId: saved.id,
      modelArtifactId: saved.modelArtifactId,
      targetType: saved.targetType,
      status: saved.status,
    });

    return saved;
  }

  async updateDeployment(
    id: string,
    payload: ModelDeploymentUpdate,
    actorId?: string,
  ): Promise<ModelDeployment> {
    const deployment = await this.getDeployment(id);
    if (deployment.status !== 'pending_approval') {
      throw new BadRequestException('Deployment can only be updated while pending approval');
    }

    const previous = {
      targetType: deployment.targetType,
      targetConfig: deployment.targetConfig,
      metadata: deployment.metadata,
    };

    if (payload.targetType !== undefined) {
      if (!payload.targetType.trim()) {
        throw new BadRequestException('Target type is required');
      }
      deployment.targetType = payload.targetType.trim();
    }
    if (payload.targetConfig) {
      deployment.targetConfig = payload.targetConfig;
    }
    if (payload.metadata) {
      deployment.metadata = { ...(deployment.metadata || {}), ...payload.metadata };
    }

    const saved = await this.deploymentRepo.save(deployment);
    await this.logAudit('modelops.deployment.update', actorId, saved.id, previous, {
      targetType: saved.targetType,
      targetConfig: saved.targetConfig,
      metadata: saved.metadata,
    });

    return saved;
  }

  private validateCreate(payload: ModelDeploymentRequest): void {
    if (!payload.modelArtifactId || !payload.modelArtifactId.trim()) {
      throw new BadRequestException('Model artifact id is required');
    }
    if (!payload.targetType || !payload.targetType.trim()) {
      throw new BadRequestException('Target type is required');
    }
  }

  private normalizeApprovers(approvers?: string[]): string[] {
    return (approvers || []).map((id) => id.trim()).filter(Boolean);
  }

  private mergeMetadata(
    metadata: Record<string, unknown> | undefined,
    approvers: string[],
  ): Record<string, unknown> {
    return {
      ...(metadata || {}),
      approval: {
        approvers,
      },
    };
  }

  private async ensureWorkflowDefinition(actorId?: string): Promise<ProcessFlowDefinition> {
    const existing = await this.workflowRepo.findOne({
      where: { code: DEPLOYMENT_WORKFLOW_CODE },
    });
    if (existing) {
      if (!existing.isActive) {
        existing.isActive = true;
        existing.updatedBy = actorId || null;
        return this.workflowRepo.save(existing);
      }
      return existing;
    }

    const definition = this.workflowRepo.create({
      code: DEPLOYMENT_WORKFLOW_CODE,
      name: 'Model Deployment Approval',
      description: 'Approve model deployments before activation',
      triggerType: 'manual',
      runAs: 'system',
      isActive: true,
      timeoutMinutes: 1440,
      maxRetries: 0,
      version: 1,
      canvas: {
        nodes: [
          { id: 'start', type: 'start', position: { x: 120, y: 120 }, name: 'Start', config: {} },
          {
            id: 'approval',
            type: 'approval',
            position: { x: 360, y: 120 },
            name: 'Approve Deployment',
            config: {
              approvers: '{{input.approvers}}',
              approvalType: 'sequential',
              timeoutMinutes: 10080,
            },
          },
          { id: 'end', type: 'end', position: { x: 620, y: 120 }, name: 'Complete', config: {} },
        ],
        connections: [
          { id: 'start-approval', fromNode: 'start', toNode: 'approval' },
          { id: 'approval-end', fromNode: 'approval', toNode: 'end' },
        ],
      },
      createdBy: actorId || null,
      updatedBy: actorId || null,
    });

    return this.workflowRepo.save(definition);
  }

  private async enqueueApproval(
    deployment: ModelDeployment,
    workflowId: string,
    approvers: string[],
    actorId?: string,
  ): Promise<void> {
    const outbox = this.outboxRepo.create({
      eventType: 'automation.workflow.start',
      collectionCode: 'model_deployments',
      recordId: deployment.id,
      payload: {
        userId: actorId || null,
        recordId: deployment.id,
        workflow: {
          workflowId,
          inputs: {
            deploymentId: deployment.id,
            modelArtifactId: deployment.modelArtifactId,
            targetType: deployment.targetType,
            targetConfig: deployment.targetConfig,
            approvers,
            requestedBy: deployment.requestedBy || null,
          },
        },
      },
    });
    await this.outboxRepo.save(outbox);
  }

  private async logAudit(
    action: string,
    actorId: string | undefined,
    recordId: string,
    oldValues: Record<string, unknown> | null,
    newValues: Record<string, unknown>,
  ): Promise<void> {
    const log = this.auditRepo.create({
      userId: actorId || null,
      action,
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
