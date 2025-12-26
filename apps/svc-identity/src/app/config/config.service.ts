import { Injectable, NotFoundException } from '@nestjs/common';

/**
 * Simplified config service placeholder. Configuration was previously stored per-tenant;
 * for single-instance deployments this service simply throws when a tenant-scoped lookup is attempted.
 */
@Injectable()
export class ConfigServiceLocal {
  async get(): Promise<never> {
    throw new NotFoundException('Config service is disabled in single-instance mode.');
  }

  async set(): Promise<never> {
    throw new NotFoundException('Config service is disabled in single-instance mode.');
  }

  async list(): Promise<[]> {
    return [];
  }
}
