import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityTarget, ObjectLiteral, Repository } from 'typeorm';

/**
 * Instance identity surface for the customer instance plane.
 *
 * Per Canon §5, every customer is provisioned its own instance with a
 * dedicated database. The runtime in this process is bound to exactly
 * one instance: the connection string is fixed at deploy time, the
 * `INSTANCE_ID` env var identifies which customer it serves, and there
 * is intentionally no API for routing requests to a different
 * instance's database.
 *
 * This service exposes the bound instance's identity and a typed
 * accessor for the bound DataSource. It does not accept an instanceId
 * parameter, because no caller in the instance plane has authority to
 * cross instances. Cross-instance operations belong on the control
 * plane.
 */
@Injectable()
export class InstanceDbService {
  readonly instanceId: string = process.env['INSTANCE_ID'] || 'default-instance';

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  getDataSource(): DataSource {
    return this.dataSource;
  }

  getRepository<T extends ObjectLiteral>(entity: EntityTarget<T>): Repository<T> {
    return this.dataSource.getRepository(entity);
  }
}
