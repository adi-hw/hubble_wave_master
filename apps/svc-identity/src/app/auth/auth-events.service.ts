import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { AuthEvent } from '@eam-platform/platform-db';

export interface AuthEventRecord {
  tenantId?: string;
  userId?: string;
  type: string;
  ip?: string;
  userAgent?: string;
  correlationId?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class AuthEventsService {
  constructor(
    @InjectRepository(AuthEvent)
    private readonly repo: Repository<AuthEvent>,
  ) {}

  async record(evt: AuthEventRecord) {
    await this.repo.save(
      this.repo.create({
        ...evt,
        metadata: evt.metadata ?? {},
      }),
    );
  }

  async cleanupOlderThan(days: number) {
    if (days <= 0) return;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    await this.repo.delete({ createdAt: LessThan(cutoff) as any });
  }
}
