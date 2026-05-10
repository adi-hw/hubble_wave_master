import { BadRequestException, Injectable } from '@nestjs/common';
import { RequestUser } from '@hubblewave/auth-guard';
import { CollectionDataService, QueryOptions } from '../collection-data.service';

const WORK_ITEMS_COLLECTION = 'work_items';
const WORK_COMMENTS_COLLECTION = 'work_comments';
const WORK_TIMELINE_COLLECTION = 'work_timeline';

export type AddWorkCommentRequest = {
  body: string;
};

export type TransitionWorkItemRequest = {
  status: string;
  message?: string;
  data?: Record<string, unknown>;
};

@Injectable()
export class WorkService {
  constructor(private readonly collectionData: CollectionDataService) {}

  async list(user: RequestUser, options: QueryOptions) {
    const context = this.buildContext(user);
    return this.collectionData.list(context, WORK_ITEMS_COLLECTION, options);
  }

  async get(user: RequestUser, id: string) {
    const context = this.buildContext(user);
    return this.collectionData.getOne(context, WORK_ITEMS_COLLECTION, id);
  }

  async addComment(user: RequestUser, workItemId: string, request: AddWorkCommentRequest) {
    if (!request.body || request.body.trim().length === 0) {
      throw new BadRequestException('comment body is required');
    }

    const context = this.buildContext(user);

    const comment = await this.collectionData.create(context, WORK_COMMENTS_COLLECTION, {
      work_item_id: workItemId,
      body: request.body.trim(),
      author_id: user.id,
    });

    await this.collectionData.create(context, WORK_TIMELINE_COLLECTION, {
      work_item_id: workItemId,
      event_type: 'commented',
      message: 'Comment added',
      data: {
        commentId: comment.record.id,
      },
      created_by: user.id,
    });

    return comment.record;
  }

  async transition(user: RequestUser, workItemId: string, request: TransitionWorkItemRequest) {
    if (!request.status || request.status.trim().length === 0) {
      throw new BadRequestException('status is required');
    }

    const context = this.buildContext(user);
    const normalizedStatus = request.status.trim();
    const completedStatuses = new Set(['completed', 'closed', 'resolved', 'done', 'cancelled']);
    const isCompleted = completedStatuses.has(normalizedStatus.toLowerCase());
    const updates: Record<string, unknown> = { status: normalizedStatus };
    if (isCompleted) {
      updates.sla_status = 'met';
      updates.sla_met_at = new Date();
    }

    const updated = await this.collectionData.update(context, WORK_ITEMS_COLLECTION, workItemId, updates);

    await this.collectionData.create(context, WORK_TIMELINE_COLLECTION, {
      work_item_id: workItemId,
      event_type: 'status_changed',
      message: request.message || `Status changed to ${normalizedStatus}`,
      data: request.data || { status: normalizedStatus },
      created_by: user.id,
    });

    return updated.record;
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
