import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityTarget, ObjectLiteral, Repository } from 'typeorm';

/**
 * Compatibility shim for legacy TenantDbService imports.
 * In the single-instance architecture we keep a single DataSource and ignore tenantId.
 */
@Injectable()
export class TenantDbService {
  private readonly defaultTenantId = process.env.INSTANCE_ID || 'default-instance';

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getDataSource(_tenantId?: string): Promise<DataSource> {
    return this.dataSource;
  }

  async getRepository<T extends ObjectLiteral>(
    _tenantId: string | undefined,
    entity: EntityTarget<T>,
  ): Promise<Repository<T>> {
    // tenantId ignored in single-instance deployment; shim retains signature for backwards compatibility
    return this.dataSource.getRepository(entity);
  }

  async getAllTenants(): Promise<Array<{ id: string; slug: string; status: string }>> {
    return [{ id: this.defaultTenantId, slug: this.defaultTenantId, status: 'active' }];
  }
}
