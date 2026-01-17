import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthorizationService } from '@hubblewave/authorization';
import { RequestContext } from '@hubblewave/auth-guard';
import { AVAAction, AVAContext } from '@hubblewave/ai';
import { AVAGovernanceService } from '@hubblewave/ai';
import { CollectionDefinition } from '@hubblewave/instance-db';

export type AvaPreviewRequest = {
  action: AVAAction;
  context: AVAContext;
  requestContext: RequestContext;
  userMessage?: string;
  avaResponse?: string;
  conversationId?: string;
};

export type AvaPreviewResult = {
  previewId: string;
  requiresApproval: boolean;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  changes?: Array<{ field: string; before: unknown; after: unknown }>;
};

@Injectable()
export class AvaPreviewService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly authz: AuthorizationService,
    private readonly governance: AVAGovernanceService,
  ) {}

  async preview(request: AvaPreviewRequest): Promise<AvaPreviewResult> {
    const { action, context, requestContext } = request;
    const normalizedParams = this.ensureObject(action.params);

    if (!['create', 'update', 'execute'].includes(action.type)) {
      throw new BadRequestException(`Preview is not supported for ${action.type} actions`);
    }

    const { collectionCode, recordId } = this.parseTarget(action.target);
    const permission = await this.governance.checkPermission(this.dataSource, action, context);
    if (!permission.allowed) {
      throw new BadRequestException(permission.rejectionReason || 'Action not permitted');
    }

    let before: Record<string, unknown> | null = null;
    let after: Record<string, unknown> | null = null;
    let changes: Array<{ field: string; before: unknown; after: unknown }> = [];

    if (action.type === 'create') {
      await this.ensureAccess(requestContext, collectionCode, 'create');
      after = normalizedParams;
      changes = this.diffRecords({}, normalizedParams);
    }

    if (action.type === 'update') {
      await this.ensureAccess(requestContext, collectionCode, 'update');
      if (!recordId) {
        throw new BadRequestException('Update preview requires a record id');
      }
      const existing = await this.loadRecord(collectionCode, recordId, requestContext);
      before = existing;
      after = { ...existing, ...normalizedParams };
      changes = this.diffRecords(existing, normalizedParams);
    }

    const audit = await this.governance.recordAction(
      this.dataSource,
      {
        userId: context.userId,
        userName: context.userName,
        userRole: context.userRole,
        conversationId: request.conversationId,
        userMessage: request.userMessage,
        avaResponse: request.avaResponse,
        action,
        suggestedActions: [action as unknown as Record<string, unknown>],
        previewPayload: {
          before,
          after,
          changes,
          requiresApproval: permission.requiresConfirmation,
        },
        targetCollection: collectionCode || undefined,
        targetRecordId: recordId || undefined,
        beforeData: before || undefined,
        afterData: after || undefined,
      },
      'pending',
    );

    return {
      previewId: audit.id,
      requiresApproval: permission.requiresConfirmation,
      before,
      after,
      changes,
    };
  }

  private async loadRecord(
    collectionCode: string,
    recordId: string,
    requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const collectionRepo = this.dataSource.getRepository(CollectionDefinition);
    const definition = await collectionRepo.findOne({
      where: [{ code: collectionCode }, { tableName: collectionCode }],
    });
    if (!definition) {
      throw new NotFoundException(`Collection ${collectionCode} not found`);
    }

    const tableName = this.ensureSafeIdentifier(definition.tableName || collectionCode);
    const qb = this.dataSource
      .createQueryBuilder()
      .select('*')
      .from(`public.${tableName}`, 't')
      .where('t.id = :id', { id: recordId });

    const rowLevel = await this.authz.buildRowLevelClause(requestContext, tableName, 'read', 't');
    if (rowLevel.clauses.length > 0) {
      rowLevel.clauses.forEach((clause, index) => {
        qb.andWhere(clause, this.prefixParams(rowLevel.params, `rls_${index}_`));
      });
    }

    const rows = await qb.getRawMany<Record<string, unknown>>();
    if (!rows.length) {
      throw new NotFoundException('Record not found or not accessible');
    }
    return rows[0];
  }

  private async ensureAccess(
    context: RequestContext,
    collectionCode: string,
    operation: 'create' | 'update',
  ) {
    const collectionRepo = this.dataSource.getRepository(CollectionDefinition);
    const definition = await collectionRepo.findOne({
      where: [{ code: collectionCode }, { tableName: collectionCode }],
    });
    if (!definition) {
      throw new NotFoundException(`Collection ${collectionCode} not found`);
    }
    const tableName = definition.tableName || collectionCode;
    await this.authz.ensureTableAccess(context, tableName, operation);
  }

  private diffRecords(
    before: Record<string, unknown>,
    updates: Record<string, unknown>,
  ): Array<{ field: string; before: unknown; after: unknown }> {
    const changes: Array<{ field: string; before: unknown; after: unknown }> = [];
    const keys = Object.keys(updates).sort();
    for (const key of keys) {
      changes.push({
        field: key,
        before: before[key],
        after: updates[key],
      });
    }
    return changes;
  }

  private ensureObject(value?: Record<string, unknown>): Record<string, unknown> {
    if (!value) {
      return {};
    }
    if (typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException('action params must be an object');
    }
    return value;
  }

  private parseTarget(target: string): { collectionCode: string; recordId?: string } {
    const match = target.match(/^\/?([a-z_-]+)(?:\/([a-z0-9-]+))?/i);
    const collectionCode = match?.[1];
    if (!collectionCode) {
      throw new BadRequestException('Invalid action target');
    }
    const recordId = match?.[2] === 'new' ? undefined : match?.[2];
    return { collectionCode, recordId };
  }

  private ensureSafeIdentifier(value: string): string {
    if (!value || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
      throw new BadRequestException(`Invalid identifier: ${value}`);
    }
    return value;
  }

  private prefixParams(params: Record<string, unknown>, prefix: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(params)) {
      result[`${prefix}${key}`] = params[key];
    }
    return result;
  }
}
