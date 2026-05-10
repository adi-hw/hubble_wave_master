import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { AuthEvent } from '@hubblewave/instance-db';

export interface AuthEventRecord {
  userId?: string;
  eventType: string;
  success: boolean;
  ipAddress?: string;
  userAgent?: string;
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
        userId: evt.userId,
        eventType: evt.eventType,
        success: evt.success,
        ipAddress: evt.ipAddress,
        userAgent: evt.userAgent,
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

