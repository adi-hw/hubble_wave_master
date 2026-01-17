import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ProcessFlowDefinition } from '@hubblewave/instance-db';
import { RequestUser } from '@hubblewave/auth-guard';
import { CollectionDataService, QueryOptions } from '../collection-data.service';
import { EventOutboxService } from '../events/event-outbox.service';

const OFFERINGS_COLLECTION = 'offerings';
const WORK_ITEMS_COLLECTION = 'work_items';
const WORK_TIMELINE_COLLECTION = 'work_timeline';

export type SubmitOfferingRequest = {
  offeringId?: string;
  offeringCode?: string;
  title?: string;
  description?: string;
  priority?: string;
  message?: string;
  data?: Record<string, unknown>;
};

@Injectable()
export class OfferingsService {
  constructor(
    private readonly collectionData: CollectionDataService,
    private readonly dataSource: DataSource,
    private readonly outbox: EventOutboxService,
  ) {}

  async list(user: RequestUser, options: QueryOptions) {
    const context = this.buildContext(user);
    return this.collectionData.list(context, OFFERINGS_COLLECTION, options);
  }

  async submit(user: RequestUser, request: SubmitOfferingRequest) {
    const offering = await this.resolveOffering(user, request);
    const offeringRecord = offering.record as Record<string, unknown>;

    if (offeringRecord['is_active'] === false) {
      throw new BadRequestException('Offering is not active');
    }

    const now = new Date();
    const submissionData = request.data || {};
    const title = request.title || (offeringRecord['name'] as string) || 'Work Item';
    const description = request.description || (offeringRecord['description'] as string) || '';
    const priority = request.priority || (offeringRecord['default_priority'] as string) || 'normal';
    const slaMinutesRaw = offeringRecord['sla_target_minutes'];
    const slaMinutes = typeof slaMinutesRaw === 'number' ? slaMinutesRaw : Number(slaMinutesRaw);
    const hasSlaTarget = Number.isFinite(slaMinutes) && slaMinutes > 0;
    const dueAt = hasSlaTarget ? new Date(now.getTime() + slaMinutes * 60 * 1000) : undefined;

    const workItemPayload: Record<string, unknown> = {
      title,
      description,
      status: 'new',
      priority,
      offering_id: offeringRecord['id'],
      offering_code: offeringRecord['code'],
      requested_by: user.id,
      submitted_at: now,
      submission_data: submissionData,
      sla_target_minutes: hasSlaTarget ? slaMinutes : undefined,
      due_at: dueAt,
      sla_status: hasSlaTarget ? 'active' : undefined,
    };

    const workflowCode = offeringRecord['workflow_code'] as string | undefined;
    if (workflowCode) {
      const workflow = await this.dataSource
        .getRepository(ProcessFlowDefinition)
        .findOne({ where: { code: workflowCode, isActive: true } });

      if (!workflow) {
        throw new NotFoundException('Workflow definition not found for offering');
      }

      workItemPayload['workflow_definition_id'] = workflow.id;
    }

    const createdWorkItem = await this.collectionData.create(
      this.buildContext(user),
      WORK_ITEMS_COLLECTION,
      workItemPayload,
    );

    const timelineMessage =
      request.message || `Offering "${offeringRecord['name'] || 'Work Item'}" submitted`;

    await this.collectionData.create(
      this.buildContext(user),
      WORK_TIMELINE_COLLECTION,
      {
        work_item_id: createdWorkItem.record.id,
        event_type: 'submitted',
        message: timelineMessage,
        data: {
          offeringId: offeringRecord['id'],
          offeringCode: offeringRecord['code'],
        },
        created_by: user.id,
      },
    );

    if (workflowCode) {
      await this.outbox.enqueueWorkflowStart({
        workflowId: workItemPayload['workflow_definition_id'] as string,
        collectionCode: WORK_ITEMS_COLLECTION,
        recordId: createdWorkItem.record.id as string,
        inputs: {
          workItemId: createdWorkItem.record.id,
          offeringId: offeringRecord['id'],
          offeringCode: offeringRecord['code'],
          submission: submissionData,
        },
        userId: user.id,
      });
    }

    return {
      offering: offering.record,
      workItem: createdWorkItem.record,
    };
  }

  private async resolveOffering(user: RequestUser, request: SubmitOfferingRequest) {
    const context = this.buildContext(user);

    if (request.offeringId) {
      return this.collectionData.getOne(context, OFFERINGS_COLLECTION, request.offeringId);
    }

    if (!request.offeringCode) {
      throw new BadRequestException('offeringId or offeringCode is required');
    }

    const result = await this.collectionData.list(context, OFFERINGS_COLLECTION, {
      page: 1,
      pageSize: 1,
      filters: [
        {
          property: 'code',
          operator: 'equals',
          value: request.offeringCode,
        },
      ],
    });

    if (!result.data.length) {
      throw new NotFoundException('Offering not found');
    }

    return { record: result.data[0], fields: result.fields };
  }

  private buildContext(user: RequestUser) {
    return {
      userId: user.id,
      roles: user.roles,
      permissions: user.permissions,
      isAdmin: user.roles.includes('admin'),
    };
  }
}
