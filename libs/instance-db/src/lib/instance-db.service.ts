import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityTarget, ObjectLiteral, Repository } from 'typeorm';

/**
 * InstanceDbService for single-instance architecture.
 * Uses a single DataSource and ignores instanceId parameter for API compatibility.
 */
@Injectable()
export class InstanceDbService {
  private readonly defaultInstanceId = process.env['INSTANCE_ID'] || 'default-instance';

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getDataSource(_instanceId?: string): Promise<DataSource> {
    return this.dataSource;
  }

  async getRepository<T extends ObjectLiteral>(
    _instanceId: string | undefined,
    entity: EntityTarget<T>,
  ): Promise<Repository<T>> {
    // instanceId ignored in single-instance deployment; shim retains signature for backwards compatibility
    return this.dataSource.getRepository(entity);
  }

  async getAllInstances(): Promise<Array<{ id: string; slug: string; status: string }>> {
    return [{ id: this.defaultInstanceId, slug: this.defaultInstanceId, status: 'active' }];
  }
}

// Deprecated alias for backward compatibility
export { InstanceDbService as TenantDbService };
