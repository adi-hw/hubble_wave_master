import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InAppNotification } from '@hubblewave/instance-db';

@Injectable()
export class InAppNotificationService {
  constructor(
    @InjectRepository(InAppNotification)
    private readonly inAppRepo: Repository<InAppNotification>,
  ) {}

  async listForUser(userId: string, unreadOnly = false) {
    const qb = this.inAppRepo
      .createQueryBuilder('notification')
      .where('notification.userId = :userId', { userId })
      .orderBy('notification.createdAt', 'DESC')
      .take(100);

    if (unreadOnly) {
      qb.andWhere('notification.read = :read', { read: false });
    }

    return qb.getMany();
  }

  async getUnreadCount(userId: string) {
    return this.inAppRepo.count({ where: { userId, read: false } });
  }

  async markAsRead(id: string, userId: string) {
    const notification = await this.inAppRepo.findOne({ where: { id, userId } });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    notification.read = true;
    notification.readAt = new Date();
    return this.inAppRepo.save(notification);
  }

  async markAllAsRead(userId: string) {
    const result = await this.inAppRepo.update(
      { userId, read: false },
      { read: true, readAt: new Date() },
    );
    return result.affected || 0;
  }
}
