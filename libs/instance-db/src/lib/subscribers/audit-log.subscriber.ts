import { EventSubscriber, EntitySubscriberInterface, InsertEvent } from 'typeorm';
import { AuditLog } from '../entities/settings.entity';
import { buildAuditLogHash, buildAuditLogHashPayload } from '../audit-log-hash';

@EventSubscriber()
export class AuditLogSubscriber implements EntitySubscriberInterface<AuditLog> {
  listenTo() {
    return AuditLog;
  }

  async beforeInsert(event: InsertEvent<AuditLog>): Promise<void> {
    const repository = event.manager.getRepository(AuditLog);
    const last = await repository
      .createQueryBuilder('audit')
      .select(['audit.hash'])
      .orderBy('audit.createdAt', 'DESC')
      .addOrderBy('audit.id', 'DESC')
      .limit(1)
      .getOne();

    const previousHash = last?.hash || null;

    if (!event.entity.createdAt) {
      event.entity.createdAt = new Date();
    }

    event.entity.previousHash = previousHash;
    event.entity.hash = buildAuditLogHash(
      buildAuditLogHashPayload(event.entity, previousHash),
    );
  }
}
