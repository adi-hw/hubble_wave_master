import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DependentReviewQueueEntry } from '@hubblewave/instance-db';
import type { PublishImpactReport } from './publish-impact.types';

interface ListOptions {
  collectionId?: string;
  status?: 'needs_review' | 'acknowledged' | 'dismissed' | 'open';
  limit?: number;
}

/**
 * Persistence layer for ADR-17's publish-impact review queue. The
 * publish flow calls `enqueueFromImpactReport` after a successful
 * publish whose diff carried structural or breaking property changes;
 * the Studio dashboard reads from `listOpen` and the count badge
 * polls `countOpen`.
 *
 * Acknowledgement and dismissal are both terminal — there is no
 * "reopen" path because admins should treat the queue as a one-time
 * follow-up surface tied to a specific publish event. If the same
 * dependent surfaces again on a later publish, a fresh row is added.
 */
@Injectable()
export class DependentReviewQueueService {
  constructor(
    @InjectRepository(DependentReviewQueueEntry)
    private readonly repo: Repository<DependentReviewQueueEntry>,
  ) {}

  async enqueueFromImpactReport(
    report: PublishImpactReport,
    userId?: string,
  ): Promise<number> {
    const candidates: Array<{
      collectionId: string;
      collectionCode: string;
      propertyCode: string;
      propertyId: string | null;
      changeKind: DependentReviewQueueEntry['changeKind'];
      classification: DependentReviewQueueEntry['classification'];
      entityType: string;
      entityId: string;
      entityLabel: string;
      href: string | null;
      reason: string;
    }> = [];
    for (const change of report.propertyChanges) {
      if (change.classification === 'cosmetic') continue;
      for (const dep of change.dependents) {
        candidates.push({
          collectionId: report.collectionId,
          collectionCode: report.collectionCode,
          propertyCode: change.propertyCode,
          propertyId: change.propertyId ?? null,
          changeKind: change.changeKind,
          classification: change.classification,
          entityType: dep.entityType,
          entityId: dep.entityId,
          entityLabel: dep.entityLabel,
          href: dep.href ?? null,
          reason: dep.reason,
        });
      }
    }
    if (candidates.length === 0) return 0;

    // Idempotency: skip dependents that already have an open
    // `needs_review` row for the same (collection, property, change_kind,
    // entity) tuple. A retry of the same publish — or a transient
    // failure that re-invokes the publish path — must not duplicate
    // queue entries; ADR-17 specifies the queue is "a single inbox."
    const entityIds = [...new Set(candidates.map((c) => c.entityId))];
    const existing = await this.repo.find({
      where: {
        entityId: In(entityIds),
        collectionId: report.collectionId,
        status: 'needs_review',
      },
    });
    const existingKeys = new Set(
      existing.map((r) => `${r.entityId}|${r.propertyCode}|${r.changeKind}`),
    );

    const rows = candidates
      .filter(
        (c) => !existingKeys.has(`${c.entityId}|${c.propertyCode}|${c.changeKind}`),
      )
      .map((c) =>
        this.repo.create({
          ...c,
          status: 'needs_review' as const,
          createdBy: userId ?? null,
        }),
      );

    if (rows.length === 0) return 0;
    await this.repo.save(rows);
    return rows.length;
  }

  async list(options: ListOptions = {}): Promise<DependentReviewQueueEntry[]> {
    const qb = this.repo.createQueryBuilder('q').orderBy('q.created_at', 'DESC');
    if (options.collectionId) {
      qb.andWhere('q.collection_id = :collectionId', { collectionId: options.collectionId });
    }
    if (options.status === 'open' || !options.status) {
      qb.andWhere('q.status = :status', { status: 'needs_review' });
    } else {
      qb.andWhere('q.status = :status', { status: options.status });
    }
    qb.limit(options.limit ?? 200);
    return qb.getMany();
  }

  async countOpen(collectionId?: string): Promise<number> {
    const qb = this.repo
      .createQueryBuilder('q')
      .where('q.status = :status', { status: 'needs_review' });
    if (collectionId) qb.andWhere('q.collection_id = :collectionId', { collectionId });
    return qb.getCount();
  }

  async acknowledge(id: string, userId: string, note?: string): Promise<DependentReviewQueueEntry> {
    return this.resolve(id, userId, 'acknowledged', note);
  }

  async dismiss(id: string, userId: string, note?: string): Promise<DependentReviewQueueEntry> {
    return this.resolve(id, userId, 'dismissed', note);
  }

  private async resolve(
    id: string,
    userId: string,
    status: 'acknowledged' | 'dismissed',
    note?: string,
  ): Promise<DependentReviewQueueEntry> {
    const entry = await this.repo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException(`Review queue entry ${id} not found`);
    entry.status = status;
    entry.resolvedBy = userId;
    entry.resolvedAt = new Date();
    entry.resolutionNote = note ?? null;
    return this.repo.save(entry);
  }

  async getByEntityIds(entityIds: string[]): Promise<DependentReviewQueueEntry[]> {
    if (entityIds.length === 0) return [];
    return this.repo.find({ where: { entityId: In(entityIds), status: 'needs_review' } });
  }
}
